import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal in-memory localStorage so reading.js runs under `node --test`.
globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

const { getReadingPos, getChapterPos, saveReadingPos } = await import('./reading.js');

beforeEach(() => globalThis.localStorage.clear());

test('saveReadingPos / getChapterPos round-trips per chapter', () => {
  saveReadingPos('b1', { chapter: 2, pct: 0.4 });
  saveReadingPos('b1', { chapter: 5, pct: 0.9 });
  assert.equal(getChapterPos('b1', 2), 0.4);
  assert.equal(getChapterPos('b1', 5), 0.9);
  assert.equal(getChapterPos('b1', 3), 0);
});

test('reading a later chapter does not lose an earlier chapter position', () => {
  saveReadingPos('b1', { chapter: 2, pct: 0.95 });
  saveReadingPos('b1', { chapter: 3, pct: 0.1 });
  assert.equal(getChapterPos('b1', 2), 0.95);
});

test('getReadingPos resumes at the last chapter touched + its scroll', () => {
  saveReadingPos('b1', { chapter: 2, pct: 0.5 });
  saveReadingPos('b1', { chapter: 7, pct: 0.3 });
  assert.deepEqual(getReadingPos('b1'), { chapter: 7, pct: 0.3 });
});

test('migrates the legacy { chapter, pct } shape on read', () => {
  globalThis.localStorage.setItem('bs-readpos', JSON.stringify({ b9: { chapter: 4, pct: 0.6 } }));
  assert.deepEqual(getReadingPos('b9'), { chapter: 4, pct: 0.6 });
  assert.equal(getChapterPos('b9', 4), 0.6);
});

test('unknown book resumes to null', () => {
  assert.equal(getReadingPos('nope'), null);
});
