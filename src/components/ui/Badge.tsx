import { View, StyleSheet } from 'react-native';
import { radius, font, statusColors } from '../../theme';
import { AppText } from './AppText';

export function Badge({
  label,
  color,
  tint,
}: {
  label: string;
  color: string;
  tint: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: tint }]}>
      <AppText style={[styles.text, { color }]}>{label}</AppText>
    </View>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const { color, tint } = statusColors(status);
  const label = (status ?? 'unknown').replace(/_/g, ' ');
  return <Badge label={label} color={color} tint={tint} />;
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: font.semibold,
    fontSize: 11,
    textTransform: 'capitalize',
  },
});
