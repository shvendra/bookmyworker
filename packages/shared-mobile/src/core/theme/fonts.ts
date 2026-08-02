// ── Brand typography: Poppins ────────────────────────────────────────────────
// Poppins is loaded at app startup (bundled via @expo-google-fonts, no network)
// and applied globally through AppText. Android does NOT synthesise weights from
// a single family, so each weight is a distinct font family and AppText maps a
// numeric fontWeight → the matching Poppins family below.
//
// FAIL-SAFE: text only switches to Poppins once `markFontsReady()` has run. If
// font loading ever fails, `fontsAreReady()` stays false and AppText keeps the
// exact system-font rendering it has today — no blank or broken text.
import { useFonts } from 'expo-font';

// Load ONLY the 6 weights we actually use, via per-weight subpaths. Importing
// named exports from the '@expo-google-fonts/poppins' BARREL would bundle ALL 18
// TTFs (Thin→Black + every italic, ~3 MB) because Metro can't tree-shake the
// barrel's require() calls. Direct subpath requires bundle just these six.
const POPPINS_FONTS = {
  Poppins_400Regular: require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
  Poppins_500Medium: require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
  Poppins_600SemiBold: require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
  Poppins_700Bold: require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
  Poppins_800ExtraBold: require('@expo-google-fonts/poppins/800ExtraBold/Poppins_800ExtraBold.ttf'),
  Poppins_900Black: require('@expo-google-fonts/poppins/900Black/Poppins_900Black.ttf'),
};

/** Load every Poppins weight the app uses. Returns [loaded, error]. */
export const useAppFonts = (): [boolean, Error | null] => useFonts(POPPINS_FONTS);

// Module-level readiness flag (not React state) — read synchronously by AppText.
// Safe because the app tree is only mounted AFTER fonts resolve, so the first
// AppText render already sees the correct value.
let fontsReady = false;
export const markFontsReady = (): void => { fontsReady = true; };
export const fontsAreReady = (): boolean => fontsReady;

const FAMILY_BY_WEIGHT: Record<string, string> = {
  '100': 'Poppins_400Regular',
  '200': 'Poppins_400Regular',
  '300': 'Poppins_400Regular',
  '400': 'Poppins_400Regular',
  normal: 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
  '700': 'Poppins_700Bold',
  bold: 'Poppins_700Bold',
  '800': 'Poppins_800ExtraBold',
  '900': 'Poppins_900Black',
};

/** Map a fontWeight (numeric or keyword) to the matching Poppins family. */
export const fontFamilyForWeight = (weight?: string | number): string =>
  FAMILY_BY_WEIGHT[String(weight ?? '400')] ?? 'Poppins_400Regular';
