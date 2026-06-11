import { getAllWorks, appendChapters, recordChapterUpdate, updateWork, getGroups, patchGroup, upsertMatches } from './db.js';
import { fetchWork, searchTags } from './sources/ao3.js';
import { fetchUpdates as rrFetchUpdates } from './sources/royalroad.js';
import { discoverBooks } from './goodreads.js';

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

  // Followed = ongoing AO3 / Royal Road works we have a source id for.
  const ongoing = (works || []).filter((w) => (w.source === 'ao3' || w.source === 'royalroad') && w.status !== 'complete' && w.sourceId);
  let newChapters = 0, checked = 0, failed = 0;

  for (const w of ongoing) {
    if (checked) await sleep(SPACE_MS); // space requests
    checked += 1;
    if (onProgress) onProgress({ done: checked, total: ongoing.length, title: w.title });
    try {
      const stored = w.chapters || 0;
      let newChs = [], total = stored, status = w.status;
      if (w.source === 'ao3') {
        const fresh = await fetchWork(w.sourceId);
        if (fresh.restricted) continue;
        total = fresh.chapters || 0; status = fresh.status;
        if (total > stored) newChs = (fresh.chaptersData || []).filter((c) => c.n > stored);
      } else { // royalroad — re-read fiction page, fetch only chapters beyond stored
        const upd = await rrFetchUpdates(w.sourceId, stored);
        total = upd.total; status = upd.status; newChs = upd.newChapters;
      }
      if (newChs.length) {
        await appendChapters(w.id, newChs);
        await recordChapterUpdate(w, newChs);
        const words = (w.words || 0) + newChs.reduce((s, c) => s + (c.words || 0), 0);
        await updateWork(w.id, {
          chapters: total, chaptersTotal: status === 'complete' ? total : (w.chaptersTotal ?? null),
          words, status, follow: status !== 'complete', sourceUpdated: new Date().toISOString(),
        });
        newChapters += newChs.length;
      } else if (status === 'complete') {
        await updateWork(w.id, { status: 'complete', follow: false, chaptersTotal: total });
      }
    } catch (e) {
      failed += 1;
    }
  }

  // ---- tracked-tag discovery: search each AO3 group, store new matches ------
  let newMatches = 0;
  let groups = [];
  try { groups = await getGroups(); } catch (e) { groups = []; }
  for (const g of groups) {
    const source = g.source || 'ao3';
    if (source !== 'ao3' && source !== 'books') continue; // RR/SH discovery needs their parsers (later)
    const include = (g.tags || []).filter((t) => t.kind !== 'language').map((t) => t.name).filter(Boolean);
    if (!include.length) continue; // language-browse groups need a different search
    const exclude = (g.excludedTags || []).map((t) => t.name).filter(Boolean);
    await sleep(SPACE_MS);
    let metas = [];
    try {
      if (source === 'books') {
        // Goodreads book discovery (notify-only): id/title/author/link.
        const books = await discoverBooks(include, exclude);
        metas = books.map((b) => ({
          source: 'books', sourceId: b.id, title: b.title, author: b.author,
          summary: '', fandom: '', tags: [], status: 'complete', words: 0, url: b.url,
        }));
      } else if (g.matchMode === 'any' && include.length > 1) {
        for (const t of include) { metas.push(...await searchTags([t], exclude)); await sleep(800); }
      } else {
        metas = await searchTags(include, exclude);
      }
    } catch (e) { /* skip this group */ }
    try {
      newMatches += await upsertMatches(g.id, metas.map((m) => ({ ...m, tag: g.label || include[0] })));
      await patchGroup(g.id, { lastChecked: new Date().toISOString() });
    } catch (e) { /* non-fatal */ }
  }

  return { ok: true, newChapters, newMatches, checked, failed };
}

// Fire-and-forget sync kick (used after queueing a download/follow).
export function kickSync() { triggerSync().catch(() => {}); }
