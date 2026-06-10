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
- [x] **Phase 1 — On-device storage + bulk upload + basic reader.** IndexedDB
  data layer (`works`/`chapters`), in-app multi-file EPUB/HTML/TXT import (parsed
  on-device), a library list, and a basic reader (chapter nav). → *MVP: import
  your own books and read them offline.* Reader polish (themes, fonts, resume
  position) and library sort/shelves come in Phase 2.
- [~] **Phase 2 — Library + discovery filters.** Shelves, sort/filter, the
  global include/exclude filters UI (language / excluded tags / length / status),
  tag-group model on local storage. *(2a done: sort + detail + delete.)*
  - **Book discovery = Goodreads reader-tag shelves** (notify-only: basic info +
    a link; you source the file). Proven in FicStash — `parse_shelf` +
    `/shelf/show/<tag>` (AND = intersect include shelves) and a curated
    reader-tag **autocomplete** vocabulary. Port the parser to JS for the
    on-device fetcher; reuse the tag vocabulary verbatim. (Open Library's
    catalogue subjects were too stiff for reader tags — dropped.)
- [ ] **Phase 3 — Links & fetching (spike first).** On-device fetching of a
  pasted link / list of links (AO3 / Royal Road / Scribble Hub / generic). RISK:
  needs cross-origin fetch (Capacitor native HTTP) + parsers ported to JS. Prove
  feasibility before committing.
  - **Un-fetchable works → clear label + "read on AO3" link, never a silent
    fail.** BookStash is public and runs logged-out (no AO3 account, no stored
    creds), so a **login-restricted** AO3 work (author limited it to registered
    users) can't be downloaded. When the fetcher hits that redirect, show a card
    like "🔒 This work is restricted to AO3 members — open it on AO3" with the
    canonical work URL as a tappable link, instead of a stuck/empty entry. (Adult
    Explicit/Mature works are NOT restricted — set the `view_adult` cookie
    client-side and they fetch normally.)
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
