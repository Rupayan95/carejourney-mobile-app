# Mobile App — UI/UX Design Page List

This is a checklist of every screen in the **medicare-mobile** app (Expo Router, React Native 0.81.5) to design or redesign. The app is **clinician-facing** (not patient-facing) — it serves physicians, therapists, nurses, receptionists, lab technicians, pharmacists, billing officers, and admins, with tabs and features gated by role (`src/context/UserContext.tsx`).

## How to use this list

- Screens are grouped by flow, in the order a user would typically move through them.
- Each entry has: the current file path (so you can see the existing implementation), its purpose, and the key elements/states to design.
- **Section I** lists features that exist on the web app but have no mobile screen yet — include these if you want the design pass to also cover where mobile is headed, not just what's already built.
- **Section J** lists shared UI states worth designing once as reusable patterns, since they repeat across almost every screen.

---

## Section A — Auth & Onboarding

1. **Login** — `app/(auth)/login.tsx`
   Email/password sign-in. Design: form, validation errors, "forgot password" link, loading state.
2. **MFA Verification** — `app/(auth)/mfa.tsx`
   TOTP/backup-code entry after login. Design: code input, resend/backup-code fallback, error state.

## Section B — Core Navigation / Dashboard

3. **Dashboard** — `app/(tabs)/dashboard.tsx`
   Landing screen after login. Daily appointments overview, quick stats (upcoming/completed), logout. Design: stat cards, today's schedule list, empty-day state.

## Section C — Patient Management

4. **Patient List** — `app/(tabs)/patients.tsx`
   Search/browse all patients. Design: search bar, list item (avatar, name, status badge), add-patient FAB, empty/no-results state.
5. **Patient Detail** — `app/patient/[id].tsx`
   Full patient profile with 5 tabs: Overview, Health Records, Encounters, Prescriptions, Medical Files. Design: header (demographics, alerts), tab bar, vitals summary, journey stepper, per-tab content.
6. **Registration Method Selector** — `app/register/methods.tsx`
   Choose how to register a new patient. Design: 3 option cards (Manual / Live Intake / Document OCR) with icons and short descriptions.
7. **Manual Registration** — `app/register/manual.tsx`
   Hand-entry patient form. Design: multi-field form, sectioning (demographics, contact, insurance), validation, save/cancel.
8. **Live Intake Registration** — `app/register/live-intake.tsx`
   Voice-driven intake with AI transcription into form fields. Design: recording indicator, live transcript, field auto-fill confirmation, edit-before-save.
9. **Document OCR Registration** — `app/register/doc-ocr.tsx`
   Scan ID/form, AI extracts patient details. Design: camera/upload trigger, scan preview, extracted-field review/edit screen.

## Section D — Appointments

10. **Appointments List** — `app/(tabs)/appointments.tsx`
    Full appointment list with status filters (all/scheduled/confirmed/completed/cancelled), confirm/start-consultation actions. Design: filter chips, list item with status color, swipe/tap actions.
11. **Create Appointment** — `app/create-appointment.tsx`
    Form to schedule a new appointment. Design: patient picker, date/time picker, provider/type fields, save state.

## Section E — Consultations

12. **Consultations List** — `app/(tabs)/consultations.tsx`
    Doctor-facing consultation history with a "new consultation" modal (type + chief complaint). Design: list with resume/view actions, create modal.
13. **Live Consultation** — `app/live-consultation/[id].tsx`
    Active consultation workspace: SOAP tabs (Free Notes/Subjective/Objective/Assessment/Plan/Handout), voice scribe transcription, vitals input (BP/HR/Temp/O2), AI handout generation. This is the most complex screen — design each SOAP tab, the recording UI, and the vitals input pattern.
14. **Consultation Review** — `app/consultation-review/[id].tsx`
    Post-visit screen: create prescriptions from notes, apply templates, generate patient summary, export/print. Design: summary layout, template picker, action buttons (export/print/share).
15. **Consultation History** — `app/consultation/[id].tsx`
    Read-only view of a completed consultation's SOAP notes. Design: clean read-only layout matching the live-consultation tabs.

## Section F — Prescriptions

16. **Prescriptions List** — `app/(tabs)/prescriptions.tsx`
    Prescription list with a create-Rx modal (drug name, dosage, frequency, duration, instructions) and safety validation. Design: list item, create modal, inline safety-warning state.
17. **Prescription Detail** — `app/prescription/[id].tsx`
    Individual prescription view: medications, dosage, frequency, duration, validity period, refill count. Design: detail layout, refill/print actions.

## Section G — Lab Orders

18. **Lab Orders List** — `app/(tabs)/lab.tsx`
    Lab order list with a create modal (test name, priority: routine/urgent/stat) and status tracking. Design: priority badge colors, status pipeline, create modal.

## Section H — Billing

19. **Billing / Invoices List** — `app/(tabs)/billing.tsx`
    Invoice list with amounts, payment status, due amounts. Design: list item with status badge, filter by paid/unpaid, totals summary.

---

## Section I — Planned / Not Yet Built (parity with the web app)

These exist as modules in `medicare-frontend/app/(modules)` but have no mobile screen yet. Include them if the design pass should also plan ahead:

20. **Communications / Messaging** — chat/messaging between staff, not yet on mobile.
21. **Medical Imaging** — viewing/managing imaging studies and results.
22. **Referrals** — tracking referrals between providers.
23. **Audit Log Viewer** — compliance audit trail.
24. **Admin / Settings** — organization and user management console.
25. **Help & Support** — knowledge base / support access.

## Section J — Cross-cutting states to design once, reuse everywhere

These recur across nearly every list/detail screen above — worth designing as shared patterns rather than per-screen:

- **Empty state** (no data yet)
- **Loading / skeleton state**
- **Error / offline state**
- **Permission-denied state** (role-gated content)
- **Pull-to-refresh**
