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

import { groupBySeries } from './db.js';

test('groupBySeries clusters by series, orders by index, loose separate', () => {
  const list = [
    { id: 'a', title: 'B2', series: 'Saga', seriesIndex: 2 },
    { id: 'b', title: 'B1', series: 'Saga', seriesIndex: 1 },
    { id: 'c', title: 'Standalone', series: '' },
    { id: 'd', title: 'A1', series: 'Apple', seriesIndex: 1 },
  ];
  const { seriesGroups, loose } = groupBySeries(list);
  assert.equal(seriesGroups.length, 2);
  assert.equal(seriesGroups[0].name, 'Apple'); // alphabetical sections
  assert.equal(seriesGroups[1].name, 'Saga');
  assert.deepEqual(seriesGroups[1].items.map((w) => w.id), ['b', 'a']); // by index
  assert.deepEqual(loose.map((w) => w.id), ['c']);
});

test('groupBySeries with no series → no groups', () => {
  const { seriesGroups, loose } = groupBySeries([{ id: 'x', series: '' }]);
  assert.equal(seriesGroups.length, 0);
  assert.equal(loose.length, 1);
});
