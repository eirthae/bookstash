// Pure discovery/library filter for BookStash.
//
// Design principle (the de-personalization rule): BookStash ships *taste-blind*.
// There are NO baked-in defaults — no preferred language, no length floor, no
// content assumptions. An empty `prefs` object lets every work through. The
// user's own include/exclude choices are the only thing that ever filters.
//
// `prefs` shape (every field optional; empty/absent = no constraint):
//   languages:     [{native, english, code}]  → keep only these languages
//   excludedTags:  [{name}]                    → drop works carrying any of these
//   minWords / maxWords: number                → length window
//   status: 'complete' | 'ongoing'             → completion filter
//
// `work` shape (only the fields used here):
//   language: string (native name, e.g. "English", "日本語")
//   tags: [{t} | {name} | string]
//   words: number
//   status: 'complete' | 'ongoing' | ...
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

export function passesFilters(work = {}, prefs = {}) {
  // --- language include (empty = all languages) ---
  const langs = (prefs.languages || [])
    .flatMap((l) => [l && l.native, l && l.english, l && l.code, typeof l === 'string' ? l : null])
    .map(norm).filter(Boolean);
  if (langs.length) {
    const wl = norm(work.language);
    // Never drop on missing/unknown language data — only on a positive mismatch.
    if (wl && wl !== 'unknown' && !langs.includes(wl)) return false;
  }

  // --- excluded tags (empty = exclude nothing). On AO3 ratings are tags, so
  //     excluding "Explicit" works through this same path. ---
  const excluded = (prefs.excludedTags || [])
    .map((t) => norm(t && (t.name != null ? t.name : t))).filter(Boolean);
  if (excluded.length) {
    const tags = (work.tags || []).map((t) => norm(t && (t.t != null ? t.t : t.name != null ? t.name : t)));
    if (tags.some((t) => excluded.includes(t))) return false;
  }

  // --- length window (0/absent = no floor/ceiling; unknown length never drops) ---
  const words = Number(work.words || 0);
  if (words > 0) {
    if (prefs.minWords && words < prefs.minWords) return false;
    if (prefs.maxWords && words > prefs.maxWords) return false;
  }

  // --- completion status ---
  if (prefs.status === 'complete' && norm(work.status) !== 'complete') return false;
  if (prefs.status === 'ongoing' && norm(work.status) === 'complete') return false;

  return true;
}

// Convenience: filter a list of works by prefs (stable order preserved).
export function applyFilters(works = [], prefs = {}) {
  return works.filter((w) => passesFilters(w, prefs));
}
