import { getAllWorks, appendChapters, recordChapterUpdate, updateWork } from './db.js';
import { fetchWork } from './sources/ao3.js';

// On-device sync engine. This is the job FicStash's server worker does, run on
// the phone instead: re-check every followed (ongoing) work for new chapters and
// pull them, recording each in the What's New feed. Tag-tracking discovery is
// layered on next. Native HTTP only — runs on-device, not in a web preview.
//
// Politeness (AO3 is a volunteer nonprofit): one full-work request per work,
// spaced apart. The whole-work view returns every chapter in a single fetch.
const SPACE_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function triggerSync({ onProgress } = {}) {
  let works;
  try { works = await getAllWorks(); } catch (e) { return { ok: false, error: 'Storage unavailable' }; }

  // Followed = ongoing AO3 works we have a source id for.
  const ongoing = (works || []).filter((w) => w.source === 'ao3' && w.status !== 'complete' && w.sourceId);
  let newChapters = 0, checked = 0, failed = 0;

  for (const w of ongoing) {
    if (checked) await sleep(SPACE_MS); // space requests
    checked += 1;
    if (onProgress) onProgress({ done: checked, total: ongoing.length, title: w.title });
    try {
      const fresh = await fetchWork(w.sourceId);
      if (fresh.restricted) continue;
      const stored = w.chapters || 0;
      const freshCount = fresh.chapters || 0;
      if (freshCount > stored) {
        const newChs = (fresh.chaptersData || []).filter((c) => c.n > stored);
        await appendChapters(w.id, newChs);
        await recordChapterUpdate(w, newChs);
        await updateWork(w.id, {
          chapters: freshCount, chaptersTotal: fresh.chaptersTotal,
          words: fresh.words || w.words, status: fresh.status,
          follow: fresh.status !== 'complete', sourceUpdated: new Date().toISOString(),
        });
        newChapters += newChs.length;
      } else if (fresh.status === 'complete') {
        // No new chapters and the work just completed → stop following it.
        await updateWork(w.id, { status: 'complete', follow: false, chaptersTotal: fresh.chaptersTotal });
      }
    } catch (e) {
      failed += 1;
    }
  }
  return { ok: true, newChapters, checked, failed };
}

// Fire-and-forget sync kick (used after queueing a download/follow).
export function kickSync() { triggerSync().catch(() => {}); }
