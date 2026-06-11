// In-flight link requests. FicStash queues links for its server worker and shows
// "downloading…" rows; BookStash fetches links synchronously on-device (see
// import.js), so there's no queue — these return empty/no-op to satisfy the
// ported Library screen's imports.
export async function fetchPendingLinks() {
  return [];
}
export async function removeRequest() {
  return { ok: true };
}
