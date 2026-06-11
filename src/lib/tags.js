// What's New + suggestion-save data. On-device these are produced by the sync
// engine (followed-work chapter updates + tracked-tag matches). Until that lands
// they return empty/no-op so the ported What's New + Detail screens render.
export async function fetchNewChapters() { return []; }
export async function fetchNewMatches() { return []; }
export async function markChapterUpdateSeen() { return { ok: true }; }
export async function markMatchSeen() { return { ok: true }; }
export async function dismissMatch() { return { ok: true }; }
export async function requestSave() { return { ok: true }; }
