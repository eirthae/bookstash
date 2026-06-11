// Source registry (app side) — canonical "open at source" links + labels.
const SOURCES = {
  ao3:         { label: 'AO3',          workUrl: (id) => `https://archiveofourown.org/works/${id}` },
  royalroad:   { label: 'Royal Road',   workUrl: (id) => `https://www.royalroad.com/fiction/${id}` },
  scribblehub: { label: 'Scribble Hub', workUrl: (id) => `https://www.scribblehub.com/series/${id}/` },
  books:       { label: 'Books',        workUrl: (id) => `https://www.goodreads.com/book/show/${id}` },
  link:        { label: 'Link' },
  upload:      { label: 'Upload' },
};

export function sourceLabel(sourceId) {
  return SOURCES[sourceId]?.label || sourceId || 'Unknown';
}

// Canonical link for a work. Works added by URL carry their own stored link
// (fallbackUrl); sources with a builder construct one from the id.
export function workUrl(sourceId, sourceWorkId, fallbackUrl = '') {
  const src = SOURCES[sourceId];
  if (src && src.workUrl && sourceWorkId) return src.workUrl(sourceWorkId);
  return fallbackUrl || '';
}

// RR/SH genre & tag taxonomies (re-exported so the Discover pickers can import
// everything from one place, matching FicStash).
export {
  ROYALROAD_GENRES, ROYALROAD_TAGS, SCRIBBLEHUB_GENRES, SCRIBBLEHUB_TAGS,
} from './taxonomies.js';
