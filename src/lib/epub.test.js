import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords, titleFromFilename, resolvePath, txtToHtml, escapeHtml, isSupportedUpload } from './epub.js';

test('countWords strips tags + entities and counts words', () => {
  assert.equal(countWords('<p>hello world</p>'), 2);
  assert.equal(countWords('<p>one</p><p>two three</p>'), 3);
  assert.equal(countWords('&amp; &lt; nbsp'), 1); // entities are not words
  assert.equal(countWords(''), 0);
});

test('titleFromFilename strips extension and tidies separators', () => {
  assert.equal(titleFromFilename('the_great_book.epub'), 'the great book');
  assert.equal(titleFromFilename('My-Story.txt'), 'My Story');
  assert.equal(titleFromFilename(''), 'Untitled');
  assert.equal(titleFromFilename('plain'), 'plain');
});

test('resolvePath resolves hrefs relative to the OPF dir', () => {
  assert.equal(resolvePath('OEBPS', 'text/c1.xhtml'), 'OEBPS/text/c1.xhtml');
  assert.equal(resolvePath('OEBPS/text', '../images/x.png'), 'OEBPS/images/x.png');
  assert.equal(resolvePath('OEBPS', './c1.xhtml#frag'), 'OEBPS/c1.xhtml');
  assert.equal(resolvePath('', 'c1.xhtml'), 'c1.xhtml');
});

test('txtToHtml makes paragraphs from blank-line blocks and escapes', () => {
  assert.equal(txtToHtml('a\n\nb'), '<p>a</p>\n<p>b</p>');
  assert.equal(txtToHtml('line1\nline2'), '<p>line1<br>line2</p>');
  assert.equal(txtToHtml('<script>'), '<p>&lt;script&gt;</p>');
  assert.equal(txtToHtml('   '), '');
});

test('escapeHtml escapes the dangerous trio', () => {
  assert.equal(escapeHtml('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
});

test('isSupportedUpload accepts epub/html/htm/txt only', () => {
  for (const n of ['a.epub', 'a.html', 'a.htm', 'a.txt', 'A.EPUB']) {
    assert.equal(isSupportedUpload({ name: n }), true, n);
  }
  for (const n of ['a.pdf', 'a.mobi', 'a', 'a.docx']) {
    assert.equal(isSupportedUpload({ name: n }), false, n);
  }
  assert.equal(isSupportedUpload(null), false);
});
