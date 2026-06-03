import React from 'react';
import { Linking, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';

const FAQ_KEYS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5', 'faq6', 'faq7', 'faq8'] as const;

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
  const { t } = useTranslation('employer');
  const { config } = useAppConfig();
  const { supportEmail, primaryPhone, whatsappNumber } = config.contact;

  const waNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const phoneClean = primaryPhone.replace(/\s/g, '');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('sup_title')} onBack={() => navigation.goBack()} />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppText variant="title" style={styles.title}>{t('sup_title')}</AppText>
      <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
        {t('sup_subtitle')}
      </AppText>

      {/* Contact Options */}
      <AppText variant="label" color={theme.colors.mutedText} style={styles.sectionLabel}>{t('sup_contactUs')}</AppText>
      <ContactCard
        icon="💬"
        title={t('sup_whatsapp')}
        subtitle={t('sup_whatsappSub')}
        onPress={() => void Linking.openURL(`https://wa.me/${waNumber}`)}
      />
      <ContactCard
        icon="📧"
        title={t('sup_emailTitle')}
        subtitle={supportEmail}
        onPress={() => void Linking.openURL(`mailto:${supportEmail}`)}
      />
      <ContactCard
        icon="📞"
        title={t('sup_call')}
        subtitle={t('sup_callSub', { phone: primaryPhone })}
        onPress={() => void Linking.openURL(`tel:${phoneClean}`)}
      />

      {/* FAQ */}
      <AppText variant="label" color={theme.colors.mutedText} style={[styles.sectionLabel, styles.faqLabel]}>
        {t('sup_faqHeading')}
      </AppText>
      {FAQ_KEYS.map((key, i) => (
        <AppCard key={i} style={styles.faqCard}>
          <AppText variant="label" style={styles.faqQ}>{t(`sup_${key}_q`)}</AppText>
          <AppText variant="body" color={theme.colors.mutedText} style={styles.faqA}>{t(`sup_${key}_a`)}</AppText>
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
