import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface VitalEntry {
  id: string;
  date?: string;
  bp?: string | null;
  hr?: number | null;
  rr?: number | null;
  temp?: number | null;
  tempUnit?: string;
  spo2?: number | null;
  height?: number | null;
  weight?: number | null;
  bmi?: number | null;
}

function toVitalEntry(c: any): VitalEntry | null {
  const o = c?.clinical_notes?.objective;
  const vs = o?.vital_signs;
  if (!vs) return null;
  const bp = vs.blood_pressure;
  const spo2 = vs.oxygen_saturation;
  const entry: VitalEntry = {
    id: c.consultation_id,
    date: c.metadata?.start_time ?? c.created_at,
    bp: bp ? `${bp.systolic ?? ''}/${bp.diastolic ?? ''}` : null,
    hr: vs.heart_rate ?? null,
    rr: vs.respiratory_rate ?? null,
    temp: vs.temperature ?? null,
    tempUnit: vs.temperature_unit ?? '',
    spo2: spo2?.value ?? (typeof spo2 === 'number' ? spo2 : null),
    height: o.height ?? null,
    weight: o.weight ?? null,
    bmi: o.bmi ?? null,
  };
  const hasAny =
    !!entry.bp || entry.hr != null || entry.rr != null || entry.temp != null ||
    entry.spo2 != null || entry.height != null || entry.weight != null;
  return hasAny ? entry : null;
}

/**
 * Vitals history for a patient. There is no history-list endpoint — vitals are
 * stored inside each consultation, so we pull recent consultations and read
 * their `objective.vital_signs`. Newest first; entry[0] is the latest.
 */
export function usePatientVitals(patientId: string) {
  return useQuery<VitalEntry[]>({
    queryKey: ['patient-vitals', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const list = (await api.get('/consultations', {
        params: { patient_id: patientId, limit: 20 },
      })).data.data.consultations as any[];

      const details = await Promise.all(
        list.map((c) =>
          api.get(`/consultations/${c.consultation_id}`)
            .then((r) => r.data.data)
            .catch(() => null),
        ),
      );

      const entries = details.map(toVitalEntry).filter(Boolean) as VitalEntry[];
      entries.sort(
        (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
      );
      return entries;
    },
  });
}
