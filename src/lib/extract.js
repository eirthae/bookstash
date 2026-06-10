import { Readability } from '@mozilla/readability';

// Extract the readable article from a fetched page's HTML — title + clean body
// HTML — using Mozilla Readability (the engine behind Firefox Reader View), with
// plain-body fallbacks. DOM-based, so verified on-device; the pure helpers below
// are unit-tested.

export function countWords(html) {
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function hostName(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// Light hygiene on extracted HTML: drop scripts/styles/forms and inline events.
function clean(htmlText) {
  const doc = new DOMParser().parseFromString(`<div>${htmlText}</div>`, 'text/html');
  const root = doc.body.firstChild || doc.body;
  root.querySelectorAll('script,style,link,iframe,object,embed,form,svg').forEach((el) => el.remove());
  root.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      const n = a.name.toLowerCase();
      if (n.startsWith('on') || (n === 'href' && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
    });
  });
  return (root.innerHTML || '').trim();
}

export function extractArticle(html, sourceUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let parsed = null;
  try { parsed = new Readability(doc.cloneNode(true)).parse(); } catch (e) { parsed = null; }

  const title =
    (parsed && parsed.title && parsed.title.trim()) ||
    (doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '').trim() ||
    (doc.querySelector('title')?.textContent || '').trim() ||
    (doc.querySelector('h1')?.textContent || '').trim() ||
    hostName(sourceUrl) || 'Untitled';

  let content = parsed && parsed.content ? parsed.content : '';
  if (!content) {
    const body = doc.body || doc.documentElement;
    content = body ? body.innerHTML : '';
  }
  content = clean(content);

  const author = (parsed && parsed.byline && parsed.byline.trim()) || '';
  return { title: title.slice(0, 300), author, content, words: countWords(content) };
}
