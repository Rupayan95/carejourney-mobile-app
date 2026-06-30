import { View, StyleSheet } from 'react-native';
import { colors, spacing, font } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  subtitle,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={30} color={colors.inkFaint} />
      </View>
      <AppText style={styles.title}>{title}</AppText>
      {subtitle ? <AppText style={styles.subtitle}>{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: spacing.xl },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontFamily: font.semibold, fontSize: 16, color: colors.inkSoft, textAlign: 'center' },
  subtitle: { fontFamily: font.regular, fontSize: 13, color: colors.inkFaint, textAlign: 'center', marginTop: 4 },
});
