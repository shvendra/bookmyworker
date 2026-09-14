import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppSheet } from '../../../shared/components/ui/AppSheet';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { sitesApi, type Site, type SiteType } from '../../../core/api/endpoints/sitesApi';

interface AddSiteSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the newly-created site so the caller (New Requirement form) can auto-select it. */
  onCreated: (site: Site) => void;
}

const SITE_TYPES: SiteType[] = ['Factory', 'Warehouse', 'Shop', 'Office', 'ConstructionSite', 'Other'];

const SITE_TYPE_LABEL_KEY: Record<SiteType, string> = {
  Factory: 'wf_site_type_factory',
  Warehouse: 'wf_site_type_warehouse',
  Shop: 'wf_site_type_shop',
  Office: 'wf_site_type_office',
  ConstructionSite: 'wf_site_type_constructionsite',
  Other: 'wf_site_type_other',
};

const EMPTY_FORM = {
  siteName: '',
  siteType: 'Other' as SiteType,
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  contactName: '',
  contactPhone: '',
  shiftPattern: '',
};

export const AddSiteSheet = ({ visible, onClose, onCreated }: AddSiteSheetProps): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const update = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetAndClose = (): void => {
    setForm(EMPTY_FORM);
    setNameError(undefined);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () =>
      sitesApi.createMySite({
        siteName: form.siteName.trim(),
        siteType: form.siteType,
        address: {
          line1: form.line1 || undefined,
          line2: form.line2 || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          pincode: form.pincode || undefined,
        },
        siteContactName: form.contactName || undefined,
        siteContactPhone: form.contactPhone || undefined,
        shiftPattern: form.shiftPattern || undefined,
      }),
    onSuccess: (site) => {
      void queryClient.invalidateQueries({ queryKey: ['wf-my-sites'] });
      toast.success(t('wf_site_added_toast'));
      onCreated(site);
      setForm(EMPTY_FORM);
      setNameError(undefined);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : t('wf_site_save_failed'));
    },
  });

  const handleSubmit = (): void => {
    if (!form.siteName.trim()) {
      setNameError(t('wf_site_name_required_error'));
      return;
    }
    setNameError(undefined);
    mutation.mutate();
  };

  return (
    <AppSheet visible={visible} onClose={resetAndClose} title={t('wf_add_site_sheet_title')}>
      <AppInput
        label={t('wf_site_name_label')}
        placeholder={t('wf_site_name_placeholder')}
        value={form.siteName}
        onChangeText={(v: string) => update('siteName', v)}
        errorText={nameError}
      />
      <FormSelect
        label={t('wf_site_type_label')}
        value={form.siteType}
        options={SITE_TYPES}
        onChange={(v) => update('siteType', v as SiteType)}
        renderLabel={(v) => t(SITE_TYPE_LABEL_KEY[v as SiteType] ?? 'wf_site_type_other')}
      />
      <AppInput
        label={t('wf_address_line1_label')}
        value={form.line1}
        onChangeText={(v: string) => update('line1', v)}
      />
      <AppInput
        label={t('wf_address_line2_label')}
        value={form.line2}
        onChangeText={(v: string) => update('line2', v)}
      />
      <View style={styles.row}>
        <View style={styles.rowHalf}>
          <AppInput label={t('wf_city_label')} value={form.city} onChangeText={(v: string) => update('city', v)} />
        </View>
        <View style={styles.rowHalf}>
          <AppInput label={t('state')} value={form.state} onChangeText={(v: string) => update('state', v)} />
        </View>
      </View>
      <AppInput
        label={t('pinCode')}
        value={form.pincode}
        onChangeText={(v: string) => update('pincode', v)}
        keyboardType="number-pad"
        maxLength={6}
      />
      <View style={styles.row}>
        <View style={styles.rowHalf}>
          <AppInput
            label={t('wf_site_contact_name_label')}
            value={form.contactName}
            onChangeText={(v: string) => update('contactName', v)}
          />
        </View>
        <View style={styles.rowHalf}>
          <AppInput
            label={t('wf_site_contact_phone_label')}
            value={form.contactPhone}
            onChangeText={(v: string) => update('contactPhone', v)}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
      </View>
      <AppInput
        label={t('wf_shift_pattern_label')}
        placeholder={t('wf_shift_pattern_placeholder')}
        value={form.shiftPattern}
        onChangeText={(v: string) => update('shiftPattern', v)}
      />
      <AppButton
        title={t('wf_save_site_cta')}
        onPress={handleSubmit}
        loading={mutation.isPending}
        disabled={mutation.isPending}
        fullWidth
        style={styles.submitBtn}
      />
    </AppSheet>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  rowHalf: { flex: 1 },
  submitBtn: { marginTop: 4, marginBottom: 8 },
});
