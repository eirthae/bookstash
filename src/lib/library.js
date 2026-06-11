import { getAllWorks, deleteWork } from './db.js';
import { getReadingPos } from './reading.js';

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
    url: row.url || '',
    progress,
    lastChapter: pos ? pos.chapter : 1,
    offline: true,                 // on-device works are always fully downloaded
    bookmarked: false,             // no AO3-bookmark concept on-device
    subscribed: !!row.follow,      // "Following" badge for ongoing works
    unread: !pos,
    palette: row.palette ?? null,
    updated: row.updated || '',
  };
}

export async function fetchWorks() {
  const rows = await getAllWorks();
  return (rows || []).map(mapWork);
}

export async function removeWork(id) {
  return deleteWork(id);
}
