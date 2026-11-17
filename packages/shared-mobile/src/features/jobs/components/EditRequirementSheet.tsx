import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppSheet } from '../../../shared/components/ui/AppSheet';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { digitsOnly as digits, isEditValid, toDay, validateEdit } from '../utils/editRequirement';

export interface EditableRequirement {
  postingType?: string;
  projectTitle?: string;
  workerQuantitySkilled?: number | string;
  workerNeedDate?: string;
  minBudgetPerWorker?: number | string;
  maxBudgetPerWorker?: number | string;
  remarks?: string;
}

export interface EditRequirementValues {
  workerQuantitySkilled: number;
  workerNeedDate?: string;
  minBudgetPerWorker: number;
  maxBudgetPerWorker: number;
  remarks: string;
  projectTitle?: string;
}

interface Props {
  visible: boolean;
  requirement: EditableRequirement | null | undefined;
  saving: boolean;
  onClose: () => void;
  onSave: (values: EditRequirementValues) => void;
}

/**
 * Employer self-edit of their OWN requirement / project (mirrors the CRM "Edit Requirement" dialog): workers needed,
 * needed-by date, wages and description (+ project title). Location and category stay fixed after posting.
 * Validation is local; the server re-checks ownership.
 */
export const EditRequirementSheet = ({ visible, requirement, saving, onClose, onSave }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const isProject = requirement?.postingType === 'project';
  const [qty, setQty] = useState('');
  const [date, setDate] = useState('');
  const [minW, setMinW] = useState('');
  const [maxW, setMaxW] = useState('');
  const [remarks, setRemarks] = useState('');
  const [title, setTitle] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!visible || !requirement) return;
    setQty(String(requirement.workerQuantitySkilled ?? ''));
    setDate(toDay(requirement.workerNeedDate));
    setMinW(String(requirement.minBudgetPerWorker ?? ''));
    setMaxW(String(requirement.maxBudgetPerWorker ?? ''));
    setRemarks(requirement.remarks ?? '');
    setTitle(requirement.projectTitle ?? '');
    setTried(false);
  }, [visible, requirement]);

  const q = parseInt(qty, 10);
  const mn = parseInt(minW, 10);
  const mx = parseInt(maxW, 10);
  const e = validateEdit({ qty, date, minW, maxW, title, isProject });
  const errQty = e.qty ? t(e.qty) : '';
  const errDate = e.date ? t(e.date) : '';
  const errMin = e.min ? t(e.min) : '';
  const errMax = e.max ? t(e.max) : '';
  const errTitle = e.title ? t(e.title) : '';
  const ok = isEditValid(e);

  const submit = (): void => {
    setTried(true);
    if (!ok) return;
    onSave({
      workerQuantitySkilled: q,
      ...(date ? { workerNeedDate: date } : {}),
      minBudgetPerWorker: mn,
      maxBudgetPerWorker: mx,
      remarks: remarks.trim(),
      ...(isProject ? { projectTitle: title.trim() } : {}),
    });
  };

  return (
    <AppSheet visible={visible} onClose={saving ? () => {} : onClose} title={isProject ? t('er_titleProject') : t('er_title')} subtitle={t('er_subtitle')} maxHeightRatio={0.92}>
      <View style={{ gap: 12 }}>
        {isProject && (
          <AppInput label={t('er_projectTitle')} value={title} onChangeText={setTitle} maxLength={120}
            errorText={tried ? errTitle : undefined} testID="er-title" />
        )}
        <AppInput label={t('er_workers')} value={qty} onChangeText={(v) => setQty(digits(v))} keyboardType="number-pad" maxLength={5}
          errorText={tried ? errQty : undefined} testID="er-qty" />
        <AppInput label={t('er_needBy')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10}
          helperText={t('er_needByHint')} errorText={tried ? errDate : undefined} testID="er-date" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppInput label={t('er_minWage')} value={minW} onChangeText={(v) => setMinW(digits(v))} keyboardType="number-pad" maxLength={7}
              errorText={tried ? errMin : undefined} testID="er-min" />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput label={t('er_maxWage')} value={maxW} onChangeText={(v) => setMaxW(digits(v))} keyboardType="number-pad" maxLength={7}
              errorText={tried ? errMax : undefined} testID="er-max" />
          </View>
        </View>
        <AppInput label={isProject ? t('er_descProject') : t('er_desc')} value={remarks} onChangeText={setRemarks} multiline numberOfLines={4}
          maxLength={1000} showCount style={{ minHeight: 96, textAlignVertical: 'top' }} testID="er-remarks" />
        <AppText style={{ fontSize: 11.5, opacity: 0.7 }}>{t('er_fixedNote')}</AppText>
        <AppButton title={t('er_save')} onPress={submit} loading={saving} disabled={saving} fullWidth icon="checkmark-circle-outline" />
        <AppButton title={t('er_cancel')} onPress={onClose} variant="ghost" disabled={saving} fullWidth />
      </View>
    </AppSheet>
  );
};
