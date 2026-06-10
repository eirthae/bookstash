import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug, parseShelf, combineShelves } from './goodreads.js';

// A trimmed two-book Goodreads shelf fragment (real markup shape).
const SHELF = `
<div class="elementList">
  <a class="bookTitle" href="/book/show/29774026-heated-rivalry"><span itemprop="name">Heated Rivalry</span></a>
  <span class="authorName"><span itemprop="name">Rachel Reid</span></span>
  <span class="minirating">4.21 avg rating &mdash; 50,000 ratings</span>
</div>
<div class="elementList">
  <a class="bookTitle" href="/book/show/12345-tom-&-jerry"><span itemprop="name">Tom &amp; Jerry</span></a>
  <span class="authorName"><span itemprop="name">A. Writer</span></span>
  <span class="minirating">3.90 avg rating &mdash; 10 ratings</span>
</div>`;

test('slug matches Goodreads shelf form', () => {
  assert.equal(slug('M/M Romance'), 'm-m-romance');
  assert.equal(slug('  Enemies To Lovers  '), 'enemies-to-lovers');
  assert.equal(slug('Hockey'), 'hockey');
  assert.equal(slug('!!!'), '');
});

test('parseShelf extracts id, title, author, rating, url', () => {
  const books = parseShelf(SHELF);
  assert.equal(books.length, 2);
  assert.equal(books[0].id, '29774026');
  assert.equal(books[0].title, 'Heated Rivalry');
  assert.equal(books[0].author, 'Rachel Reid');
  assert.equal(books[0].rating, '4.21');
  assert.equal(books[0].url, 'https://www.goodreads.com/book/show/29774026');
});

test('parseShelf decodes entities in titles', () => {
  const books = parseShelf(SHELF);
  assert.equal(books[1].title, 'Tom & Jerry');
});

test('parseShelf de-dupes and respects the limit', () => {
  assert.equal(parseShelf(SHELF + SHELF).length, 2); // same ids repeated → still 2
  assert.equal(parseShelf(SHELF, 1).length, 1);
});

test('parseShelf on junk returns empty', () => {
  assert.deepEqual(parseShelf('<html>nope</html>'), []);
  assert.deepEqual(parseShelf(''), []);
});

test('combineShelves intersects include shelves (AND)', () => {
  const a = [{ id: '1' }, { id: '2' }, { id: '3' }];
  const b = [{ id: '2' }, { id: '3' }, { id: '9' }];
  const out = combineShelves([a, b]);
  assert.deepEqual(out.map((x) => x.id), ['2', '3']); // primary order preserved
});

test('combineShelves falls back to primary when intersection is empty', () => {
  const a = [{ id: '1' }, { id: '2' }];
  const b = [{ id: '8' }, { id: '9' }];
  assert.deepEqual(combineShelves([a, b]).map((x) => x.id), ['1', '2']);
});

test('combineShelves drops excluded ids', () => {
  const a = [{ id: '1' }, { id: '2' }, { id: '3' }];
  const out = combineShelves([a], [new Set(['2'])]);
  assert.deepEqual(out.map((x) => x.id), ['1', '3']);
});

test('combineShelves handles no shelves', () => {
  assert.deepEqual(combineShelves([]), []);
  assert.deepEqual(combineShelves([[]]), []);
});
