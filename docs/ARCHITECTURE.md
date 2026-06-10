# BookStash architecture

## One sentence
A React + Capacitor Android app whose entire library lives in an **on-device
database** — no backend, no accounts, no network except when *you* ask it to
fetch a link.

## Layers

```
  ┌──────────────────────────────────────────────┐
  │  UI (React)  — screens, reader, library       │
  ├──────────────────────────────────────────────┤
  │  Pure logic (src/lib) — filters, parsing,     │  ← unit-tested, no I/O
  │  url parsing, grouping, sorting               │
  ├──────────────────────────────────────────────┤
  │  Data layer — on-device SQLite (Phase 1)      │  ← the "backend", on the phone
  ├──────────────────────────────────────────────┤
  │  Capacitor plugins — Preferences, Filesystem, │
  │  SQLite, native HTTP (for link fetching)      │
  └──────────────────────────────────────────────┘
```

## Why local-first
- **Privacy:** what you read never leaves your device.
- **Zero hosting / cost:** there is no server to run or pay for.
- **Politeness at scale:** link fetching happens from each user's own device and
  IP at a gentle rate — load is naturally distributed, never a central scraper.
- **Legal footing:** it's a personal download/reader tool (like Calibre), not a
  service that redistributes others' content.

## Storage (Phase 1)
- SQLite via `@capacitor-community/sqlite` (with a web/wasm fallback for `dev`).
- Tables mirror the proven FicStash model: `works` (metadata) + `chapters`
  (per-chapter text), plus tracked groups and discovery prefs.
- Reading position & app settings: Capacitor `Preferences` (survives cold starts).

## Files vs links
- **Files** (EPUB/HTML/TXT): parsed *on the device* at import — self-contained,
  no network. Bulk = a multi-file picker looping the parser.
- **Links:** require fetching the work from its site. Two possible doers:
  (a) the phone fetches directly via Capacitor native HTTP (bypasses the WebView
  CORS wall) with parsers ported to JS, or (b) a future optional desktop helper.
  This is the highest-risk phase and gets a feasibility spike first (Phase 3).

## What is intentionally absent
- No Supabase / no central database.
- No login (the only "login"-ish thing is an *optional* future cloud-backup,
  which signs into the user's own Drive/Dropbox — never a BookStash account).
- No analytics / telemetry.
- No baked-in personal preferences (see `src/lib/filters.js`).

## Testing
- Pure logic in `src/lib/*` is covered by `node:test` (`npm test`), run in CI on
  every build. UI and device/storage paths are verified on-device per milestone.
