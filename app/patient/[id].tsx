import { colors, font } from '../../src/theme';
import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import {
  usePatientDetail,
  usePatientConsultations,
  usePatientPrescriptions,
  usePatientAppointments,
  usePatientDocuments,
  usePatientAlerts,
  usePatientJourney,
} from '../../src/hooks/usePatientDetail';
import { useQueryClient } from '@tanstack/react-query';
import { parseBackendDate } from '../../src/lib/datetime';
import { printPrescriptionById } from '../../src/lib/prescription-print';
import { VitalsSection } from '../../src/components/VitalsSection';
import { usePatientVitals } from '../../src/hooks/usePatientVitals';
import { formatDate } from '../../src/lib/datetime';
import { Icon, Select, Button, Input } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { useUser } from '../../src/context/UserContext';
import { ALERT_TYPES, alertMeta } from '../../src/lib/patient-alerts';

const MAIN_TABS = [
  { key: 'overview', label: 'Overview', sub: [{ k: 'info', l: 'Information' }, { k: 'alerts', l: 'Alerts' }, { k: 'summary', l: 'Summary' }] },
  { key: 'health', label: 'Health Records', sub: [{ k: 'history', l: 'General History' }, { k: 'vitals', l: 'Vitals' }, { k: 'appointments', l: 'Appointments' }] },
  { key: 'encounters', label: 'Encounters', sub: [{ k: 'consultations', l: 'Consultations' }] },
  { key: 'prescriptions', label: 'Prescriptions', sub: [{ k: 'medications', l: 'Medications' }] },
  { key: 'files', label: 'Medical Files', sub: [{ k: 'registration_form', l: 'Registration' }, { k: 'lab_report', l: 'Lab Reports' }, { k: 'imaging', l: 'Imaging' }, { k: 'prescription', l: 'Prescriptions' }, { k: 'other', l: 'Other' }] },
];

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [main, setMain] = useState(0);
  const [sub, setSub] = useState(0);
  const { data: patient, isLoading } = usePatientDetail(id);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!patient) {
    return <View style={styles.center}><Text style={styles.error}>Patient not found</Text></View>;
  }

  const dob = patient.demographics?.date_of_birth ? new Date(patient.demographics.date_of_birth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / 3.156e10) : null;
  const fullName = `${patient.demographics?.first_name ?? ''} ${patient.demographics?.middle_name ? patient.demographics.middle_name + ' ' : ''}${patient.demographics?.last_name ?? ''}`.trim();

  const mainTab = MAIN_TABS[main];
  const subKey = mainTab.sub[sub]?.k ?? mainTab.sub[0].k;
  function selectMain(i: number) { setMain(i); setSub(0); }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(patient.demographics?.first_name?.[0] ?? '') + (patient.demographics?.last_name?.[0] ?? '')}</Text>
        </View>
        <Text style={styles.patientName}>{fullName}</Text>
        <Text style={styles.patientMeta}>
          {patient.demographics?.gender ?? ''}{age ? ` · ${age}y` : ''}
          {patient.demographics?.blood_group ? ` · ${patient.demographics.blood_group}` : ''}
        </Text>
      </View>

      {/* Journey stepper — always visible above the tabs */}
      <JourneyStepper patientId={id} fallback={patient.journeys?.[0]} />

      {/* Main tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ alignItems: 'center' }}>
        {MAIN_TABS.map((t, i) => (
          <TouchableOpacity key={t.key} style={[styles.tab, main === i && styles.tabActive]} onPress={() => selectMain(i)}>
            <Text style={[styles.tabText, main === i && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sub tabs */}
      {mainTab.sub.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabBar} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: 'center' }}>
          {mainTab.sub.map((s, i) => (
            <TouchableOpacity key={s.k} style={[styles.subTab, sub === i && styles.subTabActive]} onPress={() => setSub(i)}>
              <Text style={[styles.subTabText, sub === i && styles.subTabTextActive]}>{s.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Patient summary shown on Overview */}
        {mainTab.key === 'overview' && <PatientSummaryCard patient={patient} patientId={id} />}

        {mainTab.key === 'overview' && subKey === 'info' && <OverviewTab patient={patient} />}
        {mainTab.key === 'overview' && subKey === 'alerts' && <AlertsTab patientId={id} />}
        {mainTab.key === 'overview' && subKey === 'summary' && <SummaryTab patient={patient} />}

        {mainTab.key === 'health' && subKey === 'history' && <HealthRecordsTab patient={patient} />}
        {mainTab.key === 'health' && subKey === 'vitals' && <View style={styles.tabContent}><VitalsSection patientId={id} /></View>}
        {mainTab.key === 'health' && subKey === 'appointments' && <AppointmentsTab patientId={id} />}

        {mainTab.key === 'encounters' && <EncountersTab patientId={id} />}
        {mainTab.key === 'prescriptions' && <PrescriptionsTab patientId={id} />}
        {mainTab.key === 'files' && <MedicalFilesTab patientId={id} category={subKey} />}
      </ScrollView>
    </View>
  );
}

// ── Journey Stepper ───────────────────────────────────────────────────────────
const JOURNEY_STEPS = [
  { key: 'onboard', label: 'Onboard', icon: 'home-outline' as const },
  { key: 'appointment', label: 'Appointment', icon: 'calendar-outline' as const },
  { key: 'pre_consultation', label: 'Pre-Consult', icon: 'clipboard-outline' as const },
  { key: 'consultation', label: 'Consultation', icon: 'medkit-outline' as const },
  { key: 'doctor_view', label: 'Doctor Review', icon: 'person-outline' as const },
  { key: 'prescription', label: 'Prescription', icon: 'medical-outline' as const },
  { key: 'billing', label: 'Billing', icon: 'card-outline' as const },
];

function JourneyStepper({ patientId, fallback }: { patientId: string; fallback?: any }) {
  const { data: full } = usePatientJourney(patientId);
  const journey = full ?? fallback;
  const currentStep = journey?.current_step;
  const currentIdx = journey ? Math.max(0, JOURNEY_STEPS.findIndex((s) => s.key === currentStep)) : 0;
  const journeyDone = journey?.status === 'completed';
  // Web logic: prefer each step's own status from steps[], fall back to current_step index.
  const stepStatus = (i: number, key: string): 'done' | 'current' | 'pending' => {
    if (journeyDone) return 'done';
    const rec = (journey?.steps ?? []).find((r: any) => r.step === key);
    if (rec?.status === 'completed') return 'done';
    if (rec?.status === 'active') return 'current';
    if (currentStep === key) return 'current';
    if (i < currentIdx) return 'done';
    if (i === currentIdx) return 'current';
    return 'pending';
  };
  return (
    <View style={styles.journeyCard}>
      <View style={styles.journeyHead}>
        <Text style={styles.journeyTitle}>Patient Journey</Text>
        {journey?.status && (
          <View style={[styles.jBadge, { backgroundColor: colors.primaryTint }]}>
            <Text style={[styles.jBadgeText, { color: colors.primaryDeep }]}>{String(journey.status).replace(/_/g, ' ')}</Text>
          </View>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'flex-start', paddingVertical: 4 }}>
        {JOURNEY_STEPS.map((s, i) => {
          const st = stepStatus(i, s.key);
          const done = st === 'done';
          const active = st === 'current';
          const color = done ? colors.success : active ? colors.primary : colors.inkFaint;
          const bg = done ? colors.successTint : active ? colors.primary : colors.surfaceAlt;
          return (
            <View key={s.key} style={styles.stepWrap}>
              <View style={styles.stepRow}>
                {i > 0 && <View style={[styles.stepLine, { backgroundColor: i <= currentIdx ? colors.success : colors.border }]} />}
                <View style={[styles.stepCircle, { backgroundColor: bg, borderColor: color }]}>
                  <Icon name={done ? 'checkmark' : s.icon} size={16} color={active ? colors.white : color} />
                </View>
                {i < JOURNEY_STEPS.length - 1 && <View style={[styles.stepLine, { backgroundColor: i < currentIdx ? colors.success : colors.border }]} />}
              </View>
              <Text style={[styles.stepLabel, { color: active ? colors.primary : colors.inkFaint, fontWeight: active ? '700' : '400' }]} numberOfLines={2}>{s.label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Patient Summary Card ──────────────────────────────────────────────────────
function PatientSummaryCard({ patient, patientId }: { patient: any; patientId: string }) {
  const ms = patient.medical_summary ?? {};
  const conditions = (ms.chronic_conditions ?? []).map((c: any) => c.description ?? c.code).filter(Boolean);
  const meds = (ms.current_medications ?? []).map((m: any) => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`);
  const allergies = (patient.allergies ?? ms.allergies ?? []).map((a: any) => a.allergen).filter(Boolean);
  const { data: vitals } = usePatientVitals(patientId);
  const { data: alerts } = usePatientAlerts(patientId);
  const v = vitals?.[0];

  return (
    <View style={styles.summaryCard}>
      <SummaryRow icon="alert-circle-outline" label="Principal Problem" value={conditions[0] ?? 'Not recorded'} />
      <SummaryRow icon="warning-outline" label="Allergies" value={allergies.length ? allergies.join(', ') : 'No known allergies'} />
      <SummaryRow icon="medical-outline" label="Active Medications" value={meds.length ? meds.slice(0, 3).join(' · ') + (meds.length > 3 ? ` +${meds.length - 3}` : '') : 'None'} />
      {v && <SummaryRow icon="pulse-outline" label="Latest Vitals" value={[v.bp && `BP ${v.bp}`, v.hr && `HR ${v.hr}`, v.spo2 && `SpO₂ ${v.spo2}`, v.temp && `T ${v.temp}°${v.tempUnit ?? ''}`].filter(Boolean).join(' · ') || '—'} />}
      {alerts && alerts.length > 0 && (
        <View style={styles.flagRow}>
          {alerts.map((a: any, i: number) => {
            const m = alertMeta(a.alert_type);
            return <View key={a.alert_id ?? i} style={[styles.flagChip, { backgroundColor: m.tint }]}><Text style={[styles.flagText, { color: m.color }]}>{m.label}</Text></View>;
          })}
        </View>
      )}
      <View style={styles.summaryStatus}>
        <View style={[styles.statusDot, { backgroundColor: patient.status === 'active' ? colors.success : colors.inkFaint }]} />
        <Text style={styles.summaryStatusText}>Status: {patient.status ?? 'unknown'}</Text>
      </View>
    </View>
  );
}

function SummaryRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.sumRow}>
      <Icon name={icon} size={15} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sumLabel}>{label}</Text>
        <Text style={styles.sumValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Alerts Tab (patient safety alerts) ────────────────────────────────────────
function AlertsTab({ patientId }: { patientId: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const { data: alerts, isLoading } = usePatientAlerts(patientId);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('risk_violent_behavior');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const canAdd = ['receptionist', 'nurse', 'physician', 'therapist', 'admin'].includes(user?.role ?? '');

  async function addAlert() {
    setSaving(true);
    try {
      await api.post(`/patients/${patientId}/patient-alerts`, { alert_type: type, description: desc || undefined });
      qc.invalidateQueries({ queryKey: ['patient-alerts', patientId] });
      setAdding(false); setDesc(''); setType('risk_violent_behavior');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail ?? 'Failed to add alert');
    } finally { setSaving(false); }
  }

  return (
    <View style={styles.tabContent}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={styles.sectionTitle}>Patient Safety Alerts</Text>
        {canAdd && <Button label={adding ? 'Cancel' : 'Add Alert'} icon={adding ? 'close' : 'add'} size="sm" fullWidth={false} variant={adding ? 'outline' : 'primary'} onPress={() => setAdding(!adding)} />}
      </View>

      {adding && (
        <View style={[styles.subCard, { padding: 14, marginBottom: 12 }]}>
          <Select label="Alert Type" options={ALERT_TYPES.map((t) => ({ label: t.label, value: t.value }))} value={type} onChange={(v) => setType(v || 'risk_violent_behavior')} containerStyle={{ marginBottom: 12 }} />
          <Input label="Description" value={desc} onChangeText={setDesc} placeholder="Optional details" containerStyle={{ marginBottom: 12 }} />
          <Button label="Save Alert" onPress={addAlert} loading={saving} />
        </View>
      )}

      {isLoading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        : !alerts?.length ? <Text style={styles.empty}>No active alerts</Text>
        : alerts.map((a: any, i: number) => {
          const m = alertMeta(a.alert_type);
          return (
            <View key={a.alert_id ?? i} style={[styles.alertBanner, { backgroundColor: m.tint, borderLeftColor: m.color }]}>
              <Icon name="alert-circle" size={18} color={m.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertBannerTitle, { color: m.color }]}>{a.custom_alert_text || m.label}</Text>
                {a.description ? <Text style={styles.subCardMeta}>{a.description}</Text> : null}
              </View>
            </View>
          );
        })}
    </View>
  );
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab({ patient }: { patient: any }) {
  const ms = patient.medical_summary ?? {};
  return (
    <View style={styles.tabContent}>
      <Section title="Chronic Conditions">
        {(ms.chronic_conditions ?? []).length === 0 ? <Text style={styles.empty}>None recorded</Text>
          : ms.chronic_conditions.map((c: any, i: number) => <Text key={i} style={styles.subCardMeta}>• {c.description ?? c.code}</Text>)}
      </Section>
      <Section title="Active Medications">
        {(ms.current_medications ?? []).length === 0 ? <Text style={styles.empty}>None recorded</Text>
          : ms.current_medications.map((m: any, i: number) => <Text key={i} style={styles.subCardMeta}>• {m.name} {m.dosage ?? ''} {m.frequency ?? ''}</Text>)}
      </Section>
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

// ── Medical Files Tab ─────────────────────────────────────────────────────────
function MedicalFilesTab({ patientId, category }: { patientId: string; category?: string }) {
  const { data, isLoading } = usePatientDocuments(patientId);

  function fmtSize(b?: number) {
    if (!b) return '';
    return b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  }

  const filtered = (data ?? []).filter((d: any) => {
    if (!category) return true;
    const cat = (d.doc_category ?? d.doc_type ?? 'other').toString();
    if (category === 'other') return !['registration_form', 'lab_report', 'imaging', 'prescription'].includes(cat);
    return cat === category;
  });

  if (isLoading) return <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />;
  if (!filtered.length) return <Text style={[styles.empty, { margin: 20 }]}>No documents in this category</Text>;

  return (
    <View style={styles.tabContent}>
      {filtered.map((d: any) => (
        <TouchableOpacity
          key={d.document_id}
          style={styles.subCard}
          activeOpacity={0.7}
          onPress={() => d.file_url && Linking.openURL(d.file_url)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.docIcon}><Icon name="document-text-outline" size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subCardTitle} numberOfLines={1}>{d.file_name}</Text>
              <Text style={styles.subCardMeta}>
                {(d.doc_category ?? d.doc_type ?? 'document').toString().replace(/_/g, ' ')}
                {d.file_size_bytes ? ` · ${fmtSize(d.file_size_bytes)}` : ''}
                {d.created_at ? ` · ${formatDate(d.created_at)}` : ''}
              </Text>
            </View>
            <Icon name="open-outline" size={18} color={colors.inkFaint} />
          </View>
        </TouchableOpacity>
      ))}
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
  subTabBar: { backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0, paddingVertical: 8 },
  subTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  subTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  subTabText: { fontSize: 12, color: colors.inkSoft, fontWeight: '500' },
  subTabTextActive: { color: colors.white, fontWeight: '700' },
  content: { flex: 1 },
  // Journey stepper
  journeyCard: { backgroundColor: colors.surface, margin: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, padding: 14 },
  journeyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  journeyTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  jBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  jBadgeText: { fontFamily: font.semibold, fontSize: 11, textTransform: 'capitalize' },
  stepWrap: { alignItems: 'center', width: 74 },
  stepRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  stepLine: { flex: 1, height: 2 },
  stepCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: font.regular, fontSize: 10, textAlign: 'center', marginTop: 4 },
  // Summary card
  summaryCard: { backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, padding: 14, gap: 10 },
  sumRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sumLabel: { fontFamily: font.medium, fontSize: 10, color: colors.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4 },
  sumValue: { fontFamily: font.regular, fontSize: 13, color: colors.ink, marginTop: 1 },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flagChip: { backgroundColor: colors.dangerTint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  flagText: { fontFamily: font.semibold, fontSize: 10, color: colors.danger, textTransform: 'capitalize' },
  summaryStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  summaryStatusText: { fontFamily: font.medium, fontSize: 12, color: colors.inkSoft, textTransform: 'capitalize' },
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
  docIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderLeftWidth: 4, borderRadius: 10, padding: 12, marginBottom: 8 },
  alertBannerTitle: { fontFamily: font.semibold, fontSize: 14 },
  alertBox: { backgroundColor: colors.warningTint, borderRadius: 10, padding: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: colors.warning },
  alertTitle: { fontSize: 14, fontWeight: '700', color: colors.warning, marginBottom: 6 },
  alertItem: { fontSize: 13, color: colors.warning, marginTop: 2 },
  empty: { color: '#aaa', fontSize: 13, fontStyle: 'italic' },
});
