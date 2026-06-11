// Build the app-icon / splash PNGs for BookStash. The glyph is FicStash's exact
// icon foreground (resources/icon-foreground.png, a transparent adaptive-icon
// layer copied verbatim) — the ONLY difference from FicStash's icon is the
// background colour, BookStash's brand primary-200 (#c9a9e9). sharp composites
// the glyph on that background; @capacitor/assets then fans the result out to
// every Android density. icon-foreground.png is left untouched (used as-is for
// the adaptive foreground layer).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const BG = { r: 201, g: 169, b: 233, alpha: 1 }; // #c9a9e9 — brand primary-200
const fgPng = readFileSync('resources/icon-foreground.png');

// The glyph at a given size on a transparent canvas (FicStash's own foreground).
const fg = (size) =>
  sharp(fgPng).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

const solid = (w, h) => sharp({ create: { width: w, height: h, channels: 4, background: BG } });

const run = async () => {
  // Adaptive background layer: solid #c9a9e9 (foreground layer = the copied PNG).
  await solid(1024, 1024).png().toFile('resources/icon-background.png');
  // Legacy/flattened icon: the glyph over #c9a9e9.
  await solid(1024, 1024).composite([{ input: await fg(1024) }]).png().toFile('resources/icon-only.png');
  // Branded splash (light + dark).
  const splashGlyph = await fg(820);
  await solid(2732, 2732).composite([{ input: splashGlyph, gravity: 'center' }]).png().toFile('resources/splash.png');
  await solid(2732, 2732).composite([{ input: splashGlyph, gravity: 'center' }]).png().toFile('resources/splash-dark.png');
  console.log('app icons + splash generated (FicStash glyph on #c9a9e9)');
};
run().catch((e) => { console.error(e); process.exit(1); });
