import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Appointment {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_datetime: string;
  duration_minutes: number;
  appointment_type: string;
  modality: string;
  status: string;
  payment_status: string;
}

export function useAppointments(params?: { status?: string; date?: string }) {
  return useQuery<Appointment[]>({
    queryKey: ['appointments', params],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (params?.status) query.status = params.status;
      if (params?.date) {
        // Backend expects datetime — send full-day range for the given date
        query.date_from = `${params.date}T00:00:00`;
        query.date_to = `${params.date}T23:59:59`;
      }
      const res = await api.get('/appointments', { params: query });
      return res.data.data.appointments;
    },
  });
}
