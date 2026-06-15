import { CapacitorHttp } from '@capacitor/core';

// Native HTTP fetch. On Android, CapacitorHttp makes the request from native
// code, bypassing the WebView's CORS wall — so we can fetch a story/article page
// the in-app `fetch()` could never reach. (In a plain browser/dev this falls
// back to fetch and will CORS-fail for cross-origin sites; that's expected — the
// link features only work on-device.)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
// Honest identifier for AO3's lightweight JSON endpoints (autocomplete). A
// desktop-"Chrome" UA that never runs JS gets challenged by Cloudflare on these
// endpoints; a plain, honest client UA (exactly what FicStash's server proxy
// sends) is treated as a known API client and let through.
const API_UA = 'BookStash/1.0 (+https://github.com/eirthae/bookstash; personal reading app)';

export async function fetchHtml(url) {
  // CapacitorHttp (with `enabled: true`) percent-encodes a literal "?" in the url
  // string into "%3F", so the query becomes part of the path and AO3 (and others)
  // 404/redirect — this broke autocomplete, tag search, and series paging on
  // device. Split any inline query off and hand it to the native layer via
  // `params`, which builds "?k=v" correctly. One central fix covers every caller.
  const qi = String(url).indexOf('?');
  const base = qi >= 0 ? url.slice(0, qi) : url;
  const params = {};
  if (qi >= 0) for (const [k, v] of new URLSearchParams(url.slice(qi + 1))) params[k] = v;
  const res = await CapacitorHttp.get({
    url: base,
    ...(qi >= 0 ? { params } : {}),
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    responseType: 'text',
    // follow redirects (default), and don't throw on non-2xx — we inspect status
  });
  const data = res && res.data;
  return {
    status: res ? res.status : 0,
    url: (res && res.url) || url, // final URL after redirects (for restricted detection)
    html: typeof data === 'string' ? data : (data == null ? '' : String(data)),
  };
}

// Native HTTP fetch for a JSON endpoint (e.g. AO3's tag autocomplete). Returns
// the PARSED data. Structurally identical to fetchHtml (which reaches AO3 fine
// on-device) — same call shape, only the Accept header and parsing differ:
//   • responseType 'text' (NOT 'json'): AO3's autocomplete returns a top-level
//     JSON ARRAY, and the native 'json' parser expects an object — it can hand
//     back null for an array, silently emptying the list. Text mode reliably
//     returns the body, which we parse ourselves (CapacitorHttp may still have
//     auto-parsed it by content-type, so we accept an already-parsed value too).
//   • Query via `params`, NOT inline in the URL: CapacitorHttp percent-encodes a
//     literal "?" in the url string into "%3F", so AO3 sees the query as part of
//     the path (/autocomplete/tag%3Fterm=shane) → redirects to /404. Passing the
//     query through `params` lets the native layer build "?term=…" correctly.
//     (The `params` key is only added when provided, so plain calls are
//     byte-for-byte like fetchHtml.)
export async function fetchJson(url, params) {
  const res = await CapacitorHttp.get({
    url,
    ...(params ? { params } : {}),
    headers: { 'User-Agent': API_UA, Accept: 'application/json, text/javascript, */*' },
    responseType: 'text',
  });
  let data = res && res.data;
  const raw = typeof data === 'string' ? data : '';
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = null; } }
  return { status: res ? res.status : 0, data, url: (res && res.url) || url, raw };
}

// Native HTTP POST with a JSON body — used to call a Supabase edge function (the
// AO3 tag-autocomplete proxy) on-device. The query goes in the BODY, not the URL,
// so there's no "?" for CapacitorHttp to percent-encode and break.
export async function postJson(url, headers, body) {
  const res = await CapacitorHttp.post({
    url,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    data: body,
    responseType: 'text',
  });
  let data = res && res.data;
  const raw = typeof data === 'string' ? data : '';
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = null; } }
  return { status: res ? res.status : 0, data, raw };
}
