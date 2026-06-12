import { fetchHtml } from '../fetch.js';

// On-device Royal Road source. Unlike AO3 there's no "whole work" URL, so an
// import is: fetch the fiction page (metadata + the chapter table), then fetch
// each chapter page for its body. Polite: one request per chapter, spaced.

export const RR_HOST = 'royalroad.com';
const BASE = 'https://www.royalroad.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const wc = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

export function isRrUrl(url) { return /(^|[/.@])royalroad\.com/i.test(String(url || '')); }
export function workIdFromUrl(url) { const m = String(url || '').match(/\/fiction\/(\d+)/); return m ? m[1] : ''; }
export function workUrl(id) { return `${BASE}/fiction/${id}`; }

// Pure parser: a fiction page → metadata + chapter refs (id/title/url, no body).
export function parseFiction(html, id = '') {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const title = clean(text(doc, '.fic-title h1') || text(doc, 'h1[property="name"]') || text(doc, 'h1'));
  if (!title) throw new Error('Not a Royal Road fiction page');
  const author = clean(text(doc, '.fic-title h4 a') || text(doc, 'h4 a[href*="/profile/"]') || text(doc, 'a[property="author"]')) || 'Unknown author';
  const summary = clean(text(doc, '.description .hidden-content') || text(doc, '.description [property="description"]') || text(doc, '.description'));
  const tags = [...doc.querySelectorAll('.tags a.label, .tags a.fiction-tag, span.tags a')]
    .map((a) => ({ t: clean(a.textContent), k: 'freeform' })).filter((x) => x.t);
  const labels = [...doc.querySelectorAll('.fiction-info .label, .label')].map((e) => clean(e.textContent).toLowerCase());
  const status = labels.some((l) => /complete/.test(l)) ? 'complete' : 'ongoing';
  const refs = [];
  doc.querySelectorAll('#chapters tbody tr, table#chapters tbody tr').forEach((tr, i) => {
    const a = tr.querySelector('a[href*="/chapter/"]');
    if (!a) return;
    refs.push({ n: i + 1, title: clean(a.textContent) || `Chapter ${i + 1}`, url: a.getAttribute('href') });
  });
  return {
    source: 'royalroad', sourceId: String(id || ''), title, author, summary, fandom: '',
    tags, language: 'English', status,
    chapters: refs.length, chaptersTotal: status === 'complete' ? refs.length : null,
    url: workUrl(id), _refs: refs,
  };
}

// A chapter page → { html, words }. Strips RR's anti-theft + author-note cruft.
export function parseChapter(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const body = doc.querySelector('.chapter-content') || doc.querySelector('div.chapter-inner') || doc.querySelector('#chapter-content');
  if (!body) return { html: '', words: 0 };
  const node = body.cloneNode(true);
  node.querySelectorAll('.portlet, .author-note-portlet, script, style').forEach((e) => e.remove());
  return { html: (node.innerHTML || '').trim(), words: wc(node.textContent) };
}

const absUrl = (u) => (u && u.startsWith('http') ? u : `${BASE}${u || ''}`);

// Full import: fiction page + every chapter body.
export async function fetchWork(id, { onProgress, max } = {}) {
  const wid = String(id || '').match(/\d+/)?.[0] || workIdFromUrl(id);
  if (!wid) throw new Error('No Royal Road fiction id');
  const r = await fetchHtml(workUrl(wid));
  if (!r.html || r.status >= 400) throw new Error(`Royal Road HTTP ${r.status || '?'}`);
  const meta = parseFiction(r.html, wid);
  const refs = meta._refs;
  const limit = max ? Math.min(refs.length, max) : refs.length;
  const chaptersData = [];
  for (let i = 0; i < limit; i++) {
    if (i) await sleep(1200);
    if (onProgress) onProgress({ done: i + 1, total: limit });
    try {
      const cr = await fetchHtml(absUrl(refs[i].url));
      const c = parseChapter(cr.html);
      chaptersData.push({ n: i + 1, title: refs[i].title, content: c.html, words: c.words });
    } catch (e) {
      chaptersData.push({ n: i + 1, title: refs[i].title, content: '', words: 0 });
    }
  }
  delete meta._refs;
  return { ...meta, words: chaptersData.reduce((s, c) => s + c.words, 0), chaptersData };
}

// Follow-update: re-read the fiction page; fetch only chapters beyond `stored`.
export async function fetchUpdates(id, stored = 0) {
  const wid = String(id || '').match(/\d+/)?.[0] || workIdFromUrl(id);
  const r = await fetchHtml(workUrl(wid));
  if (!r.html || r.status >= 400) throw new Error(`Royal Road HTTP ${r.status || '?'}`);
  const meta = parseFiction(r.html, wid);
  const refs = meta._refs;
  const newChapters = [];
  for (let i = stored; i < refs.length; i++) {
    if (i > stored) await sleep(1200);
    try {
      const cr = await fetchHtml(absUrl(refs[i].url));
      const c = parseChapter(cr.html);
      newChapters.push({ n: i + 1, title: refs[i].title, content: c.html, words: c.words });
    } catch (e) { /* skip one chapter */ }
  }
  return { newChapters, total: refs.length, status: meta.status };
}

// ---- tag/genre discovery ---------------------------------------------------
// Pure parser: a Royal Road search/listing page → fiction blurbs.
export function parseSearchResults(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const out = [];
  const seen = new Set();
  for (const item of doc.querySelectorAll('.fiction-list-item, div.search-container .fiction-list-item')) {
    const a = item.querySelector('.fiction-title a') || item.querySelector('h2 a[href*="/fiction/"]') || item.querySelector('a[href*="/fiction/"]');
    if (!a) continue;
    const id = (a.getAttribute('href').match(/\/fiction\/(\d+)/) || [])[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const tags = [...item.querySelectorAll('a.fiction-tag, a.label[href*="tagsAdd"], span.tags a')].map((e) => ({ t: clean(e.textContent), k: 'freeform' })).filter((x) => x.t);
    // RR's description block has used a couple of class shapes over time.
    const summary = clean(text(item, 'div.fiction-description') || text(item, 'div.margin-top-10.col-xs-12') || text(item, 'div.description'));
    out.push({
      source: 'royalroad', sourceId: id, title: clean(a.textContent) || 'Untitled',
      author: clean(text(item, '.author span') || text(item, '.author a') || text(item, 'span.author')),
      summary,
      fandom: '', tags, status: 'ongoing', words: 0, language: 'English', url: workUrl(id),
    });
  }
  return out;
}

// Search Royal Road by tags (AND via tagsAdd, exclude via tagsRemove).
export async function searchTags(include, exclude = []) {
  const inc = (include || []).map((t) => String(t).trim()).filter(Boolean);
  if (!inc.length) return [];
  const p = new URLSearchParams();
  inc.forEach((t) => p.append('tagsAdd', t));
  (exclude || []).forEach((t) => p.append('tagsRemove', t));
  p.set('globalFilters', 'true');
  p.set('orderBy', 'last_update');
  try {
    const r = await fetchHtml(`${BASE}/fictions/search?${p.toString()}`);
    if (!r || r.status !== 200) return [];
    return parseSearchResults(r.html);
  } catch (e) {
    return [];
  }
}

function text(root, sel) { const el = root.querySelector(sel); return el ? el.textContent : ''; }
