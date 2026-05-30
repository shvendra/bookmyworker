import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSubCatLabel } from '../../../shared/utils/labelUtils';
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { indianStates } from '../../data/stateDistrict';
import { showAlert } from '../../state/alert/AppAlertContext';
import { useAuth } from '../../../state/auth/AuthContext';
import { updateProfileFields } from '../../../core/api/endpoints/authApi';
import { getAccessToken } from '../../../core/storage/authStorage';
import { ENV } from '../../../core/config/env';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { LocationSelector } from '../forms/LocationSelector';
import type { UserProfile } from '../../types/domain';
import categoriesData from '../../data/categories.json';

// Direct JSON save — same approach as WorkCategorySelectScreen (proven to work)
async function saveAreasOfWork(areasOfWork: string[]): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${ENV.API_BASE_URL}/api/v1/user/update`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ areasOfWork }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Save failed (${res.status})`);
  }
}

async function saveCategories(categories: string[]): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${ENV.API_BASE_URL}/api/v1/user/update`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ categories }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Save failed (${res.status})`);
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────

interface CatItem { label: string; value: string; subcategories: Array<{ label: string; value: string }> }
const ALL_CATS = categoriesData as CatItem[];

const CAT_META: Record<string, { short: string; icon: string; color: string }> = {
  construction_project_workers:     { short: 'Construction',     icon: '🏗️', color: '#F97316' },
  manufacturing_industrial_workers: { short: 'Manufacturing',    icon: '🏭', color: '#6366F1' },
  agriculture_farming_workers:      { short: 'Agriculture',      icon: '🌾', color: '#22C55E' },
  event_decoration_workers:         { short: 'Events & Decor',   icon: '🎉', color: '#EC4899' },
  household_domestic_workers:       { short: 'Household',        icon: '🏠', color: '#14B8A6' },
  hospitality_service_workers:      { short: 'Hospitality',      icon: '🍽️', color: '#F59E0B' },
  transport_logistics_workers:      { short: 'Transport',        icon: '🚛', color: '#3B82F6' },
  retail_shop_workers:              { short: 'Retail',           icon: '🛍️', color: '#8B5CF6' },
  skilled_technical_workers:        { short: 'Skilled Tech',     icon: '⚙️', color: '#06B6D4' },
  specialized_creative_workers:     { short: 'Creative',         icon: '🎨', color: '#D946EF' },
  'Automobile & Workshop Workers':  { short: 'Automobile',       icon: '🔧', color: '#78716C' },
  'Healthcare Support Workers':     { short: 'Healthcare',       icon: '🏥', color: '#EF4444' },
  'Security & Facility Workers':    { short: 'Security',         icon: '🛡️', color: '#0EA5E9' },
};

// Maps category backend value → existing i18n key (already translated in all 11 languages)
const CAT_KEY_MAP: Record<string, string> = {
  construction_project_workers:     'construction',
  manufacturing_industrial_workers: 'manufacturing',
  agriculture_farming_workers:      'agriculture',
  event_decoration_workers:         'cat_event',
  household_domestic_workers:       'household',
  hospitality_service_workers:      'hospitality',
  transport_logistics_workers:      'cat_transport',
  retail_shop_workers:              'retail',
  skilled_technical_workers:        'cat_technical',
  specialized_creative_workers:     'cat_creative',
  'Automobile & Workshop Workers':  'cat_automobile',
  'Healthcare Support Workers':     'cat_healthcare',
  'Security & Facility Workers':    'security',
};

type StepId = 'location' | 'agentType' | 'workerSubType' | 'categories' | 'employerType' | 'personalDetails';
interface StepConfig { id: StepId; icon: string; color: string; titleKey: string; subtitleKey: string }

const AGENT_TYPES = [
  { value: 'Group worker supplier',     label: 'Group Work Supplier',     icon: '👥', color: '#6366F1', desc: 'Supply teams for job sites & projects' },
  { value: 'Skilled worker supplier',   label: 'Skilled Work Supplier',   icon: '🔧', color: '#F97316', desc: 'Place skilled tradespeople for projects' },
  { value: 'Unskilled worker supplier', label: 'Unskilled Work Supplier', icon: '🏗️', color: '#14B8A6', desc: 'General labour and unskilled workforce' },
  { value: 'Contract worker supplier',  label: 'Contract Work Supplier',  icon: '📋', color: '#8B5CF6', desc: 'Short & long-term contract placements' },
];

const WORKER_SUB_TYPES = [
  { value: 'Skilled',     label: 'Skilled Worker',  icon: '🔧', color: '#F97316', desc: 'Trained in a trade — plumber, electrician, welder' },
  { value: 'Unskilled',   label: 'Unskilled',       icon: '🏗️', color: '#14B8A6', desc: 'General construction, loading, helpers' },
  { value: 'ITI/Diploma', label: 'ITI / Diploma',   icon: '🎓', color: '#6366F1', desc: 'Certificate holder for technical roles' },
  { value: 'Graduate',    label: 'Graduate',        icon: '📚', color: '#8B5CF6', desc: 'Degree holder for professional roles' },
];

const EMPLOYER_TYPE_LIST = [
  { key: 'individual', label: 'Individual',  icon: '👤', color: '#06B6D4', desc: 'Personal / household hiring' },
  { key: 'contractor', label: 'Contractor',  icon: '🔧', color: '#F97316', desc: 'Construction & project work' },
  { key: 'agency',     label: 'Agency',      icon: '🏦', color: '#8B5CF6', desc: 'Staffing or placement agency' },
  { key: 'industry',   label: 'Industry',    icon: '🏭', color: '#6366F1', desc: 'Factory, plant or enterprise' },
];

function getSteps(user: UserProfile): StepConfig[] {
  const role = user.role;
  const steps: StepConfig[] = [];
  const needsLocation = !user.state;
  // Consider categories filled if either areasOfWork or categories (new field) has values
  const needsCategories = !user.areasOfWork?.length && !user.categories?.length;
  // Only check dob and gender — preferredWorkLocations is optional and not part of core onboarding
  const needsPersonal = !user.dob || !user.gender;

  // For agent/worker/selfworker: if core onboarding fields are already filled by
  // WorkerProfileCompletionScreen (gender + dob + state + categories), skip the modal entirely.
  if (role === 'agent' || role === 'selfworker' || role === 'worker') {
    const coreComplete = !!(user.gender && user.dob && user.state && !needsCategories);
    if (coreComplete) return [];
  }

  if (role === 'agent') {
    if (!user.agentType)  steps.push({ id: 'agentType',      icon: '🤝', color: '#6366F1', titleKey: 'wizard_agentTypeTitle',  subtitleKey: 'wizard_agentTypeSub' });
    if (needsLocation)    steps.push({ id: 'location',       icon: '📍', color: '#EF4444', titleKey: 'wizard_locationTitle',   subtitleKey: 'wizard_locationSubAgent' });
    if (needsCategories)  steps.push({ id: 'categories',     icon: '💼', color: '#0891B2', titleKey: 'wizard_catsAgentTitle',  subtitleKey: 'wizard_catsAgentSub' });
    if (needsPersonal)    steps.push({ id: 'personalDetails', icon: '👤', color: '#10B981', titleKey: 'wizard_personalTitle',   subtitleKey: 'wizard_personalSub' });
  }
  if (role === 'selfworker' || role === 'worker') {
    if (!user.workerSubType) steps.push({ id: 'workerSubType',  icon: '👷', color: '#F97316', titleKey: 'wizard_workerSubTitle',  subtitleKey: 'wizard_workerSubSub' });
    if (needsLocation)       steps.push({ id: 'location',       icon: '📍', color: '#EF4444', titleKey: 'wizard_locationTitle',   subtitleKey: 'wizard_locationSubWorker' });
    if (needsCategories)     steps.push({ id: 'categories',     icon: '💼', color: '#0891B2', titleKey: 'wizard_catsWorkerTitle', subtitleKey: 'wizard_catsWorkerSub' });
    if (needsPersonal)       steps.push({ id: 'personalDetails', icon: '👤', color: '#10B981', titleKey: 'wizard_personalTitle',   subtitleKey: 'wizard_personalSub' });
  }
  if (role === 'employer') {
    const et = user.employerType;
    const hasType = et && Object.values(et).some(Boolean);
    if (!hasType)       steps.push({ id: 'employerType',     icon: '🏢', color: '#8B5CF6', titleKey: 'whatTypeEmployer',        subtitleKey: 'wizard_employerTypeSub' });
    if (needsLocation)  steps.push({ id: 'location',         icon: '📍', color: '#EF4444', titleKey: 'wizard_bizLocTitle',      subtitleKey: 'wizard_bizLocSub' });
  }
  return steps;
}

const { width: W, height: H } = Dimensions.get('window');
const BRAND = '#1037A4';

// ─── Option Card ──────────────────────────────────────────────────────────────
const OptionCard = ({
  icon, label, desc, selected, onPress, color,
}: { icon: string; label: string; desc: string; selected: boolean; onPress: () => void; color: string }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const handleOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 35, bounciness: 8 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        style={[
          oc.card,
          selected
            ? { borderColor: color, borderWidth: 2, backgroundColor: color + '08' }
            : { borderColor: '#E8EEF6', borderWidth: 1.5, backgroundColor: '#FAFBFF' },
        ]}
      >
        {/* Colored icon badge */}
        <View style={[oc.iconBadge, { backgroundColor: color + '18' }]}>
          <Text style={oc.iconTxt}>{icon}</Text>
        </View>

        <View style={oc.textWrap}>
          <Text style={[oc.label, { color: selected ? color : '#111827' }]}>{label}</Text>
          <Text style={oc.desc}>{desc}</Text>
        </View>

        {/* Radio */}
        <View style={[oc.radio, { borderColor: selected ? color : '#D1D9E6', backgroundColor: selected ? color : 'transparent' }]}>
          {selected && <Text style={oc.radioCheck}>✓</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const oc = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, gap: 12,
               shadowColor: '#1037A4', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  iconBadge: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconTxt:   { fontSize: 24 },
  textWrap:  { flex: 1, gap: 3 },
  label:     { fontSize: 14.5, fontWeight: '700', lineHeight: 20, letterSpacing: -0.1 },
  desc:      { fontSize: 12, color: '#64748B', lineHeight: 17 },
  radio:     { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioCheck:{ fontSize: 11, color: '#fff', fontWeight: '900', lineHeight: 15 },
});

// ─── Category Chip ─────────────────────────────────────────────────────────────
const CatChip = ({
  catKey, label, icon, color, selected, onPress,
}: { catKey: string; label: string; icon: string; color: string; selected: boolean; onPress: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn  = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 60, bounciness: 4 }).start();
  const handleOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 35, bounciness: 10 }).start();

  return (
    <Animated.View style={[chip.wrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        style={[
          chip.inner,
          selected
            ? { backgroundColor: color + '14', borderColor: color, borderWidth: 2 }
            : { backgroundColor: '#F8FAFF', borderColor: '#E2E8F4', borderWidth: 1.5 },
        ]}
      >
        <View style={[chip.iconCircle, { backgroundColor: selected ? color + '20' : '#EEF2FA' }]}>
          <Text style={chip.iconTxt}>{icon}</Text>
        </View>
        <Text style={[chip.label, { color: selected ? color : '#374151', fontWeight: selected ? '700' : '500' }]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {selected && (
          <View style={[chip.checkDot, { backgroundColor: color }]}>
            <Text style={chip.checkTxt}>✓</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

// 3 chips per row: total = 3*w + 2*gap; gap=10 → 3*w + 20 = W-40 → w = (W-60)/3
const CHIP_W = Math.floor((W - 60) / 3);
const chip = StyleSheet.create({
  wrap:      { width: CHIP_W },
  inner:     { borderRadius: 16, padding: 10, alignItems: 'center', gap: 6, minHeight: 90,
               shadowColor: '#1037A4', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  iconCircle:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconTxt:   { fontSize: 22 },
  label:     { fontSize: 11.5, lineHeight: 15, textAlign: 'center' },
  checkDot:  { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  checkTxt:  { fontSize: 10, color: '#fff', fontWeight: '900', lineHeight: 13 },
});

// ─── Main Wizard ──────────────────────────────────────────────────────────────

interface Props { user: UserProfile }

export const ProfileCompletionModal = ({ user }: Props): React.JSX.Element | null => {
  const { t, i18n } = useTranslation();
  const { updateProfile: patchSession } = useAuth();

  const [steps] = useState(() => getSteps(user));
  const [wizardOpen, setWizardOpen] = useState(steps.length > 0);
  const [showNudge,  setShowNudge]  = useState(false);
  const [stepIdx, setStepIdx]       = useState(0);
  const [saving, setSaving]         = useState(false);
  const [done, setDone]             = useState(false);

  const [locState, setLocState] = useState(user.state ?? '');
  const [locDist,  setLocDist]  = useState(user.district ?? '');
  const [locBlock, setLocBlock] = useState(user.block ?? '');
  const [agentType, setAgentType]   = useState(user.agentType ?? '');
  const [workerSub, setWorkerSub]   = useState(user.workerSubType ?? '');
  const [selCats,  setSelCats]      = useState<string[]>(user.areasOfWork ?? []);
  const [selSubs,  setSelSubs]      = useState<string[]>([]);
  const [empTypes, setEmpTypes]     = useState<Record<string, boolean>>(
    (user.employerType as Record<string, boolean> | undefined) ?? {}
  );
  // Personal details step state
  const [ageValue,        setAgeValue]        = useState(user.dob ?? '');
  const [genderValue,     setGenderValue]     = useState(user.gender ?? '');
  const [workLocations,   setWorkLocations]   = useState<string[]>(user.preferredWorkLocations ?? []);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [citySearchFocused, setCitySearchFocused] = useState(false);

  const slideAnim    = useRef(new Animated.Value(0)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const subSlideAnim = useRef(new Animated.Value(W)).current;

  // ── Subcategory picker panel ──────────────────────────────────────────────
  const [showSubcatPicker, setShowSubcatPicker] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);

  const openSubcatPicker = () => {
    subSlideAnim.setValue(W);
    setShowSubcatPicker(true);
    Animated.spring(subSlideAnim, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }).start();
  };

  const closeSubcatPicker = () => {
    Animated.timing(subSlideAnim, { toValue: W, duration: 220, useNativeDriver: true }).start(() =>
      setShowSubcatPicker(false)
    );
  };

  const step = steps[stepIdx];
  if (!step && wizardOpen) return null;
  const accent = step?.color ?? BRAND;

  const availableSubs = useMemo(
    () => ALL_CATS.filter(c => selCats.includes(c.value)).flatMap(c => c.subcategories),
    [selCats]
  );

  // Grouped subcategories: { catLabel, subs[] } for each selected category that has subcats
  const groupedSubs = useMemo(
    () => ALL_CATS
      .filter(c => selCats.includes(c.value) && c.subcategories.length > 0)
      .map(c => ({ catLabel: CAT_META[c.value]?.short ?? c.label, icon: CAT_META[c.value]?.icon ?? '💼', color: CAT_META[c.value]?.color ?? accent, subs: c.subcategories })),
    [selCats, accent]
  );

  // City autocomplete — flatten all districts + tehsils from indianStates
  const allCities = useMemo(() => {
    const cities = new Set<string>();
    Object.values(indianStates).forEach(districts => {
      Object.entries(districts).forEach(([district, tehsils]) => {
        cities.add(district);
        (tehsils as string[]).forEach(t => cities.add(t));
      });
    });
    return Array.from(cities).sort();
  }, []);

  const citySuggestions = useMemo(() => {
    const q = citySearchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return allCities
      .filter(c => c.toLowerCase().includes(q) && !workLocations.includes(c))
      .slice(0, 8);
  }, [citySearchQuery, allCities, workLocations]);

  const addWorkLocation = (city: string) => {
    if (city && !workLocations.includes(city)) {
      setWorkLocations(prev => [...prev, city]);
    }
    setCitySearchQuery('');
    setCitySearchFocused(false);
  };

  const removeWorkLocation = (city: string) => {
    setWorkLocations(prev => prev.filter(c => c !== city));
  };

  const toggleCat = useCallback((v: string) => {
    setSelCats(prev => {
      if (prev.includes(v)) {
        const subVals = new Set(ALL_CATS.find(c => c.value === v)?.subcategories.map(s => s.value) ?? []);
        setSelSubs(ss => ss.filter(x => !subVals.has(x)));
        return prev.filter(c => c !== v);
      }
      return [...prev, v];
    });
  }, []);

  const canContinue = (): boolean => {
    if (!step) return false;
    switch (step.id) {
      case 'location':        return !!locState;
      case 'agentType':       return !!agentType;
      case 'workerSubType':   return !!workerSub;
      case 'categories':      return selCats.length > 0;
      case 'employerType':    return Object.values(empTypes).some(Boolean);
      case 'personalDetails': return !!ageValue && !!genderValue && workLocations.length > 0;
      default:                return false;
    }
  };

  const slide = (forward: boolean, then: () => void) => {
    const OUT = forward ? -W * 0.9 : W * 0.9;
    const IN  = forward ?  W * 0.9 : -W * 0.9;
    Animated.timing(slideAnim, { toValue: OUT, duration: 240, useNativeDriver: true }).start(() => {
      slideAnim.setValue(IN);
      then();
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }).start();
    });
  };

  const buildPayload = (): Parameters<typeof updateProfileFields>[0] => {
    if (!step) return {};
    switch (step.id) {
      case 'location':        return { state: locState, district: locDist, block: locBlock };
      case 'agentType':       return { agentType };
      case 'workerSubType':   return { workerSubType: workerSub };
      case 'categories':      return { areasOfWork: selCats };
      case 'employerType':    return { employerType: empTypes };
      case 'personalDetails': return { dob: ageValue, gender: genderValue, preferredWorkLocations: workLocations };
      default:                return {};
    }
  };

  const advanceStep = () => {
    if (stepIdx < steps.length - 1) {
      slide(true, () => setStepIdx(p => p + 1));
    } else {
      slide(true, () => { setWizardOpen(false); setDone(true); });
    }
  };

  const handleNext = async () => {
    if (!step) return;

    // Categories: save areasOfWork first via direct fetch, then open subcategory picker
    if (step.id === 'categories') {
      setSaving(true);
      try {
        await saveAreasOfWork(selCats);
        await patchSession({ areasOfWork: selCats });
      } catch (err) {
        setSaving(false);
        showAlert('Save Error', err instanceof Error ? err.message : 'Could not save categories. Please try again.');
        return;
      }
      setSaving(false);

      const subs = ALL_CATS.filter(c => selCats.includes(c.value)).flatMap(c => c.subcategories);
      if (subs.length > 0) {
        openSubcatPicker();
      } else {
        advanceStep();
      }
      return;
    }

    setSaving(true);
    try {
      await updateProfileFields(buildPayload());
      await patchSession({
        state:        step.id === 'location'        ? locState    : user.state,
        district:     step.id === 'location'        ? locDist     : user.district,
        block:        step.id === 'location'        ? locBlock    : user.block,
        agentType:    step.id === 'agentType'       ? agentType   : user.agentType,
        workerSubType:step.id === 'workerSubType'   ? workerSub   : user.workerSubType,
        employerType: step.id === 'employerType'    ? (empTypes as UserProfile['employerType']) : user.employerType,
        dob:          step.id === 'personalDetails' ? ageValue    : user.dob,
        gender:       step.id === 'personalDetails' ? genderValue : user.gender,
        preferredWorkLocations: step.id === 'personalDetails' ? workLocations : user.preferredWorkLocations,
      });
    } catch (err) {
      setSaving(false);
      showAlert('Save Error', err instanceof Error ? err.message : 'Could not save. Please try again.');
      return;
    }
    setSaving(false);
    advanceStep();
  };

  const handleSubcatSave = async () => {
    setSaving(true);
    try {
      if (selSubs.length > 0) {
        await saveCategories(selSubs);
      }
    } catch (err) {
      setSaving(false);
      showAlert('Save Error', err instanceof Error ? err.message : 'Could not save skills. Please try again.');
      return;
    }
    setSaving(false);
    closeSubcatPicker();
    advanceStep();
  };

  const handleBack = () => { if (stepIdx > 0) slide(false, () => setStepIdx(p => p - 1)); };

  // Skip a step without saving — on last step, close wizard and show nudge
  const handleSkipStep = () => {
    if (stepIdx < steps.length - 1) {
      slide(true, () => setStepIdx(p => p + 1));
    } else {
      setWizardOpen(false);
      setShowNudge(true);
    }
  };

  // Close entire wizard without completing — show nudge so user can come back
  const handleDismiss = () => {
    setWizardOpen(false);
    setShowNudge(true);
  };

  // Reopen wizard from nudge
  const handleReopenWizard = () => {
    setStepIdx(0);
    setShowNudge(false);
    setWizardOpen(true);
  };

  if (steps.length === 0) return null;

  // ── Completion ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={cs.root}>
          <StatusBar barStyle="light-content" />
          {/* Decorative circles */}
          <View style={[cs.deco1, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={[cs.deco2, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
          <View style={cs.card}>
            <View style={cs.emojiWrap}>
              <Text style={cs.emoji}>🎉</Text>
            </View>
            <Text style={cs.title}>{t('wizard_doneTitle')}</Text>
            <Text style={cs.sub}>{t('wizard_doneSub')}</Text>
            <TouchableOpacity onPress={() => { setDone(false); setShowNudge(false); }} style={cs.btn} activeOpacity={0.85}>
              <Text style={cs.btnTxt}>{t('wizard_goDashboard')} →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Nudge banner ────────────────────────────────────────────────────────────
  if (showNudge) {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        <View style={nu.container} pointerEvents="auto">
          <View style={[nu.stripe, { backgroundColor: BRAND }]} />
          <View style={nu.body}>
            <Text style={nu.emoji}>📋</Text>
            <View style={nu.textWrap}>
              <Text style={nu.title}>{t('wizard_completeProfile')}</Text>
              <Text style={nu.sub}>{t('wizard_completeSub')}</Text>
            </View>
            <TouchableOpacity onPress={handleReopenWizard} style={[nu.btn, { backgroundColor: BRAND }]} activeOpacity={0.85}>
              <Text style={nu.btnTxt}>{t('wizard_completeBtn')} →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowNudge(false)} style={nu.closeBtn} activeOpacity={0.7}>
              <Text style={nu.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Step ────────────────────────────────────────────────────────────────────
  if (!wizardOpen) return null;

  const progress = (stepIdx + 1) / steps.length;
  const isLast   = stepIdx === steps.length - 1;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.root, { opacity: fadeAnim }]}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={[s.header, { backgroundColor: BRAND }]}>
          {/* Decorative shapes */}
          <View style={s.decoCircle1} />
          <View style={s.decoCircle2} />

          {/* Nav row */}
          <View style={[s.navRow, { paddingTop: Platform.OS === 'ios' ? 54 : 36 }]}>
            <TouchableOpacity
              onPress={stepIdx > 0 ? handleBack : handleDismiss}
              style={s.navIconBtn}
              activeOpacity={0.7}
            >
              <Text style={s.navIconTxt}>{stepIdx > 0 ? '←' : '✕'}</Text>
            </TouchableOpacity>

            {/* Step dots */}
            <View style={s.dotsRow}>
              {steps.map((_, i) => (
                <View key={i} style={[
                  s.dot,
                  i < stepIdx  && s.dotPast,
                  i === stepIdx && s.dotActive,
                  i > stepIdx  && s.dotFuture,
                ]} />
              ))}
            </View>

            <TouchableOpacity onPress={handleSkipStep} style={s.skipBtn} activeOpacity={0.7}>
              <Text style={s.skipTxt}>{t('wizard_skip')}</Text>
            </TouchableOpacity>
          </View>

          {/* Icon + title */}
          <View style={s.headerContent}>
            <View style={[s.stepIconBadge, { backgroundColor: accent + '28' }]}>
              <Text style={s.stepIconTxt}>{step.icon}</Text>
            </View>
            <Text style={s.headerTitle}>{t(step.titleKey)}</Text>
            <Text style={s.headerSubtitle}>{t(step.subtitleKey)}</Text>
          </View>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View
              style={[s.progressFill, { width: `${progress * 100}%` as `${number}%` }]}
            />
          </View>
          <Text style={s.stepLabel}>{stepIdx + 1} / {steps.length}</Text>
        </View>

        {/* ── Content card ───────────────────────────────────────────── */}
        <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[s.card, { transform: [{ translateX: slideAnim }] }]}>
            <ScrollView
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Location */}
              {step.id === 'location' && (
                <LocationSelector
                  state={locState} district={locDist} block={locBlock}
                  onStateChange={v => { setLocState(v); setLocDist(''); setLocBlock(''); }}
                  onDistrictChange={v => { setLocDist(v); setLocBlock(''); }}
                  onBlockChange={setLocBlock}
                />
              )}

              {/* Agent type */}
              {step.id === 'agentType' && (
                <View style={s.optList}>
                  {AGENT_TYPES.map(opt => (
                    <OptionCard
                      key={opt.value}
                      icon={opt.icon} label={opt.label} desc={opt.desc}
                      color={opt.color}
                      selected={agentType === opt.value}
                      onPress={() => setAgentType(opt.value)}
                    />
                  ))}
                </View>
              )}

              {/* Worker sub-type */}
              {step.id === 'workerSubType' && (
                <View style={s.optList}>
                  {WORKER_SUB_TYPES.map(opt => (
                    <OptionCard
                      key={opt.value}
                      icon={opt.icon} label={opt.label} desc={opt.desc}
                      color={opt.color}
                      selected={workerSub === opt.value}
                      onPress={() => setWorkerSub(opt.value)}
                    />
                  ))}
                </View>
              )}

              {/* Categories — 3-per-row grid */}
              {step.id === 'categories' && (
                <View>
                  {/* Count badge row */}
                  <View style={s.catLabelRow}>
                    <Text style={s.sectionLabel}>{t('wizard_selectAll').toUpperCase()}</Text>
                    {selCats.length > 0 && (
                      <View style={[s.selBadge, { backgroundColor: accent + '18' }]}>
                        <Text style={[s.selBadgeTxt, { color: accent }]}>
                          {selCats.length} {t('selected')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* 3-per-row chip grid */}
                  <View style={s.chipGrid}>
                    {ALL_CATS.map(c => {
                      const meta = CAT_META[c.value];
                      return (
                        <CatChip
                          key={c.value}
                          catKey={c.value}
                          label={(CAT_KEY_MAP[c.value] ? t(CAT_KEY_MAP[c.value]) : (meta?.short ?? c.label)).replace('\n', ' ')}
                          icon={meta?.icon ?? '💼'}
                          color={meta?.color ?? accent}
                          selected={selCats.includes(c.value)}
                          onPress={() => toggleCat(c.value)}
                        />
                      );
                    })}
                  </View>

                  {/* Hint: subcategories will open in next step */}
                  {selCats.length > 0 && availableSubs.length > 0 && (
                    <Text style={[s.subHint, { color: accent + 'BB' }]}>
                      ✦ After saving, you can choose specific skills →
                    </Text>
                  )}
                </View>
              )}

              {/* Employer type */}
              {step.id === 'employerType' && (
                <View style={s.optList}>
                  {EMPLOYER_TYPE_LIST.map(opt => (
                    <OptionCard
                      key={opt.key}
                      icon={opt.icon} label={opt.label} desc={opt.desc}
                      color={opt.color}
                      selected={!!empTypes[opt.key]}
                      onPress={() => setEmpTypes(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                    />
                  ))}
                </View>
              )}

              {/* Personal Details — age + gender + preferred work locations */}
              {step.id === 'personalDetails' && (
                <View style={{ gap: 22 }}>

                  {/* Age */}
                  <View>
                    <Text style={pd.label}>{t('ageLabel').toUpperCase()} *</Text>
                    <TextInput
                      value={ageValue}
                      onChangeText={setAgeValue}
                      placeholder={t('agePlaceholder')}
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      maxLength={3}
                      style={[pd.input, { borderColor: ageValue ? accent : '#E2E8F0' }]}
                    />
                  </View>

                  {/* Gender */}
                  <View>
                    <Text style={pd.label}>{t('genderLabel').toUpperCase()} *</Text>
                    <View style={pd.genderRow}>
                      {[
                        { value: 'Male',   labelKey: 'genderMale',   icon: '👨' },
                        { value: 'Female', labelKey: 'genderFemale', icon: '👩' },
                        { value: 'Other',  labelKey: 'genderOther',  icon: '🧑' },
                      ].map(g => {
                        const active = genderValue === g.value;
                        return (
                          <TouchableOpacity
                            key={g.value}
                            onPress={() => setGenderValue(g.value)}
                            activeOpacity={0.75}
                            style={[
                              pd.genderChip,
                              active
                                ? { backgroundColor: accent + '14', borderColor: accent, borderWidth: 2 }
                                : { backgroundColor: '#F8FAFF', borderColor: '#E2E8F0', borderWidth: 1.5 },
                            ]}
                          >
                            <Text style={pd.genderIcon}>{g.icon}</Text>
                            <Text style={[pd.genderLabel, { color: active ? accent : '#374151' }]}>
                              {t(g.labelKey)}
                            </Text>
                            {active && (
                              <View style={[pd.checkDot, { backgroundColor: accent }]}>
                                <Text style={pd.checkTxt}>✓</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Preferred work locations */}
                  <View>
                    <Text style={pd.label}>{t('workLocationsLabel').toUpperCase()} *</Text>
                    <Text style={pd.hint}>{t('workLocAddHint')}</Text>

                    {/* Search input */}
                    <View style={{ position: 'relative', zIndex: 10 }}>
                      <TextInput
                        value={citySearchQuery}
                        onChangeText={v => { setCitySearchQuery(v); setCitySearchFocused(true); }}
                        onFocus={() => setCitySearchFocused(true)}
                        onBlur={() => setTimeout(() => setCitySearchFocused(false), 200)}
                        placeholder={t('workLocSearchPlaceholder')}
                        placeholderTextColor="#94A3B8"
                        style={[pd.input, {
                          borderColor: citySearchFocused ? accent : '#E2E8F0',
                          marginBottom: 0,
                        }]}
                        returnKeyType="search"
                        onSubmitEditing={() => {
                          if (citySearchQuery.trim()) addWorkLocation(citySearchQuery.trim());
                        }}
                      />

                      {/* Suggestions dropdown */}
                      {citySearchFocused && citySuggestions.length > 0 && (
                        <View style={pd.suggBox}>
                          {citySuggestions.map(city => (
                            <TouchableOpacity
                              key={city}
                              onPress={() => addWorkLocation(city)}
                              activeOpacity={0.7}
                              style={pd.suggRow}
                            >
                              <Text style={pd.suggPin}>📍</Text>
                              <Text style={pd.suggTxt}>{city}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Selected city chips */}
                    {workLocations.length > 0 && (
                      <View style={pd.chipWrap}>
                        {workLocations.map(city => (
                          <View key={city} style={[pd.chip, { borderColor: accent + '55', backgroundColor: accent + '0D' }]}>
                            <Text style={[pd.chipTxt, { color: accent }]}>📍 {city}</Text>
                            <TouchableOpacity onPress={() => removeWorkLocation(city)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Text style={[pd.chipClose, { color: accent }]}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={s.footer}>
              <TouchableOpacity
                onPress={() => { void handleNext(); }}
                disabled={!canContinue() || saving}
                activeOpacity={0.88}
                style={[
                  s.ctaBtn,
                  canContinue() && !saving
                    ? { backgroundColor: BRAND, shadowColor: BRAND, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 }
                    : { backgroundColor: '#CBD5E1' },
                ]}
              >
                <Text style={[s.ctaTxt, !canContinue() && { color: '#94A3B8' }]}>
                  {saving ? '…' : isLast ? `${t('wizard_completeBtn')} ✓` : `${t('continueBtn')}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSkipStep} style={s.skipStepBtn} activeOpacity={0.6}>
                <Text style={s.skipStepTxt}>{t('wizard_skipStep')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* ── Subcategory Picker Panel (slides in from right) ──────────── */}
      {showSubcatPicker && (
        <Animated.View style={[sp.root, { transform: [{ translateX: subSlideAnim }] }]}>
          {/* Header */}
          <View style={[sp.header, { paddingTop: Platform.OS === 'ios' ? 54 : 36 }]}>
            <View style={sp.navRow}>
              <TouchableOpacity onPress={closeSubcatPicker} style={sp.backBtn} activeOpacity={0.7}>
                <Text style={sp.backTxt}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { closeSubcatPicker(); advanceStep(); }} style={sp.skipBtn} activeOpacity={0.7}>
                <Text style={sp.skipTxt}>Skip</Text>
              </TouchableOpacity>
            </View>
            <View style={sp.titleRow}>
              <Text style={sp.icon}>🎯</Text>
              <Text style={sp.title}>{t('wizard_specificSkillsOpt')}</Text>
            </View>
            <Text style={sp.subtitle}>Choose specific skills within your selected categories (optional)</Text>
          </View>

          {/* Body */}
          <ScrollView
            style={{ flex: 1, backgroundColor: '#fff' }}
            contentContainerStyle={sp.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {groupedSubs.map(group => (
              <View key={group.catLabel} style={sp.group}>
                {/* Group header */}
                <View style={sp.groupHeader}>
                  <View style={[sp.groupIconBadge, { backgroundColor: group.color + '18' }]}>
                    <Text style={sp.groupIcon}>{group.icon}</Text>
                  </View>
                  <Text style={[sp.groupLabel, { color: group.color }]}>{group.catLabel}</Text>
                </View>

                {/* Sub-chips */}
                <View style={sp.subChipGrid}>
                  {group.subs.map(sub => {
                    const sel = selSubs.includes(sub.value);
                    return (
                      <TouchableOpacity
                        key={sub.value}
                        onPress={() => setSelSubs(prev => sel ? prev.filter(x => x !== sub.value) : [...prev, sub.value])}
                        activeOpacity={0.75}
                        style={[
                          sp.subChip,
                          sel
                            ? { backgroundColor: group.color + '16', borderColor: group.color, borderWidth: 1.5 }
                            : { backgroundColor: '#F4F6FF', borderColor: '#DDE4F2', borderWidth: 1 },
                        ]}
                      >
                        {sel && (
                          <View style={[sp.checkDot, { backgroundColor: group.color }]}>
                            <Text style={sp.checkTxt}>✓</Text>
                          </View>
                        )}
                        <Text style={[sp.subChipTxt, { color: sel ? group.color : '#374151', fontWeight: sel ? '700' : '500' }]}>
                          {getSubCatLabel(sub.value, i18n.language)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Footer */}
          <View style={sp.footer}>
            {selSubs.length > 0 && (
              <View style={[sp.countPill, { backgroundColor: BRAND + '14' }]}>
                <Text style={[sp.countTxt, { color: BRAND }]}>{selSubs.length} specific skill{selSubs.length !== 1 ? 's' : ''} selected</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => { void handleSubcatSave(); }}
              disabled={saving}
              activeOpacity={0.88}
              style={[sp.saveBtn, { backgroundColor: saving ? '#CBD5E1' : BRAND }]}
            >
              <Text style={sp.saveTxt}>{saving ? '…' : selSubs.length > 0 ? `Save Skills & Continue ✓` : `Skip & Continue →`}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(3,7,18,0.75)' },

  // Header
  header: {
    paddingHorizontal: 22,
    paddingBottom: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  decoCircle1: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -100, right: -80,
  },
  decoCircle2: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: -60, left: -40,
  },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  navIconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  navIconTxt: { fontSize: 16, color: '#fff', fontWeight: '800', lineHeight: 20 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:     { height: 6, borderRadius: 3 },
  dotPast: { width: 6,  backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive:{ width: 24, backgroundColor: '#fff', borderRadius: 4 },
  dotFuture:{ width: 6,  backgroundColor: 'rgba(255,255,255,0.2)' },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipTxt: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  headerContent: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 8 },
  stepIconBadge: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
  },
  stepIconTxt: { fontSize: 36 },
  headerTitle: {
    fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center',
    lineHeight: 31, letterSpacing: -0.4, marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 13.5, color: 'rgba(255,255,255,0.72)', textAlign: 'center',
    lineHeight: 20, paddingHorizontal: 8,
  },

  progressTrack: {
    height: 3.5, backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 2, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  stepLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontWeight: '600', letterSpacing: 0.3 },

  // Card
  kav:  { flex: 1 },
  card: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 12,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },

  optList: { gap: 10 },

  // Categories
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 0 },
  selCount:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  chipGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catLabelRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  selBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  selBadgeTxt:  { fontSize: 11, fontWeight: '700' },
  subDivider:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 16 },
  subDividerLine: { flex: 1, height: 1 },
  subDividerPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  subDividerTxt:  { fontSize: 11, fontWeight: '700' },
  subCheckDot:  { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 4, flexShrink: 0 },
  subCheckTxt:  { fontSize: 9, color: '#fff', fontWeight: '900', lineHeight: 12 },
  subHint:      { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
  optionalTag:  { fontSize: 10, fontWeight: '600', color: '#94A3B8' },

  subChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subChip:     {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 24,
    shadowColor: '#1037A4', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  subChipTxt:  { fontSize: 12.5, lineHeight: 17 },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    paddingTop: 14,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F4FA',
    gap: 2,
  },
  ctaBtn: {
    width: '100%', height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
  } as object,
  ctaTxt: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  skipStepBtn: { alignItems: 'center', paddingVertical: 12 },
  skipStepTxt: { fontSize: 13, color: '#94A3B8', fontWeight: '600', textDecorationLine: 'underline' },
});

// ─── Completion styles ────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  root: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, padding: 28, overflow: 'hidden',
  },
  deco1: { position: 'absolute', width: 360, height: 360, borderRadius: 180, top: -140, right: -120 },
  deco2: { position: 'absolute', width: 240, height: 240, borderRadius: 120, bottom: -80, left: -60 },
  card:  {
    backgroundColor: '#fff', borderRadius: 32, padding: 36,
    alignItems: 'center', gap: 14, width: '100%', maxWidth: 360,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.2, shadowRadius: 40, elevation: 16,
  },
  emojiWrap: {
    width: 96, height: 96, borderRadius: 28, backgroundColor: '#FFF7ED',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emoji: { fontSize: 52 },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A', textAlign: 'center', letterSpacing: -0.4 },
  sub:   { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, paddingHorizontal: 4 },
  btn:   {
    marginTop: 8, width: '100%', height: 56, borderRadius: 16,
    backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center',
    shadowColor: BRAND, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnTxt: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
});

// ── Nudge banner styles ───────────────────────────────────────────────────────
const nu = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 88,               // above tab bar
    left: 16, right: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#1037A4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 14,
  },
  stripe: { width: 5, alignSelf: 'stretch' },
  body: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14, gap: 10,
  },
  emoji: { fontSize: 22, lineHeight: 26, flexShrink: 0 },
  textWrap: { flex: 1, gap: 2 },
  title: { fontSize: 13.5, fontWeight: '800', color: '#0F172A', lineHeight: 18 },
  sub:   { fontSize: 11.5, color: '#64748B', lineHeight: 16 },
  btn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, flexShrink: 0,
  },
  btnTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14, flexShrink: 0,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 12, color: '#64748B', fontWeight: '700', lineHeight: 16 },
});

// ── Subcategory picker panel styles ──────────────────────────────────────────
const sp = StyleSheet.create({
  root: {
    position: 'absolute', inset: 0,
    flex: 1, backgroundColor: '#F8FAFF',
  },
  header: {
    backgroundColor: BRAND,
    paddingHorizontal: 22,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 18,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10,
  },
  backTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  skipBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  skipTxt: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  icon:     { fontSize: 26 },
  title:    { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19 },

  body: { paddingHorizontal: 16, paddingTop: 20, gap: 22 },

  group: { gap: 12 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupIconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  groupIcon:  { fontSize: 20 },
  groupLabel: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },

  subChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#1037A4', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  checkDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkTxt: { fontSize: 9, color: '#fff', fontWeight: '900', lineHeight: 12 },
  subChipTxt: { fontSize: 12.5, lineHeight: 17 },

  footer: {
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0F4FA',
    gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 10,
  },
  countPill: {
    alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 999,
  },
  countTxt: { fontSize: 12, fontWeight: '700' },
  saveBtn: {
    width: '100%', height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: BRAND, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  saveTxt: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.1 },
});

// ── Personal Details step styles ──────────────────────────────────────────────
const pd = StyleSheet.create({
  label: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: '#94A3B8',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12, color: '#94A3B8', marginBottom: 10, lineHeight: 17,
  },
  input: {
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontWeight: '500', color: '#0F172A',
    backgroundColor: '#F8FAFF',
    marginBottom: 4,
  },
  genderRow: {
    flexDirection: 'row', gap: 10, flexWrap: 'wrap',
  },
  genderChip: {
    flex: 1, minWidth: '28%',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8,
    alignItems: 'center', gap: 5, position: 'relative',
  },
  genderIcon:  { fontSize: 22 },
  genderLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
  checkDot: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  checkTxt: { fontSize: 9, color: '#fff', fontWeight: '900', lineHeight: 12 },

  suggBox: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
    backgroundColor: '#fff', borderRadius: 12, marginTop: 4,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#1037A4', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
    overflow: 'hidden',
  },
  suggRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F4FA',
  },
  suggPin: { fontSize: 13 },
  suggTxt: { fontSize: 13.5, color: '#0F172A', fontWeight: '500', flex: 1 },

  chipWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  chipTxt:   { fontSize: 13, fontWeight: '700' },
  chipClose: { fontSize: 18, lineHeight: 20, fontWeight: '700', marginTop: -1 },
});
