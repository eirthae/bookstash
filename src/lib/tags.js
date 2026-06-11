// Saving a Discover *suggestion* into the library. On-device this becomes a real
// fetch + store via the sync engine (engine phase); for now it's a no-op so the
// ported Detail's suggestion path resolves. Library works are already saved.
export async function requestSave() { return { ok: true }; }
