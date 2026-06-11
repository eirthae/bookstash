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

// ---- small DOM helpers -----------------------------------------------------
function text(root, sel) {
  const el = root.querySelector(sel);
  return el ? el.textContent : '';
}
function tagTexts(root, sel) {
  return [...root.querySelectorAll(sel)].map((a) => clean(a.textContent)).filter(Boolean);
}
