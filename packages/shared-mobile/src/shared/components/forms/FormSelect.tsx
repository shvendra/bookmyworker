import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../ui/AppText';

interface FormSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  errorText?: string;
  style?: StyleProp<ViewStyle>;
  searchable?: boolean;
}

export const FormSelect = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  errorText,
  style,
  searchable = false,
}: FormSelectProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = searchable
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <View style={[styles.container, style]}>
      <AppText variant="caption" style={[styles.label, { color: theme.colors.mutedText }]}>
        {label}
      </AppText>

      <TouchableOpacity
        onPress={() => { setOpen(true); setQuery(''); }}
        style={[
          styles.selector,
          {
            backgroundColor: theme.colors.card,
            borderColor: errorText ? theme.colors.danger : theme.colors.border,
          },
        ]}
        activeOpacity={0.7}
      >
        <AppText
          variant="body"
          color={value ? theme.colors.text : theme.colors.mutedText}
          style={styles.selectorText}
        >
          {value || placeholder}
        </AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>▼</AppText>
      </TouchableOpacity>

      {errorText ? (
        <AppText variant="caption" color={theme.colors.danger} style={styles.error}>
          {errorText}
        </AppText>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.border }]}>
              <AppText variant="label">{label}</AppText>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <AppText variant="body" color={theme.colors.primary}>Done</AppText>
              </TouchableOpacity>
            </View>

            {searchable && (
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search…"
                placeholderTextColor={theme.colors.mutedText}
                style={[styles.search, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                autoFocus
              />
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    { borderBottomColor: theme.colors.border },
                    item === value && { backgroundColor: theme.colors.primary + '18' },
                  ]}
                  onPress={() => { onChange(item); setOpen(false); }}
                >
                  <AppText
                    variant="body"
                    color={item === value ? theme.colors.primary : theme.colors.text}
                    style={styles.optionText}
                  >
                    {item}
                  </AppText>
                  {item === value && (
                    <AppText variant="caption" color={theme.colors.primary}>✓</AppText>
                  )}
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
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
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
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
  optionText: { flex: 1, marginRight: 8 },
});
