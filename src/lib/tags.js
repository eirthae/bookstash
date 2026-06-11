import { getChapterUpdates, markChapterUpdateSeen as dbMarkChapterSeen } from './db.js';
import { fetchWorks } from './library.js';

// What's New + suggestion-save data, on-device.
//
// "New chapters" is real now: the sync engine records each new chapter it pulls
// for a followed work, and this maps those into the What's New feed shape.
// "New matches" (tracked-tag discovery) is wired up with the Discover engine.

function relTime(iso) {
  if (!iso) return '';
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 3600) return `${Math.max(1, Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const d = Math.floor(secs / 86400);
  return d === 1 ? 'Yesterday' : `${d}d ago`;
}
function dayBucket(iso) {
  if (!iso) return 'This week';
  const secs = (Date.now() - new Date(iso).getTime()) / 1000;
  if (secs < 86400) return 'Today';
  if (secs < 172800) return 'Yesterday';
  return 'This week';
}

export async function fetchNewChapters() {
  const [rows, works] = await Promise.all([getChapterUpdates(), fetchWorks()]);
  const byId = Object.fromEntries((works || []).map((w) => [w.id, w]));
  return (rows || [])
    .filter((r) => byId[r.workId]) // drop updates for works since removed
    .map((r) => ({
      id: r.id, workId: r.workId, chapterN: r.n, chapter: r.chapter,
      title: r.title, author: r.author, fandom: r.fandom, words: r.words,
      fetched: true, fresh: !r.seen, time: relTime(r.at), day: dayBucket(r.at),
      work: byId[r.workId],
    }));
}
export async function markChapterUpdateSeen(id) { return dbMarkChapterSeen(id); }

// --- Tag-tracking matches (Discover engine — next) -------------------------
export async function fetchNewMatches() { return []; }
export async function markMatchSeen() { return { ok: true }; }
export async function dismissMatch() { return { ok: true }; }
export async function requestSave() { return { ok: true }; }
