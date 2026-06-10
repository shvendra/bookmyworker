// Shared i18n default-export mock. `changeLanguage` is a jest mock so screens
// and AppNavigator can assert the language sync.
const i18n = {
  language: 'en',
  changeLanguage: jest.fn().mockResolvedValue(undefined),
  t: (key: string) => key,
};

export default i18n;
