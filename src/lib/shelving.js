// Pure library/shelf logic — extracted from the screens so it's unit-testable
// (node --test can't import JSX). Library.jsx, WhatsNew.jsx, library.js and
// sync.js import from here; shelving.test.js covers it.

// Fandom name without the author suffix ("Heated Rivalry – Rachel Reid" → "Heated Rivalry").
export function fandomName(work) {
  return ((work && work.fandom) || 'Other').split('–')[0].split(' - ')[0].trim() || 'Other';
}

// Lowercased tag texts of a work (tags are [{ t, k }] or strings), for search + filtering.
export function workTagSet(work) {
  return (Array.isArray(work && work.tags) ? work.tags : [])
    .map((t) => (typeof t === 'string' ? t : (t && (t.t || t.name)) || '').toLowerCase())
    .filter(Boolean);
}

// Which shelf a work belongs to. Uploaded EPUB/HTML/TXT → Books (stored as
// source/origin 'upload'); AO3 → Fics; anything else → Stories.
export function shelfOf(work) {
  if (!work) return 'fics';
  if ((work.origin || '') === 'upload' || work.source === 'upload') return 'books';
  if (work.source === 'ao3') return 'fics';
  return 'stories';
}

// Sort a list without mutating it. Timestamps are ISO strings (sort as text).
// 'default' keeps the incoming order.
export function sortWorks(list, sort, lastRead = {}) {
  const arr = [...(list || [])];
  if (sort === 'added') arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  else if (sort === 'updated') arr.sort((a, b) => (b.sourceUpdated || '').localeCompare(a.sourceUpdated || ''));
  else if (sort === 'title') arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sort === 'read') arr.sort((a, b) => (lastRead[b.id] || '').localeCompare(lastRead[a.id] || ''));
  return arr;
}

// Order section groups by the active sort: A–Z by name, 'default' by size, else
// by the group's most-recent item (added / updated / read). Mutates + returns.
export function orderGroups(groups, sort, lastRead = {}) {
  if (sort === 'title') {
    groups.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'default') {
    groups.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  } else {
    const recency = (g) => g.items.reduce((m, x) => {
      const v = sort === 'read' ? (lastRead[x.id] || '') : sort === 'updated' ? (x.sourceUpdated || '') : (x.createdAt || '');
      return v > m ? v : m;
    }, '');
    groups.sort((a, b) => recency(b).localeCompare(recency(a)));
  }
  return groups;
}

// Group AO3 fics BY FANDOM, with multi-work series collapsed into one series
// entry inside their fandom. Each section = { name, series:[{seriesId, name,
// items}], loose:[works], items:[all] }. A series is filed under the fandom of
// its first work (by part); a single-work series stays a loose card.
export function groupFics(works, sort = 'default', lastRead = {}) {
  const seriesByKey = new Map();
  const looseAll = [];
  for (const w of works || []) {
    const sid = (w.ao3SeriesId || '').trim();
    const sname = (w.ao3SeriesName || '').trim();
    if (!sid || !sname) { looseAll.push(w); continue; }
    let s = seriesByKey.get(sid);
    if (!s) { s = { seriesId: sid, name: sname, items: [] }; seriesByKey.set(sid, s); }
    s.items.push(w);
  }
  const byFandom = new Map();
  const ensure = (name) => {
    let g = byFandom.get(name);
    if (!g) { g = { name, series: [], loose: [], items: [] }; byFandom.set(name, g); }
    return g;
  };
  for (const w of looseAll) { const g = ensure(fandomName(w)); g.loose.push(w); g.items.push(w); }
  for (const s of seriesByKey.values()) {
    s.items.sort((a, b) => (a.ao3SeriesIndex ?? 1e9) - (b.ao3SeriesIndex ?? 1e9) || (a.title || '').localeCompare(b.title || ''));
    if (s.items.length < 2) { const w = s.items[0]; const g = ensure(fandomName(w)); g.loose.push(w); g.items.push(w); continue; }
    const g = ensure(fandomName(s.items[0]));
    g.series.push(s); g.items.push(...s.items);
  }
  const groups = [...byFandom.values()];
  for (const g of groups) {
    g.loose = sortWorks(g.loose, sort, lastRead);
    g.series.sort((a, b) => a.name.localeCompare(b.name));
  }
  orderGroups(groups, sort, lastRead);
  return groups;
}

// Library search + advanced tag filter. query matches title/author/fandom/tags;
// include = must carry ALL; exclude = must carry NONE.
export function filterWorks(works, { query = '', include = [], exclude = [] } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const inc = (include || []).map((t) => String(t).toLowerCase());
  const exc = (exclude || []).map((t) => String(t).toLowerCase());
  if (!q && !inc.length && !exc.length) return [...(works || [])];
  return (works || []).filter((w) => {
    if (q) {
      const inText = [w.title, w.customTitle, w.author, w.fandom, w.pairing].some((s) => (s || '').toLowerCase().includes(q));
      if (!inText && !workTagSet(w).some((t) => t.includes(q))) return false;
    }
    if (inc.length || exc.length) {
      const set = workTagSet(w);
      if (inc.length && !inc.every((t) => set.includes(t))) return false;
      if (exc.length && exc.some((t) => set.includes(t))) return false;
    }
    return true;
  });
}

// What's New "Saved" type bucket for a work: AO3 / Stories (RR+SH+link) / Books.
export function savedTypeOf(w) {
  return (w.origin === 'upload' || w.source === 'upload' || w.source === 'books')
    ? 'books' : w.source === 'ao3' ? 'ao3' : 'stories';
}

// Discovery completion-status predicate. status 'all' matches everything;
// 'complete'/'ongoing' match the work's own completion.
export function statusMatches(work, status) {
  if (status !== 'ongoing' && status !== 'complete') return true;
  const isComplete = ((work && work.status) || '').toLowerCase() === 'complete';
  return isComplete === (status === 'complete');
}

// Downloaded works of an AO3 series, in reading order (operates on mapped works).
export function seriesWorksFrom(works, ao3SeriesId) {
  if (!ao3SeriesId) return [];
  return (works || [])
    .filter((w) => (w.ao3SeriesId || '') === String(ao3SeriesId))
    .sort((a, b) => (a.ao3SeriesIndex ?? 1e9) - (b.ao3SeriesIndex ?? 1e9) || (a.title || '').localeCompare(b.title || ''));
}

// Saved-from-Discovery works (origin 'tag'), newest first (operates on mapped works).
export function savedWorksFrom(works) {
  return (works || [])
    .filter((w) => (w.origin || '') === 'tag')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
