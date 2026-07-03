import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font, shadow } from '../../src/theme';
import { AppText, Icon, ScreenHeader } from '../../src/components/ui';
import { IconName } from '../../src/components/ui/Icon';

const METHODS: { key: string; icon: IconName; title: string; desc: string; route: string; tint: string }[] = [
  { key: 'manual', icon: 'create-outline', title: 'Manual Entry', desc: 'Fill in the patient details by hand.', route: '/register/manual', tint: colors.primaryTint },
  { key: 'live', icon: 'mic-outline', title: 'Live Intake', desc: 'Record the conversation — AI fills the form.', route: '/register/live-intake', tint: colors.successTint },
  { key: 'ocr', icon: 'document-attach-outline', title: 'Document & OCR', desc: 'Scan an ID or form — AI reads the details.', route: '/register/doc-ocr', tint: colors.warningTint },
];

export default function RegisterMethodsScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Register Patient" subtitle="Choose a method" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <AppText style={styles.lead}>How would you like to register this patient?</AppText>
        {METHODS.map((m) => (
          <TouchableOpacity key={m.key} style={styles.card} activeOpacity={0.85} onPress={() => router.push(m.route as any)}>
            <View style={[styles.iconWrap, { backgroundColor: m.tint }]}>
              <Icon name={m.icon} size={26} color={colors.primaryDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.title}>{m.title}</AppText>
              <AppText style={styles.desc}>{m.desc}</AppText>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.inkFaint} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, marginBottom: spacing.lg },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.lg, marginBottom: spacing.md, ...shadow.card,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.semibold, fontSize: 16, color: colors.ink },
  desc: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
});
