import { colors } from '../../src/theme';
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useConsultation } from '../../src/hooks/useConsultations';
import { api } from '../../src/lib/api';
import { useUser } from '../../src/context/UserContext';
import { printPrescriptionById } from '../../src/lib/prescription-print';

interface Template { template_id: string; name: string; template_type: string }
interface Medication { drug_name: string; dosage: string; frequency: string; duration: string; instructions: string }

export default function ConsultationReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const { data: consultation, isLoading } = useConsultation(id);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [draftLoading, setDraftLoading] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [rxNotes, setRxNotes] = useState('');
  const [rxFollowUp, setRxFollowUp] = useState('');
  const [patientSummary, setPatientSummary] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedRxId, setSavedRxId] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function viewPdf(rxId: string) {
    setPdfLoading(true);
    try {
      await printPrescriptionById(rxId);
    } catch (e: any) {
      Alert.alert('PDF Error', e?.message ?? 'Could not open the prescription PDF.');
    } finally {
      setPdfLoading(false);
    }
  }

  // Load prescription templates: try doctor-specific first, then fall back to global list
  useEffect(() => {
    setTemplatesLoading(true);

    const fromList = () =>
      api.get('/templates', { params: { template_type: 'prescription', limit: 50 } })
        .then(res => (res.data?.data?.templates ?? []).map((t: any) => ({
          template_id: t.template_id,
          name: t.name,
          template_type: t.template_type,
        })));

    const fromDoctor = () =>
      user?.doctor_id
        ? api.get(`/templates/by-doctor/${user.doctor_id}`).then(res => {
            const map: Record<string, any> = res.data?.data?.templates ?? {};
            return Object.values(map)
              .filter((t: any) => t && t.template_type === 'prescription')
              .map((t: any) => ({ template_id: t.template_id, name: t.name, template_type: t.template_type }));
          })
        : Promise.resolve([]);

    Promise.allSettled([fromDoctor(), fromList()])
      .then(([doctorResult, listResult]) => {
        const doctorTemplates = doctorResult.status === 'fulfilled' ? doctorResult.value : [];
        const listTemplates = listResult.status === 'fulfilled' ? listResult.value : [];
        // Merge, deduplicate by template_id
        const seen = new Set<string>();
        const merged: Template[] = [];
        [...doctorTemplates, ...listTemplates].forEach((t: Template) => {
          if (!seen.has(t.template_id)) {
            seen.add(t.template_id);
            merged.push(t);
          }
        });
        setTemplates(merged);
      })
      .finally(() => setTemplatesLoading(false));
  }, [user?.doctor_id]);

  // Pre-select the consultation's template, or fall back to the org default so
  // every prescription is branded even when the doctor doesn't pick one.
  useEffect(() => {
    if (!consultation) return;
    if (consultation.prescription_template_id) {
      setSelectedTemplateId(consultation.prescription_template_id);
      return;
    }
    let cancelled = false;
    api.get('/templates/default', { params: { template_type: 'prescription' } })
      .then((res) => {
        const def = res.data?.data?.template_id;
        if (!cancelled && def) selectTemplate(def);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultation]);

  async function selectTemplate(templateId: string | null) {
    setSelectedTemplateId(templateId);
    setShowTemplateDropdown(false);
    if (!templateId) return;
    try {
      await api.patch(`/consultations/${id}/prescription-template`, {
        prescription_template_id: templateId,
      });
    } catch {
      // Non-critical — template selection saved locally
    }
  }

  async function generatePrescription() {
    setDraftLoading(true);
    try {
      // Build plain-text SOAP summary from consultation notes for AI
      const notes = consultation?.clinical_notes ?? {};
      const s = notes.subjective ?? {};
      const o = notes.objective ?? {};
      const a = notes.assessment ?? {};
      const p = notes.plan ?? {};

      const cc = s.chief_complaint;
      const chiefComplaint = typeof cc === 'string' ? cc : (cc?.complaint ?? '');
      const pd = a.primary_diagnosis;
      const diagnosis = typeof pd === 'string' ? pd : (pd?.description ?? '');
      const actions = Array.isArray(p.immediate_actions) ? p.immediate_actions.join(', ') : '';

      const soapText = [
        chiefComplaint && `Chief Complaint: ${chiefComplaint}`,
        s.history_of_present_illness && `History: ${s.history_of_present_illness}`,
        o.physical_examination && `Examination: ${o.physical_examination}`,
        diagnosis && `Diagnosis: ${diagnosis}`,
        a.clinical_impression && `Impression: ${a.clinical_impression}`,
        actions && `Plan: ${actions}`,
        p.follow_up?.next_visit && `Follow-up: ${p.follow_up.next_visit}`,
      ].filter(Boolean).join('\n');

      if (soapText.length < 10) {
        Alert.alert('No SOAP notes', 'Complete the SOAP notes in the consultation before generating a prescription.');
        return;
      }

      // Use AI notes structure endpoint to get a prescription-ready summary
      const aiRes = await api.post('/ai/notes/summarize', {
        notes: soapText,
        max_length: 500,
        format: 'detailed',
      });

      setPatientSummary(aiRes.data.data.summary ?? '');

      // Also try the standard prescription-draft endpoint
      try {
        const draftRes = await api.post(`/consultations/${id}/prescription-draft`);
        const d = draftRes.data.data;
        if (d.medications?.length > 0) {
          setMedications(d.medications.map((m: any) => ({
            drug_name: m.drug_name ?? m.medication_name ?? '',
            dosage: m.dosage ?? m.strength ?? '',
            frequency: m.frequency ?? '',
            duration: m.duration ?? '',
            instructions: m.instructions ?? m.special_instructions ?? '',
          })));
          setRxNotes(d.notes ?? '');
          setRxFollowUp(d.follow_up?.next_visit ?? '');
          return;
        }
      } catch {
        // prescription-draft needs session form — fall through to manual entry
      }

      // No session form — add one blank medication for manual entry
      setMedications([{ drug_name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
      Alert.alert(
        'Ready to fill',
        'AI summary generated. Enter medications manually — no session form was found for auto-fill.',
      );
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed'));
    } finally {
      setDraftLoading(false);
    }
  }

  async function savePrescription() {
    const validMeds = medications.filter(m => m.drug_name.trim());
    if (validMeds.length === 0) {
      Alert.alert('No medications', 'Add at least one medication before saving');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/prescriptions', {
        patient_id: consultation?.patient_id,
        doctor_id: consultation?.doctor_id,
        consultation_id: id,
        prescription_template_id: selectedTemplateId ?? undefined,
        medications: validMeds.map(m => ({
          drug_name: m.drug_name,
          dosage: m.dosage || undefined,
          frequency: m.frequency || undefined,
          duration: m.duration || undefined,
          instructions: m.instructions || undefined,
        })),
        notes: rxNotes || undefined,
        follow_up: rxFollowUp ? { next_visit: rxFollowUp } : undefined,
        validate_safety: true,
      });
      const rxId: string = res.data.data.prescription_id;
      setSavedRxId(rxId);
      Alert.alert('Saved', 'Prescription created successfully', [
        { text: 'View PDF', onPress: () => viewPdf(rxId) },
        {
          text: 'View Patient',
          onPress: () => router.replace(`/patient/${consultation?.patient_id}`),
        },
      ]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to save prescription');
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  function updateMed(index: number, field: keyof Medication, value: string) {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  }

  function addMed() {
    setMedications([...medications, { drug_name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  }

  function removeMed(index: number) {
    setMedications(medications.filter((_, i) => i !== index));
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const selectedTemplate = templates.find(t => t.template_id === selectedTemplateId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Consultation Review</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

        {/* Consultation info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoId}>{id}</Text>
          <Text style={styles.infoMeta}>
            {consultation?.start_time ? new Date(consultation.start_time).toLocaleString() : ''}
          </Text>
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓ Completed</Text>
          </View>
        </View>

        {/* Prescription Template Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECT PRESCRIPTION TEMPLATE</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowTemplateDropdown(true)}
          >
            <Text style={styles.dropdownText}>
              {templatesLoading ? 'Loading…' : (selectedTemplate?.name ?? 'Clinic default')}
            </Text>
            <Text style={styles.dropdownArrow}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateBtn, draftLoading && styles.btnDisabled]}
          onPress={generatePrescription}
          disabled={draftLoading}
        >
          {draftLoading
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.generateBtnText}> Generating…</Text></>
            : <Text style={styles.generateBtnText}>📋 Generate Prescription from Session</Text>
          }
        </TouchableOpacity>

        {/* Patient Summary */}
        {patientSummary.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Patient Summary</Text>
            <Text style={styles.summaryText}>{patientSummary}</Text>
          </View>
        )}

        {/* Medications */}
        {medications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MEDICATIONS</Text>
            {medications.map((med, i) => (
              <View key={i} style={styles.medCard}>
                <View style={styles.medCardHeader}>
                  <Text style={styles.medNum}>Medication {i + 1}</Text>
                  <TouchableOpacity onPress={() => removeMed(i)}>
                    <Text style={styles.removeBtn}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
                <MedField label="Drug Name *" value={med.drug_name} onChange={v => updateMed(i, 'drug_name', v)} />
                <View style={styles.medRow}>
                  <View style={{ flex: 1 }}>
                    <MedField label="Dosage" value={med.dosage} onChange={v => updateMed(i, 'dosage', v)} />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <MedField label="Frequency" value={med.frequency} onChange={v => updateMed(i, 'frequency', v)} />
                  </View>
                </View>
                <MedField label="Duration" value={med.duration} onChange={v => updateMed(i, 'duration', v)} />
                <MedField label="Instructions" value={med.instructions} onChange={v => updateMed(i, 'instructions', v)} multiline />
              </View>
            ))}
            <TouchableOpacity style={styles.addMedBtn} onPress={addMed}>
              <Text style={styles.addMedText}>+ Add Medication</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notes & Follow-up */}
        {(medications.length > 0 || rxNotes) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTES & FOLLOW-UP</Text>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={rxNotes}
              onChangeText={setRxNotes}
              placeholder="Additional notes..."
              placeholderTextColor="#bbb"
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>Follow-up</Text>
            <TextInput
              style={styles.input}
              value={rxFollowUp}
              onChangeText={setRxFollowUp}
              placeholder="e.g. 2 weeks"
              placeholderTextColor="#bbb"
            />
          </View>
        )}

        {medications.length === 0 && !draftLoading && (
          <Text style={styles.emptyHint}>
            Tap "Generate Prescription from Session" to auto-fill medications from the consultation's SOAP notes using AI.
          </Text>
        )}
      </ScrollView>

      {/* Save footer */}
      {medications.length > 0 && (
        <View style={styles.footer}>
          {savedRxId && (
            <TouchableOpacity
              style={[styles.pdfBtn, pdfLoading && styles.btnDisabled]}
              onPress={() => viewPdf(savedRxId)}
              disabled={pdfLoading}
            >
              {pdfLoading
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={styles.pdfBtnText}>📄 View / Download PDF</Text>
              }
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={savePrescription}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{savedRxId ? '💾 Update Prescription' : '💾 Save Prescription'}</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Template Dropdown Modal */}
      <Modal visible={showTemplateDropdown} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowTemplateDropdown(false)}>
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => selectTemplate(null)}>
              <Text style={[styles.dropdownItemText, !selectedTemplateId && styles.dropdownItemActive]}>
                Clinic default
              </Text>
              {!selectedTemplateId && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            {templates.map(t => (
              <TouchableOpacity key={t.template_id} style={styles.dropdownItem} onPress={() => selectTemplate(t.template_id)}>
                <Text style={[styles.dropdownItemText, selectedTemplateId === t.template_id && styles.dropdownItemActive]}>
                  {t.name}
                </Text>
                {selectedTemplateId === t.template_id && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
            {templates.length === 0 && !templatesLoading && (
              <Text style={styles.noTemplates}>No prescription templates found</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function MedField({ label, value, onChange, multiline = false }:
  { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textarea]}
        value={value}
        onChangeText={onChange}
        placeholder={label.replace(' *', '')}
        placeholderTextColor="#bbb"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  infoCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
  },
  infoId: { fontSize: 12, color: '#888', fontFamily: 'monospace' },
  infoMeta: { fontSize: 13, color: '#555', marginTop: 4 },
  completedBadge: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: colors.successTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  completedText: { color: colors.success, fontWeight: '700', fontSize: 12 },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 8,
  },
  dropdown: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#ddd',
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dropdownText: { fontSize: 14, color: '#111' },
  dropdownArrow: { fontSize: 16, color: '#888' },
  generateBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginBottom: 16,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  btnDisabled: { opacity: 0.6 },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  summaryCard: {
    backgroundColor: colors.primaryTint, borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: colors.primary, marginBottom: 16,
  },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 6, textTransform: 'uppercase' },
  summaryText: { fontSize: 13, color: '#333', lineHeight: 18 },
  medCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  medCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  medNum: { fontSize: 13, fontWeight: '700', color: colors.primary },
  removeBtn: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  medRow: { flexDirection: 'row' },
  addMedBtn: {
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  addMedText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111', backgroundColor: colors.surfaceAlt,
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  emptyHint: { textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 20, lineHeight: 20 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#eee',
  },
  saveBtn: {
    backgroundColor: colors.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pdfBtn: {
    backgroundColor: colors.primaryTint, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primary, marginBottom: 10,
  },
  pdfBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  dropdownMenu: {
    backgroundColor: '#fff', borderRadius: 12, width: '100%',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dropdownItemText: { fontSize: 14, color: '#333' },
  dropdownItemActive: { color: colors.primary, fontWeight: '700' },
  checkmark: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  noTemplates: { padding: 16, color: '#aaa', textAlign: 'center', fontSize: 13 },
});
