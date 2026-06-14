/**
 * scriptTransliterate — phonetic transliteration of a Devanagari (Hindi) string
 * into any of the app's Indic scripts.
 *
 * Place-name dictionaries (see [[locationTranslations]] and the maps in
 * [[labelUtils]]) ship an authoritative Hindi/Devanagari spelling for almost
 * every Indian district, block and state, but hand-written translations for the
 * other 9 Indic languages exist for only a small fraction. Rather than leave the
 * rest in Latin script, we transliterate the Devanagari form into the user's
 * script on the fly. Brahmic scripts are phonetically alignable, so a proper
 * spelling in one yields a faithful spelling in the others — this is what makes
 * location names render natively for ALL 11 languages, not just the curated few.
 *
 * Powered by @indic-transliteration/sanscript (pure JS, Hermes-safe).
 */
import Sanscript from '@indic-transliteration/sanscript';

// i18n language code → sanscript scheme name. hi/mr are already Devanagari, so
// they need no transform; en is Latin and never transliterated here.
const SCHEME_BY_LANG: Record<string, string> = {
  gu: 'gujarati',
  ta: 'tamil',
  te: 'telugu',
  kn: 'kannada',
  ml: 'malayalam',
  bn: 'bengali',
  or: 'oriya',
  pa: 'gurmukhi',
};

// Memoize by `${lang}:${text}` — place names repeat heavily across lists, and
// transliteration, while cheap, runs inside render paths.
const cache = new Map<string, string>();

function normLang(language: string | null | undefined): string {
  if (!language) return 'en';
  return language.toLowerCase().split(/[-_]/)[0];
}

/** True for Devanagari text — what the location dictionaries store under `hi`. */
function isDevanagari(text: string): boolean {
  return /[ऀ-ॿ]/.test(text);
}

// Strips the Devanagari nukta (the dot that turns क→क़, ड→ड़ etc.) to its base
// consonant before transliteration. Sanscript leaves the combining nukta (U+093C)
// untransliterated for the Brahmic targets that lack those sounds (Tamil/Telugu/
// Kannada/Malayalam), producing a dangling ़ in names like "Najafgarh" (नजफगढ़).
// The base consonant is the correct rendering in those scripts, so normalize it
// away first. Handles both precomposed (U+0958–U+095F) and decomposed forms.
const PRECOMPOSED_NUKTA: Array<[RegExp, string]> = [
  [/क़/g, 'क'], [/ख़/g, 'ख'], [/ग़/g, 'ग'], [/ज़/g, 'ज'],
  [/ड़/g, 'ड'], [/ढ़/g, 'ढ'], [/फ़/g, 'फ'], [/य़/g, 'य'],
];
function stripNukta(text: string): string {
  let out = text.replace(/़/g, ''); // decomposed: base + combining nukta
  for (const [re, base] of PRECOMPOSED_NUKTA) out = out.replace(re, base);
  return out;
}

/**
 * Transliterates a Devanagari (Hindi) string into the script for `language`.
 *
 * Returns the input unchanged when there is nothing to do (English, Marathi or
 * Hindi targets, non-Devanagari input, or an unsupported language) and falls
 * back to the original string if transliteration throws — so a caller can always
 * use the result directly without a separate fallback branch.
 */
export function transliterateFromHindi(devanagariText: string, language: string): string {
  const text = devanagariText?.trim();
  if (!text) return devanagariText;

  const lang = normLang(language);
  const scheme = SCHEME_BY_LANG[lang];
  // hi/mr (Devanagari), en (Latin) and any unmapped language: keep as-is.
  if (!scheme) return devanagariText;
  if (!isDevanagari(text)) return devanagariText;

  const key = `${lang}:${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let out = devanagariText;
  try {
    const result = Sanscript.t(stripNukta(text), 'devanagari', scheme);
    if (result && typeof result === 'string') out = result;
  } catch {
    // Leave `out` as the original Devanagari on any failure.
  }
  cache.set(key, out);
  return out;
}
