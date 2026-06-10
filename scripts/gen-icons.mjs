// Render the app-icon / splash PNGs from resources/icon-foreground.svg using
// sharp (reliable prebuilt binaries — ImageMagick isn't on the runner). Output
// feeds @capacitor/assets, which fans them out to all Android densities.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const BG = { r: 201, g: 169, b: 233, alpha: 1 }; // #c9a9e9 — brand primary-200
const svg = readFileSync('resources/icon-foreground.svg');

const fg = (size) =>
  sharp(svg, { density: 400 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

const solid = (w, h) => sharp({ create: { width: w, height: h, channels: 4, background: BG } });

const run = async () => {
  // adaptive icon: transparent foreground glyph + solid background
  await sharp(await fg(1024)).toFile('resources/icon-foreground.png');
  await solid(1024, 1024).png().toFile('resources/icon-background.png');
  // legacy/flattened icon
  await solid(1024, 1024).composite([{ input: await fg(1024) }]).png().toFile('resources/icon-only.png');
  // branded splash (light + dark)
  const splashGlyph = await fg(820);
  await solid(2732, 2732).composite([{ input: splashGlyph, gravity: 'center' }]).png().toFile('resources/splash.png');
  await solid(2732, 2732).composite([{ input: splashGlyph, gravity: 'center' }]).png().toFile('resources/splash-dark.png');
  console.log('app icons + splash generated (book on #c9a9e9)');
};
run().catch((e) => { console.error(e); process.exit(1); });
