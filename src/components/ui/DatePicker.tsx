import { useState } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius, font } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function iso(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function startOfDay(dt: Date) { return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); }

/** Pure-JS calendar date picker (no native module). Value is `YYYY-MM-DD`. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Select a date',
  minToday = true,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minToday?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value && /^\d{4}-\d{2}-\d{2}/.test(value) ? new Date(value + 'T00:00:00') : null;
  const [view, setView] = useState(() => (selected ? new Date(selected) : new Date()));

  const today = startOfDay(new Date());
  const y = view.getFullYear();
  const m = view.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function pick(d: number) {
    onChange(iso(y, m, d));
    setOpen(false);
  }

  const label = selected
    ? `${selected.getDate()} ${MONTHS[selected.getMonth()].slice(0, 3)} ${selected.getFullYear()}`
    : placeholder;

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Icon name="calendar-outline" size={18} color={colors.inkFaint} />
        <AppText style={[styles.fieldText, !selected && { color: colors.inkFaint }]}>{label}</AppText>
        <Icon name="chevron-down" size={18} color={colors.inkFaint} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.card}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setView(new Date(y, m - 1, 1))} hitSlop={10}>
                <Icon name="chevron-back" size={22} color={colors.primary} />
              </TouchableOpacity>
              <AppText style={styles.monthLabel}>{MONTHS[m]} {y}</AppText>
              <TouchableOpacity onPress={() => setView(new Date(y, m + 1, 1))} hitSlop={10}>
                <Icon name="chevron-forward" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => <AppText key={w} style={styles.weekday}>{w}</AppText>)}
            </View>

            <ScrollView>
              <View style={styles.grid}>
                {cells.map((d, i) => {
                  if (d == null) return <View key={`b${i}`} style={styles.cell} />;
                  const cellDate = startOfDay(new Date(y, m, d));
                  const disabled = minToday && cellDate < today;
                  const isSel = selected && selected.getFullYear() === y && selected.getMonth() === m && selected.getDate() === d;
                  const isToday = cellDate.getTime() === today.getTime();
                  return (
                    <TouchableOpacity
                      key={d}
                      style={styles.cell}
                      disabled={disabled}
                      onPress={() => pick(d)}
                    >
                      <View style={[styles.dayCircle, isSel && styles.daySelected, isToday && !isSel && styles.dayToday]}>
                        <AppText style={[styles.dayText, isSel && styles.dayTextSel, disabled && styles.dayDisabled]}>{d}</AppText>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.todayBtn} onPress={() => { const t = new Date(); onChange(iso(t.getFullYear(), t.getMonth(), t.getDate())); setOpen(false); }}>
              <AppText style={styles.todayText}>Today</AppText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 13,
  },
  fieldText: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthLabel: { fontFamily: font.semibold, fontSize: 16, color: colors.ink },
  weekRow: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: font.medium, fontSize: 12, color: colors.inkFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayText: { fontFamily: font.regular, fontSize: 14, color: colors.ink },
  dayTextSel: { color: colors.white, fontFamily: font.semibold },
  dayDisabled: { color: colors.border },
  todayBtn: { marginTop: spacing.md, alignItems: 'center', paddingVertical: 8 },
  todayText: { fontFamily: font.semibold, fontSize: 14, color: colors.primary },
});
