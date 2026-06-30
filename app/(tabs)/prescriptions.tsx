import { useState } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePrescriptions } from '../../src/hooks/usePrescriptions';
import { useUser } from '../../src/context/UserContext';
import { api } from '../../src/lib/api';
import { formatDate } from '../../src/lib/datetime';
import { colors, spacing, font } from '../../src/theme';
import {
  AppText, Card, StatusBadge, Button, Fab, Input, Icon, EmptyState,
} from '../../src/components/ui';

export default function PrescriptionsScreen() {
  const { user } = useUser();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = usePrescriptions();
  const [showCreate, setShowCreate] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!patientId.trim() || !drugName.trim()) {
      Alert.alert('Error', 'Patient ID and drug name are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/prescriptions', {
        patient_id: patientId.trim(),
        doctor_id: user?.doctor_id,
        medications: [{
          drug_name: drugName.trim(),
          dosage: dosage || undefined,
          frequency: frequency || undefined,
          duration: duration || undefined,
          instructions: instructions || undefined,
        }],
        validate_safety: true,
      });
      setShowCreate(false);
      setPatientId(''); setDrugName(''); setDosage('');
      setFrequency(''); setDuration(''); setInstructions('');
      refetch();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to create prescription'));
    } finally { setSaving(false); }
  }

  return (
    <View style={styles.container}>
      {['physician', 'therapist'].includes(user?.role ?? '') && (
        <Fab label="New Rx" onPress={() => setShowCreate(true)} />
      )}

      {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList
          data={data}
          keyExtractor={i => i.prescription_id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="medical-outline" title="No prescriptions found" />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90 }}
          renderItem={({ item }) => (
            <Card style={styles.card} onPress={() => router.push(`/prescription/${item.prescription_id}`)}>
              <View style={styles.rxIcon}>
                <Icon name="medical" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.cardTitle}>{item.medication_count} medication{item.medication_count !== 1 ? 's' : ''}</AppText>
                <AppText style={styles.cardMeta}>{formatDate(item.created_at)} · Refills: {item.refills_allowed}</AppText>
              </View>
              <StatusBadge status={item.status} />
            </Card>
          )}
        />
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <AppText style={styles.modalTitle}>New Prescription</AppText>
          <Input label="Patient ID *" value={patientId} onChangeText={setPatientId} placeholder="Enter patient ID" autoCapitalize="none" containerStyle={styles.gap} />
          <Input label="Drug Name *" value={drugName} onChangeText={setDrugName} placeholder="e.g. Amoxicillin 500mg" containerStyle={styles.gap} />
          <Input label="Dosage" value={dosage} onChangeText={setDosage} placeholder="e.g. 500mg" containerStyle={styles.gap} />
          <Input label="Frequency" value={frequency} onChangeText={setFrequency} placeholder="e.g. Twice daily" containerStyle={styles.gap} />
          <Input label="Duration" value={duration} onChangeText={setDuration} placeholder="e.g. 7 days" containerStyle={styles.gap} />
          <Input label="Instructions" value={instructions} onChangeText={setInstructions} placeholder="Take with food..." multiline containerStyle={styles.gap} style={{ height: 80, textAlignVertical: 'top' }} />
          <Button label="Create Prescription" onPress={handleCreate} loading={saving} style={{ marginTop: spacing.sm }} />
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
            <AppText style={styles.cancelText}>Cancel</AppText>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  rxIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  cardMeta: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  modal: { flex: 1, padding: spacing.xxl, backgroundColor: colors.surface },
  modalTitle: { fontFamily: font.bold, fontSize: 22, color: colors.ink, marginBottom: spacing.xl, marginTop: spacing.sm },
  gap: { marginBottom: spacing.md },
  cancelBtn: { marginTop: spacing.md, alignItems: 'center', padding: spacing.md },
  cancelText: { fontFamily: font.medium, color: colors.inkSoft, fontSize: 14 },
});
