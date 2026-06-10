// Subset of LANGUAGE_OPTIONS — enough rows to exercise the KYC language grid
// (selected vs unselected chip branches) without the full 11-language list.
export const LANGUAGE_OPTIONS: Array<{
  value: string;
  nativeLabel: string;
  englishLabel: string;
}> = [
  { value: 'en', nativeLabel: 'English', englishLabel: 'English' },
  { value: 'hi', nativeLabel: 'हिंदी', englishLabel: 'Hindi' },
  { value: 'mr', nativeLabel: 'मराठी', englishLabel: 'Marathi' },
];
