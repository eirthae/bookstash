import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeWorkSkin, neutralizeRemoteImages } from './workskin.js';

test('keeps author class blocks, scoped', () => {
  const out = sanitizeWorkSkin('#workskin .text-message { color: blue; }', '.ws');
  assert.match(out, /\.ws\s+\.text-message\s*\{[^}]*color:\s*blue/);
});

test('drops bare-element rules so prose typography is never overridden', () => {
  const out = sanitizeWorkSkin('#workskin p { line-height: 3; font-family: Comic Sans; }', '.ws');
  assert.equal(out.trim(), ''); // a rule on bare <p> must not survive
});

test('drops a rule on the #workskin root itself', () => {
  const out = sanitizeWorkSkin('#workskin { background: black; color: white; }', '.ws');
  assert.equal(out.trim(), '');
});

test('strips remote url() and @import (no phone-home)', () => {
  const out = sanitizeWorkSkin('@import url(http://evil.com/x.css); #workskin .a { background: url("https://x.com/y.png"); }', '.ws');
  assert.ok(!/@import/i.test(out));
  assert.ok(!/https?:/i.test(out));
  assert.match(out, /\.ws\s+\.a/);
});

test('keeps inline data: URIs', () => {
  const out = sanitizeWorkSkin('#workskin .a { background: url(data:image/png;base64,AAAA); }', '.ws');
  assert.match(out, /data:image\/png/);
});

test('strips position:fixed/sticky so blocks cannot escape the flow', () => {
  const out = sanitizeWorkSkin('#workskin .a { position: fixed; color: red; }', '.ws');
  assert.ok(!/position\s*:\s*fixed/i.test(out));
  assert.match(out, /color:\s*red/);
});

test('a class rule with a nested bare element is kept (block-internal, not prose)', () => {
  const out = sanitizeWorkSkin('#workskin .chat p { margin: 0; }', '.ws');
  assert.match(out, /\.ws\s+\.chat p/);
});

test('handles unprefixed skins too', () => {
  const out = sanitizeWorkSkin('.bubble { border-radius: 12px; } span { color: red; }', '.ws');
  assert.match(out, /\.ws\s+\.bubble/);
  assert.ok(!/\bspan\b/.test(out)); // bare span dropped
});

test('empty / junk input is safe', () => {
  assert.equal(sanitizeWorkSkin(''), '');
  assert.equal(sanitizeWorkSkin(null), '');
  assert.equal(sanitizeWorkSkin('not css at all'), '');
});

test('neutralizeRemoteImages: remote <img> becomes a placeholder (no hotlink)', () => {
  const out = neutralizeRemoteImages('<p>x</p><img src="https://i.imgur.com/abc.jpg" alt="a selfie">');
  assert.ok(!/<img/i.test(out));
  assert.ok(!/imgur/i.test(out));
  assert.match(out, /fs-img-missing/);
  assert.match(out, /a selfie/);
});

test('neutralizeRemoteImages: keeps inlined data: images', () => {
  const html = '<img src="data:image/png;base64,AAAA" alt="post">';
  assert.equal(neutralizeRemoteImages(html), html);
});

test('neutralizeRemoteImages: protocol-relative + no-alt handled', () => {
  const out = neutralizeRemoteImages('<img src="//cdn.x/y.png">');
  assert.ok(!/<img/i.test(out));
  assert.match(out, /📷 image/);
});

test('neutralizeRemoteImages: no images → unchanged', () => {
  assert.equal(neutralizeRemoteImages('<p>just text</p>'), '<p>just text</p>');
});
