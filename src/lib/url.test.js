import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitQuery } from './url.js';

// The whole point: an inline "?" must come back out as { base, params } so it can
// be handed to CapacitorHttp's native `params` (the buggy interceptor mangles an
// inline "?"). These are the exact URL shapes the app builds.

test('autocomplete: ?term=… → base + params', () => {
  const { base, params } = splitQuery('https://archiveofourown.org/autocomplete/tag?term=shane');
  assert.equal(base, 'https://archiveofourown.org/autocomplete/tag');
  assert.deepEqual(params, { term: 'shane' });
});

test('work page: multiple params split out', () => {
  const { base, params } = splitQuery('https://archiveofourown.org/works/123?view_full_work=true&view_adult=true');
  assert.equal(base, 'https://archiveofourown.org/works/123');
  assert.deepEqual(params, { view_full_work: 'true', view_adult: 'true' });
});

test('tag search: bracketed keys + comma values are decoded', () => {
  const p = new URLSearchParams();
  p.set('work_search[other_tag_names]', 'Fluff,Angst');
  p.set('work_search[sort_column]', 'created_at');
  const { base, params } = splitQuery(`https://archiveofourown.org/works/search?${p.toString()}`);
  assert.equal(base, 'https://archiveofourown.org/works/search');
  assert.equal(params['work_search[other_tag_names]'], 'Fluff,Angst');
  assert.equal(params['work_search[sort_column]'], 'created_at');
});

test('series paging: ?page=2', () => {
  const { base, params } = splitQuery('https://archiveofourown.org/series/689388?page=2');
  assert.equal(base, 'https://archiveofourown.org/series/689388');
  assert.deepEqual(params, { page: '2' });
});

test('no query → params null (plain request, key omitted)', () => {
  const { base, params } = splitQuery('https://archiveofourown.org/works/123');
  assert.equal(base, 'https://archiveofourown.org/works/123');
  assert.equal(params, null);
});

test('percent-encoded value round-trips through to a clean param', () => {
  const { params } = splitQuery('https://archiveofourown.org/autocomplete/tag?term=harry%20potter');
  assert.deepEqual(params, { term: 'harry potter' }); // CapacitorHttp re-encodes the space natively
});

// Guards the actual bug: the returned base must NOT contain a "?" (which is what
// got percent-encoded onto the path on-device).
test('base never contains the query delimiter', () => {
  for (const u of [
    'https://archiveofourown.org/autocomplete/tag?term=x',
    'https://archiveofourown.org/works/search?a=1&b=2',
  ]) {
    assert.ok(!splitQuery(u).base.includes('?'));
  }
});
