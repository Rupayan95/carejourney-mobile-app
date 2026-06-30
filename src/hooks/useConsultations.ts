import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ConsultationSummary {
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  consultation_type: string;
  status: string;
  start_time?: string;
  end_time?: string;
  chief_complaint?: string;
  clinical_notes?: Record<string, any>;
}

export function useConsultations(params?: Record<string, string>) {
  return useQuery<ConsultationSummary[]>({
    queryKey: ['consultations', params],
    queryFn: async () => {
      const res = await api.get('/consultations', { params });
      return res.data.data.consultations;
    },
  });
}

export function useConsultation(id: string) {
  return useQuery({
    queryKey: ['consultation', id],
    queryFn: async () => {
      const res = await api.get(`/consultations/${id}`, { params: { include_related: true } });
      return res.data.data;
    },
    enabled: !!id,
  });
}
