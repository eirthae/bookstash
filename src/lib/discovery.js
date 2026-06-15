// Global discovery filters (preferred languages + globally-excluded tags),
// stored on-device. The sync engine reads these to filter tag-search matches.
// `excludedTags` is per Discovery shelf — { ao3:[], sites:[], books:[] } — so you
// can, e.g., exclude "litrpg" from Stories without touching AO3. `languages` is
// AO3-only and stays a single list.
const KEY = 'bs-discovery-prefs';
const SHELVES = ['ao3', 'sites', 'books'];
// Coerce any stored shape into { ao3:[], sites:[], books:[] }. A legacy flat
// array is treated as the AO3 shelf (the old global filter was AO3-only).
function normExcluded(e) {
  const out = { ao3: [], sites: [], books: [] };
  if (Array.isArray(e)) { out.ao3 = e; return out; }
  if (e && typeof e === 'object') for (const s of SHELVES) if (Array.isArray(e[s])) out[s] = e[s];
  return out;
}
function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
export async function fetchDiscoveryPrefs() {
  const p = read();
  return { languages: Array.isArray(p.languages) ? p.languages : [], excludedTags: normExcluded(p.excludedTags) };
}
export async function updateDiscoveryPrefs(next) {
  try { localStorage.setItem(KEY, JSON.stringify({ languages: next.languages || [], excludedTags: normExcluded(next.excludedTags) })); } catch { /* non-fatal */ }
  return { ok: true };
}
