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

export function usePatientDocuments(patientId: string) {
  return useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}/documents`);
      return res.data.data.documents ?? [];
    },
    enabled: !!patientId,
  });
}

export function usePatientJourney(patientId: string) {
  return useQuery({
    queryKey: ['patient-journey', patientId],
    queryFn: async () => {
      const res = await api.get('/journeys', { params: { patient_id: patientId, limit: 1 } });
      const list = res.data?.data?.journeys ?? res.data?.data ?? [];
      return Array.isArray(list) ? list[0] ?? null : list;
    },
    enabled: !!patientId,
  });
}

export function usePatientAlerts(patientId: string) {
  return useQuery({
    queryKey: ['patient-alerts', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}/patient-alerts`);
      return res.data.data.alerts ?? res.data.data ?? [];
    },
    enabled: !!patientId,
  });
}
