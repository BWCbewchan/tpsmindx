/* Recovery is dry-run by default. Only skipped configuration failures are eligible.
 * SMTP uncertainty is retained as a claim and must be reconciled before another run. */
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Client } = require('pg');
const nodemailer = require('nodemailer');
require('@next/env').loadEnvConfig(process.cwd());
const apply = process.argv.includes('--apply');
const since = '2026-11-23T00:00:00+07:00';
function load(file, deps = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { exports, Buffer, process, console: { info() {}, warn() {}, error() {} }, require: name => name in deps ? deps[name] : require(name) }, { filename: file });
  return exports;
}
const branding = load('lib/email-branding.ts');
const render = load('app/api/emails/render.ts', { '@/lib/email-branding': branding });
const crypto = load('lib/email-account-crypto.ts');
const routing = load('lib/lecture-review-hc-routing.ts');
const client = new Client({ connectionString: process.env.DATABASE_URL, host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } });
let transport;
async function main() {
  await client.connect();
  const lock = await client.query("SELECT pg_try_advisory_lock(hashtext('email-recovery-2026-11-23')) AS acquired");
  if (!lock.rows[0].acquired) throw new Error('Another recovery is running');
  const account = (await client.query("SELECT * FROM email_sender_accounts WHERE lower(email)='hr-teaching@mindx.edu.vn' AND is_active=true")).rows[0];
  if (!account?.encrypted_app_password) throw new Error('HR sender missing or inactive');
  const password = crypto.decryptEmailCredential(account.encrypted_app_password, process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY).replace(/\s+/g, '');
  transport = nodemailer.createTransport({ service: 'gmail', auth: { user: account.email, pass: password }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 20000 });
  await transport.verify();
  console.log('HR SMTP verified');
  const rows = (await client.query("SELECT * FROM email_delivery_logs WHERE status='skipped' AND created_at >= $1 AND error_code IN ('23505','GMAIL_NOT_CONFIGURED') ORDER BY id", [since])).rows;
  let completed = 0;
  for (const row of rows) {
    if (row.metadata?.recoveryClaimedAt) throw new Error(`Log ${row.id} has an unresolved SMTP claim; reconcile first`);
    if (!row.to_recipients?.length) throw new Error(`Log ${row.id} has no recipient`);
    const entityKey = row.email_type === 'lecture_review_hc_invitation' ? 'applicationId' : 'requestId';
    const entityId = row.metadata?.[entityKey];
    if (!entityId) throw new Error(`Log ${row.id} lacks source entity`);
    const duplicate = await client.query("SELECT id FROM email_delivery_logs WHERE status='sent' AND email_type=$1 AND metadata->>$2=$3 AND id<>$4 LIMIT 1", [row.email_type,entityKey,String(entityId),row.id]);
    if (duplicate.rowCount) { console.log(`Log ${row.id}: already delivered in log ${duplicate.rows[0].id}, no resend`); continue; }
    let payload;
    const capture = { sendMail: async p => { payload = p; return { sent: true, durationMs: 0 }; } };
    if (row.email_type.startsWith('leave_')) {
      const source = (await client.query('SELECT * FROM leave_requests WHERE id=$1', [entityId])).rows[0];
      if (!source) throw new Error(`Missing leave request for log ${row.id}`);
      const data = { ...source, teacher_email: source.email, request_id: String(source.id), leave_date: source.leave_date instanceof Date ? source.leave_date.toISOString() : source.leave_date, substitute_confirmed_at: source.substitute_confirmed_at instanceof Date ? source.substitute_confirmed_at.toISOString() : source.substitute_confirmed_at };
      const mail = load('lib/leave-request-emails.ts', { '@/app/api/emails/render': render, '@/app/api/emails/transporter': capture, '@/lib/email-delivery-log': { recordEmailDelivery: async () => { throw new Error('Cannot reconstruct email'); } } });
      if (row.email_type === 'leave_request_submitted') await mail.sendLeaveRequestSubmittedEmail(data);
      else if (row.email_type === 'leave_approved_substitute_confirmed') await mail.sendLeaveSubstituteConfirmedEmail(data);
      else throw new Error(`Unsupported log ${row.id}`);
    } else if (row.email_type === 'lecture_review_hc_invitation') {
      const source = (await client.query('SELECT * FROM lecture_review_applications WHERE id=$1', [entityId])).rows[0];
      if (!source) throw new Error(`Missing review application ${entityId}`);
      const mail = load('lib/lecture-review-hc-emails.ts', { '@/app/api/emails/render': render, '@/app/api/emails/transporter': capture, '@/lib/lecture-review-hc-routing': routing });
      await mail.sendLectureReviewHcInvitation({ applicationId: source.id, candidateName: source.candidate_name, lmsCode: source.lms_code, reviewDate: row.metadata.reviewDate, reviewTime: source.review_time, centerName: source.center_name, roomName: source.room_name, reviewerName: source.reviewer_name, registeredByName: source.registered_by_email, centerRegion: row.metadata.centerRegion });
    }
    if (!payload?.html) throw new Error(`Failed to rebuild log ${row.id}`);
    console.log(`Log ${row.id}: ${row.email_type}, ${row.to_recipients.length} To / ${row.cc_recipients.length} CC, ${apply ? 'sending' : 'ready'}`);
    if (!apply) continue;
    await client.query("UPDATE email_delivery_logs SET metadata=metadata || jsonb_build_object('recoveryClaimedAt',now(),'recoveryOriginalStatus',status,'recoveryOriginalError',error_message,'recoveryOriginalCode',error_code,'recoveryOriginalCompletedAt',completed_at) WHERE id=$1 AND status='skipped'",[row.id]);
    const prepared = branding.prepareEmailForSend(branding.ensureEmailLogoInHtml(payload.html));
    const started = Date.now();
    const info = await transport.sendMail({ from: `"${account.display_name}" <${account.email}>`, to: row.to_recipients, cc: row.cc_recipients, subject: row.subject, html: prepared.html, attachments: prepared.attachments, messageId: `<tps-recovery-${row.id}-20261123@mindx.edu.vn>` });
    if (info.rejected?.length || !info.accepted?.length) throw new Error(`Log ${row.id}: partial/rejected delivery; reconcile SMTP claim`);
    await client.query("UPDATE email_delivery_logs SET status='sent',sender_account_id=$2,sender_email=$3,provider_message_id=$4,smtp_response=$5,duration_ms=$6,completed_at=now(),error_code=null,error_category=null,error_message=null,response_code=null,retryable=false,metadata=metadata || jsonb_build_object('recoveredAt',now(),'recoveryMethod','manual-backfill-20261123','accepted',$7::jsonb) WHERE id=$1",[row.id,account.id,account.email,info.messageId,info.response,Date.now()-started,JSON.stringify(info.accepted)]);
    completed++;
    console.log(`Log ${row.id}: SENT and status verified`);
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', eligible: rows.length, completed }));
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{transport?.close();await client.end()});
