import { useState } from 'react';
import {
  View, Image, StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { saveTokens } from '../../src/lib/auth';
import { useUser } from '../../src/context/UserContext';
import { api } from '../../src/lib/api';
import { colors, spacing, radius, font, shadow } from '../../src/theme';
import { AppText, Button, Input, Icon } from '../../src/components/ui';

export default function LoginScreen() {
  const router = useRouter();
  const { reload } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { data } = res.data;
      if (data.mfa_required) {
        router.push({ pathname: '/(auth)/mfa', params: { mfa_token: data.mfa_token } });
      } else {
        await saveTokens(data.access_token, data.refresh_token);
        await reload();
        router.replace('/(tabs)/dashboard');
      }
    } catch (err: any) {
      let msg: string;
      if (!err?.response) {
        msg = `Cannot reach the server at ${api.defaults.baseURL}.\n\n${err?.message ?? ''}`;
      } else {
        const detail = err.response.data?.detail;
        msg = Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join('\n')
          : (detail ?? `Login failed (HTTP ${err.response.status}).`);
      }
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Image source={require('../../assets/care-journey-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <AppText style={styles.brand}>CareJourney</AppText>
          <AppText style={styles.brandSub}>Clinical Workspace</AppText>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <AppText style={styles.heading}>Welcome back</AppText>
          <AppText style={styles.subheading}>Sign in to your staff portal</AppText>

          <Input
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@hospital.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            containerStyle={{ marginBottom: spacing.lg }}
          />
          <Input
            label="Password"
            icon="lock-closed-outline"
            password
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            autoComplete="password"
            containerStyle={{ marginBottom: spacing.xl }}
          />

          <Button label={loading ? 'Signing in…' : 'Sign In'} icon={loading ? undefined : 'log-in-outline'} onPress={handleLogin} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Icon name="shield-checkmark-outline" size={14} color={colors.inkFaint} />
          <AppText style={styles.footerText}>HIPAA-compliant · Encrypted connection</AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  hero: {
    backgroundColor: colors.primary,
    paddingTop: 80,
    paddingBottom: 64,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...shadow.header,
  },
  logoBadge: {
    width: 92, height: 92, borderRadius: 24, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, ...shadow.card,
  },
  logo: { width: 64, height: 64 },
  brand: { fontFamily: font.bold, fontSize: 26, color: colors.white },
  brandSub: { fontFamily: font.regular, fontSize: 14, color: '#CDE7EE', marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: -32,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  heading: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  subheading: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, marginTop: 2, marginBottom: spacing.xl },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xl },
  footerText: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint },
});
