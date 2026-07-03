import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Patient {
  patient_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  phone_primary: string;
  gender: string;
  date_of_birth?: string;
  blood_group?: string;
  status: string;
  last_visit_date?: string;
}

export function usePatients(search?: string) {
  return useQuery<Patient[]>({
    queryKey: ['patients', search],
    queryFn: async () => {
      const res = await api.get('/patients', { params: search ? { search } : undefined });
      return res.data.data.patients;
    },
  });
}

export function usePatient(patientId?: string) {
  return useQuery<Patient>({
    // Distinct key from usePatientDetail (which caches the RAW nested shape
    // under ['patient', id]) — otherwise the shapes collide and names read
    // as undefined on the dashboard/appointment cards.
    queryKey: ['patient-summary', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}`);
      const d = res.data.data;
      // Detail endpoint nests name fields under `demographics`; flatten them
      const demo = d.demographics ?? {};
      return {
        patient_id: d.patient_id,
        first_name: demo.first_name ?? d.first_name ?? '',
        middle_name: demo.middle_name ?? d.middle_name,
        last_name: demo.last_name ?? d.last_name ?? '',
        phone_primary: d.contact?.phone_primary ?? d.phone_primary ?? '',
        gender: demo.gender ?? d.gender ?? '',
        date_of_birth: demo.date_of_birth ?? d.date_of_birth,
        blood_group: demo.blood_group ?? d.blood_group,
        status: d.status,
        last_visit_date: d.last_visit_date,
      };
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}
