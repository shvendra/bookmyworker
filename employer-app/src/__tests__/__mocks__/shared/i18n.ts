// Shared i18n default-export mock.
const i18n = {
  language: 'en',
  changeLanguage: jest.fn().mockResolvedValue(undefined),
  t: (key: string) => key,
};

export default i18n;
