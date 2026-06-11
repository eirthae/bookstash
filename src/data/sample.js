// Shared cover-palette helpers (ported from FicStash). BookStash is local-first
// and ships NO baked-in works — the library comes entirely from on-device data,
// so there is no sample WORKS array here (that's the whole point).

export const COVER_PALETTES = [
  ['#7828c8', '#006fee'], // purple → blue (default look)
  ['#481878', '#9353d3'], // deep violet
  ['#0e447a', '#338ef7'], // ocean
  ['#7a1340', '#f54180'], // wine → rose
  ['#0e5a3a', '#17c964'], // forest
  ['#8a4b10', '#f5a524'], // amber/ember
  ['#3a1d6e', '#c20e4d'], // plum → magenta
  ['#143a52', '#0e9c8a'], // teal night
];

export function hashStr(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
export function paletteFor(seed) {
  return COVER_PALETTES[hashStr(seed || '') % COVER_PALETTES.length];
}

// No baked content: empty so any FicStash-ported screen that references these
// renders the real (on-device) data path with nothing to fall back to.
export const WORKS = [];
export const CHAPTERS = [];
export const READER_PARAS = [];

export const TRACKED_TAGS = [];
export const SUGGESTIONS = [];
