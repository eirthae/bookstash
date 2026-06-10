import test from 'node:test';
import assert from 'node:assert/strict';
import { sortWorks, newId } from './db.js';

const w = (over) => ({ title: 'T', author: 'A', addedAt: '2026-01-01T00:00:00Z', ...over });

test('sortWorks: added = newest first (by addedAt desc), non-mutating', () => {
  const list = [w({ title: 'old', addedAt: '2026-01-01T00:00:00Z' }), w({ title: 'new', addedAt: '2026-06-01T00:00:00Z' })];
  const out = sortWorks(list, 'added');
  assert.deepEqual(out.map((x) => x.title), ['new', 'old']);
  assert.equal(list[0].title, 'old'); // original untouched
});

test('sortWorks: title = A→Z, author = A→Z', () => {
  const list = [w({ title: 'Banana', author: 'Zed' }), w({ title: 'Apple', author: 'Ann' })];
  assert.deepEqual(sortWorks(list, 'title').map((x) => x.title), ['Apple', 'Banana']);
  assert.deepEqual(sortWorks(list, 'author').map((x) => x.author), ['Ann', 'Zed']);
});

test('sortWorks tolerates empty / missing fields', () => {
  assert.deepEqual(sortWorks([], 'added'), []);
  assert.deepEqual(sortWorks(undefined, 'title'), []);
  const out = sortWorks([{ title: 'x' }, { title: 'a' }], 'title');
  assert.deepEqual(out.map((x) => x.title), ['a', 'x']);
});

test('newId returns a non-empty unique-ish string', () => {
  const a = newId(); const b = newId();
  assert.equal(typeof a, 'string');
  assert.ok(a.length > 0);
  assert.notEqual(a, b);
});
