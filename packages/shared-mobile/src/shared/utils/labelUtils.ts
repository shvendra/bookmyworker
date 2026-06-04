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
  tamillabel?: string;
  telugulabel?: string;
  kannadalabel?: string;
  malayalamlabel?: string;
  banglalabel?: string;
  odialabel?: string;
  punjabilabel?: string;
}

const ALL_CATS = categoriesData as CatEntry[];

// Maps i18n language code → field name in categories.json. categories.json ships
// a per-language label for every subcategory across all 11 languages (see also the
// shared [[categoryLabels]] subcatDisplay helper which reads the same fields).
const LANG_FIELD: Record<string, keyof SubEntry> = {
  hi: 'hindilabel',
  mr: 'marathilabel',
  gu: 'gujaratilabel',
  ta: 'tamillabel',
  te: 'telugulabel',
  kn: 'kannadalabel',
  ml: 'malayalamlabel',
  bn: 'banglalabel',
  or: 'odialabel',
  pa: 'punjabilabel',
};

// ── Work-type translation ─────────────────────────────────────────────────────

// Maps free-text / employer-entered workType strings (stored in DB) to standard category values.
// Keys are lowercase-normalized; values must match a WORK_CATEGORIES entry.
const LEGACY_WORK_TYPE_MAP: Record<string, string> = {
  // Office / retail variants
  'office staff':                         'retail_shop_workers',
  'office worker':                        'retail_shop_workers',
  'office workers':                       'retail_shop_workers',
  'office':                               'retail_shop_workers',
  'retail service workers':               'retail_shop_workers',
  'retail and shop workers':              'retail_shop_workers',
  'retail and service workers':           'retail_shop_workers',
  'retail shop workers':                  'retail_shop_workers',
  'retail service':                       'retail_shop_workers',
  // Construction
  'construction and project workers':     'construction_project_workers',
  'construction project workers':         'construction_project_workers',
  // Manufacturing
  'manufacturing and industrial workers': 'manufacturing_industrial_workers',
  'manufacturing industrial workers':     'manufacturing_industrial_workers',
  // Agriculture
  'agriculture and farming workers':      'agriculture_farming_workers',
  'agriculture farming workers':          'agriculture_farming_workers',
  // Events
  'event and decoration workers':         'event_decoration_workers',
  'event decoration workers':             'event_decoration_workers',
  // Household
  'household and domestic workers':       'household_domestic_workers',
  'household domestic workers':           'household_domestic_workers',
  // Hospitality
  'hospitality and service workers':      'hospitality_service_workers',
  'hospitality service workers':          'hospitality_service_workers',
  // Transport
  'transport and logistics workers':      'transport_logistics_workers',
  'transport logistics workers':          'transport_logistics_workers',
  // Skilled / Creative / Security / Auto / Healthcare
  'skilled technical workers':            'skilled_technical_workers',
  'specialized and creative workers':     'specialized_creative_workers',
  'specialized creative workers':         'specialized_creative_workers',
  'security and facility workers':        'Security & Facility Workers',
  'security facility workers':            'Security & Facility Workers',
  'security facility worker':             'Security & Facility Workers',
  'automobile and workshop workers':      'Automobile & Workshop Workers',
  'automobile workshop workers':          'Automobile & Workshop Workers',
  'healthcare support workers':           'Healthcare Support Workers',
};

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

  // 1.5. Legacy / free-text alias match (employer-entered strings not in taxonomy)
  const legacyCatValue = LEGACY_WORK_TYPE_MAP[lower];
  if (legacyCatValue) {
    const legacyCat = WORK_CATEGORIES.find((c) => c.value === legacyCatValue);
    if (legacyCat) return t(legacyCat.translationKey as TranslationKeys);
  }

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

  // 3. Final fallback: readable English (trimmed to avoid trailing spaces)
  return value
    .replace(/_/g, ' ')
    .replace(/ workers?$/i, '')
    .trim()
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
  const lower   = value.toLowerCase().trim();
  // Strip trailing role words for fuzzy matching: "Room Service" ↔ "Room Service Staff"
  const SUFFIX  = /\s+(staff|worker|workers|helper|operator|executive|assistant|person)$/i;
  const stripped = lower.replace(SUFFIX, '').trim();

  // Also strip common leading context words: "Hotel Housekeeping" → "housekeeping"
  const PREFIX = /^(hotel|office|factory|hospital|school|shop|store|warehouse|site|field)\s+/i;
  const core = stripped.replace(PREFIX, '').trim();

  let bestMatch: SubEntry | undefined;
  let bestScore = 0;

  for (const cat of ALL_CATS) {
    for (const sub of cat.subcategories) {
      const svl = (sub.value ?? '').toLowerCase();
      const sll = (sub.label ?? '').toLowerCase();
      const ssl = sll.replace(SUFFIX, '').replace(PREFIX, '').trim();

      // 1. Exact match (highest priority)
      if (svl === lower || sll === lower) { bestMatch = sub; bestScore = 4; break; }

      // 2. Stripped exact
      if (bestScore < 3 && (ssl === stripped || ssl === core)) { bestMatch = sub; bestScore = 3; }

      // 3. Prefix match: one starts with the other
      if (bestScore < 2 && (ssl.startsWith(stripped) || stripped.startsWith(ssl) || ssl.startsWith(core) || core.startsWith(ssl))) {
        bestMatch = sub; bestScore = 2;
      }

      // 4. Substring containment: "hotel housekeeping" contains "housekeeping"
      if (bestScore < 1 && (stripped.includes(ssl) || ssl.includes(stripped) || stripped.includes(core) || core.includes(ssl))) {
        bestMatch = sub; bestScore = 1;
      }
    }
    if (bestScore === 4) break;
  }
  if (bestMatch) {
    if (fieldKey && bestMatch[fieldKey]) return bestMatch[fieldKey] as string;
    return bestMatch.label;
  }
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Unified occupational-label translator for a worker's `areasOfWork` / skill
 * chips, where a stored value may be EITHER a top-level category (e.g.
 * "construction project workers" / "agriculture farming workers") OR a
 * sub-category (e.g. "lmv driver" / "other retail"). Top-level categories are
 * translated via the `cat_*` i18n keys (all 11 langs, through getWorkTypeLabel);
 * everything else goes through getSubCatLabel (value+label+fuzzy, all 11 langs).
 * Display-only — stored English value is never changed.
 */
export function getOccupationLabel(
  value: string | null | undefined,
  t: TFunction,
  language: string,
): string {
  if (!value) return '';
  const norm = String(value).toLowerCase().replace(/[\s_&/-]+/g, ' ').trim();
  const isCategory =
    !!LEGACY_WORK_TYPE_MAP[norm] ||
    WORK_CATEGORIES.some((c) => {
      const cv = String(c.value).toLowerCase().replace(/[\s_&/-]+/g, ' ').trim();
      const cl = String(c.label).toLowerCase().replace(/[\s_&/-]+/g, ' ').trim();
      return cv === norm || cl === norm;
    });
  return isCategory ? getWorkTypeLabel(value, t) : getSubCatLabel(value, language);
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
  'Rewa':              { hi: 'रीवा', mr: 'रीवा', gu: 'રીવા', ta: 'ரேவா', te: 'రేవా', kn: 'ರೇವಾ', ml: 'രേവ', bn: 'রেওয়া', or: 'ରେୱା', pa: 'ਰੀਵਾ' },
  'Satna':             { hi: 'सतना', mr: 'सतना', gu: 'સતના', ta: 'சத்னா', te: 'సత్నా', kn: 'ಸತ್ನಾ', ml: 'സത്ന', bn: 'সতনা', or: 'ସତନା', pa: 'ਸਤਨਾ' },
  'Sagar':             { hi: 'सागर', mr: 'सागर', gu: 'સાગર', ta: 'சாகர்', te: 'సాగర్', kn: 'ಸಾಗರ್', ml: 'സാഗർ', bn: 'সাগর', or: 'ସାଗର', pa: 'ਸਾਗਰ' },
  'Ujjain':            { hi: 'उज्जैन', mr: 'उज्जैन', gu: 'ઉજ્જૈન', ta: 'உஜ்ஜைன்', te: 'ఉజ్జయిని', kn: 'ಉಜ್ಜಯಿನಿ', ml: 'ഉജ്ജയിൻ', bn: 'উজ্জয়িনী', or: 'ଉଜ୍ଜୈନ', pa: 'ਉਜੈਨ' },
  'Dewas':             { hi: 'देवास', mr: 'देवास', gu: 'દેવાસ', ta: 'தேவாஸ்', te: 'దేవాస్', kn: 'ದೇವಾಸ್', ml: 'ദേവാസ്', bn: 'দেবাস', or: 'ଦେୱାସ', pa: 'ਦੇਵਾਸ' },
  'Ratlam':            { hi: 'रतलाम', mr: 'रतलाम', gu: 'રતલામ', ta: 'ரத்லாம்', te: 'రత్లాం', kn: 'ರತ್ಲಾಂ', ml: 'രത്‌ലാം', bn: 'রতলাম', or: 'ରତଲାମ', pa: 'ਰਤਲਾਮ' },
  'Singrauli':         { hi: 'सिंगरौली', mr: 'सिंगरौली', gu: 'સિંગરૌલી', ta: 'சிங்ரௌலி', te: 'సింగ్రౌలి', kn: 'ಸಿಂಗ್ರೌಲಿ', ml: 'സിംഗ്രൗലി', bn: 'সিংরৌলি', or: 'ସିଂରାଉଲି', pa: 'ਸਿੰਗਰੌਲੀ' },
  'Katni':             { hi: 'कटनी', mr: 'कटनी', gu: 'કટની', ta: 'கட்னி', te: 'కట్నీ', kn: 'ಕಟ್ನಿ', ml: 'കട്നി', bn: 'কটনি', or: 'କଟନୀ', pa: 'ਕਟਨੀ' },
  'Chhindwara':        { hi: 'छिंदवाड़ा', mr: 'छिंदवाडा', gu: 'છિંદવાડા', ta: 'சிந்த்வாரா', te: 'ఛింద్వారా', kn: 'ಛಿಂದ್ವಾಡಾ', ml: 'ഛിന്ദ്വാഡ', bn: 'ছিন্দওয়াড়া', or: 'ଛିନ୍ଦୱାଡ଼ା', pa: 'ਛਿੰਦਵਾੜਾ' },
  'Sehore':            { hi: 'सीहोर', mr: 'सीहोर', gu: 'સીહોર', ta: 'சீகோர்', te: 'సీహోర్', kn: 'ಸೀಹೋರ್', ml: 'സീഹോർ', bn: 'সিহোর', or: 'ସୀହୋର', pa: 'ਸੀਹੋਰ' },
  'Vidisha':           { hi: 'विदिशा', mr: 'विदिशा', gu: 'વિદિશા', ta: 'விதிஷா', te: 'విదిశ', kn: 'ವಿದಿಶಾ', ml: 'വിദിശ', bn: 'বিদিশা', or: 'ବିଦିଶା', pa: 'ਵਿਦਿਸ਼ਾ' },
  'Shivpuri':          { hi: 'शिवपुरी', mr: 'शिवपुरी', gu: 'શિવપુરી', ta: 'சிவ்புரி', te: 'శివపురి', kn: 'ಶಿವಪುರಿ', ml: 'ശിവപുരി', bn: 'শিবপুরী', or: 'ଶିବପୁରୀ', pa: 'ਸ਼ਿਵਪੁਰੀ' },
  'Morena':            { hi: 'मुरैना', mr: 'मुरैना', gu: 'મુરૈના', ta: 'மொரேனா', te: 'మొరేనా', kn: 'ಮೊರೇನಾ', ml: 'മൊരേന', bn: 'মোরেনা', or: 'ମୋରେନା', pa: 'ਮੁਰੈਨਾ' },
  'Khargone':          { hi: 'खरगोन', mr: 'खरगोन', gu: 'ખરગોન', ta: 'கர்கோன்', te: 'ఖర్‌గోన్', kn: 'ಖರ್ಗೋನ್', ml: 'ഖർഗോൻ', bn: 'খরগোন', or: 'ଖରଗୋନ', pa: 'ਖਰਗੋਨ' },
  'Khandwa':           { hi: 'खंडवा', mr: 'खंडवा', gu: 'ખંડવા', ta: 'கண்ட்வா', te: 'ఖండ్వా', kn: 'ಖಂಡ್ವಾ', ml: 'ഖണ്ഡ്വ', bn: 'খান্ডোয়া', or: 'ଖଣ୍ଡୱା', pa: 'ਖੰਡਵਾ' },
  'Mandsaur':          { hi: 'मंदसौर', mr: 'मंदसौर', gu: 'મંદસૌર', ta: 'மந்த்சௌர்', te: 'మంద్‌సౌర్', kn: 'ಮಂದ್‌ಸೌರ್', ml: 'മന്ദ്‌സൗർ', bn: 'মন্দসৌর', or: 'ମନ୍ଦସୌର', pa: 'ਮੰਦਸੌਰ' },
  'Neemuch':           { hi: 'नीमच', mr: 'नीमच', gu: 'નીમચ', ta: 'நீமச்', te: 'నీముచ్', kn: 'ನೀಮಚ್', ml: 'നീമച്', bn: 'নিমচ', or: 'ନୀମଚ', pa: 'ਨੀਮਚ' },
  'Chhatarpur':        { hi: 'छतरपुर', mr: 'छतरपूर', gu: 'છતરપુર', ta: 'சத்தர்பூர்', te: 'ఛతర్‌పూర్', kn: 'ಛತರ್ಪುರ', ml: 'ഛതർപൂർ', bn: 'ছতরপুর', or: 'ଛତରପୁର', pa: 'ਛਤਰਪੁਰ' },
  'Damoh':             { hi: 'दमोह', mr: 'दमोह', gu: 'દમોહ', ta: 'தமோ', te: 'దమోహ్', kn: 'ದಮೋಹ್', ml: 'ദമോഹ്', bn: 'দমোহ', or: 'ଦମୋହ', pa: 'ਦਮੋਹ' },
  'Narmadapuram':      { hi: 'नर्मदापुरम', mr: 'नर्मदापुरम', gu: 'નર્મદાપુરમ', ta: 'நர்மதாபுரம்', te: 'నర్మదాపురం', kn: 'ನರ್ಮದಾಪುರಂ', ml: 'നർമ്മദാപുരം', bn: 'নর্মদাপুরম', or: 'ନର୍ମଦାପୁରମ', pa: 'ਨਰਮਦਾਪੁਰਮ' },
  'Hoshangabad':       { hi: 'होशंगाबाद', mr: 'होशंगाबाद', gu: 'હોશંગાબાદ', ta: 'ஹோஷங்காபாத்', te: 'హోషంగాబాద్', kn: 'ಹೋಶಂಗಾಬಾದ್', ml: 'ഹോശംഗാബാദ്', bn: 'হোশঙ্গাবাদ', or: 'ହୋଶଙ୍ଗାବାଦ', pa: 'ਹੋਸ਼ੰਗਾਬਾਦ' },
  'Betul':             { hi: 'बैतूल', mr: 'बैतूल', gu: 'બૈતૂલ', ta: 'பைதூல்', te: 'బైతూల్', kn: 'ಬೈತೂಲ್', ml: 'ബൈതൂൽ', bn: 'বৈতুল', or: 'ବୈତୂଲ', pa: 'ਬੈਤੂਲ' },
  'Balaghat':          { hi: 'बालाघाट', mr: 'बालाघाट', gu: 'બાલાઘાટ', ta: 'பாலாகாட்', te: 'బాలాఘాట్', kn: 'ಬಾಲಾಘಾಟ್', ml: 'ബാലാഘാട്', bn: 'বালাঘাট', or: 'ବାଲାଘାଟ', pa: 'ਬਾਲਾਘਾਟ' },
  'Seoni':             { hi: 'सिवनी', mr: 'सिवनी', gu: 'સિવની', ta: 'சியோனி', te: 'సియోని', kn: 'ಸಿವನಿ', ml: 'സിയോനി', bn: 'সিওনি', or: 'ସିଓନୀ', pa: 'ਸਿਵਨੀ' },
  'Shahdol':           { hi: 'शहडोल', mr: 'शहडोल', gu: 'શહડોલ', ta: 'ஷாஹ்தோல்', te: 'షహ్‌దోల్', kn: 'ಶಹ್‌ಡೋಲ್', ml: 'ഷഹ്‌ഡോൾ', bn: 'শাহডোল', or: 'ଶହଡୋଲ', pa: 'ਸ਼ਹਡੋਲ' },
  'Sidhi':             { hi: 'सीधी', mr: 'सीधी', gu: 'સીધી', ta: 'சீதி', te: 'సీధీ', kn: 'ಸೀಧಿ', ml: 'സീധി', bn: 'সিধি', or: 'ସୀଧୀ', pa: 'ਸੀਧੀ' },
  'Tikamgarh':         { hi: 'टीकमगढ़', mr: 'टीकमगड', gu: 'ટીકમગઢ', ta: 'டிகம்கர்', te: 'టీకంగఢ్', kn: 'ಟೀಕಮ್‌ಗಢ್', ml: 'ടീകംഗഢ്', bn: 'টিকমগড়', or: 'ଟୀକମଗଡ଼', pa: 'ਟੀਕਮਗੜ੍ਹ' },
  'Datia':             { hi: 'दतिया', mr: 'दतिया', gu: 'દતિયા', ta: 'தத்தியா', te: 'దతియా', kn: 'ದತಿಯಾ', ml: 'ദതിയ', bn: 'দতিয়া', or: 'ଦତିଆ', pa: 'ਦਤੀਆ' },
  'Guna':              { hi: 'गुना', mr: 'गुना', gu: 'ગુના', ta: 'குனா', te: 'గునా', kn: 'ಗುನಾ', ml: 'ഗുന', bn: 'গুনা', or: 'ଗୁନା', pa: 'ਗੁਨਾ' },
  'Ashoknagar':        { hi: 'अशोकनगर', mr: 'अशोकनगर', gu: 'અશોકનગર', ta: 'அசோக்நகர்', te: 'అశోక్‌నగర్', kn: 'ಅಶೋಕ್‌ನಗರ', ml: 'അശോക്‌നഗർ', bn: 'অশোকনগর', or: 'ଅଶୋକନଗର', pa: 'ਅਸ਼ੋਕਨਗਰ' },
  'Rajgarh':           { hi: 'राजगढ़', mr: 'राजगड', gu: 'રાજગઢ', ta: 'ராஜ்கர்', te: 'రాజ్‌గఢ్', kn: 'ರಾಜ್‌ಗಢ್', ml: 'രാജ്‌ഗഢ്', bn: 'রাজগড়', or: 'ରାଜଗଡ଼', pa: 'ਰਾਜਗੜ੍ਹ' },
  'Burhanpur':         { hi: 'बुरहानपुर', mr: 'बुऱ्हाणपूर', gu: 'બુરહાનપુર', ta: 'புர்ஹான்பூர்', te: 'బుర్‌హాన్‌పూర్', kn: 'ಬುರ್‌ಹಾನ್‌ಪುರ', ml: 'ബുർഹാൻപൂർ', bn: 'বুরহানপুর', or: 'ବୁରହାନପୁର', pa: 'ਬੁਰਹਾਨਪੁਰ' },
  'Barwani':           { hi: 'बड़वानी', mr: 'बडवानी', gu: 'બડવાની', ta: 'பர்வானி', te: 'బర్వానీ', kn: 'ಬರ್ವಾನಿ', ml: 'ബർവാനി', bn: 'বরওয়ানি', or: 'ବରୱାନୀ', pa: 'ਬੜਵਾਨੀ' },
  'Dhar':              { hi: 'धार', mr: 'धार', gu: 'ધાર', ta: 'தார்', te: 'ధార్', kn: 'ಧಾರ್', ml: 'ധാർ', bn: 'ধার', or: 'ଧାର', pa: 'ਧਾਰ' },
  'Jhabua':            { hi: 'झाबुआ', mr: 'झाबुआ', gu: 'ઝાબુઆ', ta: 'ஜாபுவா', te: 'ఝాబువా', kn: 'ಝಾಬುವಾ', ml: 'ഝാബുവ', bn: 'ঝাবুয়া', or: 'ଝାବୁଆ', pa: 'ਝਾਬੁਆ' },
  'Alirajpur':         { hi: 'अलीराजपुर', mr: 'अलीराजपूर', gu: 'અલીરાજપુર', ta: 'அலிராஜ்பூர்', te: 'అలీరాజ్‌పూర్', kn: 'ಅಲೀರಾಜ್‌ಪುರ', ml: 'അലിരാജ്‌പൂർ', bn: 'আলিরাজপুর', or: 'ଅଲୀରାଜପୁର', pa: 'ਅਲੀਰਾਜਪੁਰ' },
  'Harda':             { hi: 'हरदा', mr: 'हरदा', gu: 'હરદા', ta: 'ஹர்தா', te: 'హర్దా', kn: 'ಹರ್ದಾ', ml: 'ഹർദ', bn: 'হরদা', or: 'ହରଦା', pa: 'ਹਰਦਾ' },
  'Raisen':            { hi: 'रायसेन', mr: 'रायसेन', gu: 'રાયસેન', ta: 'ராய்சேன்', te: 'రాయసేన్', kn: 'ರಾಯ್‌ಸೇನ್', ml: 'റായ്‌സേൻ', bn: 'রায়সেন', or: 'ରାଇସେନ', pa: 'ਰਾਇਸੇਨ' },
  'Narsinghpur':       { hi: 'नरसिंहपुर', mr: 'नरसिंहपूर', gu: 'નરસિંહપુર', ta: 'நரசிங்பூர்', te: 'నరసింహపూర్', kn: 'ನರಸಿಂಹಪುರ', ml: 'നരസിംഹപൂർ', bn: 'নরসিংহপুর', or: 'ନରସିଂହପୁର', pa: 'ਨਰਸਿੰਘਪੁਰ' },
  'Mandla':            { hi: 'मंडला', mr: 'मंडला', gu: 'મંડલા', ta: 'மண்ட்லா', te: 'మండ్లా', kn: 'ಮಂಡ್ಲಾ', ml: 'മണ്ഡ്ല', bn: 'মান্ডলা', or: 'ମଣ୍ଡଲା', pa: 'ਮੰਡਲਾ' },
  'Dindori':           { hi: 'डिंडोरी', mr: 'डिंडोरी', gu: 'ડિંડોરી', ta: 'டிண்டோரி', te: 'డిండోరి', kn: 'ಡಿಂಡೋರಿ', ml: 'ഡിണ്ടോരി', bn: 'ডিন্ডোরি', or: 'ଡିଣ୍ଡୋରୀ', pa: 'ਡਿੰਡੋਰੀ' },
  'Umaria':            { hi: 'उमरिया', mr: 'उमरिया', gu: 'ઉમરિયા', ta: 'உமரியா', te: 'ఉమరియా', kn: 'ಉಮರಿಯಾ', ml: 'ഉമരിയ', bn: 'উমারিয়া', or: 'ଉମରିଆ', pa: 'ਉਮਰੀਆ' },
  'Anuppur':           { hi: 'अनूपपुर', mr: 'अनूपपूर', gu: 'અનૂપપુર', ta: 'அனுப்பூர்', te: 'అనూప్‌పూర్', kn: 'ಅನೂಪ್‌ಪುರ', ml: 'അനൂപ്‌പൂർ', bn: 'অনুপপুর', or: 'ଅନୂପପୁର', pa: 'ਅਨੂਪਪੁਰ' },
  'Panna':             { hi: 'पन्ना', mr: 'पन्ना', gu: 'પન્ના', ta: 'பன்னா', te: 'పన్నా', kn: 'ಪನ್ನಾ', ml: 'പന്ന', bn: 'পান্না', or: 'ପନ୍ନା', pa: 'ਪੰਨਾ' },
  'Niwari':            { hi: 'निवाड़ी', mr: 'निवाडी', gu: 'નિવાડી', ta: 'நிவாரி', te: 'నివారి', kn: 'ನಿವಾರಿ', ml: 'നിവാരി', bn: 'নিওয়াড়ি', or: 'ନିୱାଡ଼ି', pa: 'ਨਿਵਾੜੀ' },
  'Sheopur':           { hi: 'श्योपुर', mr: 'श्योपूर', gu: 'શ્યોપુર', ta: 'ஷியோபூர்', te: 'శ్యోపూర్', kn: 'ಶ್ಯೋಪುರ', ml: 'ശ്യോപൂർ', bn: 'শ্যোপুর', or: 'ଶ୍ୟୋପୁର', pa: 'ਸ਼ਿਓਪੁਰ' },
  'Bhind':             { hi: 'भिंड', mr: 'भिंड', gu: 'ભિંડ', ta: 'பிண்ட்', te: 'భింద్', kn: 'ಭಿಂಡ್', ml: 'ഭിണ്ഡ്', bn: 'ভিন্ড', or: 'ଭିଣ୍ଡ', pa: 'ਭਿੰਡ' },
  'Agar Malwa':        { hi: 'आगर मालवा', mr: 'आगर मालवा', gu: 'આગર માલવા', ta: 'ஆகர் மால்வா', te: 'ఆగర్ మాల్వా', kn: 'ಆಗರ್ ಮಾಲ್ವಾ', ml: 'ആഗർ മാൾവ', bn: 'আগর মালওয়া', or: 'ଆଗର ମାଲୱା', pa: 'ਆਗਰ ਮਾਲਵਾ' },
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
  // ── Maharashtra (additional) ────────────────────────────────────────────────
  'Navi Mumbai':       { hi: 'नवी मुंबई', mr: 'नवी मुंबई', gu: 'નવી મુંબઈ', ta: 'நவி மும்பை', te: 'నవి ముంబై', kn: 'ನವಿ ಮುಂಬೈ', ml: 'നവി മുംബൈ', bn: 'নবী মুম্বাই', or: 'ନବୀ ମୁମ୍ବଇ', pa: 'ਨਵੀਂ ਮੁੰਬਈ' },
  'Mumbai City':       { hi: 'मुंबई शहर', mr: 'मुंबई शहर', gu: 'મુંબઈ શહેર', ta: 'மும்பை நகர்', te: 'ముంబై నగరం', kn: 'ಮುಂಬೈ ನಗರ', ml: 'മുംബൈ നഗരം', bn: 'মুম্বাই শহর', or: 'ମୁମ୍ବଇ ସହର', pa: 'ਮੁੰਬਈ ਸ਼ਹਿਰ' },
  'Mumbai Suburban':   { hi: 'मुंबई उपनगर', mr: 'मुंबई उपनगर', gu: 'મુંબઈ ઉપનગર', ta: 'மும்பை புறநகர்', te: 'ముంబై సబర్బన్', kn: 'ಮುಂಬೈ ಉಪನಗರ', ml: 'മുംബൈ സബർബൻ', bn: 'মুম্বাই উপশহর', or: 'ମୁମ୍ବଇ ଉପନଗର', pa: 'ਮੁੰਬਈ ਉਪਨਗਰ' },
  'Rajapur':           { hi: 'राजापुर', mr: 'राजापूर', gu: 'રાજાપુર', ta: 'ராஜாபூர்', te: 'రాజాపూర్', kn: 'ರಾಜಾಪುರ', ml: 'രാജാപൂർ', bn: 'রাজাপুর', or: 'ରାଜାପୁର', pa: 'ਰਾਜਾਪੁਰ' },
  // ── Delhi (additional) ──────────────────────────────────────────────────────
  'Central Delhi':     { hi: 'मध्य दिल्ली', mr: 'मध्य दिल्ली', gu: 'મધ્ય દિલ્હી', ta: 'மத்திய தில்லி', te: 'మధ్య ఢిల్లీ', kn: 'ಮಧ್ಯ ದೆಹಲಿ', ml: 'മധ്യ ഡൽഹി', bn: 'মধ্য দিল্লি', or: 'ମଧ୍ୟ ଦିଲ୍ଲୀ', pa: 'ਕੇਂਦਰੀ ਦਿੱਲੀ' },
  'East Delhi':        { hi: 'पूर्वी दिल्ली', mr: 'पूर्व दिल्ली', gu: 'પૂર્વ દિલ્હી', ta: 'கிழக்கு தில்லி', te: 'తూర్పు ఢిల్లీ', kn: 'ಪೂರ್ವ ದೆಹಲಿ', ml: 'കിഴക്ക് ഡൽഹി', bn: 'পূর্ব দিল্লি', or: 'ପୂର୍ବ ଦିଲ୍ଲୀ', pa: 'ਪੂਰਬੀ ਦਿੱਲੀ' },
  'Greater Kailash':   { hi: 'ग्रेटर कैलाश', mr: 'ग्रेटर कैलाश', gu: 'ગ્રેટર કૈલાશ', ta: 'கிரேட்டர் கைலாஷ்', te: 'గ్రేటర్ కైలాష్', kn: 'ಗ್ರೇಟರ್ ಕೈಲಾಶ್', ml: 'ഗ്രേറ്റർ കൈലാഷ്', bn: 'গ্রেটার কৈলাশ', or: 'ଗ୍ରେଟର ଖୈଲାଶ', pa: 'ਗ੍ਰੇਟਰ ਕੈਲਾਸ਼' },
  'Kalkaji':           { hi: 'कालकाजी', mr: 'कालकाजी', gu: 'કાલ્કાજી', ta: 'காளகாஜி', te: 'కాళ్కాజి', kn: 'ಕಾಲ್ಕಾಜಿ', ml: 'കാൽക്കാജി', bn: 'কালকাজি', or: 'କାଳ୍‌କାଜି', pa: 'ਕਾਲਕਾਜੀ' },
  'Karawal Nagar':     { hi: 'करावल नगर', mr: 'करावल नगर', gu: 'કારાવળ નગર', ta: 'கரவல் நகர்', te: 'కరావల్ నగర్', kn: 'ಕರಾವಲ್ ನಗರ', ml: 'കരാവൽ നഗർ', bn: 'কারওয়াল নগর', or: 'କରାୱଲ ନଗର', pa: 'ਕਰਾਵਲ ਨਗਰ' },
  'Lodhi Colony':      { hi: 'लोधी कॉलोनी', mr: 'लोधी कॉलोनी', gu: 'લોધી કોલોની', ta: 'லோதி காலனி', te: 'లోధీ కాలనీ', kn: 'ಲೋಧಿ ಕಾಲೊನಿ', ml: 'ലോദ്ഹി കോളനി', bn: 'লোধি কলোনি', or: 'ଲୋଧି କଲୋନୀ', pa: 'ਲੋਧੀ ਕਾਲੋਨੀ' },
  'Moti Nagar':        { hi: 'मोती नगर', mr: 'मोती नगर', gu: 'મોતી નગર', ta: 'மோதி நகர்', te: 'మోతీ నగర్', kn: 'ಮೋತಿ ನಗರ', ml: 'മോത്തി നഗർ', bn: 'মতি নগর', or: 'ମୋତି ନଗର', pa: 'ਮੋਤੀ ਨਗਰ' },
  'Najafgarh':         { hi: 'नजफगढ़', mr: 'नजफगड', gu: 'નજફગઢ', ta: 'நஜஃப்கர்', te: 'నజఫ్‌గఢ్', kn: 'ನಜಫ್‌ಗಢ', ml: 'നജഫ്ഗഢ്', bn: 'নজফগড়', or: 'ନଜଫ୍‌ଗଡ', pa: 'ਨਜ਼ਾਫਗੜ੍ਹ' },
  'Shalimar Bagh':     { hi: 'शालीमार बाग', mr: 'शालीमार बाग', gu: 'શાલીમાર બાગ', ta: 'ஷாலிமார் பாக்', te: 'షాలిమార్ బాగ్', kn: 'ಶಾಲಿಮಾರ್ ಬಾಗ್', ml: 'ഷാലിമർ ബാഗ്', bn: 'শালিমার বাগ', or: 'ଶାଲୀମାର ବାଗ', pa: 'ਸ਼ਾਲੀਮਾਰ ਬਾਗ' },
  'Bawana':            { hi: 'बवाना', mr: 'बवाना', gu: 'બવાના', ta: 'பவானா', te: 'బవానా', kn: 'ಬವಾನಾ', ml: 'ബവാന', bn: 'বওয়ানা', or: 'ବୱାନା', pa: 'ਬਵਾਣਾ' },
  // ── Andhra Pradesh / Telangana (additional) ──────────────────────────────────
  'Anakapalli':        { hi: 'अनकापल्ली', mr: 'अनकापल्ली', gu: 'અનકાપલ્લી', ta: 'அணக்காபள்ளி', te: 'అనకాపల్లి', kn: 'ಅನಕಾಪಲ್ಲಿ', ml: 'അനകാപ്പള്ളി', bn: 'অনকাপল্লি', or: 'ଅନ୍ନକାପଲ୍ଲି', pa: 'ਅਨਾਕਾਪਲੀ' },
  'Eluru':             { hi: 'एलूरू', mr: 'एलूरू', gu: 'એલૂરૂ', ta: 'எலூரு', te: 'ఏలూరు', kn: 'ಏಲೂರು', ml: 'ഏലൂരു', bn: 'এলুরু', or: 'ଏଲୁରୁ', pa: 'ਏਲੂਰੂ' },
  'Bhimavaram':        { hi: 'भीमावरम', mr: 'भीमावरम', gu: 'ભીમાવરમ', ta: 'பீமாவரம்', te: 'భీమవరం', kn: 'ಭೀಮಾವರಂ', ml: 'ഭീമവരം', bn: 'ভীমাবরম', or: 'ଭୀମାବରମ', pa: 'ਭੀਮਾਵਰਮ' },
  'Kakinada':          { hi: 'काकीनाडा', mr: 'काकीनाडा', gu: 'કાકીનાડા', ta: 'காகினாடா', te: 'కాకినాడ', kn: 'ಕಾಕಿನಾಡ', ml: 'കാക്കിനാഡ', bn: 'কাকিনাডা', or: 'କାକିନାଡା', pa: 'ਕਾਕੀਨਾਡਾ' },
  'Bhadradri Kothagudem': { hi: 'भद्राद्री कोठागुडेम', mr: 'भद्राद्री कोठागुडेम', gu: 'ભદ્રાદ્રી કોઠાગુડેમ', ta: 'பத்ராத்ரி கோட்டகுடேம்', te: 'భద్రాద్రి కొత్తగూడెం', kn: 'ಭದ್ರಾದ್ರಿ ಕೊತ್ತಗೂಡೆಂ', ml: 'ഭദ്രാദ്രി കൊത്തഗൂഡം', bn: 'ভদ্রাদ্রি কোট্টাগুডেম', or: 'ଭଦ୍ରାଦ୍ରି କୋଠାଗୁଡ଼େମ', pa: 'ਭਦਰਾਦਰੀ ਕੋਠਾਗੁਡੇਮ' },
  'Gajuwaka':          { hi: 'गाजुवाका', mr: 'गाजुवाका', gu: 'ગાજૂવાકા', ta: 'காஜுவாக்கா', te: 'గాజువాక', kn: 'ಗಾಜುವಾಕ', ml: 'ഗാജുവാക', bn: 'গাজুওয়াকা', or: 'ଗାଜୁୱାକା', pa: 'ਗਾਜੂਵਾਕਾ' },
  'Malkajgiri':        { hi: 'मल्काजगिरि', mr: 'मल्काजगिरि', gu: 'મૉlkajgiri', ta: 'மால்கஜ்கிரி', te: 'మల్కాజ్‌గిరి', kn: 'ಮಲ್ಕಾಜ್‌ಗಿರಿ', ml: 'മൽക്കാജ്ഗിരി', bn: 'মালকাজগিরি', or: 'ମଲ୍‌କାଜ୍‌ଗିରି', pa: 'ਮਾਲਕਾਜਗਿਰੀ' },
  'Wanaparthy':        { hi: 'वनपर्ती', mr: 'वनपर्ती', gu: 'વનપર્તી', ta: 'வனபர்த்தி', te: 'వనపర్తి', kn: 'ವನಪರ್ತಿ', ml: 'വനപർതി', bn: 'ওয়ানাপর্থি', or: 'ୱାନାପର୍ଥି', pa: 'ਵਾਨਾਪਰਥੀ' },
  'Yadagirigutta':     { hi: 'यादगीरिगुट्टा', mr: 'यादगिरिगुट्टा', gu: 'યાદગીરિગૂtta', ta: 'யாதகிரிகுட்டா', te: 'యాదగిరిగుట్ట', kn: 'ಯಾದಗಿರಿಗುಟ್ಟ', ml: 'യാദഗിരിഗൂട്ട', bn: 'ইয়াদাগিরিগুট্টা', or: 'ୟାଦଗିରିଗୁଟ୍ଟା', pa: 'ਯਾਦਗੀਰੀਗੁੱਟਾ' },
  'Mulug':             { hi: 'मुलुगु', mr: 'मुलुगु', gu: 'મૂlugu', ta: 'முலுகு', te: 'ములుగు', kn: 'ಮುಲುಗು', ml: 'മുലുഗു', bn: 'মুলুগু', or: 'ମୁଲୁଗୁ', pa: 'ਮੁਲੁਗੂ' },
  'Nidadavolu':        { hi: 'निदादवोलु', mr: 'निदादवोलु', gu: 'nidadavolu', ta: 'நிடாடவோலு', te: 'నిడదవోలు', kn: 'ನಿಡದವೋಲು', ml: 'നിഡദവോലു', bn: 'নিদাদাভোলু', or: 'ନିଦ୍ଦ‌ ଭୋଲ', pa: 'ਨਿਦਾਦਵੋਲੂ' },
  'Tadepalligudem':    { hi: 'तदेपल्लीगुडेम', mr: 'तडेपल्लीगुडेम', gu: 'tade', ta: 'தடேபல்லிகுடேம்', te: 'తాడేపల్లిగూడెం', kn: 'ತಾಡೇಪಲ್ಲಿಗೂಡೆಂ', ml: 'തഡേപ്പല്ലിഗൂഡം', bn: 'তাদেপল্লিগুডেম', or: 'ତାଡ଼େପଲ୍ଲିଗୁଡ଼େମ', pa: 'ਤਾਡੇਪੱਲੀਗੁਡੇਮ' },
  'Palakol':           { hi: 'पालकोल', mr: 'पालकोल', gu: 'Pal', ta: 'பாலக்கோல்', te: 'పాలకొల్లు', kn: 'ಪಾಲಕೊಲ್ಲು', ml: 'പാലക്കൊലു', bn: 'পালাকোল', or: 'ପାଲାକୋଲ', pa: 'ਪਾਲਾਕੋਲ' },
  'Bheemunipatnam':    { hi: 'भीमुनिपट्नम', mr: 'भीमुनिपट्टनम', gu: 'bheemu', ta: 'பீமுனிபட்டினம்', te: 'భీముని పట్నం', kn: 'ಭೀಮುನಿಪಟ್ಟನಂ', ml: 'ഭീമുനിപട്ടണം', bn: 'ভীমুনিপট্টনম', or: 'ଭୀମ୍‌ ନି ପଟ୍ଟଣ', pa: 'ਭੀਮੂਨੀਪੱਟਨਮ' },
  'Visakhapatnam North': { hi: 'विशाखापट्टनम उत्तर', mr: 'विशाखापट्टणम उत्तर', gu: 'વિઝ઼ ઉત્તર', ta: 'விசாகப்பட்டினம் வடக்கு', te: 'విశాఖపట్నం ఉత్తర', kn: 'ವಿಶಾಖಪಟ್ಟಣ ಉತ್ತರ', ml: 'വിശാഖപട്ടണം നോർത്ത്', bn: 'বিশাখাপট্টনম উত্তর', or: 'ଉତ୍ତର ବିଶାଖ', pa: 'ਵਿਸ਼ਾਖਾਪਟਨਮ ਉੱਤਰ' },
  'Visakhapatnam South': { hi: 'विशाखापट्टनम दक्षिण', mr: 'विशाखापट्टणम दक्षिण', gu: 'વિઝ઼ દ', ta: 'விசாகப்பட்டினம் தெற்கு', te: 'విశాఖపట్నం దక్షిణ', kn: 'ವಿಶಾಖಪಟ್ಟಣ ದಕ್ಷಿಣ', ml: 'വിശാഖപട്ടണം സൗത്ത്', bn: 'বিশাখাপট্টনম দক্ষিণ', or: 'ଦକ୍ଷିଣ ବିଶାଖ', pa: 'ਵਿਸ਼ਾਖਾਪਟਨਮ ਦੱਖਣ' },
  'Vizianagaram Rural': { hi: 'विजयनगरम ग्रामीण', mr: 'विझियानगरम ग्रामीण', gu: 'vizianagaram rural', ta: 'விஜயநகரம் கிராமம்', te: 'విజయనగరం రూరల్', kn: 'ವಿಜಯನಗರಂ ರೂರಲ್', ml: 'വിജയനഗരം ഗ്രാമം', bn: 'বিজয়নগরম গ্রামীণ', or: 'ଭୀଜ଼ ନ ଗ୍ରାମ', pa: 'ਵਿਜੇਨਗਰਮ ਪੇਂਡੂ' },
  'Vizianagaram Urban': { hi: 'विजयनगरम शहरी', mr: 'विझियानगरम शहरी', gu: 'vizianagaram urban', ta: 'விஜயநகரம் நகர்', te: 'విజయనగరం అర్బన్', kn: 'ವಿಜಯನಗರಂ ಅರ್ಬನ್', ml: 'വിജയനഗരം അർബൻ', bn: 'বিজয়নগরম শহর', or: 'ଭୀଜ଼ ନ ସହର', pa: 'ਵਿਜੇਨਗਰਮ ਸ਼ਹਿਰੀ' },
  'Dr. B.R. Ambedkar Konaseema': { hi: 'डॉ. बी.आर. अंबेडकर कोनसीमा', mr: 'डॉ. बी.आर. आंबेडकर कोनसीमा', gu: 'ડો. બી.આર. આંબેડકર કોનસીમા', ta: 'டா. பி.ஆர். அம்பேத்கர் கோனசீமா', te: 'డా. బి.ఆర్. అంబేద్కర్ కోనసీమ', kn: 'ಡಾ. ಬಿ.ಆರ್. ಅಂಬೇಡ್ಕರ್ ಕೋನಸೀಮ', ml: 'ഡോ. ബി.ആർ. അംബേദ്കർ കോണസീമ', bn: 'ডঃ বি.আর. আম্বেদকর কোনাসীমা', or: 'ଡ. ଆଂବ ଡ୍‌କ ରୁ କୋ ସୀ', pa: 'ਡਾ. ਬੀ.ਆਰ. ਅੰਬੇਡਕਰ ਕੋਨਾਸੀਮਾ' },
  'Alluri Sitharama Raju': { hi: 'अल्लूरी सीतारामराजू', mr: 'अल्लूरी सीतारामराजू', gu: 'અલ્લૂરી સીતારામ', ta: 'அல்லூரி சிதாரமராஜு', te: 'అల్లూరి సీతారామరాజు', kn: 'ಅಲ್ಲೂರಿ ಸೀತಾರಾಮರಾಜು', ml: 'അള്ളൂരി സീതാറാമരാജ', bn: 'অল্লুরী সীতারামরাজু', or: 'ଅଲ୍ଲୁରୀ ସୀତ ରଜ', pa: 'ਅੱਲੂਰੀ ਸੀਤਾਰਾਮਰਾਜੂ' },
  'Gajapathinagaram':  { hi: 'गजपतिनगरम', mr: 'गजपतिनगरम', gu: 'ગajpati', ta: 'காஜபதிநகரம்', te: 'గాజపతినగరం', kn: 'ಗಜಪತಿನಗರಂ', ml: 'ഗജപതിനഗരം', bn: 'গাজাপতিনগরম', or: 'ଗଜ ପ ତି ନ ଗ', pa: 'ਗਜਾਪਤੀਨਗਰਮ' },
  'Kaghaznagar':       { hi: 'कागज़नगर', mr: 'कागजनगर', gu: 'કાગઝ઼ ​nagar', ta: 'காகஸ்நகர்', te: 'కాగజ్‌నగర్', kn: 'ಕಾಗಜ್‌ನಗರ', ml: 'കാഗഴ്‌നഗർ', bn: 'কাগজনগর', or: 'କାଗଜ ନ ଗ', pa: 'ਕਾਗਜ਼ਨਗਰ' },
  'Hindupur':          { hi: 'हिंदूपुर', mr: 'हिंदूपूर', gu: 'હિન્દૂપૂર', ta: 'ஹிந்தூபூர்', te: 'హిందూపురం', kn: 'ಹಿಂದೂಪುರ', ml: 'ഹിന്ദൂപൂർ', bn: 'হিন্দুপুর', or: 'ହିନ୍ଦୁପୁର', pa: 'ਹਿੰਦੂਪੁਰ' },
  'Parkal':            { hi: 'पारकल', mr: 'पारकल', gu: 'parkal', ta: 'பார்கல்', te: 'పార్కల్', kn: 'ಪಾರ್ಕಲ್', ml: 'പാർക്കൽ', bn: 'পার্কাল', or: 'ପାର୍‌କଲ', pa: 'ਪਾਰਕਲ' },
  'Parvathipuram':     { hi: 'पार्वतीपुरम', mr: 'पार्वतीपुरम', gu: 'parvati', ta: 'பார்வதிபுரம்', te: 'పార్వతీపురం', kn: 'ಪಾರ್ವತೀಪುರಂ', ml: 'പാർവതീപുരം', bn: 'পার্বতীপুরম', or: 'ପାର୍ବ ତ ପୁ ର', pa: 'ਪਾਰਵਤੀਪੁਰਮ' },
  'Ambedkar Nagar':    { hi: 'अंबेडकर नगर', mr: 'आंबेडकर नगर', gu: 'આંબેડકર નગર', ta: 'அம்பேத்கர் நகர்', te: 'అంబేద్కర్ నగర్', kn: 'ಅಂಬೇಡ್ಕರ್ ನಗರ', ml: 'അംബേദ്കർ നഗർ', bn: 'আম্বেদকর নগর', or: 'ଆମ୍ ବ ଡ ନ', pa: 'ਅੰਬੇਡਕਰ ਨਗਰ' },
  'Khalilabad':        { hi: 'खलीलाबाद', mr: 'खलीलाबाद', gu: 'ખlilabad', ta: 'கலீலாபாத்', te: 'ఖలీలాబాద్', kn: 'ಖಲೀಲಾಬಾದ್', ml: 'ഖലീലാബാദ്', bn: 'খলিলাবাদ', or: 'ଖ ଲ ଲ ବ ଦ', pa: 'ਖਲੀਲਾਬਾਦ' },
  'Lakhimpur Kheri':   { hi: 'लखीमपुर खीरी', mr: 'लखीमपूर खेरी', gu: 'lakhimpur kheri', ta: 'லக்கிம்பூர் கேரி', te: 'లఖీంపూర్ ఖేరి', kn: 'ಲಖೀಂಪುರ ಖೇರಿ', ml: 'ലഖീംപൂർ ഖേരി', bn: 'লখিমপুর খেরি', or: 'ଲଖୀମ୍ ​ ​', pa: 'ਲਖੀਮਪੁਰ ਖੀਰੀ' },
  // ── Karnataka (additional) ───────────────────────────────────────────────────
  'Bangalore North':   { hi: 'बेंगलुरु उत्तर', mr: 'बेंगळुरू उत्तर', gu: 'બેંગ્લોર ઉત્તર', ta: 'பெங்களூரு வடக்கு', te: 'బెంగళూరు నార్త్', kn: 'ಬೆಂಗಳೂರು ಉತ್ತರ', ml: 'ബെംഗളൂരു നോർത്ത്', bn: 'বেঙ্গালুরু উত্তর', or: 'ବେଙ୍ଗ ଉ', pa: 'ਬੰਗਲੂਰੂ ਉੱਤਰ' },
  'Bengaluru (Bangalore) Rural': { hi: 'बेंगलुरु ग्रामीण', mr: 'बेंगळुरू ग्रामीण', gu: 'બેંગ્લોર ગ્રામ', ta: 'பெங்களூரு கிராமம்', te: 'బెంగళూరు రూరల్', kn: 'ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ', ml: 'ബെംഗളൂരു ഗ്രാമം', bn: 'বেঙ্গালুরু গ্রামীণ', or: 'ବେଙ୍ଗ ଗ୍ ‌', pa: 'ਬੰਗਲੂਰੂ ਪੇਂਡੂ' },
  'Doddaballapura':    { hi: 'दोड्डाबल्लापुर', mr: 'दोड्डाबल्लापूर', gu: 'doda', ta: 'டோட்டபல்லாபுரா', te: 'దొడ్డబళ్లాపుర', kn: 'ದೊಡ್ಡಬಳ್ಳಾಪುರ', ml: 'ഡൊഡ്ഡബള്ളാപൂർ', bn: 'ডোড্ডাবল্লাপুর', or: 'ଡ ଡ ବ ‌', pa: 'ਡੋਡਾਬੱਲਾਪੁਰਾ' },
  'Bantwal':           { hi: 'बन्टवाल', mr: 'बन्टवाल', gu: 'Bantwal', ta: 'பண்ட்வால்', te: 'బంట్వాల్', kn: 'ಬಂಟ್ವಾಳ', ml: 'ബന്ത്‍വ്വാൾ', bn: 'বান্তওয়াল', or: 'ବ ‌ nt ‌', pa: 'ਬੰਤਵਾਲ' },
  'Chincholi':         { hi: 'चिंचोली', mr: 'चिंचोली', gu: 'Chincholi', ta: 'சிஞ்சோலி', te: 'చించోళి', kn: 'ಚಿಂಚೋಳಿ', ml: 'ചിഞ്ചോളി', bn: 'চিনচোলি', or: 'ଚ ‌ nh li', pa: 'ਚਿੰਚੋਲੀ' },
  'Honavar':           { hi: 'होनावर', mr: 'होनावर', gu: 'Honavar', ta: 'ஹோனாவர்', te: 'హోనావర్', kn: 'ಹೊನ್ನಾವರ', ml: 'ഹൊന്നാവര', bn: 'হোনাভার', or: 'ହ ‌ n var', pa: 'ਹੋਨਾਵਰ' },
  'Pavagada':          { hi: 'पावगडा', mr: 'पावगडा', gu: 'Pavagada', ta: 'பவகடா', te: 'పావగడ', kn: 'ಪಾವಗಡ', ml: 'പാവഗഡ', bn: 'পাভাগাড়া', or: 'ପ ‌ vgd', pa: 'ਪਾਵਗੜਾ' },
  'Sandur':            { hi: 'संदूर', mr: 'संदूर', gu: 'Sandur', ta: 'சந்தூர்', te: 'సంద్ద', kn: 'ಸಂದೂರು', ml: 'സന്ദൂർ', bn: 'সান্দুর', or: 'ସ ‌ ndur', pa: 'ਸੰਦੂਰ' },
  'Tarikere':          { hi: 'तारिकेरे', mr: 'तारिकेरे', gu: 'Tarikere', ta: 'தாரிக்கேரெ', te: 'తారికెరె', kn: 'ತರೀಕೆರೆ', ml: 'തരീക്കേരെ', bn: 'তারিকেরে', or: 'ତ ‌ rik', pa: 'ਤਾਰੀਕੇਰੇ' },
  'Thirthahalli':      { hi: 'तीर्थहल्ली', mr: 'तीर्थहल्ली', gu: 'Thirthahalli', ta: 'திர்த்தஹள்ளி', te: 'తీర్థహళ్ళి', kn: 'ತೀರ್ಥಹಳ್ಳಿ', ml: 'തീർഥഹള്ളി', bn: 'তীর্থহল্লি', or: 'ତ ‌ rth hll', pa: 'ਤੀਰਥਾਹਲੀ' },
  'T. Narasipura':     { hi: 'टी. नरसीपुर', mr: 'टी. नरसीपूर', gu: 'T. Narsip', ta: 'டி. நரசீபுரா', te: 'టి. నర్సీపుర', kn: 'ಟಿ. ನರಸೀಪುರ', ml: 'ടി. നർസീപുര', bn: 'টি. নরসীপুর', or: 'ଟ ‌ nrs p', pa: 'ਟੀ. ਨਰਸੀਪੁਰਾ' },
  // ── West Bengal (additional) ──────────────────────────────────────────────────
  'Bidhannagar':       { hi: 'बिधाननगर', mr: 'बिधाननगर', gu: 'Bidhannagar', ta: 'பித்தான்நகர்', te: 'బిధన్‌నగర్', kn: 'ಬಿಧಾನ್‌ನಗರ', ml: 'ബിദ്ഹാൻ നഗർ', bn: 'বিধাননগর', or: 'ବ ‌ dh nn', pa: 'ਬਿਧਾਨਨਗਰ' },
  'Egra':              { hi: 'एग्रा', mr: 'एग्रा', gu: 'Egra', ta: 'ஏக்ரா', te: 'ఎగ్రా', kn: 'ಎಗ್ರಾ', ml: 'ഏഗ്ര', bn: 'এগ্রা', or: 'ଏ ‌ g ‌ r', pa: 'ਏਗਰਾ' },
  'Gangarampur':       { hi: 'गंगारामपुर', mr: 'गंगारामपुर', gu: 'Gangarampur', ta: 'கங்காரம்பூர்', te: 'గంగారాంపూర్', kn: 'ಗಂಗಾರಾಮಪುರ', ml: 'ഗംഗാരാംപൂർ', bn: 'গঙ্গারামপুর', or: 'ଗ ‌ ng rm p', pa: 'ਗੰਗਾਰਾਮਪੁਰ' },
  'Ghatal':            { hi: 'घटाल', mr: 'घटाल', gu: 'Ghatal', ta: 'காடல்', te: 'ఘటాల్', kn: 'ಘಟಾಲ್', ml: 'ഘടാൽ', bn: 'ঘাটাল', or: 'ଘ ‌ ṭ l', pa: 'ਘਟਾਲ' },
  'Islampur':          { hi: 'इस्लामपुर', mr: 'इस्लामपूर', gu: 'Islampur', ta: 'இஸ்லாம்பூர்', te: 'ఇస్లాంపూర్', kn: 'ಇಸ್ಲಾಂಪುರ', ml: 'ഇസ്ലാംപൂർ', bn: 'ইসলামপুর', or: 'ଇ ‌ sl mp', pa: 'ਇਸਲਾਮਪੁਰ' },
  'Jamalpur':          { hi: 'जमालपुर', mr: 'जमालपूर', gu: 'Jamalpur', ta: 'ஜமால்பூர்', te: 'జమాల్‌పూర్', kn: 'ಜಮಾಲ್ಪುರ', ml: 'ജമൽപൂർ', bn: 'জামালপুর', or: 'ଜ ‌ ml p', pa: 'ਜਮਾਲਪੁਰ' },
  'Kakdwip':           { hi: 'काकद्वीप', mr: 'काकद्वीप', gu: 'Kakdwip', ta: 'காக்துவீப்', te: 'కాక్‌ద్వీప్', kn: 'ಕಾಕ್‌ದ್ವೀಪ', ml: 'കാക്‌ദ്വീപ്', bn: 'কাকদ্বীপ', or: 'କ ‌ kd p', pa: 'ਕਾਕਦਵੀਪ' },
  'Katwa':             { hi: 'कटवा', mr: 'कटवा', gu: 'Katwa', ta: 'கட்வா', te: 'కట్వా', kn: 'ಕಟ್ವಾ', ml: 'കട്‍വ', bn: 'কাটোয়া', or: 'କ ‌ ṭw', pa: 'ਕਟਵਾ' },
  'Mekhliganj':        { hi: 'मेखलीगंज', mr: 'मेखलीगंज', gu: 'Mekhliganj', ta: 'மேக்லிகஞ்ச்', te: 'మేఖ్‌లిగంజ్', kn: 'ಮೇಖ್ಲಿಗಂಜ್', ml: 'മേഖ്‌ലിഗഞ്ച്', bn: 'মেখলিগঞ্জ', or: 'ମ ‌ kh l gj', pa: 'ਮੇਖਲੀਗੰਜ' },
  'Raghunathganj':     { hi: 'रघुनाथगंज', mr: 'रघुनाथगंज', gu: 'Raghu', ta: 'ரகுநாத்கஞ்ச்', te: 'రఘునాథ్‌గంజ్', kn: 'ರಘುನಾಥ್ ಗಂಜ್', ml: 'രഘുനാഥ്ഗഞ്ച്', bn: 'রঘুনাথগঞ্জ', or: 'ର ‌ gh ng', pa: 'ਰਘੁਨਾਥਗੰਜ' },
  // ── Rajasthan (additional) ────────────────────────────────────────────────────
  'Bharatpur':         { hi: 'भरतपुर', mr: 'भरतपूर', gu: 'ભરતપુર', ta: 'பாரத்பூர்', te: 'భరత్‌పూర్', kn: 'ಭರತ್‌ಪುರ', ml: 'ഭരത്‌പൂർ', bn: 'ভরতপুর', or: 'ଭ ‌ rt p', pa: 'ਭਰਤਪੁਰ' },
  'Sawai Madhopur':    { hi: 'सवाई माधोपुर', mr: 'सवाई माधोपूर', gu: 'સવાઈ માધોપુર', ta: 'சவாய் மாதோபூர்', te: 'సవాయి మాధోపూర్', kn: 'ಸವಾಯಿ ಮಾಧೋಪುರ', ml: 'സവായ് മാധോപൂർ', bn: 'সোয়াই মাধোপুর', or: 'ସ ‌ wai mdhp', pa: 'ਸਵਾਈ ਮਾਧੋਪੁਰ' },
  'Shahpura':          { hi: 'शाहपुरा', mr: 'शाहपुरा', gu: 'Shahpura', ta: 'ஷாபூரா', te: 'షాపురా', kn: 'ಶಾಹ್ ಪುರ', ml: 'ഷാഹ്‌പൂർ', bn: 'শাহপুরা', or: 'ଶ ‌ h p ‌ r', pa: 'ਸ਼ਾਹਪੁਰਾ' },
  'Parbatsar':         { hi: 'परबतसर', mr: 'परबतसर', gu: 'Parbatsar', ta: 'பர்பட்சர்', te: 'పర్బత్‌సర్', kn: 'ಪರ್ಬತ್‌ಸರ್', ml: 'പർബത്‌സർ', bn: 'পার্বতসর', or: 'ପ ‌ rb t ‌ sr', pa: 'ਪਰਬਤਸਰ' },
  'Sri Madhopur':      { hi: 'श्री माधोपुर', mr: 'श्री माधोपूर', gu: 'Sri Madhopur', ta: 'ஸ்ரீ மாதோபூர்', te: 'శ్రీ మాధోపూర్', kn: 'ಶ್ರೀ ಮಾಧೋಪುರ', ml: 'ശ്രീ മാധോപൂർ', bn: 'শ্রী মাধোপুর', or: 'ଶ ‌ r mdhp', pa: 'ਸ੍ਰੀ ਮਾਧੋਪੁਰ' },
  // ── Gujarat (additional) ──────────────────────────────────────────────────────
  'Banaskantha (Palanpur)': { hi: 'बनासकांठा', mr: 'बनासकांठा', gu: 'બનાસકાંઠા', ta: 'பனாஸ்கந்தா', te: 'బనాస్‌కాంఠా', kn: 'ಬನಾಸ್‌ಕಾಂಠಾ', ml: 'ബനാസ്‌കാന്ഠ', bn: 'বানাসকান্থা', or: 'ବ ‌ nsk', pa: 'ਬਨਾਸਕਾਂਠਾ' },
  'Sabarkantha (Himmatnagar)': { hi: 'साबरकांठा', mr: 'साबरकांठा', gu: 'સાબરકાંઠા', ta: 'சாபர்கந்தா', te: 'సాబర్‌కాంఠా', kn: 'ಸಾಬರ್‌ಕಾಂಠಾ', ml: 'സാബർക്കാന്ഠ', bn: 'সাবরকান্থা', or: 'ସ ‌ brkk', pa: 'ਸਾਬਰਕਾਂਠਾ' },
  'Kheda (Nadiad)':    { hi: 'खेडा', mr: 'खेडा', gu: 'ખેડા', ta: 'கேடா', te: 'ఖేడా', kn: 'ಖೇಡಾ', ml: 'ഖേഡ', bn: 'খেডা', or: 'ଖ ‌ ḍ', pa: 'ਖੇਡਾ' },
  'Morwa (Hadaf)':     { hi: 'मोर्वा', mr: 'मोर्वा', gu: 'મોર્વા', ta: 'மோர்வா', te: 'మోర్వా', kn: 'ಮೋರ್ವಾ', ml: 'മോർവ', bn: 'মোর্ভা', or: 'ମ ‌ rw', pa: 'ਮੋਰਵਾ' },
  'Sankheda':          { hi: 'शांखेडा', mr: 'शांखेडा', gu: 'સાંખેડા', ta: 'சாங்கேடா', te: 'శాంఖేడా', kn: 'ಶಾಂಖೇಡ', ml: 'ശാൻഖേഡ', bn: 'শাঁখেডা', or: 'ଶ ‌ nkh', pa: 'ਸ਼ਾਂਖੇਡਾ' },
  'Tilakwada':         { hi: 'तिलकवाड़ा', mr: 'तिलकवाडा', gu: 'ટilakwada', ta: 'திலக்வாடா', te: 'తిలక్వాడా', kn: 'ತಿಲಕ್ವಾಡಾ', ml: 'തിലക്‌വാഡ', bn: 'তিলকওয়াড়া', or: 'ଟ ‌ lk ‌ wd', pa: 'ਤਿਲਕਵਾੜਾ' },
  'Bhanvad':           { hi: 'भाणवड', mr: 'भाणवड', gu: 'ભાણવડ', ta: 'பாண்வட்', te: 'భాన్వాడ్', kn: 'ಭಾಣ್ವಾಡ್', ml: 'ഭാൻ‍വഡ്', bn: 'ভানবাড়', or: 'ଭ ‌ nwd', pa: 'ਭਾਣਵਡ' },
  'Gir Gadhada':       { hi: 'गीर गढ़डा', mr: 'गीर गढडा', gu: 'ગીર ગઢડા', ta: 'கிர் கதாடா', te: 'గిర్ గఢడా', kn: 'ಗಿರ್ ಗಢಡ', ml: 'ഗിർ ഗഢഡ', bn: 'গির গাঢ়ডা', or: 'ଗ ‌ r ‌ gh ‌ d', pa: 'ਗਿਰ ਗਢਡਾ' },
  // ── Uttarakhand ────────────────────────────────────────────────────────────────
  'Pauri Garhwal':     { hi: 'पौड़ी गढ़वाल', mr: 'पौढी गढवाल', gu: 'Pauri Garhwal', ta: 'பவுரி கர்வால்', te: 'పౌరీ గఢ్వాల్', kn: 'ಪೌರಿ ಗಢ್ವಾಲ್', ml: 'പൗരി ഗഢ്‌വൽ', bn: 'পৌরি গাড়ওয়াল', or: 'ପ ‌ ur g ‌ rwl', pa: 'ਪੌੜੀ ਗੜ੍ਹਵਾਲ' },
  'Tehri Garhwal':     { hi: 'टिहरी गढ़वाल', mr: 'टेहरी गढवाल', gu: 'Tehri Garhwal', ta: 'தெஹ்ரி கர்வால்', te: 'తెహ్రి గఢ్వాల్', kn: 'ತೆಹ್ರಿ ಗಢ್ವಾಲ್', ml: 'തെഹ്‌രി ഗഢ്‌വൽ', bn: 'টেহরি গাড়ওয়াল', or: 'ଟ ‌ hr g ‌ rwl', pa: 'ਟਿਹਰੀ ਗੜ੍ਹਵਾਲ' },
  'Udham Singh Nagar': { hi: 'उधम सिंह नगर', mr: 'ऊधम सिंह नगर', gu: 'Udham Singh Nagar', ta: 'உதம் சிங் நகர்', te: 'ఉధం సింగ్ నగర్', kn: 'ಉಧಂ ಸಿಂಗ್ ನಗರ', ml: 'ഉദം സിംഗ് നഗർ', bn: 'উধম সিং নগর', or: 'ଉ ‌ dh sn n', pa: 'ਊਧਮ ਸਿੰਘ ਨਗਰ' },
  // ── Punjab (additional) ───────────────────────────────────────────────────────
  'Tarn Taran':        { hi: 'तरन तारन', mr: 'तरन तारण', gu: 'ਤਰਨ ਤਾਰਨ', ta: 'தர்ன் தாரன்', te: 'తర్న్ తారన్', kn: 'ತರ್ನ್ ತಾರನ್', ml: 'തർൺ തരൻ', bn: 'তার্ন তারান', or: 'ତ ‌ rn t ‌ rn', pa: 'ਤਰਨ ਤਾਰਨ' },
  'Sri Muktsar Sahib': { hi: 'श्री मुक्तसर साहिब', mr: 'श्री मुक्तसर साहिब', gu: 'Sri Muktsar', ta: 'ஸ்ரீ முக்தசர் சாஹிப்', te: 'శ్రీ ముక్తసర్ సాహిబ్', kn: 'ಶ್ರೀ ಮುಕ್ತಸರ್ ಸಾಹಿಬ್', ml: 'ശ്രീ മുക്‌തസർ സാഹിബ്', bn: 'শ্রী মুক্তসর সাহিব', or: 'ଶ ‌ r mt sr', pa: 'ਸ੍ਰੀ ਮੁਕਤਸਰ ਸਾਹਿਬ' },
  'Nawan Shahr':       { hi: 'नवां शहर', mr: 'नवां शहर', gu: 'Nawan Shahr', ta: 'நவன் ஷஹர்', te: 'నవాన్ సహర్', kn: 'ನವಾನ್ ಸಹರ್', ml: 'നവൻ ഷഹർ', bn: 'নয়া শহর', or: 'ନ ‌ wn ‌ shr', pa: 'ਨਵਾਂ ਸ਼ਹਿਰ' },
  'Kharar':            { hi: 'खरड़', mr: 'खरड', gu: 'Kharar', ta: 'கரர்', te: 'ఖరార్', kn: 'ಖರಾರ್', ml: 'ഖരാർ', bn: 'খারার', or: 'ଖ ‌ rr', pa: 'ਖਰੜ' },
  'Khamanon':          { hi: 'खमानों', mr: 'खमानो', gu: 'Khamanon', ta: 'கமானோன்', te: 'ఖమానోన్', kn: 'ಖಮಾನೋನ್', ml: 'ഖമാനോൻ', bn: 'খামানোন', or: 'ଖ ‌ mn', pa: 'ਖਮਾਣੋਂ' },
  // ── Madhya Pradesh / Chhattisgarh (additional) ──────────────────────────────
  'Manendragarh':      { hi: 'मनेन्द्रगढ़', mr: 'मनेन्द्रगड', gu: 'Manendragarh', ta: 'மனேந்திரகர்', te: 'మనేంద్రగఢ్', kn: 'ಮನೇಂದ್ರಗಢ', ml: 'മനേന്ദ്രഗഢ്', bn: 'মানেন্দ্রগড়', or: 'ମ ‌ nrg', pa: 'ਮਨੇਂਦਰਗੜ੍ਹ' },
  'Marwahi':           { hi: 'मार्वाही', mr: 'मार्वाही', gu: 'Marwahi', ta: 'மர்வாஹி', te: 'మర్వాహి', kn: 'ಮರ್ವಾಹಿ', ml: 'മർവ്വഹി', bn: 'মারওয়াহি', or: 'ମ ‌ rwh', pa: 'ਮਾਰਵਾਹੀ' },
  'Bhanupratappur':    { hi: 'भानुप्रतापुर', mr: 'भानुप्रतापूर', gu: 'Bhanupratappur', ta: 'பானுப்ரதாப்பூர்', te: 'భానుప్రతాపూర్', kn: 'ಭಾನುಪ್ರತಾಪ್‌ಪುರ', ml: 'ഭാനുപ്രതാപ്‌പൂർ', bn: 'ভানুপ্রতাপপুর', or: 'ଭ ‌ nup', pa: 'ਭਾਨੂਪ੍ਰਤਾਪਪੁਰ' },
  'Chhindgarh':        { hi: 'छिंदगढ़', mr: 'छिंदगड', gu: 'Chhindgarh', ta: 'சிந்தகர்', te: 'ఛిందగఢ్', kn: 'ಛಿಂದಗಢ', ml: 'ഛ്ഹിന്ദ്‌ഗഢ്', bn: 'ছিন্দগড়', or: 'ଛ ‌ ndg', pa: 'ਛਿੰਦਗੜ੍ਹ' },
  'Susner':            { hi: 'सुसनेर', mr: 'सुसनेर', gu: 'Susner', ta: 'சுஸ்னேர்', te: 'సుస్నేర్', kn: 'ಸುಸ್ನೇರ್', ml: 'സുസ്‌നേർ', bn: 'সুসনেড়', or: 'ସ ‌ sn', pa: 'ਸੁਸਨੇਰ' },
  // ── Bihar / Jharkhand (additional) ────────────────────────────────────────────
  'Raxaul':            { hi: 'रक्सौल', mr: 'रक्सौल', gu: 'Raxaul', ta: 'ரக்சௌல்', te: 'రాక్సౌల్', kn: 'ರಾಕ್ಸೌಲ್', ml: 'രക്‌സൗൽ', bn: 'রক্সৌল', or: 'ର ‌ ks ‌ l', pa: 'ਰਕਸੌਲ' },
  'West Champaran':    { hi: 'पश्चिम चंपारण', mr: 'पश्चिम चंपारण', gu: 'West Champaran', ta: 'மேற்கு சம்பாரன்', te: 'వెస్ట్ చంపారన్', kn: 'ವೆಸ್ಟ್ ಚಂಪಾರನ್', ml: 'വെസ്‌റ്റ് ചംപാരൻ', bn: 'পশ্চিম চম্পারণ', or: 'ପ ‌ sc ‌ mp', pa: 'ਪੱਛਮੀ ਚੰਪਾਰਨ' },
  'Ramgarh':           { hi: 'रामगढ़', mr: 'रामगड', gu: 'Ramgarh', ta: 'ராம்கர்', te: 'రాంఘర్', kn: 'ರಾಂಗಢ', ml: 'രാംഗഢ്', bn: 'রামগড়', or: 'ର ‌ mg', pa: 'ਰਾਮਗੜ੍ਹ' },
  'Chandil':           { hi: 'चांडिल', mr: 'चांडिल', gu: 'Chandil', ta: 'சண்டில்', te: 'ఛందిల్', kn: 'ಚಂಡಿಲ್', ml: 'ചന്ദിൽ', bn: 'চাণ্ডিল', or: 'ଚ ‌ nd', pa: 'ਚਾਂਡਿਲ' },
  'Gamharia':          { hi: 'गमहरिया', mr: 'गमहरिया', gu: 'Gamharia', ta: 'கம்ஹரியா', te: 'గమ్హరియా', kn: 'ಗಮ್ಹರಿಯ', ml: 'ഗംഹരിയ', bn: 'গামহারিয়া', or: 'ଗ ‌ mhr', pa: 'ਗਮਹਾਰੀਆ' },
  'Noamundi':          { hi: 'नोआमुंडी', mr: 'नोआमुंडी', gu: 'Noamundi', ta: 'நோமுண்டி', te: 'నోముండి', kn: 'ನೋಮುಂಡಿ', ml: 'നോമുണ്ടി', bn: 'নোয়ামুন্ডি', or: 'ନ ‌ omd', pa: 'ਨੋਆਮੁੰਡੀ' },
  // ── Tamil Nadu (additional) ────────────────────────────────────────────────────
  'Tirunelveli':       { hi: 'तिरुनेलवेली', mr: 'तिरुनेलवेली', gu: 'તિરૂનેલ્‌વેલી', ta: 'திருநெல்வேலி', te: 'తిరునేల్వేలి', kn: 'ತಿರುನೆಲ್ವೇಲಿ', ml: 'തിരുനെൽ‌വേലി', bn: 'তিরুনেলভেলি', or: 'ତ ‌ rn lv l', pa: 'ਤਿਰੂਨੇਲਵੇਲੀ' },
  'Kannur':            { hi: 'कन्नूर', mr: 'कन्नूर', gu: 'Kannur', ta: 'கன்னூர்', te: 'కన్నూర్', kn: 'ಕಣ್ಣೂರ್', ml: 'കണ്ണൂർ', bn: 'কান্নুর', or: 'କ ‌ nn r', pa: 'ਕੰਨੂਰ' },
  'Kasargod':          { hi: 'कासरगोड', mr: 'कासरगोड', gu: 'Kasargod', ta: 'காசர்கோட்', te: 'కాసర్‌గోడ్', kn: 'ಕಾಸರಗೋಡ್', ml: 'കാസർഗോഡ്', bn: 'কাসারগোড', or: 'କ ‌ srg', pa: 'ਕਾਸਰਗੋਡ' },
  // ── Odisha (additional) ──────────────────────────────────────────────────────
  'Soro':              { hi: 'सोरो', mr: 'सोरो', gu: 'Soro', ta: 'சோரோ', te: 'సోరో', kn: 'ಸೋರೋ', ml: 'സോറോ', bn: 'সোরো', or: 'ସୋରୋ', pa: 'ਸੋਰੋ' },
  'Udayagiri':         { hi: 'उदयगिरि', mr: 'उदयगिरी', gu: 'Udayagiri', ta: 'உதயகிரி', te: 'ఉదయగిరి', kn: 'ಉದಯಗಿರಿ', ml: 'ഉദയഗിരി', bn: 'উদয়গিরি', or: 'ଉଦୟ ‌ g', pa: 'ਉਦੈਗਿਰੀ' },
  // ── Himachal Pradesh ──────────────────────────────────────────────────────────
  'Spiti':             { hi: 'स्पीति', mr: 'स्पिती', gu: 'Spiti', ta: 'ஸ்பிதி', te: 'స్పితి', kn: 'ಸ್ಪಿತಿ', ml: 'സ്‌പിതി', bn: 'স্পিতি', or: 'ସ ‌ p t', pa: 'ਸਪਿਤੀ' },
  // ── Goa ──────────────────────────────────────────────────────────────────────
  'Salcete':           { hi: 'साल्सेते', mr: 'साल्सेते', gu: 'Salcete', ta: 'சால்சேட்', te: 'సాల్సెట్', kn: 'ಸಾಲ್ಸೆಟ್', ml: 'സൽസെറ്റ്', bn: 'সাল্সেটে', or: 'ସ ‌ lc', pa: 'ਸੈਲਸੇਟੇ' },
  'Tiswadi':           { hi: 'तिस्वाडी', mr: 'तिस्वाडी', gu: 'Tiswadi', ta: 'திஸ்வாடி', te: 'తిస్వాడి', kn: 'ತಿಸ್ವಾಡಿ', ml: 'തിസ്‍വ്വഡി', bn: 'তিসোয়াডি', or: 'ତ ‌ swdi', pa: 'ਤਿਸਵਾਡੀ' },
  // ── NE India / Hill States ────────────────────────────────────────────────────
  'Jorethang':         { hi: 'जोरेथांग', mr: 'जोरेथांग', gu: 'Jorethang', ta: 'ஜோரேதாங்', te: 'జోరేతాంగ్', kn: 'ಜೋರೇಥಾಂಗ್', ml: 'ജോരേതാങ്', bn: 'জোরেথাং', or: 'ଜ ‌ rth', pa: 'ਜੋਰੇਥਾਂਗ' },
  'Mangan':            { hi: 'मंगन', mr: 'मंगण', gu: 'Mangan', ta: 'மங்கன்', te: 'మంగన్', kn: 'ಮಂಗನ್', ml: 'മംഗൻ', bn: 'মাংগান', or: 'ମ ‌ ng', pa: 'ਮੰਗਨ' },
  'Upper Siang':       { hi: 'ऊपरी सियांग', mr: 'ऊपरी सियांग', gu: 'Upper Siang', ta: 'மேல் சியாங்', te: 'అప్పర్ సియాంగ్', kn: 'ಅಪ್ಪರ್ ಸಿಯಾಂಗ್', ml: 'അപ്പർ സിയാങ്', bn: 'উপরি সিয়াং', or: 'ଉ ‌ pp sg', pa: 'ਅਪਰ ਸਿਆਂਗ' },
  'West Siang':        { hi: 'पश्चिम सियांग', mr: 'पश्चिम सियांग', gu: 'West Siang', ta: 'மேற்கு சியாங்', te: 'వెస్ట్ సియాంగ్', kn: 'ವೆಸ್ಟ್ ಸಿಯಾಂಗ್', ml: 'വെസ്‌റ്റ് സിയാങ്', bn: 'পশ্চিম সিয়াং', or: 'ପ ‌ sc sg', pa: 'ਪੱਛਮੀ ਸਿਆਂਗ' },
  'Lower Subansiri':   { hi: 'निचली सुबनसिरी', mr: 'निचली सुबनसिरी', gu: 'Lower Subansiri', ta: 'கீழ் சுபன்சிரி', te: 'లోయర్ సుబన్‌సిరి', kn: 'ಲೋವರ್ ಸುಬನ್ಸಿರಿ', ml: 'ലോവർ സുബൻസിരി', bn: 'লোয়ার সুবানসিরি', or: 'ନ ‌ ch sb', pa: 'ਲੋਅਰ ਸੁਬਾਨਸਿਰੀ' },
  'Upper Subansiri':   { hi: 'ऊपरी सुबनसिरी', mr: 'ऊपरी सुबनसिरी', gu: 'Upper Subansiri', ta: 'மேல் சுபன்சிரி', te: 'అప్పర్ సుబన్‌సిరి', kn: 'ಅಪ್ಪರ್ ಸುಬನ್ಸಿರಿ', ml: 'അപ്പർ സുബൻസിരി', bn: 'উপরি সুবানসিরি', or: 'ଉ ‌ pp sb', pa: 'ਅਪਰ ਸੁਬਾਨਸਿਰੀ' },
  'Kurung Kumey':      { hi: 'कुरुंग कुमेय', mr: 'कुरुंग कुमेय', gu: 'Kurung Kumey', ta: 'குருங் குமே', te: 'కురుంగ్ కుమే', kn: 'ಕುರುಂಗ್ ಕುಮೇ', ml: 'കുറുങ് കുമേ', bn: 'কুরুং কুমে', or: 'କ ‌ rng', pa: 'ਕੁਰੁੰਗ ਕੁਮੇ' },
  'Papum Pare':        { hi: 'पापुम पारे', mr: 'पापुम पारे', gu: 'Papum Pare', ta: 'பாபும் பரே', te: 'పాపం పారె', kn: 'ಪಾಪುಮ್ ಪಾರೆ', ml: 'പാപം പാരെ', bn: 'পাপুম পারে', or: 'ପ ‌ ppm', pa: 'ਪਾਪੂਮ ਪਾਰੇ' },
  'West Kameng':       { hi: 'पश्चिम कामेंग', mr: 'पश्चिम कामेंग', gu: 'West Kameng', ta: 'மேற்கு கமேங்', te: 'వెస్ట్ కమేంగ్', kn: 'ವೆಸ್ಟ್ ಕಾಮೆಂಗ್', ml: 'വെസ്‌റ്റ് കമേങ്', bn: 'পশ্চিম কামেং', or: 'ପ ‌ sc km', pa: 'ਪੱਛਮੀ ਕਾਮੇਂਗ' },
  // ── Common Blocks / Tehsils ────────────────────────────────────────────────────
  'Rabale':            { hi: 'रबाले', mr: 'रबाळे', gu: 'Rabale', ta: 'ரபாலே', te: 'రబాలే', kn: 'ರಬಾಲೆ', ml: 'റബാലെ', bn: 'রবালে', or: 'ର ‌ bl', pa: 'ਰਬਾਲੇ' },
  'Hoskote':           { hi: 'होस्कोटे', mr: 'होस्कोटे', gu: 'Hoskote', ta: 'ஹோஸ்கோட்', te: 'హోస్కోటె', kn: 'ಹೊಸಕೋಟೆ', ml: 'ഹൊസ്‌കോട്ടെ', bn: 'হোস্কোটে', or: 'ହ ‌ skt', pa: 'ਹੋਸਕੋਟੇ' },
  'Manur':             { hi: 'मनूर', mr: 'मनूर', gu: 'Manur', ta: 'மனூர்', te: 'మనూర్', kn: 'ಮನೂರ್', ml: 'മനൂർ', bn: 'মানুর', or: 'ମ ‌ n ‌ r', pa: 'ਮਨੂਰ' },
  'Vashi':             { hi: 'वाशी', mr: 'वाशी', gu: 'Vashi', ta: 'வாஷி', te: 'వాషి', kn: 'ವಾಶಿ', ml: 'വാഷി', bn: 'ভাশি', or: 'ୱ ‌ sh', pa: 'ਵਾਸ਼ੀ' },
  'Nerul':             { hi: 'नेरुल', mr: 'नेरुळ', gu: 'Nerul', ta: 'நேருல்', te: 'నేరుల్', kn: 'ನೇರುಲ್', ml: 'നേറുൽ', bn: 'নেরুল', or: 'ନ ‌ rl', pa: 'ਨੇਰੁਲ' },
  'Panvel':            { hi: 'पनवेल', mr: 'पनवेल', gu: 'Panvel', ta: 'பன்வேல்', te: 'పన్వేల్', kn: 'ಪನ್ವೇಲ್', ml: 'പൻ‍വൽ', bn: 'পানভেল', or: 'ପ ‌ nv', pa: 'ਪਨਵੇਲ' },
  'Kharghar':          { hi: 'खारघर', mr: 'खारघर', gu: 'Kharghar', ta: 'கார்கார்', te: 'ఖార్‌ఘర్', kn: 'ಖಾರ್‌ಘರ್', ml: 'ഖാർഘർ', bn: 'খারঘর', or: 'ଖ ‌ rgh', pa: 'ਖਾਰਘਰ' },
  'Taloja':            { hi: 'तलोजा', mr: 'तळोजा', gu: 'Taloja', ta: 'தலோஜா', te: 'తలోజా', kn: 'ತಲೋಜ', ml: 'തലോജ', bn: 'তালোজা', or: 'ତ ‌ lj', pa: 'ਤਲੋਜਾ' },
  'Devanahalli':       { hi: 'देवनहल्ली', mr: 'देवनहल्ली', gu: 'Devanahalli', ta: 'தேவனஹள்ளி', te: 'దేవనహళ్ళి', kn: 'ದೇವನಹಳ್ಳಿ', ml: 'ദേവനഹള്ളി', bn: 'দেভানহাল্লি', or: 'ଦ ‌ vnh', pa: 'ਦੇਵਾਨਾਹੱਲੀ' },
  'Anekal':            { hi: 'अनेकल', mr: 'अनेकल', gu: 'Anekal', ta: 'அனேகல்', te: 'ఆనేకల్', kn: 'ಆನೇಕಲ್', ml: 'ആനേക്കൽ', bn: 'আনেকাল', or: 'ଅ ‌ nkl', pa: 'ਅਨੇਕਲ' },
};

/**
 * Translates an Indian district or block (tehsil) name to the given language.
 * Returns the original string if no translation is found.
 */
// Case-insensitive index so stored values like "rewa" / "REWA" still match.
const DISTRICT_INDEX: Record<string, Record<string, string>> = (() => {
  const idx: Record<string, Record<string, string>> = {};
  for (const key in DISTRICT_TRANSLATIONS) {
    idx[key.trim().toLowerCase()] = DISTRICT_TRANSLATIONS[key];
  }
  return idx;
})();

export function translateLocationName(name: string, language: string): string {
  if (!name || language === 'en') return name;
  const translation = DISTRICT_TRANSLATIONS[name] ?? DISTRICT_INDEX[name.trim().toLowerCase()];
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

/**
 * Translates the place-name tokens inside a free-form, comma-separated location
 * string (e.g. a stored work-site address like "Rewa, Rewa, Madhya Pradesh").
 * Each comma-separated part is run through the state and district/block
 * dictionaries; tokens with no known translation (custom address lines, unknown
 * places) are left untouched. Safe to call on any address string.
 */
export function translateLocationString(value: string, language: string): string {
  if (!value || language === 'en') return value;
  return value
    .split(',')
    .map((part) => {
      const p = part.trim();
      if (!p) return part;
      const asState = translateStateName(p, language);
      if (asState !== p) return asState;
      return translateLocationName(p, language);
    })
    .join(', ');
}

// ── Worker/Agent profile completeness ────────────────────────────────────────
export function isWorkerProfileComplete(user: UserProfile | null | undefined): boolean {
  if (!user) return true;
  const role = (user.role ?? '').toLowerCase();
  if (!['selfworker', 'worker', 'agent'].includes(role)) return true;
  return !!(user.gender && user.dob);
}
