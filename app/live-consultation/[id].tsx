import { colors } from '../../src/theme';
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useConsultation } from '../../src/hooks/useConsultations';
import { api } from '../../src/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useScribe, ScribeLanguage } from '../../src/hooks/useScribe';

type Tab = 'notes' | 'subjective' | 'objective' | 'assessment' | 'plan' | 'handout';

function isValidDate(s: string): boolean {
  // Accept ISO dates like "2026-07-10" or "2026-07-10T09:00:00"
  return /^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(Date.parse(s));
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'notes', label: 'Free Notes', icon: '📝' },
  { key: 'subjective', label: 'Subjective', icon: '💬' },
  { key: 'objective', label: 'Objective', icon: '🩺' },
  { key: 'assessment', label: 'Assessment', icon: '🧠' },
  { key: 'plan', label: 'Plan', icon: '📋' },
  { key: 'handout', label: 'Handout', icon: '📄' },
];

export default function LiveConsultationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: consultation, isLoading, refetch } = useConsultation(id);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('notes');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Free-form notes
  const [freeNotes, setFreeNotes] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // Voice scribe (live transcription → SOAP)
  const [scribeLang, setScribeLang] = useState<ScribeLanguage>('english');
  const scribe = useScribe(id);

  // SOAP fields
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [hpi, setHpi] = useState('');
  // BP stored as "systolic/diastolic" string, split on save
  const [vitalsBP, setVitalsBP] = useState('');
  const [vitalsHR, setVitalsHR] = useState('');
  const [vitalsTemp, setVitalsTemp] = useState('');
  // O2 stored as plain number string
  const [vitalsO2, setVitalsO2] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [clinicalImpression, setClinicalImpression] = useState('');
  const [planActions, setPlanActions] = useState('');
  const [followUp, setFollowUp] = useState('');

  // Handout — patient summary generated from SOAP
  const [handoutSummary, setHandoutSummary] = useState('');
  const [handoutKeyPoints, setHandoutKeyPoints] = useState<string[]>([]);
  const [handoutLoading, setHandoutLoading] = useState(false);

  useEffect(() => {
    if (!consultation) return;
    const notes = consultation.clinical_notes ?? {};
    const s = notes.subjective ?? {};
    const o = notes.objective ?? {};
    const a = notes.assessment ?? {};
    const p = notes.plan ?? {};

    // chief_complaint may be a string or {complaint, duration, severity}
    const cc = s.chief_complaint;
    setChiefComplaint(typeof cc === 'string' ? cc : (cc?.complaint ?? ''));
    setHpi(s.history_of_present_illness ?? '');
    // BP is an object {systolic, diastolic} — display as "systolic/diastolic"
    const bp = o.vital_signs?.blood_pressure;
    setVitalsBP(bp ? `${bp.systolic ?? ''}/${bp.diastolic ?? ''}` : '');
    setVitalsHR(o.vital_signs?.heart_rate ? String(o.vital_signs.heart_rate) : '');
    setVitalsTemp(o.vital_signs?.temperature ? String(o.vital_signs.temperature) : '');
    // O2 is an object {value, unit} — display as plain number
    const o2 = o.vital_signs?.oxygen_saturation;
    setVitalsO2(o2?.value ? String(o2.value) : '');
    setPhysicalExam(o.physical_examination ?? '');
    const pd = a.primary_diagnosis;
    setPrimaryDiagnosis(typeof pd === 'string' ? pd : (pd?.description ?? ''));
    setClinicalImpression(a.clinical_impression ?? '');
    setPlanActions((p.immediate_actions ?? []).join('\n'));
    setFollowUp(p.follow_up?.next_visit ?? '');
  }, [consultation]);

  // React to the scribe finishing — works for both an explicit Stop and an
  // unexpected disconnect that auto-finalizes. Kept above any early return so
  // the hook order is stable.
  useEffect(() => {
    if (scribe.status === 'done') {
      // Transcript captured — drop it into Free Notes. SOAP is generated only
      // when the doctor taps "Generate SOAP Notes with AI".
      if (scribe.transcript) {
        setFreeNotes((prev) => (prev ? `${prev}\n${scribe.transcript}` : scribe.transcript));
      }
      Alert.alert(
        'Transcript captured',
        'The conversation has been added to Free Notes. Tap "Generate SOAP Notes with AI" when you\'re ready.',
      );
      scribe.reset();
    } else if (scribe.status === 'error' && scribe.error) {
      Alert.alert('Scribe Error', scribe.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scribe.status]);

  // Build current SOAP for context
  function buildCurrentSoap() {
    // Parse "120/80" → {systolic:120, diastolic:80}
    let bloodPressure: { systolic: number; diastolic: number } | undefined;
    if (vitalsBP.includes('/')) {
      const [sys, dia] = vitalsBP.split('/');
      if (sys && dia) bloodPressure = { systolic: Number(sys), diastolic: Number(dia) };
    }

    return {
      subjective: {
        chief_complaint: chiefComplaint ? { complaint: chiefComplaint } : undefined,
        history_of_present_illness: hpi || undefined,
      },
      objective: {
        vital_signs: {
          blood_pressure: bloodPressure,
          heart_rate: vitalsHR ? Number(vitalsHR) : undefined,
          temperature: vitalsTemp ? Number(vitalsTemp) : undefined,
          oxygen_saturation: vitalsO2 ? { value: Number(vitalsO2), unit: '%', room_air: true } : undefined,
        },
        physical_examination: physicalExam || undefined,
      },
      assessment: {
        // primary_diagnosis requires {code, description} — use a placeholder code if none
        primary_diagnosis: primaryDiagnosis
          ? { code: 'R69', description: primaryDiagnosis }
          : undefined,
        clinical_impression: clinicalImpression || undefined,
      },
      plan: {
        immediate_actions: planActions ? planActions.split('\n').filter(Boolean) : undefined,
        // next_visit must be a valid datetime — skip if it's plain text
        follow_up: followUp && isValidDate(followUp)
          ? { next_visit: followUp }
          : undefined,
      },
    };
  }

  async function generateSOAPFromNotes() {
    if (!freeNotes.trim() || freeNotes.trim().length < 10) {
      Alert.alert('Too short', 'Please type at least a few words about the patient visit');
      return;
    }
    setAiGenerating(true);
    try {
      const res = await api.post('/ai/notes/structure', {
        text: freeNotes,
        existing_soap: buildCurrentSoap(),
      });
      const soap = res.data.data.soap_notes;
      if (soap.subjective) {
        const cc = soap.subjective.chief_complaint;
        if (cc) setChiefComplaint(typeof cc === 'string' ? cc : (cc.complaint ?? chiefComplaint));
        if (soap.subjective.history_of_present_illness) setHpi(soap.subjective.history_of_present_illness);
      }
      if (soap.objective) {
        const o = soap.objective;
        // AI may return vital_signs as a plain string ("BP 120/80, HR 72")
        // or as an object. Only parse if it's an object.
        if (o.vital_signs && typeof o.vital_signs === 'object') {
          const vs = o.vital_signs;
          if (vs.blood_pressure) {
            const bp = vs.blood_pressure;
            if (typeof bp === 'string') setVitalsBP(bp);
            else if (bp.systolic && bp.diastolic) setVitalsBP(`${bp.systolic}/${bp.diastolic}`);
          }
          if (vs.heart_rate) setVitalsHR(String(vs.heart_rate));
          if (vs.temperature) setVitalsTemp(String(vs.temperature));
          if (vs.oxygen_saturation) {
            const o2 = vs.oxygen_saturation;
            setVitalsO2(typeof o2 === 'number' ? String(o2) : (o2.value ? String(o2.value) : vitalsO2));
          }
        }
        // physical_examination may also be under lab_results key in AI output
        if (o.physical_examination) setPhysicalExam(o.physical_examination);
        else if (o.lab_results && typeof o.lab_results === 'string') setPhysicalExam(o.lab_results);
      }
      if (soap.assessment) {
        const a = soap.assessment;
        // AI returns: {diagnoses: [{name, icd10}], clinical_reasoning}
        // Backend stores: {primary_diagnosis: {description}, clinical_impression}
        if (a.diagnoses && Array.isArray(a.diagnoses) && a.diagnoses.length > 0) {
          const first = a.diagnoses[0];
          setPrimaryDiagnosis(typeof first === 'string' ? first : (first.name ?? first.description ?? ''));
          // If multiple diagnoses, put the rest in clinical impression
          if (a.diagnoses.length > 1) {
            const rest = a.diagnoses.slice(1).map((d: any) => typeof d === 'string' ? d : d.name).join(', ');
            setClinicalImpression(rest + (a.clinical_reasoning ? `\n${a.clinical_reasoning}` : ''));
          } else if (a.clinical_reasoning) {
            setClinicalImpression(a.clinical_reasoning);
          }
        } else {
          // Fallback: primary_diagnosis may be a string or object
          const pd = a.primary_diagnosis;
          if (pd) setPrimaryDiagnosis(typeof pd === 'string' ? pd : (pd.description ?? pd.icd_code ?? ''));
          if (a.clinical_impression) setClinicalImpression(a.clinical_impression);
          if (a.clinical_reasoning) setClinicalImpression(a.clinical_reasoning);
        }
      }
      if (soap.plan) {
        const p = soap.plan;
        // AI returns: {treatments: [...], medications_prescribed: [...], follow_up: string}
        // Backend stores: {immediate_actions: [...], follow_up: {next_visit}}
        const actions = p.treatments ?? p.immediate_actions ?? p.medications_prescribed;
        if (actions) {
          setPlanActions(Array.isArray(actions) ? actions.join('\n') : String(actions));
        }
        const fu = p.follow_up;
        if (fu) {
          const fuStr = typeof fu === 'string' ? fu : (fu.next_visit ?? '');
          // Only set if it looks like a date — AI often sends plain text here
          if (isValidDate(fuStr)) setFollowUp(fuStr);
        }
      }
      Alert.alert('✅ SOAP Generated', 'Review each section and save when ready', [
        { text: 'View SOAP', onPress: () => setActiveTab('subjective') },
        { text: 'Stay here' },
      ]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'AI generation failed');
      Alert.alert('Error', msg);
    } finally {
      setAiGenerating(false);
    }
  }

  async function generateHandout() {
    // Build a plain-text summary of SOAP notes for the patient
    const parts: string[] = [];
    if (chiefComplaint) parts.push(`Chief Complaint: ${chiefComplaint}`);
    if (hpi) parts.push(`History: ${hpi}`);
    if (vitalsBP || vitalsHR || vitalsTemp || vitalsO2) {
      parts.push(`Vitals: BP ${vitalsBP}, HR ${vitalsHR} bpm, Temp ${vitalsTemp}°C, O2 ${vitalsO2}%`);
    }
    if (physicalExam) parts.push(`Examination: ${physicalExam}`);
    if (primaryDiagnosis) parts.push(`Diagnosis: ${primaryDiagnosis}`);
    if (clinicalImpression) parts.push(`Impression: ${clinicalImpression}`);
    if (planActions) parts.push(`Plan: ${planActions}`);
    if (followUp) parts.push(`Follow-up: ${followUp}`);

    const notes = parts.join('\n');
    if (notes.trim().length < 10) {
      Alert.alert('No content', 'Fill in the SOAP notes first, then generate the patient summary.');
      return;
    }
    setHandoutLoading(true);
    try {
      const res = await api.post('/ai/notes/summarize', {
        notes,
        max_length: 300,
        format: 'detailed',
      });
      setHandoutSummary(res.data.data.summary ?? '');
      setHandoutKeyPoints(res.data.data.key_points ?? []);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to generate summary');
      Alert.alert('Error', msg);
    } finally {
      setHandoutLoading(false);
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      await api.patch(`/consultations/${id}/notes`, buildCurrentSoap());
      await refetch();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to save notes');
      Alert.alert('Error', msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function completeConsultation() {
    // Validate required fields before attempting completion
    const missing: string[] = [];
    if (!chiefComplaint.trim()) missing.push('Chief Complaint (Subjective tab)');
    if (!primaryDiagnosis.trim()) missing.push('Primary Diagnosis (Assessment tab)');
    if (missing.length > 0) {
      Alert.alert(
        'Required fields missing',
        `Please fill in:\n• ${missing.join('\n• ')}`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Complete Consultation',
      'This will sign and lock the consultation. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete', style: 'default',
          onPress: async () => {
            setCompleting(true);
            try {
              await saveNotes();
              await api.post(`/consultations/${id}/complete`);
              // Mark linked appointment as completed so Start button disappears
              if (consultation?.appointment_id) {
                await api.patch(`/appointments/${consultation.appointment_id}/status`, { status: 'completed' }).catch(() => {});
              }
              queryClient.invalidateQueries({ queryKey: ['consultations'] });
              queryClient.invalidateQueries({ queryKey: ['consultation', id] });
              queryClient.invalidateQueries({ queryKey: ['appointments'] });
              router.replace(`/consultation-review/${id}`);
            } catch {
              // saveNotes already showed error
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const isCompleted = consultation?.status === 'completed';
  const scribeBusy = ['starting', 'stopping', 'generating'].includes(scribe.status);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Consultation</Text>
          <View style={[styles.statusBadge, isCompleted ? styles.completedBadge : styles.activeBadge]}>
            <Text style={styles.statusText}>{isCompleted ? '✓ Completed' : '● In Progress'}</Text>
          </View>
        </View>
        {!isCompleted && (
          <TouchableOpacity onPress={saveNotes} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>Type: {consultation?.consultation_type?.replace(/_/g, ' ')}</Text>
        <Text style={styles.infoText}>
          {consultation?.start_time ? new Date(consultation.start_time).toLocaleString() : 'Started now'}
        </Text>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={styles.tabIcon}>{t.icon}</Text>
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>

        {/* FREE NOTES TAB */}
        {activeTab === 'notes' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Free-form Notes</Text>
            <Text style={styles.hint}>
              Type anything about the visit — symptoms, vitals, findings, plan. AI will convert it into structured SOAP notes.
            </Text>

            {/* Voice scribe */}
            {!isCompleted && (
              <View style={styles.scribeBox}>
                <Text style={styles.scribeTitle}>🎤 Voice Scribe</Text>
                <Text style={styles.scribeHint}>
                  Record the consultation — speech is transcribed live and turned into SOAP notes.
                </Text>

                {/* Language toggle */}
                <View style={styles.langRow}>
                  {(['english', 'bengali'] as ScribeLanguage[]).map((lng) => (
                    <TouchableOpacity
                      key={lng}
                      style={[styles.langChip, scribeLang === lng && styles.langChipActive]}
                      onPress={() => setScribeLang(lng)}
                      disabled={scribe.status === 'active' || scribeBusy}
                    >
                      <Text style={[styles.langChipText, scribeLang === lng && styles.langChipTextActive]}>
                        {lng === 'english' ? 'English' : 'বাংলা'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {scribe.status === 'active' ? (
                  <TouchableOpacity style={styles.scribeStopBtn} onPress={() => scribe.stop()}>
                    <Text style={styles.scribeStopText}>
                      ⏹ Stop Recording · {Math.floor(scribe.elapsed / 60)}:{String(scribe.elapsed % 60).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.scribeStartBtn, scribeBusy && styles.aiBtnDisabled]}
                    onPress={() => scribe.start(scribeLang)}
                    disabled={scribeBusy}
                  >
                    {scribeBusy
                      ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.scribeStartText}>
                          {scribe.status === 'generating' ? ' Generating SOAP…' : ' Starting…'}</Text></>
                      : <Text style={styles.scribeStartText}>🎙 Start Recording</Text>}
                  </TouchableOpacity>
                )}

                {scribe.status === 'active' && (
                  <Text style={styles.scribeLive}>● Listening… speak now</Text>
                )}
                {!!scribe.transcript && (
                  <Text style={styles.scribeTranscript} numberOfLines={6}>{scribe.transcript}</Text>
                )}
                {!!scribe.error && scribe.status === 'error' && (
                  <Text style={styles.scribeError}>{scribe.error}</Text>
                )}
              </View>
            )}

            <TextInput
              style={[styles.freeNotesInput, isCompleted && styles.fieldDisabled]}
              value={freeNotes}
              onChangeText={setFreeNotes}
              placeholder={'e.g. Patient presents with 3-day fever and sore throat.\nBP 120/80, HR 74, temp 38.2°C.\nTonsils inflamed. No lymphadenopathy.\nImpression: Acute pharyngitis.\nPlan: Amoxicillin 500mg TID x 7 days, review in 1 week.'}
              placeholderTextColor="#bbb"
              multiline
              editable={!isCompleted}
              textAlignVertical="top"
            />
            {!isCompleted && (
              <TouchableOpacity
                style={[styles.aiBtn, (aiGenerating || freeNotes.trim().length < 10) && styles.aiBtnDisabled]}
                onPress={generateSOAPFromNotes}
                disabled={aiGenerating || freeNotes.trim().length < 10}
              >
                {aiGenerating
                  ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.aiBtnText}> Generating…</Text></>
                  : <Text style={styles.aiBtnText}>✨ Generate SOAP Notes with AI</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* SUBJECTIVE */}
        {activeTab === 'subjective' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>S — Subjective</Text>
            <Field label="Chief Complaint" value={chiefComplaint} onChange={setChiefComplaint}
              placeholder="Patient's main complaint..." multiline disabled={isCompleted} />
            <Field label="History of Present Illness" value={hpi} onChange={setHpi}
              placeholder="Describe the illness history..." multiline disabled={isCompleted} />
          </View>
        )}

        {/* OBJECTIVE */}
        {activeTab === 'objective' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>O — Objective</Text>
            <Text style={styles.groupLabel}>Vital Signs</Text>
            <View style={styles.vitalsGrid}>
              <VitalInput label="BP" value={vitalsBP} onChange={setVitalsBP} placeholder="120/80" disabled={isCompleted} />
              <VitalInput label="HR (bpm)" value={vitalsHR} onChange={setVitalsHR} placeholder="72" numeric disabled={isCompleted} />
              <VitalInput label="Temp (°C)" value={vitalsTemp} onChange={setVitalsTemp} placeholder="36.6" numeric disabled={isCompleted} />
              <VitalInput label="O₂ Sat %" value={vitalsO2} onChange={setVitalsO2} placeholder="98" numeric disabled={isCompleted} />
            </View>
            <Field label="Physical Examination" value={physicalExam} onChange={setPhysicalExam}
              placeholder="Examination findings..." multiline disabled={isCompleted} />
          </View>
        )}

        {/* ASSESSMENT */}
        {activeTab === 'assessment' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>A — Assessment</Text>
            <Field label="Primary Diagnosis" value={primaryDiagnosis} onChange={setPrimaryDiagnosis}
              placeholder="e.g. Hypertension, Type 2 Diabetes..." disabled={isCompleted} />
            <Field label="Clinical Impression" value={clinicalImpression} onChange={setClinicalImpression}
              placeholder="Overall clinical impression..." multiline disabled={isCompleted} />
          </View>
        )}

        {/* PLAN */}
        {activeTab === 'plan' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>P — Plan</Text>
            <Field label="Immediate Actions (one per line)" value={planActions} onChange={setPlanActions}
              placeholder={'Order CBC\nPrescribe Metformin\nReferral to cardiologist'} multiline disabled={isCompleted} />
            <Field label="Follow-up Date (YYYY-MM-DD)" value={followUp} onChange={setFollowUp}
              placeholder="e.g. 2026-07-10" disabled={isCompleted} />
          </View>
        )}

        {/* HANDOUT */}
        {activeTab === 'handout' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📄 Patient Summary</Text>
            <Text style={styles.hint}>
              Generate an AI patient summary from your SOAP notes. Fill in the SOAP sections first, then tap the button.
            </Text>

            <TouchableOpacity
              style={[styles.aiBtn, handoutLoading && styles.aiBtnDisabled]}
              onPress={generateHandout}
              disabled={handoutLoading}
            >
              {handoutLoading
                ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.aiBtnText}> Generating…</Text></>
                : <Text style={styles.aiBtnText}>✨ Generate Patient Summary with AI</Text>
              }
            </TouchableOpacity>

            {handoutSummary.length > 0 && (
              <View style={styles.handoutCard}>
                <View style={styles.handoutField}>
                  <Text style={styles.handoutLabel}>Summary</Text>
                  <TextInput
                    style={[styles.handoutInput, { minHeight: 100 }]}
                    value={handoutSummary}
                    onChangeText={setHandoutSummary}
                    multiline
                    placeholderTextColor="#bbb"
                    textAlignVertical="top"
                  />
                </View>

                {handoutKeyPoints.length > 0 && (
                  <View style={[styles.handoutField, styles.handoutFieldBorder]}>
                    <Text style={styles.handoutLabel}>Key Points</Text>
                    {handoutKeyPoints.map((pt, i) => (
                      <Text key={i} style={styles.keyPoint}>• {pt}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {handoutSummary.length === 0 && !handoutLoading && (
              <Text style={styles.emptyHandout}>No summary yet. Fill SOAP notes, then tap the button above.</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {!isCompleted && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.completeBtn, completing && { opacity: 0.6 }]}
            onPress={completeConsultation}
            disabled={completing}
          >
            {completing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.completeBtnText}>✓ Complete & Sign Consultation</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, multiline = false, disabled = false }:
  { label: string; value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean; disabled?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldTextarea, disabled && styles.fieldDisabled]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        editable={!disabled}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
  );
}

function VitalInput({ label, value, onChange, placeholder, numeric = false, disabled = false }:
  { label: string; value: string; onChange: (v: string) => void; placeholder: string; numeric?: boolean; disabled?: boolean }) {
  return (
    <View style={styles.vitalBox}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <TextInput
        style={[styles.vitalInput, disabled && styles.fieldDisabled]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        editable={!disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: colors.primary, paddingTop: 52, paddingBottom: 14,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { minWidth: 50 },
  backText: { color: '#CDE7EE', fontSize: 14 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  statusBadge: { marginTop: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  activeBadge: { backgroundColor: 'rgba(246,166,35,0.3)' },
  completedBadge: { backgroundColor: 'rgba(15,157,88,0.3)' },
  statusText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14, minWidth: 50, textAlign: 'right' },
  infoBar: {
    backgroundColor: colors.primaryDeep, flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  infoText: { fontSize: 12, color: '#CDE7EE', textTransform: 'capitalize' },
  tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', flexGrow: 0 },
  tab: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 5,
  },
  tabActive: { borderBottomColor: colors.primary },
  tabIcon: { fontSize: 14 },
  tabText: { fontSize: 12, color: '#888', fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  content: { flex: 1 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  hint: { fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 18 },
  scribeBox: {
    backgroundColor: colors.primaryTint, borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  scribeTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  scribeHint: { fontSize: 12, color: colors.inkSoft, marginBottom: 12, lineHeight: 17 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  langChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
  },
  langChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langChipText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  langChipTextActive: { color: '#fff' },
  scribeStartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.success, borderRadius: 10, paddingVertical: 12,
  },
  scribeStartText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scribeStopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.danger, borderRadius: 10, paddingVertical: 12,
  },
  scribeStopText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scribeLive: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  scribeTranscript: {
    marginTop: 12, fontSize: 13, color: '#333', lineHeight: 19,
    backgroundColor: '#fff', borderRadius: 8, padding: 10,
  },
  scribeError: { marginTop: 10, color: colors.danger, fontSize: 12 },
  freeNotesInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: '#111', backgroundColor: '#fff', minHeight: 200,
    textAlignVertical: 'top',
  },
  aiBtn: {
    marginTop: 14, backgroundColor: colors.secondary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  aiBtnDisabled: { backgroundColor: '#bbb' },
  aiBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  groupLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 10 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  vitalBox: { width: '47%' },
  vitalLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 4 },
  vitalInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: '#111', backgroundColor: '#fff', fontWeight: '600',
  },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: '#111', backgroundColor: '#fff',
  },
  fieldTextarea: { minHeight: 100, textAlignVertical: 'top' },
  fieldDisabled: { backgroundColor: colors.surfaceAlt, color: '#888' },
  handoutCard: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.primaryTint,
    marginTop: 16, overflow: 'hidden',
  },
  handoutField: { padding: 14 },
  handoutFieldBorder: { borderTopWidth: 1, borderTopColor: '#eee' },
  handoutLabel: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  handoutInput: {
    fontSize: 14, color: '#111', minHeight: 60,
    borderWidth: 1, borderColor: '#eee', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surfaceAlt,
    textAlignVertical: 'top',
  },
  emptyHandout: { color: '#aaa', textAlign: 'center', marginTop: 40, fontSize: 14 },
  keyPoint: { fontSize: 13, color: '#333', marginTop: 4, lineHeight: 18 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#eee',
  },
  completeBtn: {
    backgroundColor: colors.success, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  completeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
