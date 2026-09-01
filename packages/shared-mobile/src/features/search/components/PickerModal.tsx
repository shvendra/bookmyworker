import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { BRAND, C } from './workerSearchShared';

// ─── Picker Modal ─────────────────────────────────────────────────────────────
export const PickerModal = ({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  allLabel = 'All',
  labelFor,
  multiple = false,
}: {
  visible: boolean;
  title: string;
  options: string[];
  /** Single mode: the selected value. Multiple mode: a comma-joined string. */
  selected: string;
  /** Single mode: sets the value + closes. Multiple mode: toggles the value
   *  (called with '' for the "All" option, which clears). */
  onSelect: (v: string) => void;
  onClose: () => void;
  allLabel?: string;
  /** Optional display translator — maps an option's stored value → shown text.
   *  Selection still operates on the original `options` value. */
  labelFor?: (value: string) => string;
  /** Multi-select: tap toggles each option (sheet stays open); tap outside / "All" closes. */
  multiple?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const [q, setQ] = useState('');

  // Lift the bottom sheet above the soft keyboard so the options list stays
  // visible while the user types (Modal renders in its own window and does not
  // auto-resize for the keyboard on Android).
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    if (!visible) { setKbHeight(0); return undefined; }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible]);

  const display = (o: string): string => (labelFor ? labelFor(o) : o);
  // Multi-select: the currently-selected values (parsed from the comma-joined string).
  const selectedList = multiple ? selected.split(',').map((s) => s.trim()).filter(Boolean) : [];
  // Match against both the displayed label (e.g. Hindi) AND the raw stored value
  // (English) so users can search in either script.
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? options.filter(
        (o) =>
          o.toLowerCase().includes(needle) ||
          display(o).toLowerCase().includes(needle),
      )
    : options;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={pm.scrim}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[pm.sheet, { backgroundColor: theme.colors.card, paddingBottom: (kbHeight > 0 ? 18 : insets.bottom + 18), marginBottom: kbHeight, maxHeight: screenH * 0.85 - kbHeight }]}>
          <View style={[pm.grab, { backgroundColor: theme.colors.border }]} />

          {/* Header */}
          <View style={pm.oh}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={[pm.ot, { color: theme.colors.text }]} numberOfLines={2}>{title}</AppText>
              <AppText style={[pm.os, { color: theme.colors.mutedText }]} numberOfLines={2}>
                {t('ws_options_available', { count: options.length })}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={[pm.ox, { backgroundColor: theme.colors.surface1 }]} activeOpacity={0.7}>
              <Ionicons name="close" size={17} color={theme.colors.mutedText} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[pm.searchWrap, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={18} color={theme.colors.mutedText} style={pm.searchIcon} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('ws_search_placeholder')}
              placeholderTextColor={C.slate}
              style={[pm.searchInput, { color: theme.colors.text }]}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ('')} style={pm.searchClear}>
                <Ionicons name="close-circle" size={18} color={theme.colors.mutedText} />
              </TouchableOpacity>
            )}
          </View>

          {/* Options */}
          <FlatList
            data={[allLabel, ...shown]}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            style={pm.list}
            contentContainerStyle={pm.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const val = item === allLabel ? '' : item;
              const active = multiple
                ? (val === '' ? selectedList.length === 0 : selectedList.includes(val))
                : selected === val;
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (multiple) {
                      onSelect(val);                       // parent toggles ('' clears)
                      if (val === '') { setQ(''); onClose(); } // "All" → clear + close; otherwise stay open
                    } else {
                      onSelect(val); setQ(''); onClose();
                    }
                  }}
                  activeOpacity={0.8}
                  style={[pm.oopt, { borderColor: active ? BRAND : theme.colors.border, backgroundColor: active ? BRAND + '0F' : theme.colors.card }]}
                >
                  <AppText style={[pm.ol, { color: active ? BRAND : theme.colors.text }]} numberOfLines={2}>
                    {item === allLabel ? item : display(item)}
                  </AppText>
                  {active && <Ionicons name="checkmark" size={18} color={BRAND} style={pm.ock} />}
                </TouchableOpacity>
              );
            }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
const pm = StyleSheet.create({
  scrim:       { flex: 1, backgroundColor: 'rgba(12,20,46,0.5)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, maxHeight: '85%' },
  grab:        { width: 42, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 4, marginBottom: 16 },
  oh:          { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
  ot:          { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  os:          { fontSize: 12.5, fontWeight: '600', marginTop: 1 },
  ox:          { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, height: 48, marginBottom: 12 },
  searchIcon:  { marginLeft: 14 },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 15, fontWeight: '600' },
  searchClear: { paddingHorizontal: 12 },
  list:        { flexShrink: 1 },
  listContent: { gap: 9, paddingBottom: 8 },
  oopt:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.6, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  ol:          { flex: 1, fontSize: 14.5, fontWeight: '800' },
  ock:         { marginLeft: 'auto' },
});
