import { parseFile, isSupportedUpload } from './epub.js';
import { addWork } from './db.js';

// Import one file into the on-device library. Returns a per-file result so the
// bulk caller can show "12 added, 1 skipped" with reasons.
export async function importFile(file) {
  const name = (file && file.name) || 'file';
  if (!isSupportedUpload(file)) return { ok: false, name, error: 'Unsupported — EPUB, HTML or TXT only' };
  // Empty files are usually cloud "online-only" placeholders (OneDrive/Drive)
  // that weren't actually downloaded — fail loudly instead of importing nothing.
  if (file.size === 0) return { ok: false, name, error: 'File is empty (cloud placeholder? make it available offline first)' };
  try {
    const parsed = await parseFile(file);
    const work = await addWork(parsed, parsed.chapters);
    return { ok: true, name, work };
  } catch (e) {
    return { ok: false, name, error: (e && e.message) || 'Could not read this file' };
  }
}

// Bulk import: parse + store each file in turn (sequential so a 200-file batch
// can't swamp memory), reporting progress. Returns all per-file results.
export async function importFiles(files, onProgress) {
  const list = Array.from(files || []);
  const results = [];
  for (let i = 0; i < list.length; i++) {
    if (onProgress) onProgress({ done: i, total: list.length, current: list[i] && list[i].name });
    results.push(await importFile(list[i])); // eslint-disable-line no-await-in-loop
  }
  if (onProgress) onProgress({ done: list.length, total: list.length });
  return results;
}

// Summarize a batch of results for a toast/notice.
export function summarize(results) {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return { added: ok, failed: failed.length, failures: failed };
}
