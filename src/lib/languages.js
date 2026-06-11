// AO3 languages you can follow or filter by. `code` is AO3's language_id (used
// by the worker's language search); `native` is how AO3 displays the language on
// a work (so the discovery language filter can match it directly); `english` is
// the label shown in the picker. This is a curated subset of AO3's full list —
// add entries here to offer more. The four seeded discovery defaults (English,
// Armenian, Japanese, Russian) are known-good; others are best-effort.
export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'hy', native: 'հայերեն', english: 'Armenian' },
  { code: 'ja', native: '日本語', english: 'Japanese' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'zh', native: '中文-普通话 國語', english: 'Chinese' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'de', native: 'Deutsch', english: 'German' },
  { code: 'it', native: 'Italiano', english: 'Italian' },
  { code: 'ko', native: '한국어', english: 'Korean' },
  { code: 'nl', native: 'Nederlands', english: 'Dutch' },
  { code: 'pl', native: 'Polski', english: 'Polish' },
  { code: 'ar', native: 'العربية', english: 'Arabic' },
  { code: 'uk', native: 'Українська', english: 'Ukrainian' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish' },
  { code: 'cs', native: 'Čeština', english: 'Czech' },
  { code: 'sv', native: 'Svenska', english: 'Swedish' },
  { code: 'fi', native: 'Suomi', english: 'Finnish' },
  { code: 'el', native: 'Ελληνικά', english: 'Greek' },
  { code: 'he', native: 'עברית', english: 'Hebrew' },
  { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian' },
  { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'th', native: 'ไทย', english: 'Thai' },
  { code: 'hu', native: 'Magyar', english: 'Hungarian' },
  { code: 'ro', native: 'Română', english: 'Romanian' },
  { code: 'da', native: 'Dansk', english: 'Danish' },
];

// Palette index for a language tile, derived from its code (stable, spread out).
export function langPalette(code) {
  let h = 0;
  for (let i = 0; i < (code || '').length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return h % 6;
}

export function langByCode(code) {
  return LANGUAGES.find((l) => l.code === code) || null;
}
