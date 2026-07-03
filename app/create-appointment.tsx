import { colors } from '../src/theme';
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, FlatList, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePatients } from '../src/hooks/usePatients';
import { useDoctors, useAvailableSlots } from '../src/hooks/useDoctors';
import { useUser } from '../src/context/UserContext';
import { api } from '../src/lib/api';
import { DatePicker } from '../src/components/ui';

const TYPES = ['initial', 'follow_up', 'urgent', 'emergency', 'check_up'];
const MODALITIES = ['in_person', 'virtual', 'hybrid'];

export default function CreateAppointmentScreen() {
  const router = useRouter();
  const { user } = useUser();

  // Selected values
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [apptType, setApptType] = useState('consultation');
  const [modality, setModality] = useState('in_person');
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [charge, setCharge] = useState('');

  // Auto-fill the appointment charge from the doctor's fee schedule by type.
  useEffect(() => {
    if (!selectedDoctor) return;
    const map: Record<string, string> = { initial: 'initial', follow_up: 'follow_up', emergency: 'emergency', urgent: 'emergency', check_up: 'follow_up' };
    const fees = selectedDoctor.consultation_fees;
    let fee: number | undefined;
    if (fees) fee = fees[map[apptType] ?? 'initial'];
    else if (selectedDoctor.consultation_fee != null) fee = selectedDoctor.consultation_fee;
    if (fee != null) setCharge(String(fee));
  }, [selectedDoctor, apptType]);

  // Search states
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showDoctorModal, setShowDoctorModal] = useState(false);

  const [saving, setSaving] = useState(false);

  const { data: patients } = usePatients(patientSearch || undefined);
  const { data: doctors } = useDoctors();
  const { data: slots, isLoading: slotsLoading } = useAvailableSlots(
    selectedDoctor?.doctor_id ?? '',
    selectedDate,
    duration,
  );

  const filteredDoctors = doctors?.filter(d =>
    d.full_name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
    (d.specialization ?? '').toLowerCase().includes(doctorSearch.toLowerCase())
  ) ?? [];

  async function handleCreate() {
    if (!selectedPatient) { Alert.alert('Error', 'Please select a patient'); return; }
    if (!selectedDoctor) { Alert.alert('Error', 'Please select a doctor'); return; }
    if (!selectedSlot && !selectedDate) { Alert.alert('Error', 'Please select a date and time slot'); return; }

    const apptDatetime = selectedSlot
      ? `${selectedDate}T${selectedSlot.start_time}`
      : `${selectedDate}T09:00:00`;

    setSaving(true);
    try {
      // Ensure an active journey exists first — the backend advances it
      // ONBOARD → APPOINTMENT when the appointment is created, but only if a
      // journey exists (it never auto-creates one). Mirrors the web flow.
      try {
        const jr = await api.get('/journeys', { params: { patient_id: selectedPatient.patient_id, limit: 1 } });
        const active = (jr.data?.data?.journeys ?? [])[0];
        const needsNew = !active || ['completed', 'cancelled', 'on_hold'].includes(active.status);
        if (needsNew && user?.organization_id) {
          await api.post('/journeys', { patient_id: selectedPatient.patient_id, organization_id: user.organization_id });
        }
      } catch {
        // Non-fatal — proceed with the appointment even if journey setup fails.
      }

      await api.post('/appointments', {
        patient_id: selectedPatient.patient_id,
        doctor_id: selectedDoctor.doctor_id,
        appointment_datetime: new Date(apptDatetime).toISOString(),
        appointment_type: apptType,
        modality,
        duration_minutes: duration,
        estimated_fee: charge ? Number(charge) : undefined,
        reason: reason || undefined,
      });
      Alert.alert('Success', 'Appointment created successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join('\n')
        : (detail ?? 'Failed to create appointment');
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.pageTitle}>New Appointment</Text>

      {/* Patient Selector */}
      <Text style={styles.label}>Patient *</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setShowPatientModal(true)}>
        {selectedPatient ? (
          <View>
            <Text style={styles.selectorValue}>{selectedPatient.first_name} {selectedPatient.last_name}</Text>
            <Text style={styles.selectorMeta}>{selectedPatient.phone_primary}</Text>
          </View>
        ) : (
          <Text style={styles.selectorPlaceholder}>Search and select patient...</Text>
        )}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* Doctor Selector */}
      <Text style={styles.label}>Doctor *</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setShowDoctorModal(true)}>
        {selectedDoctor ? (
          <View>
            <Text style={styles.selectorValue}>{selectedDoctor.title ? selectedDoctor.title + ' ' : ''}{selectedDoctor.full_name}</Text>
            <Text style={styles.selectorMeta}>{selectedDoctor.specialization ?? selectedDoctor.department ?? ''}</Text>
          </View>
        ) : (
          <Text style={styles.selectorPlaceholder}>Search and select doctor...</Text>
        )}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* Date */}
      <Text style={styles.label}>Date *</Text>
      <DatePicker
        value={selectedDate}
        onChange={v => { setSelectedDate(v); setSelectedSlot(null); }}
        placeholder="Select appointment date"
      />

      {/* Time Slots */}
      {selectedDoctor && selectedDate ? (
        <View style={styles.slotsSection}>
          <Text style={styles.label}>Available Slots</Text>
          {slotsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : slots && slots.filter(s => s.available).length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {slots.filter(s => s.available).map((slot, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.slotBtn, selectedSlot === slot && styles.slotBtnActive]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text style={[styles.slotText, selectedSlot === slot && styles.slotTextActive]}>
                    {slot.start_time.slice(0, 5)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noSlots}>No available slots for this date</Text>
          )}
        </View>
      ) : null}

      {/* Duration */}
      <Text style={styles.label}>Duration (minutes)</Text>
      <View style={styles.row}>
        {[15, 30, 45, 60].map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, duration === d && styles.chipActive]}
            onPress={() => setDuration(d)}
          >
            <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>{d} min</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Type */}
      <Text style={styles.label}>Appointment Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {TYPES.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, apptType === t && styles.chipActive]}
            onPress={() => setApptType(t)}
          >
            <Text style={[styles.chipText, apptType === t && styles.chipTextActive]}>
              {t.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Modality */}
      <Text style={styles.label}>Modality</Text>
      <View style={styles.row}>
        {MODALITIES.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, modality === m && styles.chipActive]}
            onPress={() => setModality(m)}
          >
            <Text style={[styles.chipText, modality === m && styles.chipTextActive]}>
              {m.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Appointment Charge */}
      <Text style={styles.label}>Appointment Charge (INR)</Text>
      <TextInput
        style={styles.input}
        value={charge}
        onChangeText={setCharge}
        placeholder="Auto-filled from doctor's fee"
        placeholderTextColor="#aaa"
        keyboardType="numeric"
      />

      {/* Reason */}
      <Text style={styles.label}>Reason for Visit</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={reason}
        onChangeText={setReason}
        placeholder="Describe the reason..."
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.btn, saving && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Create Appointment</Text>
        }
      </TouchableOpacity>
      <View style={{ height: 40 }} />

      {/* Patient Search Modal */}
      <Modal visible={showPatientModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Select Patient</Text>
          <TextInput
            style={styles.searchInput}
            value={patientSearch}
            onChangeText={setPatientSearch}
            placeholder="Search by name..."
            placeholderTextColor="#aaa"
            autoFocus
          />
          <FlatList
            data={patients ?? []}
            keyExtractor={i => i.patient_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => { setSelectedPatient(item); setShowPatientModal(false); }}
              >
                <View style={styles.listAvatar}>
                  <Text style={styles.listAvatarText}>{item.first_name[0]}{item.last_name[0]}</Text>
                </View>
                <View>
                  <Text style={styles.listItemName}>{item.first_name} {item.last_name}</Text>
                  <Text style={styles.listItemMeta}>{item.phone_primary} · {item.gender}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No patients found</Text>}
          />
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPatientModal(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Doctor Search Modal */}
      <Modal visible={showDoctorModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Select Doctor</Text>
          <TextInput
            style={styles.searchInput}
            value={doctorSearch}
            onChangeText={setDoctorSearch}
            placeholder="Search by name or specialization..."
            placeholderTextColor="#aaa"
            autoFocus
          />
          <FlatList
            data={filteredDoctors}
            keyExtractor={i => i.doctor_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => { setSelectedDoctor(item); setShowDoctorModal(false); }}
              >
                <View style={[styles.listAvatar, { backgroundColor: colors.successTint }]}>
                  <Text style={[styles.listAvatarText, { color: colors.success }]}>
                    {item.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.listItemName}>
                    {item.title ? item.title + ' ' : ''}{item.full_name}
                  </Text>
                  <Text style={styles.listItemMeta}>
                    {[item.specialization, item.department].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No doctors found</Text>}
          />
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDoctorModal(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 24, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 },
  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  selectorValue: { fontSize: 15, fontWeight: '600', color: '#111' },
  selectorMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  selectorPlaceholder: { fontSize: 14, color: '#aaa' },
  chevron: { fontSize: 20, color: '#aaa' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: '#111', backgroundColor: '#fff', marginBottom: 16,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  slotsSection: { marginBottom: 16 },
  slotBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.primaryTint, marginRight: 8, borderWidth: 1, borderColor: colors.border,
  },
  slotBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  slotTextActive: { color: '#fff' },
  noSlots: { color: '#aaa', fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.primaryTint, marginRight: 8, marginBottom: 4,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: '#555', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  btn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modal: { flex: 1, padding: 20, backgroundColor: '#fff' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 16, marginTop: 8 },
  searchInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: '#111', backgroundColor: colors.surfaceAlt, marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  listAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  listAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  listItemName: { fontSize: 15, fontWeight: '600', color: '#111' },
  listItemMeta: { fontSize: 12, color: '#888', marginTop: 2, textTransform: 'capitalize' },
  empty: { color: '#aaa', textAlign: 'center', marginTop: 40, fontSize: 14 },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#888', fontSize: 15 },
});
