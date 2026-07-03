import { useState } from 'react';
import { View, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUser, isNurse, isDoctor, isAdmin } from '../context/UserContext';
import { usePatientVitals, VitalEntry } from '../hooks/usePatientVitals';
import { formatDate } from '../lib/datetime';
import { colors, spacing, radius, font } from '../theme';
import { AppText, Card, Button, Input, Icon, Badge } from './ui';
import { IconName } from './ui/Icon';

const METRICS: { key: keyof VitalEntry; label: string; unit: string; icon: IconName; color: string }[] = [
  { key: 'bp', label: 'Blood Pressure', unit: 'mmHg', icon: 'heart', color: colors.danger },
  { key: 'hr', label: 'Heart Rate', unit: 'bpm', icon: 'pulse', color: colors.success },
  { key: 'spo2', label: 'SpO₂', unit: '%', icon: 'water', color: colors.info },
  { key: 'temp', label: 'Temperature', unit: '°', icon: 'thermometer', color: colors.warning },
  { key: 'rr', label: 'Resp. Rate', unit: '/min', icon: 'cloud-outline', color: colors.primary },
  { key: 'weight', label: 'Weight', unit: 'kg', icon: 'barbell-outline', color: colors.secondary },
  { key: 'height', label: 'Height', unit: 'cm', icon: 'resize-outline', color: colors.secondary },
  { key: 'bmi', label: 'BMI', unit: '', icon: 'body-outline', color: colors.primaryDeep },
];

function metricValue(entry: VitalEntry, key: keyof VitalEntry): string {
  const v = entry[key];
  if (v == null || v === '') return '—';
  if (key === 'temp') return `${v}${entry.tempUnit ? `°${entry.tempUnit}` : ''}`;
  return String(v);
}

type Severity = { color: string; tint: string; label: string } | null;

const SEV = {
  normal: { color: colors.success, tint: colors.successTint, label: 'Normal' },
  borderline: { color: colors.warning, tint: colors.warningTint, label: 'Borderline' },
  critical: { color: colors.danger, tint: colors.dangerTint, label: 'Critical' },
} as const;

/**
 * Clinical criticality color-coding — mirrors the web app's adult-norm ranges
 * (green normal, amber borderline, red low/high).
 */
function severityFor(key: keyof VitalEntry, e: VitalEntry): Severity {
  switch (key) {
    case 'bp': {
      if (!e.bp) return null;
      const [s, d] = e.bp.split('/').map(Number);
      if (isNaN(s) || isNaN(d)) return null;
      if (s >= 140 || d >= 90 || s < 90 || d < 60) return SEV.critical;
      if (s >= 120 || d >= 80) return SEV.borderline;
      return SEV.normal;
    }
    case 'hr': {
      const hr = e.hr; if (hr == null) return null;
      if (hr < 50 || hr > 120) return SEV.critical;
      if (hr < 60 || hr > 100) return SEV.borderline;
      return SEV.normal;
    }
    case 'spo2': {
      const v = e.spo2; if (v == null) return null;
      if (v < 90) return SEV.critical;
      if (v < 95) return SEV.borderline;
      return SEV.normal;
    }
    case 'temp': {
      const t = e.temp; if (t == null) return null;
      const u = (e.tempUnit ?? '').toLowerCase();
      const c = u === 'f' || u === 'fahrenheit' ? ((t - 32) * 5) / 9 : t;
      if (c >= 38.4 || c < 35) return SEV.critical;
      if (c >= 37.6 || c < 36) return SEV.borderline;
      return SEV.normal;
    }
    case 'rr': {
      const rr = e.rr; if (rr == null) return null;
      if (rr < 10 || rr > 24) return SEV.critical;
      if (rr < 12 || rr > 20) return SEV.borderline;
      return SEV.normal;
    }
    default:
      return null; // height / weight / bmi — no criticality coding
  }
}

export function VitalsSection({ patientId }: { patientId: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const { data: entries, isLoading, refetch, isRefetching } = usePatientVitals(patientId);
  const [showAdd, setShowAdd] = useState(false);

  const canAdd = isNurse(user?.role) || isDoctor(user?.role) || isAdmin(user?.role);
  const latest = entries?.[0];
  const history = entries?.slice(1) ?? [];

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={styles.headerRow}>
        <AppText style={styles.heading}>Recent Vitals</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => refetch()} hitSlop={8} style={styles.iconBtn}>
            {isRefetching ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="refresh" size={18} color={colors.primary} />}
          </TouchableOpacity>
          {canAdd && (
            <Button label="Add Vital" icon="add" size="sm" fullWidth={false} onPress={() => setShowAdd(true)} />
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
      ) : latest ? (
        <>
          {latest.date && <AppText style={styles.recordedAt}>Recorded {formatDate(latest.date)}</AppText>}
          <View style={styles.grid}>
            {METRICS.map((m) => {
              const sev = severityFor(m.key, latest);
              return (
                <View key={m.key} style={[styles.metricCard, sev && { borderLeftColor: sev.color, borderLeftWidth: 3 }]}>
                  <View style={styles.metricTop}>
                    <Icon name={m.icon} size={14} color={sev?.color ?? m.color} />
                    <AppText style={styles.metricUnit}>{m.unit}</AppText>
                  </View>
                  <AppText style={[styles.metricValue, sev && { color: sev.color }]}>{metricValue(latest, m.key)}</AppText>
                  <View style={styles.metricBottom}>
                    <AppText style={styles.metricLabel}>{m.label}</AppText>
                    {sev && (
                      <View style={styles.sevRow}>
                        <View style={[styles.dot, { backgroundColor: sev.color }]} />
                        <AppText style={[styles.sevLabel, { color: sev.color }]}>{sev.label}</AppText>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <Card style={styles.emptyCard}>
          <Icon name="pulse-outline" size={28} color={colors.inkFaint} />
          <AppText style={styles.emptyText}>No vitals recorded yet</AppText>
        </Card>
      )}

      {history.length > 0 && (
        <>
          <AppText style={[styles.heading, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>History</AppText>
          {history.map((e) => (
            <Card key={e.id} style={styles.historyCard}>
              <AppText style={styles.historyDate}>{e.date ? formatDate(e.date) : '—'}</AppText>
              <View style={styles.historyChips}>
                {e.bp && <SevBadge label={`BP ${e.bp}`} sev={severityFor('bp', e)} />}
                {e.hr != null && <SevBadge label={`HR ${e.hr}`} sev={severityFor('hr', e)} />}
                {e.spo2 != null && <SevBadge label={`SpO₂ ${e.spo2}`} sev={severityFor('spo2', e)} />}
                {e.temp != null && <SevBadge label={`T ${e.temp}°${e.tempUnit ?? ''}`} sev={severityFor('temp', e)} />}
                {e.rr != null && <SevBadge label={`RR ${e.rr}`} sev={severityFor('rr', e)} />}
              </View>
            </Card>
          ))}
        </>
      )}

      <AddVitalModal
        visible={showAdd}
        patientId={patientId}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['patient-vitals', patientId] });
          qc.invalidateQueries({ queryKey: ['patient', patientId] });
        }}
      />
    </View>
  );
}

function SevBadge({ label, sev }: { label: string; sev: Severity }) {
  const color = sev?.color ?? colors.inkSoft;
  const tint = sev?.tint ?? colors.borderSoft;
  return <Badge label={label} color={color} tint={tint} />;
}

function AddVitalModal({ visible, patientId, onClose, onSaved }: {
  visible: boolean; patientId: string; onClose: () => void; onSaved: () => void;
}) {
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [hr, setHr] = useState('');
  const [rr, setRr] = useState('');
  const [temp, setTemp] = useState('');
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('F');
  const [spo2, setSpo2] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const bmi = height && weight
    ? (Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1)
    : '';

  function reset() {
    setSys(''); setDia(''); setHr(''); setRr(''); setTemp('');
    setSpo2(''); setHeight(''); setWeight(''); setTempUnit('F');
  }

  async function save() {
    const body: Record<string, any> = {};
    if (sys && dia) body.blood_pressure = { systolic: Number(sys), diastolic: Number(dia), unit: 'mmHg' };
    if (hr) body.heart_rate = Number(hr);
    if (rr) body.respiratory_rate = Number(rr);
    if (temp) { body.temperature = Number(temp); body.temperature_unit = tempUnit; }
    if (spo2) body.oxygen_saturation = { value: Number(spo2), unit: '%', room_air: true };
    if (height) body.height = Number(height);
    if (weight) body.weight = Number(weight);
    if (bmi) body.bmi = Number(bmi);

    if (Object.keys(body).length === 0) {
      Alert.alert('Nothing to save', 'Enter at least one vital measurement.');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/patients/${patientId}/vitals`, body);
      onSaved();
      reset();
      onClose();
      Alert.alert('Saved', 'Vitals recorded.');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to record vitals'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <AppText style={styles.modalTitle}>Add Vitals</AppText>

        <View style={styles.row}>
          <Input label="BP Systolic" value={sys} onChangeText={setSys} keyboardType="numeric" placeholder="120" containerStyle={styles.half} />
          <Input label="BP Diastolic" value={dia} onChangeText={setDia} keyboardType="numeric" placeholder="80" containerStyle={styles.half} />
        </View>
        <View style={styles.row}>
          <Input label="Heart Rate (bpm)" value={hr} onChangeText={setHr} keyboardType="numeric" placeholder="74" containerStyle={styles.half} />
          <Input label="Resp. Rate (/min)" value={rr} onChangeText={setRr} keyboardType="numeric" placeholder="18" containerStyle={styles.half} />
        </View>
        <View style={styles.row}>
          <Input label="SpO₂ (%)" value={spo2} onChangeText={setSpo2} keyboardType="numeric" placeholder="98" containerStyle={styles.half} />
          <View style={styles.half}>
            <AppText style={styles.tempLabel}>Temperature</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Input value={temp} onChangeText={setTemp} keyboardType="numeric" placeholder="98.6" containerStyle={{ flex: 1 }} />
              <View style={styles.unitToggle}>
                {(['C', 'F'] as const).map((u) => (
                  <TouchableOpacity key={u} onPress={() => setTempUnit(u)} style={[styles.unitBtn, tempUnit === u && styles.unitBtnActive]}>
                    <AppText style={[styles.unitText, tempUnit === u && styles.unitTextActive]}>°{u}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
        <View style={styles.row}>
          <Input label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="170" containerStyle={styles.half} />
          <Input label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="68" containerStyle={styles.half} />
        </View>
        {!!bmi && (
          <View style={styles.bmiRow}>
            <Icon name="body-outline" size={16} color={colors.primary} />
            <AppText style={styles.bmiText}>BMI: {bmi}</AppText>
          </View>
        )}

        <Button label="Save Vitals" onPress={save} loading={saving} style={{ marginTop: spacing.lg }} />
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <AppText style={styles.cancelText}>Cancel</AppText>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  heading: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryTint },
  recordedAt: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: {
    width: '47.5%', backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md,
  },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricUnit: { fontFamily: font.regular, fontSize: 10, color: colors.inkFaint },
  metricValue: { fontFamily: font.bold, fontSize: 22, color: colors.ink, marginTop: 4 },
  metricBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  metricLabel: { fontFamily: font.regular, fontSize: 11, color: colors.inkSoft, flexShrink: 1 },
  sevRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sevLabel: { fontFamily: font.semibold, fontSize: 10 },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { fontFamily: font.regular, fontSize: 13, color: colors.inkFaint },
  historyCard: { padding: spacing.md, marginBottom: spacing.sm },
  historyDate: { fontFamily: font.semibold, fontSize: 13, color: colors.ink, marginBottom: 6 },
  historyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modal: { flex: 1, padding: spacing.xxl, backgroundColor: colors.surface },
  modalTitle: { fontFamily: font.bold, fontSize: 22, color: colors.ink, marginBottom: spacing.xl, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  half: { flex: 1 },
  tempLabel: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
  unitToggle: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  unitBtn: { paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.surface },
  unitBtnActive: { backgroundColor: colors.primary },
  unitText: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft },
  unitTextActive: { color: colors.white },
  bmiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  bmiText: { fontFamily: font.semibold, fontSize: 14, color: colors.primary },
  cancelBtn: { marginTop: spacing.md, alignItems: 'center', padding: spacing.md },
  cancelText: { fontFamily: font.medium, color: colors.inkSoft, fontSize: 14 },
});
