import * as Print from 'expo-print';
import { api } from './api';

/**
 * Render an invoice as a branded receipt PDF using its selected invoice
 * template (same server renderer as prescriptions) and open the print sheet.
 *   1. GET /billing/invoices/{id}            → print_content + invoice_template_id
 *   2. GET /templates/{templateId}           → branding_spec
 *   3. POST /templates/preview {spec, content, layout:"document"} → HTML
 */
export async function printInvoiceById(invoiceId: string): Promise<void> {
  const inv = (await api.get(`/billing/invoices/${invoiceId}`)).data.data;
  const content = inv.print_content;

  let templateId: string | undefined = inv.invoice_template_id ?? undefined;
  if (!templateId) {
    try {
      const def = await api.get('/templates/default', { params: { template_type: 'invoice' } });
      templateId = def.data?.data?.template_id;
    } catch { /* no default */ }
  }

  let spec: any = null;
  if (templateId) {
    try {
      const tpl = (await api.get(`/templates/${templateId}`)).data.data;
      spec = tpl?.branding_spec ?? null;
    } catch { /* ignore */ }
  }

  if (content) {
    try {
      const res = await api.post('/templates/preview', { spec: spec ?? {}, content, layout: 'document' });
      const html = res.data?.data?.html;
      if (html) { await Print.printAsync({ html }); return; }
    } catch { /* fall through */ }
  }

  // Minimal fallback receipt.
  const total = inv.grand_total ?? 0;
  await Print.printAsync({
    html: `<!DOCTYPE html><html><body style="font-family:Helvetica,Arial;padding:24px">
      <h2 style="text-align:center">Money Receipt</h2>
      <p>Invoice: ${inv.invoice_id ?? ''}</p>
      <p>Patient: ${inv.patient_id ?? ''}</p>
      <p style="font-size:18px"><b>Grand Total: ${inv.currency ?? ''} ${total}</b></p>
    </body></html>`,
  });
}
