// Emails written by the admin and sent through Resend from the support
// address, so the admin's own mailbox never shows: answers to "Contact us"
// messages (Admin → Messages) and new messages to a customer about an order
// (Admin → Orders). The customer's reply goes back to that address and is read
// in Resend (Emails → Receiving) — the app does not receive mail.
//
// SERVER ONLY.

import { emailShell, esc, sendEmail } from './email';

export type SupportLang = 'es' | 'en';

export interface SupportEmail {
  to: string;
  lang: SupportLang; // the customer's language, not the admin's
  subject: string;
  body: string; // what the admin typed, greeting included
  quote?: { message: string; date: Date }; // the customer's message, when answering one
  siteUrl: string;
}

const COPY = {
  en: {
    regards: 'Best regards,',
    team: 'CantaMe Team',
    wrote: (date: string) => `On ${date}, you wrote:`,
    answer: 'To answer, simply reply to this email.',
    locale: 'en-US',
  },
  es: {
    regards: 'Saludos cordiales,',
    team: 'El equipo de CantaMe',
    wrote: (date: string) => `El ${date}, escribiste:`,
    answer: 'Para responder, simplemente responde a este correo.',
    locale: 'es-US',
  },
} as const;

export function supportFrom(): string {
  return process.env.RESEND_SUPPORT_FROM || 'CantaMe Support <support@cantame.app>';
}

// Plain text → paragraphs: blank lines split paragraphs, single newlines stay.
function paragraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function buildSupportEmail(e: SupportEmail): { subject: string; html: string; text: string } {
  const c = COPY[e.lang];
  const date = e.quote && new Intl.DateTimeFormat(c.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(e.quote.date);

  const quoteHtml = e.quote
    ? `<tr><td style="padding:0 32px 32px;">
          <p style="margin:0 0 6px;font-size:13px;color:#64748b;">${esc(c.wrote(date!))}</p>
          <div style="border-left:3px solid #cbd5e1;padding:4px 0 4px 12px;font-size:14px;line-height:1.6;color:#64748b;">${esc(e.quote.message).replace(/\n/g, '<br>')}</div>
        </td></tr>`
    : '';

  const html = emailShell({
    lang: e.lang,
    title: e.subject,
    preheader: e.body.replace(/\s+/g, ' ').slice(0, 120),
    content: `<tr><td style="padding:16px 32px ${e.quote ? 24 : 32}px;">
          ${paragraphs(e.body)}
          <p style="margin:6px 0 0;font-size:15px;line-height:1.6;color:#334155;">${esc(c.regards)}<br><strong>${esc(c.team)}</strong></p>
        </td></tr>
        ${quoteHtml}`,
    footer: `<p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">${esc(c.answer)} · <a href="${esc(e.siteUrl)}" style="color:#2563EB;">cantame.app</a></p>`,
  });

  const text = [
    e.body.trim(),
    '',
    c.regards,
    c.team,
    ...(e.quote ? ['', c.wrote(date!), e.quote.message.split('\n').map((l) => `> ${l}`).join('\n')] : []),
    '',
    c.answer,
  ].join('\n');

  return { subject: e.subject, html, text };
}

export async function sendSupportEmail(e: SupportEmail, idempotencyKey: string): Promise<void> {
  const { subject, html, text } = buildSupportEmail(e);
  await sendEmail({ from: supportFrom(), to: e.to, subject, html, text }, idempotencyKey);
}
