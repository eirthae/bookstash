// Pure URL → (source, work id) parsing for sources whose ids are stable and
// unambiguous in the URL. No imports, so it's trivially unit-testable. Used by
// the add-by-link flow (duplicate detection, source routing). Only ever matches
// on an exact id, so it never false-flags; a miss falls through to "unknown".
export function parseWorkRef(url) {
  const u = (url || '').toLowerCase();
  let m;
  // Domain-gated, then match the id by path segment anywhere (so e.g. AO3
  // collection links /collections/x/works/123 resolve too).
  if (u.includes('archiveofourown.org') && (m = u.match(/\/works\/(\d+)/)))  return { source: 'ao3', id: m[1] };
  if (u.includes('royalroad.com')       && (m = u.match(/\/fiction\/(\d+)/))) return { source: 'royalroad', id: m[1] };
  if (u.includes('scribblehub.com')     && (m = u.match(/\/series\/(\d+)/)))  return { source: 'scribblehub', id: m[1] };
  return null;
}
