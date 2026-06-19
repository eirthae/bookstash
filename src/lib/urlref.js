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

// An AO3 *series* link (archiveofourown.org/series/<id>) → { source:'ao3',
// seriesId }. Used by the add-by-link flow to queue the whole series instead of
// trying to import the series page as a single work. AO3-gated, so Scribble
// Hub's /series/ work URLs never false-match.
export function parseSeriesRef(url) {
  const u = (url || '').toLowerCase();
  const m = u.includes('archiveofourown.org') && u.match(/\/series\/(\d+)/);
  return m ? { source: 'ao3', seriesId: m[1] } : null;
}
