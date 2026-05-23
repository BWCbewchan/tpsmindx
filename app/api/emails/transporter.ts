import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER || process.env.MAILDEV_INCOMING_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || process.env.MAILDEV_INCOMING_PASS;

let transporter: nodemailer.Transporter | null = null;

if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

export interface MailPayload {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
}

export async function sendMail(payload: MailPayload): Promise<{ sent: boolean; warning?: string }> {
  if (!transporter) {
    console.warn('[sendMail] Gmail not configured – email skipped', payload.subject);
    return { sent: false, warning: 'GMAIL_NOT_CONFIGURED' };
  }

  await transporter.sendMail({
    from: `"TPS-Teaching No-Reply" <${GMAIL_USER}>`,
    ...payload,
  });

  return { sent: true };
}
