import {
  View, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Alert,
} from 'react-native';
import { useState } from 'react';
import { useLabOrders } from '../../src/hooks/useLab';
import { useUser } from '../../src/context/UserContext';
import { api } from '../../src/lib/api';
import { formatDate } from '../../src/lib/datetime';
import { colors, spacing, font } from '../../src/theme';
import {
  AppText, Card, StatusBadge, Button, Fab, Input, Icon, EmptyState,
} from '../../src/components/ui';

export default function LabScreen() {
  const { user } = useUser();
  const { data, isLoading, refetch, isRefetching } = useLabOrders();
  const [showCreate, setShowCreate] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [testName, setTestName] = useState('');
  const [priority, setPriority] = useState('routine');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!patientId.trim() || !testName.trim()) {
      Alert.alert('Error', 'Patient ID and test name are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/lab/orders', {
        patient_id: patientId.trim(),
        ordering_doctor_id: user?.doctor_id,
        tests: [{ name: testName.trim() }],
        priority,
      });
      setShowCreate(false);
      setPatientId(''); setTestName(''); setPriority('routine');
      refetch();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to create lab order'));
    } finally { setSaving(false); }
  }

  return (
    <View style={styles.container}>
      {['physician', 'therapist', 'lab_technician'].includes(user?.role ?? '') && (
        <Fab label="New Order" onPress={() => setShowCreate(true)} />
      )}

      {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList
          data={data}
          keyExtractor={i => i.lab_order_id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="flask-outline" title="No lab orders found" />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90 }}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.icon}>
                <Icon name="flask" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.cardTitle}>Lab Order</AppText>
                <AppText style={styles.cardMeta}>{formatDate(item.created_at)}</AppText>
                {item.completed_at && <AppText style={styles.cardMeta}>Completed: {formatDate(item.completed_at)}</AppText>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <StatusBadge status={item.priority} />
                <StatusBadge status={item.status} />
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <AppText style={styles.modalTitle}>New Lab Order</AppText>
          <Input label="Patient ID *" value={patientId} onChangeText={setPatientId} placeholder="Enter patient ID" autoCapitalize="none" containerStyle={styles.gap} />
          <Input label="Test Name *" value={testName} onChangeText={setTestName} placeholder="e.g. Complete Blood Count" containerStyle={styles.gap} />

          <AppText style={styles.label}>Priority</AppText>
          <View style={styles.row}>
            {['routine', 'urgent', 'stat'].map(p => (
              <TouchableOpacity key={p} style={[styles.chip, priority === p && styles.chipActive]} onPress={() => setPriority(p)}>
                <AppText style={[styles.chipText, priority === p && styles.chipTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>

          <Button label="Create Order" onPress={handleCreate} loading={saving} style={{ marginTop: spacing.sm }} />
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
            <AppText style={styles.cancelText}>Cancel</AppText>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  cardMeta: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft },
  chipTextActive: { color: colors.white },
  modal: { flex: 1, padding: spacing.xxl, backgroundColor: colors.surface },
  modalTitle: { fontFamily: font.bold, fontSize: 22, color: colors.ink, marginBottom: spacing.xl, marginTop: spacing.sm },
  label: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
  gap: { marginBottom: spacing.md },
  cancelBtn: { marginTop: spacing.md, alignItems: 'center', padding: spacing.md },
  cancelText: { fontFamily: font.medium, color: colors.inkSoft, fontSize: 14 },
});
