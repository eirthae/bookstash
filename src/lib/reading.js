// Per-book reading position — which chapter you were on and how far down it you
// scrolled, in localStorage. On reopening a book the reader jumps back to ≈ the
// paragraph you left off on (else the chapter). Local + offline; no round-trip.
const POS_KEY = 'bs-readpos';

export function getReadingPos(workId) {
  if (!workId) return null;
  try { const m = JSON.parse(localStorage.getItem(POS_KEY) || '{}'); return m[workId] || null; }
  catch { return null; }
}

export function saveReadingPos(workId, { chapter, pct }) {
  if (!workId || !chapter) return;
  try {
    const m = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
    m[workId] = { chapter, pct: Math.max(0, Math.min(1, pct || 0)), at: new Date().toISOString() };
    localStorage.setItem(POS_KEY, JSON.stringify(m));
  } catch { /* storage unavailable — non-fatal */ }
}
