import { fetchHtml } from '../fetch.js';

// On-device AO3 source — the JS port of FicStash's worker ao3.py. Fetches a work
// from AO3's PUBLIC pages on the phone (native HTTP, no login) and parses clean
// metadata + every chapter, so an AO3 link comes in with its real title, author,
// summary, fandom, relationship/character/freeform tags, series and full text —
// not the raw page <title> the generic extractor produced.

export const AO3_HOST = 'archiveofourown.org';

export function isAo3Url(url) {
  return /(^|[/.@])archiveofourown\.org/i.test(String(url || ''));
}

// Work id from any AO3 work URL (incl. /collections/x/works/123, /chapters/...).
export function workIdFromUrl(url) {
  const m = String(url || '').match(/\/works\/(\d+)/);
  return m ? m[1] : '';
}

// The "entire work on one page" URL with the adult-content gate pre-consented,
// so a single fetch returns every chapter (and age-gated works don't bounce).
export function fullWorkUrl(id) {
  return `https://${AO3_HOST}/works/${id}?view_full_work=true&view_adult=true`;
}

export function workUrl(id) {
  return `https://${AO3_HOST}/works/${id}`;
}

// "5/12" → ongoing, "12/12" → complete, "3/?" → ongoing. AO3's chapters stat.
export function parseChapterStat(text) {
  const m = String(text || '').replace(/,/g, '').match(/(\d+)\s*\/\s*(\d+|\?)/);
  if (!m) return { chapters: 0, total: null, status: 'ongoing' };
  const have = parseInt(m[1], 10);
  const total = m[2] === '?' ? null : parseInt(m[2], 10);
  return { chapters: have, total, status: total != null && have >= total ? 'complete' : 'ongoing' };
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const wordCount = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

// Clean a chapter body: drop AO3's invisible "Chapter Text"/"Notes" landmark
// headings, then return its inner HTML + a word count (landmark excluded).
function cleanBody(bodyEl) {
  if (!bodyEl) return { html: '', words: 0 };
  const node = bodyEl.cloneNode(true);
  node.querySelectorAll('.landmark').forEach((e) => e.remove());
  return { html: (node.innerHTML || '').trim(), words: wordCount(node.textContent) };
}

// Pure parser: a full-work AO3 HTML page → { ...meta, chapters[] } | { restricted }.
// `restricted` means a logged-out guest can't read it (members-only) — the caller
// shows a "read on AO3" label, exactly like FicStash.
export function parseWork(html, id = '') {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');

  const title = clean(text(doc, 'h2.title.heading'));
  if (!title) {
    if (doc.querySelector('form[action*="/users/login"]') || /This work is only available to/i.test(html)) {
      return { restricted: true };
    }
    throw new Error('Not an AO3 work page');
  }

  const authors = [...doc.querySelectorAll('h3.byline.heading a[rel="author"]')].map((a) => clean(a.textContent)).filter(Boolean);
  const author = authors.length ? authors.join(', ') : (clean(text(doc, 'h3.byline.heading')) || 'Anonymous');

  const fandoms = tagTexts(doc, 'dd.fandom.tags a.tag');
  const tags = [
    ...tagTexts(doc, 'dd.relationship.tags a.tag').map((t) => ({ t, k: 'relationship' })),
    ...tagTexts(doc, 'dd.character.tags a.tag').map((t) => ({ t, k: 'character' })),
    ...tagTexts(doc, 'dd.freeform.tags a.tag').map((t) => ({ t, k: 'freeform' })),
  ];

  const summary = clean(text(doc, '.summary.module blockquote.userstuff') || text(doc, '.summary .userstuff'));
  const language = clean(text(doc, 'dd.language')) || 'English';
  const statWords = parseInt((text(doc, 'dd.words') || '').replace(/[^\d]/g, ''), 10) || 0;
  const chStat = parseChapterStat(text(doc, 'dd.chapters'));

  // Series (primary): "Part N of <a href="/series/ID">N</a> ... <a>Name</a>".
  // Two links point at the series — the part number and the name; we want the
  // name (the one that isn't just digits), and read the part from "Part N".
  let series = '', seriesIndex = null, ao3SeriesId = '';
  const seriesLinks = [...doc.querySelectorAll('dd.series a[href*="/series/"], .series .position a[href*="/series/"]')];
  if (seriesLinks.length) {
    const nameLink = seriesLinks.find((a) => !/^\d+$/.test(clean(a.textContent))) || seriesLinks[seriesLinks.length - 1];
    ao3SeriesId = (nameLink.getAttribute('href').match(/\/series\/(\d+)/) || [])[1] || '';
    series = clean(nameLink.textContent);
    const pm = clean((nameLink.closest('.position') || nameLink.parentElement || nameLink).textContent).match(/Part\s+(\d+)/i);
    if (pm) seriesIndex = parseInt(pm[1], 10);
  }

  // Chapters. Full-work view nests each chapter in div.chapter; a oneshot has a
  // single #chapters .userstuff with no chapter wrapper.
  const chapters = [];
  const chapterEls = [...doc.querySelectorAll('#chapters > div.chapter, div.chapter[id^="chapter-"]')];
  if (chapterEls.length) {
    chapterEls.forEach((ch, i) => {
      const t = clean(text(ch, '.chapter.preface .title') || text(ch, 'h3.title')) || `Chapter ${i + 1}`;
      const body = ch.querySelector('.userstuff[role="article"]') || ch.querySelector('div.userstuff');
      const b = cleanBody(body);
      chapters.push({ n: i + 1, title: t, content: b.html, words: b.words });
    });
  } else {
    const chaptersEl = doc.querySelector('#chapters');
    const body = (chaptersEl && (chaptersEl.querySelector('.userstuff') || (chaptersEl.classList.contains('userstuff') ? chaptersEl : null)))
      || doc.querySelector('#workskin .userstuff');
    const b = cleanBody(body);
    chapters.push({ n: 1, title, content: b.html, words: b.words });
  }

  return {
    source: 'ao3',
    sourceId: String(id || ''),
    title,
    author,
    authors,
    fandom: fandoms.join(', '),
    fandoms,
    summary,
    tags,
    language,
    words: statWords || chapters.reduce((s, c) => s + c.words, 0),
    chapters: chapters.length,
    chaptersTotal: chStat.total,
    status: chStat.status,
    series,
    seriesIndex,
    ao3SeriesId,
    url: workUrl(id),
    chaptersData: chapters,
  };
}

// Fetch + parse one AO3 work by id, on-device. Returns the parsed work (with
// .chaptersData) or { restricted: true }.
export async function fetchWork(id) {
  const wid = String(id || '').match(/\d+/)?.[0] || workIdFromUrl(id);
  if (!wid) throw new Error('No AO3 work id');
  const r = await fetchHtml(fullWorkUrl(wid));
  if (/\/users\/login/i.test(r.url || '') && /restricted=true/i.test(r.url || '')) return { restricted: true };
  if (!r.html || r.status >= 400) throw new Error(`AO3 HTTP ${r.status || '?'}`);
  return parseWork(r.html, wid);
}

// ---- series enumeration (Download all / Follow series) ----------------------
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pure parser: an AO3 /series/<id> page → [{ id, title }] in series order.
export function parseSeriesWorkIds(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const ul = doc.querySelector('ul.series.work.index.group') || doc.querySelector('ul.work.index.group') || doc;
  const out = [];
  const seen = new Set();
  for (const a of ul.querySelectorAll('li h4.heading a[href^="/works/"], li .heading a[href^="/works/"]')) {
    const id = (a.getAttribute('href').match(/\/works\/(\d+)/) || [])[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title: clean(a.textContent) });
  }
  return out;
}

// All work ids in a series, in order (paginated, polite). On-device.
export async function seriesWorks(seriesId, maxPages = 10) {
  const sid = String(seriesId || '').match(/\d+/)?.[0];
  if (!sid) return [];
  const out = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    let r;
    try { r = await fetchHtml(`https://${AO3_HOST}/series/${sid}?page=${page}`); } catch (e) { break; }
    if (!r || r.status >= 400 || !r.html) break;
    const rows = parseSeriesWorkIds(r.html);
    if (!rows.length) break;
    let added = 0;
    for (const w of rows) { if (!seen.has(w.id)) { seen.add(w.id); out.push(w); added += 1; } }
    if (added === 0 || rows.length < 20) break; // same page again / short last page
    await _sleep(1500);
  }
  return out;
}

// ---- tag search (Discover / tag tracking) ----------------------------------
// AO3's works search ANDs the tags in `other_tag_names` and subtracts
// `excluded_tag_names`, newest-first. We read the public results page and parse
// each work blurb — the on-device version of FicStash's worker search_group.
export function searchUrl(include, exclude = [], page = 1) {
  const p = new URLSearchParams();
  p.set('work_search[other_tag_names]', (include || []).join(','));
  if ((exclude || []).length) p.set('work_search[excluded_tag_names]', exclude.join(','));
  p.set('work_search[sort_column]', 'created_at');
  if (page > 1) p.set('page', String(page));
  return `https://${AO3_HOST}/works/search?${p.toString()}`;
}

// Pure parser: an AO3 works-search/listing page → [{ sourceId, title, author,
// fandom, summary, tags[], status, words, chaptersTotal, url }]. DOM-based.
export function parseSearchResults(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const out = [];
  for (const li of doc.querySelectorAll('li.work.blurb, li.blurb.work, li[id^="work_"]')) {
    const titleA = li.querySelector('.heading a[href^="/works/"]');
    if (!titleA) continue;
    const id = (titleA.getAttribute('href').match(/\/works\/(\d+)/) || [])[1];
    if (!id) continue;
    const author = clean(text(li, '.heading a[rel="author"]')) || 'Anonymous';
    const fandoms = tagTexts(li, '.fandoms a.tag');
    const tags = [
      ...tagTexts(li, 'ul.tags li.relationships a.tag').map((t) => ({ t, k: 'relationship' })),
      ...tagTexts(li, 'ul.tags li.characters a.tag').map((t) => ({ t, k: 'character' })),
      ...tagTexts(li, 'ul.tags li.freeforms a.tag').map((t) => ({ t, k: 'freeform' })),
    ];
    const chStat = parseChapterStat(text(li, 'dd.chapters'));
    out.push({
      source: 'ao3', sourceId: id,
      title: clean(titleA.textContent) || 'Untitled',
      author,
      fandom: fandoms.join(', '),
      summary: clean(text(li, 'blockquote.summary, blockquote.userstuff.summary')),
      tags,
      language: clean(text(li, 'dd.language')) || 'English',
      words: parseInt((text(li, 'dd.words') || '').replace(/[^\d]/g, ''), 10) || 0,
      status: chStat.status,
      chaptersTotal: chStat.total,
      url: workUrl(id),
    });
  }
  return out;
}

// Search AO3 by tags on-device (one page). Empty/parse-fail → [].
export async function searchTags(include, exclude = [], page = 1) {
  const inc = (include || []).map((t) => String(t).trim()).filter(Boolean);
  if (!inc.length) return [];
  try {
    const r = await fetchHtml(searchUrl(inc, exclude, page));
    if (!r || r.status !== 200) return [];
    return parseSearchResults(r.html);
  } catch (e) {
    return [];
  }
}

// Browse a whole AO3 language (newest first) — for "Browse by language" groups.
export async function searchLanguage(code, page = 1) {
  if (!code) return [];
  const p = new URLSearchParams();
  p.set('work_search[language_id]', String(code));
  p.set('work_search[sort_column]', 'created_at');
  if (page > 1) p.set('page', String(page));
  try {
    const r = await fetchHtml(`https://${AO3_HOST}/works/search?${p.toString()}`);
    if (!r || r.status !== 200) return [];
    return parseSearchResults(r.html);
  } catch (e) {
    return [];
  }
}

// AO3 tag autocomplete (the JSON endpoint), for the tracker's tag picker.
export async function autocompleteTag(term) {
  const q = String(term || '').trim();
  if (q.length < 2) return [];
  try {
    const r = await fetchHtml(`https://${AO3_HOST}/autocomplete/tag?term=${encodeURIComponent(q)}`);
    if (!r || r.status !== 200) return [];
    const data = JSON.parse(r.html);
    return (Array.isArray(data) ? data : []).map((d) => (typeof d === 'string' ? d : (d.name || d.value || d.id))).filter(Boolean);
  } catch (e) {
    return [];
  }
}

// ---- small DOM helpers -----------------------------------------------------
function text(root, sel) {
  const el = root.querySelector(sel);
  return el ? el.textContent : '';
}
function tagTexts(root, sel) {
  return [...root.querySelectorAll(sel)].map((a) => clean(a.textContent)).filter(Boolean);
}
