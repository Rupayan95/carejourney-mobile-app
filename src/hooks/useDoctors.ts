import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface DoctorSummary {
  doctor_id: string;
  full_name: string;
  title?: string;
  specialization?: string;
  department?: string;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  available: boolean;
}

export function useDoctors() {
  return useQuery<DoctorSummary[]>({
    queryKey: ['doctors'],
    queryFn: async () => {
      const res = await api.get('/doctors');
      return res.data.data.doctors;
    },
  });
}

export function useAvailableSlots(doctorId: string, date: string, duration = 30) {
  return useQuery<TimeSlot[]>({
    queryKey: ['slots', doctorId, date, duration],
    queryFn: async () => {
      const res = await api.get(`/scheduling/doctors/${doctorId}/slots`, {
        params: { date, slot_duration: duration },
      });
      return res.data.data.available_slots;
    },
    enabled: !!doctorId && !!date,
  });
}
