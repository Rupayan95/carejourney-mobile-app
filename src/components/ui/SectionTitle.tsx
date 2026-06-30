import { View, StyleSheet } from 'react-native';
import { colors, spacing, font } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export function SectionTitle({
  title,
  icon,
  style,
}: {
  title: string;
  icon?: IconName;
  style?: any;
}) {
  return (
    <View style={[styles.row, style]}>
      {icon && <Icon name={icon} size={16} color={colors.primary} />}
      <AppText style={styles.text}>{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  text: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
});
