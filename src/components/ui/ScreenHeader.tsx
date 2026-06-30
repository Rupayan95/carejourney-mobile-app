import { View, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, font, shadow } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

/** Solid teal header band with optional back button, subtitle, and right action. */
export function ScreenHeader({
  title,
  subtitle,
  back = true,
  onBack,
  rightIcon,
  onRightPress,
  rightLabel,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  rightIcon?: IconName;
  onRightPress?: () => void;
  rightLabel?: string;
}) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <StatusBar barStyle="light-content" />
      <View style={styles.row}>
        {back ? (
          <TouchableOpacity
            onPress={onBack ?? (() => router.back())}
            hitSlop={10}
            style={styles.side}
          >
            <Icon name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.side} />
        )}

        <View style={styles.center}>
          <AppText style={styles.title} numberOfLines={1}>{title}</AppText>
          {subtitle ? <AppText style={styles.subtitle} numberOfLines={1}>{subtitle}</AppText> : null}
        </View>

        {rightLabel ? (
          <TouchableOpacity onPress={onRightPress} hitSlop={10} style={styles.side}>
            <AppText style={styles.rightLabel}>{rightLabel}</AppText>
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity onPress={onRightPress} hitSlop={10} style={[styles.side, { alignItems: 'flex-end' }]}>
            <Icon name={rightIcon} size={22} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.side} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: spacing.lg,
    ...shadow.header,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  side: { width: 60, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center' },
  title: { fontFamily: font.semibold, fontSize: 17, color: colors.white },
  subtitle: { fontFamily: font.regular, fontSize: 12, color: '#CDE7EE', marginTop: 1 },
  rightLabel: { fontFamily: font.semibold, fontSize: 14, color: colors.white, textAlign: 'right' },
});
