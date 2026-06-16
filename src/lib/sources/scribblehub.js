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

export async function fetchWork(idOrUrl, { onProgress, max } = {}) {
  const wid = workIdFromUrl(idOrUrl) || (String(idOrUrl || '').match(/\d+/) || [])[0] || '';
  if (!wid) throw new Error('No Scribble Hub series id');
  // Prefer the full canonical URL (with slug) when given one — Scribble Hub 404s
  // on the slug-less /series/{id}/ form. Fall back to building it from the id.
  const series = /^https?:\/\//i.test(String(idOrUrl)) ? String(idOrUrl) : workUrl(wid);
  const r = await fetchHtml(series);
  if (!r.html || r.status >= 400) throw new Error(`Scribble Hub HTTP ${r.status || '?'}`);
  const meta = parseSeries(r.html, wid);
  meta.url = series; // keep the working (slugged) URL for the library link + future updates
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

export async function fetchUpdates(idOrUrl, stored = 0) {
  const wid = workIdFromUrl(idOrUrl) || (String(idOrUrl || '').match(/\d+/) || [])[0] || '';
  const series = /^https?:\/\//i.test(String(idOrUrl)) ? String(idOrUrl) : workUrl(wid);
  const r = await fetchHtml(series);
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

// ---- genre discovery (RSS) -------------------------------------------------
const stripCdata = (s) => String(s || '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, '$1').trim();
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const decodeEntities = (s) => String(s || '')
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(parseInt(n, 10)); } catch (e) { return _; } })
  .replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" }[m] || m));
const genreSlug = (g) => String(g || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Pure parser: a Scribble Hub genre RSS feed → series metas.
export function parseGenreFeed(xml) {
  const out = [];
  const seen = new Set();
  for (const item of String(xml || '').match(/<item\b[\s\S]*?<\/item>/gi) || []) {
    const link = (item.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '';
    const id = (link.match(/\/series\/(\d+)/) || [])[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = decodeEntities(stripCdata((item.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '')) || 'Untitled';
    const author = decodeEntities(stripCdata((item.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/i) || [])[1] || ''));
    const summary = decodeEntities(stripHtml(stripCdata((item.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || '')));
    const tags = (item.match(/<category>([\s\S]*?)<\/category>/gi) || [])
      .map((c) => ({ t: decodeEntities(stripHtml(stripCdata(c.replace(/<\/?category>/gi, '')))), k: 'freeform' })).filter((x) => x.t);
    out.push({ source: 'scribblehub', sourceId: id, title, author, summary, fandom: '', tags, status: 'ongoing', words: 0, language: 'English', url: (link || '').trim() || workUrl(id) });
  }
  return out;
}

// Discover recent Scribble Hub series in a genre (the genre RSS feed). Multi-tag
// search uses the first term's genre feed for now.
export async function searchTags(include) {
  const inc = (include || []).map((t) => String(t).trim()).filter(Boolean);
  if (!inc.length) return [];
  const s = genreSlug(inc[0]);
  if (!s) return [];
  try {
    const r = await fetchHtml(`${BASE}/genre/${s}/feed/`);
    if (!r || r.status !== 200) return [];
    return parseGenreFeed(r.html);
  } catch (e) {
    return [];
  }
}

function text(root, sel) { const el = root.querySelector(sel); return el ? el.textContent : ''; }
