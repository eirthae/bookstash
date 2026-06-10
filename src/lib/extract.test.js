import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords, hostName } from './extract.js';

test('countWords strips tags/entities', () => {
  assert.equal(countWords('<p>hello world</p>'), 2);
  assert.equal(countWords('<div><p>one two</p><p>three</p></div>'), 3);
  assert.equal(countWords('&amp; &nbsp;'), 0);
  assert.equal(countWords(''), 0);
});

test('hostName strips www and scheme', () => {
  assert.equal(hostName('https://www.archiveofourown.org/works/1'), 'archiveofourown.org');
  assert.equal(hostName('https://royalroad.com/fiction/2'), 'royalroad.com');
  assert.equal(hostName('not a url'), '');
});
