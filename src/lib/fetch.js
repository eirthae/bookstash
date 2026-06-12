import { CapacitorHttp } from '@capacitor/core';

// Native HTTP fetch. On Android, CapacitorHttp makes the request from native
// code, bypassing the WebView's CORS wall — so we can fetch a story/article page
// the in-app `fetch()` could never reach. (In a plain browser/dev this falls
// back to fetch and will CORS-fail for cross-origin sites; that's expected — the
// link features only work on-device.)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

export async function fetchHtml(url) {
  const res = await CapacitorHttp.get({
    url,
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
// the PARSED data — CapacitorHttp often auto-parses JSON into an object, and
// even with responseType 'json' a string body is parsed here as a fallback. (The
// old path went through fetchHtml, which String()-ifies an object to
// "[object Object]" and breaks JSON.parse — that's what killed tag autocomplete.)
export async function fetchJson(url) {
  const res = await CapacitorHttp.get({
    url,
    headers: { 'User-Agent': UA, Accept: 'application/json, text/javascript, */*' },
    responseType: 'json',
  });
  let data = res && res.data;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = null; } }
  return { status: res ? res.status : 0, data };
}
