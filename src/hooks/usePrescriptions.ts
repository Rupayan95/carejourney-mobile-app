import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PrescriptionSummary {
  prescription_id: string;
  patient_id: string;
  doctor_id: string;
  consultation_id?: string;
  status: string;
  medication_count: number;
  refills_allowed: number;
  created_at: string;
}

export function usePrescriptions(params?: Record<string, string>) {
  return useQuery<PrescriptionSummary[]>({
    queryKey: ['prescriptions', params],
    queryFn: async () => {
      const res = await api.get('/prescriptions', { params });
      return res.data.data.prescriptions;
    },
  });
}

export function usePrescription(id: string) {
  return useQuery({
    queryKey: ['prescription', id],
    queryFn: async () => {
      const res = await api.get(`/prescriptions/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
