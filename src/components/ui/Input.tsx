import { useState } from 'react';
import { View, TextInput, TextInputProps, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, font } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export function Input({
  label,
  icon,
  password,
  style,
  containerStyle,
  ...props
}: TextInputProps & {
  label?: string;
  icon?: IconName;
  password?: boolean;
  containerStyle?: any;
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!password);

  return (
    <View style={containerStyle}>
      {label && <AppText style={styles.label}>{label}</AppText>}
      <View style={[styles.field, focused && styles.fieldFocused]}>
        {icon && <Icon name={icon} size={18} color={focused ? colors.primary : colors.inkFaint} />}
        <TextInput
          {...props}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={colors.inkFaint}
          style={[styles.input, style]}
        />
        {password && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: font.regular,
    color: colors.ink,
  },
});
