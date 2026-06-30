import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function usePatientDetail(patientId: string) {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}`);
      return res.data.data;
    },
    enabled: !!patientId,
  });
}

export function usePatientConsultations(patientId: string) {
  return useQuery({
    queryKey: ['patient-consultations', patientId],
    queryFn: async () => {
      const res = await api.get('/consultations', { params: { patient_id: patientId, limit: 50 } });
      return res.data.data.consultations;
    },
    enabled: !!patientId,
  });
}

export function usePatientPrescriptions(patientId: string) {
  return useQuery({
    queryKey: ['patient-prescriptions', patientId],
    queryFn: async () => {
      const res = await api.get('/prescriptions', { params: { patient_id: patientId, limit: 50 } });
      return res.data.data.prescriptions;
    },
    enabled: !!patientId,
  });
}

export function usePatientAppointments(patientId: string) {
  return useQuery({
    queryKey: ['patient-appointments', patientId],
    queryFn: async () => {
      const res = await api.get('/appointments', { params: { patient_id: patientId, limit: 50 } });
      return res.data.data.appointments;
    },
    enabled: !!patientId,
  });
}
