import { colors } from '../../src/theme';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePrescriptionDetail } from '../../src/hooks/usePrescriptionDetail';

const STATUS_COLOR: Record<string, string> = {
  active: colors.success, draft: '#888', filled: colors.primary,
  cancelled: colors.danger, archived: '#aaa',
};

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: rx, isLoading } = usePrescriptionDetail(id);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!rx) {
    return <View style={styles.center}><Text style={styles.error}>Prescription not found</Text></View>;
  }

  const statusColor = STATUS_COLOR[rx.status] ?? '#888';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Status header */}
      <View style={styles.statusHeader}>
        <Text style={styles.rxTitle}>💊 Prescription</Text>
        <View style={[styles.badge, { backgroundColor: statusColor + '30' }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{rx.status}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Created: {new Date(rx.created_at).toLocaleDateString()}</Text>
        {rx.valid_until && (
          <Text style={styles.metaText}>Valid until: {new Date(rx.valid_until).toLocaleDateString()}</Text>
        )}
        <Text style={styles.metaText}>Refills: {rx.refills_allowed}</Text>
      </View>

      {/* Medications */}
      <Section title="Medications">
        {rx.medications?.length === 0
          ? <Text style={styles.empty}>No medications listed</Text>
          : rx.medications?.map((med: any, i: number) => (
            <View key={i} style={styles.medCard}>
              <View style={styles.medHeader}>
                <Text style={styles.medName}>{med.medication_name}</Text>
                {med.generic_name && <Text style={styles.medGeneric}>{med.generic_name}</Text>}
              </View>
              <View style={styles.medGrid}>
                {med.strength && <MedDetail label="Strength" value={med.strength} />}
                {med.route && <MedDetail label="Route" value={med.route} />}
                {med.frequency && <MedDetail label="Frequency" value={med.frequency} />}
                {med.duration && <MedDetail label="Duration" value={med.duration} />}
                {med.quantity && <MedDetail label="Quantity" value={String(med.quantity)} />}
              </View>
              {med.special_instructions && (
                <View style={styles.instructionsBox}>
                  <Text style={styles.instructionsLabel}>Instructions</Text>
                  <Text style={styles.instructionsText}>{med.special_instructions}</Text>
                </View>
              )}
            </View>
          ))
        }
      </Section>

      {/* Safety Check */}
      {rx.safety_check && (
        <Section title="Safety Check">
          <View style={styles.safetyRow}>
            <SafetyItem label="Allergies" checked={rx.safety_check.allergies_checked} />
            <SafetyItem label="Interactions" checked={rx.safety_check.interactions_checked} />
            <SafetyItem label="Contraindications" checked={rx.safety_check.contraindications_checked} />
          </View>
          {rx.safety_check.warnings?.length > 0 && (
            <View style={styles.warningsBox}>
              <Text style={styles.warningsTitle}>⚠️ Warnings</Text>
              {rx.safety_check.warnings.map((w: any, i: number) => (
                <Text key={i} style={styles.warningItem}>• {w.message ?? JSON.stringify(w)}</Text>
              ))}
            </View>
          )}
        </Section>
      )}

      {/* Dispensing */}
      {rx.dispensing && (
        <Section title="Dispensing">
          <InfoRow label="Dispensed" value={rx.dispensing.dispensed ? 'Yes' : 'No'} />
          {rx.dispensing.dispensed_date && (
            <InfoRow label="Date" value={new Date(rx.dispensing.dispensed_date).toLocaleDateString()} />
          )}
          {rx.dispensing.pharmacy_name && (
            <InfoRow label="Pharmacy" value={rx.dispensing.pharmacy_name} />
          )}
          {rx.dispensing.dispensed_by && (
            <InfoRow label="Dispensed by" value={rx.dispensing.dispensed_by} />
          )}
        </Section>
      )}

      {/* Notes */}
      {rx.notes && (
        <Section title="Notes">
          <Text style={styles.notesText}>{rx.notes}</Text>
        </Section>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MedDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.medDetail}>
      <Text style={styles.medDetailLabel}>{label}</Text>
      <Text style={styles.medDetailValue}>{value}</Text>
    </View>
  );
}

function SafetyItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <View style={styles.safetyItem}>
      <Text style={{ fontSize: 16 }}>{checked ? '✅' : '⬜'}</Text>
      <Text style={styles.safetyLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: colors.danger, fontSize: 15 },
  statusHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', padding: 16, marginBottom: 4,
  },
  rxTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  badge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  metaRow: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14,
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8,
  },
  metaText: { fontSize: 12, color: '#888' },
  section: { backgroundColor: '#fff', marginBottom: 8, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  medCard: {
    borderWidth: 1, borderColor: colors.primaryTint, borderRadius: 12, padding: 14,
    marginBottom: 12, backgroundColor: colors.surfaceAlt,
  },
  medHeader: { marginBottom: 10 },
  medName: { fontSize: 16, fontWeight: '700', color: '#111' },
  medGeneric: { fontSize: 13, color: '#666', marginTop: 2, fontStyle: 'italic' },
  medGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  medDetail: {
    backgroundColor: colors.primaryTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  medDetailLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: '600' },
  medDetailValue: { fontSize: 13, color: '#111', fontWeight: '600', marginTop: 1, textTransform: 'capitalize' },
  instructionsBox: { backgroundColor: colors.warningTint, borderRadius: 8, padding: 10, marginTop: 4 },
  instructionsLabel: { fontSize: 11, fontWeight: '700', color: colors.warning, marginBottom: 3 },
  instructionsText: { fontSize: 13, color: colors.warning },
  safetyRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  safetyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  safetyLabel: { fontSize: 13, color: '#333' },
  warningsBox: { backgroundColor: colors.warningTint, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: colors.warning },
  warningsTitle: { fontSize: 13, fontWeight: '700', color: colors.warning, marginBottom: 6 },
  warningItem: { fontSize: 13, color: colors.warning, marginTop: 3 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 13, color: '#111', fontWeight: '500' },
  notesText: { fontSize: 14, color: '#333', lineHeight: 20 },
  empty: { color: '#aaa', fontSize: 13, fontStyle: 'italic' },
});
