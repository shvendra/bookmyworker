import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { useAppConfig, type AppConfig } from '../../../core/api/endpoints/appConfigApi';
import { chatApi } from '../../../core/api/endpoints/chatApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from './AppText';

type HelpCategory = AppConfig['helpCenter']['categories'][number];
type HelpSubCategory = AppConfig['helpCenter']['subCategories'][number];
type HelpTopic = AppConfig['helpCenter']['topics'][number];

type Step = 'categories' | 'subcategories' | 'questions' | 'answer';

// Employer's issues are different from Agent/Worker/SelfWorker's — a
// category only shows to the audience it's scoped for (or 'all'/unset).
// `role` is the lowercase AppRole ('employer' | 'agent' | 'worker' | ...).
function audienceMatches(audience: HelpCategory['audience'], role: string | undefined): boolean {
  if (!audience || audience === 'all') return true;
  if (audience === 'employer') return role === 'employer';
  if (audience === 'worker_side') return ['agent', 'worker', 'selfworker'].includes(role ?? '');
  return true;
}

// "Chat with BookMyWorker Agent" — the same live support room used elsewhere
// in the app (e.g. the Employer Dashboard's chat icon) — gated to business
// hours so it isn't offered as if a human were always on the other end.
function isChatLive(startHour: number, endHour: number): boolean {
  const h = new Date().getHours();
  if (startHour === endHour) return true; // 24h window
  return startHour < endHour ? (h >= startHour && h < endHour) : (h >= startHour || h < endHour);
}

interface HelpChatModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Help chat: tap the help icon → Category → Subcategory (when the category
 * has any) → Question → Answer. If the answer doesn't satisfy, the same
 * screen reveals 3 direct escalation options: chat with a BookMyWorker
 * agent (live chat, 9am–6pm by default), support email (always), support
 * call (always). A "talk to us directly" shortcut is also available from
 * every step, for anyone who'd rather skip straight to a human.
 *
 * Backed by the SuperAdmin-managed Help Center (CRM → Settings → Help
 * Center) — same data source as the CRM's own "Get Help" dialog and the
 * Support screen's topic browser.
 */
export const HelpChatModal = ({ visible, onClose }: HelpChatModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const navigation = useNavigation();
  const { state } = useAuth();
  const { config } = useAppConfig();
  const { categories, subCategories, topics } = config.helpCenter;
  const { chatStartHour, chatEndHour } = config.supportAvailability;
  const { supportEmail, primaryPhone } = config.contact;

  const [step, setStep] = useState<Step>('categories');
  const [category, setCategory] = useState<HelpCategory | null>(null);
  const [subCategory, setSubCategory] = useState<HelpSubCategory | null>(null);
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [thinking, setThinking] = useState(false);
  const [satisfied, setSatisfied] = useState<boolean | null>(null);
  const [showEscalate, setShowEscalate] = useState(false);

  const chatLive = isChatLive(chatStartHour, chatEndHour);
  const phoneClean = primaryPhone.replace(/\s/g, '');
  const userId = state.session?.user.id ?? '';
  const userRole = state.session?.user.role;
  const roomId = `support_${userId}`;

  const activeCategories = useMemo(
    () => categories
      .filter((c: HelpCategory) => c.isActive && audienceMatches(c.audience, userRole))
      .sort((a: HelpCategory, b: HelpCategory) => a.order - b.order),
    [categories, userRole],
  );

  // If a live chat session is already open (started from a previous
  // escalation and still within its 24h window), skip the triage entirely
  // and jump straight back into that conversation instead.
  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    chatApi.getSessionStatus(roomId).then((res) => {
      if (cancelled) return;
      if (res.active) {
        onClose();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigation as any).navigate('ChatRoom', { roomId, roomName: 'Support Chat' });
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);
  const subCatsForCategory = useMemo(
    () => (category ? subCategories.filter((s: HelpSubCategory) => s.categoryKey === category.key && s.isActive).sort((a: HelpSubCategory, b: HelpSubCategory) => a.order - b.order) : []),
    [subCategories, category],
  );
  const topicsForStep = useMemo(() => {
    if (!category) return [];
    return topics
      .filter((tp: HelpTopic) => tp.isActive && tp.categoryKey === category.key && (subCategory ? tp.subCategoryKey === subCategory.key : !tp.subCategoryKey))
      .sort((a: HelpTopic, b: HelpTopic) => a.order - b.order);
  }, [topics, category, subCategory]);

  const reset = (): void => {
    setStep('categories');
    setCategory(null);
    setSubCategory(null);
    setTopic(null);
    setSatisfied(null);
    setShowEscalate(false);
    setThinking(false);
  };

  const handleClose = (): void => { reset(); onClose(); };

  const pickCategory = (cat: HelpCategory): void => {
    setCategory(cat);
    const subs = subCategories.filter((s: HelpSubCategory) => s.categoryKey === cat.key && s.isActive);
    setStep(subs.length > 0 ? 'subcategories' : 'questions');
  };
  const pickSubCategory = (sub: HelpSubCategory): void => { setSubCategory(sub); setStep('questions'); };
  const pickTopic = (tp: HelpTopic): void => {
    setTopic(tp);
    setSatisfied(null);
    setShowEscalate(false);
    setThinking(true);
    setStep('answer');
    setTimeout(() => setThinking(false), 500);
  };

  const goBack = (): void => {
    if (step === 'answer') { setStep('questions'); setTopic(null); setSatisfied(null); setShowEscalate(false); return; }
    if (step === 'questions') {
      if (subCatsForCategory.length > 0) { setStep('subcategories'); setSubCategory(null); return; }
      setStep('categories'); setCategory(null); return;
    }
    if (step === 'subcategories') { setStep('categories'); setCategory(null); return; }
  };

  const openAgentChat = async (): Promise<void> => {
    if (!chatLive) return;
    // Record exactly what was selected (and whether it satisfied) as a
    // system message support sees first — never starts the conversation blind.
    await chatApi.startSession(roomId, {
      categoryLabel: category?.labelEn ?? null,
      subCategoryLabel: subCategory?.labelEn ?? null,
      questionText: topic?.questionEn ?? null,
      satisfied: topic ? satisfied : null,
    });
    handleClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigation as any).navigate('ChatRoom', { roomId, roomName: 'Support Chat' });
  };

  const escalateRow = (
    <View style={styles.escalateWrap}>
      <AppText variant="label" color={theme.colors.mutedText} style={styles.escalateLabel}>{t('helpchat_stillNeedHelp')}</AppText>

      <TouchableOpacity
        onPress={() => void openAgentChat()}
        disabled={!chatLive}
        activeOpacity={0.7}
        style={[styles.escalateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, !chatLive && styles.escalateCardDisabled]}
      >
        <AppText style={styles.escalateIcon}>💬</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="label">{t('helpchat_chatWithAgent')}</AppText>
          <AppText variant="caption" color={chatLive ? theme.colors.success : theme.colors.mutedText}>
            {chatLive
              ? t('helpchat_chatAvailable', { start: chatStartHour, end: chatEndHour })
              : t('helpchat_chatClosed', { start: chatStartHour, end: chatEndHour })}
          </AppText>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => void Linking.openURL(`mailto:${supportEmail}`)}
        activeOpacity={0.7}
        style={[styles.escalateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      >
        <AppText style={styles.escalateIcon}>📧</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="label">{t('sup_emailTitle')}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>{supportEmail}</AppText>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => void Linking.openURL(`tel:${phoneClean}`)}
        activeOpacity={0.7}
        style={[styles.escalateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      >
        <AppText style={styles.escalateIcon}>📞</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="label">{t('sup_call')}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>{t('sup_callSub', { phone: primaryPhone })}</AppText>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderColor: theme.colors.border }]}>
          {step !== 'categories' ? (
            <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
              <AppText style={styles.headerBtnTxt}>{`‹ ${t('helpchat_back')}`}</AppText>
            </TouchableOpacity>
          ) : <View style={styles.headerBtn} />}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="label">{t('helpchat_title')}</AppText>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <AppText style={styles.headerBtnTxt}>✕</AppText>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {step === 'categories' && (
            <>
              <AppText variant="title" style={styles.stepTitle}>{t('helpchat_selectCategory')}</AppText>
              <View style={styles.grid}>
                {activeCategories.map((cat: HelpCategory) => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => pickCategory(cat)}
                    activeOpacity={0.75}
                    style={[styles.gridCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  >
                    <AppText style={styles.gridIcon}>{cat.icon}</AppText>
                    <AppText variant="label" style={styles.gridLabel}>{cat.labelEn}</AppText>
                    {!!cat.labelHi && <AppText variant="caption" color={theme.colors.mutedText}>{cat.labelHi}</AppText>}
                  </TouchableOpacity>
                ))}
              </View>
              {activeCategories.length === 0 && (
                <AppText variant="body" color={theme.colors.mutedText} style={styles.emptyTxt}>{t('helpchat_noTopicsHere')}</AppText>
              )}
              <TouchableOpacity onPress={() => setShowEscalate((v) => !v)} style={styles.talkDirectlyBtn}>
                <AppText variant="caption" color={theme.colors.primary} style={styles.talkDirectlyTxt}>{t('helpchat_talkDirectly')}</AppText>
              </TouchableOpacity>
              {showEscalate && escalateRow}
            </>
          )}

          {step === 'subcategories' && category && (
            <>
              <AppText variant="title" style={styles.stepTitle}>{t('helpchat_selectSubcategory')}</AppText>
              <View style={styles.grid}>
                {subCatsForCategory.map((sub: HelpSubCategory) => (
                  <TouchableOpacity
                    key={sub.key}
                    onPress={() => pickSubCategory(sub)}
                    activeOpacity={0.75}
                    style={[styles.gridCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  >
                    {!!sub.icon && <AppText style={styles.gridIcon}>{sub.icon}</AppText>}
                    <AppText variant="label" style={styles.gridLabel}>{sub.labelEn}</AppText>
                    {!!sub.labelHi && <AppText variant="caption" color={theme.colors.mutedText}>{sub.labelHi}</AppText>}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {step === 'questions' && (
            <>
              <AppText variant="title" style={styles.stepTitle}>{t('helpchat_selectQuestion')}</AppText>
              {topicsForStep.length === 0 ? (
                <AppText variant="body" color={theme.colors.mutedText} style={styles.emptyTxt}>{t('helpchat_noTopicsHere')}</AppText>
              ) : (
                topicsForStep.map((tp: HelpTopic, i: number) => (
                  <TouchableOpacity
                    key={tp.categoryKey + i}
                    onPress={() => pickTopic(tp)}
                    activeOpacity={0.7}
                    style={[styles.questionRow, { borderColor: theme.colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="label">{tp.questionEn}</AppText>
                      {!!tp.questionHi && <AppText variant="caption" color={theme.colors.mutedText}>{tp.questionHi}</AppText>}
                    </View>
                    <AppText color={theme.colors.mutedText}>›</AppText>
                  </TouchableOpacity>
                ))
              )}
              <TouchableOpacity onPress={() => setShowEscalate((v) => !v)} style={styles.talkDirectlyBtn}>
                <AppText variant="caption" color={theme.colors.primary} style={styles.talkDirectlyTxt}>{t('helpchat_talkDirectly')}</AppText>
              </TouchableOpacity>
              {showEscalate && escalateRow}
            </>
          )}

          {step === 'answer' && topic && (
            <>
              <AppText variant="label" style={styles.answerQ}>{topic.questionEn}</AppText>
              <View style={styles.botRow}>
                <View style={[styles.botAvatar, { backgroundColor: theme.colors.primary }]}>
                  <AppText style={styles.botAvatarEmoji}>🤖</AppText>
                </View>
                {thinking ? (
                  <View style={[styles.botBubble, { backgroundColor: theme.colors.primary + '14' }]}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                ) : (
                  <View style={[styles.botBubble, { backgroundColor: theme.colors.primary + '14', flex: 1 }]}>
                    <AppText variant="caption" color={theme.colors.primary} style={styles.botLabel}>BookMyWorker Assistant</AppText>
                    <AppText variant="body" style={styles.answerA}>{topic.answerEn}</AppText>
                    {!!topic.answerHi && <AppText variant="caption" color={theme.colors.mutedText} style={styles.answerA}>{topic.answerHi}</AppText>}
                  </View>
                )}
              </View>

              {!thinking && satisfied === null && (
                <View style={styles.satisfyRow}>
                  <AppText variant="label" color={theme.colors.mutedText} style={styles.satisfyLabel}>{t('helpchat_wasHelpful')}</AppText>
                  <View style={styles.satisfyBtns}>
                    <TouchableOpacity onPress={() => setSatisfied(true)} style={[styles.satisfyBtn, { borderColor: theme.colors.border }]}>
                      <AppText variant="label">{t('helpchat_yesHelpful')}</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSatisfied(false)} style={[styles.satisfyBtn, { borderColor: theme.colors.border }]}>
                      <AppText variant="label">{t('helpchat_notHelpful')}</AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {satisfied === true && (
                <AppText variant="body" color={theme.colors.mutedText} style={styles.thankYouTxt}>{t('helpchat_thankYou')} 🙌</AppText>
              )}
              {satisfied === false && escalateRow}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 44, alignItems: 'center' },
  headerBtnTxt: { fontSize: 15, fontWeight: '600' },
  body: { padding: 16, paddingBottom: 40 },
  stepTitle: { marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: {
    width: '47%', borderWidth: 1, borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 4,
  },
  gridIcon: { fontSize: 28 },
  gridLabel: { textAlign: 'center' },
  emptyTxt: { textAlign: 'center', marginTop: 24 },
  questionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  talkDirectlyBtn: { alignSelf: 'center', marginTop: 20, padding: 8 },
  talkDirectlyTxt: { textDecorationLine: 'underline', fontWeight: '600' },
  answerQ: { marginBottom: 12 },
  botRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  botAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  botAvatarEmoji: { fontSize: 14 },
  botBubble: { borderRadius: 14, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12 },
  botLabel: { fontWeight: '700', marginBottom: 4 },
  answerA: { lineHeight: 20 },
  satisfyRow: { marginTop: 24, alignItems: 'center' },
  satisfyLabel: { marginBottom: 10 },
  satisfyBtns: { flexDirection: 'row', gap: 10 },
  satisfyBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  thankYouTxt: { textAlign: 'center', marginTop: 20 },
  escalateWrap: { marginTop: 20, gap: 10 },
  escalateLabel: { marginBottom: 2 },
  escalateCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  escalateCardDisabled: { opacity: 0.45 },
  escalateIcon: { fontSize: 22, width: 30, textAlign: 'center' },
});
