import { useState } from 'react';
import {
  View, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { saveTokens } from '../../src/lib/auth';
import { useUser } from '../../src/context/UserContext';
import { api } from '../../src/lib/api';
import { colors, spacing, radius, font, shadow } from '../../src/theme';
import { AppText, Button, Icon } from '../../src/components/ui';

export default function MFAScreen() {
  const router = useRouter();
  const { reload } = useUser();
  const { mfa_token } = useLocalSearchParams<{ mfa_token: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (code.length < 6) {
      Alert.alert('Enter code', 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/mfa/verify', { mfa_token, code });
      const { data } = res.data;
      await saveTokens(data.access_token, data.refresh_token);
      await reload();
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid code. Try again.';
      Alert.alert('Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.iconCircle}>
        <Icon name="shield-checkmark" size={34} color={colors.primary} />
      </View>
      <AppText style={styles.title}>Two-Factor Authentication</AppText>
      <AppText style={styles.subtitle}>Enter the 6-digit code from your authenticator app.</AppText>

      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={setCode}
        placeholder="000000"
        placeholderTextColor={colors.inkFaint}
        keyboardType="number-pad"
        maxLength={8}
        textAlign="center"
      />

      <Button label={loading ? 'Verifying…' : 'Verify'} onPress={handleVerify} loading={loading} style={{ marginTop: spacing.xl }} />

      <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.back}>
        <AppText style={styles.backText}>← Back to login</AppText>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 28 },
  iconCircle: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.lg, ...shadow.card,
  },
  title: { fontFamily: font.bold, fontSize: 22, color: colors.ink, textAlign: 'center' },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  codeInput: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: 16,
    fontSize: 26, fontFamily: font.bold, color: colors.ink, letterSpacing: 8, backgroundColor: colors.surface,
  },
  back: { marginTop: spacing.xl, alignItems: 'center' },
  backText: { fontFamily: font.medium, color: colors.primary, fontSize: 14 },
});
