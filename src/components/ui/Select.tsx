import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, font } from '../../theme';
import { AppText } from './AppText';

export interface Option { label: string; value: string }

/** Compact single-select rendered as a horizontal row of pills. */
export function Select({
  label,
  options,
  value,
  onChange,
  containerStyle,
}: {
  label?: string;
  options: Option[];
  value?: string;
  onChange: (v: string) => void;
  containerStyle?: any;
}) {
  return (
    <View style={containerStyle}>
      {label && <AppText style={styles.label}>{label}</AppText>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <TouchableOpacity
              key={o.value}
              onPress={() => onChange(active ? '' : o.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <AppText style={[styles.text, active && styles.textActive]}>{o.label}</AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
  row: { gap: spacing.sm, paddingRight: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft },
  textActive: { color: colors.white },
});
