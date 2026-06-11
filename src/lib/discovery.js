// Global discovery filters (preferred languages + globally-excluded tags),
// stored on-device. The sync engine reads these to filter tag-search matches.
const KEY = 'bs-discovery-prefs';
function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
export async function fetchDiscoveryPrefs() {
  const p = read();
  return { languages: Array.isArray(p.languages) ? p.languages : [], excludedTags: Array.isArray(p.excludedTags) ? p.excludedTags : [] };
}
export async function updateDiscoveryPrefs(next) {
  try { localStorage.setItem(KEY, JSON.stringify({ languages: next.languages || [], excludedTags: next.excludedTags || [] })); } catch { /* non-fatal */ }
  return { ok: true };
}
