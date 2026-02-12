import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  fetchSheetData, loadLocal, saveLocal, loadIdentity, saveIdentity,
  nameToId, IDEA_NAMES, IDEA_IDS, IDEA_ID_BY_NAME, ALL_PEOPLE,
} from "./data";

const DEFAULT_TIER_BOUNDS = { tier1Min: 6, tier2Min: 3 };

const TIER_META = {
  tier1: {
    label: "Clearly above my bar",
    border: "border-emerald-400", bg: "bg-emerald-50",
    headerBg: "bg-emerald-500", headerText: "text-white",
    tagBg: "bg-emerald-100 text-emerald-700", tag: "T1",
  },
  tier2: {
    label: "Above my bar, but some questions",
    border: "border-amber-400", bg: "bg-amber-50",
    headerBg: "bg-amber-500", headerText: "text-white",
    tagBg: "bg-amber-100 text-amber-700", tag: "T2",
  },
  tier3: {
    label: "Below my bar",
    border: "border-red-400", bg: "bg-red-50",
    headerBg: "bg-red-500", headerText: "text-white",
    tagBg: "bg-red-100 text-red-700", tag: "T3",
  },
};

function tierForRating(rating, bounds) {
  if (rating >= bounds.tier1Min) return "tier1";
  if (rating >= bounds.tier2Min) return "tier2";
  return "tier3";
}

function initTiersFromRatings(items, bounds) {
  const tiers = { tier1: [], tier2: [], tier3: [] };
  items.forEach(item => {
    tiers[tierForRating(item.rating, bounds)].push(item.id);
  });
  for (const key of Object.keys(tiers)) {
    tiers[key].sort((a, b) => {
      const ra = items.find(i => i.id === a)?.rating ?? 0;
      const rb = items.find(i => i.id === b)?.rating ?? 0;
      return rb - ra;
    });
  }
  return tiers;
}

function sortTierByRatings(tierIds, ratings, itemMap) {
  return [...tierIds].sort((a, b) => {
    const ra = ratings[a] ?? itemMap[a]?.rating ?? 0;
    const rb = ratings[b] ?? itemMap[b]?.rating ?? 0;
    return rb - ra;
  });
}

function RatingControl({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5,6,7].map(n => (
        <button key={n} onClick={(e) => { e.stopPropagation(); onChange(n); }}
          className={`w-5 h-5 rounded text-[10px] font-bold transition-all ${n <= value ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-400 hover:bg-slate-300"}`}>
          {n}
        </button>
      ))}
    </div>
  );
}

function TierSettings({ bounds, setBounds }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)} className="text-xs text-slate-500 hover:text-slate-700 underline">
        {open ? "Hide tier settings" : "Tier settings"}
      </button>
      {open && (
        <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg inline-flex flex-wrap gap-4 items-center text-sm">
          <div className="flex items-center gap-2">
            <label className="text-slate-600">T1 minimum:</label>
            <select value={bounds.tier1Min} onChange={e => setBounds(prev => ({ ...prev, tier1Min: parseInt(e.target.value) }))}
              className="border border-slate-300 rounded px-2 py-1 bg-white text-sm">
              {[2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-600">T2 minimum:</label>
            <select value={bounds.tier2Min} onChange={e => setBounds(prev => ({ ...prev, tier2Min: parseInt(e.target.value) }))}
              className="border border-slate-300 rounded px-2 py-1 bg-white text-sm">
              {[1,2,3,4,5,6].filter(n => n < bounds.tier1Min).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="text-xs text-slate-400">
            T1: {bounds.tier1Min}-7 | T2: {bounds.tier2Min}-{bounds.tier1Min - 1} | T3: 1-{bounds.tier2Min - 1}
          </div>
        </div>
      )}
    </div>
  );
}

function IdentitySelector({ onSelect }) {
  const [selected, setSelected] = useState("");
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 max-w-md w-full mx-4">
        <h1 className="text-xl font-bold text-slate-800 mb-1">CE Matching</h1>
        <p className="text-sm text-slate-500 mb-6">Co-founder & idea preference tool for the CE incubation program</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
          <p className="font-semibold mb-2">How your data is handled</p>
          <p className="mb-2"><strong>Your co-founder preferences are completely private.</strong> They are stored only in your browser's local storage on this device. Nobody else can see how you've rated or tiered other participants.</p>
          <p className="mb-2"><strong>Idea ratings come from a shared spreadsheet</strong> that everyone has access to already. The app just makes it easier to compare alignment.</p>
          <p><strong>Nothing is sent to any server.</strong> If you clear your browser data or switch devices, you'll need to re-enter your co-founder preferences. Idea ratings will reload from the shared sheet.</p>
        </div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Who are you?</label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white mb-4">
          <option value="">Select your name...</option>
          {ALL_PEOPLE.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <button onClick={() => selected && onSelect(selected)} disabled={!selected}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${selected ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
          Continue
        </button>
      </div>
    </div>
  );
}

function TierBoard({ tiers, setTiers, itemMap, label, ratings, onRatingChange, bounds, setBounds }) {
  const dragRef = useRef(null);
  const [dropTarget, setDropTarget] = useState(null);

  const moveItem = useCallback((itemId, targetTier, beforeId) => {
    setTiers(prev => {
      const next = {};
      for (const key of Object.keys(prev)) next[key] = prev[key].filter(id => id !== itemId);
      const arr = next[targetTier];
      if (beforeId) { const idx = arr.indexOf(beforeId); if (idx >= 0) arr.splice(idx, 0, itemId); else arr.push(itemId); }
      else arr.push(itemId);
      return next;
    });
  }, [setTiers]);

  const handleRatingChange = useCallback((id, newVal) => {
    onRatingChange(id, newVal);
    const correctTier = tierForRating(newVal, bounds);
    setTiers(prev => {
      let currentTier = null;
      for (const key of Object.keys(prev)) { if (prev[key].includes(id)) { currentTier = key; break; } }
      const next = { ...prev };
      for (const key of Object.keys(next)) next[key] = [...next[key]];
      if (currentTier !== correctTier) {
        next[currentTier] = next[currentTier].filter(x => x !== id);
        next[correctTier] = [...next[correctTier], id];
      }
      for (const key of Object.keys(next)) {
        next[key] = sortTierByRatings(next[key], { ...ratings, [id]: newVal }, itemMap);
      }
      return next;
    });
  }, [onRatingChange, bounds, setTiers, ratings, itemMap]);

  const onDragStart = (e, itemId) => { dragRef.current = { itemId }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", itemId); e.currentTarget.style.opacity = "0.4"; };
  const onDragEnd = (e) => { e.currentTarget.style.opacity = "1"; dragRef.current = null; setDropTarget(null); };
  const onItemDragEnter = (e, tierId, itemId) => { e.preventDefault(); e.stopPropagation(); if (dragRef.current && dragRef.current.itemId !== itemId) setDropTarget({ tierId, beforeId: itemId }); };
  const onItemDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const onItemDrop = (e, tierId, beforeId) => { e.preventDefault(); e.stopPropagation(); if (!dragRef.current) return; moveItem(dragRef.current.itemId, tierId, beforeId); dragRef.current = null; setDropTarget(null); };
  const onTierDragOver = (e) => e.preventDefault();
  const onTierDragEnter = (e, tierId) => { e.preventDefault(); if (dragRef.current) setDropTarget({ tierId, beforeId: null }); };
  const onTierDrop = (e, tierId) => { e.preventDefault(); if (!dragRef.current) return; moveItem(dragRef.current.itemId, tierId, null); dragRef.current = null; setDropTarget(null); };

  const rangeLabel = (tierId) => {
    if (tierId === "tier1") return `${bounds.tier1Min}-7`;
    if (tierId === "tier2") return `${bounds.tier2Min}-${bounds.tier1Min - 1}`;
    return `1-${bounds.tier2Min - 1}`;
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-700 mb-2">{label}</h2>
      <TierSettings bounds={bounds} setBounds={setBounds} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["tier1", "tier2", "tier3"].map(tierId => {
          const cfg = TIER_META[tierId];
          const items = tiers[tierId] || [];
          const isOver = dropTarget && dropTarget.tierId === tierId && !dropTarget.beforeId;
          return (
            <div key={tierId}
              className={`rounded-lg border-2 ${cfg.border} ${cfg.bg} min-h-[120px] transition-all ${isOver ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
              onDragOver={onTierDragOver} onDragEnter={(e) => onTierDragEnter(e, tierId)} onDrop={(e) => onTierDrop(e, tierId)}>
              <div className={`${cfg.headerBg} px-3 py-2 rounded-t-md`}>
                <span className={`text-sm font-semibold ${cfg.headerText}`}>{cfg.label}</span>
                <span className={`text-xs ${cfg.headerText} opacity-75 ml-2`}>({items.length}) [{rangeLabel(tierId)}]</span>
              </div>
              <div className="p-2 space-y-1">
                {items.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Drop items here</p>}
                {items.map(id => {
                  const item = itemMap[id];
                  if (!item) return null;
                  const showIndicator = dropTarget && dropTarget.tierId === tierId && dropTarget.beforeId === id;
                  const currentRating = ratings[id] ?? item.rating;
                  return (
                    <div key={id}>
                      {showIndicator && <div className="h-0.5 bg-blue-500 rounded-full mx-1 my-0.5" />}
                      <div draggable onDragStart={(e) => onDragStart(e, id)} onDragEnd={onDragEnd}
                        onDragEnter={(e) => onItemDragEnter(e, tierId, id)} onDragOver={onItemDragOver}
                        onDrop={(e) => onItemDrop(e, tierId, id)}
                        className="flex items-center justify-between bg-white rounded-md px-3 py-2 shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none">
                        <span className="text-sm font-medium text-slate-800 mr-2">{item.name}</span>
                        <RatingControl value={currentRating} onChange={(v) => handleRatingChange(id, v)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function computeAnalysis(myName, cfTiers, cfRatings, ideaRatings, allRatings, ideaColumns, cofounders) {
  const myRatings = {};
  ideaColumns.forEach((idea, i) => {
    const ideaId = IDEA_ID_BY_NAME[idea] || nameToId(idea);
    myRatings[idea] = ideaRatings[ideaId] ?? (allRatings[myName]?.[i] ?? 4);
  });
  return cofounders.map(cf => {
    const pRatings = {};
    ideaColumns.forEach((idea, i) => { pRatings[idea] = allRatings[cf.name]?.[i] ?? 0; });
    const effectiveRating = cfRatings[cf.id] ?? cf.rating;
    let cfTier = 3;
    if (cfTiers.tier1.includes(cf.id)) cfTier = 1;
    else if (cfTiers.tier2.includes(cf.id)) cfTier = 2;
    const ideaComparisons = ideaColumns.map(idea => {
      const j = myRatings[idea], p = pRatings[idea];
      return { idea, mine: j, theirs: p, diff: Math.abs(j - p), min: Math.min(j, p), max: Math.max(j, p) };
    });
    const shared = ideaComparisons.filter(ic => ic.mine >= 5 && ic.theirs >= 5).sort((a, b) => b.min - a.min);
    const conflicts = ideaComparisons.filter(ic => (ic.mine >= 5 && ic.theirs <= 3) || (ic.theirs >= 5 && ic.mine <= 3)).sort((a, b) => b.diff - a.diff);
    const sumMin = ideaComparisons.reduce((s, ic) => s + ic.min, 0);
    const sumMax = ideaComparisons.reduce((s, ic) => s + ic.max, 0);
    const alignment = sumMax > 0 ? Math.round((sumMin / sumMax) * 100) : 0;
    const bestJoint = [...ideaComparisons].sort((a, b) => b.min - a.min).slice(0, 3);
    return { ...cf, rating: effectiveRating, cfTier, shared, conflicts, alignment, bestJoint, ideaComparisons };
  });
}

// Ideas where the co-founder is already decided
const LOCKED_IDEAS = {
  "Safe Start": { person: "Elisa", note: "Elisa is founding this idea. She is the only co-founder match." },
};

function IdeaAnalysisView({ myName, cfTiers, cfRatings, ideaRatings, allRatings, ideaColumns, cofounders, ideas, ideaBounds }) {
  const [filterMyRating, setFilterMyRating] = useState("5");

  const myRatings = {};
  ideaColumns.forEach((idea, i) => {
    const ideaId = IDEA_ID_BY_NAME[idea] || nameToId(idea);
    myRatings[idea] = ideaRatings[ideaId] ?? (allRatings[myName]?.[i] ?? 4);
  });

  const tierBg = (t) => t === 1 ? "bg-emerald-100 text-emerald-800" : t === 2 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  const ratingBg = (r) => r >= 6 ? "bg-emerald-100 text-emerald-800" : r >= 4 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";

  const t1IdeaMin = ideaBounds?.tier1Min ?? 6;

  const ideaData = ideaColumns.map((idea, ideaIdx) => {
    const myRating = myRatings[idea];
    const locked = LOCKED_IDEAS[idea];

    let matches;
    if (locked) {
      const cf = cofounders.find(c => c.name === locked.person);
      if (cf) {
        const theirRating = allRatings[cf.name]?.[ideaIdx] ?? 0;
        const cfRating = cfRatings[cf.id] ?? cf.rating;
        let cfTier = 3;
        if (cfTiers.tier1.includes(cf.id)) cfTier = 1;
        else if (cfTiers.tier2.includes(cf.id)) cfTier = 2;
        matches = [{ ...cf, cfRating, theirRating, cfTier }];
      } else {
        matches = [];
      }
    } else {
      matches = cofounders.map(cf => {
        const theirRating = allRatings[cf.name]?.[ideaIdx] ?? 0;
        const cfRating = cfRatings[cf.id] ?? cf.rating;
        let cfTier = 3;
        if (cfTiers.tier1.includes(cf.id)) cfTier = 1;
        else if (cfTiers.tier2.includes(cf.id)) cfTier = 2;
        return { ...cf, cfRating, theirRating, cfTier };
      })
      .filter(m => m.theirRating >= 4 && m.cfTier <= 2)
      .sort((a, b) => b.cfRating - a.cfRating || b.theirRating - a.theirRating);
    }

    const perfectMatches = locked ? [] : matches.filter(m => m.cfTier === 1 && m.theirRating >= t1IdeaMin);

    return { idea, myRating, matches, locked, perfectMatches };
  })
  .filter(d => d.myRating >= parseInt(filterMyRating))
  .sort((a, b) => b.myRating - a.myRating);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <label className="text-sm text-slate-600">Show ideas I rated:</label>
        <select value={filterMyRating} onChange={e => setFilterMyRating(e.target.value)} className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white">
          <option value="1">1+ (all)</option>
          <option value="4">4+ (moderate interest)</option>
          <option value="5">5+ (high interest)</option>
          <option value="6">6+ (top picks)</option>
        </select>
      </div>

      <div className="space-y-4">
        {ideaData.map(({ idea, myRating, matches, locked, perfectMatches }) => (
          <div key={idea} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-white border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800 text-lg">{idea}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${ratingBg(myRating)}`}>Your rating: {myRating}/7</span>
              </div>
              {!locked && (
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-sm font-semibold text-slate-600">{matches.length} potential co-founder match{matches.length !== 1 ? "es" : ""}</span>
                  {perfectMatches.length > 0 && (
                    <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                      {perfectMatches.length} perfect match{perfectMatches.length !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="px-4 py-3">
              {locked && (
                <p className="text-xs text-slate-500 italic mb-2">{locked.note}</p>
              )}
              {matches.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No T1/T2 co-founders rate this 4+ or above</p>
              ) : (
                <div className="space-y-1.5">
                  {matches.map(m => {
                    const isPerfect = perfectMatches.some(p => p.id === m.id);
                    return (
                      <div key={m.id} className={`flex items-center gap-2 text-sm ${isPerfect ? "bg-emerald-50 -mx-2 px-2 py-1 rounded-md" : ""}`}>
                        <span className="font-medium text-slate-700 w-28">{m.name}</span>
                        <span className={`text-xs font-bold w-6 h-6 rounded flex items-center justify-center ${tierBg(m.cfTier)}`}>{m.cfRating}</span>
                        <span className="text-xs text-slate-400">your cofounder rating</span>
                        {isPerfect && <span className="text-xs font-bold text-emerald-600 ml-1">★</span>}
                        <div className="flex-1" />
                        <span className="text-xs text-slate-400">their idea rating</span>
                        <span className={`text-xs font-bold w-6 h-6 rounded flex items-center justify-center ${ratingBg(m.theirRating)}`}>{m.theirRating}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {ideaData.length === 0 && (
          <p className="text-sm text-slate-400 italic text-center py-8">No ideas match your filter. Try lowering the minimum rating.</p>
        )}
      </div>
    </div>
  );
}

function AnalysisView({ myName, cfTiers, cfRatings, ideaRatings, allRatings, ideaColumns, cofounders, ideas, ideaBounds }) {
  const [viewMode, setViewMode] = useState("cofounders");
  const [sortBy, setSortBy] = useState("tier");
  const [filterTier, setFilterTier] = useState("all");
  const analysisData = computeAnalysis(myName, cfTiers, cfRatings, ideaRatings, allRatings, ideaColumns, cofounders);
  let filtered = filterTier === "all" ? analysisData : analysisData.filter(a => a.cfTier === parseInt(filterTier));
  if (sortBy === "tier") filtered.sort((a, b) => a.cfTier - b.cfTier || b.rating - a.rating);
  else if (sortBy === "alignment") filtered.sort((a, b) => b.alignment - a.alignment);
  else if (sortBy === "conflicts") filtered.sort((a, b) => b.conflicts.length - a.conflicts.length || a.alignment - b.alignment);
  else if (sortBy === "rating") filtered.sort((a, b) => b.rating - a.rating);

  const tierTag = (t) => { const cfg = TIER_META[`tier${t}`]; return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.tagBg}`}>{cfg.tag}</span>; };

  const topIdeas = ideas.map(i => ({ ...i, r: ideaRatings[i.id] ?? i.rating })).filter(i => i.r >= 6).sort((a, b) => b.r - a.r);

  return (
    <div>
      {/* View mode toggle */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => setViewMode("cofounders")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${viewMode === "cofounders" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          Matches by co-founder
        </button>
        <button onClick={() => setViewMode("ideas")}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${viewMode === "ideas" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          Matches by idea
        </button>
      </div>

      {viewMode === "ideas" ? (
        <IdeaAnalysisView myName={myName} cfTiers={cfTiers} cfRatings={cfRatings} ideaRatings={ideaRatings}
          allRatings={allRatings} ideaColumns={ideaColumns} cofounders={cofounders} ideas={ideas} ideaBounds={ideaBounds} />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <label className="text-sm text-slate-600">Sort:</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white">
              <option value="tier">Co-founder Tier</option><option value="alignment">Alignment %</option>
              <option value="conflicts">Conflict Count</option><option value="rating">Co-founder Rating</option>
            </select>
            <label className="text-sm text-slate-600 ml-2">Filter:</label>
            <select value={filterTier} onChange={e => setFilterTier(e.target.value)} className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white">
              <option value="all">All Tiers</option><option value="1">T1 only</option><option value="2">T2 only</option><option value="3">T3 only</option>
            </select>
          </div>
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Your top ideas:</strong> {topIdeas.length > 0 ? topIdeas.map(i => `${i.name} (${i.r})`).join(", ") : "None rated 6+"}
          </div>
          <div className="space-y-3">
            {filtered.map(person => {
              const alignColor = person.alignment >= 65 ? "text-emerald-700 bg-emerald-50" : person.alignment >= 45 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
              const conflictSeverity = person.cfTier <= 2 && person.conflicts.length >= 3 ? "border-red-300 bg-red-50/30" : person.cfTier === 1 && person.conflicts.length >= 2 ? "border-orange-300 bg-orange-50/30" : "border-slate-200";
              return (
                <div key={person.id} className={`border rounded-lg overflow-hidden ${conflictSeverity}`}>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-100">
                    <span className="font-semibold text-slate-800">{person.name}</span>
                    {tierTag(person.cfTier)}
                    <span className="text-xs text-slate-500">{person.rating}/7</span>
                    <span className="ml-auto"><span className={`text-xs font-bold px-2 py-1 rounded-md ${alignColor}`}>{person.alignment}% aligned</span></span>
                  </div>
                  <div className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Best joint ideas</p>
                      {person.bestJoint.map(bj => (
                        <div key={bj.idea} className="flex items-center gap-1.5 py-0.5">
                          <span className={`w-2 h-2 rounded-full ${bj.min >= 5 ? "bg-emerald-500" : bj.min >= 3 ? "bg-amber-400" : "bg-red-400"}`} />
                          <span className="text-slate-700">{bj.idea}</span>
                          <span className="text-xs text-slate-400 ml-auto">You: {bj.mine} / Them: {bj.theirs}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      {person.shared.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Shared high ({person.shared.length})</p>
                          {person.shared.map(s => <span key={s.idea} className="inline-block text-xs bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5 mr-1 mb-1">{s.idea} ({s.mine}/{s.theirs})</span>)}
                        </div>
                      )}
                      {person.conflicts.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Conflicts ({person.conflicts.length})</p>
                          {person.conflicts.map(c => <span key={c.idea} className="inline-block text-xs bg-red-100 text-red-800 rounded-full px-2 py-0.5 mr-1 mb-1">{c.idea} ({c.mine} vs {c.theirs})</span>)}
                        </div>
                      )}
                      {person.shared.length === 0 && person.conflicts.length === 0 && <p className="text-xs text-slate-400 italic">No strong overlaps or conflicts</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function IdeaMatrix({ myName, cfTiers, ideaRatings, allRatings, ideaColumns, cofounders }) {
  const myRats = {};
  ideaColumns.forEach((idea, i) => {
    const ideaId = IDEA_ID_BY_NAME[idea] || nameToId(idea);
    myRats[idea] = ideaRatings[ideaId] ?? (allRatings[myName]?.[i] ?? 4);
  });

  const sorted = [...cofounders].sort((a, b) => {
    const tA = cfTiers.tier1.includes(a.id) ? 1 : cfTiers.tier2.includes(a.id) ? 2 : 3;
    const tB = cfTiers.tier1.includes(b.id) ? 1 : cfTiers.tier2.includes(b.id) ? 2 : 3;
    return tA - tB || b.rating - a.rating;
  });

  const cellColor = (mine, theirs) => {
    const min = Math.min(mine, theirs);
    if (mine >= 6 && theirs >= 6) return "bg-emerald-400 text-white font-bold";
    if (mine >= 5 && theirs >= 5) return "bg-emerald-200 text-emerald-900";
    if (mine >= 4 && theirs >= 4) return "bg-emerald-50 text-emerald-800";
    return "bg-white text-slate-400";
  };

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 bg-slate-100 px-2 py-1.5 text-left text-slate-600 z-10">Person</th>
            {ideaColumns.map(idea => (
              <th key={idea} className="px-1.5 py-1.5 text-center text-slate-600 bg-slate-50 whitespace-nowrap" style={{ writingMode: "vertical-lr", maxWidth: "32px" }}>{idea}</th>
            ))}
          </tr>
          <tr>
            <td className="sticky left-0 bg-amber-50 px-2 py-1 font-bold text-amber-800 z-10">You</td>
            {ideaColumns.map(idea => <td key={idea} className="text-center px-1.5 py-1 bg-amber-50 font-bold text-amber-800">{myRats[idea]}</td>)}
          </tr>
        </thead>
        <tbody>
          {sorted.map(cf => {
            const pRatings = allRatings[cf.name] || [];
            const tier = cfTiers.tier1.includes(cf.id) ? 1 : cfTiers.tier2.includes(cf.id) ? 2 : 3;
            const cfg = TIER_META[`tier${tier}`];
            return (
              <tr key={cf.id} className="border-t border-slate-100">
                <td className="sticky left-0 bg-white px-2 py-1 whitespace-nowrap z-10">
                  <span className="font-medium text-slate-800">{cf.name}</span>
                  <span className={`ml-1 text-[10px] px-1 rounded ${cfg.tagBg}`}>{cfg.tag}</span>
                </td>
                {ideaColumns.map((idea, idx) => (
                  <td key={idea} className={`text-center px-1.5 py-1 ${cellColor(myRats[idea], pRatings[idx] ?? 0)}`}>{pRatings[idx] ?? 0}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400" /> Both 6+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200" /> Both 5+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Both 4+</span>
      </div>
    </div>
  );
}

export default function App() {
  const [myName, setMyName] = useState(null);
  const [tab, setTab] = useState("cofounders");
  const [loading, setLoading] = useState(true);
  const [sheetStatus, setSheetStatus] = useState("");
  const [allRatings, setAllRatings] = useState({});
  const [ideaColumns, setIdeaColumns] = useState(IDEA_NAMES);
  const [cfTiers, setCfTiers] = useState(null);
  const [ideaTiers, setIdeaTiers] = useState(null);
  const [cfRatings, setCfRatings] = useState({});
  const [ideaRatings, setIdeaRatings] = useState({});
  const [cfBounds, setCfBounds] = useState(DEFAULT_TIER_BOUNDS);
  const [ideaBounds, setIdeaBounds] = useState(DEFAULT_TIER_BOUNDS);
  const [cofounders, setCofounders] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const saveTimeout = useRef(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => { const saved = loadIdentity(); if (saved) setMyName(saved); }, []);

  useEffect(() => {
    if (!myName) { setLoading(false); return; }
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const local = loadLocal(myName);
        let sheet;
        try {
          sheet = await fetchSheetData();
        } catch (e) {
          console.error("Sheet fetch error:", e);
          sheet = { ideaColumns: IDEA_NAMES, ratings: {}, fromSheet: false };
        }
        const ratings = sheet.ratings || {};
        setAllRatings(ratings);
        setIdeaColumns(sheet.ideaColumns || IDEA_NAMES);
        setSheetStatus(sheet.fromSheet ? "Live from sheet" : "Using local data");
        const savedCfBounds = local?.cfBounds || DEFAULT_TIER_BOUNDS;
        const savedIdeaBounds = local?.ideaBounds || DEFAULT_TIER_BOUNDS;
        setCfBounds(savedCfBounds);
        setIdeaBounds(savedIdeaBounds);
        // Build co-founders: use sheet names if available, fall back to ALL_PEOPLE
        const sheetNames = Object.keys(ratings);
        const peopleList = sheetNames.length > 1 ? sheetNames : ALL_PEOPLE;
        const others = peopleList.filter(n => n !== myName);
        const cfs = others.map(name => ({ id: nameToId(name), name, rating: local?.cfRatings?.[nameToId(name)] ?? 4 }));
        setCofounders(cfs);
        const mySheetRatings = ratings[myName] || [];
        const cols = sheet.ideaColumns || IDEA_NAMES;
        const ideaList = cols.map((name, i) => {
          const id = IDEA_ID_BY_NAME[name] || nameToId(name);
          return { id, name, rating: local?.ideaRatings?.[id] ?? mySheetRatings[i] ?? 4 };
        });
        setIdeas(ideaList);
        setCfRatings(local?.cfRatings || {});
        setIdeaRatings(local?.ideaRatings || {});
        if (local?.cfTiers) {
          const allIds = new Set(cfs.map(c => c.id));
          const inTiers = new Set([...(local.cfTiers.tier1||[]), ...(local.cfTiers.tier2||[]), ...(local.cfTiers.tier3||[])]);
          const missing = cfs.filter(c => !inTiers.has(c.id));
          if (missing.length > 0) local.cfTiers.tier2 = [...(local.cfTiers.tier2||[]), ...missing.map(c => c.id)];
          for (const key of ["tier1", "tier2", "tier3"]) {
            local.cfTiers[key] = (local.cfTiers[key] || []).filter(id => allIds.has(id));
          }
          setCfTiers(local.cfTiers);
        } else { setCfTiers(initTiersFromRatings(cfs, savedCfBounds)); }
        if (local?.ideaTiers) { setIdeaTiers(local.ideaTiers); }
        else { setIdeaTiers(initTiersFromRatings(ideaList, savedIdeaBounds)); }
        setLoading(false);
      } catch (e) {
        console.error("Loading error:", e);
        setError(e.message || "Unknown error during loading");
        setLoading(false);
      }
    })();
  }, [myName]);

  // When tier bounds or ratings change, redistribute items to correct tiers
  useEffect(() => {
    if (loading || !cfTiers || cofounders.length === 0) return;
    setCfTiers(prev => {
      const allIds = [...(prev.tier1 || []), ...(prev.tier2 || []), ...(prev.tier3 || [])];
      const next = { tier1: [], tier2: [], tier3: [] };
      allIds.forEach(id => {
        const rating = cfRatings[id] ?? cofounders.find(c => c.id === id)?.rating ?? 4;
        next[tierForRating(rating, cfBounds)].push(id);
      });
      const cfMap = Object.fromEntries(cofounders.map(c => [c.id, c]));
      for (const key of Object.keys(next)) {
        next[key] = sortTierByRatings(next[key], cfRatings, cfMap);
      }
      return next;
    });
  }, [cfBounds, cfRatings]);

  useEffect(() => {
    if (loading || !ideaTiers || ideas.length === 0) return;
    setIdeaTiers(prev => {
      const allIds = [...(prev.tier1 || []), ...(prev.tier2 || []), ...(prev.tier3 || [])];
      const next = { tier1: [], tier2: [], tier3: [] };
      allIds.forEach(id => {
        const rating = ideaRatings[id] ?? ideas.find(i => i.id === id)?.rating ?? 4;
        next[tierForRating(rating, ideaBounds)].push(id);
      });
      const ideaMap = Object.fromEntries(ideas.map(i => [i.id, i]));
      for (const key of Object.keys(next)) {
        next[key] = sortTierByRatings(next[key], ideaRatings, ideaMap);
      }
      return next;
    });
  }, [ideaBounds, ideaRatings]);

  useEffect(() => {
    if (loading || !myName || !cfTiers || !ideaTiers) return;
    setSaveStatus("saving");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveLocal(myName, { cfTiers, ideaTiers, cfRatings, ideaRatings, cfBounds, ideaBounds });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    }, 500);
  }, [cfTiers, ideaTiers, cfRatings, ideaRatings, cfBounds, ideaBounds, loading, myName]);

  const refreshFromSheet = async () => {
    setSheetStatus("Refreshing...");
    const sheet = await fetchSheetData();
    if (sheet.fromSheet) { setAllRatings(sheet.ratings); setIdeaColumns(sheet.ideaColumns); setSheetStatus("Updated from sheet"); }
    else { setSheetStatus("Sheet fetch failed"); }
    setTimeout(() => setSheetStatus(""), 3000);
  };

  const handleSelectIdentity = (name) => { saveIdentity(name); setMyName(name); };
  const handleChangeIdentity = () => { setMyName(null); setCfTiers(null); setIdeaTiers(null); setCfRatings({}); setIdeaRatings({}); };

  if (!myName) return <IdentitySelector onSelect={handleSelectIdentity} />;
  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><div className="text-slate-500">Loading...</div></div>;
  if (error) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="bg-white rounded-lg shadow-lg border border-red-200 p-6 max-w-md mx-4">
        <h2 className="text-lg font-bold text-red-700 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button onClick={() => { setError(null); setMyName(null); }} className="text-sm bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700">
          Start over
        </button>
      </div>
    </div>
  );
  if (!cfTiers || !ideaTiers) return <div className="flex items-center justify-center h-screen bg-slate-50"><div className="text-slate-500">Initializing...</div></div>;

  const cfMap = Object.fromEntries(cofounders.map(c => [c.id, c]));
  const ideaMap = Object.fromEntries(ideas.map(i => [i.id, i]));

  const tabs = [
    { id: "cofounders", label: "Co-founders", icon: "\u{1F465}" },
    { id: "ideas", label: "Ideas", icon: "\u{1F4A1}" },
    { id: "analysis", label: "Analysis", icon: "\u{1F50D}" },
    { id: "matrix", label: "Matrix", icon: "\u{1F4CA}" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-800">CE Matching</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500">Logged in as <strong>{myName}</strong></p>
                <button onClick={handleChangeIdentity} className="text-xs text-blue-500 hover:text-blue-700 underline">switch</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={refreshFromSheet} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md transition-colors">Refresh from sheet</button>
              <div className="text-xs text-slate-400">
                {sheetStatus && <span className="mr-2">{sheetStatus}</span>}
                {saveStatus === "saving" && "Saving..."}
                {saveStatus === "saved" && "\u2713 Saved"}
              </div>
            </div>
          </div>
          <div className="flex gap-1 mt-3 -mb-px overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-sm rounded-t-md transition-colors whitespace-nowrap ${tab === t.id ? "bg-slate-50 border border-slate-200 border-b-slate-50 font-semibold text-slate-800 -mb-px" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
                <span className="mr-1">{t.icon}</span><span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-5">
        {tab === "cofounders" && <TierBoard tiers={cfTiers} setTiers={setCfTiers} itemMap={cfMap} label="Rank your co-founder preferences" ratings={cfRatings} onRatingChange={(id, v) => setCfRatings(prev => ({...prev, [id]: v}))} bounds={cfBounds} setBounds={setCfBounds} />}
        {tab === "ideas" && (
          <>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              Your idea ratings are initialised from the shared Google Sheet and update when you hit "Refresh from sheet". Any manual changes you make here are saved locally and will override the sheet values.
            </div>
            <TierBoard tiers={ideaTiers} setTiers={setIdeaTiers} itemMap={ideaMap} label="Rank your idea preferences" ratings={ideaRatings} onRatingChange={(id, v) => setIdeaRatings(prev => ({...prev, [id]: v}))} bounds={ideaBounds} setBounds={setIdeaBounds} />
          </>
        )}
        {tab === "analysis" && <AnalysisView myName={myName} cfTiers={cfTiers} cfRatings={cfRatings} ideaRatings={ideaRatings} allRatings={allRatings} ideaColumns={ideaColumns} cofounders={cofounders} ideas={ideas} ideaBounds={ideaBounds} />}
        {tab === "matrix" && (
          <div>
            <h2 className="text-lg font-semibold text-slate-700 mb-3">Full Idea Rating Matrix</h2>
            <p className="text-sm text-slate-500 mb-4">Everyone's ratings vs yours. Cells colored by alignment.</p>
            <IdeaMatrix myName={myName} cfTiers={cfTiers} ideaRatings={ideaRatings} allRatings={allRatings} ideaColumns={ideaColumns} cofounders={cofounders} />
          </div>
        )}
      </div>
    </div>
  );
}
