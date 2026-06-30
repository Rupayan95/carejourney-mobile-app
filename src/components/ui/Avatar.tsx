import { View, StyleSheet } from 'react-native';
import { colors, font } from '../../theme';
import { AppText } from './AppText';

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function Avatar({ name, size = 44, tint }: { name?: string; size?: number; tint?: string }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint ?? colors.primaryTint },
      ]}
    >
      <AppText style={[styles.text, { fontSize: size * 0.38, color: colors.primaryDeep }]}>
        {initials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: font.bold },
});
