import * as Print from 'expo-print';
import { api } from './api';

/**
 * Render a prescription's branded PDF in its selected template's format and
 * open the print / share sheet — entirely via endpoints already deployed on
 * the live server (no custom backend endpoint):
 *   1. GET /prescriptions/{id}                  → print_content + template id
 *   2. GET /templates/default?template_type=…   → fallback template
 *   3. GET /templates/{templateId}              → branding_spec
 *   4. POST /templates/preview {spec, content}  → branded HTML (assets inlined)
 * This is the same renderer the web app uses for brandingSpec printing.
 */
export async function printPrescriptionById(prescriptionId: string): Promise<void> {
  const rx = (await api.get(`/prescriptions/${prescriptionId}`)).data.data;
  const content = rx.print_content;

  // Resolve a template: the prescription's, else the org default.
  let templateId: string | undefined = rx.prescription_template_id ?? undefined;
  if (!templateId) {
    try {
      const def = await api.get('/templates/default', {
        params: { template_type: 'prescription' },
      });
      templateId = def.data?.data?.template_id;
    } catch {
      // no default configured
    }
  }

  let spec: any = null;
  if (templateId) {
    try {
      const tpl = (await api.get(`/templates/${templateId}`)).data.data;
      spec = tpl?.branding_spec ?? null;
    } catch {
      // template fetch failed — fall through
    }
  }

  // Primary path: server renders the branded document HTML for us.
  if (content) {
    try {
      const res = await api.post('/templates/preview', {
        spec: spec ?? {},
        content,
        layout: 'document',
      });
      const html = res.data?.data?.html;
      if (html) {
        await Print.printAsync({ html });
        return;
      }
    } catch {
      // fall through to local fallback
    }
  }

  // Fallback: build a minimal document from the stored content (no letterhead).
  await Print.printAsync({ html: buildFallbackHtml(content) });
}

function esc(s?: string | null): string {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Minimal HTML from the stored print_content (meta + sections + table). */
function buildFallbackHtml(content: any): string {
  const meta: Array<{ label: string; value: string }> = content?.meta ?? [];
  const sections: Array<{ heading: string; body?: string }> = content?.sections ?? [];
  const table = content?.table;

  const metaHtml = meta
    .map((m) => `<span style="margin-right:16px"><b>${esc(m.label)}:</b> ${esc(m.value)}</span>`)
    .join('');
  const sectionsHtml = sections
    .map(
      (s) =>
        `<div style="margin:10px 0"><div style="font-weight:700;color:#0E7490;border-bottom:1px solid #0E7490;padding-bottom:2px">${esc(s.heading)}</div><div style="margin-top:4px;white-space:pre-wrap">${esc(s.body)}</div></div>`,
    )
    .join('');
  let tableHtml = '';
  if (table?.headers?.length) {
    const head = table.headers.map((h: string) => `<th style="background:#0E7490;color:#fff;padding:6px;text-align:left;font-size:11px">${esc(h)}</th>`).join('');
    const rows = (table.rows ?? [])
      .map((r: string[]) => `<tr>${r.map((c) => `<td style="border:1px solid #ddd;padding:6px;font-size:11px">${esc(c)}</td>`).join('')}</tr>`)
      .join('');
    tableHtml = `<table style="width:100%;border-collapse:collapse;margin-top:6px">${head}${rows}</table>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>@page{size:A4;margin:16mm 14mm} body{font-family:Helvetica,Arial,sans-serif;color:#222;font-size:12px}</style>
  </head><body>
    <h1 style="font-size:16px;text-align:center">${esc(content?.title ?? 'Prescription')}</h1>
    <div style="margin-bottom:10px;font-size:11px">${metaHtml}</div>
    ${sectionsHtml}
    ${tableHtml}
  </body></html>`;
}
