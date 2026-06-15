// BookStash on-device database (IndexedDB).
//
// This is the "backend" — it lives in the WebView on the device. No native
// plugin, no server, no network. Two stores: `works` (one record per book,
// metadata + a `chapters` count) and `chapters` (one record per chapter, keyed
// by [workId, n], holding the chapter HTML). Large text is fine in IndexedDB.
//
// The async IndexedDB calls are verified in the running app; the pure helpers
// (sortWorks, newId) are unit-tested.

const DB_NAME = 'bookstash';
const DB_VERSION = 2;

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('works')) {
        db.createObjectStore('works', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chapters')) {
        const ch = db.createObjectStore('chapters', { keyPath: ['workId', 'n'] });
        ch.createIndex('byWork', 'workId', { unique: false });
      }
      // v2 — the on-device sync engine:
      //  chapter_updates: new chapters found on followed works (What's New feed)
      //  groups:          tracked tag groups (Discover)
      //  matches:         works matching a tracked tag (What's New "New matches")
      if (!db.objectStoreNames.contains('chapter_updates')) {
        const cu = db.createObjectStore('chapter_updates', { keyPath: 'id' });
        cu.createIndex('byWork', 'workId', { unique: false });
      }
      if (!db.objectStoreNames.contains('groups')) {
        db.createObjectStore('groups', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('matches')) {
        const m = db.createObjectStore('matches', { keyPath: 'id' });
        m.createIndex('byGroup', 'groupId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(db, stores, mode) {
  return db.transaction(stores, mode);
}
function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function txDone(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('transaction aborted'));
  });
}

// ---- pure helpers (unit-tested) -------------------------------------------
export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'w-' + Math.abs(Date.now() + Math.floor(performance && performance.now ? performance.now() : 0)).toString(36);
}

// Sort works without mutating. `addedAt` is an ISO string (sortable as text).
export function sortWorks(list, mode = 'added') {
  const arr = [...(list || [])];
  if (mode === 'title') arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (mode === 'author') arr.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
  else arr.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')); // newest first
  return arr;
}

// Auto-group books that share a series (from EPUB calibre:series / collection
// metadata), ordered by series index; everything else is "loose". Series
// sections sort alphabetically; loose keeps the incoming order. Pure + tested.
export function groupBySeries(list) {
  const byKey = new Map();
  const loose = [];
  for (const w of list || []) {
    const key = (w.series || '').trim();
    if (!key) { loose.push(w); continue; }
    let g = byKey.get(key.toLowerCase());
    if (!g) { g = { name: w.series, items: [] }; byKey.set(key.toLowerCase(), g); }
    g.items.push(w);
  }
  const seriesGroups = [...byKey.values()];
  for (const g of seriesGroups) {
    g.items.sort((a, b) => (a.seriesIndex ?? 1e9) - (b.seriesIndex ?? 1e9) || (a.title || '').localeCompare(b.title || ''));
  }
  seriesGroups.sort((a, b) => a.name.localeCompare(b.name));
  return { seriesGroups, loose };
}

// ---- data access -----------------------------------------------------------
// Insert a parsed book: a work record + its chapters, in one transaction.
// `meta` is the parsed metadata; `chapters` is [{ n, title, content, words }].
export async function addWork(meta, chapters, addedAt) {
  const db = await openDB();
  const id = newId();
  const total = (chapters || []).reduce((s, c) => s + (c.words || 0), 0);
  const work = {
    id,
    title: meta.title || 'Untitled',
    author: meta.author || '',
    summary: meta.summary || '',
    language: meta.language || '',
    fandom: meta.fandom || '',                          // for the Fics-shelf cards/grouping
    pairing: meta.pairing || (Array.isArray(meta.tags) ? (meta.tags.find((t) => t.k === 'relationship') || {}).t : '') || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],    // [{ t, k }] relationship/character/freeform
    series: meta.series || '',
    seriesIndex: meta.seriesIndex ?? null,
    ao3SeriesId: meta.ao3SeriesId || '',
    origin: meta.origin || '',                          // 'tag' = saved from Discovery; '' otherwise (link/upload)
    source: meta.source || 'upload',
    sourceId: meta.sourceId || '',                      // work id at the source (for refresh/follow/dedupe)
    url: meta.url || '',                                // canonical link (open original)
    words: meta.words || total,
    chapters: (chapters || []).length,
    chaptersTotal: meta.chaptersTotal ?? ((chapters || []).length || null),
    status: meta.status || 'complete',
    // Ongoing works are followed by default so a sync re-checks them for new
    // chapters — same rule as FicStash.
    follow: (meta.status && meta.status !== 'complete') || false,
    addedAt: addedAt || new Date().toISOString(),
    sourceUpdated: meta.updated || null,
  };
  const t = tx(db, ['works', 'chapters'], 'readwrite');
  t.objectStore('works').put(work);
  const chStore = t.objectStore('chapters');
  for (const c of chapters || []) {
    chStore.put({ workId: id, n: c.n, title: c.title || `Chapter ${c.n}`, words: c.words || 0, content: c.content || '' });
  }
  await txDone(t);
  return work;
}

export async function getAllWorks() {
  const db = await openDB();
  return reqToPromise(tx(db, ['works'], 'readonly').objectStore('works').getAll());
}

export async function getWork(id) {
  const db = await openDB();
  return reqToPromise(tx(db, ['works'], 'readonly').objectStore('works').get(id));
}

export async function getChapters(workId) {
  const db = await openDB();
  const idx = tx(db, ['chapters'], 'readonly').objectStore('chapters').index('byWork');
  const rows = await reqToPromise(idx.getAll(IDBKeyRange.only(workId)));
  return (rows || []).sort((a, b) => a.n - b.n);
}

// Merge `patch` into a work record (used by the Detail edit sheet).
export async function updateWork(id, patch) {
  const db = await openDB();
  const t = tx(db, ['works'], 'readwrite');
  const store = t.objectStore('works');
  const cur = await reqToPromise(store.get(id));
  if (cur) store.put({ ...cur, ...patch });
  await txDone(t);
}

export async function deleteWork(id) {
  const db = await openDB();
  const t = tx(db, ['works', 'chapters'], 'readwrite');
  t.objectStore('works').delete(id);
  const idx = t.objectStore('chapters').index('byWork');
  const keysReq = idx.getAllKeys(IDBKeyRange.only(id));
  keysReq.onsuccess = () => { (keysReq.result || []).forEach((k) => t.objectStore('chapters').delete(k)); };
  await txDone(t);
}

export async function stats() {
  const works = await getAllWorks();
  return { count: works.length, words: works.reduce((s, w) => s + (w.words || 0), 0) };
}

// ---- sync engine: chapter updates -----------------------------------------
// Append newly-fetched chapters to a work (absolute chapter numbers).
export async function appendChapters(workId, chapters) {
  const db = await openDB();
  const t = tx(db, ['chapters'], 'readwrite');
  const store = t.objectStore('chapters');
  for (const c of chapters || []) {
    store.put({ workId, n: c.n, title: c.title || `Chapter ${c.n}`, words: c.words || 0, content: c.content || '' });
  }
  await txDone(t);
}

// Record new chapters in the What's New "New chapters" feed (idempotent on id).
export async function recordChapterUpdate(work, chapters) {
  const db = await openDB();
  const t = tx(db, ['chapter_updates'], 'readwrite');
  const store = t.objectStore('chapter_updates');
  const now = new Date().toISOString();
  for (const c of chapters || []) {
    store.put({
      id: `${work.id}:${c.n}`, workId: work.id, n: c.n,
      chapter: c.title || `Chapter ${c.n}`, title: work.title || 'Untitled', author: work.author || '',
      fandom: work.fandom || '', words: c.words || 0, at: now, seen: false,
    });
  }
  await txDone(t);
}

export async function getChapterUpdates() {
  const db = await openDB();
  const rows = await reqToPromise(tx(db, ['chapter_updates'], 'readonly').objectStore('chapter_updates').getAll());
  return (rows || []).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export async function markChapterUpdateSeen(id) {
  const db = await openDB();
  const t = tx(db, ['chapter_updates'], 'readwrite');
  const store = t.objectStore('chapter_updates');
  const cur = await reqToPromise(store.get(id));
  if (cur) store.put({ ...cur, seen: true });
  await txDone(t);
}

// ---- sync engine: tracked groups + matches --------------------------------
export async function putGroup(group) {
  const db = await openDB();
  const t = tx(db, ['groups'], 'readwrite');
  t.objectStore('groups').put(group);
  await txDone(t);
  return group;
}
export async function getGroups() {
  const db = await openDB();
  const rows = await reqToPromise(tx(db, ['groups'], 'readonly').objectStore('groups').getAll());
  return (rows || []).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}
export async function patchGroup(id, patch) {
  const db = await openDB();
  const t = tx(db, ['groups'], 'readwrite');
  const store = t.objectStore('groups');
  const cur = await reqToPromise(store.get(id));
  if (cur) store.put({ ...cur, ...patch });
  await txDone(t);
}
export async function removeGroup(id) {
  const db = await openDB();
  const t = tx(db, ['groups', 'matches'], 'readwrite');
  t.objectStore('groups').delete(id);
  const idx = t.objectStore('matches').index('byGroup');
  const keysReq = idx.getAllKeys(IDBKeyRange.only(id));
  keysReq.onsuccess = () => { (keysReq.result || []).forEach((k) => t.objectStore('matches').delete(k)); };
  await txDone(t);
}

// Insert matches for a group, skipping ones already seen (dedup on id). Returns
// how many were newly added.
export async function upsertMatches(groupId, metas) {
  const db = await openDB();
  const t = tx(db, ['matches'], 'readwrite');
  const store = t.objectStore('matches');
  const now = new Date().toISOString();
  let added = 0;
  for (const m of metas || []) {
    const id = `${groupId}:${m.source}:${m.sourceId}`;
    const existing = await reqToPromise(store.get(id)); // eslint-disable-line no-await-in-loop
    if (existing) continue;
    store.put({
      id, groupId, source: m.source, sourceId: m.sourceId, matchId: id,
      title: m.title, author: m.author, summary: m.summary || '', fandom: m.fandom || '',
      tags: Array.isArray(m.tags) ? m.tags : [], status: m.status || 'ongoing',
      words: m.words || 0, tag: m.tag || '', url: m.url || '',
      at: now, seen: false, dismissed: false, saved: false, later: false,
    });
    added += 1;
  }
  await txDone(t);
  return added;
}
export async function getMatches() {
  const db = await openDB();
  return reqToPromise(tx(db, ['matches'], 'readonly').objectStore('matches').getAll());
}
export async function patchMatch(id, patch) {
  const db = await openDB();
  const t = tx(db, ['matches'], 'readwrite');
  const store = t.objectStore('matches');
  const cur = await reqToPromise(store.get(id));
  if (cur) store.put({ ...cur, ...patch });
  await txDone(t);
}
