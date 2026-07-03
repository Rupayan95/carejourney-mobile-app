import { useState } from 'react';
import {
  View, StyleSheet, FlatList, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePatients, Patient } from '../../src/hooks/usePatients';
import { useUser } from '../../src/context/UserContext';
import { colors, spacing, radius, font } from '../../src/theme';
import {
  AppText, Card, Avatar, StatusBadge, Icon, EmptyState, Fab,
} from '../../src/components/ui';

function PatientCard({ item, onPress }: { item: Patient; onPress: () => void }) {
  const age = item.date_of_birth
    ? Math.floor((Date.now() - new Date(item.date_of_birth).getTime()) / 3.156e10)
    : null;
  const name = `${item.first_name} ${item.last_name}`;

  return (
    <Card style={styles.card} onPress={onPress}>
      <Avatar name={name} size={46} />
      <View style={styles.cardBody}>
        <AppText style={styles.name} numberOfLines={1}>{name}</AppText>
        <AppText style={styles.meta}>
          {item.gender}{age ? ` · ${age}y` : ''}{item.blood_group ? ` · ${item.blood_group}` : ''}
        </AppText>
        <View style={styles.phoneRow}>
          <Icon name="call-outline" size={12} color={colors.inkFaint} />
          <AppText style={styles.phone}>{item.phone_primary}</AppText>
        </View>
      </View>
      <StatusBadge status={item.status} />
    </Card>
  );
}

export default function PatientsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [search, setSearch] = useState('');
  const { data: patients, isLoading, refetch, isRefetching } = usePatients(search || undefined);

  const canRegister = ['receptionist', 'admin', 'physician', 'therapist', 'nurse'].includes(user?.role ?? '');

  return (
    <View style={styles.container}>
      {canRegister && <Fab label="New" icon="person-add" onPress={() => router.push('/register/methods')} />}
      <View style={styles.searchBar}>
        <View style={styles.searchField}>
          <Icon name="search" size={18} color={colors.inkFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients..."
            placeholderTextColor={colors.inkFaint}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={patients}
          keyExtractor={item => item.patient_id}
          renderItem={({ item }) => (
            <PatientCard item={item} onPress={() => router.push(`/patient/${item.patient_id}`)} />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={search ? `No patients for "${search}"` : 'No patients found'}
            />
          }
          contentContainerStyle={{ paddingBottom: 90, paddingTop: spacing.md }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchBar: { backgroundColor: colors.surface, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, fontFamily: font.regular, color: colors.ink },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md },
  cardBody: { flex: 1 },
  name: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginTop: 2, textTransform: 'capitalize' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  phone: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft },
});
