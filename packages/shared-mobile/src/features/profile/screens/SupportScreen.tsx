import React from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';

const FAQS = [
  {
    q: 'How do I post a requirement?',
    a: 'Go to Home → Post Requirement. Fill in the job details including location and requirements. Workers nearby will be notified.',
  },
  {
    q: 'How do I get verified (KYC)?',
    a: 'Go to Profile → KYC Verification. Upload your Aadhaar card (front and back). Verification takes 24-48 hours.',
  },
  {
    q: 'How do agent commissions work?',
    a: 'When a worker you registered completes a job, you earn a commission. Commissions are credited to your wallet and can be withdrawn.',
  },
  {
    q: 'Why is my account showing "pending" status?',
    a: 'Your KYC documents are under review. Please wait 24-48 hours. If delayed, contact support.',
  },
  {
    q: 'How do I contact a worker / employer?',
    a: 'Once you unlock a contact (uses contact credits), go to Chat to message them directly.',
  },
  {
    q: 'How do I add contact credits?',
    a: 'Go to Wallet → Add Credits. Choose a pack (50 or 100 contacts) and complete payment.',
  },
];

interface ContactCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

const ContactCard = ({ icon, title, subtitle, onPress }: ContactCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.contactCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <AppText style={styles.contactIcon}>{icon}</AppText>
      <View style={styles.contactText}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>{subtitle}</AppText>
      </View>
      <AppText color={theme.colors.mutedText}>›</AppText>
    </TouchableOpacity>
  );
};

export const SupportScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppText variant="title" style={styles.title}>Support & Help</AppText>
      <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
        We're here to help. Reach out anytime.
      </AppText>

      {/* Contact Options */}
      <AppText variant="label" color={theme.colors.mutedText} style={styles.sectionLabel}>CONTACT US</AppText>
      <ContactCard
        icon="💬"
        title="WhatsApp Support"
        subtitle="Chat with us on WhatsApp"
        onPress={() => void Linking.openURL('https://wa.me/919876543210')}
      />
      <ContactCard
        icon="📧"
        title="Email Support"
        subtitle="support@bookmyworkers.com"
        onPress={() => void Linking.openURL('mailto:support@bookmyworkers.com')}
      />
      <ContactCard
        icon="📞"
        title="Call Us"
        subtitle="+91 98765 43210 · Mon–Sat, 9am–6pm"
        onPress={() => void Linking.openURL('tel:+919876543210')}
      />

      {/* FAQ */}
      <AppText variant="label" color={theme.colors.mutedText} style={[styles.sectionLabel, styles.faqLabel]}>
        FREQUENTLY ASKED QUESTIONS
      </AppText>
      {FAQS.map((item, i) => (
        <AppCard key={i} style={styles.faqCard}>
          <AppText variant="label" style={styles.faqQ}>{item.q}</AppText>
          <AppText variant="body" color={theme.colors.mutedText} style={styles.faqA}>{item.a}</AppText>
        </AppCard>
      ))}

      <AppText variant="caption" color={theme.colors.mutedText} style={styles.footer}>
        BookMyWorkers · v1.0.0{'\n'}support@bookmyworkers.com
      </AppText>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 20 },
  sectionLabel: { letterSpacing: 0.8, fontSize: 11, marginBottom: 10 },
  faqLabel: { marginTop: 24 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  contactIcon: { fontSize: 24, width: 36, textAlign: 'center' },
  contactText: { flex: 1 },
  faqCard: { marginBottom: 10 },
  faqQ: { marginBottom: 6 },
  faqA: { lineHeight: 20 },
  footer: { textAlign: 'center', marginTop: 24, lineHeight: 20 },
});
