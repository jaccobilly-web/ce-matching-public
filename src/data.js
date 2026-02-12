// =============================================
// CONFIGURATION
// =============================================
export const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRCOJW4YY9aEODWW64_Yrspq8kBsClgkXyqPrnDfzITR_I8hmEYdrBQ3IFoUTV1_IyZNWLRWo0cG0lZ/pub?output=csv";

// =============================================
// IDEA DEFINITIONS
// =============================================
export const IDEA_NAMES = [
  "Air Pollution",
  "Alt Protein Scale-up",
  "Brick Kilns",
  "Cage Free",
  "Diff Learning",
  "Keel Bone",
  "Mass Comms",
  "Salt Advocacy",
  "Supermarket 60:40",
  "WASH",
  "Safe Start",
];

export const IDEA_IDS = IDEA_NAMES.map(n =>
  n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")
);

export const IDEA_BY_ID = Object.fromEntries(IDEA_IDS.map((id, i) => [id, IDEA_NAMES[i]]));
export const IDEA_ID_BY_NAME = Object.fromEntries(IDEA_NAMES.map((n, i) => [n, IDEA_IDS[i]]));

// =============================================
// ALL PARTICIPANTS
// =============================================
export const ALL_PEOPLE = [
  "Alisha", "Andy", "Anju", "Carlos", "Conor", "Dexter", "Elisa",
  "Emelie", "Grant", "Jacco", "Jamila", "Joseph", "Kate", "Lodewijk",
  "Paul", "Romain", "Samuel", "Steph", "Veevek",
];

// =============================================
// FALLBACK DATA (used when sheet fetch fails)
// =============================================
export const FALLBACK_RATINGS = {
  Alisha: [7,5,5,5,4,3,3,4,4,3,3],
  Andy: [5,5,5,1,2,1,2,2,2,5,5],
  Anju: [4,2,3,3,1,2,1,5,4,6,7],
  Carlos: [3,7,1,4,2,5,2,2,7,2,2],
  Conor: [5,7,1,6,2,7,4,2,7,2,1],
  Dexter: [7,7,5,1,7,1,1,2,7,4,5],
  Elisa: [1,1,1,1,1,1,1,1,1,1,7],
  Emelie: [7,5,3,3,7,3,5,3,3,4,4],
  Grant: [7,1,2,1,7,1,2,2,1,2,7],
  Jacco: [7,3,2,1,7,6,6,2,3,4,4],
  Jamila: [1,1,1,4,7,1,4,7,1,1,4],
  Joseph: [3,2,3,6,5,6,5,5,3,5,3],
  Kate: [7,5,6,1,5,1,4,2,5,4,3],
  Lodewijk: [5,5,1,7,1,5,1,6,3,3,3],
  Paul: [6,4,2,6,5,7,5,1,5,3,3],
  Romain: [5,5,3,1,2,1,4,3,7,3,2],
  Samuel: [2,7,2,6,2,7,2,2,5,2,2],
  Steph: [7,3,5,1,4,1,2,2,5,5,7],
  Veevek: [3,7,3,5,4,6,4,1,7,3,3],
};

// =============================================
// CSV PARSING
// =============================================
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseSheetCSV(csvText) {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) return null;

  const headers = parseCSVLine(lines[0]);
  const rawColumns = headers.slice(1).map(h => h.trim());

  // Build a mapping from sheet column index to our canonical IDEA_NAMES index
  // This handles the sheet columns being in any order or having slight name variations
  const normalise = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const canonicalNormed = IDEA_NAMES.map(n => normalise(n));

  const colMapping = rawColumns.map(raw => {
    const normed = normalise(raw);
    const idx = canonicalNormed.indexOf(normed);
    return idx; // -1 if not found
  });

  // Use canonical IDEA_NAMES order for all output
  const ratings = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    let name = cols[0]?.trim();
    if (!name) continue;
    // Normalize names: strip parenthetical suffixes like "(own org)"
    name = name.replace(/\s*\(.*?\)\s*$/, "").trim();
    const rawValues = cols.slice(1).map(v => {
      const n = parseInt(v, 10);
      return isNaN(n) ? 0 : n;
    });
    // Reorder values to match canonical IDEA_NAMES order
    const reordered = IDEA_NAMES.map((_, canonIdx) => {
      const sheetCol = colMapping.indexOf(canonIdx);
      return sheetCol >= 0 ? (rawValues[sheetCol] ?? 0) : 0;
    });
    ratings[name] = reordered;
  }

  return { ideaColumns: IDEA_NAMES, ratings };
}

export async function fetchSheetData() {
  try {
    // Cache-bust to avoid stale Google Sheets responses
    const url = SHEET_CSV_URL + "&_t=" + Date.now();
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const parsed = parseSheetCSV(text);
    if (!parsed || Object.keys(parsed.ratings).length === 0) {
      throw new Error("Empty or unparseable sheet");
    }
    return { ...parsed, fromSheet: true };
  } catch (err) {
    console.warn("Sheet fetch failed, using fallback data:", err);
    return { ideaColumns: IDEA_NAMES, ratings: FALLBACK_RATINGS, fromSheet: false };
  }
}

// =============================================
// LOCAL STORAGE (keyed per user)
// =============================================
function storageKey(userName) {
  return `ce-matching-${userName.toLowerCase()}`;
}

export function loadLocal(userName) {
  try {
    const raw = localStorage.getItem(storageKey(userName));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("localStorage load failed:", e);
  }
  return null;
}

export function saveLocal(userName, data) {
  try {
    localStorage.setItem(storageKey(userName), JSON.stringify(data));
  } catch (e) {
    console.warn("localStorage save failed:", e);
  }
}

// Store selected identity separately
export function loadIdentity() {
  try {
    return localStorage.getItem("ce-matching-identity");
  } catch { return null; }
}

export function saveIdentity(name) {
  try {
    localStorage.setItem("ce-matching-identity", name);
  } catch {}
}

// =============================================
// HELPERS
// =============================================
export function nameToId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
}

export function initTiers(items) {
  return {
    tier1: items.filter(i => i.rating >= 6).map(i => i.id),
    tier2: items.filter(i => i.rating >= 4 && i.rating < 6).map(i => i.id),
    tier3: items.filter(i => i.rating < 4).map(i => i.id),
  };
}
