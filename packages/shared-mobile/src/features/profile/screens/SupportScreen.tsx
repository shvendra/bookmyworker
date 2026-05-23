import React from 'react';
import { Linking, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';

const FAQS = [
  {
    q: 'How do I post a worker requirement?',
    a: 'Go to Home → Post Requirement. Fill in your job details such as worker type, location, budget, and duration, then submit your requirement.',
  },
  {
    q: 'Why am I asked to subscribe before posting?',
    a: 'BookMyWorker is a subscription-based marketplace. An active subscription is required to post worker requirements, search workers, and access premium features.',
  },
  {
    q: 'How do I subscribe to BookMyWorker?',
    a: 'Go to Dashboard or Subscription section, choose a plan that fits your hiring needs, and complete the payment to activate your account.',
  },
  {
    q: 'How do I search for workers?',
    a: 'Go to Search Workers and apply filters like category, location, skill type, and budget to find suitable workers for your requirement.',
  },
  {
    q: 'How do I contact workers?',
    a: 'With an active subscription, you can directly view worker details and connect with them through chat or contact options.',
  },
  {
    q: 'How do I complete KYC verification?',
    a: 'Go to Profile → KYC Verification and upload required documents such as Aadhaar card details. Verification usually takes 24-48 hours.',
  },
  {
    q: 'Why is my account showing pending status?',
    a: 'Your profile or KYC documents are currently under review. Please allow 24-48 hours for approval.',
  },
  {
    q: 'How do I manage my subscription?',
    a: 'Go to Profile → Subscription to view your active plan, expiry date, and renewal options.',
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
  const navigation = useNavigation();
  const { config } = useAppConfig();
  const { supportEmail, primaryPhone, whatsappNumber } = config.contact;

  const waNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const phoneClean = primaryPhone.replace(/\s/g, '');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="Support & Help" onBack={() => navigation.goBack()} />
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
        onPress={() => void Linking.openURL(`https://wa.me/${waNumber}`)}
      />
      <ContactCard
        icon="📧"
        title="Email Support"
        subtitle={supportEmail}
        onPress={() => void Linking.openURL(`mailto:${supportEmail}`)}
      />
      <ContactCard
        icon="📞"
        title="Call Us"
        subtitle={`${primaryPhone} · Mon–Sat, 9am–6pm`}
        onPress={() => void Linking.openURL(`tel:${phoneClean}`)}
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
        BookMyWorkers · v1.0.0{'\n'}{supportEmail}
      </AppText>
    </ScrollView>
    </View>
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
