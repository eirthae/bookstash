import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickCardTags, isPriorityTag } from './cardtags.js';

const T = (t, k = 'freeform') => ({ t, k });

test('drops the group\'s own tags (case-insensitive)', () => {
  const work = [T('Soulmates AU'), T('Slow Burn'), T('Fluff')];
  const shown = pickCardTags(work, ['soulmates au']).map((x) => x.t);
  assert.deepEqual(shown, ['Slow Burn', 'Fluff']);
});

test('floats content-warning tags to the front', () => {
  const work = [T('Fluff'), T('Slow Burn'), T('Major Character Death')];
  const shown = pickCardTags(work, [], 3).map((x) => x.t);
  assert.equal(shown[0], 'Major Character Death');
});

test('Dead Dove and Hurt/No Comfort are prioritized', () => {
  assert.ok(isPriorityTag(T('Dead Dove: Do Not Eat')));
  assert.ok(isPriorityTag(T('Hurt/No Comfort')));
  assert.ok(!isPriorityTag(T('Domestic Fluff')));
});

test('limits to N and de-dupes', () => {
  const work = [T('A'), T('A'), T('B'), T('C'), T('D')];
  const shown = pickCardTags(work, [], 3).map((x) => x.t);
  assert.deepEqual(shown, ['A', 'B', 'C']);
});

test('handles string tags and missing input', () => {
  assert.deepEqual(pickCardTags(['x', 'y'], ['x']), ['y']);
  assert.deepEqual(pickCardTags(null), []);
});
