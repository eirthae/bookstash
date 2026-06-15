import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fandomName, workTagSet, shelfOf, sortWorks, orderGroups, groupFics,
  filterWorks, savedTypeOf, statusMatches, seriesWorksFrom, savedWorksFrom,
  passesGlobalPrefs, discoveryShelfForSource, excludedForShelf,
} from './shelving.js';

// ---- fandomName -----------------------------------------------------------
test('fandomName strips the author suffix and defaults to Other', () => {
  assert.equal(fandomName({ fandom: 'Heated Rivalry – Rachel Reid' }), 'Heated Rivalry');
  assert.equal(fandomName({ fandom: 'Check Please - Ngozi' }), 'Check Please');
  assert.equal(fandomName({ fandom: '' }), 'Other');
  assert.equal(fandomName({}), 'Other');
});

// ---- workTagSet -----------------------------------------------------------
test('workTagSet lowercases tags from {t}/{name}/string shapes', () => {
  assert.deepEqual(workTagSet({ tags: [{ t: 'Enemies to Lovers' }, { name: 'Fluff' }, 'Angst'] }),
    ['enemies to lovers', 'fluff', 'angst']);
  assert.deepEqual(workTagSet({ tags: [{ t: '' }, null] }), []);
  assert.deepEqual(workTagSet({}), []);
});

// ---- shelfOf --------------------------------------------------------------
test('shelfOf routes uploads→books, ao3→fics, else→stories', () => {
  assert.equal(shelfOf({ source: 'upload' }), 'books');
  assert.equal(shelfOf({ origin: 'upload', source: 'ao3' }), 'books'); // origin wins
  assert.equal(shelfOf({ source: 'ao3' }), 'fics');
  assert.equal(shelfOf({ source: 'royalroad' }), 'stories');
  assert.equal(shelfOf({ source: 'link' }), 'stories');
  assert.equal(shelfOf(null), 'fics');
});

// ---- sortWorks ------------------------------------------------------------
test('sortWorks orders by field and never mutates input', () => {
  const list = [
    { id: 'a', title: 'B', createdAt: '2026-01-01', sourceUpdated: '2026-03-01' },
    { id: 'b', title: 'A', createdAt: '2026-02-01', sourceUpdated: '2026-01-01' },
  ];
  const snapshot = JSON.stringify(list);
  assert.deepEqual(sortWorks(list, 'added').map((w) => w.id), ['b', 'a']);   // newest createdAt
  assert.deepEqual(sortWorks(list, 'updated').map((w) => w.id), ['a', 'b']); // newest sourceUpdated
  assert.deepEqual(sortWorks(list, 'title').map((w) => w.id), ['b', 'a']);   // A before B
  assert.deepEqual(sortWorks(list, 'read', { a: '2026-05', b: '2026-04' }).map((w) => w.id), ['a', 'b']);
  assert.deepEqual(sortWorks(list, 'default').map((w) => w.id), ['a', 'b']); // unchanged order
  assert.equal(JSON.stringify(list), snapshot); // not mutated
});

// ---- orderGroups ----------------------------------------------------------
test('orderGroups: default by size, title A–Z', () => {
  const groups = () => [
    { name: 'Zeta', items: [1] },
    { name: 'Alpha', items: [1, 2, 3] },
  ];
  assert.deepEqual(orderGroups(groups(), 'default').map((g) => g.name), ['Alpha', 'Zeta']); // bigger first
  assert.deepEqual(orderGroups(groups(), 'title').map((g) => g.name), ['Alpha', 'Zeta']);   // A–Z
});

// ---- groupFics ------------------------------------------------------------
test('groupFics keeps fandom separation and collapses multi-work series', () => {
  const works = [
    { id: 'w1', fandom: 'HP', ao3SeriesId: 's1', ao3SeriesName: 'Saga', ao3SeriesIndex: 2, title: 'Two' },
    { id: 'w2', fandom: 'HP', ao3SeriesId: 's1', ao3SeriesName: 'Saga', ao3SeriesIndex: 1, title: 'One' },
    { id: 'w3', fandom: 'HP', title: 'Loose HP' },
    { id: 'w4', fandom: 'Naruto', ao3SeriesId: 's2', ao3SeriesName: 'Solo', ao3SeriesIndex: 1, title: 'Only' },
  ];
  const groups = groupFics(works, 'default');
  const hp = groups.find((g) => g.name === 'HP');
  const naruto = groups.find((g) => g.name === 'Naruto');
  assert.ok(hp && naruto, 'both fandoms present (separation kept)');
  // s1 has 2 works → one series card, ordered by part #
  assert.equal(hp.series.length, 1);
  assert.equal(hp.series[0].seriesId, 's1');
  assert.deepEqual(hp.series[0].items.map((w) => w.id), ['w2', 'w1']); // part 1 then 2
  assert.deepEqual(hp.loose.map((w) => w.id), ['w3']);                 // loose work stays loose
  // s2 is a single-work series → NOT a series card, stays loose
  assert.equal(naruto.series.length, 0);
  assert.deepEqual(naruto.loose.map((w) => w.id), ['w4']);
});

// ---- filterWorks ----------------------------------------------------------
test('filterWorks: search + include(ALL) + exclude(NONE)', () => {
  const works = [
    { id: 'a', title: 'Coffee Shop AU', author: 'X', tags: [{ t: 'Fluff' }, { t: 'Modern AU' }] },
    { id: 'b', title: 'War Drama', author: 'Y', tags: [{ t: 'Angst' }, { t: 'Modern AU' }] },
    { id: 'c', title: 'Fluffy War', author: 'Z', tags: [{ t: 'Fluff' }, { t: 'Angst' }] },
  ];
  assert.deepEqual(filterWorks(works, { query: 'coffee' }).map((w) => w.id), ['a']);
  assert.deepEqual(filterWorks(works, { query: 'fluff' }).map((w) => w.id).sort(), ['a', 'c']); // title OR tag
  assert.deepEqual(filterWorks(works, { include: ['fluff', 'modern au'] }).map((w) => w.id), ['a']); // AND
  assert.deepEqual(filterWorks(works, { include: ['modern au'], exclude: ['angst'] }).map((w) => w.id), ['a']);
  assert.equal(filterWorks(works, {}).length, 3); // no filter → all
});

// ---- savedTypeOf ----------------------------------------------------------
test('savedTypeOf buckets by source/origin', () => {
  assert.equal(savedTypeOf({ source: 'ao3' }), 'ao3');
  assert.equal(savedTypeOf({ source: 'royalroad' }), 'stories');
  assert.equal(savedTypeOf({ source: 'scribblehub' }), 'stories');
  assert.equal(savedTypeOf({ source: 'upload' }), 'books');
  assert.equal(savedTypeOf({ origin: 'upload', source: 'ao3' }), 'books');
});

// ---- passesGlobalPrefs (global exclude / language filter) -----------------
test('passesGlobalPrefs drops works carrying a globally-excluded tag', () => {
  const excludedTags = [{ name: 'Omegaverse' }, { name: 'Character Death' }];
  const clean = { tags: [{ t: 'Fluff', k: 'freeform' }, { t: 'Modern AU', k: 'freeform' }] };
  const dirty = { tags: [{ t: 'Fluff', k: 'freeform' }, { t: 'Omegaverse', k: 'freeform' }] };
  assert.equal(passesGlobalPrefs(clean, { excludedTags }), true);
  assert.equal(passesGlobalPrefs(dirty, { excludedTags }), false); // excluded tag → dropped
});

test('passesGlobalPrefs exclude is case-insensitive and shape-agnostic', () => {
  const excludedTags = ['omegaverse']; // plain string pref
  assert.equal(passesGlobalPrefs({ tags: [{ t: 'OMEGAVERSE' }] }, { excludedTags }), false);
  assert.equal(passesGlobalPrefs({ tags: [{ name: 'Omegaverse' }] }, { excludedTags }), false);
  assert.equal(passesGlobalPrefs({ tags: [] }, { excludedTags }), true);
  assert.equal(passesGlobalPrefs({ tags: [{ t: 'Fluff' }] }, {}), true); // no prefs → keep
});

test('passesGlobalPrefs language allowlist applies to tag groups only', () => {
  const languages = [{ native: 'English', english: 'English' }];
  const en = { language: 'English', tags: [] };
  const es = { language: 'Español', tags: [] };
  assert.equal(passesGlobalPrefs(en, { languages }, false), true);
  assert.equal(passesGlobalPrefs(es, { languages }, false), false); // wrong language → dropped
  assert.equal(passesGlobalPrefs(es, { languages }, true), true);   // language group → not filtered
});

// ---- per-shelf discovery excludes ----------------------------------------
test('discoveryShelfForSource maps a group source to its Discovery shelf', () => {
  assert.equal(discoveryShelfForSource('ao3'), 'ao3');
  assert.equal(discoveryShelfForSource('royalroad'), 'sites');
  assert.equal(discoveryShelfForSource('scribblehub'), 'sites');
  assert.equal(discoveryShelfForSource('books'), 'books');
});

test('excludedForShelf reads the per-shelf object', () => {
  const prefs = { excludedTags: { ao3: [{ name: 'Explicit' }], sites: [{ name: 'litrpg' }], books: [] } };
  assert.deepEqual(excludedForShelf(prefs, 'ao3'), [{ name: 'Explicit' }]);
  assert.deepEqual(excludedForShelf(prefs, 'sites'), [{ name: 'litrpg' }]);
  assert.deepEqual(excludedForShelf(prefs, 'books'), []);
});

test('excludedForShelf treats a legacy flat array as AO3-only', () => {
  const prefs = { excludedTags: [{ name: 'Explicit' }] };
  assert.deepEqual(excludedForShelf(prefs, 'ao3'), [{ name: 'Explicit' }]);
  assert.deepEqual(excludedForShelf(prefs, 'sites'), []);
  assert.deepEqual(excludedForShelf(prefs, 'books'), []);
});

test('per-shelf exclude: litrpg hidden on Stories, kept on AO3', () => {
  const prefs = { excludedTags: { ao3: [], sites: [{ name: 'litrpg' }], books: [] } };
  const work = { tags: [{ name: 'litrpg' }] };
  assert.equal(passesGlobalPrefs(work, { excludedTags: excludedForShelf(prefs, 'sites') }), false);
  assert.equal(passesGlobalPrefs(work, { excludedTags: excludedForShelf(prefs, 'ao3') }), true);
});

// ---- statusMatches --------------------------------------------------------
test('statusMatches honours all/ongoing/complete', () => {
  assert.equal(statusMatches({ status: 'complete' }, 'all'), true);
  assert.equal(statusMatches({ status: 'ongoing' }, 'all'), true);
  assert.equal(statusMatches({ status: 'complete' }, 'complete'), true);
  assert.equal(statusMatches({ status: 'complete' }, 'ongoing'), false);
  assert.equal(statusMatches({ status: 'ongoing' }, 'ongoing'), true);
  assert.equal(statusMatches({ status: 'ongoing' }, 'complete'), false);
});

// ---- seriesWorksFrom ------------------------------------------------------
test('seriesWorksFrom filters by series id and orders by part', () => {
  const works = [
    { id: 'a', ao3SeriesId: 's1', ao3SeriesIndex: 3, title: 'C' },
    { id: 'b', ao3SeriesId: 's1', ao3SeriesIndex: 1, title: 'A' },
    { id: 'c', ao3SeriesId: 's2', ao3SeriesIndex: 1, title: 'Other' },
    { id: 'd', ao3SeriesId: 's1', ao3SeriesIndex: 2, title: 'B' },
  ];
  assert.deepEqual(seriesWorksFrom(works, 's1').map((w) => w.id), ['b', 'd', 'a']);
  assert.deepEqual(seriesWorksFrom(works, 's2').map((w) => w.id), ['c']);
  assert.deepEqual(seriesWorksFrom(works, ''), []);
});

// ---- savedWorksFrom -------------------------------------------------------
test('savedWorksFrom keeps origin=tag, newest first', () => {
  const works = [
    { id: 'a', origin: 'tag', createdAt: '2026-01-01' },
    { id: 'b', origin: 'link', createdAt: '2026-02-01' },
    { id: 'c', origin: 'tag', createdAt: '2026-03-01' },
  ];
  assert.deepEqual(savedWorksFrom(works).map((w) => w.id), ['c', 'a']);
});
