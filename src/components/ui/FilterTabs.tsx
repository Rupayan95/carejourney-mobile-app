import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, font } from '../../theme';
import { AppText } from './AppText';

/** Horizontal pill filter row (e.g. status filters). */
export function FilterTabs({
  options,
  value,
  onChange,
  labels,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <AppText style={[styles.text, active && styles.textActive]}>
              {labels?.[opt] ?? opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' ')}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft },
  textActive: { color: colors.white, fontFamily: font.semibold },
});
