// Split an inline query string off a URL so it can be handed to CapacitorHttp's
// native `params` option instead of being left inline. On Android the patched
// CapacitorHttp interceptor mangles a literal "?" in the url string (it ends up
// percent-encoded onto the path → the server 404s); building the query natively
// from `params` avoids that entirely. Pure + dependency-free so it's unit-tested
// without the native bridge.
//
// Returns { base, params } where params is null when there's no query (so callers
// can omit the key and make a byte-for-byte plain request).
export function splitQuery(url) {
  const s = String(url);
  const qi = s.indexOf('?');
  if (qi < 0) return { base: s, params: null };
  const params = {};
  for (const [k, v] of new URLSearchParams(s.slice(qi + 1))) params[k] = v;
  return { base: s.slice(0, qi), params };
}
