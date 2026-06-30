import { TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, font, radius, shadow } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export function Fab({
  onPress,
  label,
  icon = 'add',
}: {
  onPress: () => void;
  label?: string;
  icon?: IconName;
}) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.fab}>
      <Icon name={icon} size={20} color={colors.white} />
      {label ? <AppText style={styles.label}>{label}</AppText> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadow.fab,
  },
  label: { fontFamily: font.semibold, fontSize: 15, color: colors.white },
});
