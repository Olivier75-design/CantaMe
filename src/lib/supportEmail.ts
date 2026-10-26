// Answer to a "Contact us" message, written in Admin → Messages and sent
// through Resend from the support address, so the admin's own mailbox never
// shows. The customer's reply goes back to that address and is read in
// Resend (Emails → Receiving) — the app does not receive mail.
//
// SERVER ONLY.

import { emailShell, esc, sendEmail } from './email';

export type SupportLang = 'es' | 'en';

export interface SupportReply {
  to: string;
  lang: SupportLang; // the customer's language, not the admin's
  subjectLabel: string; // e.g. "My order", already in `lang`
  reply: string; // what the admin typed, greeting included
  originalMessage: string;
  originalDate: Date;
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

export function buildSupportReply(r: SupportReply): { subject: string; html: string; text: string } {
  const c = COPY[r.lang];
  const subject = `Re: ${r.subjectLabel} — CantaMe`;
  const date = new Intl.DateTimeFormat(c.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(r.originalDate);

  const html = emailShell({
    lang: r.lang,
    title: subject,
    preheader: r.reply.replace(/\s+/g, ' ').slice(0, 120),
    content: `<tr><td style="padding:16px 32px 0;">
          ${paragraphs(r.reply)}
          <p style="margin:6px 0 0;font-size:15px;line-height:1.6;color:#334155;">${esc(c.regards)}<br><strong>${esc(c.team)}</strong></p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;">
          <p style="margin:0 0 6px;font-size:13px;color:#64748b;">${esc(c.wrote(date))}</p>
          <div style="border-left:3px solid #cbd5e1;padding:4px 0 4px 12px;font-size:14px;line-height:1.6;color:#64748b;">${esc(r.originalMessage).replace(/\n/g, '<br>')}</div>
        </td></tr>`,
    footer: `<p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">${esc(c.answer)} · <a href="${esc(r.siteUrl)}" style="color:#2563EB;">cantame.app</a></p>`,
  });

  const quoted = r.originalMessage.split('\n').map((l) => `> ${l}`).join('\n');
  const text = [r.reply.trim(), '', c.regards, c.team, '', c.wrote(date), quoted, '', c.answer].join('\n');

  return { subject, html, text };
}

export async function sendSupportReply(r: SupportReply, idempotencyKey: string): Promise<void> {
  const { subject, html, text } = buildSupportReply(r);
  await sendEmail({ from: supportFrom(), to: r.to, subject, html, text }, idempotencyKey);
}
