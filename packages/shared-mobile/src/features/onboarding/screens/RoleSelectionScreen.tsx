import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useAuth } from '../../../state/auth/AuthContext';
import type { AppRole } from '../../../shared/types/domain';
import { ROUTES } from '../../../shared/constants/routes';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import type { OnboardingStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'RoleSelection'>;

interface RoleOption {
  value: AppRole;
  icon: string;
  title: string;
  tagline: string;
  description: string;
  color: string;
  colorLight: string;
  features: string[];
}

const ROLES: RoleOption[] = [
  {
    value: 'employer',
    icon: '👔',
    title: 'Employer',
    tagline: 'Hire Workers & Manage Teams',
    description: 'Post job requirements, browse verified workers, and manage your workforce.',
    color: '#7C3AED',
    colorLight: '#F3EFFE',
    features: ['Post requirements', 'Browse 5L+ workers', 'Track & pay'],
  },
  {
    value: 'agent',
    icon: '🤝',
    title: 'Agent',
    tagline: 'Connect Workers to Employers',
    description: 'Manage your worker network, fulfill employer requirements, and earn commissions.',
    color: '#0891B2',
    colorLight: '#ECFEFF',
    features: ['Manage worker pool', 'Fulfill requirements', 'Track payouts'],
  },
  {
    value: 'worker',
    icon: '🛠️',
    title: 'Worker',
    tagline: 'Find Jobs & Earn',
    description: 'Browse opportunities near you, apply to jobs, and receive digital payments.',
    color: '#059669',
    colorLight: '#ECFDF5',
    features: ['Browse local jobs', 'Track attendance', 'Digital payouts'],
  },
];

const RoleCard = ({
  role,
  selected,
  onSelect,
  index,
}: {
  role: RoleOption;
  selected: boolean;
  onSelect: (v: AppRole) => void;
  index: number;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const isDark = theme.mode === 'dark';

  const handlePressIn = (): void => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = (): void => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 6 }).start();
  };

  return (
    <Pressable
      onPress={() => onSelect(role.value)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ marginBottom: 12 }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Animated.View
        style={[
          styles.roleCard,
          {
            backgroundColor: selected
              ? (isDark ? role.color + '25' : role.colorLight)
              : (isDark ? theme.colors.surface1 : theme.colors.card),
            borderColor: selected ? role.color : (isDark ? theme.colors.border : '#E2E8F4'),
            borderWidth: selected ? 2 : 1,
            transform: [{ scale }],
          },
          !isDark && {
            shadowColor: selected ? role.color : '#8896B0',
            shadowOffset: { width: 0, height: selected ? 6 : 2 },
            shadowOpacity: selected ? 0.16 : 0.06,
            shadowRadius: selected ? 16 : 8,
            elevation: selected ? 5 : 2,
          },
        ]}
      >
        {/* Left: icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: role.color + (isDark ? '30' : '18') }]}>
          <AppText style={styles.roleIcon}>{role.icon}</AppText>
        </View>

        {/* Center: text */}
        <View style={styles.roleInfo}>
          <View style={styles.roleTitleRow}>
            <AppText variant="subtitle" color={selected ? role.color : theme.colors.text} style={styles.roleTitle}>
              {role.title}
            </AppText>
            {/* Feature pills */}
            <View style={[styles.indexBadge, { backgroundColor: role.color + '18' }]}>
              <AppText style={[styles.indexNum, { color: role.color }]}>{`${index + 1}`}</AppText>
            </View>
          </View>
          <AppText variant="caption" color={selected ? role.color : theme.colors.primary} style={styles.roleTagline}>
            {role.tagline}
          </AppText>
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.roleDesc} numberOfLines={2}>
            {role.description}
          </AppText>
          {/* Feature list */}
          <View style={styles.featRow}>
            {role.features.map((f) => (
              <View key={f} style={[styles.featChip, { backgroundColor: role.color + '14', borderColor: role.color + '30' }]}>
                <AppText style={[styles.featText, { color: role.color }]}>✓ {f}</AppText>
              </View>
            ))}
          </View>
        </View>

        {/* Right: radio */}
        <View style={[styles.radio, { borderColor: selected ? role.color : theme.colors.border }]}>
          {selected && <View style={[styles.radioDot, { backgroundColor: role.color }]} />}
        </View>
      </Animated.View>
    </Pressable>
  );
};

export const RoleSelectionScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { updateRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(false);

  const continueSetup = async (): Promise<void> => {
    if (!selectedRole) return;
    setLoading(true);
    try {
      await updateRole(selectedRole);
      navigation.navigate(ROUTES.ONBOARDING.KYC);
    } finally {
      setLoading(false);
    }
  };

  const selectedOption = ROLES.find((r) => r.value === selectedRole);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />

      {/* Header strip */}
      <View style={styles.headerStrip}>
        <SafeAreaView>
          <View style={[styles.headerContent, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 14 : 14 }]}>
            <AppText variant="display" color="#FFFFFF" style={styles.headerTitle}>
              I am a…
            </AppText>
            <AppText variant="body" color="rgba(255,255,255,0.72)">
              Choose your role to get a personalized experience
            </AppText>
          </View>
        </SafeAreaView>
        <View style={[styles.deco, styles.deco1]} />
        <View style={[styles.deco, styles.deco2]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.rolesContainer}>
          {ROLES.map((role, i) => (
            <RoleCard
              key={role.value}
              role={role}
              selected={selectedRole === role.value}
              onSelect={setSelectedRole}
              index={i}
            />
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaArea}>
          <AppButton
            title={
              selectedOption
                ? `Continue as ${selectedOption.title} →`
                : 'Select a role to continue'
            }
            onPress={continueSetup}
            loading={loading}
            disabled={!selectedRole}
            size="lg"
            fullWidth
          />
          <AppText variant="caption" color={theme.colors.mutedText} center style={styles.note}>
            You can always switch roles later from your profile settings.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerStrip: {
    backgroundColor: '#1338B0',
    paddingHorizontal: 24,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  headerContent: { gap: 6, paddingBottom: 4 },
  headerTitle: { fontSize: 32, color: '#FFFFFF', lineHeight: 38, marginBottom: 2 },
  deco: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  deco1: { width: 200, height: 200, top: -90, right: -60 },
  deco2: { width: 120, height: 120, bottom: -30, left: '40%' },

  scroll: { padding: 20, paddingBottom: 40 },
  rolesContainer: { gap: 0, marginTop: -10 },

  roleCard: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  roleIcon: { fontSize: 26, lineHeight: 32 },
  roleInfo: { flex: 1, gap: 4 },
  roleTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleTitle: { fontSize: 17, lineHeight: 22 },
  indexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexNum: { fontSize: 11, fontWeight: '800' },
  roleTagline: { fontWeight: '700', fontSize: 11, letterSpacing: 0.2 },
  roleDesc: { lineHeight: 17, marginTop: 1 },
  featRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  featChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featText: { fontSize: 10, fontWeight: '700' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  ctaArea: { gap: 12, marginTop: 8 },
  note: { lineHeight: 18 },
});
