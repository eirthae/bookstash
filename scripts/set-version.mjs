// Stamp the generated Android project with a real versionName + monotonic
// versionCode derived from package.json, instead of Capacitor's default 1 / "1.0".
//
// versionName = package.json "version" (e.g. "0.8.16")
// versionCode = major*1_000_000 + minor*1_000 + patch  (e.g. 0.8.16 -> 8016)
//   monotonic as long as minor < 1000 and patch < 1000.
//
// Run AFTER `cap add/sync android` and BEFORE `gradlew assemble…`. Used by both
// the GitHub APK workflow and the F-Droid build recipe so releases everywhere
// carry the same, correct version. Tag releases as v<version> matching this.
import { readFileSync, writeFileSync } from 'node:fs';

const v = JSON.parse(readFileSync('package.json', 'utf8')).version;
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
if (!m) {
  console.error(`package.json version "${v}" must be MAJOR.MINOR.PATCH`);
  process.exit(1);
}
const [maj, min, pat] = m.slice(1).map(Number);
if (min > 999 || pat > 999) {
  console.error(`minor/patch must each be < 1000 to keep versionCode monotonic (got ${v})`);
  process.exit(1);
}
const code = maj * 1_000_000 + min * 1_000 + pat;

const path = 'android/app/build.gradle';
let g = readFileSync(path, 'utf8');
if (!/versionCode\s+\d+/.test(g) || !/versionName\s+"[^"]*"/.test(g)) {
  console.error(`could not find versionCode/versionName in ${path}`);
  process.exit(1);
}
g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`);
g = g.replace(/versionName\s+"[^"]*"/, `versionName "${v}"`);
writeFileSync(path, g);
console.log(`set versionName "${v}", versionCode ${code} in ${path}`);
