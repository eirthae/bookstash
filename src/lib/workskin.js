// Sanitize an AO3 "work skin" (the CSS that turns classed divs into chat bubbles,
// texting UIs, social-media cards) into something safe to apply in our reader.
//
// Three guarantees, in order of importance:
//   1. PROSE IS NEVER RESTYLED. We drop any rule whose selector targets a bare
//      element (p, div, body, a, …) or the #workskin root — those would override
//      the reader's own typography/line-height. Only rules that reference an
//      author CLASS or ID (i.e. a deliberately-styled block) survive. So your
//      font/size/leading/theme always win on ordinary paragraphs.
//   2. NO PHONE-HOME. url(http…) / protocol-relative url() and @import are
//      stripped (F-Droid requirement: the app makes zero network calls from CSS).
//      Only inline data: URIs are kept.
//   3. CAN'T ESCAPE THE READER. Every surviving selector is prefixed with a scope
//      class, and position:fixed/sticky + absurd z-index are removed so nothing
//      breaks out of the chapter flow.
//
// AO3 serves work-skin CSS already prefixed with `#workskin`; we strip that and
// re-scope to our own container. Pure + dependency-free → unit-testable, and runs
// identically in the app and in node tests.

function stripRemote(s) {
  return String(s)
    // url(http://…), url(https://…), url(//…) → none. Keep data: URIs.
    .replace(/url\(\s*(['"]?)\s*(?:https?:)?\/\/[^)]*\1\s*\)/gi, 'none')
    .replace(/@import[^;]+;?/gi, '');
}

function stripDangerousProps(body) {
  return String(body)
    .replace(/position\s*:\s*(fixed|sticky)\b[^;]*;?/gi, '')
    .replace(/z-index\s*:\s*-?\d{4,}\b[^;]*;?/gi, '');
}

// A selector is a "block" selector (safe to keep) if, after removing AO3's
// #workskin scoping prefix, it still references a class or id — i.e. it targets an
// element the author deliberately marked up, not bare prose.
function scopeSelector(sel, scope) {
  const bare = sel.replace(/#workskin\b/gi, '').trim();
  if (!bare) return null;            // a rule on the #workskin root → drop
  if (!/[.#]/.test(bare)) return null; // bare element (p, div, body…) → drop (protects prose)
  return `${scope} ${bare}`;
}

export function sanitizeWorkSkin(css, scope = '.ws-skin') {
  if (!css || typeof css !== 'string') return '';
  let s = css.replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments
  s = s.replace(/@import[^;]+;?/gi, '');        // drop @import outright

  // Keep @keyframes (typing-dot animations etc.) as-is, minus remote refs; pull
  // them out so the flat rule parser below doesn't choke on nested braces.
  const keyframes = [];
  s = s.replace(/@(?:-webkit-)?keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, (m) => {
    keyframes.push(stripRemote(m));
    return '';
  });
  // Drop every other @-rule (media/supports/font-face) for v1 — rare in chat skins
  // and not worth the nested-brace parsing risk.
  s = s.replace(/@[\w-]+[^{;]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

  const out = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(s))) {
    const selectors = m[1].split(',').map((x) => x.trim()).filter(Boolean);
    const kept = selectors.map((sel) => scopeSelector(sel, scope)).filter(Boolean);
    if (!kept.length) continue; // all selectors were prose/root → drop the rule
    const body = stripDangerousProps(stripRemote(m[2])).trim();
    if (!body) continue;
    out.push(`${kept.join(', ')} { ${body} }`);
  }
  return [...keyframes, ...out].join('\n');
}

// Does a chapter's HTML actually use any of this skin's classed blocks? Cheap
// gate so we only show the "Author styling" toggle when there's something to style.
export function chapterUsesSkin(html) {
  return /\bclass\s*=/.test(String(html || ''));
}

// Safety net so the reader NEVER hotlinks a remote image (F-Droid requirement +
// privacy). AO3 chapters hotlink images from third-party hosts; BookStash fetches
// on-device and does NOT pull those, so any remote <img> is swapped for a small
// inline placeholder carrying its alt text. Inline data: URIs (rare, embedded in
// the work itself) are kept. Idempotent and pure.
export function neutralizeRemoteImages(html) {
  if (!html || typeof html !== 'string') return html || '';
  if (!/<img/i.test(html)) return html;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = (tag.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    if (/^data:/i.test(src)) return tag; // inlined photo — keep
    const alt = ((tag.match(/\balt\s*=\s*["']([^"']*)["']/i) || [])[1] || 'image').replace(/[<>"]/g, '').trim() || 'image';
    return `<span class="fs-img-missing">📷 ${alt}</span>`;
  });
}
