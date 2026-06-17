import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import i18n from '.';
import { updateProfileFields } from '../api/endpoints/authApi';
import { useAuth } from '../../state/auth/AuthContext';
import type { AppLanguage } from '../../shared/types/domain';

/**
 * Derives the "pending pick" marker key for an app's language key. The language
 * picker (LanguageSelectScreen) writes the user's active selection here so that
 * useLangSync can tell a fresh, deliberate pick apart from the DB value it caches
 * back into the main key on every login.
 */
export const langPendingKey = (appLangKey: string): string => `${appLangKey}_pending`;

/**
 * Keeps the app-specific language key in AsyncStorage in sync with the DB:
 *
 *  • A language the user actively picked on the startup picker (pending marker set)
 *      → this wins over whatever is in the DB, and is written back to the DB.
 *        Repairs accounts that were previously saved with the wrong language.
 *
 *  • Login with existing account that has a language in DB (no pending pick)
 *      → write DB language to local storage so next cold-boot is instant
 *
 *  • First login / registration (no DB language yet)
 *      → read the pre-login selection from local storage
 *      → save it to DB so every subsequent login restores it
 *
 * Pass the app-specific storage key (AGENT_LANG_KEY or EMPLOYER_LANG_KEY).
 * Call this hook inside AppNavigator — it fires exactly once per authentication.
 */
export function useLangSync(appLangKey: string): void {
  const { state, updateProfile } = useAuth();
  const lastSyncedStatus = useRef<string | null>(null);

  useEffect(() => {
    if (state.status !== 'authenticated' || !state.session) return;
    // Avoid running the same sync twice (strict-mode double-effect, hot-reload, etc.)
    if (lastSyncedStatus.current === state.session.user.id) return;
    lastSyncedStatus.current = state.session.user.id ?? 'unknown';

    const dbLang = (state.session.user.language ?? '') as AppLanguage | '';

    void (async () => {
      // ── Case 0: User actively picked a language on the startup picker ─────────
      // A deliberate pick always wins — even over an existing DB value — and is
      // persisted back to the DB. This repairs accounts that were saved with the
      // wrong language by an earlier defaulting bug. The marker is consumed once.
      const pendingLang = (await AsyncStorage.getItem(langPendingKey(appLangKey))) as AppLanguage | null;
      if (pendingLang) {
        await AsyncStorage.removeItem(langPendingKey(appLangKey));
        await AsyncStorage.setItem(appLangKey, pendingLang);
        if (pendingLang !== dbLang) {
          try {
            await updateProfileFields({ language: pendingLang });
          } catch {
            // non-fatal — DB save will be retried next login
          }
          await updateProfile({ language: pendingLang });
        }
        if (i18n.language !== pendingLang) {
          void i18n.changeLanguage(pendingLang);
        }
        return;
      }

      if (dbLang) {
        // ── Case A: DB has a language ──────────────────────────────────────────
        // Write it to local storage so AppNavigator applies it instantly on next boot
        await AsyncStorage.setItem(appLangKey, dbLang);
        void i18n.changeLanguage(dbLang);
      } else {
        // ── Case B: DB has no language (first login / fresh account) ───────────
        // Read whatever the user picked on the pre-registration language screen.
        // Fall back to the current i18n language (already set by LanguageSelectScreen
        // or device locale) — never force 'en' for a user who hasn't saved one yet.
        const localLang = (await AsyncStorage.getItem(appLangKey)) as AppLanguage | null;
        const lang: AppLanguage = localLang ?? (i18n.language as AppLanguage) ?? 'en';

        // Persist to DB so every future login auto-restores this language
        try {
          await updateProfileFields({ language: lang });
        } catch {
          // non-fatal — DB save will be retried next login
        }

        // Patch local session so the rest of the app sees the correct language
        await updateProfile({ language: lang });

        // Ensure local storage key is set (could have been empty if user skipped the screen)
        if (!localLang) await AsyncStorage.setItem(appLangKey, lang);

        // Only call changeLanguage if it actually differs — avoids redundant re-renders
        if (i18n.language !== lang) {
          void i18n.changeLanguage(lang);
        }
      }
    })();
  // Re-run only when auth status changes (login / logout cycle)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.session?.user.id]);
}
