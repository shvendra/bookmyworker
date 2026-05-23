import React, { useState } from 'react';
import { Linking, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';

type Tab = 'terms' | 'privacy';

const TERMS = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By accessing and using BookMyWorkers, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.',
  },
  {
    heading: '2. Platform Use',
    body: 'BookMyWorkers is a platform connecting employers with workers and agents. You are responsible for the accuracy of information you provide and for complying with all applicable laws.',
  },
  {
    heading: '3. User Accounts',
    body: 'You must provide accurate registration information. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.',
  },
  {
    heading: '4. KYC Verification',
    body: 'All users must complete KYC verification to access full platform features. We verify identity using government-issued identity documents in compliance with applicable regulations.',
  },
  {
    heading: '5. Payments',
    body: 'All payments are processed securely. Contact credits are non-refundable once used. Agent commissions are paid per the schedule defined in your agent agreement.',
  },
  {
    heading: '6. Prohibited Conduct',
    body: 'You may not misuse the platform, post false information, contact users outside the platform to avoid payments, or engage in any fraudulent activity.',
  },
  {
    heading: '7. Termination',
    body: 'We reserve the right to terminate or suspend accounts that violate these terms, engage in fraud, or harm other users of the platform.',
  },
  {
    heading: '8. Liability',
    body: 'BookMyWorkers is a marketplace platform. We do not guarantee employment outcomes. Our liability is limited to the extent permitted by applicable law.',
  },
  {
    heading: '9. Changes to Terms',
    body: 'We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the updated terms.',
  },
  {
    heading: '10. Contact',
    body: 'For questions about these terms, contact us at legal@bookmyworkers.com.',
  },
];

const PRIVACY = [
  {
    heading: '1. Information We Collect',
    body: 'We collect information you provide (name, phone, government ID last 4 digits, location), usage data, and device information (including push notification tokens for notifications).',
  },
  {
    heading: '2. How We Use Your Information',
    body: 'We use your information to operate the platform, verify identity, match workers with opportunities, process payments, send notifications, and improve our services.',
  },
  {
    heading: '3. Information Sharing',
    body: 'We do not sell your personal information. We share data with employers/agents only when you express interest or unlock a contact. We use trusted third-party services for payments and cloud storage.',
  },
  {
    heading: '4. Govt ID Information',
    body: 'Govt ID information is collected solely for identity verification. We store only the last 4 digits of your Id number. Document images are encrypted and stored securely.',
  },
  {
    heading: '5. Push Notifications',
    body: 'With your permission, we send push notifications about job opportunities, messages, and account updates. You can manage notification preferences in your profile settings.',
  },
  {
    heading: '6. Location Data',
    body: 'We collect your state, district, and block to match you with local opportunities. We do not track your real-time location.',
  },
  {
    heading: '7. Data Security',
    body: 'We implement industry-standard security measures including encryption and secure servers. However, no system is 100% secure and we cannot guarantee absolute security.',
  },
  {
    heading: '8. Data Retention & Account Deletion',
    body: 'We retain your data as long as your account is active. You can permanently delete your account directly from Profile → Danger Zone → Delete Account. This anonymises your personal data immediately. Some transactional records (payments, compliance logs) may be retained for the period required by law.',
  },
  {
    heading: '9. Your Rights',
    body: 'You have the right to access, correct, or delete your personal data. You may delete your account at any time from within the app. For additional requests, contact privacy@bookmyworkers.com.',
  },
  {
    heading: '10. Contact',
    body: 'For privacy questions, contact our Data Protection Officer at privacy@bookmyworkers.com.',
  },
];

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const TermsPrivacyScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const { config } = useAppConfig();
  const [tab, setTab] = useState<Tab>('terms');

  // Strip HTML from CMS rich text for React Native display
  const cmsTermsText    = config.legal.termsText    ? stripHtml(config.legal.termsText)           : '';
  const cmsTermsLink    = config.legal.termsLink;
  const cmsPrivacyText  = config.legal.privacyPolicyText ? stripHtml(config.legal.privacyPolicyText) : '';
  const cmsPrivacyLink  = config.legal.privacyPolicyLink;

  const sections = tab === 'terms' ? TERMS : PRIVACY;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="Terms & Privacy" onBack={() => navigation.goBack()} />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppText variant="title" style={styles.title}>Terms & Privacy</AppText>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {(['terms', 'privacy'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              tab === t && { backgroundColor: theme.colors.primary },
            ]}
          >
            <AppText
              variant="label"
              color={tab === t ? '#FFFFFF' : theme.colors.mutedText}
            >
              {t === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      <AppText variant="caption" color={theme.colors.mutedText} style={styles.lastUpdated}>
        Last updated: May 2025
      </AppText>

      {/* CMS text overrides hardcoded sections when set in admin panel */}
      {tab === 'terms' && cmsTermsText ? (
        <AppCard style={styles.sectionCard}>
          <AppText variant="body" color={theme.colors.mutedText} style={[styles.sectionBody, { lineHeight: 24 }]}>
            {cmsTermsText}
          </AppText>
          {!!cmsTermsLink && (
            <TouchableOpacity onPress={() => void Linking.openURL(cmsTermsLink)} style={styles.linkRow}>
              <AppText variant="caption" color={theme.colors.primary}>View full Terms & Conditions ›</AppText>
            </TouchableOpacity>
          )}
        </AppCard>
      ) : tab === 'privacy' && cmsPrivacyText ? (
        <AppCard style={styles.sectionCard}>
          <AppText variant="body" color={theme.colors.mutedText} style={[styles.sectionBody, { lineHeight: 24 }]}>
            {cmsPrivacyText}
          </AppText>
          {!!cmsPrivacyLink && (
            <TouchableOpacity onPress={() => void Linking.openURL(cmsPrivacyLink)} style={styles.linkRow}>
              <AppText variant="caption" color={theme.colors.primary}>View full Privacy Policy ›</AppText>
            </TouchableOpacity>
          )}
        </AppCard>
      ) : (
        sections.map((section, i) => (
          <AppCard key={i} style={styles.sectionCard}>
            <AppText variant="label" style={styles.sectionHeading}>{section.heading}</AppText>
            <AppText variant="body" color={theme.colors.mutedText} style={styles.sectionBody}>
              {section.body}
            </AppText>
          </AppCard>
        ))
      )}

      <AppText variant="caption" color={theme.colors.mutedText} style={styles.footer}>
        © 2025 BookMyWorkers. All rights reserved.
      </AppText>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { marginBottom: 16 },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  lastUpdated: { marginBottom: 16, textAlign: 'center' },
  sectionCard: { marginBottom: 10 },
  sectionHeading: { marginBottom: 8 },
  sectionBody: { lineHeight: 22 },
  linkRow: { marginTop: 12 },
  footer: { textAlign: 'center', marginTop: 16 },
});
