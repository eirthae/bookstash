import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkRef } from './urlref.js';

test('AO3 work URL → ao3 + numeric id', () => {
  assert.deepEqual(parseWorkRef('https://archiveofourown.org/works/12345'), { source: 'ao3', id: '12345' });
});
test('AO3 chapter URL resolves to the parent work id', () => {
  assert.deepEqual(parseWorkRef('https://archiveofourown.org/works/999/chapters/42'), { source: 'ao3', id: '999' });
});
test('AO3 collection URL resolves to the work id', () => {
  assert.deepEqual(parseWorkRef('https://archiveofourown.org/collections/x/works/77'), { source: 'ao3', id: '77' });
});
test('Royal Road fiction URL → royalroad + id', () => {
  assert.deepEqual(parseWorkRef('https://www.royalroad.com/fiction/145479/some-slug'), { source: 'royalroad', id: '145479' });
});
test('Scribble Hub series URL → scribblehub + id', () => {
  assert.deepEqual(parseWorkRef('https://www.scribblehub.com/series/123456/title/'), { source: 'scribblehub', id: '123456' });
});
test('host match is case-insensitive', () => {
  assert.deepEqual(parseWorkRef('HTTPS://ArchiveOfOurOwn.ORG/works/77'), { source: 'ao3', id: '77' });
});
test('unknown / non-work / empty URLs → null', () => {
  assert.equal(parseWorkRef('https://example.com/story/5'), null);
  assert.equal(parseWorkRef('https://archiveofourown.org/users/foo'), null);
  assert.equal(parseWorkRef(''), null);
  assert.equal(parseWorkRef(null), null);
  assert.equal(parseWorkRef(undefined), null);
});
