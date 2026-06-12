// Build the app-icon / splash PNGs for BookStash. The glyph is FicStash's exact
// icon foreground (resources/icon-foreground-src.png, the transparent adaptive
// foreground copied verbatim), with two deliberate brand differences from
// FicStash's icon:
//   1. Background colour — BookStash's brand primary-200 (#c9a9e9).
//   2. Owl colour — recoloured from FicStash's primary-500 (#7828c8) to
//      primary-600 (#6020a0) for more contrast against the lavender background.
// sharp recolours the glyph (keeping its original alpha / soft edges) and
// composites it on the background; @capacitor/assets then fans the result out to
// every Android density. The recoloured glyph is written to icon-foreground.png
// (the adaptive foreground layer @capacitor/assets consumes).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const BG = { r: 201, g: 169, b: 233, alpha: 1 }; // #c9a9e9 — brand primary-200
const OWL = { r: 0x60, g: 0x20, b: 0xa0 };        // #6020a0 — brand primary-600
const SRC = 'resources/icon-foreground-src.png';   // pristine FicStash glyph

// Recolour the glyph to OWL while preserving its original alpha (so soft edges
// and the transparent eye/beak cut-outs survive). Solid OWL fill + source alpha.
const recolorGlyph = async () => {
  const srcPng = readFileSync(SRC);
  const { width, height } = await sharp(srcPng).metadata();
  const alpha = await sharp(srcPng).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: OWL } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png().toBuffer();
};

const solid = (w, h) => sharp({ create: { width: w, height: h, channels: 4, background: BG } });

const run = async () => {
  const fgPng = await recolorGlyph();
  // The recoloured glyph IS the adaptive foreground layer @capacitor/assets uses.
  await sharp(fgPng).png().toFile('resources/icon-foreground.png');

  // The glyph at a given size on a transparent canvas.
  const fg = (size) =>
    sharp(fgPng).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  // Adaptive background layer: solid #c9a9e9.
  await solid(1024, 1024).png().toFile('resources/icon-background.png');
  // Legacy/flattened icon: the glyph over #c9a9e9.
  await solid(1024, 1024).composite([{ input: await fg(1024) }]).png().toFile('resources/icon-only.png');
  // Branded splash (light + dark).
  const splashGlyph = await fg(820);
  await solid(2732, 2732).composite([{ input: splashGlyph, gravity: 'center' }]).png().toFile('resources/splash.png');
  await solid(2732, 2732).composite([{ input: splashGlyph, gravity: 'center' }]).png().toFile('resources/splash-dark.png');
  console.log('app icons + splash generated (FicStash glyph recoloured #6020a0 on #c9a9e9)');
};
run().catch((e) => { console.error(e); process.exit(1); });
