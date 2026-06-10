# BookStash — build roadmap

BookStash is the open-source, **local-first** evolution of a personal reader.
The library lives entirely on the device — no accounts, no servers, no tracking.
We build in documented, unit-tested phases and ship an APK at each milestone for
real-device testing.

## Design decisions (agreed)

- **Local-first.** On-device database (SQLite). The app does its own work; there
  is no backend. The developer hosts nothing.
- **Taste-blind.** No baked-in preferences (no default language, length, or
  content assumptions). The global include/exclude **discovery filters** are the
  only thing that ever filters — see `src/lib/filters.js`. Empty = everything.
- **Bulk upload = in-app multi-file.** No desktop tool, no cloud, no login. The
  upload screen accepts many EPUB/HTML/TXT files at once and parses them on the
  device. (A desktop importer may return later as an optional power-user extra.)
- **Links are separate from files.** A file is the whole book; a link needs
  *fetching*. Link fetching is its own phase (and its own risk — see below).
- **Backup is opt-in.** Export/import a file first; optional sync to the user's
  *own* cloud later. Never required to use the app.
- **Responsive from day one.** Centered max-width column on tablets/desktop so it
  looks designed, not stretched (already in `styles.css`).
- **Android first**, distributed via direct APK and (eventually) F-Droid.

## Phases

- [x] **Phase 0 — Foundation.** Scaffold (Vite + React + Capacitor), app shell
  (color mode, bottom nav, Library/Settings stubs), shared design tokens,
  responsive root, CI (build + tests → APK), and the first tested pure logic
  (`urlref`, `filters`). Docs.
- [ ] **Phase 1 — On-device storage + reader + bulk upload.** SQLite data layer
  (works/chapters), port the reader (resume position, themes, fonts), and
  in-app multi-file EPUB/HTML/TXT import. → *MVP: read your own books offline.*
- [ ] **Phase 2 — Library + discovery filters.** Shelves, sort/filter, the
  global include/exclude filters UI (language / excluded tags / length / status),
  tag-group model on local storage.
- [ ] **Phase 3 — Links & fetching (spike first).** On-device fetching of a
  pasted link / list of links (AO3 / Royal Road / Scribble Hub / generic). RISK:
  needs cross-origin fetch (Capacitor native HTTP) + parsers ported to JS. Prove
  feasibility before committing.
- [ ] **Phase 4 — Backup + polish + F-Droid.** Export/import, optional cloud
  sync, final responsive/polish pass, and F-Droid packaging.

## Carried over from FicStash (de-personalization checklist)

When porting logic from FicStash, strip anything tuned to the original owner:
- Language allowlist default (English/Armenian/Japanese/Russian) → **none**.
- Discovery prefs seeded with those languages → **empty**.
- Language picker ordered by the owner's languages → **neutral ordering**.
- `User-Agent` / repo URLs naming ficstash/eirthae → **BookStash**.
- Sample/demo data (hockey RPF) → **none** (local-first needs no demo fallback).
- Add **length** (min/max words) and **completion status** to the filters
  (already supported in `filters.js`).
