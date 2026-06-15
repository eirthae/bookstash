// BookStash has no backend: library, fetching, discovery and sync all run
// on-device. This flag stays false so the FicStash-ported screens take the
// on-device path (no "connected backend" / demo mode). Do NOT flip it.
export const hasSupabase = false;
