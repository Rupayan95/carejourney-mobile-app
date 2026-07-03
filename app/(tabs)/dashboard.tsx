import {
  View, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppointments, Appointment } from '../../src/hooks/useAppointments';
import { usePatient } from '../../src/hooks/usePatients';
import { parseBackendDate } from '../../src/lib/datetime';
import { api } from '../../src/lib/api';
import { useUser } from '../../src/context/UserContext';
import { catchUpJourneyForConfirm } from '../../src/lib/journey';
import { clearTokens } from '../../src/lib/auth';
import { colors, spacing, radius, font, shadow } from '../../src/theme';
import {
  AppText, Card, StatusBadge, Button, Avatar, Icon, EmptyState,
} from '../../src/components/ui';

function AppointmentCard({ item, canStartConsult, onRefresh }: {
  item: Appointment; canStartConsult: boolean; onRefresh: () => void;
}) {
  const router = useRouter();
  const dt = parseBackendDate(item.appointment_datetime);
  const time = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const isScheduled = item.status === 'scheduled';
  const canStart = canStartConsult && ['scheduled', 'confirmed'].includes(item.status);

  const { data: patient } = usePatient(item.patient_id);
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : item.patient_id;
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
      <View style={styles.cardTop}>
        <View style={styles.timePill}>
          <Icon name="time-outline" size={13} color={colors.primary} />
          <AppText style={styles.timeText}>{time}</AppText>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.patientRow}>
        <Avatar name={patientName} size={38} />
        <View style={{ flex: 1 }}>
          <AppText style={styles.patientName} numberOfLines={1}>{patientName}</AppText>
          <AppText style={styles.cardMeta}>
            {item.appointment_type.replace(/_/g, ' ')} · {item.modality} · {item.duration_minutes} min
          </AppText>
        </View>
      </View>

      {(isScheduled || canStart) && (
        <View style={styles.actionRow}>
          {isScheduled && (
            <Button label="Confirm" icon="checkmark" variant="outline" size="sm" fullWidth={false} onPress={confirmAppointment} style={{ flex: 1 }} />
          )}
          {canStart && (
            <Button label="Start" icon="play" variant="success" size="sm" fullWidth={false} onPress={startConsultation} style={{ flex: 1 }} />
          )}
        </View>
      )}
    </Card>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useUser();
  const today = new Date().toISOString().split('T')[0];
  const { data: appointments, isLoading, refetch, isRefetching } = useAppointments({ date: today });

  async function handleLogout() {
    await clearTokens();
    router.replace('/(auth)/login');
  }

  const scheduled = appointments?.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length ?? 0;
  const completed = appointments?.filter(a => a.status === 'completed').length ?? 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0] ?? 'there'}</AppText>
          <AppText style={styles.date}>{new Date().toDateString()} · {user?.role?.replace(/_/g, ' ')}</AppText>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={8}>
          <Icon name="log-out-outline" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { num: scheduled, label: 'Upcoming' },
          { num: completed, label: 'Completed' },
          { num: appointments?.length ?? 0, label: 'Total Today' },
        ].map((s, i) => (
          <View key={s.label} style={[styles.statBox, i < 2 && styles.statDivider]}>
            <AppText style={styles.statNum}>{s.num}</AppText>
            <AppText style={styles.statLabel}>{s.label}</AppText>
          </View>
        ))}
      </View>

      <AppText style={styles.sectionTitle}>Today's Appointments</AppText>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={item => item.appointment_id}
          renderItem={({ item }) => (
            <AppointmentCard
              item={item}
              canStartConsult={['physician', 'therapist', 'admin'].includes(user?.role ?? '')}
              onRefresh={refetch}
            />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="calendar-clear-outline" title="No appointments today" subtitle="New appointments will appear here." />}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: spacing.xs }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 28,
    borderBottomLeftRadius: 22, borderBottomRightRadius: 22, ...shadow.header,
  },
  greeting: { fontFamily: font.bold, fontSize: 22, color: colors.white },
  date: { fontFamily: font.regular, fontSize: 13, color: '#CDE7EE', marginTop: 2, textTransform: 'capitalize' },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row', backgroundColor: colors.surface,
    marginHorizontal: spacing.lg, marginTop: -18, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft, ...shadow.card,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg },
  statDivider: { borderRightWidth: 1, borderRightColor: colors.borderSoft },
  statNum: { fontFamily: font.bold, fontSize: 24, color: colors.primary },
  statLabel: { fontFamily: font.regular, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  sectionTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.ink, marginHorizontal: spacing.lg, marginTop: spacing.xxl, marginBottom: spacing.md },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  timeText: { fontFamily: font.semibold, fontSize: 13, color: colors.primaryDeep },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  patientName: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  cardMeta: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginTop: 2, textTransform: 'capitalize' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
