import { kickSync } from './sync.js';

const KEY = 'bs-followed-series';
function readAll() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function writeAll(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* non-fatal */ } }

// The followed/queued record for a series id, or null.
export async function getSeriesFollow(seriesId) {
  if (!seriesId) return null;
  const r = readAll()[String(seriesId)];
  return r ? { seriesId: String(seriesId), seriesName: r.name || '', follow: !!r.follow } : null;
}

// "Download every work in this series" — also follows it (follow=true) so newly
// added works keep arriving, matching saved-work auto-follow. The engine fetches
// on the next on-device sync.
export async function requestSeriesDownload(seriesId, seriesName = '') {
  if (!seriesId) return { ok: false, error: 'No series id' };
  const m = readAll();
  const cur = m[String(seriesId)] || {};
  m[String(seriesId)] = { name: seriesName || cur.name || '', follow: true, at: new Date().toISOString() };
  writeAll(m);
  kickSync();
  return { ok: true, follow: true };
}

// Every queued/followed series — for the sync engine. follow=false rows are
// one-shot "download all" requests; follow=true rows keep being re-checked.
export function getAllFollowedSeries() {
  const m = readAll();
  return Object.entries(m).map(([seriesId, r]) => ({ seriesId, name: r.name || '', follow: !!r.follow }));
}
// Drop a series from the queue (after a one-shot download completes).
export function removeFollowedSeries(seriesId) {
  const m = readAll();
  if (m[String(seriesId)]) { delete m[String(seriesId)]; writeAll(m); }
}

// Toggle "follow this series" (keep watching for newly-added works).
export async function setSeriesFollow(seriesId, seriesName, follow) {
  if (!seriesId) return { ok: false, error: 'No series id' };
  const m = readAll();
  if (follow) { m[String(seriesId)] = { name: seriesName || '', follow: true, at: new Date().toISOString() }; writeAll(m); kickSync(); }
  else { delete m[String(seriesId)]; writeAll(m); }
  return { ok: true, follow: !!follow };
}
