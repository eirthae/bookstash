// AO3 tag autocomplete proxy (BookStash).
//
// BookStash is otherwise fully on-device, but AO3's autocomplete is a JSON
// endpoint the Android WebView's native HTTP layer mangles (it percent-encodes
// the "?"), so the live tag list comes back empty on-device. This tiny Edge
// Function relays the typed term to AO3's tag autocomplete server-side and
// returns canonical tag names — the ONLY thing routed off-device, and no user
// data passes through it.
//
// Auth: callers present the project's anon key (default JWT verification). Run
// this in a project DEDICATED to BookStash so its traffic/quota stays isolated.

const AO3_AUTOCOMPLETE = "https://archiveofourown.org/autocomplete/tag";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  let term = (url.searchParams.get("term") || "").trim();
  if (!term && req.method === "POST") {
    try {
      const body = await req.json();
      term = (body?.term || "").toString().trim();
    } catch (_e) { /* ignore bad bodies */ }
  }
  if (term.length < 2) return json({ tags: [] });

  const target = `${AO3_AUTOCOMPLETE}?term=${encodeURIComponent(term)}`;
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "BookStash/1.0 (personal use)" },
    });
    if (!res.ok) return json({ tags: [], error: `AO3 ${res.status}` }, 502);

    // AO3 returns [{ id, name }, ...]; normalise to a small, stable shape.
    const raw = await res.json();
    const tags = (Array.isArray(raw) ? raw : [])
      .map((t) => ({
        name: (t?.name ?? t?.id ?? "").toString(),
        id: (t?.id ?? "").toString(),
      }))
      .filter((t) => t.name.length > 0)
      .slice(0, 15);
    return json({ tags });
  } catch (e) {
    return json({ tags: [], error: String(e) }, 502);
  }
});
