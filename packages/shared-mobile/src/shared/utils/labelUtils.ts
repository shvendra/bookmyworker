/**
 * labelUtils — translates work-type category, sub-category labels,
 * and Indian location (state) names into the user's current language.
 */

import type { TFunction } from 'i18next';
import { WORK_CATEGORIES } from '../components/ui/WorkerCategoryGrid';
import categoriesData from '../data/categories.json';
import type { TranslationKeys } from '../../core/i18n/translations';
import type { UserProfile } from '../types/domain';

interface CatEntry {
  label: string;
  value: string;
  hindilabel?: string;
  marathilabel?: string;
  gujaratilabel?: string;
  subcategories: SubEntry[];
}
interface SubEntry {
  label: string;
  value: string;
  hindilabel?: string;
  marathilabel?: string;
  gujaratilabel?: string;
}

const ALL_CATS = categoriesData as CatEntry[];

// Maps i18n language code → field name in categories.json
const LANG_FIELD: Record<string, keyof SubEntry> = {
  hi: 'hindilabel',
  mr: 'marathilabel',
  gu: 'gujaratilabel',
};

// ── Work-type translation ─────────────────────────────────────────────────────

/**
 * Translates a work-type value using cat_* i18n keys (all 11 languages).
 * Handles legacy DB values stored as full label strings or partial names.
 */
export function getWorkTypeLabel(
  value: string | null | undefined,
  t: TFunction,
): string {
  if (!value) return '—';

  // 1. Exact match on value (current format: "manufacturing_industrial_workers")
  const exact = WORK_CATEGORIES.find((c) => c.value === value);
  if (exact) return t(exact.translationKey as TranslationKeys);

  const lower = value.toLowerCase().replace(/[\s_&/-]+/g, ' ').trim();

  // 2. Fuzzy match — check if the value contains a keyword from the category label
  const fuzzy = WORK_CATEGORIES.find((c) => {
    const catLower = c.label.toLowerCase().replace(/ workers?$/i, '').trim();
    const valLower = lower.replace(/ workers?$/i, '').trim();
    return (
      catLower.startsWith(valLower) ||
      valLower.startsWith(catLower) ||
      catLower.includes(valLower) ||
      valLower.includes(catLower.split(' ')[0])
    );
  });
  if (fuzzy) return t(fuzzy.translationKey as TranslationKeys);

  // 3. Final fallback: readable English
  return value
    .replace(/_/g, ' ')
    .replace(/ workers?$/i, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-category translation ──────────────────────────────────────────────────

/**
 * Returns a language-specific label for a sub-category value.
 * Supports hi/mr/gu from categories.json; others fall back to English.
 */
export function getSubCatLabel(
  value: string | null | undefined,
  language: string,
): string {
  if (!value) return '—';
  const fieldKey = LANG_FIELD[language];
  const lower = value.toLowerCase();
  for (const cat of ALL_CATS) {
    for (const sub of cat.subcategories) {
      if (
        sub.value === value ||
        sub.value?.toLowerCase() === lower ||
        sub.label?.toLowerCase() === lower
      ) {
        if (fieldKey && sub[fieldKey]) return sub[fieldKey] as string;
        return sub.label;
      }
    }
  }
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Picks the best job title: sub-category in native language if available,
 * otherwise the work-type category label.
 */
export function getJobTitle(
  workType: string | null | undefined,
  subCategory: string | null | undefined,
  language: string,
  t: TFunction,
): string {
  if (subCategory) return getSubCatLabel(subCategory, language);
  return getWorkTypeLabel(workType, t);
}

/**
 * Category label for the sub-title line in cards (newlines → " & ").
 */
export function getCategoryLabel(
  workType: string | null | undefined,
  t: TFunction,
): string {
  return getWorkTypeLabel(workType, t).replace(/\n/g, ' & ');
}

// ── Indian state name translation ─────────────────────────────────────────────

/**
 * All 28 states + 8 Union Territories of India, translated into all 11 languages.
 * Keys are the common English spellings stored in the DB.
 */
const STATE_TRANSLATIONS: Record<string, Record<string, string>> = {
  // Major states
  'Andhra Pradesh':       { hi: 'आंध्र प्रदेश', mr: 'आंध्र प्रदेश', gu: 'આંધ્ર પ્રદેશ', ta: 'ஆந்திர பிரதேஷ்', te: 'ఆంధ్రప్రదేశ్', kn: 'ಆಂಧ್ರ ಪ್ರದೇಶ', ml: 'ആന്ധ്ര പ്രദേശ്', bn: 'অন্ধ্র প্রদেশ', or: 'ଆନ୍ଧ୍ର ପ୍ରଦେଶ', pa: 'ਆਂਧਰਾ ਪ੍ਰਦੇਸ਼' },
  'Arunachal Pradesh':    { hi: 'अरुणाचल प्रदेश', mr: 'अरुणाचल प्रदेश', gu: 'અરુણાચલ પ્રદેશ', ta: 'அருணாச்சல பிரதேஷ்', te: 'అరుణాచల్ ప్రదేశ్', kn: 'ಅರುಣಾಚಲ ಪ್ರದೇಶ', ml: 'അരുണാചൽ പ്രദേശ്', bn: 'অরুণাচল প্রদেশ', or: 'ଅରୁଣାଚଳ ପ୍ରଦେଶ', pa: 'ਅਰੁਣਾਚਲ ਪ੍ਰਦੇਸ਼' },
  'Assam':                { hi: 'असम', mr: 'आसाम', gu: 'આસામ', ta: 'அசாம்', te: 'అసోం', kn: 'ಅಸ್ಸಾಂ', ml: 'അസം', bn: 'আসাম', or: 'ଆସାମ', pa: 'ਅਸਾਮ' },
  'Bihar':                { hi: 'बिहार', mr: 'बिहार', gu: 'બિહાર', ta: 'பீகார்', te: 'బీహార్', kn: 'ಬಿಹಾರ', ml: 'ബിഹാർ', bn: 'বিহার', or: 'ବିହାର', pa: 'ਬਿਹਾਰ' },
  'Chhattisgarh':         { hi: 'छत्तीसगढ़', mr: 'छत्तीसगड', gu: 'છત્તીસગઢ', ta: 'சத்தீஸ்கர்', te: 'ఛత్తీస్‌గఢ్', kn: 'ಛತ್ತೀಸ್‌ಗಢ', ml: 'ഛത്തീസ്ഗഢ്', bn: 'ছত্তিশগড়', or: 'ଛତ୍ତିଶଗଡ', pa: 'ਛੱਤੀਸਗੜ੍ਹ' },
  'Goa':                  { hi: 'गोवा', mr: 'गोवा', gu: 'ગોવા', ta: 'கோவா', te: 'గోవా', kn: 'ಗೋವಾ', ml: 'ഗോവ', bn: 'গোয়া', or: 'ଗୋଆ', pa: 'ਗੋਆ' },
  'Gujarat':              { hi: 'गुजरात', mr: 'गुजरात', gu: 'ગુજરાત', ta: 'குஜராத்', te: 'గుజరాత్', kn: 'ಗುಜರಾತ್', ml: 'ഗുജറാത്ത്', bn: 'গুজরাট', or: 'ଗୁଜରାଟ', pa: 'ਗੁਜਰਾਤ' },
  'Haryana':              { hi: 'हरियाणा', mr: 'हरियाणा', gu: 'હરિયાણા', ta: 'ஹரியானா', te: 'హర్యానా', kn: 'ಹರಿಯಾಣ', ml: 'ഹരിയാന', bn: 'হরিয়ানা', or: 'ହରିୟାଣା', pa: 'ਹਰਿਆਣਾ' },
  'Himachal Pradesh':     { hi: 'हिमाचल प्रदेश', mr: 'हिमाचल प्रदेश', gu: 'હિમાચલ પ્રદેશ', ta: 'ஹிமாச்சல பிரதேஷ்', te: 'హిమాచల్ ప్రదేశ్', kn: 'ಹಿಮಾಚಲ ಪ್ರದೇಶ', ml: 'ഹിമാചൽ പ്രദേശ്', bn: 'হিমাচল প্রদেশ', or: 'ହିମାଚଳ ପ୍ରଦେଶ', pa: 'ਹਿਮਾਚਲ ਪ੍ਰਦੇਸ਼' },
  'Jharkhand':            { hi: 'झारखंड', mr: 'झारखंड', gu: 'ઝારખંડ', ta: 'ஜார்க்கண்ட்', te: 'జార్ఖండ్', kn: 'ಜಾರ್ಖಂಡ್', ml: 'ജാർഖണ്ഡ്', bn: 'ঝাড়খণ্ড', or: 'ଝାଡ଼ଖଣ୍ଡ', pa: 'ਝਾਰਖੰਡ' },
  'Karnataka':            { hi: 'कर्नाटक', mr: 'कर्नाटक', gu: 'કર્ણાટક', ta: 'கர்நாடகா', te: 'కర్ణాటక', kn: 'ಕರ್ನಾಟಕ', ml: 'കർണ്ണാടക', bn: 'কর্ণাটক', or: 'କର୍ଣ୍ଣାଟକ', pa: 'ਕਰਨਾਟਕ' },
  'Kerala':               { hi: 'केरल', mr: 'केरळ', gu: 'કેરળ', ta: 'கேரளா', te: 'కేరళ', kn: 'ಕೇರಳ', ml: 'കേരളം', bn: 'কেরালা', or: 'କେରଳ', pa: 'ਕੇਰਲਾ' },
  'Madhya Pradesh':       { hi: 'मध्य प्रदेश', mr: 'मध्य प्रदेश', gu: 'મધ્ય પ્રદેશ', ta: 'மத்திய பிரதேஷ்', te: 'మధ్యప్రదేశ్', kn: 'ಮಧ್ಯ ಪ್ರದೇಶ', ml: 'മധ്യ പ്രദേശ്', bn: 'মধ্যপ্রদেশ', or: 'ମଧ୍ୟ ପ୍ରଦେଶ', pa: 'ਮੱਧ ਪ੍ਰਦੇਸ਼' },
  'Maharashtra':          { hi: 'महाराष्ट्र', mr: 'महाराष्ट्र', gu: 'મહારાષ્ટ્ર', ta: 'மகாராஷ்டிரா', te: 'మహారాష్ట్ర', kn: 'ಮಹಾರಾಷ್ಟ್ರ', ml: 'മഹാരാഷ്ട്ര', bn: 'মহারাষ্ট্র', or: 'ମହାରାଷ୍ଟ୍ର', pa: 'ਮਹਾਰਾਸ਼ਟਰ' },
  'Manipur':              { hi: 'मणिपुर', mr: 'मणिपूर', gu: 'મણિપુર', ta: 'மணிப்பூர்', te: 'మణిపూర్', kn: 'ಮಣಿಪುರ', ml: 'മണിപ്പൂർ', bn: 'মণিপুর', or: 'ମଣିପୁର', pa: 'ਮਣੀਪੁਰ' },
  'Meghalaya':            { hi: 'मेघालय', mr: 'मेघालय', gu: 'મેઘાલય', ta: 'மேகாலயா', te: 'మేఘాలయ', kn: 'ಮೇಘಾಲಯ', ml: 'മേഘാലയ', bn: 'মেঘালয়', or: 'ମେଘାଳୟ', pa: 'ਮੇਘਾਲਿਆ' },
  'Mizoram':              { hi: 'मिज़ोरम', mr: 'मिझोरम', gu: 'મિઝોરમ', ta: 'மிஸோரம்', te: 'మిజోరం', kn: 'ಮಿಜೋರಂ', ml: 'മിസോറം', bn: 'মিজোরাম', or: 'ମିଜୋରାମ', pa: 'ਮਿਜ਼ੋਰਮ' },
  'Nagaland':             { hi: 'नागालैंड', mr: 'नागालँड', gu: 'નાગાલેન્ડ', ta: 'நாகாலாந்து', te: 'నాగాలాండ్', kn: 'ನಾಗಾಲ್ಯಾಂಡ್', ml: 'നാഗാലാൻഡ്', bn: 'নাগাল্যান্ড', or: 'ନାଗାଲ୍ୟାଣ୍ଡ', pa: 'ਨਾਗਾਲੈਂਡ' },
  'Odisha':               { hi: 'ओडिशा', mr: 'ओडिशा', gu: 'ઓડિશા', ta: 'ஒடிஷா', te: 'ఒడిశా', kn: 'ಒಡಿಶಾ', ml: 'ഒഡിഷ', bn: 'ওড়িশা', or: 'ଓଡ଼ିଶା', pa: 'ਓਡੀਸ਼ਾ' },
  'Punjab':               { hi: 'पंजाब', mr: 'पंजाब', gu: 'પંજાબ', ta: 'பஞ்சாப்', te: 'పంజాబ్', kn: 'ಪಂಜಾಬ್', ml: 'പഞ്ചാബ്', bn: 'পাঞ্জাব', or: 'ପଞ୍ଜାବ', pa: 'ਪੰਜਾਬ' },
  'Rajasthan':            { hi: 'राजस्थान', mr: 'राजस्थान', gu: 'રાજસ્થાન', ta: 'ராஜஸ்தான்', te: 'రాజస్థాన్', kn: 'ರಾಜಸ್ಥಾನ', ml: 'രാജസ്ഥാൻ', bn: 'রাজস্থান', or: 'ରାଜସ୍ଥାନ', pa: 'ਰਾਜਸਥਾਨ' },
  'Sikkim':               { hi: 'सिक्किम', mr: 'सिक्किम', gu: 'સિક્કિમ', ta: 'சிக்கிம்', te: 'సిక్కిం', kn: 'ಸಿಕ್ಕಿಂ', ml: 'സിക്കിം', bn: 'সিকিম', or: 'ସିକ୍କିମ', pa: 'ਸਿੱਕਮ' },
  'Tamil Nadu':           { hi: 'तमिलनाडु', mr: 'तमिळनाडू', gu: 'તમિળનાડુ', ta: 'தமிழ்நாடு', te: 'తమిళనాడు', kn: 'ತಮಿಳುನಾಡು', ml: 'തമിഴ്നാട്', bn: 'তামিলনাড়ু', or: 'ତାମିଲ ନାଡୁ', pa: 'ਤਾਮਿਲਨਾਡੂ' },
  'TamilNadu':            { hi: 'तमिलनाडु', mr: 'तमिळनाडू', gu: 'તમિળનાડુ', ta: 'தமிழ்நாடு', te: 'తమిళనాడు', kn: 'ತಮಿಳುನಾಡು', ml: 'തമിഴ്നാട്', bn: 'তামিলনাড়ু', or: 'ତାମିଲ ନାଡୁ', pa: 'ਤਾਮਿਲਨਾਡੂ' },
  'Telangana':            { hi: 'तेलंगाना', mr: 'तेलंगणा', gu: 'તેલંગાણા', ta: 'தெலங்கானா', te: 'తెలంగాణ', kn: 'ತೆಲಂಗಾಣ', ml: 'തെലങ്കാന', bn: 'তেলেঙ্গানা', or: 'ତେଲଙ୍ଗାଣା', pa: 'ਤੇਲੰਗਾਨਾ' },
  'Tripura':              { hi: 'त्रिपुरा', mr: 'त्रिपुरा', gu: 'ત્રિપુરા', ta: 'திரிபுரா', te: 'త్రిపుర', kn: 'ತ್ರಿಪುರ', ml: 'ത്രിപുര', bn: 'ত্রিপুরা', or: 'ତ୍ରିପୁରା', pa: 'ਤ੍ਰਿਪੁਰਾ' },
  'Uttar Pradesh':        { hi: 'उत्तर प्रदेश', mr: 'उत्तर प्रदेश', gu: 'ઉત્તર પ્રદેશ', ta: 'உத்தர பிரதேஷ்', te: 'ఉత్తర ప్రదేశ్', kn: 'ಉತ್ತರ ಪ್ರದೇಶ', ml: 'ഉത്തർ പ്രദേശ്', bn: 'উত্তর প্রদেশ', or: 'ଉତ୍ତର ପ୍ରଦେଶ', pa: 'ਉੱਤਰ ਪ੍ਰਦੇਸ਼' },
  'Uttarakhand':          { hi: 'उत्तराखंड', mr: 'उत्तराखंड', gu: 'ઉત્તરાખંડ', ta: 'உத்தரகண்ட்', te: 'ఉత్తరాఖండ్', kn: 'ಉತ್ತರಾಖಂಡ', ml: 'ഉത്തരാഖണ്ഡ്', bn: 'উত্তরাখণ্ড', or: 'ଉତ୍ତରାଖଣ୍ଡ', pa: 'ਉੱਤਰਾਖੰਡ' },
  'West Bengal':          { hi: 'पश्चिम बंगाल', mr: 'पश्चिम बंगाल', gu: 'પ. બંગાળ', ta: 'மேற்கு வங்காளம்', te: 'పశ్చిమ బెంగాల్', kn: 'ಪ. ಬಂಗಾಳ', ml: 'പ. ബംഗാൾ', bn: 'পশ্চিমবঙ্গ', or: 'ପଶ୍ଚିମ ବଙ୍ଗ', pa: 'ਪੱਛਮੀ ਬੰਗਾਲ' },
  // Union Territories
  'Andaman and Nicobar Islands': { hi: 'अंडमान निकोबार', mr: 'अंदमान निकोबार', gu: 'આ. ને. ટાપુ', ta: 'அந்தமான் நிக்கோபார்', te: 'అండమాన్ నికోబార్', kn: 'ಅಂಡಮಾನ್', ml: 'ആൻഡമാൻ നിക്കോബാർ', bn: 'আন্দামান নিকোবর', or: 'ଅଣ୍ଡାମାନ', pa: 'ਅੰਡੇਮਾਨ' },
  'Chandigarh':           { hi: 'चंडीगढ़', mr: 'चंदीगड', gu: 'ચંડીગઢ', ta: 'சண்டிகர்', te: 'చండీగఢ్', kn: 'ಚಂಡೀಗಢ', ml: 'ചണ്ഡീഗഢ്', bn: 'চণ্ডীগড়', or: 'ଚଣ୍ଡୀଗଡ', pa: 'ਚੰਡੀਗੜ੍ਹ' },
  'Delhi':                { hi: 'दिल्ली', mr: 'दिल्ली', gu: 'દિલ્હી', ta: 'தில்லி', te: 'ఢిల్లీ', kn: 'ದಿಲ್ಲಿ', ml: 'ഡൽഹി', bn: 'দিল্লি', or: 'ଦିଲ୍ଲୀ', pa: 'ਦਿੱਲੀ' },
  'Jammu and Kashmir':    { hi: 'जम्मू कश्मीर', mr: 'जम्मू काश्मीर', gu: 'J&K', ta: 'ஜம்மு காஷ்மீர்', te: 'జమ్మూ కాశ్మీర్', kn: 'ಜಮ್ಮು ಕಾಶ್ಮೀರ', ml: 'ജമ്മു കശ്മീർ', bn: 'জম্মু ও কাশ্মীর', or: 'ଜମ୍ମୁ', pa: 'ਜੰਮੂ ਕਸ਼ਮੀਰ' },
  'Ladakh':               { hi: 'लद्दाख', mr: 'लडाख', gu: 'લડાખ', ta: 'லடாக்', te: 'లద్దాఖ్', kn: 'ಲಡಾಖ್', ml: 'ലഡാക്ക്', bn: 'লাদাখ', or: 'ଲଦ୍ଦାଖ', pa: 'ਲੱਦਾਖ' },
  'Lakshadweep':          { hi: 'लक्षद्वीप', mr: 'लक्षद्वीप', gu: 'લક્ષદ્વીપ', ta: 'லட்சத்தீவு', te: 'లక్షద్వీప్', kn: 'ಲಕ್ಷದ್ವೀಪ', ml: 'ലക്ഷദ്വീപ്', bn: 'লাক্ষাদ্বীপ', or: 'ଲକ୍ଷ ଦ୍ୱୀପ', pa: 'ਲਕਸ਼ਦੀਪ' },
  'Puducherry':           { hi: 'पुडुचेरी', mr: 'पुडुचेरी', gu: 'પુડુચ્ચેરી', ta: 'புதுச்சேரி', te: 'పాండిచ్చేరి', kn: 'ಪುದುಚ್ಚೇರಿ', ml: 'പുതുച്ചേരി', bn: 'পুদুচেরি', or: 'ପୁଡୁଚ୍ଚେରୀ', pa: 'ਪੁਡੂਚੇਰੀ' },
  'NCT':                  { hi: 'दिल्ली', mr: 'दिल्ली', gu: 'દિલ્હી', ta: 'தில்லி', te: 'ఢిల్లీ', kn: 'ದಿಲ್ಲಿ', ml: 'ഡൽഹി', bn: 'দিল্লি', or: 'ଦିଲ୍ଲୀ', pa: 'ਦਿੱਲੀ' },
};

// Normalize common DB variants
const STATE_ALIASES: Record<string, string> = {
  'tamilnadu': 'TamilNadu',
  'tamil nadu': 'Tamil Nadu',
  'up': 'Uttar Pradesh',
  'mp': 'Madhya Pradesh',
  'hp': 'Himachal Pradesh',
  'ap': 'Andhra Pradesh',
  'wb': 'West Bengal',
  'j&k': 'Jammu and Kashmir',
  'jk': 'Jammu and Kashmir',
  'delhi (nct)': 'Delhi',
  'nct of delhi': 'Delhi',
};

/**
 * Translates an Indian state/UT name to the given language.
 * Returns the original string if no translation is found.
 */
export function translateStateName(name: string, language: string): string {
  if (!name || language === 'en') return name;
  // Check direct match
  const direct = STATE_TRANSLATIONS[name];
  if (direct?.[language]) return direct[language];
  // Check alias
  const alias = STATE_ALIASES[name.toLowerCase()];
  if (alias) {
    const aliased = STATE_TRANSLATIONS[alias];
    if (aliased?.[language]) return aliased[language];
  }
  return name;
}

// ── Indian district / block name translation ──────────────────────────────────

/**
 * Translations for India's major labor-market districts and common tehsils/blocks.
 * Covers the top ~160 districts that appear most often in job postings.
 * Falls back to the original English string when no entry is found.
 */
const DISTRICT_TRANSLATIONS: Record<string, Record<string, string>> = {
  // ── Haryana ──────────────────────────────────────────────────────────────────
  'Gurugram':          { hi: 'गुरुग्राम', mr: 'गुरुग्राम', gu: 'ગુરુગ્રામ', ta: 'குருகிராம்', te: 'గురుగ్రామ్', kn: 'ಗುರುಗ್ರಾಮ್', ml: 'ഗുരുഗ്രാം', bn: 'গুরুগ্রাম', or: 'ଗୁରୁଗ୍ରାମ', pa: 'ਗੁਰੂਗ੍ਰਾਮ' },
  'Gurgaon':           { hi: 'गुड़गांव', mr: 'गुड़गांव', gu: 'ગુડ઼ગાંવ', ta: 'குர்கான்', te: 'గుర్గావ్', kn: 'ಗುರ್ಗಾಂವ್', ml: 'ഗുർഗാൻ', bn: 'গুড়গাঁও', or: 'ଗୁଡ଼ଗାଁ', pa: 'ਗੁੜਗਾਂਵ' },
  'Faridabad':         { hi: 'फरीदाबाद', mr: 'फरीदाबाद', gu: 'ફરીદાબાદ', ta: 'பரிதாபாத்', te: 'ఫరీదాబాద్', kn: 'ಫರೀದಾಬಾದ್', ml: 'ഫരീദാബാദ്', bn: 'ফরিদাবাদ', or: 'ଫରିଦାବାଦ', pa: 'ਫਰੀਦਾਬਾਦ' },
  'Panipat':           { hi: 'पानीपत', mr: 'पानीपत', gu: 'પાણીપત', ta: 'பானிபட்', te: 'పానీపత్', kn: 'ಪಾನಿಪತ್', ml: 'പാനിപ്പട്ട്', bn: 'পানিপথ', or: 'ପାଣିପଥ', pa: 'ਪਾਣੀਪਤ' },
  'Sonipat':           { hi: 'सोनीपत', mr: 'सोनीपत', gu: 'સોનીપત', ta: 'சோனிபட்', te: 'సోనీపత్', kn: 'ಸೋನಿಪತ್', ml: 'സോണിപത്ത്', bn: 'সোনিপথ', or: 'ସୋନିପଥ', pa: 'ਸੋਨੀਪਤ' },
  'Rohtak':            { hi: 'रोहतक', mr: 'रोहतक', gu: 'રોહ્ટક', ta: 'ரோக்தக்', te: 'రోహ్తక్', kn: 'ರೋಹ್ತಕ್', ml: 'റോഹ്തക്', bn: 'রোহতক', or: 'ରୋହ୍ତକ', pa: 'ਰੋਹਤਕ' },
  'Hisar':             { hi: 'हिसार', mr: 'हिसार', gu: 'હિસાર', ta: 'ஹிஸார்', te: 'హిసార్', kn: 'ಹಿಸಾರ್', ml: 'ഹിസ്സാർ', bn: 'হিসার', or: 'ହିସାର', pa: 'ਹਿਸਾਰ' },
  'Ambala':            { hi: 'अंबाला', mr: 'अंबाला', gu: 'અંબાલા', ta: 'அம்பாலா', te: 'అంబాలా', kn: 'ಅಂಬಾಲಾ', ml: 'അംബാല', bn: 'আম্বালা', or: 'ଅମ୍ବାଲା', pa: 'ਅੰਬਾਲਾ' },
  'Manesar':           { hi: 'मानेसर', mr: 'मानेसर', gu: 'માનેસર', ta: 'மானேசர்', te: 'మానేసర్', kn: 'ಮಾನೇಸರ್', ml: 'മനേസർ', bn: 'মানেসার', or: 'ମାନେସର', pa: 'ਮਾਨੇਸਰ' },
  // ── Gujarat ──────────────────────────────────────────────────────────────────
  'Surat':             { hi: 'सूरत', mr: 'सुरत', gu: 'સૂરત', ta: 'சூரத்', te: 'సూరత్', kn: 'ಸೂರತ್', ml: 'സൂറത്ത്', bn: 'সুরাট', or: 'ସୁରଟ', pa: 'ਸੂਰਤ' },
  'Ahmedabad':         { hi: 'अहमदाबाद', mr: 'अहमदाबाद', gu: 'અમદાવાદ', ta: 'அகமதாபாத்', te: 'అహ్మదాబాద్', kn: 'ಅಹಮದಾಬಾದ್', ml: 'അഹമ്മദാബാദ്', bn: 'আহমেদাবাদ', or: 'ଆହ୍ମଦାବାଦ', pa: 'ਅਹਿਮਦਾਬਾਦ' },
  'Vadodara':          { hi: 'वडोदरा', mr: 'वडोदरा', gu: 'વડોદરા', ta: 'வட்டோதரா', te: 'వడోదర', kn: 'ವಡೋದರ', ml: 'വഡോദര', bn: 'ভাদোদরা', or: 'ଭଦୋଦରା', pa: 'ਵਡੋਦਰਾ' },
  'Rajkot':            { hi: 'राजकोट', mr: 'राजकोट', gu: 'રાજકોટ', ta: 'ராஜ்கோட்', te: 'రాజ్‌కోట్', kn: 'ರಾಜ್‌ಕೋಟ್', ml: 'രാജ്‌കോട്ട്', bn: 'রাজকোট', or: 'ରାଜ୍‌କୋଟ', pa: 'ਰਾਜਕੋਟ' },
  'Gandhinagar':       { hi: 'गांधीनगर', mr: 'गांधीनगर', gu: 'ગાંધીનગર', ta: 'காந்திநகர்', te: 'గాంధీనగర్', kn: 'ಗಾಂಧಿನಗರ', ml: 'ഗാന്ധിനഗർ', bn: 'গান্ধীনগর', or: 'ଗାନ୍ଧୀନଗର', pa: 'ਗਾਂਧੀਨਗਰ' },
  'Bharuch':           { hi: 'भरूच', mr: 'भरूच', gu: 'ભરૂચ', ta: 'பரூச்', te: 'భరూచ్', kn: 'ಭರೂಚ್', ml: 'ഭരൂച്', bn: 'ভরুচ', or: 'ଭରୂଚ', pa: 'ਭਰੂਚ' },
  'Anand':             { hi: 'आणंद', mr: 'आणंद', gu: 'આણંદ', ta: 'ஆனந்த்', te: 'ఆనంద్', kn: 'ಆನಂದ್', ml: 'ആനന്ദ്', bn: 'আনন্দ', or: 'ଆନନ୍ଦ', pa: 'ਆਨੰਦ' },
  'Kamrej':            { hi: 'कामरेज', mr: 'कामरेज', gu: 'કામરેજ', ta: 'காம்ரேஜ்', te: 'కామ్‌రేజ్', kn: 'ಕಾಮ್ರೇಜ್', ml: 'കാംരേജ്', bn: 'কামরেজ', or: 'କାମ୍ରେଜ', pa: 'ਕਾਮਰੇਜ' },
  // ── Maharashtra ───────────────────────────────────────────────────────────────
  'Mumbai':            { hi: 'मुंबई', mr: 'मुंबई', gu: 'મુંબઈ', ta: 'மும்பை', te: 'ముంబై', kn: 'ಮುಂಬೈ', ml: 'മുംബൈ', bn: 'মুম্বাই', or: 'ମୁମ୍ବଇ', pa: 'ਮੁੰਬਈ' },
  'Pune':              { hi: 'पुणे', mr: 'पुणे', gu: 'પુણે', ta: 'புணே', te: 'పూణే', kn: 'ಪುಣೆ', ml: 'പൂനെ', bn: 'পুনে', or: 'ପୁଣେ', pa: 'ਪੁਣੇ' },
  'Nashik':            { hi: 'नाशिक', mr: 'नाशिक', gu: 'નાસિક', ta: 'நாசிக்', te: 'నాసిక్', kn: 'ನಾಸಿಕ್', ml: 'നാസിക്', bn: 'নাসিক', or: 'ନାସିକ', pa: 'ਨਾਸਿਕ' },
  'Nagpur':            { hi: 'नागपुर', mr: 'नागपूर', gu: 'નાગપુર', ta: 'நாக்பூர்', te: 'నాగ్‌పూర్', kn: 'ನಾಗ್‌ಪೂರ್', ml: 'നാഗ്പൂർ', bn: 'নাগপুর', or: 'ନାଗପୁର', pa: 'ਨਾਗਪੁਰ' },
  'Aurangabad':        { hi: 'औरंगाबाद', mr: 'औरंगाबाद', gu: 'ઔરંગાબાદ', ta: 'ஒளரங்காபாத்', te: 'ఔరంగాబాద్', kn: 'ಔರಂಗಾಬಾದ್', ml: 'ഔറംഗാബാദ്', bn: 'আওরংগাবাদ', or: 'ଔରଙ୍ଗାବାଦ', pa: 'ਔਰੰਗਾਬਾਦ' },
  'Thane':             { hi: 'ठाणे', mr: 'ठाणे', gu: 'ઠાણે', ta: 'தானே', te: 'థానే', kn: 'ಠಾಣೆ', ml: 'താനെ', bn: 'থানে', or: 'ଠାଣେ', pa: 'ਠਾਣੇ' },
  'Solapur':           { hi: 'सोलापुर', mr: 'सोलापूर', gu: 'સોલાપુર', ta: 'சோலாப்பூர்', te: 'సోలాపూర్', kn: 'ಸೊಲ್ಲಾಪೂರ್', ml: 'സോലാപൂർ', bn: 'সোলাপুর', or: 'ସୋଲାପୁର', pa: 'ਸੋਲਾਪੁਰ' },
  'Kolhapur':          { hi: 'कोल्हापुर', mr: 'कोल्हापूर', gu: 'કોલ્હાપુર', ta: 'கோல்கபூர்', te: 'కొల్హాపూర్', kn: 'ಕೊಲ್ಹಾಪೂರ್', ml: 'കൊൽഹാപൂർ', bn: 'কোলহাপুর', or: 'କୋଲ୍ହାପୁର', pa: 'ਕੋਲਹਾਪੁਰ' },
  'Pimpri-Chinchwad':  { hi: 'पिंपरी चिंचवड', mr: 'पिंपरी-चिंचवड', gu: 'પિમ્પ્રી-ચિંચવડ', ta: 'பிம்ப்ரி-சிஞ்சவாட்', te: 'పింప్రీ-చించ్వాడ్', kn: 'ಪಿಂಪ್ರಿ-ಚಿಂಚ್ವಾಡ್', ml: 'പിംപ്രി-ചിഞ്ച്വാഡ്', bn: 'পিমপ্রি-চিঞ্চওয়াড', or: 'ପିମ୍ପ୍ରୀ-ଚିଞ୍ଚୱାଡ', pa: 'ਪਿੰਪਰੀ-ਚਿੰਚਵਾੜ' },
  // ── Karnataka ────────────────────────────────────────────────────────────────
  'Bangalore':         { hi: 'बेंगलुरु', mr: 'बेंगळुरू', gu: 'બેંગ્લોર', ta: 'பெங்களூரு', te: 'బెంగళూరు', kn: 'ಬೆಂಗಳೂರು', ml: 'ബെംഗളൂരു', bn: 'বেঙ্গালুরু', or: 'ବେଙ୍ଗାଲୁରୁ', pa: 'ਬੰਗਲੂਰੂ' },
  'Bengaluru':         { hi: 'बेंगलुरु', mr: 'बेंगळुरू', gu: 'બેંગ્લોર', ta: 'பெங்களூரு', te: 'బెంగళూరు', kn: 'ಬೆಂಗಳೂರು', ml: 'ബെംഗളൂരു', bn: 'বেঙ্গালুরু', or: 'ବେଙ୍ଗାଲୁରୁ', pa: 'ਬੰਗਲੂਰੂ' },
  'Bengaluru Urban':   { hi: 'बेंगलुरु शहर', mr: 'बेंगळुरू शहर', gu: 'બેંગ્લોર શહેર', ta: 'பெங்களூரு நகர்', te: 'బెంగళూరు అర్బన్', kn: 'ಬೆಂಗಳೂರು ನಗರ', ml: 'ബെംഗളൂരു നഗര', bn: 'বেঙ্গালুরু শহর', or: 'ବେଙ୍ଗାଲୁରୁ ସହର', pa: 'ਬੰਗਲੂਰੂ ਸ਼ਹਿਰ' },
  'Kolar':             { hi: 'कोलार', mr: 'कोलार', gu: 'કોલાર', ta: 'கோலார்', te: 'కోలార్', kn: 'ಕೋಲಾರ', ml: 'കോലാർ', bn: 'কোলার', or: 'କୋଲାର', pa: 'ਕੋਲਾਰ' },
  'Mysuru':            { hi: 'मैसूरु', mr: 'म्हैसूरु', gu: 'મૈસૂરુ', ta: 'மைசூரு', te: 'మైసూరు', kn: 'ಮೈಸೂರು', ml: 'മൈസൂരു', bn: 'মাইসুরু', or: 'ମୈସୁରୁ', pa: 'ਮੈਸੂਰੂ' },
  'Mysore':            { hi: 'मैसूर', mr: 'म्हैसूर', gu: 'મૈસૂર', ta: 'மைசூர்', te: 'మైసూర్', kn: 'ಮೈಸೂರು', ml: 'മൈസൂർ', bn: 'মাইসোর', or: 'ମୈସୋର', pa: 'ਮੈਸੂਰ' },
  'Hubli-Dharwad':     { hi: 'हुबली-धारवाड़', mr: 'हुबळी-धारवाड', gu: 'હુબળી-ધારવાડ', ta: 'ஹுப்ளி-தார்வாட்', te: 'హుబ్లీ-ధార్వాడ్', kn: 'ಹುಬ್ಬಳ್ಳಿ-ಧಾರವಾಡ', ml: 'ഹുബ്ലി-ധർവാഡ്', bn: 'হুব্লি-ধারওয়াদ', or: 'ହୁବ୍ଲି-ଧାରୱାଡ', pa: 'ਹੁਬਲੀ-ਧਾਰਵਾੜ' },
  'Dharwad':           { hi: 'धारवाड़', mr: 'धारवाड', gu: 'ધારવાડ', ta: 'தார்வாட்', te: 'ధార్వాడ్', kn: 'ಧಾರವಾಡ', ml: 'ധർവാഡ്', bn: 'ধারওয়াদ', or: 'ଧାରୱାଡ', pa: 'ਧਾਰਵਾੜ' },
  'Tumkur':            { hi: 'तुमकुर', mr: 'तुमकुर', gu: 'તુમકુર', ta: 'தும்கூர்', te: 'తుమ్కూరు', kn: 'ತುಮಕೂರು', ml: 'തുംകൂർ', bn: 'তুমকুর', or: 'ତୁମ୍‌କୁରୁ', pa: 'ਤੁਮਕੁਰ' },
  'Malur':             { hi: 'मालूर', mr: 'मालूर', gu: 'માલૂર', ta: 'மாலூர்', te: 'మాలూర్', kn: 'ಮಾಲೂರು', ml: 'മാലൂർ', bn: 'মালুর', or: 'ମାଲୁର', pa: 'ਮਾਲੂਰ' },
  // ── Tamil Nadu ────────────────────────────────────────────────────────────────
  'Chennai':           { hi: 'चेन्नई', mr: 'चेन्नई', gu: 'ચેન્નઈ', ta: 'சென்னை', te: 'చెన్నై', kn: 'ಚೆನ್ನೈ', ml: 'ചെന്നൈ', bn: 'চেন্নাই', or: 'ଚେନ୍ନାଇ', pa: 'ਚੇਨਈ' },
  'Coimbatore':        { hi: 'कोयंबटूर', mr: 'कोइंबतूर', gu: 'કોઇમ્બતૂર', ta: 'கோயம்புத்தூர்', te: 'కోయంబత్తూర్', kn: 'ಕೊಯಮತ್ತೂರ್', ml: 'കോയമ്പത്തൂർ', bn: 'কোয়ম্বাটুর', or: 'କୋଇଂବଟୂର', pa: 'ਕੋਇੰਬਟੂਰ' },
  'Madurai':           { hi: 'मदुरई', mr: 'मदुराई', gu: 'મદુરાઇ', ta: 'மதுரை', te: 'మదురై', kn: 'ಮದುರೈ', ml: 'മദുരൈ', bn: 'মাদুরাই', or: 'ମଦୁରାଇ', pa: 'ਮਦੁਰਾਈ' },
  'Salem':             { hi: 'सलेम', mr: 'सेलम', gu: 'સેલમ', ta: 'சேலம்', te: 'సేలం', kn: 'ಸೇಲಂ', ml: 'സേലം', bn: 'সালেম', or: 'ସାଲେମ', pa: 'ਸੇਲਮ' },
  'Tirupur':           { hi: 'तिरुपुर', mr: 'तिरुपूर', gu: 'તિરુપ્પૂર', ta: 'திருப்பூர்', te: 'తిరుప్పూర్', kn: 'ತಿರುಪ್ಪೂರ್', ml: 'തിരുപ്പൂർ', bn: 'তিরুপুর', or: 'ତିରୁପୁର', pa: 'ਤਿਰੂਪੁਰ' },
  'Tiruchirappalli':   { hi: 'तिरुचिरापल्ली', mr: 'त्रिची', gu: 'ટ્રિચી', ta: 'திருச்சிராப்பள்ளி', te: 'తిరుచిరాపల్లి', kn: 'ತಿರುಚ್ಚಿರಾಪ್ಪಳ್ಳಿ', ml: 'തിരുച്ചിറപ്പള്ളി', bn: 'তিরুচিরাপল্লি', or: 'ତ୍ରିଚ', pa: 'ਟ੍ਰਿਚੀ' },
  'Erode':             { hi: 'इरोड', mr: 'इरोड', gu: 'ઇરોડ', ta: 'ஈரோடு', te: 'ఈరోడ్', kn: 'ಈರೋಡ್', ml: 'ഈരോഡ്', bn: 'ইরোড', or: 'ଇରୋଡ', pa: 'ਇਰੋਡ' },
  'Vellore':           { hi: 'वेल्लोर', mr: 'वेल्लोर', gu: 'વેલ્લોર', ta: 'வேலூர்', te: 'వేలూరు', kn: 'ವೆಲ್ಲೂರು', ml: 'വേലൂർ', bn: 'ভেলোর', or: 'ଭେଲ୍ଲୋର', pa: 'ਵੈਲੋਰ' },
  // ── Uttar Pradesh ─────────────────────────────────────────────────────────────
  'Lucknow':           { hi: 'लखनऊ', mr: 'लखनऊ', gu: 'લખનૌ', ta: 'லக்னோ', te: 'లక్నో', kn: 'ಲಕ್ನೌ', ml: 'ലഖ്നൗ', bn: 'লখনৌ', or: 'ଲଖ୍‌ନୌ', pa: 'ਲਖਨਊ' },
  'Kanpur':            { hi: 'कानपुर', mr: 'कानपूर', gu: 'કાનપુર', ta: 'கான்பூர்', te: 'కాన్పూర్', kn: 'ಕಾನ್ಪುರ', ml: 'കാൺപൂർ', bn: 'কানপুর', or: 'କାନ୍ପୁର', pa: 'ਕਾਨਪੁਰ' },
  'Agra':              { hi: 'आगरा', mr: 'आग्रा', gu: 'આગ્રા', ta: 'ஆக்ரா', te: 'ఆగ్రా', kn: 'ಆಗ್ರಾ', ml: 'ആഗ്ര', bn: 'আগ্রা', or: 'ଆଗ୍ରା', pa: 'ਆਗਰਾ' },
  'Varanasi':          { hi: 'वाराणसी', mr: 'वाराणसी', gu: 'વારાણસી', ta: 'வாரணாசி', te: 'వారణాసి', kn: 'ವಾರಾಣಸಿ', ml: 'വാരാണസി', bn: 'বারানসি', or: 'ବାରାଣସୀ', pa: 'ਵਾਰਾਣਸੀ' },
  'Meerut':            { hi: 'मेरठ', mr: 'मेरठ', gu: 'મેરઠ', ta: 'மீரட்', te: 'మీరట్', kn: 'ಮೀರಟ್', ml: 'മേരഠ്', bn: 'মেরঠ', or: 'ମୀରଠ', pa: 'ਮੇਰਠ' },
  'Ghaziabad':         { hi: 'गाज़ियाबाद', mr: 'गाझियाबाद', gu: 'ગાઝિયાબાદ', ta: 'காஷியாபாத்', te: 'గాజియాబాద్', kn: 'ಗಾಜಿಯಾಬಾದ್', ml: 'ഗാസിയാബാദ്', bn: 'গাজিয়াবাদ', or: 'ଗାଜ଼ିଆବାଦ', pa: 'ਗਾਜ਼ੀਆਬਾਦ' },
  'Noida':             { hi: 'नोएडा', mr: 'नोएडा', gu: 'નોઈડા', ta: 'நொய்டா', te: 'నోయిడా', kn: 'ನೋಯ್ಡಾ', ml: 'നോഇഡ', bn: 'নয়ডা', or: 'ନୋଇଡା', pa: 'ਨੋਇਡਾ' },
  'Allahabad':         { hi: 'प्रयागराज', mr: 'अलाहाबाद', gu: 'અલ્હાબાદ', ta: 'அலகாபாத்', te: 'అలహాబాద్', kn: 'ಅಲಹಾಬಾದ್', ml: 'അലഹബാദ്', bn: 'এলাহাবাদ', or: 'ଇଲାହାବାଦ', pa: 'ਇਲਾਹਾਬਾਦ' },
  'Prayagraj':         { hi: 'प्रयागराज', mr: 'प्रयागराज', gu: 'પ્રયાગરાજ', ta: 'பிரயாக்ராஜ்', te: 'ప్రయాగ్‌రాజ్', kn: 'ಪ್ರಯಾಗ್ರಾಜ್', ml: 'പ്രയഗ്‌രാജ്', bn: 'প্রয়াগরাজ', or: 'ପ୍ରୟାଗରାଜ', pa: 'ਪ੍ਰਯਾਗਰਾਜ' },
  'Gautam Buddha Nagar': { hi: 'गौतम बुद्ध नगर', mr: 'गौतमबुद्धनगर', gu: 'ગૌતમ બૌદ્ધ નગર', ta: 'கௌதம்புத்த நகர்', te: 'గౌతమ్ బుద్ధ నగర్', kn: 'ಗೌತಮ ಬುದ್ಧ ನಗರ', ml: 'ഗൗതം ബുദ്ധ നഗർ', bn: 'গৌতম বুদ্ধ নগর', or: 'ଗୌତମ ବୁଦ୍ଧ ନଗର', pa: 'ਗੌਤਮ ਬੁੱਧ ਨਗਰ' },
  // ── Delhi ────────────────────────────────────────────────────────────────────
  'New Delhi':         { hi: 'नई दिल्ली', mr: 'नवी दिल्ली', gu: 'નવી દિલ્હી', ta: 'புது தில்லி', te: 'న్యూ ఢిల్లీ', kn: 'ಹೊಸ ದೆಹಲಿ', ml: 'ന്യൂ ഡൽഹി', bn: 'নতুন দিল্লি', or: 'ନୂଆ ଦିଲ୍ଲୀ', pa: 'ਨਵੀਂ ਦਿੱਲੀ' },
  'South Delhi':       { hi: 'दक्षिण दिल्ली', mr: 'दक्षिण दिल्ली', gu: 'દક્ષિણ દિલ્હી', ta: 'தெற்கு தில்லி', te: 'దక్షిణ ఢిల్లీ', kn: 'ದಕ್ಷಿಣ ದೆಹಲಿ', ml: 'ദക്ഷിണ ഡൽഹി', bn: 'দক্ষিণ দিল্লি', or: 'ଦକ୍ଷିଣ ଦିଲ୍ଲୀ', pa: 'ਦੱਖਣੀ ਦਿੱਲੀ' },
  // ── Rajasthan ────────────────────────────────────────────────────────────────
  'Jaipur':            { hi: 'जयपुर', mr: 'जयपूर', gu: 'જયપુર', ta: 'ஜெய்ப்பூர்', te: 'జైపూర్', kn: 'ಜೈಪುರ', ml: 'ജയ്‌പൂർ', bn: 'জয়পুর', or: 'ଜୟପୁର', pa: 'ਜੈਪੁਰ' },
  'Jodhpur':           { hi: 'जोधपुर', mr: 'जोधपूर', gu: 'જોધપુર', ta: 'ஜோத்பூர்', te: 'జోధ్‌పూర్', kn: 'ಜೋಧ್ಪುರ', ml: 'ജോധ്‌പൂർ', bn: 'যোধপুর', or: 'ଜୋଧ୍‌ପୁର', pa: 'ਜੋਧਪੁਰ' },
  'Kota':              { hi: 'कोटा', mr: 'कोटा', gu: 'કોટા', ta: 'கோட்டா', te: 'కోటా', kn: 'ಕೋಟಾ', ml: 'കൊട്ട', bn: 'কোটা', or: 'କୋଟା', pa: 'ਕੋਟਾ' },
  'Udaipur':           { hi: 'उदयपुर', mr: 'उदयपूर', gu: 'ઉદયપુર', ta: 'உதய்பூர்', te: 'ఉదయ్‌పూర్', kn: 'ಉದಯ್ಪುರ', ml: 'ഉദയ്‌പൂർ', bn: 'উদয়পুর', or: 'ଉଦୟ୍‌ପୁର', pa: 'ਉਦੈਪੁਰ' },
  'Bikaner':           { hi: 'बीकानेर', mr: 'बिकानेर', gu: 'બિકાનેર', ta: 'பீகானேர்', te: 'బికానేర్', kn: 'ಬೀಕಾನೇರ್', ml: 'ബീക്കാനേർ', bn: 'বিকানের', or: 'ବିକାନେର', pa: 'ਬੀਕਾਨੇਰ' },
  'Ajmer':             { hi: 'अजमेर', mr: 'अजमेर', gu: 'અજ્મેર', ta: 'அஜ்மீர்', te: 'అజ్మేర్', kn: 'ಅಜ್ಮೇರ್', ml: 'അജ്മർ', bn: 'আজমের', or: 'ଅଜ୍‌ମେର', pa: 'ਅਜਮੇਰ' },
  // ── Punjab ────────────────────────────────────────────────────────────────────
  'Ludhiana':          { hi: 'लुधियाना', mr: 'लुधियाना', gu: 'લુધિયાણા', ta: 'லுதியானா', te: 'లూథియానా', kn: 'ಲುಧಿಯಾನ', ml: 'ലുധിയാന', bn: 'লুধিয়ানা', or: 'ଲୁଧିୟାଣା', pa: 'ਲੁਧਿਆਣਾ' },
  'Amritsar':          { hi: 'अमृतसर', mr: 'अमृतसर', gu: 'અમૃતસર', ta: 'அமிர்தசரஸ்', te: 'అమృత్‌సర్', kn: 'ಅಮೃತ್ಸರ', ml: 'അമൃത്‌സർ', bn: 'অমৃতসর', or: 'ଅମୃତସର', pa: 'ਅੰਮ੍ਰਿਤਸਰ' },
  'Jalandhar':         { hi: 'जालंधर', mr: 'जालंधर', gu: 'જલંધર', ta: 'ஜலந்தர்', te: 'జలంధర్', kn: 'ಜಾಲಂಧರ್', ml: 'ജലന്ധർ', bn: 'জলন্ধর', or: 'ଜଳଂଧର', pa: 'ਜਲੰਧਰ' },
  'Patiala':           { hi: 'पटियाला', mr: 'पटियाला', gu: 'પટિયાળા', ta: 'பட்டியாலா', te: 'పటియాలా', kn: 'ಪಟಿಯಾಲ', ml: 'പട്ടിയാല', bn: 'পাতিয়ালা', or: 'ପଟିଆଲା', pa: 'ਪਟਿਆਲਾ' },
  'Mohali':            { hi: 'मोहाली', mr: 'मोहाली', gu: 'મોહાલી', ta: 'மொகாலி', te: 'మోహాలీ', kn: 'ಮೋಹಾಲಿ', ml: 'മൊഹാലി', bn: 'মোহালি', or: 'ମୋହାଲି', pa: 'ਮੋਹਾਲੀ' },
  // ── Madhya Pradesh ────────────────────────────────────────────────────────────
  'Indore':            { hi: 'इंदौर', mr: 'इंदूर', gu: 'ઇન્દોર', ta: 'இந்தோர்', te: 'ఇండోర్', kn: 'ಇಂದೋರ್', ml: 'ഇൻഡോർ', bn: 'ইন্দোর', or: 'ଇନ୍ଦୋର', pa: 'ਇੰਦੌਰ' },
  'Bhopal':            { hi: 'भोपाल', mr: 'भोपाळ', gu: 'ભોપાલ', ta: 'போபால்', te: 'భోపాల్', kn: 'ಭೋಪಾಲ್', ml: 'ഭോപ്പാൽ', bn: 'ভোপাল', or: 'ଭୋପାଲ', pa: 'ਭੋਪਾਲ' },
  'Jabalpur':          { hi: 'जबलपुर', mr: 'जबलपूर', gu: 'જબલપુર', ta: 'ஜப்பல்பூர்', te: 'జబల్‌పూర్', kn: 'ಜಬಲ್ಪುರ', ml: 'ജബൽപൂർ', bn: 'জবলপুর', or: 'ଜବଲ୍ପୁର', pa: 'ਜਬਲਪੁਰ' },
  'Gwalior':           { hi: 'ग्वालियर', mr: 'ग्वाल्हेर', gu: 'ગ્વાલિયર', ta: 'கோவாலியர்', te: 'గ్వాలియర్', kn: 'ಗ್ವಾಲಿಯರ್', ml: 'ഗ്വാളിയർ', bn: 'গোয়ালিয়র', or: 'ଗ୍ୱାଲିଅର', pa: 'ਗਵਾਲੀਅਰ' },
  'Pithampur':         { hi: 'पीथमपुर', mr: 'पीठमपूर', gu: 'પીઠમ્પુર', ta: 'பித்தாம்பூர்', te: 'పీథంపూర్', kn: 'ಪೀಠಮ್ಪುರ', ml: 'പീഥംപൂർ', bn: 'পীথামপুর', or: 'ପୀଠମ୍ ପୁର', pa: 'ਪੀਠਾਮਪੁਰ' },
  // ── Odisha ────────────────────────────────────────────────────────────────────
  'Bhubaneswar':       { hi: 'भुवनेश्वर', mr: 'भुवनेश्वर', gu: 'ભુવનેશ્વર', ta: 'புவனேஸ்வர்', te: 'భువనేశ్వర్', kn: 'ಭುವನೇಶ್ವರ', ml: 'ഭുവനേശ്വർ', bn: 'ভুবনেশ্বর', or: 'ଭୁବନେଶ୍ୱର', pa: 'ਭੁਬਨੇਸ਼ਵਰ' },
  'Cuttack':           { hi: 'कटक', mr: 'कटक', gu: 'કટક', ta: 'கட்டக்', te: 'కటక్', kn: 'ಕಟಕ್', ml: 'കട്ടക്', bn: 'কটক', or: 'କଟକ', pa: 'ਕਟਕ' },
  'Rourkela':          { hi: 'राउरकेला', mr: 'राऊरकेला', gu: 'રૌર્કેલા', ta: 'ரவுர்கேலா', te: 'రాఉర్కేలా', kn: 'ರೌರ್ಕೆಲಾ', ml: 'റൗർക്കേല', bn: 'রৌরকেলা', or: 'ରାଉରକେଲା', pa: 'ਰਾਊਰਕੇਲਾ' },
  'Sambalpur':         { hi: 'संबलपुर', mr: 'संबलपूर', gu: 'સંબલ્પૂર', ta: 'சம்பல்பூர்', te: 'సంబల్‌పూర్', kn: 'ಸಂಬಲ್ಪುರ', ml: 'സംബൽപൂർ', bn: 'সম্বলপুর', or: 'ସମ୍ବଲପୁର', pa: 'ਸੰਭਲਪੁਰ' },
  // ── West Bengal ───────────────────────────────────────────────────────────────
  'Kolkata':           { hi: 'कोलकाता', mr: 'कोलकाता', gu: 'કોલકાતા', ta: 'கொல்கத்தா', te: 'కోల్‌కతా', kn: 'ಕೋಲ್ಕತ್ತಾ', ml: 'കൊൽക്കത്ത', bn: 'কলকাতা', or: 'କୋଲ୍‌କାତା', pa: 'ਕੋਲਕਾਤਾ' },
  'Howrah':            { hi: 'हावड़ा', mr: 'हावडा', gu: 'હોવ્રા', ta: 'ஹவ்ரா', te: 'హౌరా', kn: 'ಹೌರಾ', ml: 'ഹൗറ', bn: 'হাওড়া', or: 'ହାଓଡ଼ା', pa: 'ਹਾਵੜਾ' },
  'Asansol':           { hi: 'आसनसोल', mr: 'आसनसोल', gu: 'આસાનસોલ', ta: 'ஆசன்சோல்', te: 'ఆసన్సోల్', kn: 'ಆಸಾನ್ಸೋಲ್', ml: 'ആസൻസോൾ', bn: 'আসানসোল', or: 'ଆସାନ୍‌ସୋଲ', pa: 'ਆਸਾਨਸੋਲ' },
  'Durgapur':          { hi: 'दुर्गापुर', mr: 'दुर्गापूर', gu: 'દુર્ગાપુર', ta: 'துர்காபூர்', te: 'దుర్గాపూర్', kn: 'ದುರ್ಗಾಪುರ', ml: 'ദുർഗ്ഗാപൂർ', bn: 'দুর্গাপুর', or: 'ଦୁର୍ଗାପୁର', pa: 'ਦੁਰਗਾਪੁਰ' },
  // ── Bihar ────────────────────────────────────────────────────────────────────
  'Patna':             { hi: 'पटना', mr: 'पाटणा', gu: 'પટના', ta: 'பட்னா', te: 'పట్నా', kn: 'ಪಟ್ನ', ml: 'പട്ന', bn: 'পাটনা', or: 'ପଟ୍ନା', pa: 'ਪਟਨਾ' },
  'Gaya':              { hi: 'गया', mr: 'गया', gu: 'ગયા', ta: 'கயா', te: 'గయా', kn: 'ಗಯಾ', ml: 'ഗയ', bn: 'গয়া', or: 'ଗୟା', pa: 'ਗਯਾ' },
  'Bhagalpur':         { hi: 'भागलपुर', mr: 'भागलपूर', gu: 'ભાગળપૂર', ta: 'பாகல்பூர்', te: 'భాగల్‌పూర్', kn: 'ಭಾಗಲ್ಪುರ', ml: 'ഭഗൽപൂർ', bn: 'ভাগলপুর', or: 'ଭାଗଲ୍‌ପୁର', pa: 'ਭਾਗਲਪੁਰ' },
  // ── Telangana ─────────────────────────────────────────────────────────────────
  'Hyderabad':         { hi: 'हैदराबाद', mr: 'हैदराबाद', gu: 'હૈદ્રાબાદ', ta: 'ஹைதராபாத்', te: 'హైదరాబాద్', kn: 'ಹೈದರಾಬಾದ್', ml: 'ഹൈദരാബാദ്', bn: 'হায়দরাবাদ', or: 'ହୈଦ୍ରାବାଦ', pa: 'ਹੈਦਰਾਬਾਦ' },
  'Rangareddy':        { hi: 'रंगारेड्डी', mr: 'रंगारेड्डी', gu: 'રંગારેડ્ડી', ta: 'ரங்காரெட்டி', te: 'రంగారెడ్డి', kn: 'ರಂಗಾರೆಡ್ಡಿ', ml: 'റംഗ്‌ അരെഡ്ഡി', bn: 'রঙ্গারেড্ডি', or: 'ରଙ୍ଗାରେଡ୍ଡି', pa: 'ਰੰਗਾਰੈੱਡੀ' },
  'Warangal':          { hi: 'वारंगल', mr: 'वारंगल', gu: 'વારંગલ', ta: 'வாரங்கல்', te: 'వరంగల్', kn: 'ವಾರಂಗಲ್', ml: 'വാറങ്കൽ', bn: 'ওয়ারাঙ্গল', or: 'ୱାରଙ୍ଗଲ', pa: 'ਵਾਰੰਗਲ' },
  // ── Andhra Pradesh ────────────────────────────────────────────────────────────
  'Visakhapatnam':     { hi: 'विशाखापट्टनम', mr: 'विशाखापट्टणम', gu: 'વિઝ઼ઍગ', ta: 'விசாகப்பட்டினம்', te: 'విశాఖపట్నం', kn: 'ವಿಶಾಖಪಟ್ಟಣ', ml: 'വിശാഖപട്ടണം', bn: 'বিশাখাপত্তনম', or: 'ବିଶାଖାପଟ୍ଟଣମ', pa: 'ਵਿਸ਼ਾਖਾਪਟਨਮ' },
  'Vijayawada':        { hi: 'विजयवाड़ा', mr: 'विजयवाडा', gu: 'વિજ઼ઍg', ta: 'விஜயவாடா', te: 'విజయవాడ', kn: 'ವಿಜಯವಾಡ', ml: 'വിജയവാഡ', bn: 'বিজয়ওয়াড়া', or: 'ବିଜୟୱାଡ଼ା', pa: 'ਵਿਜੇਵਾੜਾ' },
  'Guntur':            { hi: 'गुंटूर', mr: 'गुंटूर', gu: 'ગ઼ünter', ta: 'குண்டூர்', te: 'గుంటూరు', kn: 'ಗುಂಟೂರು', ml: 'ഗുണ്ടൂർ', bn: 'গুন্টুর', or: 'ଗୁଣ୍ଟୁର', pa: 'ਗੁੰਟੂਰ' },
  'Nellore':           { hi: 'नेल्लोर', mr: 'नेल्लोर', gu: 'નેલ્લૂર', ta: 'நெல்லூர்', te: 'నెల్లూరు', kn: 'ನೆಲ್ಲೂರು', ml: 'നെല്ലൂർ', bn: 'নেলোর', or: 'ନେଲ୍ଲୋର', pa: 'ਨੇਲੋਰ' },
  // ── Kerala ────────────────────────────────────────────────────────────────────
  'Ernakulam':         { hi: 'एर्नाकुलम', mr: 'एर्नाकुलम', gu: 'એર્નાકુલમ', ta: 'எர்ணாகுளம்', te: 'ఎర్నాకులం', kn: 'ಎರ್ನಾಕುಲಂ', ml: 'എറണാകുളം', bn: 'এর্নাকুলাম', or: 'ଏର୍ଣ୍ଣାକୁଲମ', pa: 'ਅਰਨਾਕੁਲਮ' },
  'Thiruvananthapuram':{ hi: 'तिरुवनंतपुरम', mr: 'तिरुवनंतपुरम', gu: 'ત્રિવેન્દ્રમ', ta: 'திருவனந்தபுரம்', te: 'తిరువనంతపురం', kn: 'ತಿರುವನಂತಪುರಂ', ml: 'തിരുവനന്തപുരം', bn: 'তিরুবনন্তপুরম', or: 'ତିରୁବନନ୍ତପୁରମ', pa: 'ਤਿਰੂਵਨੰਤਪੁਰਮ' },
  'Kozhikode':         { hi: 'कोझिकोड', mr: 'कोझिकोड', gu: 'કોઝિકોડ', ta: 'கோழிக்கோடு', te: 'కోజికోడ్', kn: 'ಕೋಝಿಕೋಡ್', ml: 'കോഴിക്കോട്', bn: 'কোঝিকোড', or: 'କୋଝ଼ିକୋଡ', pa: 'ਕੋਜ਼ੀਕੋਡ' },
  'Thrissur':          { hi: 'त्रिशूर', mr: 'त्रिशूर', gu: 'ત્રિશૂર', ta: 'திருச்சூர்', te: 'త్రిచూర్', kn: 'ತ್ರಿಶ್ಶೂರ್', ml: 'തൃശ്ശൂർ', bn: 'ত্রিশূর', or: 'ତ୍ରିଶ୍ସୂର', pa: 'ਤ੍ਰਿਸ਼ੂਰ' },
  'Malappuram':        { hi: 'मलप्पुरम', mr: 'मलप्पुरम', gu: 'મલ્લ઼ップ', ta: 'மலப்புரம்', te: 'మలప్పురం', kn: 'ಮಲಪ್ಪುರಂ', ml: 'മലപ്പുറം', bn: 'মালাপ্পুরাম', or: 'ମଲ୍ଲ଼ Puram', pa: 'ਮਲੱਪੁਰਮ' },
};

/**
 * Translates an Indian district or block (tehsil) name to the given language.
 * Returns the original string if no translation is found.
 */
export function translateLocationName(name: string, language: string): string {
  if (!name || language === 'en') return name;
  const translation = DISTRICT_TRANSLATIONS[name];
  if (translation?.[language]) return translation[language];
  return name;
}

/**
 * Builds the location string for a requirement card, translating state, district and block.
 * Format: tehsil, district, state (in user's language where possible).
 */
export function getLocationStr(
  opts: { tehsil?: string; district?: string; state?: string },
  language: string,
  panIndiaLabel: string,
): string {
  const { tehsil, district, state } = opts;
  const translatedState    = state    ? translateStateName(state,    language) : undefined;
  const translatedDistrict = district ? translateLocationName(district, language) : undefined;
  const translatedTehsil   = tehsil   ? translateLocationName(tehsil,   language) : undefined;
  const parts = [translatedTehsil, translatedDistrict, translatedState].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : panIndiaLabel;
}

// ── Worker/Agent profile completeness ────────────────────────────────────────
export function isWorkerProfileComplete(user: UserProfile | null | undefined): boolean {
  if (!user) return true;
  const role = (user.role ?? '').toLowerCase();
  if (!['selfworker', 'worker', 'agent'].includes(role)) return true;
  return !!(user.gender && user.dob);
}
