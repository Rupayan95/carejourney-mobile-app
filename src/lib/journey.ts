import { api } from './api';

/**
 * Ensure a patient's journey is at least at the APPOINTMENT step before the
 * backend advances it to PRE_CONSULTATION on appointment confirmation.
 *
 * The backend advances Onboard→Appointment only at appointment *creation*, and
 * Appointment→Pre-Consultation only on *confirmation* — each requires the prior
 * step. Legacy patients (booked before mobile created journeys) can be stuck at
 * Onboard, so confirming would no-op. This repairs that: create a journey if
 * missing, then advance Onboard→Appointment (using the appointment as the
 * step's resource) so the subsequent confirm advances cleanly.
 *
 * Best-effort and non-fatal — never blocks the confirm.
 */
export async function catchUpJourneyForConfirm(
  patientId: string,
  appointmentId: string,
  organizationId?: string,
): Promise<void> {
  try {
    const list = (await api.get('/journeys', { params: { patient_id: patientId, limit: 1 } })).data?.data?.journeys ?? [];
    let journey = list[0];

    if (!journey || ['completed', 'cancelled', 'on_hold'].includes(journey.status)) {
      if (!organizationId) return;
      journey = (await api.post('/journeys', { patient_id: patientId, organization_id: organizationId })).data?.data;
    }

    if (journey?.current_step === 'onboard' && journey?.journey_id) {
      await api.patch(`/journeys/${journey.journey_id}/advance`, { resource_id: appointmentId });
    }
  } catch {
    // ignore — confirmation proceeds regardless
  }
}

const STEP_ORDER = ['onboard', 'appointment', 'pre_consultation', 'consultation', 'doctor_view', 'prescription', 'billing'];

/**
 * Advance the journey so the PRESCRIPTION step shows as *completed* once a
 * prescription is generated (mobile UX choice — see below).
 *
 * The backend advances DOCTOR_VIEW → PRESCRIPTION on prescription creation, but
 * only if the journey is already at DOCTOR_VIEW; earlier links (consultation
 * start / SOAP notes) may not have fired on mobile. This walks the journey
 * forward step-by-step until it reaches PRESCRIPTION, then does one extra
 * advance (PRESCRIPTION → BILLING, skip_admission) so the Prescription step
 * turns green immediately after generation and Billing becomes the active step.
 * Marking the invoice paid later still closes BILLING → COMPLETED via
 * billing_service._complete_billing_step_if_paid.
 *
 * Best-effort and non-fatal.
 */
export async function catchUpJourneyToPrescription(
  patientId: string,
  consultationId: string,
  prescriptionId: string,
): Promise<void> {
  try {
    let guard = 0;
    while (guard++ < 8) {
      const list = (await api.get('/journeys', { params: { patient_id: patientId, limit: 1 } })).data?.data?.journeys ?? [];
      const journey = list[0];
      if (!journey?.journey_id) return;
      const idx = STEP_ORDER.indexOf(journey.current_step);
      // Stop once BILLING is reached (i.e. PRESCRIPTION is completed).
      if (idx < 0 || idx >= STEP_ORDER.indexOf('billing')) return;
      // Completing PRESCRIPTION must skip ADMISSION (outpatient) to land on BILLING.
      if (journey.current_step === 'prescription') {
        await api.patch(`/journeys/${journey.journey_id}/advance`, { resource_id: prescriptionId, skip_admission: true });
        continue;
      }
      // Use the prescription as the resource when completing doctor_view; the
      // consultation for earlier clinical steps.
      const resource = journey.current_step === 'doctor_view' ? prescriptionId : (consultationId || prescriptionId);
      await api.patch(`/journeys/${journey.journey_id}/advance`, { resource_id: resource });
    }
  } catch {
    // ignore
  }
}
