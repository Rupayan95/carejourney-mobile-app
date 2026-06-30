import { useState } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useConsultations } from '../../src/hooks/useConsultations';
import { useUser } from '../../src/context/UserContext';
import { api } from '../../src/lib/api';
import { formatDateTime } from '../../src/lib/datetime';
import { colors, spacing, radius, font } from '../../src/theme';
import {
  AppText, Card, StatusBadge, Button, Fab, Icon, EmptyState,
} from '../../src/components/ui';

const TYPES = ['consultation', 'follow_up', 'intake', 'procedure', 'emergency', 'group_therapy', 'telemedicine'];

export default function ConsultationsScreen() {
  const { user } = useUser();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useConsultations();
  const [showCreate, setShowCreate] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [type, setType] = useState('consultation');
  const [complaint, setComplaint] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!patientId.trim()) { Alert.alert('Error', 'Patient ID is required'); return; }
    setSaving(true);
    try {
      await api.post('/consultations', {
        patient_id: patientId.trim(),
        doctor_id: user?.doctor_id,
        consultation_type: type,
        clinical_notes: complaint ? { subjective: { chief_complaint: complaint } } : undefined,
      });
      setShowCreate(false);
      setPatientId(''); setType('consultation'); setComplaint('');
      refetch();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to create consultation'));
    } finally { setSaving(false); }
  }

  return (
    <View style={styles.container}>
      <Fab label="New" onPress={() => setShowCreate(true)} />

      {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList
          data={data}
          keyExtractor={i => i.consultation_id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="medkit-outline" title="No consultations found" />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90 }}
          renderItem={({ item }) => {
            const isActive = item.status === 'in_progress';
            const isCompleted = item.status === 'completed';
            function handlePress() {
              if (isActive) router.push(`/live-consultation/${item.consultation_id}`);
              else router.push(`/consultation/${item.consultation_id}`);
            }
            return (
              <Card style={styles.card} onPress={handlePress}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.cardTitle}>{item.consultation_type.replace(/_/g, ' ')}</AppText>
                    {item.chief_complaint ? <AppText style={styles.cardSub} numberOfLines={1}>{item.chief_complaint}</AppText> : null}
                    <AppText style={styles.cardMeta}>{item.start_time ? formatDateTime(item.start_time) : 'Not started'}</AppText>
                  </View>
                  <StatusBadge status={item.status} />
                </View>
                {(isActive || isCompleted) && (
                  <View style={[styles.hintRow, { borderTopColor: colors.borderSoft }]}>
                    <Icon name={isActive ? 'play-circle-outline' : 'document-text-outline'} size={14} color={isActive ? colors.warning : colors.primary} />
                    <AppText style={[styles.hint, { color: isActive ? colors.warning : colors.primary }]}>
                      {isActive ? 'Tap to resume consultation' : 'Tap to view history'}
                    </AppText>
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <AppText style={styles.modalTitle}>New Consultation</AppText>

          <AppText style={styles.label}>Patient ID *</AppText>
          <TextInput style={styles.input} value={patientId} onChangeText={setPatientId}
            placeholder="Enter patient ID" placeholderTextColor={colors.inkFaint} autoCapitalize="none" />

          <AppText style={styles.label}>Type</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            {TYPES.map(t => (
              <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
                <AppText style={[styles.chipText, type === t && styles.chipTextActive]}>{t.replace(/_/g, ' ')}</AppText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <AppText style={styles.label}>Chief Complaint</AppText>
          <TextInput style={[styles.input, styles.textarea]} value={complaint}
            onChangeText={setComplaint} placeholder="Patient's main complaint..."
            placeholderTextColor={colors.inkFaint} multiline numberOfLines={3} />

          <Button label="Create Consultation" onPress={handleCreate} loading={saving} style={{ marginTop: spacing.sm }} />
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
  card: { marginBottom: spacing.md, padding: spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.ink, textTransform: 'capitalize' },
  cardSub: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  cardMeta: { fontFamily: font.regular, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
  hint: { fontFamily: font.medium, fontSize: 12 },
  modal: { flex: 1, padding: spacing.xxl, backgroundColor: colors.surface },
  modalTitle: { fontFamily: font.bold, fontSize: 22, color: colors.ink, marginBottom: spacing.xxl, marginTop: spacing.sm },
  label: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 14, fontFamily: font.regular,
    color: colors.ink, backgroundColor: colors.surface, marginBottom: spacing.lg,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, textTransform: 'capitalize' },
  chipTextActive: { color: colors.white },
  cancelBtn: { marginTop: spacing.md, alignItems: 'center', padding: spacing.md },
  cancelText: { fontFamily: font.medium, color: colors.inkSoft, fontSize: 14 },
});
