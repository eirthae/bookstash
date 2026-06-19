// Which tags to show on a discovery card. Two rules:
//   1. Don't repeat the tags you're already browsing — if you're in the
//      "Soulmates AU" group, every card has "Soulmates AU", so showing it is
//      noise. We drop the group's own tags and surface OTHER ones instead.
//   2. Float content-warning / "need to know" tags to the front, so a Dead Dove
//      or Major Character Death is visible at a glance rather than buried.
//
// Pure + dependency-free so it unit-tests in node and runs identically in the app.

// Substrings (lowercased) that mark a tag as high-priority to surface.
export const PRIORITY_TAG_PATTERNS = [
  'dead dove',
  'no comfort',          // "Hurt/No Comfort", "Hurt No Comfort"
  'character death',     // "Major Character Death", "Minor Character Death"
  'major character death',
  'non-con', 'noncon', 'rape',
  'underage',
  'abuse',
  'suicide', 'self-harm',
  'unhappy ending', 'no happy ending', 'tragedy',
];

const nameOf = (t) => (typeof t === 'string' ? t : (t && (t.t || t.name)) || '');

export function isPriorityTag(tag) {
  const n = nameOf(tag).toLowerCase();
  return !!n && PRIORITY_TAG_PATTERNS.some((p) => n.includes(p));
}

// workTags: the work's tags ([{t,k}] or strings). excludeNames: tag names to omit
// (the group's own tags). Returns up to `limit` tags, warnings first, de-duped.
export function pickCardTags(workTags, excludeNames = [], limit = 3) {
  const ex = new Set((excludeNames || []).map((n) => nameOf(n).trim().toLowerCase()).filter(Boolean));
  const seen = new Set();
  const kept = [];
  for (const t of workTags || []) {
    const key = nameOf(t).trim().toLowerCase();
    if (!key || ex.has(key) || seen.has(key)) continue;
    seen.add(key);
    kept.push(t);
  }
  // Stable partition: priority tags keep their relative order, then the rest.
  const ordered = [...kept.filter(isPriorityTag), ...kept.filter((t) => !isPriorityTag(t))];
  return ordered.slice(0, limit);
}
