import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import categoriesData from '../../../shared/data/categories.json';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../state/auth/AuthContext';
import { updateProfile, updateProfileFields } from '../../../core/api/endpoints/authApi';
import { apiClient } from '../../../core/api/client';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { LocationSelector } from '../../../shared/components/forms/LocationSelector';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { useAppTheme } from '../../../core/theme';
import { indianStates } from '../../../shared/data/stateDistrict';
import { ageString } from '../../../shared/utils/ageUtils';
import { WORKER_QUALIFICATION_TIERS as WORKER_SUB_TYPES } from '../../../shared/data/workerQualificationTiers';
import type { MainStackParamList } from '../../../app/navigation/types';

// Build a flat lookup: category/subcategory value → display label
const _AREA_LABEL_MAP: Record<string, string> = {};
(categoriesData as Array<{ label: string; value: string; subcategories: Array<{ label: string; value: string }> }>).forEach((cat) => {
  _AREA_LABEL_MAP[cat.value] = cat.label;
  cat.subcategories.forEach((sub) => { _AREA_LABEL_MAP[sub.value] = sub.label; });
});

function formatAreaLabel(val: string): string {
  if (_AREA_LABEL_MAP[val]) return _AREA_LABEL_MAP[val];
  // Fallback: replace underscores with spaces for any unknown raw values
  if (val.includes('_')) return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return val;
}

type Props = NativeStackScreenProps<MainStackParamList, 'EditProfile'>;

// ── All India districts flattened for serviceable area search ─────────────────
const ALL_DISTRICTS: { label: string; state: string }[] = [];
Object.entries(indianStates).forEach(([stateName, districts]) => {
  Object.keys(districts).forEach((district) => {
    ALL_DISTRICTS.push({ label: district, state: stateName });
  });
});

const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

// Selection caps for work preferences — a worker may pick at most
// MAX_CATEGORIES work categories and MAX_SUBCATEGORIES skills (sub-categories).
// Mirrors the limit pattern used in WorkerProfileCompletionScreen so the
// warning toasts reuse the already-translated wpc_* keys (all 11 languages).
const MAX_CATEGORIES = 2;
const MAX_SUBCATEGORIES = 7;

// WORKER_SUB_TYPES is imported from the shared WORKER_QUALIFICATION_TIERS source of
// truth (localized via labelKey in all 11 languages) so it stays in sync with the
// registration + onboarding flows.
const AGENT_TYPES = [
  { value: 'Group worker supplier',     labelKey: 'agentTypeGroupSupplier',     icon: '👥' },
  { value: 'Skilled worker supplier',   labelKey: 'agentTypeSkilledSupplier',   icon: '🔧' },
  { value: 'Unskilled worker supplier', labelKey: 'agentTypeUnskilledSupplier', icon: '🏗️' },
  { value: 'Contract worker supplier',  labelKey: 'agentTypeContractSupplier',  icon: '📋' },
];

// Category data with multilingual labels (mirrors WorkerProfileCompletionScreen).
// categories.json ships a label field for all 11 languages; index it dynamically
// so every language resolves (previously only hi/mr/gu were handled, leaving the
// other 8 languages showing English).
interface CatRaw {
  label: string; value: string;
  subcategories: Array<{ label: string; value: string; [field: string]: string | undefined }>;
  [field: string]: unknown;
}
const ALL_CATS = categoriesData as unknown as CatRaw[];
// Active i18n language → categories.json label field. Region suffixes (e.g.
// 'hi-IN') are stripped before lookup so the device locale still resolves.
const CAT_LANG_FIELD: Record<string, string> = {
  hi: 'hindilabel', mr: 'marathilabel', gu: 'gujaratilabel', ta: 'tamillabel',
  te: 'telugulabel', kn: 'kannadalabel', ml: 'malayalamlabel', bn: 'banglalabel',
  or: 'odialabel', pa: 'punjabilabel',
};
const catLabelField = (lang: string): string | undefined =>
  CAT_LANG_FIELD[(lang || 'en').toLowerCase().split(/[-_]/)[0]];
function getCatLabel(cat: CatRaw, lang: string): string {
  const f = catLabelField(lang);
  return (f && (cat[f] as string)) || cat.label;
}
function getSubLabel(sub: CatRaw['subcategories'][0], lang: string): string {
  const f = catLabelField(lang);
  return (f && (sub[f] as string)) || sub.label;
}

const editProfileSchema = z.object({
  name:            z.string().min(3, 'Name must be at least 3 characters'),
  alternate:       z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit number').optional().or(z.literal('')),
  email:           z.string().email('Enter a valid email').optional().or(z.literal('')),
  address:         z.string().optional(),
  accountNumber:   z.string().optional(),
  ifscCode:        z.string().optional(),
  bankName:        z.string().optional(),
  oldPassword:     z.string().optional(),
  newPassword:     z.string().min(6, 'Min 6 characters').optional().or(z.literal('')),
  confirmPassword: z.string().optional(),
}).refine((d) => {
  if (d.newPassword && d.newPassword !== d.confirmPassword) return false;
  return true;
}, { message: 'Passwords do not match', path: ['confirmPassword'] });

type EditProfileValues = z.infer<typeof editProfileSchema>;

export const EditProfileScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { state, updateProfile: updateAuthProfile } = useAuth();
  const toast = useToast();
  const user = state.session?.user;
  const isDark = theme.mode === 'dark';

  const isWorkerRole = ['selfworker', 'worker', 'agent'].includes((user?.role ?? '').toLowerCase());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [stateVal, setStateVal] = useState(user?.state ?? '');
  const [districtVal, setDistrictVal] = useState(user?.district ?? '');
  const [blockVal, setBlockVal] = useState('');

  // Worker-specific fields
  const [gender, setGender] = useState<string>(user?.gender ?? '');
  // dob is stored as a birth year — show the derived current age in the field.
  const [age, setAge] = useState<string>(ageString(user?.dob));
  const [experience, setExperience] = useState<string>('');
  // Serviceable areas = districts where the worker WANTS to work → `serviceArea`
  // (the "Work categories" below map to areasOfWork; sub-skills to categories).
  const [areas, setAreas] = useState<string[]>(user?.serviceArea ?? []);
  const [areaSearch, setAreaSearch] = useState('');

  // Role type (agentType for agents, workerSubType for workers/selfworkers)
  const roleLower = (user?.role ?? '').toLowerCase();
  const isAgent = roleLower === 'agent';
  const ROLE_TYPE_OPTIONS = isAgent ? AGENT_TYPES : WORKER_SUB_TYPES;
  const [roleType, setRoleType] = useState<string>(
    (isAgent ? user?.agentType : user?.workerSubType) ?? '',
  );

  // Work categories + skills (sub-categories)
  const [selectedCats, setSelectedCats] = useState<string[]>(() => {
    if (!user?.categories?.length) return [];
    const parents: string[] = [];
    for (const cat of ALL_CATS) {
      if (cat.subcategories.some((s) => user.categories!.includes(s.value))) parents.push(cat.value);
    }
    return parents;
  });
  const [selectedSubs, setSelectedSubs] = useState<string[]>(user?.categories ?? []);
  const [subSearch, setSubSearch] = useState('');

  const { control, handleSubmit, reset } = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: user?.fullName ?? '',
      alternate: '',
      email: user?.email ?? '',
      address: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Fetch full profile on mount
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const res = await apiClient.get<{
          user?: {
            fullName?: string; email?: string; state?: string; district?: string;
            block?: string; address?: string; accountNumber?: string;
            ifscCode?: string; bankName?: string; alternate?: string;
            gender?: string; dob?: string | number; areasOfWork?: string[];
            serviceArea?: string[];
            workExperience?: string | number; categories?: string[];
            agentType?: string; workerSubType?: string;
          };
        }>('/api/v1/user/getuser');
        const u = res.data?.user;
        if (!u) return;
        reset({
          name: u.fullName ?? user?.fullName ?? '',
          alternate: u.alternate ?? '',
          email: u.email ?? user?.email ?? '',
          address: u.address ?? '',
          accountNumber: u.accountNumber ?? '',
          ifscCode: u.ifscCode ?? '',
          bankName: u.bankName ?? '',
          oldPassword: '', newPassword: '', confirmPassword: '',
        });
        if (u.state)       setStateVal(u.state);
        if (u.district)    setDistrictVal(u.district);
        if (u.block)       setBlockVal(u.block);
        if (u.gender)      setGender(u.gender);
        if (u.dob)         setAge(ageString(u.dob));
        if (u.serviceArea) setAreas(u.serviceArea);
        if (u.workExperience != null && u.workExperience !== '') setExperience(String(u.workExperience));
        if (isAgent ? u.agentType : u.workerSubType) setRoleType((isAgent ? u.agentType : u.workerSubType) ?? '');
        if (u.categories?.length) {
          setSelectedSubs(u.categories);
          const parents: string[] = [];
          for (const cat of ALL_CATS) {
            if (cat.subcategories.some((s) => u.categories!.includes(s.value))) parents.push(cat.value);
          }
          setSelectedCats(parents);
        }
      } catch { /* keep defaults */ }
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredDistricts = useMemo(() => {
    if (!areaSearch.trim()) return [];
    const q = areaSearch.toLowerCase();
    return ALL_DISTRICTS.filter(
      (d) => d.label.toLowerCase().includes(q) || d.state.toLowerCase().includes(q)
    ).slice(0, 25);
  }, [areaSearch]);

  const toggleArea = useCallback((district: string) => {
    setAreas((prev) =>
      prev.includes(district) ? prev.filter((a) => a !== district) : [...prev, district]
    );
  }, []);

  // All sub-categories available from the currently selected parent categories
  const allAvailableSubs = useMemo(
    () => ALL_CATS.filter((c) => selectedCats.includes(c.value)).flatMap((c) => c.subcategories),
    [selectedCats],
  );
  const filteredSubs = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    if (!q) return allAvailableSubs;
    return allAvailableSubs.filter(
      (s) => s.label.toLowerCase().includes(q) || (s.hindilabel ?? '').toLowerCase().includes(q),
    );
  }, [allAvailableSubs, subSearch]);

  const toggleCat = useCallback((val: string) => {
    // Cap additions at MAX_CATEGORIES; removing an already-selected one is always fine.
    if (!selectedCats.includes(val) && selectedCats.length >= MAX_CATEGORIES) {
      toast.warning(t('wpc_workCatLimit', { count: MAX_CATEGORIES }), t('wpc_limitTitle'));
      return;
    }
    setSelectedCats((prev) => {
      const next = prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val];
      // Drop any selected sub-categories that belong to a now-deselected category
      if (!next.includes(val)) {
        const removed = ALL_CATS.find((c) => c.value === val);
        if (removed) {
          const removedSubs = removed.subcategories.map((s) => s.value);
          setSelectedSubs((prevSubs) => prevSubs.filter((s) => !removedSubs.includes(s)));
        }
      }
      return next;
    });
  }, [selectedCats, toast, t]);
  const toggleSub = useCallback((val: string) => {
    // Cap additions at MAX_SUBCATEGORIES; removing an already-selected one is always fine.
    if (!selectedSubs.includes(val) && selectedSubs.length >= MAX_SUBCATEGORIES) {
      toast.warning(t('wpc_subCatLimit', { count: MAX_SUBCATEGORIES }), t('wpc_limitTitle'));
      return;
    }
    setSelectedSubs((prev) => (prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]));
  }, [selectedSubs, toast, t]);

  const pickPhoto = async (): Promise<void> => {
    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setImageError(false);
      }
    } catch {
      toast.error(t('employer:pf_photoLibraryError'));
    } finally {
      setPhotoLoading(false);
    }
  };

  const takePhoto = async (): Promise<void> => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError(t('ep_cameraPermission')); return; }
    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) { setPhotoUri(result.assets[0].uri); setImageError(false); }
    } finally { setPhotoLoading(false); }
  };

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      // Main profile update (FormData for photo support)
      const formData = new FormData();
      formData.append('name', values.name);
      // Always send alternate so the user can also clear it ("" clears on the backend).
      formData.append('alternate', values.alternate ?? '');
      if (values.email)         formData.append('email', values.email);
      if (stateVal)             formData.append('state', stateVal);
      if (districtVal)          formData.append('district', districtVal);
      if (blockVal)             formData.append('block', blockVal);
      if (values.address)       formData.append('address', values.address);
      if (values.accountNumber) formData.append('accountNumber', values.accountNumber);
      if (values.ifscCode)      formData.append('ifscCode', values.ifscCode);
      if (values.bankName)      formData.append('bankName', values.bankName);
      if (values.oldPassword && values.newPassword) {
        formData.append('oldPassword', values.oldPassword);
        formData.append('newPassword', values.newPassword);
        // Backend `updateUser` requires all three fields and rejects with
        // "Fill all password fields" otherwise. The form's zod refine already
        // guarantees confirmPassword === newPassword at submit time.
        formData.append('confirmPassword', values.confirmPassword ?? values.newPassword);
      }
      if (photoUri) {
        const filename = photoUri.split('/').pop() ?? 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        formData.append('profilePhoto', { uri: photoUri, name: filename, type: match ? `image/${match[1]}` : 'image/jpeg' } as unknown as Blob);
      }
      const updatedUser = await updateProfile(formData);

      // Worker-specific fields via JSON endpoint
      if (isWorkerRole) {
        const workerUpdates: Record<string, unknown> = {};
        if (gender) workerUpdates.gender = gender;
        if (age && Number(age) >= 15 && Number(age) <= 70) workerUpdates.dob = Number(age);
        if (experience !== '' && Number(experience) >= 0 && Number(experience) <= 60) workerUpdates.workExperience = Number(experience);
        if (selectedCats.length > 0) workerUpdates.areasOfWork = selectedCats;
        if (selectedSubs.length > 0) workerUpdates.categories = selectedSubs;
        if (areas.length > 0) workerUpdates.serviceArea = areas;
        if (roleType) workerUpdates[isAgent ? 'agentType' : 'workerSubType'] = roleType;
        if (Object.keys(workerUpdates).length > 0) {
          await updateProfileFields(workerUpdates);
        }
      }

      await updateAuthProfile({
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        state: updatedUser.state,
        district: updatedUser.district,
        profileImage: updatedUser.profileImage,
        ...(isWorkerRole && gender ? { gender } : {}),
        ...(isWorkerRole && age ? { dob: String(age) } : {}),
        ...(isWorkerRole && selectedCats.length > 0 ? { areasOfWork: selectedCats } : {}),
        ...(isWorkerRole && selectedSubs.length > 0 ? { categories: selectedSubs } : {}),
        ...(isWorkerRole && areas.length > 0 ? { serviceArea: areas } : {}),
        ...(isWorkerRole && roleType ? (isAgent ? { agentType: roleType } : { workerSubType: roleType }) : {}),
      });
      toast.success(t('ep_profileSavedMsg'), t('ep_profileSaved'));
      navigation.goBack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('employer:pf_updateProfileFailed');
      setError(msg);
      toast.error(msg, t('ep_updateFailed'));
    } finally {
      setLoading(false);
    }
  });

  const currentPhotoUri = photoUri ?? user?.profileImage;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('editProfileTitle')} onBack={() => navigation.goBack()} />
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.88} style={styles.avatarTouchable}>
            {currentPhotoUri && !imageError ? (
              <Image source={{ uri: currentPhotoUri }} style={styles.avatar} onError={() => setImageError(true)} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary + '40' }]}>
                <Avatar name={user?.fullName ?? 'User'} size={72} />
              </View>
            )}
            <View style={[styles.avatarEditBadge, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
            {photoLoading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.photoButtons}>
            <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} style={[styles.photoBtn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
              <Ionicons name="images-outline" size={17} color="#fff" style={styles.photoBtnIcon} />
              <AppText style={styles.photoBtnTxt} color="#fff">{t('ep_galleryBtn')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} activeOpacity={0.85} style={[styles.photoBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Ionicons name="camera-outline" size={18} color={theme.colors.text} style={styles.photoBtnIcon} />
              <AppText style={styles.photoBtnTxt} color={theme.colors.text}>{t('ep_cameraBtn')}</AppText>
            </TouchableOpacity>
          </View>
          <View style={styles.cropTipBanner}>
            <Ionicons name="crop-outline" size={16} color="#2243BC" />
            <AppText style={[styles.cropTipText, { flexShrink: 1 }]}>{t('ep_cropTip')}</AppText>
          </View>
        </View>

        {/* Read-only mobile (verified) */}
        <View style={[styles.readOnlyRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <AppText style={[styles.mobileLabel, { color: theme.colors.mutedText }]}>{t('ep_mobileNumber')}</AppText>
          <AppText style={[styles.mobileValue, { color: theme.colors.text }]}>+91 {user?.phone}</AppText>
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#137A38" />
            <AppText style={styles.verifiedTxt}>{t('ep_verified', 'Verified')}</AppText>
          </View>
        </View>

        {/* Editable alternate / secondary contact number */}
        <FormInput control={control} name="alternate" label={t('ep_alternateNumber')} placeholder={t('tenDigitMobile')} keyboardType="phone-pad" maxLength={10} />

        {/* BASIC INFO */}
        <SectionLabel label={t('ep_basicInfo')} theme={theme} />
        <FormInput control={control} name="name" label={t('ep_fullName')} placeholder={t('ep_fullNamePlaceholder')} />
        <FormInput control={control} name="email" label={t('ep_emailAddress')} placeholder={t('ep_emailPlaceholder')} keyboardType="email-address" />
        <FormInput control={control} name="address" label={t('ep_address')} placeholder={t('ep_addressPlaceholder')} />

        {/* LOCATION */}
        <SectionLabel label={t('ep_location')} theme={theme} />
        <LocationSelector
          state={stateVal} district={districtVal} block={blockVal}
          onStateChange={(v) => { setStateVal(v); setDistrictVal(''); setBlockVal(''); }}
          onDistrictChange={(v) => { setDistrictVal(v); setBlockVal(''); }}
          onBlockChange={setBlockVal}
          required={false} blockLabel={t('employer:pf_blockTehsil')}
        />

        {/* ── WORK PREFERENCES (SelfWorker / Worker only) ── */}
        {isWorkerRole && (
          <>
            <SectionLabel label={t('ep_workPrefs')} theme={theme} />

            {/* Gender */}
            <AppText style={[styles.fieldLabel, { color: theme.colors.mutedText }]}>
              {t('ep_gender')}
            </AppText>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGender(g)}
                  activeOpacity={0.75}
                  style={[
                    styles.genderChip,
                    gender === g
                      ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                      : { backgroundColor: isDark ? theme.colors.surface1 : '#F1F5F9', borderColor: isDark ? theme.colors.border : '#DDE3F0' },
                  ]}
                >
                  <AppText style={[styles.genderChipText, { color: gender === g ? '#fff' : theme.colors.text }]}>
                    {t(`gender_${g.toLowerCase()}`, g)}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Age */}
            <AppText style={[styles.fieldLabel, { color: theme.colors.mutedText, marginTop: 14 }]}>
              {t('ep_age')}
            </AppText>
            <TextInput
              style={[
                styles.ageInput,
                {
                  backgroundColor: isDark ? theme.colors.surface : '#fff',
                  borderColor: age ? theme.colors.primary : (isDark ? theme.colors.border : '#DDE3F0'),
                  color: theme.colors.text,
                },
              ]}
              value={age}
              onChangeText={(v) => { if (/^\d{0,2}$/.test(v)) setAge(v); }}
              keyboardType="number-pad"
              maxLength={2}
              placeholder={t('wpc_agePlaceholder', 'e.g. 25')}
              placeholderTextColor={theme.colors.mutedText}
            />

            {/* Work Experience */}
            <AppText style={[styles.fieldLabel, { color: theme.colors.mutedText, marginTop: 14 }]}>
              {t('wpc_experienceQ')}
            </AppText>
            <TextInput
              style={[
                styles.ageInput,
                {
                  backgroundColor: isDark ? theme.colors.surface : '#fff',
                  borderColor: experience ? theme.colors.primary : (isDark ? theme.colors.border : '#DDE3F0'),
                  color: theme.colors.text,
                },
              ]}
              value={experience}
              onChangeText={(v) => { if (/^\d{0,2}$/.test(v)) setExperience(v); }}
              keyboardType="number-pad"
              maxLength={2}
              placeholder={t('wpc_experiencePlaceholder', 'e.g. 5')}
              placeholderTextColor={theme.colors.mutedText}
            />

            {/* Role type — agentType (agent) / workerSubType (worker) */}
            <AppText style={[styles.fieldLabel, { color: theme.colors.mutedText, marginTop: 14 }]}>
              {isAgent ? t('wpc_subTypeAgentQ') : t('wpc_subTypeQ')}
            </AppText>
            <View style={styles.genderRow}>
              {ROLE_TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setRoleType(opt.value)}
                  activeOpacity={0.75}
                  style={[
                    styles.genderChip,
                    roleType === opt.value
                      ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                      : { backgroundColor: isDark ? theme.colors.surface1 : '#F1F5F9', borderColor: isDark ? theme.colors.border : '#DDE3F0' },
                  ]}
                >
                  <AppText style={[styles.genderChipText, { color: roleType === opt.value ? '#fff' : theme.colors.text }]}>
                    {opt.icon} {t(opt.labelKey)}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Work categories */}
            <AppText style={[styles.fieldLabel, { color: theme.colors.mutedText, marginTop: 14 }]}>
              {t('wpc_workCatQ')} — {selectedCats.length}/{MAX_CATEGORIES} {t('wpc_selected', 'Selected')}
            </AppText>
            <View style={styles.genderRow}>
              {ALL_CATS.map((cat) => {
                const sel = selectedCats.includes(cat.value);
                return (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => toggleCat(cat.value)}
                    activeOpacity={0.75}
                    style={[
                      styles.genderChip,
                      sel
                        ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                        : { backgroundColor: isDark ? theme.colors.surface1 : '#F1F5F9', borderColor: isDark ? theme.colors.border : '#DDE3F0' },
                    ]}
                  >
                    <AppText style={[styles.genderChipText, { color: sel ? '#fff' : theme.colors.text }]}>
                      {getCatLabel(cat, lang)}{sel ? ' ✓' : ''}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Skills (sub-categories) — only when at least one category is selected */}
            {selectedCats.length > 0 && (
              <>
                <AppText style={[styles.fieldLabel, { color: theme.colors.mutedText, marginTop: 14 }]}>
                  {t('wpc_subCatQ')}
                </AppText>
                <View style={[styles.searchBox, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderColor: isDark ? theme.colors.border : '#DDE3F0' }]}>
                  <Ionicons name="search" size={16} color={theme.colors.mutedText} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    value={subSearch}
                    onChangeText={setSubSearch}
                    placeholder={t('wpc_subCatSearch', 'Search e.g. Mason, Driver, Cook…')}
                    placeholderTextColor={theme.colors.mutedText}
                    autoCorrect={false}
                  />
                  {subSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setSubSearch('')}>
                      <Ionicons name="close-circle" size={18} color={theme.colors.mutedText} />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                  {filteredSubs.map((sub) => {
                    const sel = selectedSubs.includes(sub.value);
                    return (
                      <TouchableOpacity
                        key={sub.value}
                        onPress={() => toggleSub(sub.value)}
                        activeOpacity={0.75}
                        style={[
                          styles.genderChip,
                          { marginRight: 8, marginBottom: 8 },
                          sel
                            ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                            : { backgroundColor: isDark ? theme.colors.surface1 : '#F1F5F9', borderColor: isDark ? theme.colors.border : '#DDE3F0' },
                        ]}
                      >
                        <AppText style={[styles.genderChipText, { color: sel ? '#fff' : theme.colors.text }]}>
                          {getSubLabel(sub, lang)}{sel ? ' ✓' : ''}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {selectedSubs.length > 0 && (
                  <AppText style={[styles.fieldLabel, { color: theme.colors.mutedText, marginTop: 10 }]}>
                    {t('wpc_subCatSelected', 'Selected skills')} ({selectedSubs.length}/{MAX_SUBCATEGORIES})
                  </AppText>
                )}
              </>
            )}

            {/* Serviceable Areas */}
            <AppText style={[styles.fieldLabel, { color: theme.colors.mutedText, marginTop: 14 }]}>
              {t('ep_serviceableArea')}
            </AppText>

            {/* Search box */}
            <View style={[styles.searchBox, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderColor: isDark ? theme.colors.border : '#DDE3F0' }]}>
              <Ionicons name="search" size={16} color={theme.colors.mutedText} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                value={areaSearch}
                onChangeText={setAreaSearch}
                placeholder={t('wpc_searchPlaceholder', 'Search city or district…')}
                placeholderTextColor={theme.colors.mutedText}
                autoCorrect={false}
              />
              {areaSearch.length > 0 && (
                <TouchableOpacity onPress={() => setAreaSearch('')}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.mutedText} />
                </TouchableOpacity>
              )}
            </View>

            {/* Dropdown results */}
            {filteredDistricts.length > 0 && (
              <View style={[styles.dropdown, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderColor: isDark ? theme.colors.border : '#DDE3F0' }]}>
                {filteredDistricts.map((d) => {
                  const selected = areas.includes(d.label);
                  return (
                    <TouchableOpacity
                      key={`${d.state}-${d.label}`}
                      onPress={() => { toggleArea(d.label); setAreaSearch(''); }}
                      activeOpacity={0.7}
                      style={[
                        styles.dropdownItem,
                        selected && { backgroundColor: isDark ? theme.colors.primary + '22' : theme.colors.primaryLight },
                        { borderBottomColor: isDark ? theme.colors.border : '#F1F5F9' },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <AppText style={[{ fontSize: 13.5, fontWeight: '700' }, { color: selected ? theme.colors.primary : theme.colors.text }]}>
                          {d.label}
                        </AppText>
                        <AppText style={{ fontSize: 11.5, color: theme.colors.mutedText }}>{d.state}</AppText>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={19} color={theme.colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Selected area tags */}
            {areas.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <AppText style={[styles.fieldLabel, { color: theme.colors.mutedText }]}>
                  {t('wpc_selected', 'Selected')} ({areas.length})
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                  {areas.map((a) => (
                    <TouchableOpacity
                      key={a}
                      onPress={() => setAreas((prev) => prev.filter((x) => x !== a))}
                      style={[styles.areaTag, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '40' }]}
                      activeOpacity={0.7}
                    >
                      <AppText style={{ fontSize: 12.5, fontWeight: '600', color: theme.colors.primary, marginRight: 4, flexShrink: 1 }}>{formatAreaLabel(a)}</AppText>
                      <AppText style={{ fontSize: 15, fontWeight: '700', color: theme.colors.primary }}>×</AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* CHANGE PASSWORD */}
        <SectionLabel label={t('ep_changePassword')} theme={theme} />
        <AppCard style={styles.card}>
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.cardHint}>
            {t('ep_leaveBlankPassword')}
          </AppText>
          <FormInput control={control} name="oldPassword" label={t('ep_currentPassword')} placeholder={t('ep_currentPasswordPlaceholder')} secureTextEntry />
          <FormInput control={control} name="newPassword" label={t('ep_newPassword')} placeholder={t('ep_newPasswordPlaceholder')} secureTextEntry />
          <FormInput control={control} name="confirmPassword" label={t('ep_confirmPassword')} placeholder={t('ep_confirmPasswordPlaceholder')} secureTextEntry />
        </AppCard>

        {error ? (
          <AppText variant="caption" color={theme.colors.danger} style={styles.error}>{error}</AppText>
        ) : null}

        <AppButton title={t('ep_saveChanges')} onPress={onSubmit} loading={loading} style={styles.saveBtn} />
      </ScrollView>
    </View>
  );
};

const SectionLabel = ({ label, theme }: { label: string; theme: ReturnType<typeof useAppTheme>['theme'] }): React.JSX.Element => (
  <AppText variant="label" style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>{label}</AppText>
);

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 16, paddingBottom: 48 },

  avatarSection:     { alignItems: 'center', marginBottom: 22, marginTop: 8 },
  avatarTouchable:   { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholder: { width: 102, height: 102, borderRadius: 51, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatar:            { width: 102, height: 102, borderRadius: 51, borderWidth: 3, borderColor: '#2243BC' },
  avatarEditBadge:   { position: 'absolute', bottom: 3, right: 3, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#EEF1F8' },
  avatarEditIcon:    { fontSize: 15, color: '#FFFFFF' },
  avatarOverlay:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 51, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  photoButtons:      { flexDirection: 'row', gap: 10, marginTop: 16 },
  photoBtn:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, borderWidth: 1.6 },
  photoBtnIcon:      { fontSize: 15 },
  photoBtnTxt:       { fontSize: 14.5, fontWeight: '800' },
  cropTipBanner:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#EEF2FE', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 12, marginTop: 14, borderWidth: 1, borderColor: '#E1E8FD' },
  cropTipText:       { fontSize: 13, color: '#2243BC', fontWeight: '700' },

  readOnlyRow: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 22, gap: 4, position: 'relative', shadowColor: '#142250', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 12 },
  mobileLabel: { fontSize: 12, fontWeight: '700' },
  mobileValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  verifiedBadge: { position: 'absolute', right: 16, top: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E8F7EE', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  verifiedTxt: { fontSize: 11, fontWeight: '800', color: '#137A38' },
  sectionLabel:{ marginTop: 20, marginBottom: 14, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.1, fontWeight: '800' },
  card:        { marginBottom: 4 },
  cardHint:    { marginBottom: 12 },
  error:       { marginTop: 8 },
  saveBtn:     { marginTop: 20 },

  // Gender chips
  fieldLabel:    { fontSize: 13.5, fontWeight: '700', letterSpacing: 0, marginBottom: 9 },
  genderRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  genderChip:    { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  genderChipText:{ fontSize: 13.5, fontWeight: '600', flexShrink: 1 },

  // Age
  ageInput: { fontSize: 20, fontWeight: '800', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, textAlign: 'center' },

  // Serviceable area
  searchBox:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.6, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, gap: 8 },
  searchInput:  { flex: 1, fontSize: 14, fontWeight: '500', padding: 0 },
  dropdown:     { borderWidth: 1, borderRadius: 14, marginTop: 4, maxHeight: 200, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  areaTag:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginRight: 6, marginBottom: 6 },
});
