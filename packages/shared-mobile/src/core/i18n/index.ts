import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './translations';
import type { AppLanguage } from '../../shared/types/domain';

const SUPPORTED: AppLanguage[] = ['en', 'hi', 'mr', 'gu', 'ta', 'te', 'kn', 'ml', 'bn', 'or', 'pa'];

const deviceCode = Localization.getLocales()[0]?.languageCode ?? 'en';
const defaultLanguage: AppLanguage = (SUPPORTED as string[]).includes(deviceCode)
  ? (deviceCode as AppLanguage)
  : 'en';

void i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
export { SUPPORTED as SUPPORTED_LANGUAGES };
