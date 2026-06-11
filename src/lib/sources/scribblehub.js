import { fetchHtml } from '../fetch.js';

// On-device Scribble Hub source. Like Royal Road: fetch the series page (metadata
// + the chapter TOC), then fetch each chapter page for its body. Polite spacing.

export const SH_HOST = 'scribblehub.com';
const BASE = 'https://www.scribblehub.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const wc = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

export function isShUrl(url) { return /(^|[/.@])scribblehub\.com/i.test(String(url || '')); }
export function workIdFromUrl(url) { const m = String(url || '').match(/\/series\/(\d+)/); return m ? m[1] : ''; }
export function workUrl(id) { return `${BASE}/series/${id}/`; }

// Pure parser: a series page → metadata + chapter refs (title + url, no body).
export function parseSeries(html, id = '') {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const title = clean(text(doc, '.fic_title') || text(doc, 'div.fic_title') || text(doc, 'h1'));
  if (!title) throw new Error('Not a Scribble Hub series page');
  const author = clean(text(doc, '.auth_name_fic') || text(doc, 'span.auth_name_fic')) || 'Unknown author';
  const summary = clean(text(doc, '.wi_fic_desc') || text(doc, 'div.wi_fic_desc'));
  const tags = [
    ...[...doc.querySelectorAll('.wi_fic_genre a, a.fic_genre')].map((a) => ({ t: clean(a.textContent), k: 'freeform' })),
    ...[...doc.querySelectorAll('.wi_fic_tags a, a.stag')].map((a) => ({ t: clean(a.textContent), k: 'freeform' })),
  ].filter((x) => x.t);
  // Status: best-effort (SH doesn't expose it consistently); default ongoing.
  const statusText = clean(text(doc, '.widget_fic_similar .mb_stat') || text(doc, '.rnd_stats')).toLowerCase();
  const status = /completed/.test(statusText) ? 'complete' : 'ongoing';
  const refs = [];
  doc.querySelectorAll('.toc_ol li a.toc_a, ol.toc_ol li a, .toc_w a[href*="/chapter/"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!/\/chapter\//.test(href)) return;
    refs.push({ title: clean(a.textContent) || `Chapter ${refs.length + 1}`, url: href });
  });
  // SH lists newest-first in some views — keep document order but renumber 1..N
  // assuming oldest-first (the default series TOC order).
  refs.forEach((r, i) => { r.n = i + 1; });
  return {
    source: 'scribblehub', sourceId: String(id || ''), title, author, summary, fandom: '',
    tags, language: 'English', status,
    chapters: refs.length, chaptersTotal: status === 'complete' ? refs.length : null,
    url: workUrl(id), _refs: refs,
  };
}

export function parseChapter(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const body = doc.querySelector('#chp_raw') || doc.querySelector('.chp_raw') || doc.querySelector('div.chapter-content');
  if (!body) return { html: '', words: 0 };
  const node = body.cloneNode(true);
  node.querySelectorAll('script, style, .wi_authornotes').forEach((e) => e.remove());
  return { html: (node.innerHTML || '').trim(), words: wc(node.textContent) };
}

const absUrl = (u) => (u && u.startsWith('http') ? u : `${BASE}${u || ''}`);

export async function fetchWork(id, { onProgress, max } = {}) {
  const wid = String(id || '').match(/\d+/)?.[0] || workIdFromUrl(id);
  if (!wid) throw new Error('No Scribble Hub series id');
  const r = await fetchHtml(workUrl(wid));
  if (!r.html || r.status >= 400) throw new Error(`Scribble Hub HTTP ${r.status || '?'}`);
  const meta = parseSeries(r.html, wid);
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

export async function fetchUpdates(id, stored = 0) {
  const wid = String(id || '').match(/\d+/)?.[0] || workIdFromUrl(id);
  const r = await fetchHtml(workUrl(wid));
  if (!r.html || r.status >= 400) throw new Error(`Scribble Hub HTTP ${r.status || '?'}`);
  const meta = parseSeries(r.html, wid);
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

function text(root, sel) { const el = root.querySelector(sel); return el ? el.textContent : ''; }
