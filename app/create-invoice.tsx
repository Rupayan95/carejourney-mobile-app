import { useState, useEffect } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../src/lib/api';
import { usePatients, usePatient } from '../src/hooks/usePatients';
import { useDoctors } from '../src/hooks/useDoctors';
import { colors, spacing, radius, font } from '../src/theme';
import { AppText, Input, Button, Icon, ScreenHeader, Card, Select } from '../src/components/ui';

interface Item { description: string; unit_price: string; quantity: string }

const CONSULT_TYPES = [
  { value: 'initial', label: 'Initial Consultation' },
  { value: 'follow_up', label: 'Follow-up Consultation' },
  { value: 'emergency', label: 'Emergency Consultation' },
  { value: 'telemedicine', label: 'Telemedicine' },
];
// Map an appointment type onto an invoice consultation type.
const APPT_TO_CONSULT: Record<string, string> = { initial: 'initial', follow_up: 'follow_up', check_up: 'follow_up', emergency: 'emergency', urgent: 'emergency', telemedicine: 'telemedicine' };

export default function CreateInvoiceScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ patient_id?: string; consultation_id?: string }>();

  const [patientId, setPatientId] = useState<string | undefined>(params.patient_id);
  const [search, setSearch] = useState('');
  const { data: patients } = usePatients(search || undefined);
  const { data: patient } = usePatient(patientId);

  const [items, setItems] = useState<Item[]>([{ description: 'Consultation fee', unit_price: '', quantity: '1' }]);
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [saving, setSaving] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | undefined>();
  const [autoConsultId, setAutoConsultId] = useState<string | undefined>();
  const [doctorId, setDoctorId] = useState<string | undefined>();
  const [consultType, setConsultType] = useState('initial');
  const { data: doctors } = useDoctors();
  const doctor = doctors?.find((d: any) => d.doctor_id === doctorId);

  // Pull the patient's latest appointment/consultation to pre-select doctor,
  // type and linked ids — like the web invoice form.
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    (async () => {
      try {
        const appts = (await api.get('/appointments', { params: { patient_id: patientId, limit: 10 } })).data?.data?.appointments ?? [];
        const latest = [...appts].sort((a: any, b: any) => new Date(b.appointment_datetime).getTime() - new Date(a.appointment_datetime).getTime())[0];
        if (cancelled || !latest) return;
        setAppointmentId(latest.appointment_id);
        if (latest.doctor_id) setDoctorId(latest.doctor_id);
        if (latest.appointment_type) setConsultType(APPT_TO_CONSULT[latest.appointment_type] ?? 'initial');
        if (!params.consultation_id) {
          const cons = (await api.get('/consultations', { params: { patient_id: patientId, limit: 1 } })).data?.data?.consultations ?? [];
          if (!cancelled && cons[0]) { setAutoConsultId(cons[0].consultation_id); if (cons[0].doctor_id) setDoctorId(cons[0].doctor_id); }
        }
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // Auto-fill line item 1 from the doctor's fee for the chosen consultation type.
  useEffect(() => {
    if (!doctor) return;
    const fee = doctor.consultation_fees?.[consultType] ?? doctor.consultation_fee;
    if (fee == null) return;
    const label = CONSULT_TYPES.find((t) => t.value === consultType)?.label ?? 'Consultation';
    const description = `${label} – Dr. ${doctor.full_name}`;
    setItems((prev) => {
      if (prev.length === 0) return [{ description, unit_price: String(fee), quantity: '1' }];
      const next = [...prev];
      next[0] = { ...next[0], description, unit_price: String(fee) };
      return next;
    });
  }, [doctorId, consultType, doctors]);

  const subtotal = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  async function generate() {
    if (!patientId) { Alert.alert('Select patient', 'Choose a patient first.'); return; }
    const valid = items.filter((it) => it.description.trim() && Number(it.unit_price) > 0);
    if (!valid.length) { Alert.alert('No items', 'Add at least one line item with a price.'); return; }
    setSaving(true);
    try {
      await api.post('/billing/invoices', {
        patient_id: patientId,
        consultation_id: params.consultation_id || autoConsultId || undefined,
        appointment_id: appointmentId || undefined,
        items: valid.map((it) => ({
          description: it.description.trim(),
          unit_price: Number(it.unit_price),
          quantity: Number(it.quantity) || 1,
          amount: (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
        })),
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
      });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['patient-journey', patientId] });
      Alert.alert('Invoice created', 'The invoice was generated and the patient journey advanced to Billing.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to create invoice'));
    } finally { setSaving(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Generate Invoice" subtitle="Billing" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Patient */}
        <Card style={{ marginBottom: spacing.md }}>
          <AppText style={styles.label}>Patient</AppText>
          {patientId ? (
            <View style={styles.patientRow}>
              <Icon name="person-circle-outline" size={22} color={colors.primary} />
              <AppText style={styles.patientName}>{patient ? `${patient.first_name} ${patient.last_name}` : patientId}</AppText>
              {!params.patient_id && (
                <TouchableOpacity onPress={() => setPatientId(undefined)} hitSlop={8}><Icon name="close-circle" size={20} color={colors.inkFaint} /></TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <View style={styles.searchField}>
                <Icon name="search" size={18} color={colors.inkFaint} />
                <TextInput style={styles.searchInput} placeholder="Search patient…" placeholderTextColor={colors.inkFaint} value={search} onChangeText={setSearch} autoCapitalize="none" />
              </View>
              {(patients ?? []).slice(0, 6).map((p) => (
                <TouchableOpacity key={p.patient_id} style={styles.patientOption} onPress={() => { setPatientId(p.patient_id); setSearch(''); }}>
                  <AppText style={styles.patientOptionText}>{p.first_name} {p.last_name}</AppText>
                  <AppText style={styles.patientOptionSub}>{p.gender} · {p.phone_primary}</AppText>
                </TouchableOpacity>
              ))}
            </>
          )}
        </Card>

        {/* Doctor & Consultation */}
        <Card style={{ marginBottom: spacing.md }}>
          <AppText style={styles.label}>Doctor & Consultation</AppText>
          <Select
            label="Doctor"
            options={(doctors ?? []).map((d: any) => ({ label: `Dr. ${d.full_name}${d.specialization ? ` — ${d.specialization}` : ''}`, value: d.doctor_id }))}
            value={doctorId}
            onChange={(v) => setDoctorId(v || undefined)}
            containerStyle={{ marginBottom: spacing.md }}
          />
          <Select
            label="Consultation Type"
            options={CONSULT_TYPES.map((t) => {
              const fee = doctor?.consultation_fees?.[t.value] ?? (doctor ? doctor.consultation_fee : undefined);
              return { label: `${t.label}${fee != null ? ` — ₹${fee}` : ''}`, value: t.value };
            })}
            value={consultType}
            onChange={(v) => setConsultType(v || 'initial')}
          />
          {doctor && (
            <AppText style={styles.feeHint}>Fee auto-filled from Dr. {doctor.full_name}'s schedule.</AppText>
          )}
        </Card>

        {/* Line items */}
        <Card style={{ marginBottom: spacing.md }}>
          <AppText style={styles.label}>Line Items</AppText>
          {items.map((it, i) => (
            <View key={i} style={styles.itemCard}>
              <View style={styles.itemHead}>
                <AppText style={styles.itemNum}>Item {i + 1}</AppText>
                {items.length > 1 && <TouchableOpacity onPress={() => setItems(items.filter((_, j) => j !== i))} hitSlop={8}><Icon name="close-circle" size={18} color={colors.danger} /></TouchableOpacity>}
              </View>
              <Input value={it.description} onChangeText={(v) => updateItem(i, { description: v })} placeholder="Description" containerStyle={{ marginBottom: spacing.sm }} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Input value={it.unit_price} onChangeText={(v) => updateItem(i, { unit_price: v })} placeholder="Unit price" keyboardType="numeric" containerStyle={{ flex: 2 }} />
                <Input value={it.quantity} onChangeText={(v) => updateItem(i, { quantity: v })} placeholder="Qty" keyboardType="numeric" containerStyle={{ flex: 1 }} />
              </View>
              <AppText style={styles.lineTotal}>Amount: {((Number(it.unit_price) || 0) * (Number(it.quantity) || 0)).toFixed(2)}</AppText>
            </View>
          ))}
          <TouchableOpacity style={styles.addRow} onPress={() => setItems([...items, { description: '', unit_price: '', quantity: '1' }])}>
            <Icon name="add-circle-outline" size={18} color={colors.primary} />
            <AppText style={styles.addText}>Add item</AppText>
          </TouchableOpacity>
        </Card>

        {/* Totals */}
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Input label="Discount" value={discount} onChangeText={setDiscount} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            <Input label="Tax" value={tax} onChangeText={setTax} keyboardType="numeric" containerStyle={{ flex: 1 }} />
          </View>
          <View style={styles.totalRow}><AppText style={styles.totalLabel}>Subtotal</AppText><AppText style={styles.totalVal}>{subtotal.toFixed(2)}</AppText></View>
          <View style={styles.totalRow}><AppText style={styles.grandLabel}>Grand Total</AppText><AppText style={styles.grandVal}>{total.toFixed(2)}</AppText></View>
        </Card>

        <Button label="Generate Invoice" icon="receipt-outline" onPress={generate} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.semibold, fontSize: 13, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.md },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  patientName: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  searchField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, fontFamily: font.regular, color: colors.ink },
  patientOption: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  patientOptionText: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
  patientOptionSub: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  itemCard: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  itemNum: { fontFamily: font.semibold, fontSize: 12, color: colors.inkSoft },
  lineTotal: { fontFamily: font.medium, fontSize: 12, color: colors.inkSoft, marginTop: 6, textAlign: 'right' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addText: { fontFamily: font.medium, fontSize: 13, color: colors.primary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  totalLabel: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft },
  totalVal: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
  grandLabel: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  grandVal: { fontFamily: font.bold, fontSize: 18, color: colors.primary },
  feeHint: { fontFamily: font.regular, fontSize: 12, color: colors.primary, marginTop: 8 },
});
