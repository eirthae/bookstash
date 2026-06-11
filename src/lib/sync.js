// On-device sync entry point. FicStash's triggerSync kicks a server worker;
// BookStash will run the sync ON THE DEVICE (re-check followed works for new
// chapters, run tracked-tag searches) — wired up in the engine phase. For now
// this is a no-op placeholder so the Library's Sync button + pull-to-refresh
// have something to call without erroring.
export async function triggerSync() {
  // TODO(engine): run the on-device sync engine (followed-work update checks +
  // tag-tracking discovery) and return a real result.
  return { ok: true, pending: true };
}
