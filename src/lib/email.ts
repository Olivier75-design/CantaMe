// Shared pieces of CantaMe's transactional emails (payment receipts, support
// replies): the branded frame and the Resend call.
//
// SERVER ONLY. Resend's HTTP API is a single POST, so there is no SDK — same
// approach as moneroo.ts. Sending requires RESEND_API_KEY; callers check
// resendConfigured() first and decide whether a missing key is an error.

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// The CantaMe frame: blue top bar, wordmark, white card, grey footer.
// `content` is a run of <tr> rows for the card; `footer` is the footer's inner
// HTML. Both are inserted as-is, so the caller escapes what it puts in them.
export function emailShell(o: { lang: string; title: string; preheader: string; content: string; footer: string }): string {
  return `<!doctype html>
<html lang="${esc(o.lang)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${esc(o.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="height:6px;background:#2563EB;"></td></tr>
        <tr><td style="padding:32px 32px 8px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:#2563EB;letter-spacing:-0.5px;">&#127925; CantaMe</div>
        </td></tr>
        ${o.content}
        <tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          ${o.footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function resendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Throws on any failure. With an idempotency key, Resend drops a repeat of the
// same send (a retry, a double click) instead of delivering it twice.
export async function sendEmail(m: EmailMessage, idempotencyKey?: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: m.from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
