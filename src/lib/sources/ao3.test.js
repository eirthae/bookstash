import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

// AO3's parseWork relies on the WebView's DOMParser; provide one for node.
before(() => { globalThis.DOMParser = DOMParser; });

const {
  isAo3Url, workIdFromUrl, fullWorkUrl, parseChapterStat, parseWork,
} = await import('./ao3.js');

// A faithful slice of AO3's full-work markup: two chapters, in a series.
const MULTI = `
<div id="main">
  <dl class="work meta group">
    <dd class="fandom tags"><ul class="commas"><li><a class="tag">Heated Rivalry (TV)</a></li></ul></dd>
    <dd class="relationship tags"><ul class="commas"><li><a class="tag">Shane Hollander/Ilya Rozanov</a></li></ul></dd>
    <dd class="character tags"><ul class="commas"><li><a class="tag">Shane Hollander</a></li><li><a class="tag">Ilya Rozanov</a></li></ul></dd>
    <dd class="freeform tags"><ul class="commas"><li><a class="tag">Fluff</a></li><li><a class="tag">Hockey</a></li></ul></dd>
    <dd class="language" lang="en">English</dd>
    <dd class="series"><span class="series"><span class="position">Part <a href="/series/12345">2</a> of the <a href="/series/12345">Game Changers Series</a></span></span></dd>
    <dd class="stats"><dl class="stats"><dd class="words">2,652</dd><dd class="chapters">2/2</dd></dl></dd>
  </dl>
  <div id="workskin">
    <div class="preface group">
      <h2 class="title heading">I choose him</h2>
      <h3 class="byline heading">by <a rel="author" href="/users/pezpezpez/pseuds/pezpezpez">pezpezpez</a></h3>
      <div class="summary module"><h3 class="heading">Summary:</h3><blockquote class="userstuff"><p>Shane and Ilya on a plane.</p></blockquote></div>
    </div>
    <div id="chapters" role="article">
      <div class="chapter" id="chapter-1">
        <div class="chapter preface group"><h3 class="title">Chapter 1: <a href="/works/1/chapters/1">January 2021</a></h3></div>
        <div class="userstuff module" role="article" id="chapter-1-content">
          <h3 class="landmark heading">Chapter Text</h3>
          <p>Shane sat on the plane reading a book.</p><p>Ilya groaned.</p>
        </div>
      </div>
      <div class="chapter" id="chapter-2">
        <div class="chapter preface group"><h3 class="title">Chapter 2: <a href="/works/1/chapters/2">February 2021</a></h3></div>
        <div class="userstuff module" role="article" id="chapter-2-content">
          <h3 class="landmark heading">Chapter Text</h3>
          <p>The second chapter body.</p>
        </div>
      </div>
    </div>
  </div>
</div>`;

const ONESHOT = `
<div id="main">
  <dl class="work meta group">
    <dd class="fandom tags"><ul class="commas"><li><a class="tag">Original Work</a></li></ul></dd>
    <dd class="language">English</dd>
    <dd class="stats"><dl class="stats"><dd class="words">120</dd><dd class="chapters">1/1</dd></dl></dd>
  </dl>
  <div id="workskin">
    <div class="preface group"><h2 class="title heading">A Short One</h2><h3 class="byline heading">by <a rel="author">writer</a></h3></div>
    <div id="chapters" role="article"><div class="userstuff" role="article"><h3 class="landmark heading">Chapter Text</h3><p>Just one scene here.</p></div></div>
  </div>
</div>`;

test('url helpers', () => {
  assert.ok(isAo3Url('https://archiveofourown.org/works/123'));
  assert.ok(!isAo3Url('https://example.com/works/123'));
  assert.equal(workIdFromUrl('https://archiveofourown.org/collections/x/works/987/chapters/5'), '987');
  assert.match(fullWorkUrl('5'), /works\/5\?view_full_work=true&view_adult=true/);
});

test('parseChapterStat', () => {
  assert.deepEqual(parseChapterStat('2/2'), { chapters: 2, total: 2, status: 'complete' });
  assert.deepEqual(parseChapterStat('3/12'), { chapters: 3, total: 12, status: 'ongoing' });
  assert.deepEqual(parseChapterStat('5/?'), { chapters: 5, total: null, status: 'ongoing' });
});

test('parseWork pulls clean metadata (not the raw page title)', () => {
  const w = parseWork(MULTI, '1');
  assert.equal(w.title, 'I choose him');           // not "I choose him - pezpezpez - …"
  assert.equal(w.author, 'pezpezpez');             // not "Organization for Transformative Works"
  assert.equal(w.fandom, 'Heated Rivalry (TV)');
  assert.equal(w.summary, 'Shane and Ilya on a plane.');
  assert.equal(w.status, 'complete');
  assert.equal(w.words, 2652);
  assert.equal(w.language, 'English');
});

test('parseWork captures relationship/character/freeform tags', () => {
  const w = parseWork(MULTI, '1');
  const byKind = (k) => w.tags.filter((t) => t.k === k).map((t) => t.t);
  assert.deepEqual(byKind('relationship'), ['Shane Hollander/Ilya Rozanov']);
  assert.deepEqual(byKind('character'), ['Shane Hollander', 'Ilya Rozanov']);
  assert.deepEqual(byKind('freeform'), ['Fluff', 'Hockey']);
});

test('parseWork reads the series NAME (not the part-number link)', () => {
  const w = parseWork(MULTI, '1');
  assert.equal(w.series, 'Game Changers Series');
  assert.equal(w.ao3SeriesId, '12345');
  assert.equal(w.seriesIndex, 2);
});

test('parseWork extracts every chapter, landmark stripped', () => {
  const w = parseWork(MULTI, '1');
  assert.equal(w.chapters, 2);
  assert.equal(w.chaptersData.length, 2);
  assert.equal(w.chaptersData[0].title, 'Chapter 1: January 2021');
  assert.match(w.chaptersData[0].content, /Shane sat on the plane/);
  assert.ok(!/Chapter Text/.test(w.chaptersData[0].content)); // landmark removed
  assert.match(w.chaptersData[1].content, /second chapter body/);
});

test('parseWork handles a oneshot (single userstuff, no chapter wrapper)', () => {
  const w = parseWork(ONESHOT, '9');
  assert.equal(w.title, 'A Short One');
  assert.equal(w.chapters, 1);
  assert.match(w.chaptersData[0].content, /Just one scene/);
});

test('parseWork flags a members-only (restricted) page', () => {
  const html = '<div id="main"><form action="/users/login?restricted=true"></form></div>';
  assert.deepEqual(parseWork(html, '7'), { restricted: true });
});

// --- tag search parsing ----------------------------------------------------
const { parseSearchResults, searchUrl } = await import('./ao3.js');

const SEARCH = `
<ol class="work index group">
  <li id="work_555" class="work blurb group" role="article">
    <div class="header module">
      <h4 class="heading"><a href="/works/555">Padawan Days</a> by <a rel="author" href="/users/x">starwriter</a></h4>
      <h5 class="fandoms heading"><a class="tag" href="/tags/SW">Star Wars</a></h5>
    </div>
    <ul class="tags commas">
      <li class="relationships"><a class="tag">Ahsoka &amp; Obi-Wan</a></li>
      <li class="characters"><a class="tag">Ahsoka Tano</a></li>
      <li class="freeforms"><a class="tag">Mentor</a></li>
    </ul>
    <blockquote class="userstuff summary">A training fic.</blockquote>
    <dl class="stats"><dd class="language">English</dd><dd class="words">3,400</dd><dd class="chapters">5/?</dd></dl>
  </li>
</ol>`;

test('searchUrl ANDs tags + sets sort', () => {
  const u = searchUrl(['ahsoka is obi-wan\'s padawan', 'fluff'], ['vampires']);
  assert.match(u, /other_tag_names/);
  assert.match(u, /excluded_tag_names/);
  assert.match(u, /sort_column.*created_at/);
});

test('parseSearchResults parses a work blurb', () => {
  const r = parseSearchResults(SEARCH);
  assert.equal(r.length, 1);
  assert.equal(r[0].sourceId, '555');
  assert.equal(r[0].title, 'Padawan Days');
  assert.equal(r[0].author, 'starwriter');
  assert.equal(r[0].fandom, 'Star Wars');
  assert.equal(r[0].summary, 'A training fic.');
  assert.equal(r[0].words, 3400);
  assert.equal(r[0].status, 'ongoing');
  assert.deepEqual(r[0].tags.filter((t) => t.k === 'relationship').map((t) => t.t), ['Ahsoka & Obi-Wan']);
});
