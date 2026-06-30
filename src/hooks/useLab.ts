import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface LabOrderSummary {
  lab_order_id: string;
  patient_id: string;
  consultation_id?: string;
  ordering_doctor_id: string;
  status: string;
  priority: string;
  completed_at?: string;
  created_at: string;
}

export function useLabOrders(params?: Record<string, string>) {
  return useQuery<LabOrderSummary[]>({
    queryKey: ['lab-orders', params],
    queryFn: async () => {
      const res = await api.get('/lab/orders', { params });
      return res.data.data.lab_orders;
    },
  });
}

export function useLabOrder(id: string) {
  return useQuery({
    queryKey: ['lab-order', id],
    queryFn: async () => {
      const res = await api.get(`/lab/orders/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
