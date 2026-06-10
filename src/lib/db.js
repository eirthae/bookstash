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
const DB_VERSION = 1;

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
    series: meta.series || '',
    seriesIndex: meta.seriesIndex ?? null,
    source: meta.source || 'upload',
    words: total,
    chapters: (chapters || []).length,
    status: meta.status || 'complete',
    addedAt: addedAt || new Date().toISOString(),
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
