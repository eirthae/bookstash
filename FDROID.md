# Shipping BookStash to F-Droid

Target: the **official F-Droid repository** (built and signed by F-Droid from
source). This is the checklist and the known-open items.

## Why BookStash qualifies

- **License:** GPL-3.0-only (`LICENSE`).
- **No proprietary dependencies:** no Google Play Services / Firebase / GMS.
  Plugins are all open source (`@capacitor/*`, `@capawesome/capacitor-file-picker`).
- **No backend, no tracking:** fully on-device. The optional Supabase proxy was
  removed — there is nothing to flag as an anti-feature (no NonFreeNet).
- **Reproducible from source:** the native `android/` project is generated at
  build time, and the version is stamped deterministically from `package.json`.

## What's in place (this repo)

- `fastlane/metadata/android/en-US/` — title, short + full description, changelog
  (`changelogs/<versionCode>.txt`).
- `fdroid/com.bookstash.app.yml` — the metadata + build recipe to submit.
- `scripts/set-version.mjs` — stamps `versionName`/`versionCode` from
  `package.json` (so every build, ours and F-Droid's, carries the real version
  instead of Capacitor's default `1` / `1.0`). Wired into the APK workflow.
- Releases are tagged `v<version>` matching `package.json` →
  `UpdateCheckMode: Tags` + `AutoUpdateMode: Version`.

## Versioning scheme

`versionName` = `package.json` "version" (e.g. `0.8.17`).
`versionCode`  = `major*1_000_000 + minor*1_000 + patch` (e.g. `0.8.17` → `8017`),
monotonic while minor/patch stay < 1000. Bump `package.json`, tag `v<version>`.

## Still needed before submitting

1. **Screenshots** — add PNGs to
   `fastlane/metadata/android/en-US/images/phoneScreenshots/` (1–8, taken on a
   device/emulator). F-Droid shows these on the listing. *(Only you can capture
   these.)*
2. **Listing icon** — `fastlane/metadata/android/en-US/images/icon.png`
   (512×512), from the final app icon.
3. **Confirm the build recipe on F-Droid's builder.** The Node build step
   (`npm ci` + `vite` + `cap`) is the part most likely to need adjustment —
   F-Droid restricts network outside `sudo`/`prebuild`, and the generated
   `android/` must assemble the **release** variant unsigned (F-Droid signs it).
   Validate with `fdroid build com.bookstash.app:8017` before opening the MR.

## Submitting

1. Fork https://gitlab.com/fdroid/fdroiddata
2. Copy `fdroid/com.bookstash.app.yml` → `metadata/com.bookstash.app.yml`
3. `fdroid lint com.bookstash.app` and `fdroid build com.bookstash.app:<code>`
4. Open a merge request; iterate with maintainers on the build recipe.

## Note on our own APK

The GitHub `Build APK` workflow ships a **debug**-signed APK for easy sideloading.
F-Droid builds the **release** variant and signs it with its own key, so the
F-Droid build and our direct-download APK have different signatures (installing
one over the other requires an uninstall).
