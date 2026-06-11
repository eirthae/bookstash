// Per-book reading position — how far down EACH chapter you scrolled, in
// localStorage. We keep a position per chapter (not one per book) so leaving a
// chapter near the end, reading ahead, then coming back returns you to where you
// were — not the top. `last` is the chapter to resume on reopen. Local + offline.
//
// Shape: { [workId]: { chapters: { [n]: pct }, last: n, at: iso } }
// (Older builds stored { chapter, pct } — entry() migrates that on the fly.)
const POS_KEY = 'bs-readpos';

function readAll() {
  try { return JSON.parse(localStorage.getItem(POS_KEY) || '{}'); } catch { return {}; }
}
function entry(m, workId) {
  const e = m[workId];
  if (e && e.chapters) return e;
  if (e && e.chapter) return { chapters: { [e.chapter]: e.pct || 0 }, last: e.chapter, at: e.at }; // migrate legacy
  return { chapters: {}, last: null, at: null };
}

// Where to resume the book as a whole (latest chapter touched + its scroll).
export function getReadingPos(workId) {
  if (!workId) return null;
  const e = entry(readAll(), workId);
  if (!e.last) return null;
  return { chapter: e.last, pct: e.chapters[e.last] || 0 };
}

// Saved scroll fraction for a SPECIFIC chapter (0 if never visited).
export function getChapterPos(workId, chapter) {
  if (!workId || !chapter) return 0;
  return entry(readAll(), workId).chapters[chapter] || 0;
}

export function saveReadingPos(workId, { chapter, pct }) {
  if (!workId || !chapter) return;
  try {
    const m = readAll();
    const e = entry(m, workId);
    e.chapters[chapter] = Math.max(0, Math.min(1, pct || 0));
    e.last = chapter;
    e.at = new Date().toISOString();
    m[workId] = e;
    localStorage.setItem(POS_KEY, JSON.stringify(m));
  } catch { /* storage unavailable — non-fatal */ }
}
