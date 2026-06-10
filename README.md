# BookStash

A private, **local-first** reader and library for web fiction and books.

> **Your device is the database.** No accounts to sign up for, no servers
> holding your data, no subscriptions. You add what you want to read, it's
> downloaded to your own device, and it's yours — offline, private, forever.

BookStash gathers stories and books from several sources into one clean,
offline library you fully own. It's built for the reader who wants *their*
shelf — curated by them, stored by them — not another feed.

> ⚠️ **Status: early development.** This is a fresh, public, open-source project.
> It is not ready to use yet. Nothing here is stable; expect everything to change.

---

## Principles

- **Local-first.** Everything lives on your device (an on-device database).
  The app does its own downloading; there is no central server.
- **You own your data.** Back it up, export it, move it. It never lives on
  someone else's computer unless *you* choose to sync it to *your* own cloud.
- **Private by default.** Nothing about what you read leaves your device.
- **Polite to sources.** Each device only fetches its owner's own library, at a
  gentle, rate-limited pace. No central scraper hammering anyone.
- **Free and open.** GPLv3. No paywalled features. An optional "support
  development" link is the only ask, and it unlocks nothing.

## Planned scope

- **Multi-source library** — web fiction (e.g. AO3, Royal Road, Scribble Hub),
  books (via open catalogues), generic article/links, and your own file uploads
  (EPUB / HTML / TXT).
- **A beautiful offline reader** — themes, reading fonts, adjustable type, fully
  offline once downloaded.
- **Smart library** — shelves, tag/genre tracking with all-time discovery, and
  auto-follow of still-updating works so new chapters arrive on each sync.
- **Backup & restore** — export/import your whole library; later, optional
  sync to your *own* cloud (e.g. Drive/Dropbox) so a new phone restores itself.
- **Desktop bulk-import companion** — a lightweight desktop tool for bulk adding
  (drag-in many EPUBs at once, paste a big list of links) into your library,
  for when adding from the phone one-by-one is too slow.

## Platforms

- **Android first** (likely distributed via direct APK and F-Droid).
- A desktop companion for bulk import (see above).

## License

[GPLv3](./LICENSE). You're free to use, study, modify, and share it; derivatives
stay open.

---

*BookStash is the open-source evolution of a private reader the author built for
their own shelf. This repository is a clean, separate project — it shares no
keys, servers, or personal data with that original.*
