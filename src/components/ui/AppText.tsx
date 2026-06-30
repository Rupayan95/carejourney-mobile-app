import { Text, TextProps, StyleSheet } from 'react-native';
import { type as typePresets } from '../../theme';

type Variant = keyof typeof typePresets;

export function AppText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: Variant }) {
  return <Text {...props} style={[typePresets[variant], style]} />;
}

/** Convenience: a default-Inter Text for one-off labels. */
export const styles = StyleSheet.create({});
