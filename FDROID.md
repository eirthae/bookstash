# Shipping BookStash to F-Droid

Target: the **official F-Droid repository** (built and signed by F-Droid from
source). BookStash is submitted as
[fdroiddata!40612](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/40612).

## Why BookStash qualifies

- **License:** GPL-3.0-only (`LICENSE`).
- **No proprietary dependencies:** no Google Play Services / Firebase / GMS.
  Plugins are all open source (`@capacitor/*`, `@capawesome/capacitor-file-picker`).
- **No backend, no tracking:** fully on-device. Nothing to flag as an
  anti-feature (no NonFreeNet).
- **Built from source:** the native `android/` project is committed, and F-Droid
  builds it with `npm ci` → `vite build` → `cap sync` → gradle.

## Why android/ is committed

F-Droid's build model requires the gradle project to exist at checkout:
`subdir`/`gradle:` and Tags-based autoupdate (`checkupdates`) all read from the
committed native project. Generating `android/` at build time fails the `subdir`
check and leaves `checkupdates` with no versionCode to read — so the generated
`android/` (from `npx cap add android` + `@capacitor/assets`) is committed.

## What's in place

- `fastlane/metadata/android/en-US/` — title, descriptions, changelog
  (`changelogs/<versionCode>.txt`), icon, screenshots.
- `fdroid/com.bookstash.app.yml` — a reference copy of the metadata + build
  recipe submitted to fdroiddata (the authoritative one lives in the MR).
- `scripts/set-version.mjs` — stamps `versionName`/`versionCode` into
  `android/app/build.gradle` from `package.json`. Run after `cap sync` when
  regenerating `android/` for a release, then commit.
- Releases are tagged `v<version>` → `UpdateCheckMode: Tags` +
  `AutoUpdateMode: Version`.

## The build recipe — hard-won details (maintainer: linsui)

- `commit:` is the **full commit hash**, never a tag or branch.
- `subdir: android/app`; `gradle: [yes]` (F-Droid runs gradle itself).
- F-Droid runs prebuild **inside the subdir**, so Capacitor needs the repo root:
  `cd ../..` **once** in the first prebuild command (cwd persists across them).
- `scandelete` strips prebuilt build-tool binaries from `node_modules`
  (esbuild, sharp, capacitor-cli) that the scanner rejects and gradle doesn't
  need.
- Metadata must use **LF** line endings and pass `fdroid rewritemeta`.

## Versioning scheme

`versionName` = `package.json` "version" (e.g. `0.8.27`).
`versionCode`  = `major*1_000_000 + minor*1_000 + patch` (e.g. `0.8.27` → `8027`),
monotonic while minor/patch stay < 1000.

## Releasing a new version

1. Bump `package.json` "version".
2. `npm install` → `npm run build` → `npx cap sync android` →
   `node scripts/set-version.mjs`.
3. Commit the updated `android/` + `package.json`, tag `v<version>`, push.
4. F-Droid autoupdate detects the new tag; update the recipe's `commit:` (full
   hash) + `versionCode` via an fdroiddata MR.

## Note on our own APK

The GitHub `Build APK` workflow ships a **debug**-signed APK for easy
sideloading. F-Droid builds the **release** variant and signs it with its own
key, so the F-Droid build and our direct-download APK have different signatures
(installing one over the other requires an uninstall).
