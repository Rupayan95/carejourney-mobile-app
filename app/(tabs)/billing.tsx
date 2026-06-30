import {
  View, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useInvoices } from '../../src/hooks/useBilling';
import { formatDate } from '../../src/lib/datetime';
import { colors, spacing, font } from '../../src/theme';
import {
  AppText, Card, StatusBadge, Icon, EmptyState,
} from '../../src/components/ui';

export default function BillingScreen() {
  const { data, isLoading, refetch, isRefetching } = useInvoices();

  return (
    <View style={styles.container}>
      {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList
          data={data}
          keyExtractor={i => i.invoice_id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No invoices found" />}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.icon}>
                <Icon name="receipt" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.amount}>{item.currency} {item.grand_total.toFixed(2)}</AppText>
                {item.due_amount > 0 && (
                  <AppText style={styles.due}>Due: {item.currency} {item.due_amount.toFixed(2)}</AppText>
                )}
                <AppText style={styles.meta}>{formatDate(item.created_at)}</AppText>
              </View>
              <StatusBadge status={item.payment_status} />
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  amount: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  due: { fontFamily: font.medium, fontSize: 12, color: colors.danger, marginTop: 2 },
  meta: { fontFamily: font.regular, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
});
