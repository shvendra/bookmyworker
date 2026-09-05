import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppConfig, type AppConfig } from '../../../core/api/endpoints/appConfigApi';

const FAQ_KEYS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5', 'faq6', 'faq7', 'faq8'] as const;

type HelpTopic = AppConfig['helpCenter']['topics'][number];
type HelpCategory = AppConfig['helpCenter']['categories'][number];

// "Chat with Executive" on this app IS the WhatsApp option below (there's no
// separate in-app live-chat screen) — gated to business hours so it isn't
// offered as if a human were always available on the other end.
function isChatLive(startHour: number, endHour: number): boolean {
  const h = new Date().getHours();
  if (startHour === endHour) return true; // 24h window
  return startHour < endHour ? (h >= startHour && h < endHour) : (h >= startHour || h < endHour);
}

interface ContactCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}

const ContactCard = ({ icon, title, subtitle, onPress, disabled }: ContactCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.contactCard,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        disabled && styles.contactCardDisabled,
      ]}
    >
      <AppText style={styles.contactIcon}>{icon}</AppText>
      <View style={styles.contactText}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>{subtitle}</AppText>
      </View>
      {!disabled && <AppText color={theme.colors.mutedText}>›</AppText>}
    </TouchableOpacity>
  );
};

// ── Help Center: category chips + matched Q&A ────────────────────────────────
const HelpTopicRow = ({ topic }: { topic: HelpTopic }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen((o) => !o)}
      style={[styles.topicRow, { borderColor: theme.colors.border }]}>
      <View style={styles.topicHeaderRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="label" style={styles.topicQ}>{topic.questionEn}</AppText>
          {!!topic.questionHi && (
            <AppText variant="caption" color={theme.colors.mutedText}>{topic.questionHi}</AppText>
          )}
        </View>
        <AppText color={theme.colors.mutedText}>{open ? '▲' : '▼'}</AppText>
      </View>
      {open && (
        <View style={styles.topicAnswerWrap}>
          <AppText variant="body" color={theme.colors.mutedText} style={styles.topicA}>{topic.answerEn}</AppText>
          {!!topic.answerHi && (
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.topicA}>{topic.answerHi}</AppText>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export const SupportScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const { t } = useTranslation('employer');
  const { config } = useAppConfig();
  const { supportEmail, primaryPhone, whatsappNumber } = config.contact;
  const { categories, topics } = config.helpCenter;
  const { chatStartHour, chatEndHour } = config.supportAvailability;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const waNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const phoneClean = primaryPhone.replace(/\s/g, '');
  const chatLive = isChatLive(chatStartHour, chatEndHour);

  const activeCategories = useMemo(
    () => categories.filter((c: HelpCategory) => c.isActive).sort((a: HelpCategory, b: HelpCategory) => a.order - b.order),
    [categories],
  );
  const categoryTopics = useMemo(
    () => topics
      .filter((tp: HelpTopic) => tp.isActive && tp.categoryKey === activeCategory)
      .sort((a: HelpTopic, b: HelpTopic) => a.order - b.order),
    [topics, activeCategory],
  );

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
        subtitle={chatLive
          ? t('sup_whatsappSub')
          : t('sup_chatHoursSub', { start: chatStartHour, end: chatEndHour, defaultValue: `Available ${chatStartHour}:00–${chatEndHour}:00` })}
        disabled={!chatLive}
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

      {/* Smart Help Center — SuperAdmin-managed, additive to the static FAQ
          list below. Hidden entirely until at least one category exists. */}
      {activeCategories.length > 0 && (
        <>
          <AppText variant="label" color={theme.colors.mutedText} style={[styles.sectionLabel, styles.faqLabel]}>
            {t('sup_browseTopics', { defaultValue: 'Browse Help Topics' })}
          </AppText>
          <View style={styles.categoryRow}>
            {activeCategories.map((cat: HelpCategory) => {
              const selected = activeCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  activeOpacity={0.7}
                  onPress={() => setActiveCategory(selected ? null : cat.key)}
                  style={[
                    styles.categoryChip,
                    { borderColor: selected ? theme.colors.primary : theme.colors.border },
                    selected && { backgroundColor: theme.colors.primary + '14' },
                  ]}
                >
                  <AppText style={styles.categoryIcon}>{cat.icon}</AppText>
                  <AppText variant="caption" style={styles.categoryLabel}>{cat.labelEn}</AppText>
                </TouchableOpacity>
              );
            })}
          </View>
          {activeCategory && (
            categoryTopics.length > 0 ? (
              categoryTopics.map((topic: HelpTopic, i: number) => <HelpTopicRow key={topic.categoryKey + i} topic={topic} />)
            ) : (
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.noTopics}>
                {t('sup_noTopics', { defaultValue: 'No topics in this category yet.' })}
              </AppText>
            )
          )}
        </>
      )}

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
  contactCardDisabled: { opacity: 0.45 },
  contactText: { flex: 1 },
  faqCard: { marginBottom: 10 },
  faqQ: { marginBottom: 6 },
  faqA: { lineHeight: 20 },
  footer: { textAlign: 'center', marginTop: 24, lineHeight: 20 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
  },
  categoryIcon: { fontSize: 15 },
  categoryLabel: { fontWeight: '700' },
  topicRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  topicHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topicQ: { marginBottom: 2 },
  topicAnswerWrap: { marginTop: 8, gap: 4 },
  topicA: { lineHeight: 20 },
  noTopics: { marginBottom: 12 },
});
