import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { WorkerDetail } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { buildPhotoUrl } from '../../../core/config/env';
import type { MainStackParamList } from '../../../app/navigation/types';
import { useToast } from '../../../shared/state/toast/ToastContext';

type Props = NativeStackScreenProps<MainStackParamList, 'WorkerProfile'>;


// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  navy:      '#0f172a',
  blue:      '#2563eb',
  blueSoft:  '#eff6ff',
  blueLight: '#dbeafe',
  indigo:    '#4f46e5',
  indigoSoft:'#eef2ff',
  green:     '#16a34a',
  greenSoft: '#f0fdf4',
  greenLight:'#bbf7d0',
  amber:     '#d97706',
  amberSoft: '#fffbeb',
  amberLight:'#fde68a',
  red:       '#dc2626',
  slate:     '#64748b',
  slateLight:'#f1f5f9',
  border:    '#e2e8f0',
  white:     '#ffffff',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatName = (name = ''): string =>
  name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const getAge = (dob?: string | number): string => {
  if (dob == null || dob === '') return '';
  const timestamp = Number(dob);
  if (isNaN(timestamp)) return '';
  if (String(dob).length <= 5) {
    if (timestamp > 1900 && timestamp <= new Date().getFullYear()) return String(new Date().getFullYear() - timestamp);
    return String(timestamp);
  }
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const birth = new Date(ms);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return String(age);
};

// Handles arrays, JSON-encoded string arrays, underscore_keys, and deduplication
const formatAreas = (raw: unknown): string[] => {
  let items: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const s = String(item ?? '').trim();
      if (!s) continue;
      if (s.startsWith('[')) {
        try { const p = JSON.parse(s); if (Array.isArray(p)) { items.push(...p.map(String)); continue; } } catch { /* ignore */ }
      }
      items.push(s);
    }
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try { const p = JSON.parse(trimmed); if (Array.isArray(p)) { items = p.map(String); } } catch { /* ignore */ }
    } else {
      items = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  const seen = new Set<string>();
  return items
    .map((a) => a.replace(/_/g, ' ').trim())
    .filter(Boolean)
    .map((a) => a.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '))
    .filter((v) => { if (seen.has(v)) return false; seen.add(v); return true; });
};

// ─── Stat tile ────────────────────────────────────────────────────────────────
const StatTile = ({ value, label, color, bg }: {
  value: string; label: string; color: string; bg: string;
}): React.JSX.Element => (
  <View style={[st.tile, { backgroundColor: bg }]}>
    <AppText style={[st.value, { color }]}>{value}</AppText>
    <AppText style={st.label}>{label}</AppText>
  </View>
);
const st = StyleSheet.create({
  tile:  { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 3 },
  value: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', color: C.slate, textAlign: 'center' },
});

// ─── Info row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: {
  icon: string; label: string; value?: string | number | null;
}): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  if (value == null || value === '' || value === 0) return null;
  return (
    <View style={[inf.row, { borderBottomColor: C.border }]}>
      <View style={inf.iconBox}><AppText style={{ fontSize: 14 }}>{icon}</AppText></View>
      <AppText style={[inf.label, { color: C.slate }]}>{label}</AppText>
      <AppText style={[inf.value, { color: theme.colors.text }]} numberOfLines={2}>{String(value)}</AppText>
    </View>
  );
};
const inf = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.slateLight, alignItems: 'center', justifyContent: 'center' },
  label:   { flex: 1, fontSize: 13, fontWeight: '500', color: C.slate },
  value:   { fontSize: 13, fontWeight: '700', textAlign: 'right', maxWidth: '55%' },
});

// ─── Card section ─────────────────────────────────────────────────────────────
const Section = ({ title, accent, children }: {
  title: string; accent: string; children: React.ReactNode;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[sec.card, { backgroundColor: theme.colors.card }]}>
      <View style={[sec.titleRow, { borderLeftColor: accent }]}>
        <AppText style={sec.title}>{title}</AppText>
      </View>
      {children}
    </View>
  );
};
const sec = StyleSheet.create({
  card:     { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  titleRow: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 14 },
  title:    { fontSize: 14, fontWeight: '800', color: C.navy, letterSpacing: 0.2 },
});

// ─── Loading skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton = (): React.JSX.Element => {
  const pulse = C.slateLight;
  return (
    <View style={{ flex: 1, backgroundColor: '#1037A4' }}>
      <View style={{ paddingTop: 16, height: 240, backgroundColor: '#1037A4', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24, gap: 10 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ width: 140, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ width: 100, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </View>
      <View style={{ backgroundColor: '#f8fafc', flex: 1, padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0,1,2,3].map((i) => <View key={i} style={{ flex: 1, height: 72, borderRadius: 14, backgroundColor: pulse }} />)}
        </View>
        <View style={{ height: 140, borderRadius: 16, backgroundColor: pulse }} />
        <View style={{ height: 200, borderRadius: 16, backgroundColor: pulse }} />
      </View>
    </View>
  );
};

// ─── Full user profile interface ──────────────────────────────────────────────
interface FullUserProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  employerType?: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export const WorkerProfileScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { workerId } = route.params;
  const { state: authState } = useAuth();
  const toast = useToast();
  const user = authState.session?.user;
  const isEmployer = user?.role === 'employer';
  const insets = useSafeAreaInsets();

  const [unlockedPhone, setUnlockedPhone] = useState<string | null>(null);
  const [unlocking,     setUnlocking]     = useState(false);

  // ── Worker data from new endpoint ────────────────────────────────────────
  const { data: worker, isLoading, isError, refetch } = useQuery<WorkerDetail>({
    queryKey: ['worker-detail-v2', workerId],
    queryFn: () => workerApi.getWorkerById(workerId),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // ── Employer subscription — always fresh, no stale cache ────────────────
  const { data: empProfile, isSuccess: empProfileLoaded } = useQuery<FullUserProfile | null>({
    queryKey: ['emp-profile-worker-detail'],
    queryFn: async () => {
      const { apiClient } = await import('../../../core/api/client');
      const res = await apiClient.get<{ user?: FullUserProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    enabled: isEmployer,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  const isSubscribed = (() => {
    if (!isEmployer) return false;
    if (!empProfileLoaded) return true; // optimistic: assume subscribed while loading
    if (!empProfile?.isSubscribed) return false;
    const exp = empProfile.subscriptionExpery;
    if (!exp) return true;
    return new Date(exp).getTime() > Date.now();
  })();

  const employerType = (() => {
    const l = String(empProfile?.employerType ?? '').toLowerCase();
    if (l.includes('industry'))   return 'industry' as const;
    if (l.includes('agency'))     return 'agency' as const;
    if (l.includes('contractor')) return 'contractor' as const;
    return 'individual' as const;
  })();

  const handleUnlock = async (): Promise<void> => {
    if (unlocking || unlockedPhone) return;
    setUnlocking(true);
    try {
      const res = await workerApi.unlockNumber(workerId);
      if (res.phone) {
        setUnlockedPhone(res.phone);
        toast.success('Contact number unlocked successfully.', 'Unlocked');
      } else {
        // Backend returned 200 but no phone (e.g. subscription required)
        const errMsg = res.message ?? 'Unable to unlock contact. Please check your subscription.';
        toast.error(errMsg, 'Unlock Failed');
        if (errMsg.toLowerCase().includes('subscribe')) {
          navigation.navigate('Subscription');
        }
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errObj?.response?.data?.message ?? errObj?.message;
      if (msg === 'Contact limit exhausted') {
        toast.warning('Contact limit reached. Upgrade your plan to unlock more.', 'Limit Reached');
        navigation.navigate('Subscription');
      } else {
        toast.error(msg ?? 'Failed to unlock contact. Please try again.', 'Unlock Failed');
      }
    } finally {
      setUnlocking(false);
    }
  };

  // ── Loading & error states ───────────────────────────────────────────────
  if (isLoading) return <LoadingSkeleton />;

  if (isError || !worker) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
        <ScreenHeader title="Worker Profile" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <AppText style={{ fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 8 }}>Profile Unavailable</AppText>
          <AppText style={{ fontSize: 13, color: C.slate, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
            Could not load this worker's profile. Please check your connection and try again.
          </AppText>
          <TouchableOpacity onPress={() => void refetch()} style={{ backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 }}>
            <AppText style={{ color: C.white, fontWeight: '800', fontSize: 14 }}>Retry</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Derived display data ─────────────────────────────────────────────────
  const photoUrl = buildPhotoUrl(worker.profilePhoto);

  const displayName = formatName(worker.name ?? 'Unknown');
  const initials    = displayName.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const isAgent     = String(worker.role ?? '').toLowerCase() === 'agent';
  const accentColor = isAgent ? C.indigo : C.blue;
  const isVerified  = worker.status === 'Verified' || worker.veryfiedBage === true;
  const age         = getAge(worker.dob);
  const areas       = formatAreas(worker.areasOfWork ?? []);
  const exp         = worker.workExperience != null ? Number(worker.workExperience) : null;
  const wage        = worker.fixedSalary ?? worker.salaryFrom;
  const wageDisplay = wage
    ? `₹${wage}${worker.salaryTo && worker.salaryTo !== wage ? `–${worker.salaryTo}` : ''}/day`
    : null;
  const bio = worker.bio ?? worker.about;
  const location = [worker.block, worker.district, worker.state].filter(Boolean).join(', ');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="Worker Profile" onBack={() => navigation.goBack()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={[s.hero, { paddingTop: 16, backgroundColor: '#1037A4' }]}>
          {/* Depth layer + circles — matches GradientHeader */}
          <View style={s.heroDepth} pointerEvents="none" />
          <View style={s.heroCircle1} pointerEvents="none" />
          <View style={s.heroCircle2} pointerEvents="none" />

          {/* Avatar */}
          <View style={s.avatarWrap}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={[s.avatar, { borderColor: accentColor }]} />
            ) : (
              <View style={[s.avatarFallback, { backgroundColor: accentColor }]}>
                <AppText style={s.initials}>{initials}</AppText>
              </View>
            )}
            {isVerified && (
              <View style={s.verifiedBadge}>
                <AppText style={{ color: C.white, fontSize: 11, fontWeight: '900' }}>✓</AppText>
              </View>
            )}
          </View>

          {/* Name + location */}
          <AppText style={s.heroName}>{displayName}</AppText>
          {areas.length > 0 && (
            <AppText style={s.heroCategory} numberOfLines={1}>
              {areas.slice(0, 2).join('  ·  ')}
            </AppText>
          )}
          {!!location && (
            <AppText style={s.heroLocation} numberOfLines={1}>{location}</AppText>
          )}

          {/* Status + role badges */}
          <View style={s.badgeRow}>
            {isAgent && (
              <View style={[s.badge, { backgroundColor: 'rgba(79,70,229,0.25)' }]}>
                <AppText style={[s.badgeTxt, { color: '#a5b4fc' }]}>AGENT</AppText>
              </View>
            )}
            <View style={[s.badge, {
              backgroundColor: isVerified ? 'rgba(22,163,74,0.25)' : 'rgba(217,119,6,0.25)',
            }]}>
              <AppText style={[s.badgeTxt, { color: isVerified ? '#4ade80' : '#fcd34d' }]}>
                {isVerified ? 'VERIFIED' : 'UNVERIFIED'}
              </AppText>
            </View>
            {!!worker.gender && (
              <View style={[s.badge, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <AppText style={[s.badgeTxt, { color: 'rgba(255,255,255,0.8)' }]}>{worker.gender.toUpperCase()}</AppText>
              </View>
            )}
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <View style={[s.body, { backgroundColor: theme.colors.background }]}>

          {/* Stats row */}
          <View style={s.statsRow}>
            <StatTile
              value={exp && exp > 0 ? `${exp}y` : 'New'}
              label="Experience"
              color={C.blue}
              bg={C.blueSoft}
            />
            <StatTile
              value={wageDisplay ?? '—'}
              label="Daily Rate"
              color={C.green}
              bg={C.greenSoft}
            />
            {!!age && (
              <StatTile
                value={`${age} yrs`}
                label="Age"
                color={C.amber}
                bg={C.amberSoft}
              />
            )}
            {(worker.rating ?? 0) > 0 && (
              <StatTile
                value={`${worker.rating}★`}
                label={`${worker.totalRatings ?? 0} ratings`}
                color={C.indigo}
                bg={C.indigoSoft}
              />
            )}
          </View>

          {/* Skills */}
          {areas.length > 0 && (
            <Section title="Areas of Work" accent={C.blue}>
              <View style={s.skillsGrid}>
                {areas.map((skill, i) => (
                  <View key={i} style={s.skillChip}>
                    <AppText style={s.skillTxt}>{skill}</AppText>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Profile details */}
          <Section title="Profile Details" accent={C.indigo}>
            <InfoRow icon="💼" label="Category / Role"  value={areas[0] ?? worker.role} />
            <InfoRow icon="📍" label="Location"          value={location || null} />
            <InfoRow icon="⏳" label="Experience"        value={exp && exp > 0 ? `${exp} years` : 'Fresher'} />
            <InfoRow icon="💰" label="Daily Rate"        value={wageDisplay} />
            <InfoRow icon="👤" label="Gender"            value={worker.gender} />
            <InfoRow icon="🎂" label="Age"               value={age ? `${age} years` : null} />
            <InfoRow icon="🔖" label="Worker Type"       value={isAgent ? 'Agent / Group' : 'Individual Worker'} />
            <InfoRow icon="📊" label="Status"            value={worker.status} />
            {!!bio && (
              <View style={s.bioWrap}>
                <AppText style={s.bioLabel}>About</AppText>
                <AppText style={[s.bioText, { color: theme.colors.text }]}>{bio}</AppText>
              </View>
            )}
          </Section>

          {/* Contact — employer only */}
          {isEmployer && (
            <Section title="Contact Worker" accent={C.green}>
              {unlockedPhone ? (
                // ─ Unlocked
                <View style={s.unlockedBox}>
                  <View style={s.phoneCard}>
                    <View style={s.phoneIconWrap}>
                      <AppText style={{ fontSize: 20 }}>📞</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={s.phoneLabel}>Phone Number</AppText>
                      <AppText style={s.phoneNum}>{unlockedPhone}</AppText>
                    </View>
                  </View>
                  <View style={s.contactBtns}>
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(`tel:${unlockedPhone}`)}
                      style={s.callBtn}
                      activeOpacity={0.85}
                    >
                      <AppText style={s.callBtnTxt}>Call Now</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(`https://wa.me/91${unlockedPhone}`)}
                      style={s.waBtn}
                      activeOpacity={0.85}
                    >
                      <AppText style={s.waBtnTxt}>WhatsApp</AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : isSubscribed ? (
                // ─ Subscribed, not yet unlocked
                <TouchableOpacity
                  onPress={() => void handleUnlock()}
                  disabled={unlocking}
                  style={[s.viewContactBtn, { opacity: unlocking ? 0.7 : 1 }]}
                  activeOpacity={0.85}
                >
                  {unlocking
                    ? <ActivityIndicator color={C.white} size="small" />
                    : <AppText style={s.viewContactTxt}>View Contact Number</AppText>
                  }
                </TouchableOpacity>
              ) : (
                // ─ Not subscribed / subscription expired
                <View style={s.lockBox}>
                  <View style={s.lockIconWrap}>
                    <AppText style={{ fontSize: 28 }}>🔒</AppText>
                  </View>
                  <AppText style={s.lockTitle}>No Active Subscription</AppText>
                  <AppText style={[s.lockSub, { color: C.slate }]}>
                    You don't have an active subscription. Subscribe to BookMyWorker to access worker contact details and hire directly.
                  </AppText>
                  <View style={s.lockBenefits}>
                    {['View & call worker contact numbers', 'Direct WhatsApp messaging', 'Unlimited access to interested agents'].map((b, i) => (
                      <View key={i} style={s.benefitRow}>
                        <View style={s.benefitDot} />
                        <AppText style={[s.benefitTxt, { color: C.slate }]}>{b}</AppText>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={s.subscribeBtn} activeOpacity={0.85}>
                    <AppText style={s.subscribeTxt}>View Subscription Plans</AppText>
                  </TouchableOpacity>
                </View>
              )}
            </Section>
          )}
        </View>
      </ScrollView>

    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Hero section
  hero:        { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 20, overflow: 'hidden', position: 'relative' },
  heroDepth:   { ...StyleSheet.absoluteFillObject, backgroundColor: '#0F2888', opacity: 0.45 },
  heroCircle1: { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -90, right: -70, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, bottom: -40, left: -60, backgroundColor: 'rgba(255,255,255,0.03)' },

  avatarWrap:     { position: 'relative', marginBottom: 14 },
  avatar:         { width: 96, height: 96, borderRadius: 48, borderWidth: 3 },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  initials:       { fontSize: 30, fontWeight: '800', color: '#ffffff' },
  verifiedBadge:  { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#1037A4' },

  heroName:     { fontSize: 24, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 4 },
  heroCategory: { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: 2 },
  heroLocation: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 10 },
  badgeRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badge:        { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  badgeTxt:     { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },

  // Body
  body:     { padding: 14, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },

  // Skills
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip:  { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  skillTxt:   { fontSize: 12, fontWeight: '600', color: '#2563eb' },

  // Bio
  bioWrap:  { paddingTop: 12 },
  bioLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  bioText:  { fontSize: 13, lineHeight: 20 },

  // Contact — unlocked
  unlockedBox:  { gap: 12 },
  phoneCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0', padding: 14 },
  phoneIconWrap:{ width: 46, height: 46, borderRadius: 12, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  phoneLabel:   { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 2 },
  phoneNum:     { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  contactBtns:  { flexDirection: 'row', gap: 10 },
  callBtn:      { flex: 1, backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  callBtnTxt:   { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  waBtn:        { flex: 1, backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  waBtnTxt:     { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  // Contact — subscribed not unlocked
  viewContactBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  viewContactTxt: { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  // Contact — not subscribed
  lockBox:       { alignItems: 'center', gap: 14 },
  lockIconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fffbeb', borderWidth: 1.5, borderColor: '#fde68a', alignItems: 'center', justifyContent: 'center' },
  lockTitle:     { fontSize: 17, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  lockSub:       { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  lockBenefits:  { width: '100%', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 14, gap: 8 },
  benefitRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb' },
  benefitTxt:    { fontSize: 12, fontWeight: '500', flex: 1 },
  subscribeBtn:  { width: '100%', backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  subscribeTxt:  { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
