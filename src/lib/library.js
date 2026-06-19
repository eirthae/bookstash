import { getAllWorks, deleteWork, getChapters, updateWork } from './db.js';
import { getReadingPos } from './reading.js';
import { seriesWorksFrom, savedWorksFrom } from './shelving.js';

// Map an on-device work record (db.js shape) to the exact shape FicStash's UI
// expects, so BookStash can reuse FicStash's screens/cards/grouping verbatim.
// The generic `series`/`seriesIndex` fields route to the Books (seriesName) or
// AO3 (ao3SeriesName) slots depending on the work's source.
export function mapWork(row) {
  const isUpload = (row.source || 'upload') === 'upload';
  const isAo3 = row.source === 'ao3';
  const pos = getReadingPos(row.id); // { chapter, pct } | null
  const chaptersTotal = row.chaptersTotal ?? row.chapters ?? 1;
  // Approximate a 0..1 progress from the saved chapter + scroll, so cards show a
  // real progress bar (FicStash gets this from synced reading state).
  const progress = pos && chaptersTotal
    ? Math.min(1, ((pos.chapter - 1) + (pos.pct || 0)) / chaptersTotal)
    : 0;
  return {
    id: row.id,
    source: row.source || 'upload',
    origin: isUpload ? 'upload' : (row.origin || 'link'),
    createdAt: row.addedAt || row.createdAt || '',
    sourceUpdated: row.sourceUpdated || row.addedAt || '',
    title: row.title || 'Untitled',
    customTitle: row.customTitle || '',
    author: row.author || '',
    fandom: row.fandom || '',
    pairing: row.pairing || '',
    summary: row.summary || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    language: row.language || '',
    workSkin: row.workSkin || '', // AO3 work-skin CSS (chat/social), sanitized at render
    seriesName: isUpload ? (row.series || row.seriesName || '') : '',
    seriesIndex: isUpload ? (row.seriesIndex ?? null) : null,
    ao3SeriesName: isAo3 ? (row.series || '') : '',
    ao3SeriesId: row.ao3SeriesId || '',
    ao3SeriesIndex: isAo3 ? (row.seriesIndex ?? null) : null,
    words: row.words || 0,
    chapters: row.chapters || 0,
    chaptersTotal,
    status: row.status || 'complete',
    follow: !!row.follow,
    sourceId: row.sourceId || '',
    sourceWorkId: row.sourceId || '',   // FicStash field name (for workUrl)
    sourceUrl: row.url || '',           // canonical link (open at source)
    externalUrl: row.externalUrl || '', // user-set link (Books)
    url: row.url || '',
    progress,
    lastChapter: pos ? pos.chapter : 1,
    offline: true,                 // on-device works are always fully downloaded
    restricted: false,             // restricted AO3 works are never stored
    frozen: false,
    frozenDate: null,
    bookmarked: false,             // no AO3-bookmark concept on-device
    subscribed: !!row.follow,      // "Following" badge for ongoing works
    unread: !pos,
    palette: row.palette ?? null,
    updated: row.updated || '',
  };
}

// Chapters for a work, in the shape the reader/Detail expect (all on-device →
// state 'done').
export async function fetchChapters(workId) {
  const rows = await getChapters(workId);
  return (rows || []).map((c) => ({ n: c.n, title: c.title || `Chapter ${c.n}`, words: c.words || 0, content: c.content || '', state: 'done' }));
}

// Edit-sheet save: snake_case fields (matching FicStash) → on-device record.
export async function updateWorkFields(workId, fields) {
  const map = { custom_title: 'customTitle', series_name: 'series', series_index: 'seriesIndex', external_url: 'externalUrl' };
  const patch = {};
  for (const [k, v] of Object.entries(fields || {})) if (k in map) patch[map[k]] = v;
  if (Object.keys(patch).length) await updateWork(workId, patch);
}

// Offline-library stats for Settings. Every on-device work is fully downloaded,
// so downloaded === total.
export async function fetchOfflineStats() {
  const rows = await getAllWorks();
  const total = (rows || []).length;
  return { total, downloaded: total, words: (rows || []).reduce((s, r) => s + (r.words || 0), 0) };
}

// Existing series names (for the edit-sheet autocomplete).
export async function fetchSeriesNames() {
  const rows = await getAllWorks();
  return [...new Set((rows || []).map((r) => (r.series || '').trim()).filter(Boolean))].sort();
}

export async function fetchWorks() {
  const rows = await getAllWorks();
  return (rows || []).map(mapWork);
}

// All downloaded works in an AO3 series, in reading order (part #). Powers the
// Series screen and the reader's prev/next-in-series navigation.
export async function fetchSeriesWorks(ao3SeriesId) {
  if (!ao3SeriesId) return [];
  const rows = await getAllWorks();
  return seriesWorksFrom((rows || []).map(mapWork), ao3SeriesId);
}

// Day bucket for the What's New feeds (Today / Yesterday / This week + "Xh ago").
function dayBucketLocal(iso) {
  if (!iso) return { day: 'This week', time: '' };
  const then = new Date(iso); const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday - new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000);
  const day = diffDays <= 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : 'This week';
  const secs = Math.max((now - then) / 1000, 0);
  const time = secs < 3600 ? `${Math.max(1, Math.floor(secs / 60))}m ago` : secs < 86400 ? `${Math.floor(secs / 3600)}h ago` : `${Math.floor(secs / 86400)}d ago`;
  return { day, time };
}

// The What's New "recently added" feed: works you added in the last 5 days —
// saved from Discovery (origin 'tag'), added by link, or uploaded — newest
// first. The window keeps the feed recent and declutters on its own; everything
// stays in the library regardless of age.
const SAVED_RETENTION_DAYS = 5;
export async function fetchSavedWorks() {
  const rows = await getAllWorks();
  return savedWorksFrom((rows || []).map(mapWork), { days: SAVED_RETENTION_DAYS, now: Date.now() })
    .map((w) => { const { day, time } = dayBucketLocal(w.createdAt); return { ...w, day, time, fresh: true }; });
}

export async function removeWork(id) {
  return deleteWork(id);
}
