import JSZip from 'jszip';

// On-device file parsing for BookStash. An EPUB / HTML / TXT file is parsed in
// the WebView into { title, author, summary, series, seriesIndex, chapters[] },
// where each chapter body is HTML the reader renders directly. No network.
//
// DOM-based parsing (EPUB/HTML) needs the browser's DOMParser, so it's verified
// in the live app rather than node:test; the pure string/path helpers below are
// unit-tested.

// ---- pure helpers (unit-tested) -------------------------------------------
export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function countWords(html) {
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function titleFromFilename(name) {
  return (name || 'Untitled').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';
}

// Normalise an href relative to the OPF's directory ("OEBPS/text/c1.xhtml").
export function resolvePath(baseDir, href) {
  const clean = String(href || '').split('#')[0].split('?')[0];
  const parts = (baseDir ? baseDir.split('/') : []).filter(Boolean);
  for (const seg of clean.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

// Plain text → paragraph HTML (blank-line separated; single breaks → <br>).
export function txtToHtml(raw) {
  return String(raw).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('\n');
}

export function isSupportedUpload(file) {
  return /\.(epub|html?|txt)$/i.test((file && file.name) || '');
}

// ---- DOM helpers (browser only) -------------------------------------------
function cleanNode(root) {
  const KILL = ['script', 'style', 'link', 'meta', 'iframe', 'object', 'embed', 'img', 'svg', 'head'];
  root.querySelectorAll(KILL.join(',')).forEach((el) => el.remove());
  root.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      const n = a.name.toLowerCase();
      if (n.startsWith('on') || (n === 'href' && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
    });
  });
}
function bodyHtml(doc) {
  const body = doc.body || doc.querySelector('body') || doc.documentElement;
  if (!body) return '';
  cleanNode(body);
  return (body.innerHTML || '').trim();
}
function headingText(doc) {
  const h = doc.querySelector('h1, h2, h3');
  const t = h && h.textContent.trim();
  if (t) return t;
  const dt = doc.querySelector('title');
  return (dt && dt.textContent.trim()) || '';
}
function byTag(root, name) {
  const out = [];
  root.querySelectorAll('*').forEach((el) => { if (el.localName && el.localName.toLowerCase() === name) out.push(el); });
  return out;
}

// ---- parsers ---------------------------------------------------------------
async function parseEpub(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const dom = new DOMParser();

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('Not a valid EPUB (no container.xml).');
  const container = dom.parseFromString(await containerFile.async('string'), 'application/xml');
  const rootfile = byTag(container, 'rootfile')[0];
  const opfPath = rootfile && rootfile.getAttribute('full-path');
  if (!opfPath) throw new Error('Not a valid EPUB (no rootfile).');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  const opf = dom.parseFromString(await zip.file(opfPath).async('string'), 'application/xml');
  const title = (byTag(opf, 'title')[0]?.textContent || '').trim() || titleFromFilename(file.name);
  const author = (byTag(opf, 'creator')[0]?.textContent || '').trim();
  const language = (byTag(opf, 'language')[0]?.textContent || '').trim();
  const descEl = byTag(opf, 'description')[0];
  const summary = descEl ? descEl.textContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

  const metas = byTag(opf, 'meta');
  const metaName = (n) => {
    const el = metas.find((m) => (m.getAttribute('name') || '').toLowerCase() === n);
    return el ? (el.getAttribute('content') || '').trim() : '';
  };
  const metaProp = (p) => {
    const el = metas.find((m) => (m.getAttribute('property') || '').toLowerCase() === p);
    return el ? (el.textContent || '').trim() : '';
  };
  const series = metaName('calibre:series') || metaProp('belongs-to-collection');
  const idxRaw = metaName('calibre:series_index') || metaProp('group-position');
  const seriesIndex = idxRaw && !Number.isNaN(parseFloat(idxRaw)) ? parseFloat(idxRaw) : null;

  const manifest = {};
  byTag(opf, 'item').forEach((it) => {
    const id = it.getAttribute('id');
    if (id) manifest[id] = { href: it.getAttribute('href') || '', type: (it.getAttribute('media-type') || '').toLowerCase() };
  });
  const spine = byTag(opf, 'itemref').map((ref) => ref.getAttribute('idref')).filter(Boolean);

  const chapters = [];
  let n = 0;
  for (const idref of spine) {
    const item = manifest[idref];
    if (!item || !/x?html/.test(item.type)) continue;
    const path = resolvePath(opfDir, item.href);
    const entry = zip.file(path);
    if (!entry) continue;
    const doc = dom.parseFromString(await entry.async('string'), 'text/html');
    const content = bodyHtml(doc);
    if (!content || countWords(content) < 3) continue; // skip covers / nav / blanks
    n += 1;
    chapters.push({ n, title: headingText(doc) || `Chapter ${n}`, content, words: countWords(content) });
  }
  if (!chapters.length) throw new Error('No readable chapters found in this EPUB.');
  return { title, author, summary, language, series, seriesIndex, chapters };
}

async function parseHtmlFile(file) {
  const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
  const title = (doc.querySelector('title')?.textContent || '').trim()
    || (doc.querySelector('h1')?.textContent || '').trim()
    || titleFromFilename(file.name);
  const content = bodyHtml(doc);
  if (!content) throw new Error('That HTML file has no readable body.');
  return { title, author: '', summary: '', language: '', chapters: [{ n: 1, title, content, words: countWords(content) }] };
}

async function parseTxtFile(file) {
  const html = txtToHtml(await file.text());
  if (!html) throw new Error('That file is empty.');
  const title = titleFromFilename(file.name);
  return { title, author: '', summary: '', language: '', chapters: [{ n: 1, title, content: html, words: countWords(html) }] };
}

// Parse any supported file → normalized { title, author, …, chapters[] }.
export async function parseFile(file) {
  const name = ((file && file.name) || '').toLowerCase();
  if (name.endsWith('.epub')) return parseEpub(file);
  if (name.endsWith('.html') || name.endsWith('.htm')) return parseHtmlFile(file);
  if (name.endsWith('.txt')) return parseTxtFile(file);
  throw new Error('Unsupported file. Upload an EPUB, HTML, or TXT file.');
}
