// Mock for shared-mobile/src/core/theme/fonts — avoids pulling expo-font /
// @expo-google-fonts/poppins (native) into the jsdom test env. Fonts are
// always "ready" in tests so <App> renders past its splash-hold gate.
export const useAppFonts = (): [boolean, Error | null] => [true, null];
export const markFontsReady = (): void => {};
export const fontsAreReady = (): boolean => true;
export const fontFamilyForWeight = (_weight?: string | number): string => 'System';
