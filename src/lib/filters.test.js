import test from 'node:test';
import assert from 'node:assert/strict';
import { passesFilters, applyFilters } from './filters.js';

const work = (over = {}) => ({ language: 'English', tags: [{ t: 'Fluff' }], words: 50000, status: 'complete', ...over });

test('empty prefs let everything through (taste-blind default)', () => {
  assert.equal(passesFilters(work(), {}), true);
  assert.equal(passesFilters(work({ language: '日本語', words: 10, status: 'ongoing' }), {}), true);
  assert.equal(passesFilters({}, {}), true);
});

test('language include keeps matches, drops others, never drops unknown', () => {
  const prefs = { languages: [{ native: 'English', english: 'English', code: 'en' }] };
  assert.equal(passesFilters(work({ language: 'English' }), prefs), true);
  assert.equal(passesFilters(work({ language: '日本語' }), prefs), false);
  assert.equal(passesFilters(work({ language: '' }), prefs), true);        // unknown → keep
  assert.equal(passesFilters(work({ language: 'Unknown' }), prefs), true); // unknown → keep
});

test('language include matches the native spelling too', () => {
  const prefs = { languages: [{ native: '日本語', english: 'Japanese', code: 'ja' }] };
  assert.equal(passesFilters(work({ language: '日本語' }), prefs), true);
  assert.equal(passesFilters(work({ language: 'English' }), prefs), false);
});

test('excluded tags drop works carrying them (incl. ratings as tags)', () => {
  const prefs = { excludedTags: [{ name: 'Explicit' }] };
  assert.equal(passesFilters(work({ tags: [{ t: 'Fluff' }, { t: 'Explicit' }] }), prefs), false);
  assert.equal(passesFilters(work({ tags: [{ t: 'Fluff' }] }), prefs), true);
  // tolerate {name} and bare-string tag shapes
  assert.equal(passesFilters(work({ tags: [{ name: 'explicit' }] }), prefs), false);
  assert.equal(passesFilters(work({ tags: ['Explicit'] }), prefs), false);
});

test('length window (unknown length never drops)', () => {
  assert.equal(passesFilters(work({ words: 40000 }), { minWords: 50000 }), false);
  assert.equal(passesFilters(work({ words: 60000 }), { minWords: 50000 }), true);
  assert.equal(passesFilters(work({ words: 200000 }), { maxWords: 100000 }), false);
  assert.equal(passesFilters(work({ words: 0 }), { minWords: 50000 }), true); // unknown → keep
});

test('completion status filter', () => {
  assert.equal(passesFilters(work({ status: 'ongoing' }), { status: 'complete' }), false);
  assert.equal(passesFilters(work({ status: 'complete' }), { status: 'complete' }), true);
  assert.equal(passesFilters(work({ status: 'complete' }), { status: 'ongoing' }), false);
  assert.equal(passesFilters(work({ status: 'ongoing' }), { status: 'ongoing' }), true);
});

test('combined filters AND together', () => {
  const prefs = { languages: [{ native: 'English' }], excludedTags: [{ name: 'Explicit' }], minWords: 20000, status: 'complete' };
  assert.equal(passesFilters(work(), prefs), true);
  assert.equal(passesFilters(work({ tags: [{ t: 'Explicit' }] }), prefs), false);
  assert.equal(passesFilters(work({ words: 100 }), prefs), false);
});

test('applyFilters preserves order and filters the list', () => {
  const list = [work({ language: 'English' }), work({ language: '日本語' }), work({ language: 'English', words: 10 })];
  const out = applyFilters(list, { languages: [{ native: 'English' }] });
  assert.equal(out.length, 2);
  assert.equal(out[0].language, 'English');
});
