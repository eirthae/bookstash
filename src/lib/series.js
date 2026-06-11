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

// Queue a one-shot "download every work in this series" (the engine fetches it
// on the next on-device sync).
export async function requestSeriesDownload(seriesId, seriesName = '') {
  if (!seriesId) return { ok: false, error: 'No series id' };
  const m = readAll();
  const cur = m[String(seriesId)] || {};
  m[String(seriesId)] = { name: seriesName || cur.name || '', follow: !!cur.follow, at: new Date().toISOString() };
  writeAll(m);
  kickSync();
  return { ok: true };
}

// Toggle "follow this series" (keep watching for newly-added works).
export async function setSeriesFollow(seriesId, seriesName, follow) {
  if (!seriesId) return { ok: false, error: 'No series id' };
  const m = readAll();
  if (follow) { m[String(seriesId)] = { name: seriesName || '', follow: true, at: new Date().toISOString() }; writeAll(m); kickSync(); }
  else { delete m[String(seriesId)]; writeAll(m); }
  return { ok: true, follow: !!follow };
}
