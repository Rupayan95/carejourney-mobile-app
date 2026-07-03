import { useState } from 'react';
import {
  View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppointments, Appointment } from '../../src/hooks/useAppointments';
import { usePatient } from '../../src/hooks/usePatients';
import { parseBackendDate } from '../../src/lib/datetime';
import { useUser, isDoctor } from '../../src/context/UserContext';
import { catchUpJourneyForConfirm } from '../../src/lib/journey';
import { api } from '../../src/lib/api';
import { colors, spacing, radius, font } from '../../src/theme';
import {
  AppText, Card, StatusBadge, Button, Fab, FilterTabs, EmptyState,
} from '../../src/components/ui';

const STATUSES = ['all', 'scheduled', 'confirmed', 'completed', 'cancelled'];

function AppointmentCard({ item, canStartConsultation, onRefresh }: {
  item: Appointment; canStartConsultation: boolean; onRefresh: () => void;
}) {
  const router = useRouter();
  const dt = parseBackendDate(item.appointment_datetime) ?? new Date();
  const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isScheduled = item.status === 'scheduled';
  const canStart = canStartConsultation && ['scheduled', 'confirmed'].includes(item.status);

  const { data: patient } = usePatient(item.patient_id);
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : null;
  const { user: cardUser } = useUser();

  async function confirmAppointment() {
    try {
      await catchUpJourneyForConfirm(item.patient_id, item.appointment_id, cardUser?.organization_id);
      await api.patch(`/appointments/${item.appointment_id}/status`, { status: 'confirmed' });
      onRefresh();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to confirm'));
    }
  }

  async function startConsultation() {
    try {
      const res = await api.post('/consultations', {
        patient_id: item.patient_id,
        doctor_id: item.doctor_id,
        appointment_id: item.appointment_id,
        consultation_type: 'initial',
        modality: item.modality,
      });
      await api.patch(`/appointments/${item.appointment_id}/status`, { status: 'in_progress' }).catch(() => {});
      onRefresh();
      router.push(`/live-consultation/${res.data.data.consultation_id}`);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to start consultation'));
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.dateBox}>
          <AppText style={styles.dateDay}>{dt.getDate()}</AppText>
          <AppText style={styles.dateMon}>{dt.toLocaleString('default', { month: 'short' })}</AppText>
        </View>
        <View style={styles.cardBody}>
          <AppText style={styles.cardType}>{item.appointment_type.replace(/_/g, ' ')}</AppText>
          {patientName && <AppText style={styles.cardPatient} numberOfLines={1}>{patientName}</AppText>}
          <AppText style={styles.cardMeta}>{time} · {item.modality} · {item.duration_minutes} min</AppText>
          <AppText style={styles.cardMeta}>Payment: {item.payment_status}</AppText>
        </View>
        <StatusBadge status={item.status} />
      </View>

      {(isScheduled || canStart) && (
        <View style={styles.actionRow}>
          {isScheduled && (
            <Button label="Confirm" icon="checkmark" variant="outline" size="sm" fullWidth={false} onPress={confirmAppointment} style={{ flex: 1 }} />
          )}
          {canStart && (
            <Button label="Start Consultation" icon="play" variant="success" size="sm" fullWidth={false} onPress={startConsultation} style={{ flex: 1 }} />
          )}
        </View>
      )}
    </Card>
  );
}

export default function AppointmentsScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState('all');
  const { data: appointments, isLoading, refetch, isRefetching } = useAppointments(
    activeStatus !== 'all' ? { status: activeStatus } : undefined
  );

  const canCreate = ['receptionist', 'admin', 'physician', 'therapist', 'nurse'].includes(user?.role ?? '');

  return (
    <View style={styles.container}>
      {canCreate && <Fab label="New" onPress={() => router.push('/create-appointment')} />}

      <View style={styles.tabsWrapper}>
        <FilterTabs options={STATUSES} value={activeStatus} onChange={setActiveStatus} />
      </View>

      {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList
          data={appointments}
          keyExtractor={item => item.appointment_id}
          renderItem={({ item }) => (
            <AppointmentCard item={item} canStartConsultation={isDoctor(user?.role)} onRefresh={refetch} />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No appointments found" />}
          contentContainerStyle={{ paddingBottom: 90, paddingTop: spacing.sm, paddingHorizontal: spacing.lg }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabsWrapper: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  card: { marginBottom: spacing.md, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dateBox: {
    width: 48, alignItems: 'center',
    backgroundColor: colors.primaryTint, borderRadius: radius.md, paddingVertical: 8,
  },
  dateDay: { fontFamily: font.bold, fontSize: 18, color: colors.primaryDeep },
  dateMon: { fontFamily: font.medium, fontSize: 11, color: colors.primary, textTransform: 'uppercase' },
  cardBody: { flex: 1 },
  cardType: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, textTransform: 'capitalize' },
  cardPatient: { fontFamily: font.semibold, fontSize: 13, color: colors.primary, marginTop: 2 },
  cardMeta: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
