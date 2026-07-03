import { useState, useMemo } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/lib/api';
import { useUser } from '../../src/context/UserContext';
import { colors, spacing, radius, font } from '../../src/theme';
import { AppText, Input, Button, Select, Icon, ScreenHeader } from '../../src/components/ui';
import { IconName } from '../../src/components/ui/Icon';
import { ALERT_TYPES, alertMeta } from '../../src/lib/patient-alerts';

// ── Option sets ───────────────────────────────────────────────────────────────
const GENDER = [{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({ label: v, value: v }));
const MARITAL = ['single', 'married', 'divorced', 'widowed', 'other'].map((v) => ({ label: cap(v), value: v }));
const REL_TO_PATIENT = ['self', 'spouse', 'parent', 'guardian', 'other'].map((v) => ({ label: cap(v), value: v }));

const ALLERGY_OPTIONS = [
  'No Known Allergies', 'Adhesive Tape', 'Anesthesia', 'Aspirin', 'Codeine', 'Dairy Products',
  'Iodine/Shellfish/Contrast Dye', 'Latex', 'Morphine', 'Penicillin', 'Sulfa Drugs', 'Wheat',
];
const FAMILY_CONDITIONS = ['Anesthesia Problems', 'Arthritis', 'Cancer', 'Diabetes', 'Heart Problems', 'Hypertension', 'Stroke', 'Thyroid Disorder'];
const MEDICAL_HISTORY = [
  'None of the problems listed', 'Allergies', 'Anemia', 'Arthritis conditions', 'Asthma', 'Atrial fibrillation',
  'Bleeding problems', 'BPH', 'CAD coronary artery disease', 'Cancer', 'Cardiac arrest', 'Celiac disease',
  'Chest pain', 'CHF congestive heart failure', 'Chronic fatigue syndrome', 'Depression', 'Diabetes',
  'Drug/alcohol abuse', 'Erectile dysfunction', 'Fibromyalgia', 'GERD', 'Heart disease', 'High cholesterol',
  'Hyperinsulinemia', 'Hyperlipidemia', 'Hypertension', 'Hypogonadism male', 'Hypothyroidism', 'Infection problems',
  'Insomnia', 'Irritable bowel syndrome', 'Kidney problems', 'Menopause', 'Migraines/headaches', 'Neuropathy',
  'Onychomycosis', 'Organ injury', 'Osteoporosis', 'Pulmonary embolism/blood clot', 'Seizure disorders',
  'Shortness of breath', 'Sinus conditions', 'Stroke', 'Thyroid X', 'Tremors', 'Wheat allergy',
];

const TABS = [
  { key: 'info', label: 'Patient Info', icon: 'person-outline' as IconName },
  { key: 'insurance', label: 'Insurance', icon: 'shield-outline' as IconName },
  { key: 'medical', label: 'Medical History', icon: 'medkit-outline' as IconName },
  { key: 'physicians', label: 'Physicians', icon: 'people-outline' as IconName },
  { key: 'consents', label: 'Consents', icon: 'document-text-outline' as IconName },
  { key: 'alerts', label: 'Alerts', icon: 'warning-outline' as IconName },
  { key: 'upload', label: 'Files', icon: 'cloud-upload-outline' as IconName },
];

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

interface Surgery { procedure_name: string; date: string; doctor: string; location: string }
interface Medication { name: string; dosage: string; frequency: string }

export default function ManualRegisterScreen() {
  const router = useRouter();
  const { user } = useUser();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ prefill?: string; intake_session_id?: string }>();
  const prefill = useMemo(() => { try { return params.prefill ? JSON.parse(params.prefill) : {}; } catch { return {}; } }, [params.prefill]);

  const [tab, setTab] = useState(0);
  const [f, setF] = useState<Record<string, any>>(() => flatFromExtract(prefill));
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k: string) => setF((p) => ({ ...p, [k]: !p[k] }));

  // Split extracted allergens into checklist matches vs "other" free text.
  const extractedAllergens: string[] = (prefill?.allergies ?? []).map((a: any) => a.allergen).filter(Boolean);
  const [allergies, setAllergies] = useState<Set<string>>(new Set(extractedAllergens.filter((a) => ALLERGY_OPTIONS.includes(a))));
  const [allergyOther, setAllergyOther] = useState(extractedAllergens.filter((a) => !ALLERGY_OPTIONS.includes(a)).join(', '));
  const [family, setFamily] = useState<Record<string, { mother?: boolean; father?: boolean; sibling?: boolean }>>(() => buildFamily(prefill?.medical_summary?.family_history));
  const [conditions, setConditions] = useState<Set<string>>(() => buildConditions(prefill?.medical_summary?.chronic_conditions));
  const [alerts, setAlerts] = useState<{ alert_type: string; description: string }[]>(
    (prefill?.patient_alerts ?? []).map((a: any) => ({ alert_type: a.alert_type ?? 'others', description: a.description ?? a.custom_alert_text ?? '' })),
  );
  const [surgeries, setSurgeries] = useState<Surgery[]>(() => buildSurgeries(prefill?.medical_summary?.past_surgeries));
  const [medications, setMedications] = useState<Medication[]>(
    (prefill?.medical_summary?.current_medications ?? []).map((m: any) => ({ name: m.name ?? '', dosage: m.dosage ?? '', frequency: m.frequency ?? '' })),
  );
  const [files, setFiles] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [saving, setSaving] = useState(false);

  async function pickFile(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', `Allow ${source} access.`); return; }
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (!res.canceled && res.assets?.[0]) setFiles((p) => [...p, res.assets[0]]);
  }

  async function uploadFiles(patientId: string) {
    for (const file of files) {
      try {
        const form = new FormData();
        form.append('file', { uri: file.uri, name: file.fileName ?? 'document.jpg', type: file.mimeType ?? 'image/jpeg' } as any);
        form.append('patient_id', patientId);
        await api.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      } catch {
        // best-effort — one failed upload shouldn't block registration
      }
    }
  }

  const toggleSet = (s: Set<string>, setter: (v: Set<string>) => void, v: string) => {
    const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  function buildBody() {
    if (!f.first_name?.trim() || !f.last_name?.trim()) throw new Error('First and last name are required.');
    if (!f.dob || !/^\d{4}-\d{2}-\d{2}/.test(f.dob)) throw new Error('Date of birth is required (YYYY-MM-DD).');
    if (!f.gender) throw new Error('Sex is required.');
    if (!f.phone_primary?.trim()) throw new Error('Home phone is required.');

    const address = anyOf(f.addr_street, f.addr_city, f.addr_state)
      ? { street: f.addr_street, city: f.addr_city, state_province: f.addr_state } : undefined;

    const mkInsurance = (p: string) => anyOf(f[`${p}_name`], f[`${p}_policy`], f[`${p}_group`], f[`${p}_phone`])
      ? {
        provider: f[`${p}_name`], policy_number: f[`${p}_policy`], group_number: f[`${p}_group`], phone: f[`${p}_phone`],
        employer: f[`${p}_employer`], employer_phone: f[`${p}_employer_phone`],
        address: anyOf(f[`${p}_street`], f[`${p}_city`], f[`${p}_state`]) ? { street: f[`${p}_street`], city: f[`${p}_city`], state_province: f[`${p}_state`] } : undefined,
      } : undefined;

    const employer = anyOf(f.emp_name, f.emp_phone, f.emp_street, f.emp_city, f.emp_state)
      ? { name: f.emp_name, phone: f.emp_phone, street: f.emp_street, city: f.emp_city, state_province: f.emp_state } : undefined;

    const responsible_party = anyOf(f.rp_relation, f.rp_first, f.rp_last, f.rp_home_phone)
      ? {
        relation: f.rp_relation, first_name: f.rp_first, last_name: f.rp_last, middle_initial: f.rp_mi,
        address: f.rp_address, home_phone: f.rp_home_phone, work_phone: f.rp_work_phone, employer: f.rp_employer,
      } : undefined;

    const allergyList = [...allergies].filter((a) => a !== 'No Known Allergies').map((a) => ({ allergen: a, severity: 'moderate' }));
    if (allergyOther.trim()) allergyList.push({ allergen: allergyOther.trim(), severity: 'moderate' });

    const familyList: any[] = [];
    Object.entries(family).forEach(([cond, rel]) => {
      (['mother', 'father', 'sibling'] as const).forEach((r) => { if (rel[r]) familyList.push({ relation: cap(r), condition: cond }); });
    });

    const medical_summary = (conditions.size || surgeries.length || medications.length || familyList.length) ? {
      chronic_conditions: [...conditions].filter((c) => c !== 'None of the problems listed').map((c) => ({ description: c, status: 'active' })),
      current_medications: medications.filter((m) => m.name.trim()).map((m) => ({ name: m.name, dosage: m.dosage || undefined, frequency: m.frequency || undefined })),
      past_surgeries: surgeries.filter((s) => s.procedure_name.trim()).map((s) => ({ procedure_name: s.procedure_name, notes: s.location || undefined, doctor: s.doctor || undefined })),
      family_history: familyList,
    } : undefined;

    const social = anyOf(f.soc_marital, f.soc_occupation, f.soc_alcohol, f.soc_tobacco) || f.soc_retired || f.soc_disabled
      ? {
        occupation: f.soc_occupation, retired: !!f.soc_retired, disabled: !!f.soc_disabled, disabled_reason: f.soc_disabled_reason,
        alcohol_use: f.soc_alcohol, tobacco_use: f.soc_tobacco,
      } : undefined;

    const flags = (f.allergy_alert || f.fall_risk || f.infection_risk || f.special_care_required || f.isolation_required || f.critical_condition || f.alert_notes)
      ? {
        allergy_alert: !!f.allergy_alert, fall_risk: !!f.fall_risk, infection_risk: !!f.infection_risk,
        special_care_required: !!f.special_care_required, isolation_required: !!f.isolation_required,
        critical_condition: !!f.critical_condition, alert_notes: f.alert_notes ?? '',
      } : undefined;

    const consents = (f.treatment_consent || f.privacy_hipaa_consent || f.data_sharing_consent || f.financial_responsibility_agreement || f.assignment_release_signed)
      ? {
        treatment_consent: !!f.treatment_consent, privacy_hipaa_consent: !!f.privacy_hipaa_consent,
        data_sharing_consent: !!f.data_sharing_consent, financial_responsibility_agreement: !!f.financial_responsibility_agreement,
        consent_date: f.consent_date || undefined, digital_signature: f.digital_signature || undefined,
        assignment_release_signed: !!f.assignment_release_signed, assignment_release_signature: f.assignment_signature || undefined,
        auth_release_name: f.auth_name || undefined, auth_release_address: f.auth_address || undefined,
        auth_release_city: f.auth_city || undefined, auth_release_state: f.auth_state || undefined,
        auth_release_all_records: !!f.auth_all_records, auth_release_chart_notes: !!f.auth_chart_notes,
        auth_release_radiology_reports: !!f.auth_radiology, auth_release_operative_reports: !!f.auth_operative,
        auth_release_history_physicals: !!f.auth_history_physicals,
      } : undefined;

    return {
      demographics: {
        first_name: f.first_name.trim(), middle_name: f.middle_name || undefined, last_name: f.last_name.trim(),
        date_of_birth: `${f.dob}T00:00:00`, gender: f.gender, blood_group: f.blood_group || undefined,
        marital_status: f.marital_status || undefined, ssn: f.ssn || undefined,
      },
      contact: {
        phone_primary: f.phone_primary.trim(), phone_secondary: f.cell_phone || undefined, email: f.email || undefined,
        preferred_contact: 'phone', preferred_pharmacy: f.preferred_pharmacy || undefined, address,
      },
      allergies: allergyList,
      emergency_contacts: (f.ec_name && f.ec_phone) ? [{ name: f.ec_name, relationship: f.ec_relationship || undefined, phone: f.ec_phone, is_primary: true }] : [],
      medical_summary,
      insurance: mkInsurance('ins1'),
      secondary_insurance: mkInsurance('ins2'),
      employer,
      responsible_party,
      social_history: social,
      patient_flags: flags,
      consents_legal: consents,
      dnr_status: f.dnr ? 'dnr_dni' : undefined,
      external_primary_doctor_name: f.primary_doctor || undefined,
      organization_id: user?.organization_id,
      intake_session_id: params.intake_session_id || undefined,
    };
  }

  async function save() {
    let body: any;
    try { body = buildBody(); } catch (e: any) { Alert.alert('Missing info', e.message); return; }
    if (!body.organization_id) { Alert.alert('Error', 'Your account has no organization.'); return; }
    setSaving(true);
    try {
      const res = await api.post('/patients', body);
      const id = res.data.data.patient_id;
      // Post patient safety alerts (separate API, after create)
      for (const al of alerts) {
        try { await api.post(`/patients/${id}/patient-alerts`, { alert_type: al.alert_type, description: al.description || undefined }); } catch { /* best-effort */ }
      }
      if (files.length) await uploadFiles(id);
      qc.invalidateQueries({ queryKey: ['patients'] });
      Alert.alert('Registered', `Patient created${files.length ? ` with ${files.length} file(s)` : ''}.`, [{ text: 'View Patient', onPress: () => router.replace(`/patient/${id}`) }]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to register patient'));
    } finally { setSaving(false); }
  }

  const key = TABS[tab].key;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Register Patient" subtitle={`${TABS[tab].label} · ${tab + 1}/${TABS.length}`} />

      {/* Tab bar */}
      <View style={styles.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t.key} onPress={() => setTab(i)} style={[styles.tabChip, i === tab && styles.tabChipActive]}>
              <Icon name={t.icon} size={14} color={i === tab ? colors.white : colors.inkSoft} />
              <AppText style={[styles.tabText, i === tab && styles.tabTextActive]}>{t.label}</AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {key === 'info' && (
          <>
            <Group title="Patient Name">
              <Row><Input label="First Name *" value={f.first_name} onChangeText={(v) => set('first_name', v)} containerStyle={styles.half} />
                <Input label="Middle Name" value={f.middle_name} onChangeText={(v) => set('middle_name', v)} containerStyle={styles.half} /></Row>
              <Input label="Last Name *" value={f.last_name} onChangeText={(v) => set('last_name', v)} containerStyle={styles.gap} />
            </Group>
            <Group title="Address">
              <Input label="Street Address" value={f.addr_street} onChangeText={(v) => set('addr_street', v)} containerStyle={styles.gap} />
              <Row><Input label="City" value={f.addr_city} onChangeText={(v) => set('addr_city', v)} containerStyle={styles.half} />
                <Input label="State" value={f.addr_state} onChangeText={(v) => set('addr_state', v)} containerStyle={styles.half} /></Row>
              <Row><Input label="Home Phone *" value={f.phone_primary} onChangeText={(v) => set('phone_primary', v)} keyboardType="phone-pad" containerStyle={styles.half} />
                <Input label="Cell Phone" value={f.cell_phone} onChangeText={(v) => set('cell_phone', v)} keyboardType="phone-pad" containerStyle={styles.half} /></Row>
              <Input label="Email Address" value={f.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" containerStyle={styles.gap} />
            </Group>
            <Group title="Personal Information">
              <Input label="Date of Birth * (YYYY-MM-DD)" value={f.dob} onChangeText={(v) => set('dob', v)} placeholder="1990-01-31" containerStyle={styles.gap} />
              <Input label="Patient SSN" value={f.ssn} onChangeText={(v) => set('ssn', v)} containerStyle={styles.gap} />
              <Select label="Blood Group" options={BLOOD} value={f.blood_group} onChange={(v) => set('blood_group', v)} containerStyle={styles.gap} />
              <Select label="Sex *" options={GENDER} value={f.gender} onChange={(v) => set('gender', v)} containerStyle={styles.gap} />
              <Select label="Marital Status" options={MARITAL} value={f.marital_status} onChange={(v) => set('marital_status', v)} />
            </Group>
            <Group title="Patient Employer">
              <Row><Input label="Employer Name" value={f.emp_name} onChangeText={(v) => set('emp_name', v)} containerStyle={styles.half} />
                <Input label="Employer Phone" value={f.emp_phone} onChangeText={(v) => set('emp_phone', v)} keyboardType="phone-pad" containerStyle={styles.half} /></Row>
              <Input label="Street Address" value={f.emp_street} onChangeText={(v) => set('emp_street', v)} containerStyle={styles.gap} />
              <Row><Input label="City" value={f.emp_city} onChangeText={(v) => set('emp_city', v)} containerStyle={styles.half} />
                <Input label="State" value={f.emp_state} onChangeText={(v) => set('emp_state', v)} containerStyle={styles.half} /></Row>
            </Group>
            <CheckRow label="DNR / DNI Status (Do Not Resuscitate / Do Not Intubate)" checked={!!f.dnr} onToggle={() => toggle('dnr')} />
          </>
        )}

        {key === 'insurance' && (
          <>
            {(['ins1', 'ins2'] as const).map((p) => (
              <Group key={p} title={p === 'ins1' ? 'Primary Insurance' : 'Secondary Insurance'}>
                <Input label="Insurance Name" value={f[`${p}_name`]} onChangeText={(v) => set(`${p}_name`, v)} containerStyle={styles.gap} />
                <Input label="Street Address" value={f[`${p}_street`]} onChangeText={(v) => set(`${p}_street`, v)} containerStyle={styles.gap} />
                <Row><Input label="City" value={f[`${p}_city`]} onChangeText={(v) => set(`${p}_city`, v)} containerStyle={styles.half} />
                  <Input label="State" value={f[`${p}_state`]} onChangeText={(v) => set(`${p}_state`, v)} containerStyle={styles.half} /></Row>
                <Row><Input label="Phone" value={f[`${p}_phone`]} onChangeText={(v) => set(`${p}_phone`, v)} keyboardType="phone-pad" containerStyle={styles.half} />
                  <Input label="Group Number" value={f[`${p}_group`]} onChangeText={(v) => set(`${p}_group`, v)} containerStyle={styles.half} /></Row>
                <Input label="ID / Policy Number" value={f[`${p}_policy`]} onChangeText={(v) => set(`${p}_policy`, v)} containerStyle={styles.gap} />
                <Row><Input label="Employer" value={f[`${p}_employer`]} onChangeText={(v) => set(`${p}_employer`, v)} containerStyle={styles.half} />
                  <Input label="Employer Phone" value={f[`${p}_employer_phone`]} onChangeText={(v) => set(`${p}_employer_phone`, v)} keyboardType="phone-pad" containerStyle={styles.half} /></Row>
              </Group>
            ))}
            <Group title="Responsible Party Information">
              <Select label="Relation to Patient" options={REL_TO_PATIENT} value={f.rp_relation} onChange={(v) => set('rp_relation', v)} containerStyle={styles.gap} />
              <Row><Input label="First Name" value={f.rp_first} onChangeText={(v) => set('rp_first', v)} containerStyle={styles.half} />
                <Input label="Last Name" value={f.rp_last} onChangeText={(v) => set('rp_last', v)} containerStyle={styles.half} /></Row>
              <Input label="Middle Initial" value={f.rp_mi} onChangeText={(v) => set('rp_mi', v)} containerStyle={styles.gap} />
              <Input label="Address (if different from patient)" value={f.rp_address} onChangeText={(v) => set('rp_address', v)} containerStyle={styles.gap} />
              <Row><Input label="Home Phone" value={f.rp_home_phone} onChangeText={(v) => set('rp_home_phone', v)} keyboardType="phone-pad" containerStyle={styles.half} />
                <Input label="Work Phone" value={f.rp_work_phone} onChangeText={(v) => set('rp_work_phone', v)} keyboardType="phone-pad" containerStyle={styles.half} /></Row>
              <Input label="Employer" value={f.rp_employer} onChangeText={(v) => set('rp_employer', v)} />
            </Group>
          </>
        )}

        {key === 'medical' && (
          <>
            <Group title="Preferred Pharmacy">
              <Input value={f.preferred_pharmacy} onChangeText={(v) => set('preferred_pharmacy', v)} placeholder="Pharmacy name" />
            </Group>
            <Group title="Allergies">
              <CheckGrid options={ALLERGY_OPTIONS} selected={allergies} onToggle={(v) => toggleSet(allergies, setAllergies, v)} />
              <Input label="Other" value={allergyOther} onChangeText={setAllergyOther} containerStyle={{ marginTop: spacing.sm }} />
            </Group>
            <Group title="Family History">
              <View style={styles.matrixHead}>
                <AppText style={[styles.matrixCond, styles.matrixHeadText]}>Condition</AppText>
                {['Mother', 'Father', 'Sibling'].map((r) => <AppText key={r} style={[styles.matrixCell, styles.matrixHeadText]}>{r}</AppText>)}
              </View>
              {FAMILY_CONDITIONS.map((cond) => (
                <View key={cond} style={styles.matrixRow}>
                  <AppText style={styles.matrixCond}>{cond}</AppText>
                  {(['mother', 'father', 'sibling'] as const).map((r) => (
                    <TouchableOpacity key={r} style={styles.matrixCell} onPress={() => setFamily((p) => ({ ...p, [cond]: { ...p[cond], [r]: !p[cond]?.[r] } }))}>
                      <Icon name={family[cond]?.[r] ? 'checkbox' : 'square-outline'} size={20} color={family[cond]?.[r] ? colors.primary : colors.inkFaint} />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </Group>
            <Group title="Social History">
              <Input label="Occupation" value={f.soc_occupation} onChangeText={(v) => set('soc_occupation', v)} containerStyle={styles.gap} />
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <CheckRow label="Retired" checked={!!f.soc_retired} onToggle={() => toggle('soc_retired')} />
                <CheckRow label="Disabled" checked={!!f.soc_disabled} onToggle={() => toggle('soc_disabled')} />
              </View>
              <Input label="Alcohol use" value={f.soc_alcohol} onChangeText={(v) => set('soc_alcohol', v)} placeholder="e.g. Weekly / None" containerStyle={styles.gap} />
              <Input label="Tobacco use" value={f.soc_tobacco} onChangeText={(v) => set('soc_tobacco', v)} placeholder="e.g. Smoke / None" />
            </Group>
            <Group title="Surgical History">
              {surgeries.map((s, i) => (
                <View key={i} style={styles.repeatCard}>
                  <RepeatHeader label={`Surgery ${i + 1}`} onRemove={() => setSurgeries(surgeries.filter((_, j) => j !== i))} />
                  <Input label="Type of Surgery" value={s.procedure_name} onChangeText={(v) => updateAt(setSurgeries, surgeries, i, { procedure_name: v })} containerStyle={styles.gap} />
                  <Row><Input label="Year or Date" value={s.date} onChangeText={(v) => updateAt(setSurgeries, surgeries, i, { date: v })} containerStyle={styles.half} />
                    <Input label="Doctor" value={s.doctor} onChangeText={(v) => updateAt(setSurgeries, surgeries, i, { doctor: v })} containerStyle={styles.half} /></Row>
                  <Input label="Location" value={s.location} onChangeText={(v) => updateAt(setSurgeries, surgeries, i, { location: v })} />
                </View>
              ))}
              <AddRow label="Add row" onPress={() => setSurgeries([...surgeries, { procedure_name: '', date: '', doctor: '', location: '' }])} />
            </Group>
            <Group title="Medical History — have you ever had any of the following?">
              <CheckGrid options={MEDICAL_HISTORY} selected={conditions} onToggle={(v) => toggleSet(conditions, setConditions, v)} />
            </Group>
            <Group title="Medications — currently taking">
              {medications.map((m, i) => (
                <View key={i} style={styles.repeatCard}>
                  <RepeatHeader label={`Medication ${i + 1}`} onRemove={() => setMedications(medications.filter((_, j) => j !== i))} />
                  <Input label="Name" value={m.name} onChangeText={(v) => updateAt(setMedications, medications, i, { name: v })} containerStyle={styles.gap} />
                  <Row><Input label="Dosage" value={m.dosage} onChangeText={(v) => updateAt(setMedications, medications, i, { dosage: v })} containerStyle={styles.half} />
                    <Input label="Frequency" value={m.frequency} onChangeText={(v) => updateAt(setMedications, medications, i, { frequency: v })} containerStyle={styles.half} /></Row>
                </View>
              ))}
              <AddRow label="Add medication" onPress={() => setMedications([...medications, { name: '', dosage: '', frequency: '' }])} />
            </Group>
          </>
        )}

        {key === 'physicians' && (
          <>
            <Group title="Physicians">
              <Input label="Primary Doctor" value={f.primary_doctor} onChangeText={(v) => set('primary_doctor', v)} containerStyle={styles.gap} />
              <Input label="Family Doctor" value={f.family_doctor} onChangeText={(v) => set('family_doctor', v)} containerStyle={styles.gap} />
              <Input label="Referring Doctor" value={f.referring_doctor} onChangeText={(v) => set('referring_doctor', v)} />
            </Group>
            <Group title="In Case of Emergency Contact">
              <Row><Input label="Contact Name" value={f.ec_name} onChangeText={(v) => set('ec_name', v)} containerStyle={styles.half} />
                <Input label="Relationship" value={f.ec_relationship} onChangeText={(v) => set('ec_relationship', v)} containerStyle={styles.half} /></Row>
              <Input label="Phone Number" value={f.ec_phone} onChangeText={(v) => set('ec_phone', v)} keyboardType="phone-pad" containerStyle={styles.gap} />
            </Group>
          </>
        )}

        {key === 'consents' && (
          <>
            <Group title="Consents & Legal Documents">
              <CheckRow label="Treatment Consent — Signed" checked={!!f.treatment_consent} onToggle={() => toggle('treatment_consent')} />
              <CheckRow label="Privacy / HIPAA Consent — Signed" checked={!!f.privacy_hipaa_consent} onToggle={() => toggle('privacy_hipaa_consent')} />
              <CheckRow label="Data Sharing Consent — Signed" checked={!!f.data_sharing_consent} onToggle={() => toggle('data_sharing_consent')} />
              <CheckRow label="Financial Responsibility Agreement — Signed" checked={!!f.financial_responsibility_agreement} onToggle={() => toggle('financial_responsibility_agreement')} />
              <Input label="Consent Date (YYYY-MM-DD)" value={f.consent_date} onChangeText={(v) => set('consent_date', v)} containerStyle={{ marginTop: spacing.sm, marginBottom: spacing.md }} />
              <Input label="Digital Signature" value={f.digital_signature} onChangeText={(v) => set('digital_signature', v)} placeholder="Type full name as signature" />
            </Group>
            <Group title="Assignment and Release">
              <AppText style={styles.legalText}>I hereby authorize my insurance benefits be paid directly to the physician and I am financially responsible for non-covered services. I authorize release of information required to process claims.</AppText>
              <CheckRow label="I agree to the above terms" checked={!!f.assignment_release_signed} onToggle={() => toggle('assignment_release_signed')} />
              <Input label="Signature (patient or guardian)" value={f.assignment_signature} onChangeText={(v) => set('assignment_signature', v)} placeholder="Type full name as signature" />
            </Group>
            <Group title="Authorization to Release Health Information">
              <Input label="Release to (name)" value={f.auth_name} onChangeText={(v) => set('auth_name', v)} containerStyle={styles.gap} />
              <Input label="Address" value={f.auth_address} onChangeText={(v) => set('auth_address', v)} containerStyle={styles.gap} />
              <Row><Input label="City" value={f.auth_city} onChangeText={(v) => set('auth_city', v)} containerStyle={styles.half} />
                <Input label="State" value={f.auth_state} onChangeText={(v) => set('auth_state', v)} containerStyle={styles.half} /></Row>
              <AppText style={styles.subLabel}>Release the following information:</AppText>
              <CheckRow label="All Records" checked={!!f.auth_all_records} onToggle={() => toggle('auth_all_records')} />
              <CheckRow label="Chart Notes" checked={!!f.auth_chart_notes} onToggle={() => toggle('auth_chart_notes')} />
              <CheckRow label="Radiology Reports" checked={!!f.auth_radiology} onToggle={() => toggle('auth_radiology')} />
              <CheckRow label="Operative Reports" checked={!!f.auth_operative} onToggle={() => toggle('auth_operative')} />
              <CheckRow label="History & Physicals" checked={!!f.auth_history_physicals} onToggle={() => toggle('auth_history_physicals')} />
            </Group>
          </>
        )}

        {key === 'alerts' && (
          <Group title="Patient Safety Alerts">
            <AppText style={styles.legalText}>Add clinical safety alerts. These are visible to all staff and require acknowledgement on patient load.</AppText>
            <AlertAdder onAdd={(a) => setAlerts([...alerts, a])} />
            {alerts.map((a, i) => {
              const m = alertMeta(a.alert_type);
              return (
                <View key={i} style={[styles.alertChip, { backgroundColor: m.tint, borderColor: m.color }]}>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ color: m.color, fontFamily: font.semibold, fontSize: 13 }}>{m.label}</AppText>
                    {a.description ? <AppText style={{ color: colors.inkSoft, fontSize: 12, marginTop: 2 }}>{a.description}</AppText> : null}
                  </View>
                  <TouchableOpacity onPress={() => setAlerts(alerts.filter((_, j) => j !== i))} hitSlop={8}>
                    <Icon name="close-circle" size={20} color={m.color} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </Group>
        )}

        {key === 'upload' && (
          <Group title="Upload Files">
            <AppText style={styles.legalText}>Attach a photo of the registration form, ID, or insurance card. Files are uploaded to the patient's Medical Files after registration.</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <Button label="Camera" icon="camera-outline" variant="outline" size="sm" fullWidth={false} onPress={() => pickFile('camera')} style={{ flex: 1 }} />
              <Button label="Gallery" icon="image-outline" variant="outline" size="sm" fullWidth={false} onPress={() => pickFile('library')} style={{ flex: 1 }} />
            </View>
            {files.length === 0 ? (
              <View style={styles.uploadEmpty}>
                <Icon name="cloud-upload-outline" size={30} color={colors.inkFaint} />
                <AppText style={styles.legalText}>No files added yet.</AppText>
              </View>
            ) : files.map((file, i) => (
              <View key={i} style={styles.fileRow}>
                <Image source={{ uri: file.uri }} style={styles.thumb} />
                <AppText style={styles.fileName} numberOfLines={1}>{file.fileName ?? `Image ${i + 1}`}</AppText>
                <TouchableOpacity onPress={() => setFiles(files.filter((_, j) => j !== i))} hitSlop={8}>
                  <Icon name="close-circle" size={22} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </Group>
        )}

        {/* Nav footer */}
        <View style={styles.navRow}>
          <Button label="Previous" icon="chevron-back" variant="outline" fullWidth={false} onPress={() => setTab(Math.max(0, tab - 1))} disabled={tab === 0} style={{ flex: 1 }} />
          {tab < TABS.length - 1
            ? <Button label="Next" fullWidth={false} onPress={() => setTab(tab + 1)} style={{ flex: 1 }} />
            : <Button label="Register" icon="checkmark-circle-outline" fullWidth={false} onPress={save} loading={saving} style={{ flex: 1 }} />}
        </View>
        <Button label="Register Patient" icon="checkmark-circle-outline" onPress={save} loading={saving} variant="success" style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function anyOf(...vals: any[]) { return vals.some((v) => v != null && String(v).trim() !== ''); }

function buildFamily(fh?: any[]): Record<string, { mother?: boolean; father?: boolean; sibling?: boolean }> {
  const out: Record<string, { mother?: boolean; father?: boolean; sibling?: boolean }> = {};
  (fh ?? []).forEach((e: any) => {
    const cond = FAMILY_CONDITIONS.find((c) => c.toLowerCase() === String(e?.condition ?? '').toLowerCase());
    const rel = String(e?.relation ?? '').toLowerCase();
    if (cond && (rel === 'mother' || rel === 'father' || rel === 'sibling')) {
      out[cond] = { ...out[cond], [rel]: true };
    }
  });
  return out;
}

function buildConditions(cc?: any[]): Set<string> {
  const set = new Set<string>();
  (cc ?? []).forEach((c: any) => {
    const desc = String(typeof c === 'string' ? c : (c?.description ?? '')).toLowerCase().trim();
    if (!desc) return;
    const match = MEDICAL_HISTORY.find((o) => {
      const ol = o.toLowerCase();
      return ol === desc || desc.includes(ol);
    });
    if (match) set.add(match);
  });
  return set;
}

function buildSurgeries(ps?: any[]): Surgery[] {
  return (ps ?? []).map((s: any) => ({
    procedure_name: s?.procedure_name ?? (typeof s === 'string' ? s : '') ?? '',
    date: s?.date ?? '',
    doctor: s?.doctor ?? '',
    location: s?.location ?? s?.notes ?? '',
  })).filter((s: Surgery) => s.procedure_name);
}
function updateAt<T>(setter: (v: T[]) => void, arr: T[], i: number, patch: Partial<T>) { setter(arr.map((x, j) => (j === i ? { ...x, ...patch } : x))); }
function flatFromExtract(p: any): Record<string, any> {
  const d = p?.demographics ?? {}; const c = p?.contact ?? {}; const a = c?.address ?? {};
  const ins = p?.insurance ?? {}; const ia = ins?.address ?? {};
  const ins2 = p?.secondary_insurance ?? {}; const ia2 = ins2?.address ?? {};
  const emp = p?.employer ?? {}; const rp = p?.responsible_party ?? {};
  const soc = p?.social_history ?? {}; const ec = (p?.emergency_contacts ?? [])[0] ?? {};
  return {
    first_name: d.first_name ?? '', middle_name: d.middle_name ?? '', last_name: d.last_name ?? '',
    dob: (d.date_of_birth ?? '').slice(0, 10), gender: (d.gender ?? '').toLowerCase(), blood_group: d.blood_group ?? '',
    marital_status: (d.marital_status ?? '').toLowerCase(), ssn: d.ssn ?? '',
    phone_primary: c.phone_primary ?? '', cell_phone: c.phone_secondary ?? '', email: c.email ?? '', preferred_pharmacy: c.preferred_pharmacy ?? '',
    addr_street: a.street ?? '', addr_city: a.city ?? '', addr_state: a.state_province ?? '',
    // Primary insurance
    ins1_name: ins.provider ?? '', ins1_policy: ins.policy_number ?? '', ins1_group: ins.group_number ?? '', ins1_phone: ins.phone ?? '',
    ins1_employer: ins.employer ?? '', ins1_employer_phone: ins.employer_phone ?? '',
    ins1_street: ia.street ?? '', ins1_city: ia.city ?? '', ins1_state: ia.state_province ?? '',
    // Secondary insurance
    ins2_name: ins2.provider ?? '', ins2_policy: ins2.policy_number ?? '', ins2_group: ins2.group_number ?? '', ins2_phone: ins2.phone ?? '',
    ins2_street: ia2.street ?? '', ins2_city: ia2.city ?? '', ins2_state: ia2.state_province ?? '',
    // Employer
    emp_name: emp.name ?? '', emp_phone: emp.phone ?? '', emp_street: emp.street ?? '', emp_city: emp.city ?? '', emp_state: emp.state_province ?? '',
    // Responsible party
    rp_relation: (rp.relation ?? '').toLowerCase(), rp_first: rp.first_name ?? '', rp_last: rp.last_name ?? '', rp_mi: rp.middle_initial ?? '',
    rp_address: rp.address ?? '', rp_home_phone: rp.home_phone ?? '', rp_work_phone: rp.work_phone ?? '', rp_employer: rp.employer ?? '',
    // Physicians + emergency
    primary_doctor: p?.primary_doctor_name ?? '', referring_doctor: p?.referring_doctor_name ?? '',
    ec_name: ec.name ?? '', ec_relationship: ec.relationship ?? '', ec_phone: ec.phone ?? '',
    // Social
    soc_occupation: soc.occupation ?? '',
    soc_alcohol: soc.alcohol_consumption || (soc.alcohol_use ? `${soc.alcohol_use}${soc.alcohol_frequency ? ` (${soc.alcohol_frequency})` : ''}` : ''),
    soc_tobacco: soc.tobacco_use ? `${soc.tobacco_use}${soc.tobacco_type ? ` (${soc.tobacco_type})` : ''}` : '',
    dnr: !!p?.dnr_status && p.dnr_status !== 'full_code',
  };
}

// ── components ────────────────────────────────────────────────────────────────
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText style={styles.groupTitle}>{title}</AppText>
      {children}
    </View>
  );
}
function Row({ children }: { children: React.ReactNode }) { return <View style={styles.row}>{children}</View>; }
function CheckRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onToggle}>
      <Icon name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.primary : colors.inkFaint} />
      <AppText style={styles.checkLabel}>{label}</AppText>
    </TouchableOpacity>
  );
}
function CheckGrid({ options, selected, onToggle }: { options: string[]; selected: Set<string>; onToggle: (v: string) => void }) {
  return (
    <View style={styles.grid}>
      {options.map((o) => (
        <TouchableOpacity key={o} style={styles.gridItem} onPress={() => onToggle(o)}>
          <Icon name={selected.has(o) ? 'checkbox' : 'square-outline'} size={18} color={selected.has(o) ? colors.primary : colors.inkFaint} />
          <AppText style={styles.gridLabel}>{o}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function RepeatHeader({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.repeatHead}>
      <AppText style={styles.repeatLabel}>{label}</AppText>
      <TouchableOpacity onPress={onRemove} hitSlop={8}><Icon name="close-circle" size={20} color={colors.danger} /></TouchableOpacity>
    </View>
  );
}
function AlertAdder({ onAdd }: { onAdd: (a: { alert_type: string; description: string }) => void }) {
  const [type, setType] = useState('risk_violent_behavior');
  const [desc, setDesc] = useState('');
  return (
    <View style={styles.alertAdder}>
      <Select label="Alert Type" options={ALERT_TYPES.map((t) => ({ label: t.label, value: t.value }))} value={type} onChange={(v) => setType(v || 'risk_violent_behavior')} containerStyle={styles.gap} />
      <Input label="Description" value={desc} onChangeText={setDesc} placeholder="Optional details" containerStyle={styles.gap} />
      <Button label="Add Alert" icon="add" size="sm" onPress={() => { onAdd({ alert_type: type, description: desc }); setDesc(''); }} />
    </View>
  );
}

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.addRow} onPress={onPress}>
      <Icon name="add-circle-outline" size={18} color={colors.primary} />
      <AppText style={styles.addText}>{label}</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontFamily: font.medium, fontSize: 12, color: colors.inkSoft },
  tabTextActive: { color: colors.white },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg, marginBottom: spacing.md },
  groupTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  gap: { marginBottom: spacing.md },
  subLabel: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft, marginTop: spacing.sm, marginBottom: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  checkLabel: { fontFamily: font.regular, fontSize: 14, color: colors.ink, flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '50%', paddingVertical: 6 },
  gridLabel: { fontFamily: font.regular, fontSize: 12, color: colors.ink, flexShrink: 1 },
  matrixHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  matrixHeadText: { fontFamily: font.semibold, color: colors.inkSoft, fontSize: 11 },
  matrixRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  matrixCond: { flex: 1, fontFamily: font.regular, fontSize: 12, color: colors.ink },
  matrixCell: { width: 60, alignItems: 'center' },
  legalText: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft, lineHeight: 18, marginBottom: spacing.sm },
  repeatCard: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  repeatHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  repeatLabel: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addText: { fontFamily: font.medium, fontSize: 13, color: colors.primary },
  navRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  uploadEmpty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  fileName: { flex: 1, fontFamily: font.regular, fontSize: 13, color: colors.ink },
  alertAdder: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  alertChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
});

