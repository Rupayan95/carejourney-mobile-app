import { useState } from 'react';
import {
  View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useInvoices } from '../../src/hooks/useBilling';
import { useUser, isBilling, isAdmin, isReceptionist } from '../../src/context/UserContext';
import { api } from '../../src/lib/api';
import { printInvoiceById } from '../../src/lib/invoice-print';
import { formatDate } from '../../src/lib/datetime';
import { colors, spacing, font } from '../../src/theme';
import {
  AppText, Card, StatusBadge, Icon, EmptyState, Fab,
} from '../../src/components/ui';

export default function BillingScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { data, isLoading, refetch, isRefetching } = useInvoices();
  const canCreate = isBilling(user?.role) || isAdmin(user?.role) || isReceptionist(user?.role);

  return (
    <View style={styles.container}>
      {canCreate && <Fab label="New Invoice" icon="receipt-outline" onPress={() => router.push('/create-invoice')} />}
      {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList
          data={data}
          keyExtractor={i => i.invoice_id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No invoices found" />}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => <InvoiceCard item={item} canPay={canCreate} onRefresh={refetch} />}
        />
      )}
    </View>
  );
}

function InvoiceCard({ item, canPay, onRefresh }: { item: any; canPay: boolean; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const isPaid = item.payment_status === 'paid';

  async function viewReceipt() {
    setPdfLoading(true);
    try { await printInvoiceById(item.invoice_id); }
    catch (e: any) { Alert.alert('Error', e?.message ?? 'Could not open the receipt.'); }
    finally { setPdfLoading(false); }
  }

  async function markPaid() {
    const amount = item.due_amount > 0 ? item.due_amount : item.grand_total;
    setPaying(true);
    try {
      await api.post('/billing/payments', { invoice_id: item.invoice_id, payment_amount: amount, payment_method: 'cash' });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['patient-journey', item.patient_id] });
      onRefresh();
      Alert.alert('Paid', 'Payment recorded. The visit is complete.');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert('Error', Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : (detail ?? 'Failed to record payment'));
    } finally { setPaying(false); }
  }

  return (
    <Card style={styles.card2}>
      <View style={styles.cardTop}>
        <View style={styles.icon}><Icon name="receipt" size={20} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={styles.amount}>{item.currency} {item.grand_total.toFixed(2)}</AppText>
          {item.due_amount > 0 && <AppText style={styles.due}>Due: {item.currency} {item.due_amount.toFixed(2)}</AppText>}
          <AppText style={styles.meta}>{formatDate(item.created_at)}</AppText>
        </View>
        <StatusBadge status={item.payment_status} />
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.receiptBtn} onPress={viewReceipt} disabled={pdfLoading}>
          {pdfLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <AppText style={styles.receiptText}>📄 View Receipt</AppText>}
        </TouchableOpacity>
        {canPay && !isPaid && (
          <TouchableOpacity style={styles.payBtn} onPress={markPaid} disabled={paying}>
            {paying ? <ActivityIndicator size="small" color={colors.white} /> : <AppText style={styles.payText}>✓ Mark as Paid</AppText>}
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  amount: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  due: { fontFamily: font.medium, fontSize: 12, color: colors.danger, marginTop: 2 },
  meta: { fontFamily: font.regular, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  card2: { marginBottom: spacing.md, padding: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  receiptBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryTint },
  receiptText: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },
  payBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: colors.success },
  payText: { fontFamily: font.semibold, fontSize: 13, color: colors.white },
});
