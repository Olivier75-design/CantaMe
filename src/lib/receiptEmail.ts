// Payment receipt email, sent through Resend once credits have been granted.
//
// SERVER ONLY. Degrades gracefully: without RESEND_API_KEY nothing is sent,
// and the caller makes sure a failed send never blocks crediting.
//
// There is no CantaMe mailbox for receipts (see "Contact form" in CLAUDE.md),
// so the email points questions to the site's contact form instead.

import { emailShell, esc, resendConfigured, sendEmail } from './email';

export type ReceiptLang = 'es' | 'en';

export interface ReceiptData {
  paymentId: string;
  amount: number;
  currency: string; // ISO code, e.g. "USD"
  songs: number;
  promoCode?: string | null;
  method?: string | null; // e.g. "Visa / MasterCard USD"
  paidAt: Date;
  lang: ReceiptLang;
  siteUrl: string; // public origin, no trailing slash
}

const COPY = {
  en: {
    subject: 'Your CantaMe receipt',
    preheader: 'Thank you for your payment. Here is your receipt.',
    title: 'Thank you for your payment',
    intro: "Here's your receipt. Your credits are already in your account.",
    receiptNo: 'Receipt number',
    date: 'Date',
    item: 'Item',
    pack: (n: number) => `Song pack — ${n} ${n === 1 ? 'song' : 'songs'}`,
    promo: 'Promo code',
    method: 'Payment method',
    total: 'Total paid',
    cta: 'Go to my songs',
    regards: 'Best regards,',
    team: 'CantaMe Team',
    questions: 'Questions? Write to us from',
    contactLink: 'the contact form on cantame.app',
    automatic: 'This is an automatic email, please do not reply.',
    locale: 'en-US',
  },
  es: {
    subject: 'Tu recibo de CantaMe',
    preheader: 'Gracias por tu pago. Aquí tienes tu recibo.',
    title: 'Gracias por tu pago',
    intro: 'Aquí tienes tu recibo. Tus créditos ya están en tu cuenta.',
    receiptNo: 'Número de recibo',
    date: 'Fecha',
    item: 'Concepto',
    pack: (n: number) => `Paquete de canciones — ${n} ${n === 1 ? 'canción' : 'canciones'}`,
    promo: 'Código promocional',
    method: 'Método de pago',
    total: 'Total pagado',
    cta: 'Ir a mis canciones',
    regards: 'Saludos cordiales,',
    team: 'El equipo de CantaMe',
    questions: '¿Preguntas? Escríbenos desde',
    contactLink: 'el formulario de contacto de cantame.app',
    automatic: 'Este es un correo automático, por favor no respondas.',
    locale: 'es-US',
  },
} as const;

export function buildReceiptEmail(d: ReceiptData): { subject: string; html: string; text: string } {
  const c = COPY[d.lang];
  const money = new Intl.NumberFormat(c.locale, { style: 'currency', currency: d.currency }).format(d.amount);
  const date = new Intl.DateTimeFormat(c.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(d.paidAt);
  const songsUrl = `${d.siteUrl}/dashboard`;

  const rows: [string, string][] = [
    [c.receiptNo, d.paymentId],
    [c.date, date],
    [c.item, c.pack(d.songs)],
    ...(d.promoCode ? [[c.promo, d.promoCode] as [string, string]] : []),
    ...(d.method ? [[c.method, d.method] as [string, string]] : []),
  ];

  const rowHtml = rows
    .map(([k, v]) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">${esc(k)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;text-align:right;">${esc(v)}</td>
      </tr>`)
    .join('');

  const html = emailShell({
    lang: d.lang,
    title: c.subject,
    preheader: c.preheader,
    content: `<tr><td style="padding:16px 32px 0;">
          <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">${esc(c.title)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${esc(c.intro)}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${rowHtml}
            <tr>
              <td style="padding:16px 0 0;color:#0f172a;font-size:16px;font-weight:700;">${esc(c.total)}</td>
              <td style="padding:16px 0 0;color:#2563EB;font-size:20px;font-weight:800;text-align:right;">${esc(money)} ${esc(d.currency)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <a href="${esc(songsUrl)}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:10px;">${esc(c.cta)}</a>
        </td></tr>
        <tr><td style="padding:28px 32px 32px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${esc(c.regards)}<br><strong>${esc(c.team)}</strong></p>
        </td></tr>`,
    footer: `<p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:#64748b;">${esc(c.questions)} <a href="${esc(d.siteUrl)}" style="color:#2563EB;">${esc(c.contactLink)}</a>.</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">${esc(c.automatic)}</p>`,
  });

  const text = [
    c.title,
    c.intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    `${c.total}: ${money} ${d.currency}`,
    '',
    `${c.cta}: ${songsUrl}`,
    '',
    c.regards,
    c.team,
    '',
    `${c.questions} ${c.contactLink}: ${d.siteUrl}`,
  ].join('\n');

  return { subject: c.subject, html, text };
}

// Sends the receipt; a no-op without RESEND_API_KEY. The payment id doubles as
// the idempotency key, so a retried send never delivers a second copy.
export async function sendReceiptEmail(to: string, d: ReceiptData): Promise<void> {
  if (!resendConfigured() || !to) return;
  const { subject, html, text } = buildReceiptEmail(d);
  await sendEmail(
    { from: process.env.RESEND_FROM || 'CantaMe <receipts@cantame.app>', to, subject, html, text },
    `receipt-${d.paymentId}`,
  );
}
