import { TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, font } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

type Variant = 'primary' | 'outline' | 'success' | 'danger' | 'ghost';
type Size = 'md' | 'sm';

const BG: Record<Variant, string> = {
  primary: colors.primary,
  success: colors.success,
  danger: colors.danger,
  outline: colors.surface,
  ghost: 'transparent',
};
const FG: Record<Variant, string> = {
  primary: colors.white,
  success: colors.white,
  danger: colors.white,
  outline: colors.primary,
  ghost: colors.primary,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  style,
  fullWidth = true,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}) {
  const isOutline = variant === 'outline';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: BG[variant] },
        isOutline && styles.outline,
        fullWidth && { alignSelf: 'stretch' },
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} size="small" />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} color={FG[variant]} />}
          <AppText
            style={{
              color: FG[variant],
              fontFamily: font.semibold,
              fontSize: size === 'sm' ? 13 : 15,
            }}
          >
            {label}
          </AppText>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  md: { paddingVertical: 14, paddingHorizontal: spacing.lg },
  sm: { paddingVertical: 8, paddingHorizontal: spacing.md },
  outline: { borderWidth: 1.5, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
});
