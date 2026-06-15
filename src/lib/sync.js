import { getAllWorks, appendChapters, recordChapterUpdate, updateWork, getGroups, patchGroup, upsertMatches, addWork } from './db.js';
import { fetchWork, searchTags, searchLanguage, seriesWorks } from './sources/ao3.js';
import { getAllFollowedSeries, removeFollowedSeries } from './series.js';
import { fetchDiscoveryPrefs } from './discovery.js';
import { fetchUpdates as rrFetchUpdates, searchTags as rrSearchTags } from './sources/royalroad.js';
import { fetchUpdates as shFetchUpdates, searchTags as shSearchTags } from './sources/scribblehub.js';
import { discoverBooks } from './goodreads.js';
import { statusMatches, passesGlobalPrefs } from './shelving.js';

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

  // Followed = ongoing AO3 / Royal Road / Scribble Hub works with a source id.
  const RECHECK = new Set(['ao3', 'royalroad', 'scribblehub']);
  const ongoing = (works || []).filter((w) => RECHECK.has(w.source) && w.status !== 'complete' && w.sourceId);
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
      } else { // royalroad / scribblehub — re-read index page, fetch chapters beyond stored
        const upd = await (w.source === 'royalroad' ? rrFetchUpdates : shFetchUpdates)(w.sourceId, stored);
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

  // ---- tracked-tag discovery: search each group, store new matches ----------
  // Global discovery prefs (preferred languages / excluded tags) filter matches.
  let prefs = { languages: [], excludedTags: [] };
  try { prefs = await fetchDiscoveryPrefs(); } catch (e) { /* defaults */ }
  const passesPrefs = (m, isLanguageGroup) => passesGlobalPrefs(m, prefs, isLanguageGroup);

  let newMatches = 0;
  let groups = [];
  try { groups = await getGroups(); } catch (e) { groups = []; }
  for (const g of groups) {
    const source = g.source || 'ao3';
    if (!['ao3', 'books', 'royalroad', 'scribblehub'].includes(source)) continue;
    const langGroup = (g.tags || []).find((t) => t.kind === 'language');
    const include = (g.tags || []).filter((t) => t.kind !== 'language').map((t) => t.name).filter(Boolean);
    if (!langGroup && !include.length) continue;
    const exclude = (g.excludedTags || []).map((t) => t.name).filter(Boolean);
    await sleep(SPACE_MS);
    let metas = [];
    try {
      if (source === 'books') {
        const books = await discoverBooks(include, exclude);
        metas = books.map((b) => ({
          source: 'books', sourceId: b.id, title: b.title, author: b.author,
          summary: '', fandom: '', tags: [], status: 'complete', words: 0, url: b.url,
        }));
      } else if (source === 'royalroad') {
        if (g.matchMode === 'any' && include.length > 1) {
          for (const t of include) { metas.push(...await rrSearchTags([t], exclude)); await sleep(800); }
        } else {
          metas = await rrSearchTags(include, exclude);
        }
      } else if (source === 'scribblehub') {
        metas = await shSearchTags(include); // genre RSS (first term)
      } else if (langGroup) {
        metas = await searchLanguage(langGroup.id || langGroup.name);
      } else if (g.matchMode === 'any' && include.length > 1) {
        for (const t of include) { metas.push(...await searchTags([t], exclude)); await sleep(800); }
      } else {
        metas = await searchTags(include, exclude);
      }
    } catch (e) { /* skip this group */ }
    // Completion-status filter on the group: 'ongoing' / 'complete' / 'all'.
    const gStatus = (g.status || 'all');
    if (gStatus === 'ongoing' || gStatus === 'complete') {
      metas = metas.filter((m) => statusMatches(m, gStatus));
    }
    metas = metas.filter((m) => passesPrefs(m, !!langGroup));
    try {
      newMatches += await upsertMatches(g.id, metas.map((m) => ({ ...m, tag: g.label || include[0] || (langGroup && (langGroup.name)) || 'Tracked' })));
      await patchGroup(g.id, { lastChecked: new Date().toISOString() });
    } catch (e) { /* non-fatal */ }
  }

  // ---- followed / requested AO3 series → download their works ---------------
  // "Download all" (one-shot) and "Follow series" both queue a series here; we
  // enumerate it and pull any work not already on-device, tagging each with the
  // series so the Fics shelf auto-groups it. Capped per run for politeness.
  let seriesAdded = 0;
  let followedSeries = [];
  try { followedSeries = getAllFollowedSeries(); } catch (e) { followedSeries = []; }
  if (followedSeries.length) {
    const SERIES_MAX = 12;
    for (const s of followedSeries) {
      let list = [];
      try { await sleep(SPACE_MS); list = await seriesWorks(s.seriesId); } catch (e) { continue; }
      if (!list.length) continue;
      const cur = await getAllWorks();
      const bySource = new Map(cur.filter((w) => w.source === 'ao3' && w.sourceId).map((w) => [w.sourceId, w]));
      let got = 0, hitCap = false;
      for (let i = 0; i < list.length; i += 1) {
        const wk = list[i];
        const existing = bySource.get(wk.id);
        if (existing) { // already have it — make sure it's tagged with this series
          try { await updateWork(existing.id, { series: s.name, ao3SeriesId: s.seriesId, seriesIndex: i + 1 }); } catch (e) { /* non-fatal */ }
          continue;
        }
        if (got >= SERIES_MAX) { hitCap = true; break; }
        try {
          await sleep(SPACE_MS);
          const fresh = await fetchWork(wk.id);
          if (fresh.restricted) continue;
          fresh.series = s.name || fresh.series;
          fresh.ao3SeriesId = s.seriesId;
          fresh.seriesIndex = i + 1;
          await addWork(fresh, fresh.chaptersData);
          got += 1; seriesAdded += 1;
        } catch (e) { /* skip one work */ }
      }
      // A one-shot "Download all" drops out once everything's pulled.
      if (!s.follow && !hitCap) { try { removeFollowedSeries(s.seriesId); } catch (e) { /* non-fatal */ } }
    }
  }

  return { ok: true, newChapters, newMatches, seriesAdded, checked, failed };
}

// Fire-and-forget sync kick (used after queueing a download/follow).
export function kickSync() { triggerSync().catch(() => {}); }
