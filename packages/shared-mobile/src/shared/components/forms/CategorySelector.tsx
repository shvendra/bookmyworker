import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import categoriesRaw from '../../data/categories.json';
import { getSubCatLabel, getWorkTypeLabel } from '../../utils/labelUtils';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../ui/AppText';

interface CatEntry {
  label: string;
  value: string;
  subcategories: Array<{ label: string; value: string }>;
}

const CATEGORIES: CatEntry[] = (categoriesRaw as CatEntry[]).map((c) => ({
  label: c.label,
  value: c.value,
  subcategories: c.subcategories ?? [],
}));

interface CategorySelectorProps {
  category: string;
  subCategory: string;
  onCategoryChange: (c: string) => void;
  onSubCategoryChange: (s: string) => void;
  categoryError?: string;
  subCategoryError?: string;
  required?: boolean;
}

type PickerMode = 'category' | 'subCategory' | null;

export const CategorySelector = ({
  category,
  subCategory,
  onCategoryChange,
  onSubCategoryChange,
  categoryError,
  subCategoryError,
  required = false,
}: CategorySelectorProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<PickerMode>(null);
  const [query, setQuery] = useState('');

  const selectedCat = CATEGORIES.find((c) => c.value === category);
  const subList = selectedCat?.subcategories ?? [];

  // Top-level categories are translated via the cat_* i18n keys (all 11 languages).
  // Their labels are formatted with a newline for the grid, so flatten it for the list.
  const catLabelFor = (value: string): string => getWorkTypeLabel(value, t).replace(/\n/g, ' ');

  const categoryLabel = selectedCat ? catLabelFor(selectedCat.value) : '';
  const subLabel = subCategory ? getSubCatLabel(subCategory, i18n.language) : '';

  const filteredCats = useMemo(
    () => CATEGORIES.filter((c) => {
      const translated = catLabelFor(c.value);
      return translated.toLowerCase().includes(query.toLowerCase()) ||
        c.label.toLowerCase().includes(query.toLowerCase());
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, i18n.language]
  );
  const filteredSubs = useMemo(
    () => subList.filter((s) => {
      const translated = getSubCatLabel(s.value, i18n.language);
      return translated.toLowerCase().includes(query.toLowerCase()) ||
        s.label.toLowerCase().includes(query.toLowerCase());
    }),
    [query, subList, i18n.language]
  );

  const openPicker = (m: PickerMode): void => {
    setQuery('');
    setMode(m);
  };

  const handleCatSelect = (value: string): void => {
    onCategoryChange(value);
    onSubCategoryChange('');
    setMode(null);
  };

  const handleSubSelect = (value: string): void => {
    onSubCategoryChange(value);
    setMode(null);
  };

  return (
    <View style={styles.container}>
      {/* Category */}
      <PickerField
        label={`${t('workCategory')}${required ? ' *' : ''}`}
        value={categoryLabel}
        placeholder={t('cs_selectCategory')}
        error={categoryError}
        onPress={() => openPicker('category')}
        theme={theme}
      />

      {/* Sub-Category */}
      <PickerField
        label={t('cs_subCategory')}
        value={subLabel}
        placeholder={category ? t('cs_selectSubCategory') : t('cs_selectCategoryFirst')}
        error={subCategoryError}
        disabled={!category || subList.length === 0}
        onPress={() => category && subList.length > 0 && openPicker('subCategory')}
        theme={theme}
      />

      {/* Modal */}
      <Modal
        visible={mode !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setMode(null)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.border }]}>
              <AppText variant="label">
                {mode === 'category' ? t('cs_selectCategory') : t('cs_selectSubCategory')}
              </AppText>
              <TouchableOpacity onPress={() => setMode(null)}>
                <AppText variant="body" color={theme.colors.primary}>{t('done')}</AppText>
              </TouchableOpacity>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('searchEllipsis')}
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

            {mode === 'category' ? (
              <FlatList
                data={filteredCats}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const selected = item.value === category;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.option,
                        { borderBottomColor: theme.colors.border },
                        selected && { backgroundColor: theme.colors.primary + '15' },
                      ]}
                      onPress={() => handleCatSelect(item.value)}
                    >
                      <View style={styles.optionContent}>
                        <AppText
                          variant="body"
                          color={selected ? theme.colors.primary : theme.colors.text}
                        >
                          {catLabelFor(item.value)}
                        </AppText>
                        <AppText variant="caption" color={theme.colors.mutedText}>
                          {t('cs_subTypes', { n: item.subcategories.length })}
                        </AppText>
                      </View>
                      {selected && (
                        <AppText variant="caption" color={theme.colors.primary}>✓</AppText>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            ) : (
              <FlatList
                data={filteredSubs}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const selected = item.value === subCategory;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.option,
                        { borderBottomColor: theme.colors.border },
                        selected && { backgroundColor: theme.colors.primary + '15' },
                      ]}
                      onPress={() => handleSubSelect(item.value)}
                    >
                      <AppText
                        variant="body"
                        color={selected ? theme.colors.primary : theme.colors.text}
                        style={{ flexShrink: 1 }}
                      >
                        {getSubCatLabel(item.value, i18n.language)}
                      </AppText>
                      {selected && (
                        <AppText variant="caption" color={theme.colors.primary}>✓</AppText>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
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
        numberOfLines={2}
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
  optionContent: { flex: 1, gap: 2 },
});
