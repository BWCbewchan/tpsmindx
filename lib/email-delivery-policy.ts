/** Only fail over when SMTP has definitely not accepted this message. */
export function canSafelyFailoverEmail(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const smtp = error as { code?: string; command?: string; responseCode?: number; response?: string; message?: string }
  if (smtp.code === 'EAUTH') return true
  const command = String(smtp.command || '').toUpperCase()
  // A negative SMTP reply explicitly rejecting a message for sender quota is
  // different from losing the connection after DATA with an unknown outcome.
  if (['DATA', 'MAIL FROM', 'RCPT TO'].includes(command)
    && Number(smtp.responseCode) >= 400 && Number(smtp.responseCode) <= 599
    && /quota|daily.*limit|sending limit|too many messages|rate limit/i.test(`${smtp.response || ''} ${smtp.message || ''}`)) return true
  return ['CONN', 'EHLO', 'HELO', 'STARTTLS', 'AUTH', 'AUTH PLAIN', 'AUTH LOGIN', 'MAIL FROM'].includes(command)
    && ['EAUTH', 'ECONNECTION', 'ECONNRESET', 'ETIMEDOUT', 'EDNS', 'ENOTFOUND', 'ESOCKET', 'EENVELOPE'].includes(smtp.code || '')
}
