import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../ui/AppText';

/* ─────────────────────────────────────────────────────────────
 * Pure-JS date & time pickers (no native dependency).
 * Presented as a bottom-sheet wheel picker, matching FormSelect.
 * Values are plain strings so the backend contract is unchanged:
 *   - Date  → "DD/MM/YYYY"
 *   - Time  → "hh:mm AM" / "hh:mm PM"
 * ───────────────────────────────────────────────────────────── */

const ITEM_HEIGHT = 44;
const VISIBLE = 5; // odd → one centred row

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

const pad2 = (n: number): string => String(n).padStart(2, '0');

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const daysInMonth = (month0: number, year: number): number =>
  new Date(year, month0 + 1, 0).getDate();

/* ── A single scrollable wheel column ── */
function WheelColumn({
  labels,
  index,
  onChange,
  flex,
}: {
  labels: string[];
  index: number;
  onChange: (i: number) => void;
  flex: number;
}): React.JSX.Element {
  const { theme } = useAppTheme();
  const ref = useRef<ScrollView>(null);
  const didInit = useRef(false);
  const padV = ((VISIBLE - 1) / 2) * ITEM_HEIGHT;

  // Keep the wheel aligned to the active index when it changes from the
  // outside (e.g. the sheet is reopened, or a day clamps after a month switch).
  useEffect(() => {
    if (didInit.current) {
      ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    }
  }, [index]);

  const handleEnd = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const i = clamp(
      Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT),
      0,
      labels.length - 1,
    );
    if (i !== index) onChange(i);
    // re-snap exactly (covers clamping at the ends)
    ref.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
  };

  return (
    <ScrollView
      ref={ref}
      style={{ flex, height: ITEM_HEIGHT * VISIBLE }}
      contentContainerStyle={{ paddingVertical: padV }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      nestedScrollEnabled
      onMomentumScrollEnd={handleEnd}
      onScrollEndDrag={handleEnd}
      onLayout={() => {
        if (didInit.current) return;
        didInit.current = true;
        ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
      }}
    >
      {labels.map((label, i) => {
        const selected = i === index;
        return (
          <TouchableOpacity
            key={`${label}-${i}`}
            activeOpacity={0.7}
            onPress={() => {
              onChange(i);
              ref.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
            }}
            style={styles.wheelItem}
          >
            <AppText
              style={{
                fontSize: selected ? 20 : 16,
                fontWeight: selected ? '800' : '400',
                color: selected ? theme.colors.primary : theme.colors.mutedText,
              }}
            >
              {label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ── Bottom-sheet shell with selection highlight ── */
function PickerSheet({
  visible,
  title,
  onCancel,
  onDone,
  children,
}: {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onDone: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const { theme } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={onCancel} hitSlop={8}>
              <AppText variant="body" color={theme.colors.mutedText}>Cancel</AppText>
            </TouchableOpacity>
            <AppText variant="label" style={{ flexShrink: 1, marginHorizontal: 8, textAlign: 'center' }}>{title}</AppText>
            <TouchableOpacity onPress={onDone} hitSlop={8}>
              <AppText variant="body" color={theme.colors.primary}>Done</AppText>
            </TouchableOpacity>
          </View>

          <View style={styles.wheelArea}>
            {/* centred selection band */}
            <View
              pointerEvents="none"
              style={[
                styles.selectionBand,
                {
                  top: ((VISIBLE - 1) / 2) * ITEM_HEIGHT,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.primary + '10',
                },
              ]}
            />
            <View style={styles.wheelRow}>{children}</View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Field selector button (shared look with FormSelect) ── */
function FieldButton({
  label,
  display,
  placeholder,
  errorText,
  onPress,
  style,
}: {
  label: string;
  display: string;
  placeholder: string;
  errorText?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.container, style]}>
      <AppText variant="caption" style={[styles.label, { color: theme.colors.mutedText }]}>
        {label}
      </AppText>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          styles.selector,
          {
            backgroundColor: theme.colors.card,
            borderColor: errorText ? theme.colors.danger : theme.colors.border,
          },
        ]}
      >
        <AppText
          variant="body"
          color={display ? theme.colors.text : theme.colors.mutedText}
          style={styles.selectorText}
          numberOfLines={1}
        >
          {display || placeholder}
        </AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>▾</AppText>
      </TouchableOpacity>
      {errorText ? (
        <AppText variant="caption" color={theme.colors.danger} style={styles.error}>
          {errorText}
        </AppText>
      ) : null}
    </View>
  );
}

/* ════════════════════════ DATE PICKER ════════════════════════ */

interface FormDatePickerProps {
  label: string;
  value: string; // "DD/MM/YYYY"
  onChange: (value: string) => void;
  placeholder?: string;
  errorText?: string;
  /** earliest selectable year offset from now (default 0 = this year) */
  minYearOffset?: number;
  /** latest selectable year offset from now (default +2) */
  maxYearOffset?: number;
  style?: StyleProp<ViewStyle>;
}

const parseDate = (v: string): { d: number; m: number; y: number } | null => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((v ?? '').trim());
  if (!match) return null;
  return { d: Number(match[1]), m: Number(match[2]) - 1, y: Number(match[3]) };
};

export const FormDatePicker = ({
  label,
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  errorText,
  minYearOffset = 0,
  maxYearOffset = 2,
  style,
}: FormDatePickerProps): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const baseYear = now.getFullYear();
  const years = useMemo(
    () =>
      Array.from(
        { length: maxYearOffset - minYearOffset + 1 },
        (_, i) => baseYear + minYearOffset + i,
      ),
    [baseYear, minYearOffset, maxYearOffset],
  );

  const initial = parseDate(value) ?? { d: now.getDate(), m: now.getMonth(), y: baseYear };
  const [day, setDay] = useState(initial.d);
  const [month, setMonth] = useState(initial.m);
  const [year, setYear] = useState(years.includes(initial.y) ? initial.y : years[0]);

  const openSheet = (): void => {
    const cur = parseDate(value) ?? { d: now.getDate(), m: now.getMonth(), y: baseYear };
    setDay(cur.d);
    setMonth(cur.m);
    setYear(years.includes(cur.y) ? cur.y : years[0]);
    setOpen(true);
  };

  const dim = daysInMonth(month, year);
  const safeDay = clamp(day, 1, dim);
  const dayLabels = Array.from({ length: dim }, (_, i) => pad2(i + 1));
  const monthLabels = MONTHS_SHORT;
  const yearLabels = years.map(String);

  const confirm = (): void => {
    onChange(`${pad2(safeDay)}/${pad2(month + 1)}/${year}`);
    setOpen(false);
  };

  const display = value ? value : '';

  return (
    <>
      <FieldButton
        label={label}
        display={display}
        placeholder={placeholder}
        errorText={errorText}
        onPress={openSheet}
        style={style}
      />
      <PickerSheet
        visible={open}
        title={label}
        onCancel={() => setOpen(false)}
        onDone={confirm}
      >
        <WheelColumn
          labels={dayLabels}
          index={safeDay - 1}
          onChange={(i) => setDay(i + 1)}
          flex={1}
        />
        <WheelColumn
          labels={monthLabels}
          index={month}
          onChange={setMonth}
          flex={1.2}
        />
        <WheelColumn
          labels={yearLabels}
          index={Math.max(0, years.indexOf(year))}
          onChange={(i) => setYear(years[i])}
          flex={1.2}
        />
      </PickerSheet>
    </>
  );
};

/* ════════════════════════ TIME PICKER ════════════════════════ */

interface FormTimePickerProps {
  label: string;
  value: string; // "hh:mm AM"
  onChange: (value: string) => void;
  placeholder?: string;
  errorText?: string;
  /** minute step (default 5) */
  step?: number;
  style?: StyleProp<ViewStyle>;
}

const parseTime = (
  v: string,
  step: number,
): { h: number; m: number; pm: boolean } | null => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((v ?? '').trim());
  if (!match) return null;
  const h = clamp(Number(match[1]), 1, 12);
  const m = clamp(Math.round(Number(match[2]) / step) * step, 0, 59);
  return { h, m, pm: match[3].toUpperCase() === 'PM' };
};

export const FormTimePicker = ({
  label,
  value,
  onChange,
  placeholder = '--:-- --',
  errorText,
  step = 5,
  style,
}: FormTimePickerProps): React.JSX.Element => {
  const [open, setOpen] = useState(false);

  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step),
    [step],
  );
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const fallback = { h: 9, m: 0, pm: false };

  const initial = parseTime(value, step) ?? fallback;
  const [hour, setHour] = useState(initial.h);
  const [minute, setMinute] = useState(initial.m);
  const [pm, setPm] = useState(initial.pm);

  const openSheet = (): void => {
    const cur = parseTime(value, step) ?? fallback;
    setHour(cur.h);
    setMinute(cur.m);
    setPm(cur.pm);
    setOpen(true);
  };

  const minuteIndex = Math.max(
    0,
    minutes.indexOf(minutes.reduce((a, b) => (Math.abs(b - minute) < Math.abs(a - minute) ? b : a), minutes[0])),
  );

  const confirm = (): void => {
    onChange(`${pad2(hour)}:${pad2(minutes[minuteIndex])} ${pm ? 'PM' : 'AM'}`);
    setOpen(false);
  };

  return (
    <>
      <FieldButton
        label={label}
        display={value || ''}
        placeholder={placeholder}
        errorText={errorText}
        onPress={openSheet}
        style={style}
      />
      <PickerSheet
        visible={open}
        title={label}
        onCancel={() => setOpen(false)}
        onDone={confirm}
      >
        <WheelColumn
          labels={hours.map((h) => pad2(h))}
          index={hour - 1}
          onChange={(i) => setHour(hours[i])}
          flex={1}
        />
        <WheelColumn
          labels={minutes.map((m) => pad2(m))}
          index={minuteIndex}
          onChange={(i) => setMinute(minutes[i])}
          flex={1}
        />
        <WheelColumn
          labels={['AM', 'PM']}
          index={pm ? 1 : 0}
          onChange={(i) => setPm(i === 1)}
          flex={1}
        />
      </PickerSheet>
    </>
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
  wheelArea: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  wheelRow: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * VISIBLE,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionBand: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
