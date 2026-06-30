import { colors } from '../../src/theme';
import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  usePatientDetail,
  usePatientConsultations,
  usePatientPrescriptions,
  usePatientAppointments,
} from '../../src/hooks/usePatientDetail';
import { parseBackendDate } from '../../src/lib/datetime';
import { printPrescriptionById } from '../../src/lib/prescription-print';

const TABS = ['Overview', 'Health Records', 'Encounters', 'Prescriptions', 'Appointments'];

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Overview');
  const { data: patient, isLoading } = usePatientDetail(id);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!patient) {
    return <View style={styles.center}><Text style={styles.error}>Patient not found</Text></View>;
  }

  const dob = patient.demographics?.date_of_birth
    ? new Date(patient.demographics.date_of_birth)
    : null;
  const age = dob
    ? Math.floor((Date.now() - dob.getTime()) / 3.156e10)
    : null;
  const fullName = `${patient.demographics?.first_name ?? ''} ${patient.demographics?.middle_name ? patient.demographics.middle_name + ' ' : ''}${patient.demographics?.last_name ?? ''}`.trim();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(patient.demographics?.first_name?.[0] ?? '') + (patient.demographics?.last_name?.[0] ?? '')}
          </Text>
        </View>
        <Text style={styles.patientName}>{fullName}</Text>
        <Text style={styles.patientMeta}>
          {patient.demographics?.gender ?? ''}{age ? ` · ${age}y` : ''}
          {patient.demographics?.blood_group ? ` · ${patient.demographics.blood_group}` : ''}
        </Text>
        <View style={[styles.statusBadge, patient.status === 'active' ? styles.activeStatus : styles.inactiveStatus]}>
          <Text style={styles.statusText}>{patient.status}</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {activeTab === 'Overview' && <OverviewTab patient={patient} />}
        {activeTab === 'Health Records' && <HealthRecordsTab patient={patient} />}
        {activeTab === 'Encounters' && <EncountersTab patientId={id} />}
        {activeTab === 'Prescriptions' && <PrescriptionsTab patientId={id} />}
        {activeTab === 'Appointments' && <AppointmentsTab patientId={id} />}
      </ScrollView>
    </View>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ patient }: { patient: any }) {
  const d = patient.demographics ?? {};
  const c = patient.contact ?? {};
  const flags = patient.patient_flags ?? [];

  return (
    <View style={styles.tabContent}>
      {flags.length > 0 && (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>⚠️ Patient Alerts</Text>
          {flags.map((f: any, i: number) => (
            <Text key={i} style={styles.alertItem}>• {f.flag_type}: {f.description}</Text>
          ))}
        </View>
      )}

      <Section title="Personal Information">
        <InfoRow label="Full Name" value={`${d.first_name ?? ''} ${d.last_name ?? ''}`} />
        <InfoRow label="Date of Birth" value={d.date_of_birth ? new Date(d.date_of_birth).toLocaleDateString() : '—'} />
        <InfoRow label="Gender" value={d.gender ?? '—'} />
        <InfoRow label="Blood Group" value={d.blood_group ?? '—'} />
        <InfoRow label="Marital Status" value={d.marital_status ?? '—'} />
        <InfoRow label="Nationality" value={d.nationality ?? '—'} />
      </Section>

      <Section title="Contact">
        <InfoRow label="Phone" value={c.phone_primary ?? '—'} />
        <InfoRow label="Email" value={c.email ?? '—'} />
        <InfoRow label="Address" value={[c.address_line1, c.city, c.state, c.country].filter(Boolean).join(', ') || '—'} />
      </Section>

      {patient.emergency_contacts?.length > 0 && (
        <Section title="Emergency Contacts">
          {patient.emergency_contacts.map((ec: any, i: number) => (
            <View key={i} style={styles.subCard}>
              <Text style={styles.subCardTitle}>{ec.name} ({ec.relationship})</Text>
              <Text style={styles.subCardMeta}>{ec.phone}</Text>
            </View>
          ))}
        </Section>
      )}

      <Section title="Visit Summary">
        <InfoRow label="Total Visits" value={String(patient.total_visits ?? 0)} />
        <InfoRow label="Last Visit" value={patient.last_visit_date ? new Date(patient.last_visit_date).toLocaleDateString() : '—'} />
        <InfoRow label="Registration" value={patient.registration_date ? new Date(patient.registration_date).toLocaleDateString() : '—'} />
      </Section>
    </View>
  );
}

// ── Health Records Tab ────────────────────────────────────────────────────────
function HealthRecordsTab({ patient }: { patient: any }) {
  const ms = patient.medical_summary ?? {};
  const allergies = patient.allergies ?? ms.allergies ?? [];

  return (
    <View style={styles.tabContent}>
      {/* Allergies */}
      <Section title="Allergies">
        {allergies.length === 0
          ? <Text style={styles.empty}>No known allergies</Text>
          : allergies.map((a: any, i: number) => (
            <View key={i} style={[styles.subCard, styles.allergyCard]}>
              <Text style={styles.subCardTitle}>{a.allergen}</Text>
              <Text style={styles.subCardMeta}>Reaction: {a.reaction ?? '—'} · Severity: {a.severity ?? '—'}</Text>
            </View>
          ))
        }
      </Section>

      {/* Chronic Conditions */}
      <Section title="Chronic Conditions">
        {(ms.chronic_conditions ?? []).length === 0
          ? <Text style={styles.empty}>None recorded</Text>
          : ms.chronic_conditions.map((c: any, i: number) => (
            <View key={i} style={styles.subCard}>
              <Text style={styles.subCardTitle}>{c.description ?? c.code}</Text>
              <Text style={styles.subCardMeta}>Status: {c.status ?? '—'}</Text>
            </View>
          ))
        }
      </Section>

      {/* Current Medications */}
      <Section title="Current Medications">
        {(ms.current_medications ?? []).length === 0
          ? <Text style={styles.empty}>None recorded</Text>
          : ms.current_medications.map((m: any, i: number) => (
            <View key={i} style={styles.subCard}>
              <Text style={styles.subCardTitle}>{m.name} {m.dosage ?? ''}</Text>
              <Text style={styles.subCardMeta}>{m.frequency ?? ''}{m.route ? ` · ${m.route}` : ''}</Text>
            </View>
          ))
        }
      </Section>

      {/* Past Surgeries */}
      <Section title="Past Surgeries">
        {(ms.past_surgeries ?? []).length === 0
          ? <Text style={styles.empty}>None recorded</Text>
          : ms.past_surgeries.map((s: any, i: number) => (
            <View key={i} style={styles.subCard}>
              <Text style={styles.subCardTitle}>{s.procedure_name}</Text>
              <Text style={styles.subCardMeta}>{s.date ? new Date(s.date).toLocaleDateString() : ''}{s.notes ? ` · ${s.notes}` : ''}</Text>
            </View>
          ))
        }
      </Section>

      {/* Family History */}
      <Section title="Family History">
        {(ms.family_history ?? []).length === 0
          ? <Text style={styles.empty}>None recorded</Text>
          : ms.family_history.map((f: any, i: number) => (
            <View key={i} style={styles.subCard}>
              <Text style={styles.subCardTitle}>{f.condition}</Text>
              <Text style={styles.subCardMeta}>{f.relation}{f.age_onset ? ` · Onset: ${f.age_onset}` : ''}</Text>
            </View>
          ))
        }
      </Section>
    </View>
  );
}

// ── Encounters Tab ────────────────────────────────────────────────────────────
function EncountersTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = usePatientConsultations(patientId);
  const STATUS_COLOR: Record<string, string> = {
    scheduled: colors.primary, in_progress: colors.warning, completed: colors.success, cancelled: colors.danger,
  };

  if (isLoading) return <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />;
  if (!data?.length) return <Text style={[styles.empty, { margin: 20 }]}>No encounters found</Text>;

  return (
    <View style={styles.tabContent}>
      {data.map((c: any) => {
        const color = STATUS_COLOR[c.status] ?? '#888';
        return (
          <View key={c.consultation_id} style={styles.subCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.subCardTitle}>{c.consultation_type?.replace(/_/g, ' ')}</Text>
              <View style={[styles.microBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.microBadgeText, { color }]}>{c.status}</Text>
              </View>
            </View>
            {c.chief_complaint && <Text style={styles.subCardMeta}>Chief complaint: {c.chief_complaint}</Text>}
            {c.start_time && <Text style={styles.subCardMeta}>{new Date(c.start_time).toLocaleString()}</Text>}
          </View>
        );
      })}
    </View>
  );
}

// ── Prescriptions Tab ─────────────────────────────────────────────────────────
function PrescriptionsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = usePatientPrescriptions(patientId);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const STATUS_COLOR: Record<string, string> = {
    active: colors.success, draft: '#888', filled: colors.primary, cancelled: colors.danger,
  };

  async function handlePdf(rxId: string) {
    setPdfLoadingId(rxId);
    try {
      await printPrescriptionById(rxId);
    } catch (e: any) {
      Alert.alert('PDF Error', e?.message ?? 'Could not open the prescription PDF.');
    } finally {
      setPdfLoadingId(null);
    }
  }

  if (isLoading) return <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />;
  if (!data?.length) return <Text style={[styles.empty, { margin: 20 }]}>No prescriptions found</Text>;

  return (
    <View style={styles.tabContent}>
      {data.map((p: any) => {
        const color = STATUS_COLOR[p.status] ?? '#888';
        return (
          <View key={p.prescription_id} style={styles.subCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.subCardTitle}>💊 {p.medication_count} medication{p.medication_count !== 1 ? 's' : ''}</Text>
              <View style={[styles.microBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.microBadgeText, { color }]}>{p.status}</Text>
              </View>
            </View>
            <Text style={styles.subCardMeta}>{new Date(p.created_at).toLocaleDateString()} · Refills: {p.refills_allowed}</Text>
            <TouchableOpacity
              style={styles.rxPdfBtn}
              onPress={() => handlePdf(p.prescription_id)}
              disabled={pdfLoadingId === p.prescription_id}
            >
              {pdfLoadingId === p.prescription_id
                ? <ActivityIndicator color={colors.primary} size="small" />
                : <Text style={styles.rxPdfBtnText}>📄 View / Download PDF</Text>}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

// ── Appointments Tab ──────────────────────────────────────────────────────────
function AppointmentsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = usePatientAppointments(patientId);
  const STATUS_COLOR: Record<string, string> = {
    scheduled: colors.primary, confirmed: colors.success, completed: '#888',
    cancelled: colors.danger, no_show: colors.warning,
  };

  if (isLoading) return <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />;
  if (!data?.length) return <Text style={[styles.empty, { margin: 20 }]}>No appointments found</Text>;

  return (
    <View style={styles.tabContent}>
      {data.map((a: any) => {
        const color = STATUS_COLOR[a.status] ?? '#888';
        const dt = parseBackendDate(a.appointment_datetime) ?? new Date();
        return (
          <View key={a.appointment_id} style={styles.subCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.subCardTitle}>{a.appointment_type?.replace(/_/g, ' ')}</Text>
              <View style={[styles.microBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.microBadgeText, { color }]}>{a.status}</Text>
              </View>
            </View>
            <Text style={styles.subCardMeta}>
              {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' · '}{a.modality} · {a.duration_minutes} min
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
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
  header: {
    backgroundColor: colors.primary, paddingTop: 52, paddingBottom: 20,
    paddingHorizontal: 20, alignItems: 'center',
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 12 },
  backText: { color: '#CDE7EE', fontSize: 14 },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  patientName: { fontSize: 22, fontWeight: '700', color: '#fff' },
  patientMeta: { fontSize: 13, color: '#CDE7EE', marginTop: 4, textTransform: 'capitalize' },
  statusBadge: { marginTop: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  activeStatus: { backgroundColor: colors.successTint },
  inactiveStatus: { backgroundColor: colors.dangerTint },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize', color: '#333' },
  tabBar: {
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
    flexGrow: 0,
  },
  tab: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, color: '#888', fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  content: { flex: 1 },
  tabContent: { padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 13, color: '#888', flex: 1 },
  infoValue: { fontSize: 13, color: '#111', fontWeight: '500', flex: 2, textAlign: 'right', textTransform: 'capitalize' },
  subCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  subCardTitle: { fontSize: 14, fontWeight: '600', color: '#111', textTransform: 'capitalize' },
  subCardMeta: { fontSize: 12, color: '#888', marginTop: 4 },
  allergyCard: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  microBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  microBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  rxPdfBtn: {
    marginTop: 10, backgroundColor: colors.primaryTint, borderRadius: 8, paddingVertical: 9,
    alignItems: 'center', borderWidth: 1, borderColor: colors.primary,
  },
  rxPdfBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  alertBox: { backgroundColor: colors.warningTint, borderRadius: 10, padding: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: colors.warning },
  alertTitle: { fontSize: 14, fontWeight: '700', color: colors.warning, marginBottom: 6 },
  alertItem: { fontSize: 13, color: colors.warning, marginTop: 2 },
  empty: { color: '#aaa', fontSize: 13, fontStyle: 'italic' },
});
