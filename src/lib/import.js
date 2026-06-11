import { parseFile, isSupportedUpload } from './epub.js';
import { addWork } from './db.js';
import { fetchHtml } from './fetch.js';
import { extractArticle } from './extract.js';
import { isAo3Url, workIdFromUrl, fetchWork as fetchAo3Work } from './sources/ao3.js';
import { isRrUrl, workIdFromUrl as rrWorkId, fetchWork as fetchRrWork } from './sources/royalroad.js';
import { isShUrl, workIdFromUrl as shWorkId, fetchWork as fetchShWork } from './sources/scribblehub.js';

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

// Add a work by pasting a link: fetch the page (native HTTP, on-device),
// extract the readable article, and store it as a 1-chapter offline work.
// Returns { ok, work? } or { ok:false, error?, restricted?, url? }.
export async function importLink(url) {
  const clean = (url || '').trim();
  if (!/^https?:\/\/\S+\.\S+/i.test(clean)) return { ok: false, error: 'Enter a full link starting with http(s)://' };

  // AO3 links use the dedicated parser (clean title/author/summary/tags/series +
  // every chapter) instead of the generic single-page extractor.
  if (isAo3Url(clean) && workIdFromUrl(clean)) {
    try {
      const w = await fetchAo3Work(workIdFromUrl(clean));
      if (w.restricted) {
        return { ok: false, restricted: true, url: clean, error: 'This work is restricted to AO3 members — open it on AO3.' };
      }
      const work = await addWork(w, w.chaptersData);
      return { ok: true, work };
    } catch (e) {
      return { ok: false, error: (e && e.message) ? `Couldn’t read that AO3 work (${e.message}).` : 'Couldn’t read that AO3 work.' };
    }
  }

  // Royal Road — dedicated parser (fiction page + every chapter body).
  if (isRrUrl(clean) && rrWorkId(clean)) {
    try {
      const w = await fetchRrWork(rrWorkId(clean));
      const work = await addWork(w, w.chaptersData);
      return { ok: true, work };
    } catch (e) {
      return { ok: false, error: (e && e.message) ? `Couldn’t read that Royal Road work (${e.message}).` : 'Couldn’t read that Royal Road work.' };
    }
  }

  // Scribble Hub — dedicated parser (series page + every chapter body).
  if (isShUrl(clean) && shWorkId(clean)) {
    try {
      const w = await fetchShWork(shWorkId(clean));
      const work = await addWork(w, w.chaptersData);
      return { ok: true, work };
    } catch (e) {
      return { ok: false, error: (e && e.message) ? `Couldn’t read that Scribble Hub work (${e.message}).` : 'Couldn’t read that Scribble Hub work.' };
    }
  }

  let res;
  try {
    res = await fetchHtml(clean);
  } catch (e) {
    return { ok: false, error: 'Couldn’t reach that page — check your connection.' };
  }

  // AO3 (and similar) bounce members-only works to a login URL. We run logged
  // out, so surface a "read on AO3" result rather than a broken import.
  if (/\/users\/login\?[^ ]*restricted=true/i.test(res.url || '')) {
    return { ok: false, restricted: true, url: clean, error: 'This work is restricted to AO3 members — open it on AO3.' };
  }
  if (!res.html || res.status >= 400) {
    return { ok: false, error: `Couldn’t load that page (HTTP ${res.status || '?'}).` };
  }

  let art;
  try {
    art = extractArticle(res.html, clean);
  } catch (e) {
    return { ok: false, error: 'Couldn’t read that page.' };
  }
  if (!art.content || art.words < 5) return { ok: false, error: 'No readable text found on that page.' };

  const work = await addWork(
    { title: art.title, author: art.author || '', summary: '', source: 'link', url: clean },
    [{ n: 1, title: art.title, content: art.content, words: art.words }],
  );
  return { ok: true, work };
}

// Summarize a batch of results for a toast/notice.
export function summarize(results) {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return { added: ok, failed: failed.length, failures: failed };
}
