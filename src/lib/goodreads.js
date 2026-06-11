import { fetchHtml } from './fetch.js';

// Goodreads book discovery — notify-only. We read public "shelf" pages
// (goodreads.com/shelf/show/<slug>), which are reader-tagged book lists, and
// surface basic info + a link out. BookStash never downloads books here; the
// reader finds the result, then sources the file themselves (buy / library /
// upload). Local-first: this is the only outbound call, made on demand.
const BASE = 'https://www.goodreads.com';

// "M/M Romance" → "m-m-romance"; matches Goodreads' own shelf slugs.
export function slug(tag) {
  return String(tag || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Minimal HTML-entity decode — DOM-free so this parses identically in the app
// (WebView) and in `node --test`.
function decode(s) {
  const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&nbsp;': ' ' };
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(parseInt(n, 10)); } catch (e) { return _; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCharCode(parseInt(n, 16)); } catch (e) { return _; } })
    .replace(/&[a-z]+;/gi, (m) => map[m.toLowerCase()] ?? m);
}

// Pure parser: a Goodreads shelf page → up to `limit` de-duped books.
export function parseShelf(html, limit = 50) {
  const out = [];
  const seen = new Set();
  const parts = String(html || '').split('class="bookTitle"').slice(1);
  for (const chunk of parts) {
    const mId = chunk.match(/href="\/book\/show\/(\d+)/);
    const mTitle = chunk.match(/>\s*([^<]+?)\s*<\/(?:span|a)>/);
    if (!mId || !mTitle) continue;
    const id = mId[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const title = decode(mTitle[1]).trim() || 'Untitled';
    const mAuth = chunk.match(/class="authorName"[^>]*>\s*(?:<span[^>]*>)?\s*([^<]+)/);
    const author = mAuth ? decode(mAuth[1]).trim() : 'Unknown author';
    const mRate = chunk.match(/(\d+\.\d+)\s+avg rating/);
    out.push({ id, title, author, rating: mRate ? mRate[1] : '', url: `${BASE}/book/show/${id}` });
    if (out.length >= limit) break;
  }
  return out;
}

// Fetch one shelf (on-device only — CapacitorHttp). Network/parse errors → [].
export async function shelfBooks(tag, limit = 50) {
  const s = slug(tag);
  if (!s) return [];
  try {
    const r = await fetchHtml(`${BASE}/shelf/show/${s}`);
    if (!r || r.status !== 200) return [];
    return parseShelf(r.html, limit);
  } catch (e) {
    return [];
  }
}

// Pure set-logic core (testable without network): intersect include-shelf
// results (AND), drop anything on an exclude shelf, preserve the primary shelf's
// order. If a multi-tag search's tags never co-occur we return nothing rather
// than dumping the primary shelf's unrelated books — otherwise a "gay romance +
// magic school" search whose tags don't overlap would surface plain magic-school
// books (Harry Potter), reading as the wrong genre entirely.
export function combineShelves(shelves, excludeIdSets = [], limit = 30) {
  const lists = (shelves || []).filter((l) => Array.isArray(l) && l.length);
  if (!lists.length) return [];
  const byId = {};
  lists.flat().forEach((b) => { byId[b.id] = b; });
  let ids = new Set(lists[0].map((b) => b.id));
  for (const list of lists.slice(1)) {
    const set = new Set(list.map((b) => b.id));
    ids = new Set([...ids].filter((i) => set.has(i)));
  }
  for (const ex of excludeIdSets) ex.forEach((i) => ids.delete(i));
  return lists[0].map((b) => b.id).filter((i) => ids.has(i)).slice(0, limit).map((i) => byId[i]);
}

// Orchestration: include tags (AND, up to 3) minus exclude tags (up to 2).
export async function discoverBooks(include, exclude = [], limit = 30) {
  const inc = (include || []).map((t) => String(t).trim()).filter(Boolean).slice(0, 3);
  if (!inc.length) return [];
  const shelves = await Promise.all(inc.map((t) => shelfBooks(t)));
  if (!shelves[0] || !shelves[0].length) return []; // primary shelf unreachable/empty
  const exc = (exclude || []).map((t) => String(t).trim()).filter(Boolean).slice(0, 2);
  const exShelves = await Promise.all(exc.map((t) => shelfBooks(t)));
  const excludeIdSets = exShelves.map((l) => new Set(l.map((b) => b.id)));
  return combineShelves(shelves, excludeIdSets, limit);
}
