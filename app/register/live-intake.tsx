import { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '../../src/context/UserContext';
import { useIntake, IntakeLanguage } from '../../src/hooks/useIntake';
import { useState } from 'react';
import { colors, spacing, radius, font, shadow } from '../../src/theme';
import { AppText, Button, Icon, ScreenHeader } from '../../src/components/ui';

export default function LiveIntakeScreen() {
  const router = useRouter();
  const { user } = useUser();
  const intake = useIntake(user?.organization_id);
  const [lang, setLang] = useState<IntakeLanguage>('english');

  const busy = ['starting', 'stopping', 'extracting'].includes(intake.status);

  // When extraction is done, hand off to the manual form prefilled.
  useEffect(() => {
    if (intake.status === 'done') { /* handled in onStop */ }
  }, [intake.status]);

  async function handleStop() {
    const result = await intake.stop();
    if (result?.data) {
      router.replace({
        pathname: '/register/manual',
        params: { prefill: JSON.stringify(result.data), intake_session_id: result.sessionId },
      });
      intake.reset();
    } else if (intake.error) {
      // stay on screen; error shown below
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Live Intake" subtitle="AI-assisted registration" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.hero}>
          <View style={[styles.mic, intake.status === 'active' && styles.micActive]}>
            <Icon name="mic" size={40} color={intake.status === 'active' ? colors.white : colors.primary} />
          </View>
          <AppText style={styles.status}>
            {intake.status === 'active' ? 'Listening…'
              : intake.status === 'extracting' ? 'Extracting patient details…'
              : intake.status === 'stopping' ? 'Finalizing…'
              : intake.status === 'starting' ? 'Starting…'
              : 'Ready to record'}
          </AppText>
          {intake.status === 'active' && (
            <AppText style={styles.timer}>
              {Math.floor(intake.elapsed / 60)}:{String(intake.elapsed % 60).padStart(2, '0')}
            </AppText>
          )}
        </View>

        {intake.status !== 'active' && !busy && (
          <View style={styles.langRow}>
            {(['english', 'bengali'] as IntakeLanguage[]).map((l) => (
              <Button
                key={l}
                label={l === 'english' ? 'English' : 'বাংলা'}
                variant={lang === l ? 'primary' : 'outline'}
                size="sm"
                fullWidth={false}
                onPress={() => setLang(l)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        )}

        {intake.status === 'active' ? (
          <Button label="Stop & Extract" icon="stop" variant="danger" onPress={handleStop} />
        ) : (
          <Button
            label={busy ? 'Please wait…' : 'Start Recording'}
            icon={busy ? undefined : 'mic'}
            onPress={() => intake.start(lang)}
            loading={busy}
          />
        )}

        <AppText style={styles.hint}>
          Speak with the patient naturally — name, date of birth, phone, address, allergies, etc.
          When you stop, AI extracts the details and opens the registration form pre-filled for review.
        </AppText>

        {!!intake.transcript && (
          <View style={styles.transcriptCard}>
            <AppText style={styles.transcriptLabel}>Live transcript</AppText>
            <AppText style={styles.transcript}>{intake.transcript}</AppText>
          </View>
        )}

        {!!intake.error && intake.status === 'error' && (
          <AppText style={styles.error}>{intake.error}</AppText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  mic: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  micActive: { backgroundColor: colors.danger },
  status: { fontFamily: font.semibold, fontSize: 16, color: colors.ink, marginTop: spacing.lg },
  timer: { fontFamily: font.bold, fontSize: 26, color: colors.danger, marginTop: 4 },
  langRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  hint: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, lineHeight: 19, marginTop: spacing.lg },
  transcriptCard: {
    marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md,
  },
  transcriptLabel: { fontFamily: font.semibold, fontSize: 12, color: colors.inkFaint, marginBottom: 4 },
  transcript: { fontFamily: font.regular, fontSize: 13, color: colors.ink, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md, fontFamily: font.regular },
});
