import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

before(() => { globalThis.DOMParser = DOMParser; });

const { isShUrl, workIdFromUrl, parseSeries, parseChapter } = await import('./scribblehub.js');

const SERIES = `
<div class="fic_title">Reborn Apothecary</div>
<span class="auth_name_fic">someauthor</span>
<div class="wi_fic_desc"><p>A healer reborn into a cultivation world.</p></div>
<div class="wi_fic_genre"><a class="fic_genre" href="/g">Fantasy</a><a class="fic_genre" href="/g2">Cultivation</a></div>
<div class="wi_fic_tags"><a class="stag" href="/t">Female Protagonist</a></div>
<ol class="toc_ol">
  <li class="toc_w"><a class="toc_a" href="/read/77-reborn/chapter/1/">1. Awakening</a></li>
  <li class="toc_w"><a class="toc_a" href="/read/77-reborn/chapter/2/">2. The Pill</a></li>
</ol>`;

const CHAPTER = `<div id="chp_raw"><div class="wi_authornotes">note</div><p>She opened her eyes.</p><p>The world had changed.</p></div>`;

test('url helpers', () => {
  assert.ok(isShUrl('https://www.scribblehub.com/series/77/reborn/'));
  assert.ok(!isShUrl('https://example.com/series/77'));
  assert.equal(workIdFromUrl('https://www.scribblehub.com/series/77/reborn/'), '77');
});

test('parseSeries extracts metadata + chapter refs', () => {
  const s = parseSeries(SERIES, '77');
  assert.equal(s.title, 'Reborn Apothecary');
  assert.equal(s.author, 'someauthor');
  assert.equal(s.summary, 'A healer reborn into a cultivation world.');
  assert.deepEqual(s.tags.map((t) => t.t), ['Fantasy', 'Cultivation', 'Female Protagonist']);
  assert.equal(s.chapters, 2);
  assert.equal(s._refs[0].n, 1);
  assert.equal(s._refs[1].title, '2. The Pill');
  assert.match(s._refs[0].url, /\/chapter\/1\//);
});

test('parseChapter returns body, strips author notes', () => {
  const c = parseChapter(CHAPTER);
  assert.match(c.html, /She opened her eyes/);
  assert.ok(!/note/.test(c.html));
  assert.ok(c.words > 3);
});

test('parseSeries throws on a non-series page', () => {
  assert.throws(() => parseSeries('<html><body>nope</body></html>', '1'));
});
