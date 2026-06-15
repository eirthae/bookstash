import { postJson } from './fetch.js';

// BookStash is backend-free: everything (library, fetching, sync) is on-device.
// `hasSupabase` stays false so the FicStash-ported screens use the on-device
// path with no demo/sample fallback. Do NOT flip this — it would switch screens
// into a "connected backend" mode BookStash doesn't have.
export const hasSupabase = false;

// OPTIONAL AO3 tag-autocomplete proxy. AO3's autocomplete is a JSON endpoint that
// CapacitorHttp mangles on-device (it percent-encodes the "?"), so the live tag
// list comes back empty. If a Supabase project is configured at build time, we
// route ONLY the autocomplete through its `tag-autocomplete` edge function (the
// same stateless AO3 proxy FicStash uses) — no user data passes through it. Unset
// → autocomplete falls back to the (best-effort) on-device path.
const SUPA_URL = ((import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '').replace(/\/+$/, '');
const SUPA_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
export const hasTagProxy = !!(SUPA_URL && SUPA_KEY);

// Live AO3 tag names via the edge function, or null if not configured / it failed
// (so the caller can fall back). The term goes in the POST body — no query string
// for CapacitorHttp to break.
export async function autocompleteViaProxy(term) {
  if (!hasTagProxy) return null; // not configured at build → caller uses on-device
  const q = String(term || '').trim();
  if (q.length < 2) return [];
  // On failure, THROW with a short reason so the picker's error line shows what
  // the proxy did (e.g. "proxy 401", "proxy 404"), instead of silently falling
  // back and looking like the proxy was never configured.
  const r = await postJson(
    `${SUPA_URL}/functions/v1/tag-autocomplete`,
    { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    { term: q },
  );
  if (!r || r.status < 200 || r.status >= 300) {
    throw new Error(`proxy ${r ? r.status : '?'} ${(r && r.raw ? r.raw : '').replace(/\s+/g, ' ').slice(0, 40)}`);
  }
  const tags = r.data && Array.isArray(r.data.tags) ? r.data.tags : null;
  if (!tags) throw new Error(`proxy non-JSON ${(r.raw || '').replace(/\s+/g, ' ').slice(0, 40)}`);
  return tags.map((t) => (t && (t.name || t.id)) || '').filter(Boolean);
}
