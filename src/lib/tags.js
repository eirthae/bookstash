import {
  newId, putGroup, getGroups, patchGroup, removeGroup,
  getMatches, patchMatch, addWork,
  getChapterUpdates, markChapterUpdateSeen as dbMarkChapterSeen,
} from './db.js';
import { hashStr, COVER_PALETTES } from '../data/sample.js';
import { searchTags as ao3Search, autocompleteTag, fetchWork } from './sources/ao3.js';
import { fetchWorks } from './library.js';
import { kickSync } from './sync.js';
import { notifySavedAvailable } from './notify.js';

// Tracked tag groups + matches — the on-device version of FicStash's tags.js.
// A "group" is one or more tags tracked together (matchMode 'all' = AND, 'any' =
// at least one). The sync engine fills `matches`; the app reads them and flips
// per-match flags (seen / saved / dismissed / later).

function paletteIndexFor(seed) { return hashStr(seed || '') % COVER_PALETTES.length; }

function mapGroup(g, counts = { total: 0, fresh: 0 }) {
  const tags = Array.isArray(g.tags) ? g.tags : [];
  const excludedTags = Array.isArray(g.excludedTags) ? g.excludedTags : [];
  const names = tags.map((t) => t.name).filter(Boolean);
  const langTag = tags.find((t) => t.kind === 'language');
  const kind = langTag ? 'language' : tags.length === 1 ? (tags[0].kind || 'freeform') : 'group';
  return {
    id: g.id, name: g.label || names.join(' + ') || 'Untitled group', label: g.label || '',
    source: g.source || 'ao3', tags, names, excludedTags,
    excludedNames: excludedTags.map((t) => t.name).filter(Boolean),
    matchMode: g.matchMode || 'all', status: g.status || 'all', kind,
    language: langTag ? (langTag.id || langTag.name) : null,
    count: counts.total, fresh: counts.fresh, palette: g.palette ?? 0,
  };
}

function mapMatch(row) {
  return {
    id: row.id, matchId: row.id, source: row.source, sourceWorkId: row.sourceId,
    title: row.title, author: row.author, fandom: row.fandom, summary: row.summary,
    tags: Array.isArray(row.tags) ? row.tags : [], words: row.words, status: row.status,
    palette: paletteIndexFor(row.fandom || row.title), seen: row.seen, fresh: !row.seen,
    saved: !!row.saved, dismissed: !!row.dismissed, later: !!row.later, url: row.url || '',
  };
}

// ---- groups ---------------------------------------------------------------
const cleanTags = (list) => (list || [])
  .map((t) => ({ name: t.name, id: t.id ?? '', kind: t.kind || 'freeform' })).filter((t) => t.name);

export async function createGroup({ label = '', tags, excludedTags = [], matchMode = 'all', source = 'ao3', status = 'all' }) {
  const clean = cleanTags(tags);
  if (!clean.length) throw new Error('A group needs at least one tag');
  const group = {
    id: newId(), label, source, tags: clean, excludedTags: cleanTags(excludedTags),
    matchMode: matchMode === 'any' ? 'any' : 'all',
    status: ['ongoing', 'complete'].includes(status) ? status : 'all',
    palette: paletteIndexFor(label || clean.map((t) => t.name).join(' + ')),
    createdAt: new Date().toISOString(), lastChecked: null,
  };
  await putGroup(group);
  kickSync(); // start fetching matches on-device
  return mapGroup(group);
}

export async function createLanguageGroup({ code, name, label = '' }) {
  if (!code) throw new Error('A language needs a code');
  const group = {
    id: newId(), label: label || name || code, source: 'ao3',
    tags: [{ name: name || code, id: code, kind: 'language' }], excludedTags: [],
    matchMode: 'all', palette: paletteIndexFor(code), createdAt: new Date().toISOString(), lastChecked: null,
  };
  await putGroup(group);
  kickSync();
  return mapGroup(group);
}

export async function fetchTrackedGroups() {
  const [groups, matches] = await Promise.all([getGroups(), getMatches()]);
  const counts = {};
  for (const m of matches || []) {
    if (m.dismissed || m.saved || m.later) continue;
    const c = counts[m.groupId] || (counts[m.groupId] = { total: 0, fresh: 0 });
    c.total += 1; if (!m.seen) c.fresh += 1;
  }
  return (groups || []).map((g) => mapGroup(g, counts[g.id]));
}

export async function addTagToGroup(groupId, tag) {
  const t = { name: tag.name, id: tag.id ?? '', kind: tag.kind || 'freeform' };
  if (!t.name) throw new Error('Tag needs a name');
  const groups = await getGroups();
  const g = groups.find((x) => x.id === groupId);
  if (!g) return;
  const existing = Array.isArray(g.tags) ? g.tags : [];
  if (existing.some((x) => (x.name || '').toLowerCase() === t.name.toLowerCase())) return;
  await patchGroup(groupId, { tags: [...existing, t] });
  kickSync();
}

export async function deleteGroup(id) { return removeGroup(id); }

export async function markGroupSeen(groupId) {
  const matches = await getMatches();
  await Promise.all((matches || []).filter((m) => m.groupId === groupId && !m.seen).map((m) => patchMatch(m.id, { seen: true })));
}

// ---- matches --------------------------------------------------------------
export async function fetchMatches(groupId) {
  const matches = await getMatches();
  return (matches || [])
    .filter((m) => m.groupId === groupId && !m.dismissed && !m.saved && !m.later)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .map(mapMatch);
}
export async function dismissMatch(matchId) { return patchMatch(matchId, { dismissed: true, seen: true }); }
export async function markLater(matchId) { return patchMatch(matchId, { later: true, seen: true }); }
export async function unmarkLater(matchId) { return patchMatch(matchId, { later: false }); }
export async function markMatchSeen(matchId) { return patchMatch(matchId, { seen: true }); }

export async function fetchLaterMatches() {
  const matches = await getMatches();
  return (matches || [])
    .filter((m) => m.later && !m.dismissed && !m.saved)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .map(mapMatch);
}

// Save a match into the library = fetch + store it on-device now.
export async function requestSave(matchId) {
  const matches = await getMatches();
  const m = (matches || []).find((x) => x.id === matchId);
  if (!m) return { ok: false };
  try {
    if (m.source === 'ao3') {
      const w = await fetchWork(m.sourceId);
      if (w.restricted) { await patchMatch(m.id, { saved: true, seen: true }); return { ok: false, restricted: true }; }
      await addWork({ ...w, origin: 'tag' }, w.chaptersData); // 'tag' = saved from Discovery → What's New "Saved"
      notifySavedAvailable([{ title: w.title || m.title }]); // OS notification: it's downloaded now
    }
    await patchMatch(m.id, { saved: true, seen: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'Could not save' };
  }
}

// ---- tag autocomplete -----------------------------------------------------
export async function autocompleteTags(term) {
  const names = await autocompleteTag(term);
  return (names || []).map((n) => ({ name: n, id: '', kind: 'freeform' }));
}

// ---- What's New feeds -----------------------------------------------------
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
  return (rows || []).filter((r) => byId[r.workId]).map((r) => ({
    id: r.id, workId: r.workId, chapterN: r.n, chapter: r.chapter,
    title: r.title, author: r.author, fandom: r.fandom, words: r.words,
    fetched: true, fresh: !r.seen, time: relTime(r.at), day: dayBucket(r.at), work: byId[r.workId],
  }));
}
export { dbMarkChapterSeen as markChapterUpdateSeen };

export async function fetchNewMatches() {
  const matches = await getMatches();
  return (matches || [])
    .filter((m) => !m.dismissed && !m.saved && !m.later)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .map((m) => ({ ...mapMatch(m), tag: m.tag || 'Tracked tag', time: relTime(m.at), day: dayBucket(m.at) }));
}
