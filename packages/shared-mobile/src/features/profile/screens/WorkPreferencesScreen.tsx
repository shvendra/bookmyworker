import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import categoriesData from '../../../shared/data/categories.json';
import { apiClient } from '../../../core/api/client';
import { updateProfileFields } from '../../../core/api/endpoints/authApi';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { indianStates } from '../../../shared/data/stateDistrict';
import { workerNeedsEducationDoc } from '../../../shared/utils/labelUtils';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'WorkPreferences'>;

// ── All India districts flattened for serviceable-area search ─────────────────
const ALL_DISTRICTS: { label: string; state: string }[] = [];
Object.entries(indianStates).forEach(([stateName, districts]) => {
  Object.keys(districts).forEach((district) => {
    ALL_DISTRICTS.push({ label: district, state: stateName });
  });
});

// ── Categories with multilingual labels (mirrors EditProfile/onboarding) ──────
interface CatRaw {
  label: string; value: string;
  subcategories: Array<{ label: string; value: string; [field: string]: string | undefined }>;
  [field: string]: unknown;
}
const ALL_CATS = categoriesData as unknown as CatRaw[];
const CAT_LANG_FIELD: Record<string, string> = {
  hi: 'hindilabel', mr: 'marathilabel', gu: 'gujaratilabel', ta: 'tamillabel',
  te: 'telugulabel', kn: 'kannadalabel', ml: 'malayalamlabel', bn: 'banglalabel',
  or: 'odialabel', pa: 'punjabilabel',
};
const catLabelField = (lang: string): string | undefined =>
  CAT_LANG_FIELD[(lang || 'en').toLowerCase().split(/[-_]/)[0]];
const getCatLabel = (cat: CatRaw, lang: string): string => {
  const f = catLabelField(lang);
  return (f && (cat[f] as string)) || cat.label;
};
const getSubLabel = (sub: CatRaw['subcategories'][0], lang: string): string => {
  const f = catLabelField(lang);
  return (f && (sub[f] as string)) || sub.label;
};

const _AREA_LABEL_MAP: Record<string, string> = {};
ALL_CATS.forEach((cat) => {
  _AREA_LABEL_MAP[cat.value] = cat.label;
  cat.subcategories.forEach((sub) => { _AREA_LABEL_MAP[sub.value] = sub.label; });
});
const formatAreaLabel = (val: string): string => {
  if (_AREA_LABEL_MAP[val]) return _AREA_LABEL_MAP[val];
  if (val.includes('_')) return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return val;
};

export const WorkPreferencesScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const toast = useToast();
  const { state, updateProfile: updateAuthProfile } = useAuth();
  const user = state.session?.user;

  // Resume option only for the worker tiers that need an education document
  // (10th/12th/ITI, Diploma/Graduate) — exact same gate as the old dashboard card.
  const showResume = workerNeedsEducationDoc(user);

  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [subSearch, setSubSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | undefined>(user?.resumeUrl);
  const [saving, setSaving] = useState(false);

  // The auth-context user is lightweight; fetch the full worker profile to seed
  // the current category / skills / work-areas / experience values.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient.get<{ user?: {
          categories?: string[]; areasOfWork?: string[]; serviceArea?: string[];
          workExperience?: string | number; resumeUrl?: string;
        } }>('/api/v1/user/getuser');
        const u = res.data?.user;
        if (!u || cancelled) return;
        if (Array.isArray(u.serviceArea)) setAreas(u.serviceArea);
        if (u.workExperience != null && u.workExperience !== '') setExperience(String(u.workExperience));
        if (Array.isArray(u.categories) && u.categories.length) {
          setSelectedSubs(u.categories);
          const parents: string[] = [];
          for (const cat of ALL_CATS) {
            if (cat.subcategories.some((s) => u.categories!.includes(s.value))) parents.push(cat.value);
          }
          setSelectedCats(parents);
        } else if (Array.isArray(u.areasOfWork) && u.areasOfWork.length) {
          setSelectedCats(u.areasOfWork.filter((v) => ALL_CATS.some((c) => c.value === v)));
        }
        if (u.resumeUrl) setResumeUrl(u.resumeUrl);
      } catch { /* non-fatal — start empty */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredDistricts = useMemo(() => {
    if (!areaSearch.trim()) return [];
    const q = areaSearch.toLowerCase();
    return ALL_DISTRICTS.filter(
      (d) => d.label.toLowerCase().includes(q) || d.state.toLowerCase().includes(q),
    ).slice(0, 25);
  }, [areaSearch]);

  const allAvailableSubs = useMemo(
    () => ALL_CATS.filter((c) => selectedCats.includes(c.value)).flatMap((c) => c.subcategories),
    [selectedCats],
  );
  const filteredSubs = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    if (!q) return allAvailableSubs;
    return allAvailableSubs.filter(
      (s) => s.label.toLowerCase().includes(q) || getSubLabel(s, lang).toLowerCase().includes(q),
    );
  }, [allAvailableSubs, subSearch, lang]);

  const toggleCat = useCallback((val: string) => {
    setSelectedCats((prev) => {
      const next = prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val];
      if (!next.includes(val)) {
        const removed = ALL_CATS.find((c) => c.value === val);
        if (removed) {
          const removedSubs = removed.subcategories.map((s) => s.value);
          setSelectedSubs((prevSubs) => prevSubs.filter((s) => !removedSubs.includes(s)));
        }
      }
      return next;
    });
  }, []);
  const toggleSub = useCallback((val: string) => {
    setSelectedSubs((prev) => (prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]));
  }, []);
  const toggleArea = useCallback((district: string) => {
    setAreas((prev) => (prev.includes(district) ? prev.filter((a) => a !== district) : [...prev, district]));
  }, []);

  const handlePickResume = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploadingResume(true);
      const url = await workerApi.uploadResume(asset.uri, asset.name ?? 'resume.pdf');
      setResumeUrl(url);
      await updateAuthProfile({ resumeUrl: url });
      showAlert(t('alertResumeUploadedTitle'), t('alertResumeUploadedMsg'));
    } catch {
      showAlert(t('alertUploadFailedTitle'), t('alertUploadFailedMsg'));
    } finally {
      setUploadingResume(false);
    }
  };
  const handleViewResume = (): void => {
    if (resumeUrl) navigation.navigate('PdfViewer', { url: resumeUrl, title: t('viewResume') });
  };

  const onSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (experience !== '' && Number(experience) >= 0 && Number(experience) <= 60) updates.workExperience = Number(experience);
      if (selectedCats.length > 0) updates.areasOfWork = selectedCats;
      if (selectedSubs.length > 0) updates.categories = selectedSubs;
      if (areas.length > 0) updates.serviceArea = areas;
      if (Object.keys(updates).length > 0) await updateProfileFields(updates);
      // Keep the in-memory auth profile in sync so other screens see the change.
      await updateAuthProfile({
        ...(selectedCats.length > 0 ? { areasOfWork: selectedCats } : {}),
        ...(selectedSubs.length > 0 ? { categories: selectedSubs } : {}),
        ...(areas.length > 0 ? { serviceArea: areas } : {}),
      });
      toast.success(t('ep_profileSavedMsg'), t('ep_profileSaved'));
      navigation.goBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('ep_updateFailed'), t('ep_updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const fieldLabelStyle = [styles.fieldLabel, { color: theme.colors.mutedText }];
  const chipSelected = { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary };
  const chipIdle = { backgroundColor: isDark ? theme.colors.surface1 : '#F1F5F9', borderColor: isDark ? theme.colors.border : '#DDE3F0' };
  const searchBoxStyle = [styles.searchBox, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderColor: isDark ? theme.colors.border : '#DDE3F0' }];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('wpref_title')} onBack={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppText style={[styles.subtitle, { color: theme.colors.mutedText }]}>{t('wpref_subtitle')}</AppText>

        {/* ── Resume (only for education-document worker tiers) ── */}
        {showResume && (
          <View style={[styles.resumeCard, { backgroundColor: isDark ? theme.colors.surface : '#FFFBEB', borderColor: '#FCD34D' }]}>
            <View style={styles.resumeTop}>
              <AppText style={{ fontSize: 22 }}>📄</AppText>
              <View style={{ flex: 1 }}>
                <AppText style={styles.resumeTitle}>{resumeUrl ? t('resumeUploaded') : t('uploadYourResume')}</AppText>
                <AppText style={styles.resumeSub}>
                  {resumeUrl ? t('resumeUploadedDesc') : t('resumeUploadDesc', { subType: user?.workerSubType ?? '' })}
                </AppText>
              </View>
            </View>
            <View style={styles.resumeActions}>
              <TouchableOpacity
                style={[styles.resumeBtn, { backgroundColor: '#d97706' }, uploadingResume && { opacity: 0.55 }]}
                onPress={() => void handlePickResume()}
                disabled={uploadingResume}
                activeOpacity={0.85}
              >
                <AppText style={styles.resumeBtnTxt}>
                  {uploadingResume ? t('uploading') : resumeUrl ? `🔄 ${t('replaceResume')}` : `⬆️ ${t('uploadResume')}`}
                </AppText>
              </TouchableOpacity>
              {resumeUrl ? (
                <TouchableOpacity style={styles.resumeViewBtn} onPress={handleViewResume} activeOpacity={0.85}>
                  <AppText style={styles.resumeViewTxt}>👁 {t('viewResume')}</AppText>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Work categories ── */}
        <AppText style={[fieldLabelStyle, { marginTop: 18 }]}>{t('wpc_workCatQ')}</AppText>
        <View style={styles.chipRow}>
          {ALL_CATS.map((cat) => {
            const sel = selectedCats.includes(cat.value);
            return (
              <TouchableOpacity key={cat.value} onPress={() => toggleCat(cat.value)} activeOpacity={0.75} style={[styles.chip, sel ? chipSelected : chipIdle]}>
                <AppText style={[styles.chipText, { color: sel ? '#fff' : theme.colors.text }]}>{getCatLabel(cat, lang)}{sel ? ' ✓' : ''}</AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Skills (sub-categories) ── */}
        {selectedCats.length > 0 && (
          <>
            <AppText style={[fieldLabelStyle, { marginTop: 16 }]}>{t('wpc_subCatQ')}</AppText>
            <View style={searchBoxStyle}>
              <AppText style={{ fontSize: 15 }}>🔍</AppText>
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
                  <AppText style={{ fontSize: 14, color: theme.colors.mutedText, fontWeight: '700' }}>✕</AppText>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.chipRow}>
              {filteredSubs.map((sub) => {
                const sel = selectedSubs.includes(sub.value);
                return (
                  <TouchableOpacity key={sub.value} onPress={() => toggleSub(sub.value)} activeOpacity={0.75} style={[styles.chip, sel ? chipSelected : chipIdle]}>
                    <AppText style={[styles.chipText, { color: sel ? '#fff' : theme.colors.text }]}>{getSubLabel(sub, lang)}{sel ? ' ✓' : ''}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedSubs.length > 0 && (
              <AppText style={[fieldLabelStyle, { marginTop: 8 }]}>{t('wpc_subCatSelected', 'Selected skills')} ({selectedSubs.length})</AppText>
            )}
          </>
        )}

        {/* ── Work areas / current work city (serviceArea) ── */}
        <AppText style={[fieldLabelStyle, { marginTop: 18 }]}>{t('ep_serviceableArea')}</AppText>
        <View style={searchBoxStyle}>
          <AppText style={{ fontSize: 15 }}>🔍</AppText>
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
              <AppText style={{ fontSize: 14, color: theme.colors.mutedText, fontWeight: '700' }}>✕</AppText>
            </TouchableOpacity>
          )}
        </View>
        {filteredDistricts.length > 0 && (
          <View style={[styles.dropdown, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderColor: isDark ? theme.colors.border : '#DDE3F0' }]}>
            {filteredDistricts.map((d) => {
              const selected = areas.includes(d.label);
              return (
                <TouchableOpacity
                  key={`${d.state}-${d.label}`}
                  onPress={() => { toggleArea(d.label); setAreaSearch(''); }}
                  activeOpacity={0.7}
                  style={[styles.dropdownItem, selected && { backgroundColor: isDark ? theme.colors.primary + '22' : theme.colors.primaryLight }, { borderBottomColor: isDark ? theme.colors.border : '#F1F5F9' }]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText style={[{ fontSize: 13.5, fontWeight: '700' }, { color: selected ? theme.colors.primary : theme.colors.text }]}>{d.label}</AppText>
                    <AppText style={{ fontSize: 11.5, color: theme.colors.mutedText }}>{d.state}</AppText>
                  </View>
                  {selected && <AppText style={{ fontSize: 17, color: theme.colors.primary, fontWeight: '800' }}>✓</AppText>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {areas.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <AppText style={fieldLabelStyle}>{t('wpc_selected', 'Selected')} ({areas.length})</AppText>
            <View style={styles.chipRow}>
              {areas.map((a) => (
                <TouchableOpacity key={a} onPress={() => setAreas((prev) => prev.filter((x) => x !== a))} style={[styles.areaTag, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '40' }]} activeOpacity={0.7}>
                  <AppText style={{ fontSize: 12.5, fontWeight: '600', color: theme.colors.primary, marginRight: 4, flexShrink: 1 }}>{formatAreaLabel(a)}</AppText>
                  <AppText style={{ fontSize: 15, fontWeight: '700', color: theme.colors.primary }}>×</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Experience ── */}
        <AppText style={[fieldLabelStyle, { marginTop: 18 }]}>{t('wpref_experienceLabel')}</AppText>
        <TextInput
          style={[styles.expInput, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderColor: experience ? theme.colors.primary : (isDark ? theme.colors.border : '#DDE3F0'), color: theme.colors.text }]}
          value={experience}
          onChangeText={(v) => { if (/^\d{0,2}$/.test(v)) setExperience(v); }}
          keyboardType="number-pad"
          maxLength={2}
          placeholder={t('wpc_experiencePlaceholder', 'e.g. 5')}
          placeholderTextColor={theme.colors.mutedText}
        />

        <AppButton title={saving ? t('uploading') : t('wpref_save')} onPress={() => void onSave()} disabled={saving} style={{ marginTop: 24 }} />
        {saving && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 12 }} />}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  subtitle: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  dropdown: { borderWidth: 1.5, borderRadius: 12, marginTop: 8, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  areaTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  expInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '700' },
  resumeCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12, marginTop: 8 },
  resumeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  resumeTitle: { fontSize: 14, fontWeight: '800', color: '#92400e', lineHeight: 18 },
  resumeSub: { fontSize: 12, color: '#a16207', lineHeight: 16, marginTop: 2 },
  resumeActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  resumeBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resumeBtnTxt: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  resumeViewBtn: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#d97706' },
  resumeViewTxt: { fontSize: 13, fontWeight: '700', color: '#d97706' },
});
