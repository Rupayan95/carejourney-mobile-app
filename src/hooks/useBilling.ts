import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface InvoiceSummary {
  invoice_id: string;
  patient_id: string;
  consultation_id?: string;
  appointment_id?: string;
  grand_total: number;
  currency: string;
  payment_amount: number;
  due_amount: number;
  payment_status: string;
  created_at: string;
}

export function useInvoices(params?: Record<string, string>) {
  return useQuery<InvoiceSummary[]>({
    queryKey: ['invoices', params],
    queryFn: async () => {
      // No "list all invoices" endpoint exists — the billing dashboard shows
      // invoices with an outstanding balance (same as the web app).
      const res = await api.get('/billing/outstanding', { params });
      return res.data?.data?.invoices ?? [];
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const res = await api.get(`/billing/invoices/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
