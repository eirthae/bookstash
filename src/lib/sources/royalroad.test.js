import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

before(() => { globalThis.DOMParser = DOMParser; });

const { isRrUrl, workIdFromUrl, parseFiction, parseChapter } = await import('./royalroad.js');

const FICTION = `
<div class="fic-header">
  <div class="fic-title"><h1>The Wandering Inn</h1><h4>by <a href="/profile/123">pirateaba</a></h4></div>
  <div class="tags"><a class="label" href="/x">Fantasy</a><a class="label" href="/y">LitRPG</a></div>
  <div class="fiction-info"><span class="label label-default">ONGOING</span></div>
  <div class="description"><div class="hidden-content"><p>An inn, an innkeeper, a world.</p></div></div>
</div>
<table id="chapters"><tbody>
  <tr><td><a href="/fiction/22/the-wandering-inn/chapter/1/1-00">1.00</a></td><td>2 years ago</td></tr>
  <tr><td><a href="/fiction/22/the-wandering-inn/chapter/2/1-01">1.01</a></td><td>2 years ago</td></tr>
  <tr><td><a href="/fiction/22/the-wandering-inn/chapter/3/1-02">1.02</a></td><td>2 years ago</td></tr>
</tbody></table>`;

const CHAPTER = `
<div class="chapter-content">
  <div class="portlet author-note-portlet">Author note: thanks!</div>
  <p>Erin Solstice walked into the inn.</p><p>It was empty.</p>
</div>`;

test('url helpers', () => {
  assert.ok(isRrUrl('https://www.royalroad.com/fiction/22/the-wandering-inn'));
  assert.ok(!isRrUrl('https://example.com/fiction/22'));
  assert.equal(workIdFromUrl('https://www.royalroad.com/fiction/22/slug/chapter/3/x'), '22');
});

test('parseFiction extracts metadata + chapter refs', () => {
  const f = parseFiction(FICTION, '22');
  assert.equal(f.title, 'The Wandering Inn');
  assert.equal(f.author, 'pirateaba');
  assert.equal(f.summary, 'An inn, an innkeeper, a world.');
  assert.equal(f.status, 'ongoing');
  assert.deepEqual(f.tags.map((t) => t.t), ['Fantasy', 'LitRPG']);
  assert.equal(f.chapters, 3);
  assert.equal(f._refs.length, 3);
  assert.equal(f._refs[0].title, '1.00');
  assert.match(f._refs[0].url, /\/chapter\/1\//);
});

test('parseChapter returns body, strips author-note portlet', () => {
  const c = parseChapter(CHAPTER);
  assert.match(c.html, /Erin Solstice walked/);
  assert.ok(!/Author note/.test(c.html));
  assert.ok(c.words > 3);
});

test('parseFiction throws on a non-fiction page', () => {
  assert.throws(() => parseFiction('<html><body>nope</body></html>', '1'));
});

// --- tag discovery ---------------------------------------------------------
const { parseSearchResults } = await import('./royalroad.js');
const SEARCH = `
<div class="fiction-list">
  <div class="fiction-list-item row">
    <h2 class="fiction-title"><a href="/fiction/999/mage-errant">Mage Errant</a></h2>
    <span class="author">by <span>author</span></span>
    <span class="tags"><a class="fiction-tag" href="/fictions/search?tagsAdd=fantasy">Fantasy</a><a class="fiction-tag" href="/fictions/search?tagsAdd=magic">Magic</a></span>
    <div class="margin-top-10 col-xs-12"><p>A weak mage learns.</p></div>
  </div>
</div>`;
test('parseSearchResults parses RR blurbs', () => {
  const r = parseSearchResults(SEARCH);
  assert.equal(r.length, 1);
  assert.equal(r[0].sourceId, '999');
  assert.equal(r[0].title, 'Mage Errant');
  assert.deepEqual(r[0].tags.map((t) => t.t), ['Fantasy', 'Magic']);
  assert.equal(r[0].summary, 'A weak mage learns.'); // from div.margin-top-10.col-xs-12
  assert.equal(r[0].source, 'royalroad');
});
