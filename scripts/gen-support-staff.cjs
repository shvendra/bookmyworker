/* eslint-disable */
// One-off generator: builds the "Support Staff Permanent/Contract" categories with
// 50 subcategories each, transliterated into 11 languages, and writes them into:
//   1) CRM   : crm/src/contract.json                              (en, hi, mr, gu)
//   2) Mobile: bookmyworker/packages/shared-mobile/src/shared/data/categories.json (all 11)
// Canonical VALUES are identical on both sides so backend storage/filtering/matching
// stay consistent. Re-runnable (idempotent): it strips any previously-generated
// support_staff_* categories before appending fresh ones.
const fs = require('fs');
const path = require('path');

// ── Per-word transliterations (phonetic, native script). mr == hi for these
//    English loanwords except where overridden. '&' kept as the universal symbol.
const W = {
  telecaller:   { hi:'टेलीकॉलर', gu:'ટેલીકૉલર', ta:'டெலிகாலர்', te:'టెలికాలర్', kn:'ಟೆಲಿಕಾಲರ್', ml:'ടെലികോളർ', bn:'টেলিকলার', or:'ଟେଲିକଲର', pa:'ਟੈਲੀਕਾਲਰ' },
  customer:     { hi:'कस्टमर', gu:'કસ્ટમર', ta:'கஸ்டமர்', te:'కస్టమర్', kn:'ಕಸ್ಟಮರ್', ml:'കസ്റ്റമർ', bn:'কাস্টমার', or:'କଷ୍ଟମର', pa:'ਕਸਟਮਰ' },
  support:      { hi:'सपोर्ट', gu:'સપોર્ટ', ta:'சப்போர்ட்', te:'సపోర్ట్', kn:'ಸಪೋರ್ಟ್', ml:'സപ്പോർട്ട്', bn:'সাপোর্ট', or:'ସପୋର୍ଟ', pa:'ਸਪੋਰਟ' },
  executive:    { hi:'एग्जीक्यूटिव', gu:'એક્ઝિક્યુટિવ', ta:'எக்ஸிகியூட்டிவ்', te:'ఎగ్జిక్యూటివ్', kn:'ಎಕ್ಸಿಕ್ಯೂಟಿವ್', ml:'എക്സിക്യൂട്ടീവ്', bn:'এক্সিকিউটিভ', or:'ଏକ୍ଜିକ୍ୟୁଟିଭ', pa:'ਐਗਜ਼ੀਕਿਊਟਿਵ' },
  data:         { hi:'डेटा', gu:'ડેટા', ta:'டேட்டா', te:'డేటా', kn:'ಡೇಟಾ', ml:'ഡാറ്റ', bn:'ডেটা', or:'ଡାଟା', pa:'ਡਾਟਾ' },
  entry:        { hi:'एंट्री', gu:'એન્ટ્રી', ta:'என்ட்ரி', te:'ఎంట్రీ', kn:'ಎಂಟ್ರಿ', ml:'എൻട്രി', bn:'এন্ট্রি', or:'ଏଣ୍ଟ୍ରି', pa:'ਐਂਟਰੀ' },
  operator:     { hi:'ऑपरेटर', gu:'ઑપરેટર', ta:'ஆபரேட்டர்', te:'ఆపరేటర్', kn:'ಆಪರೇಟರ್', ml:'ഓപ്പറേറ്റർ', bn:'অপারেটর', or:'ଅପରେଟର', pa:'ਆਪਰੇਟਰ' },
  back:         { hi:'बैक', gu:'બેક', ta:'பேக்', te:'బ్యాక్', kn:'ಬ್ಯಾಕ್', ml:'ബാക്ക്', bn:'ব্যাক', or:'ବ୍ୟାକ', pa:'ਬੈਕ' },
  office:       { hi:'ऑफिस', gu:'ઓફિસ', ta:'ஆபீஸ்', te:'ఆఫీస్', kn:'ಆಫೀಸ್', ml:'ഓഫീസ്', bn:'অফিস', or:'ଅଫିସ', pa:'ਆਫਿਸ' },
  computer:     { hi:'कंप्यूटर', gu:'કમ્પ્યુટર', ta:'கம்ப்யூட்டர்', te:'కంప్యూటర్', kn:'ಕಂಪ್ಯೂಟರ್', ml:'കമ്പ്യൂട്ടർ', bn:'কম্পিউটার', or:'କମ୍ପ୍ୟୁଟର', pa:'ਕੰਪਿਊਟਰ' },
  boy:          { hi:'बॉय', gu:'બોય', ta:'பாய்', te:'బాయ్', kn:'ಬಾಯ್', ml:'ബോയ്', bn:'বয়', or:'ବୟ', pa:'ਬੌਏ' },
  helper:       { hi:'हेल्पर', gu:'હેલ્પર', ta:'ஹெல்பர்', te:'హెల్పర్', kn:'ಹೆಲ್ಪರ್', ml:'ഹെൽപ്പർ', bn:'হেল্পার', or:'ହେଲ୍ପର', pa:'ਹੈਲਪਰ' },
  billing:      { hi:'बिलिंग', gu:'બિલિંગ', ta:'பில்லிங்', te:'బిల్లింగ్', kn:'ಬಿಲ್ಲಿಂಗ್', ml:'ബില്ലിംഗ്', bn:'বিলিং', or:'ବିଲିଂ', pa:'ਬਿਲਿੰਗ' },
  assistant:    { hi:'असिस्टेंट', gu:'આસિસ્ટન્ટ', ta:'அசிஸ்டன்ட்', te:'అసిస్టెంట్', kn:'ಅಸಿಸ್ಟೆಂಟ್', ml:'അസിസ്റ്റന്റ്', bn:'অ্যাসিস্ট্যান্ট', or:'ଆସିଷ୍ଟାଣ୍ଟ', pa:'ਅਸਿਸਟੈਂਟ' },
  store:        { hi:'स्टोर', gu:'સ્ટોર', ta:'ஸ்டோர்', te:'స్టోర్', kn:'ಸ್ಟೋರ್', ml:'സ്റ്റോർ', bn:'স্টোর', or:'ଷ୍ଟୋର', pa:'ਸਟੋਰ' },
  warehouse:    { hi:'वेयरहाउस', gu:'વેરહાઉસ', ta:'வேர்ஹவுஸ்', te:'వేర్‌హౌస్', kn:'ವೇರ್‌ಹೌಸ್', ml:'വെയർഹൗസ്', bn:'ওয়্যারহাউস', or:'ୱେୟାରହାଉସ', pa:'ਵੇਅਰਹਾਊਸ' },
  coordinator:  { hi:'कोऑर्डिनेटर', gu:'કોઓર્ડિનેટર', ta:'கோஆர்டினேட்டர்', te:'కోఆర్డినేటర్', kn:'ಕೋಆರ್ಡಿನೇಟರ್', ml:'കോർഡിനേറ്റർ', bn:'কোঅর্ডিনেটর', or:'କୋଅର୍ଡିନେଟର', pa:'ਕੋਆਰਡੀਨੇਟਰ' },
  crm:          { hi:'सीआरएम', gu:'સીઆરએમ', ta:'சிஆர்எம்', te:'సీఆర్ఎం', kn:'ಸಿಆರ್ಎಂ', ml:'സിആർഎം', bn:'সিআরএম', or:'ସିଆରଏମ', pa:'ਸੀਆਰਐਮ' },
  dispatch:     { hi:'डिस्पैच', gu:'ડિસ્પેચ', ta:'டிஸ்பேட்ச்', te:'డిస్పాచ్', kn:'ಡಿಸ್ಪ್ಯಾಚ್', ml:'ഡിസ്പാച്ച്', bn:'ডিসপ্যাচ', or:'ଡିସପ୍ୟାଚ', pa:'ਡਿਸਪੈਚ' },
  field:        { hi:'फील्ड', gu:'ફીલ્ડ', ta:'ஃபீல்ட்', te:'ఫీల్డ్', kn:'ಫೀಲ್ಡ್', ml:'ഫീൽഡ്', bn:'ফিল্ড', or:'ଫିଲ୍ଡ', pa:'ਫੀਲਡ' },
  collection:   { hi:'कलेक्शन', gu:'કલેક્શન', ta:'கலெக்ஷன்', te:'కలెక్షన్', kn:'ಕಲೆಕ್ಷನ್', ml:'കളക്ഷൻ', bn:'কালেকশন', or:'କଲେକ୍ସନ', pa:'ਕਲੈਕਸ਼ਨ' },
  service:      { hi:'सर्विस', gu:'સર્વિસ', ta:'சர்வீஸ்', te:'సర్వీస్', kn:'ಸರ್ವಿಸ್', ml:'സർവീസ്', bn:'সার্ভিস', or:'ସର୍ଭିସ', pa:'ਸਰਵਿਸ' },
  inventory:    { hi:'इन्वेंटरी', gu:'ઇન્વેન્ટરી', ta:'இன்வென்டரி', te:'ఇన్వెంటరీ', kn:'ಇನ್ವೆಂಟರಿ', ml:'ഇൻവെന്ററി', bn:'ইনভেন্টরি', or:'ଇନଭେଣ୍ଟରୀ', pa:'ਇਨਵੈਂਟਰੀ' },
  documentation:{ hi:'डॉक्युमेंटेशन', gu:'ડોક્યુમેન્ટેશન', ta:'டாகுமென்டேஷன்', te:'డాక్యుమెంటేషన్', kn:'ಡಾಕ್ಯುಮೆಂಟೇಶನ್', ml:'ഡോക്യുമെന്റേഷൻ', bn:'ডকুমেন্টেশন', or:'ଡକ୍ୟୁମେଣ୍ଟେସନ', pa:'ਡੌਕਯੂਮੈਂਟੇਸ਼ਨ' },
  reception:    { hi:'रिसेप्शन', gu:'રિસેપ્શન', ta:'ரிசெப்ஷன்', te:'రిసెప్షన్', kn:'ರಿಸೆಪ್ಷನ್', ml:'റിസെപ്ഷൻ', bn:'রিসেপশন', or:'ରିସେପ୍ସନ', pa:'ਰਿਸੈਪਸ਼ਨ' },
  delivery:     { hi:'डिलीवरी', gu:'ડિલિવરી', ta:'டெலிவரி', te:'డెలివరీ', kn:'ಡೆಲಿವರಿ', ml:'ഡെലിവറി', bn:'ডেলিভারি', or:'ଡେଲିଭରୀ', pa:'ਡਿਲੀਵਰੀ' },
  logistics:    { hi:'लॉजिस्टिक्स', gu:'લોજિસ્ટિક્સ', ta:'லாஜிஸ்டிக்ஸ்', te:'లాజిస్టిక్స్', kn:'ಲಾಜಿಸ್ಟಿಕ್ಸ್', ml:'ലോജിസ്റ്റിക്സ്', bn:'লজিস্টিকস', or:'ଲଜିଷ୍ଟିକ୍ସ', pa:'ਲੌਜਿਸਟਿਕਸ' },
  admin:        { hi:'एडमिन', gu:'એડમિન', ta:'அட்மின்', te:'అడ్మిన్', kn:'ಅಡ್ಮಿನ್', ml:'അഡ്മിൻ', bn:'অ্যাডমিন', or:'ଆଡମିନ', pa:'ਐਡਮਿਨ' },
  front:        { hi:'फ्रंट', gu:'ફ્રન્ટ', ta:'ஃப்ரண்ட்', te:'ఫ్రంట్', kn:'ಫ್ರಂಟ್', ml:'ഫ്രണ്ട്', bn:'ফ্রন্ট', or:'ଫ୍ରଣ୍ଟ', pa:'ਫਰੰਟ' },
  care:         { hi:'केयर', gu:'કેર', ta:'கேர்', te:'కేర్', kn:'ಕೇರ್', ml:'കെയർ', bn:'কেয়ার', or:'କେୟାର', pa:'ਕੇਅਰ' },
  ecommerce:    { hi:'ई-कॉमर्स', gu:'ઇ-કોમર્સ', ta:'இ-காமர்ஸ்', te:'ఇ-కామర్స్', kn:'ಇ-ಕಾಮರ್ಸ್', ml:'ഇ-കൊമേഴ്സ്', bn:'ই-কমার্স', or:'ଇ-କମର୍ସ', pa:'ਈ-ਕਾਮਰਸ' },
  order:        { hi:'ऑर्डर', gu:'ઓર્ડર', ta:'ஆர்டர்', te:'ఆర్డర్', kn:'ಆರ್ಡರ್', ml:'ഓർഡർ', bn:'অর্ডার', or:'ଅର୍ଡର', pa:'ਆਰਡਰ' },
  processing:   { hi:'प्रोसेसिंग', gu:'પ્રોસેસિંગ', ta:'ப்ராசசிங்', te:'ప్రాసెసింగ్', kn:'ಪ್ರೊಸೆಸಿಂಗ್', ml:'പ്രോസസിംഗ്', bn:'প্রসেসিং', or:'ପ୍ରୋସେସିଂ', pa:'ਪ੍ਰੋਸੈਸਿੰਗ' },
  verification: { hi:'वेरिफिकेशन', gu:'વેરિફિકેશન', ta:'வெரிஃபிகேஷன்', te:'వెరిఫికేషన్', kn:'ವೆರಿಫಿಕೇಶನ್', ml:'വെരിഫിക്കേഷൻ', bn:'ভেরিফিকেশন', or:'ଭେରିଫିକେସନ', pa:'ਵੈਰੀਫਿਕੇਸ਼ਨ' },
  relationship: { hi:'रिलेशनशिप', gu:'રિલેશનશિપ', ta:'ரிலேஷன்ஷிப்', te:'రిలేషన్‌షిప్', kn:'ರಿಲೇಶನ್‌ಶಿಪ್', ml:'റിലേഷൻഷിപ്പ്', bn:'রিলেশনশিপ', or:'ରିଲେସନସିପ', pa:'ਰਿਲੇਸ਼ਨਸ਼ਿਪ' },
  sales:        { hi:'सेल्स', gu:'સેલ્સ', ta:'சேல்ஸ்', te:'సేల్స్', kn:'ಸೇಲ್ಸ್', ml:'സെയിൽസ്', bn:'সেলস', or:'ସେଲ୍ସ', pa:'ਸੇਲਜ਼' },
  marketing:    { hi:'मार्केटिंग', gu:'માર્કેટિંગ', ta:'மார்க்கெட்டிங்', te:'మార్కెటింగ్', kn:'ಮಾರ್ಕೆಟಿಂಗ್', ml:'മാർക്കറ്റിംഗ്', bn:'মার্কেটিং', or:'ମାର୍କେଟିଂ', pa:'ਮਾਰਕੀਟਿੰਗ' },
  operations:   { hi:'ऑपरेशंस', gu:'ઓપરેશન્સ', ta:'ஆபரேஷன்ஸ்', te:'ఆపరేషన్స్', kn:'ಆಪರೇಷನ್ಸ್', ml:'ഓപ്പറേഷൻസ്', bn:'অপারেশনস', or:'ଅପରେସନ୍ସ', pa:'ਆਪਰੇਸ਼ਨਜ਼' },
  purchase:     { hi:'परचेज', gu:'પરચેઝ', ta:'பர்ச்சேஸ்', te:'పర్చేజ్', kn:'ಪರ್ಚೇಸ್', ml:'പർച്ചേസ്', bn:'পারচেজ', or:'ପର୍ଚେଜ', pa:'ਪਰਚੇਜ਼' },
  procurement:  { hi:'प्रोक्योरमेंट', gu:'પ્રોક્યોરમેન્ટ', ta:'ப்ரொக்யூர்மென்ட்', te:'ప్రొక్యూర్‌మెంట్', kn:'ಪ್ರೊಕ್ಯೂರ್‌ಮೆಂಟ್', ml:'പ്രൊക്യുർമെന്റ്', bn:'প্রকিউরমেন্ট', or:'ପ୍ରୋକ୍ୟୁରମେଣ୍ଟ', pa:'ਪ੍ਰੋਕਿਊਰਮੈਂਟ' },
  vendor:       { hi:'वेंडर', gu:'વેન્ડર', ta:'வென்டர்', te:'వెండర్', kn:'ವೆಂಡರ್', ml:'വെൻഡർ', bn:'ভেন্ডর', or:'ଭେଣ୍ଡର', pa:'ਵੈਂਡਰ' },
  complaint:    { hi:'कंप्लेंट', gu:'કમ્પ્લેન્ટ', ta:'காம்ப்ளைன்ட்', te:'కంప్లైంట్', kn:'ಕಂಪ್ಲೇಂಟ್', ml:'കംപ്ലെയിന്റ്', bn:'কমপ্লেইন্ট', or:'କମ୍ପ୍ଲେଣ୍ଟ', pa:'ਕੰਪਲੇਂਟ' },
  handling:     { hi:'हैंडलिंग', gu:'હેન્ડલિંગ', ta:'ஹேண்ட்லிங்', te:'హ్యాండ్లింగ్', kn:'ಹ್ಯಾಂಡ್ಲಿಂಗ್', ml:'ഹാൻഡ്‌ലിംഗ്', bn:'হ্যান্ডলিং', or:'ହ୍ୟାଣ୍ଡଲିଂ', pa:'ਹੈਂਡਲਿੰਗ' },
  help:         { hi:'हेल्प', gu:'હેલ્પ', ta:'ஹெல்ப்', te:'హెల్ప్', kn:'ಹೆಲ್ಪ್', ml:'ഹെൽപ്പ്', bn:'হেল্প', or:'ହେଲ୍ପ', pa:'ਹੈਲਪ' },
  desk:         { hi:'डेस्क', gu:'ડેસ્ક', ta:'டெஸ்க்', te:'డెస్క్', kn:'ಡೆಸ್ಕ್', ml:'ഡെസ്ക്', bn:'ডেস্ক', or:'ଡେସ୍କ', pa:'ਡੈਸਕ' },
  mis:          { hi:'एमआईएस', gu:'એમઆઈએસ', ta:'எம்ஐஎஸ்', te:'ఎంఐఎస్', kn:'ಎಂಐಎಸ್', ml:'എംഐഎസ്', bn:'এমআইএস', or:'ଏମଆଇଏସ', pa:'ਐਮਆਈਐਸ' },
  records:      { hi:'रिकॉर्ड्स', gu:'રેકોર્ડ્સ', ta:'ரெகார்ட்ஸ்', te:'రికార్డ్స్', kn:'ರೆಕಾರ್ಡ್ಸ್', ml:'റെക്കോർഡ്സ്', bn:'রেকর্ডস', or:'ରେକର୍ଡସ', pa:'ਰਿਕਾਰਡਜ਼' },
  management:   { hi:'मैनेजमेंट', gu:'મેનેજમેન્ટ', ta:'மேனேஜ்மென்ட்', te:'మేనేజ్‌మెంట్', kn:'ಮ್ಯಾನೇಜ್‌ಮೆಂಟ್', ml:'മാനേജ്മെന്റ്', bn:'ম্যানেজমেন্ট', or:'ମ୍ୟାନେଜମେଣ୍ଟ', pa:'ਮੈਨੇਜਮੈਂਟ' },
  clerk:        { hi:'क्लर्क', gu:'ક્લાર્ક', ta:'கிளார்க்', te:'క్లర్క్', kn:'ಕ್ಲರ್ಕ್', ml:'ക്ലർക്ക്', bn:'ক্লার্ক', or:'କ୍ଲର୍କ', pa:'ਕਲਰਕ' },
  appointment:  { hi:'अपॉइंटमेंट', gu:'એપોઇન્ટમેન્ટ', ta:'அப்பாயிண்ட்மென்ட்', te:'అపాయింట్‌మెంట్', kn:'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್', ml:'അപ്പോയിന്റ്മെന്റ്', bn:'অ্যাপয়েন্টমেন্ট', or:'ଆପଏଣ୍ଟମେଣ୍ଟ', pa:'ਅਪੌਇੰਟਮੈਂਟ' },
  call:         { hi:'कॉल', gu:'કૉલ', ta:'கால்', te:'కాల్', kn:'ಕಾಲ್', ml:'കോൾ', bn:'কল', or:'କଲ', pa:'ਕਾਲ' },
  center:       { hi:'सेंटर', gu:'સેન્ટર', ta:'சென்டர்', te:'సెంటర్', kn:'ಸೆಂಟರ್', ml:'സെന്റർ', bn:'সেন্টার', or:'ସେଣ୍ଟର', pa:'ਸੈਂਟਰ' },
  chat:         { hi:'चैट', gu:'ચેટ', ta:'சாட்', te:'చాట్', kn:'ಚಾಟ್', ml:'ചാറ്റ്', bn:'চ্যাট', or:'ଚାଟ', pa:'ਚੈਟ' },
  email:        { hi:'ईमेल', gu:'ઇમેઇલ', ta:'இமெயில்', te:'ఇమెయిల్', kn:'ಇಮೇಲ್', ml:'ഇമെയിൽ', bn:'ইমেইল', or:'ଇମେଲ', pa:'ਈਮੇਲ' },
  branch:       { hi:'ब्रांच', gu:'બ્રાન્ચ', ta:'பிராஞ்ச்', te:'బ్రాంచ్', kn:'ಬ್ರಾಂಚ್', ml:'ബ്രാഞ്ച്', bn:'ব্রাঞ্চ', or:'ବ୍ରାଞ୍ଚ', pa:'ਬ੍ਰਾਂਚ' },
  fleet:        { hi:'फ्लीट', gu:'ફ્લીટ', ta:'ஃப்ளீட்', te:'ఫ్లీట్', kn:'ಫ್ಲೀಟ್', ml:'ഫ്ലീറ്റ്', bn:'ফ্লিট', or:'ଫ୍ଲିଟ', pa:'ਫਲੀਟ' },
  attendance:   { hi:'अटेंडेंस', gu:'એટેન્ડન્સ', ta:'அட்டென்டன்ஸ்', te:'అటెండెన్స్', kn:'ಅಟೆಂಡೆನ್ಸ್', ml:'അറ്റൻഡൻസ്', bn:'অ্যাটেন্ডেন্স', or:'ଆଟେଣ୍ଡାନ୍ସ', pa:'ਅਟੈਂਡੈਂਸ' },
  payroll:      { hi:'पेरोल', gu:'પેરોલ', ta:'பேரோல்', te:'పేరోల్', kn:'ಪೇರೋಲ್', ml:'പേറോൾ', bn:'পেরোল', or:'ପେରୋଲ', pa:'ਪੇਰੋਲ' },
  // category words
  staff:        { hi:'स्टाफ', gu:'સ્ટાફ', ta:'ஸ்டாஃப்', te:'స్టాఫ్', kn:'ಸ್ಟಾಫ್', ml:'സ്റ്റാഫ്', bn:'স্টাফ', or:'ଷ୍ଟାଫ', pa:'ਸਟਾਫ਼' },
  permanent:    { hi:'परमानेंट', gu:'પરમેનન્ટ', ta:'பெர்மனென்ட்', te:'పర్మనెంట్', kn:'ಪರ್ಮನೆಂಟ್', ml:'പെർമനന്റ്', bn:'পার্মানেন্ট', or:'ପର୍ମାନେଣ୍ଟ', pa:'ਪਰਮਾਨੈਂਟ' },
  contract:     { hi:'कॉन्ट्रैक्ट', gu:'કોન્ટ્રાક્ટ', ta:'காண்ட்ராக்ட்', te:'కాంట్రాక్ట్', kn:'ಕಾಂಟ್ರ್ಯಾಕ್ಟ್', ml:'കോൺട്രാക്ട്', bn:'কন্ট্রাক্ট', or:'କଣ୍ଟ୍ରାକ୍ଟ', pa:'ਕਾਂਟ੍ਰੈਕਟ', mr:'कॉन्ट्रॅक्ट' },
};
const LANGS = ['hi','gu','ta','te','kn','ml','bn','or','pa'];
const MR_OVERRIDE = { contract: 'कॉन्ट्रॅक्ट' }; // Marathi differs only here

function translit(tokens, lang) {
  return tokens.map((tok) => {
    if (tok === '&') return '&';
    if (lang === 'mr') return MR_OVERRIDE[tok] || W[tok].hi; // mr == hi for these loanwords
    return W[tok][lang];
  }).join(' ');
}

// ── The 50 roles: English label + canonical value + word tokens ───────────────
const ROLES = [
  ['Telecaller','telecaller',['telecaller']],
  ['Customer Support Executive','customer_support_executive',['customer','support','executive']],
  ['Data Entry Operator','data_entry_operator',['data','entry','operator']],
  ['Back Office Executive','back_office_executive',['back','office','executive']],
  ['Computer Operator','computer_operator',['computer','operator']],
  ['Office Boy','office_boy',['office','boy']],
  ['Office Helper','office_helper',['office','helper']],
  ['Billing Assistant','billing_assistant',['billing','assistant']],
  ['Store Assistant','store_assistant',['store','assistant']],
  ['Warehouse Coordinator','warehouse_coordinator',['warehouse','coordinator']],
  ['CRM Executive','crm_executive',['crm','executive']],
  ['Dispatch Assistant','dispatch_assistant',['dispatch','assistant']],
  ['Dispatch Coordinator','dispatch_coordinator',['dispatch','coordinator']],
  ['Field Coordinator','field_coordinator',['field','coordinator']],
  ['Collection Executive','collection_executive',['collection','executive']],
  ['Service Coordinator','service_coordinator',['service','coordinator']],
  ['Inventory Assistant','inventory_assistant',['inventory','assistant']],
  ['Documentation Assistant','documentation_assistant',['documentation','assistant']],
  ['Reception Assistant','reception_assistant',['reception','assistant']],
  ['Delivery Coordinator','delivery_coordinator',['delivery','coordinator']],
  ['Logistics Coordinator','logistics_coordinator',['logistics','coordinator']],
  ['Admin Assistant','admin_assistant',['admin','assistant']],
  ['Front Office Assistant','front_office_assistant',['front','office','assistant']],
  ['Customer Care Executive','customer_care_executive',['customer','care','executive']],
  ['Office Coordinator','office_coordinator',['office','coordinator']],
  ['E-commerce Executive','ecommerce_executive',['ecommerce','executive']],
  ['Order Processing Executive','order_processing_executive',['order','processing','executive']],
  ['Verification Executive','verification_executive',['verification','executive']],
  ['Customer Relationship Executive','customer_relationship_executive',['customer','relationship','executive']],
  ['Sales Coordinator','sales_coordinator',['sales','coordinator']],
  ['Marketing Coordinator','marketing_coordinator',['marketing','coordinator']],
  ['Operations Assistant','operations_assistant',['operations','assistant']],
  ['Purchase Assistant','purchase_assistant',['purchase','assistant']],
  ['Procurement Assistant','procurement_assistant',['procurement','assistant']],
  ['Vendor Coordinator','vendor_coordinator',['vendor','coordinator']],
  ['Complaint Handling Executive','complaint_handling_executive',['complaint','handling','executive']],
  ['Help Desk Executive','help_desk_executive',['help','desk','executive']],
  ['MIS Executive','mis_executive',['mis','executive']],
  ['Records Management Assistant','records_management_assistant',['records','management','assistant']],
  ['Dispatch Clerk','dispatch_clerk',['dispatch','clerk']],
  ['Documentation Executive','documentation_executive',['documentation','executive']],
  ['Appointment Coordinator','appointment_coordinator',['appointment','coordinator']],
  ['Service Desk Executive','service_desk_executive',['service','desk','executive']],
  ['Support Executive','support_executive',['support','executive']],
  ['Call Center Executive','call_center_executive',['call','center','executive']],
  ['Chat Support Executive','chat_support_executive',['chat','support','executive']],
  ['Email Support Executive','email_support_executive',['email','support','executive']],
  ['Branch Support Executive','branch_support_executive',['branch','support','executive']],
  ['Fleet Coordinator','fleet_coordinator',['fleet','coordinator']],
  ['Attendance & Payroll Assistant','attendance_payroll_assistant',['attendance','&','payroll','assistant']],
];

// Build subcategory entries
function subMobile([en, value, tokens]) {
  const o = { label: en, value };
  const map = { hi:'hindilabel', mr:'marathilabel', gu:'gujaratilabel', ta:'tamillabel', te:'telugulabel', kn:'kannadalabel', ml:'malayalamlabel', bn:'banglalabel', or:'odialabel', pa:'punjabilabel' };
  o.hindilabel = translit(tokens, 'hi');
  o.marathilabel = translit(tokens, 'mr');
  o.gujaratilabel = translit(tokens, 'gu');
  o.tamillabel = translit(tokens, 'ta');
  o.telugulabel = translit(tokens, 'te');
  o.kannadalabel = translit(tokens, 'kn');
  o.malayalamlabel = translit(tokens, 'ml');
  o.banglalabel = translit(tokens, 'bn');
  o.odialabel = translit(tokens, 'or');
  o.punjabilabel = translit(tokens, 'pa');
  return o;
}
function subCrm([en, value, tokens]) {
  return {
    label: en, value,
    hindilabel: translit(tokens, 'hi'),
    marathilabel: translit(tokens, 'mr'),
    gujaratilabel: translit(tokens, 'gu'),
  };
}

const CATS = [
  { value: 'support_staff_permanent', tokens: ['support','staff','permanent'], en: 'Support Staff Permanent' },
  { value: 'support_staff_contract',  tokens: ['support','staff','contract'],  en: 'Support Staff Contract' },
];

// ── 1) CRM contract.json ───────────────────────────────────────────────────────
const crmPath = path.resolve(__dirname, '../../crm/src/contract.json');
const crm = CATS.map((c) => ({
  label: c.en,
  hindilabel: translit(c.tokens, 'hi'),
  marathilabel: translit(c.tokens, 'mr'),
  gujaratilabel: translit(c.tokens, 'gu'),
  value: c.value,
  subcategories: ROLES.map(subCrm),
}));
fs.writeFileSync(crmPath, JSON.stringify(crm, null, 2) + '\n');
console.log('CRM contract.json written:', crm.length, 'categories x', ROLES.length, 'subs');

// ── 2) Mobile categories.json (append, idempotent) ─────────────────────────────
const mobPath = path.resolve(__dirname, '../packages/shared-mobile/src/shared/data/categories.json');
const mob = JSON.parse(fs.readFileSync(mobPath, 'utf8'));
const cleaned = mob.filter((c) => !String(c.value).startsWith('support_staff_'));
const mobNew = CATS.map((c) => ({
  label: c.en,
  value: c.value,
  subcategories: ROLES.map(subMobile),
}));
const out = [...cleaned, ...mobNew];
fs.writeFileSync(mobPath, JSON.stringify(out, null, 2) + '\n');
console.log('Mobile categories.json written. total categories:', out.length, '(added', mobNew.length, ')');

// Emit the EXTRA_CAT label map (for labelUtils) so the 2 categories translate.
const extraCat = {};
for (const c of CATS) {
  extraCat[c.value] = { en: c.en };
  for (const l of LANGS) extraCat[c.value][l] = translit(c.tokens, l);
  extraCat[c.value].mr = translit(c.tokens, 'mr');
}
fs.writeFileSync(path.resolve(__dirname, 'support-staff-catlabels.json'), JSON.stringify(extraCat, null, 2));
console.log('Category label map emitted to scripts/support-staff-catlabels.json');
