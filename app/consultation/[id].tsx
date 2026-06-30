import { colors } from '../../src/theme';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useConsultation } from '../../src/hooks/useConsultations';

const STATUS_COLOR: Record<string, string> = {
  in_progress: colors.warning, completed: colors.success, cancelled: colors.danger, scheduled: colors.primary,
};

export default function ConsultationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: c, isLoading } = useConsultation(id);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!c) {
    return <View style={styles.center}><Text style={styles.error}>Consultation not found</Text></View>;
  }

  const notes = c.clinical_notes ?? {};
  const s = notes.subjective ?? {};
  const o = notes.objective ?? {};
  const a = notes.assessment ?? {};
  const p = notes.plan ?? {};
  const vs = o.vital_signs ?? {};
  const status = c.status ?? 'unknown';
  const color = STATUS_COLOR[status] ?? '#888';

  const bp = vs.blood_pressure;
  const bpStr = bp ? `${bp.systolic ?? ''}/${bp.diastolic ?? ''}` : '—';
  const o2 = vs.oxygen_saturation;
  const o2Str = o2 ? String(o2.value ?? o2) : '—';

  const cc = s.chief_complaint;
  const chiefComplaint = typeof cc === 'string' ? cc : (cc?.complaint ?? '—');

  const pd = a.primary_diagnosis;
  const diagnosis = typeof pd === 'string' ? pd : (pd?.description ?? '—');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Consultation</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={[styles.statusText, { color }]}>{status.replace(/_/g, ' ')}</Text>
          </View>
          <Text style={styles.typeText}>{(c.consultation_type ?? '').replace(/_/g, ' ')}</Text>
          <Text style={styles.dateText}>
            {c.start_time ? new Date(c.start_time).toLocaleString() : 'No start time'}
            {c.end_time ? ` → ${new Date(c.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </Text>
          {c.status === 'completed' && (
            <TouchableOpacity
              style={styles.rxBtn}
              onPress={() => router.push(`/consultation-review/${id}`)}
            >
              <Text style={styles.rxBtnText}>📋 View / Generate Prescription</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* S — Subjective */}
        <Section title="S — Subjective">
          <InfoRow label="Chief Complaint" value={chiefComplaint} />
          <InfoRow label="History of Present Illness" value={s.history_of_present_illness ?? '—'} multiline />
        </Section>

        {/* O — Objective */}
        <Section title="O — Objective">
          <View style={styles.vitalsGrid}>
            <Vital label="BP" value={bpStr} />
            <Vital label="HR" value={vs.heart_rate ? `${vs.heart_rate} bpm` : '—'} />
            <Vital label="Temp" value={vs.temperature ? `${vs.temperature}°C` : '—'} />
            <Vital label="O₂ Sat" value={o2Str !== '—' ? `${o2Str}%` : '—'} />
          </View>
          <InfoRow label="Physical Examination" value={o.physical_examination ?? '—'} multiline />
        </Section>

        {/* A — Assessment */}
        <Section title="A — Assessment">
          <InfoRow label="Primary Diagnosis" value={diagnosis} />
          <InfoRow label="Clinical Impression" value={a.clinical_impression ?? '—'} multiline />
        </Section>

        {/* P — Plan */}
        <Section title="P — Plan">
          {Array.isArray(p.immediate_actions) && p.immediate_actions.length > 0
            ? p.immediate_actions.map((action: string, i: number) => (
              <Text key={i} style={styles.planItem}>• {action}</Text>
            ))
            : <Text style={styles.empty}>No actions recorded</Text>
          }
          {p.follow_up?.next_visit && (
            <InfoRow label="Follow-up" value={new Date(p.follow_up.next_visit).toLocaleDateString()} />
          )}
        </Section>
      </ScrollView>
    </View>
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

function InfoRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, multiline && styles.infoValueMulti]}>{value}</Text>
    </View>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.vitalBox}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={styles.vitalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: colors.danger, fontSize: 15 },
  header: {
    backgroundColor: colors.primary, paddingTop: 52, paddingBottom: 14,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { minWidth: 50 },
  backText: { color: '#CDE7EE', fontSize: 14 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  statusCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  typeText: { fontSize: 13, color: '#555', textTransform: 'capitalize', marginBottom: 2 },
  dateText: { fontSize: 12, color: '#999' },
  rxBtn: {
    marginTop: 12, backgroundColor: colors.primaryTint, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  rxBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 12 },
  infoRow: { marginBottom: 12 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  infoValue: { fontSize: 14, color: '#111' },
  infoValueMulti: { lineHeight: 20 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  vitalBox: {
    width: '47%', backgroundColor: colors.primaryTint, borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  vitalLabel: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase' },
  vitalValue: { fontSize: 18, fontWeight: '700', color: colors.primary, marginTop: 4 },
  planItem: { fontSize: 14, color: '#333', marginBottom: 6, lineHeight: 20 },
  empty: { fontSize: 13, color: '#aaa', fontStyle: 'italic' },
});
