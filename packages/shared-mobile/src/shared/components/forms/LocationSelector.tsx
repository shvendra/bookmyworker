import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { indianStates } from '../../data/stateDistrict';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../ui/AppText';

interface LocationSelectorProps {
  state: string;
  district: string;
  block: string;
  onStateChange: (s: string) => void;
  onDistrictChange: (d: string) => void;
  onBlockChange: (b: string) => void;
  stateError?: string;
  districtError?: string;
  blockError?: string;
  blockLabel?: string;
  required?: boolean;
}

type PickerMode = 'state' | 'district' | 'block' | null;

const STATE_LIST = Object.keys(indianStates).sort();

export const LocationSelector = ({
  state,
  district,
  block,
  onStateChange,
  onDistrictChange,
  onBlockChange,
  stateError,
  districtError,
  blockError,
  blockLabel = 'Block / Tehsil',
  required = true,
}: LocationSelectorProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [mode, setMode] = useState<PickerMode>(null);
  const [query, setQuery] = useState('');

  const districtList = useMemo(
    () => (state ? Object.keys(indianStates[state] ?? {}).sort() : []),
    [state]
  );

  const blockList = useMemo(
    () => (state && district ? (indianStates[state]?.[district] ?? []) : []),
    [state, district]
  );

  const activeList = useMemo(() => {
    const q = query.toLowerCase();
    if (mode === 'state') return STATE_LIST.filter((s) => s.toLowerCase().includes(q));
    if (mode === 'district') return districtList.filter((d) => d.toLowerCase().includes(q));
    if (mode === 'block') return blockList.filter((b) => b.toLowerCase().includes(q));
    return [];
  }, [mode, query, districtList, blockList]);

  const openPicker = (m: PickerMode): void => {
    setQuery('');
    setMode(m);
  };

  const handleSelect = (value: string): void => {
    if (mode === 'state') {
      onStateChange(value);
      onDistrictChange('');
      onBlockChange('');
    } else if (mode === 'district') {
      onDistrictChange(value);
      onBlockChange('');
    } else if (mode === 'block') {
      onBlockChange(value);
    }
    setMode(null);
  };

  const activeValue = mode === 'state' ? state : mode === 'district' ? district : block;
  const modalTitle = mode === 'state' ? 'Select State' : mode === 'district' ? 'Select District' : `Select ${blockLabel}`;

  return (
    <View style={styles.container}>
      {/* State */}
      <PickerField
        label={`State${required ? ' *' : ''}`}
        value={state}
        placeholder="Select State"
        error={stateError}
        onPress={() => openPicker('state')}
        theme={theme}
      />

      {/* District */}
      <PickerField
        label={`District / City${required ? ' *' : ''}`}
        value={district}
        placeholder={state ? 'Select District' : 'Select state first'}
        error={districtError}
        disabled={!state}
        onPress={() => state && openPicker('district')}
        theme={theme}
      />

      {/* Block / Tehsil */}
      <PickerField
        label={blockLabel}
        value={block}
        placeholder={district ? `Select ${blockLabel}` : 'Select district first'}
        error={blockError}
        disabled={!district}
        onPress={() => district && openPicker('block')}
        theme={theme}
      />

      {/* Picker Modal */}
      <Modal
        visible={mode !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setMode(null)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.border }]}>
              <AppText variant="label">{modalTitle}</AppText>
              <TouchableOpacity onPress={() => setMode(null)}>
                <AppText variant="body" color={theme.colors.primary}>Done</AppText>
              </TouchableOpacity>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${mode ?? ''}…`}
              placeholderTextColor={theme.colors.mutedText}
              style={[
                styles.search,
                {
                  backgroundColor: theme.colors.card,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              autoFocus
            />

            <FlatList
              data={activeList}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item === activeValue;
                return (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      { borderBottomColor: theme.colors.border },
                      selected && { backgroundColor: theme.colors.primary + '15' },
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <AppText
                      variant="body"
                      color={selected ? theme.colors.primary : theme.colors.text}
                    >
                      {item}
                    </AppText>
                    {selected && (
                      <AppText variant="caption" color={theme.colors.primary}>✓</AppText>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <AppText variant="body" color={theme.colors.mutedText} style={styles.empty}>
                  No results found
                </AppText>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

interface PickerFieldProps {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  disabled?: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useAppTheme>['theme'];
}

const PickerField = ({ label, value, placeholder, error, disabled, onPress, theme }: PickerFieldProps): React.JSX.Element => (
  <View style={styles.field}>
    <AppText variant="caption" style={[styles.label, { color: theme.colors.mutedText }]}>
      {label}
    </AppText>
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.selector,
        {
          backgroundColor: disabled ? theme.colors.border + '30' : theme.colors.card,
          borderColor: error ? theme.colors.danger : theme.colors.border,
        },
      ]}
    >
      <AppText
        variant="body"
        color={value ? theme.colors.text : theme.colors.mutedText}
        style={styles.selectorText}
        numberOfLines={1}
      >
        {value || placeholder}
      </AppText>
      <AppText variant="caption" color={theme.colors.mutedText}>▼</AppText>
    </TouchableOpacity>
    {error ? (
      <AppText variant="caption" color={theme.colors.danger} style={styles.error}>
        {error}
      </AppText>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 0 },
  field: { marginBottom: 14 },
  label: { marginBottom: 4, fontWeight: '600' },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  selectorText: { flex: 1, marginRight: 8 },
  error: { marginTop: 4 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    height: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  search: {
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { textAlign: 'center', padding: 24 },
});
