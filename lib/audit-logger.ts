/**
 * audit-logger.ts
 * ─────────────────────────────────────────────────────────────
 * Ghi log bảo mật vào bảng security_audit_logs.
 * Dùng pg Pool trực tiếp (service-role level — không bị RLS block).
 * Fire-and-forget: không block response của API handler.
 * ─────────────────────────────────────────────────────────────
 */

import pool from '@/lib/db';
import { classifyUnauthorizedAccess } from '@/lib/unauthorized-access-policy';
import { NextRequest } from 'next/server';
import { normalizeAuthenticatedEmail } from '@/lib/security-identity';

// ─── Types ───────────────────────────────────────────────────

export type AuditEventType =
  | 'AUTH'
  | 'DATA_MUTATION'
  | 'PRIVILEGE_ESCALATION'
  | 'SENSITIVE_DATA_ACCESS'
  | 'SYSTEM'
  | 'GENERAL';

export type AuditSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface AuditEvent {
  event_type:    AuditEventType;
  action:        string;
  severity:      AuditSeverity;
  user_email?:   string | null;
  user_role?:    string | null;
  resource_type: string;
  resource_id?:  string | null;
  old_data?:     Record<string, unknown> | null;
  new_data?:     Record<string, unknown> | null;
  endpoint?:     string | null;
  ip_address?:   string | null;
  user_agent?:   string | null;
  risk_score?:   number;
  threat_flags?: string[];
  session_id?:   string | null;
}

function isBlank(value: unknown): boolean {
  return normalizeAuthenticatedEmail(value) === null;
}

function requiresAuthenticatedActor(event: AuditEvent): boolean {
  return (
    event.event_type === 'DATA_MUTATION' ||
    event.action === 'CREATE' ||
    event.action === 'UPDATE' ||
    event.action === 'DELETE'
  );
}

// ─── Core write function ──────────────────────────────────────

/**
 * Ghi một audit event vào DB.
 * Fire-and-forget: lỗi chỉ được console.error, không throw.
 */
export function writeAuditLog(event: AuditEvent): void {
  const missingActor = requiresAuthenticatedActor(event) && isBlank(event.user_email);
  const eventToWrite: AuditEvent = missingActor
    ? {
        event_type: 'SYSTEM',
        action: 'AUDIT_MISSING_ACTOR',
        severity: 'CRITICAL',
        user_email: 'audit-system@tps.internal',
        user_role: 'system',
        resource_type: 'security_audit_logs',
        resource_id: `${event.resource_type}:${event.resource_id ?? 'unknown'}`,
        new_data: {
          rejected_action: event.action,
          rejected_event_type: event.event_type,
          rejected_resource_type: event.resource_type,
          rejected_resource_id: event.resource_id ?? null,
          original_old_data: event.old_data ?? null,
          original_new_data: event.new_data ?? null,
          original_endpoint: event.endpoint ?? null,
          original_ip_address: event.ip_address ?? null,
          original_user_agent: event.user_agent ?? null,
        },
        endpoint: event.endpoint,
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        risk_score: 100,
        threat_flags: Array.from(new Set([...(event.threat_flags ?? []), 'MISSING_ACTOR_EMAIL'])),
        session_id: event.session_id,
      }
    : {
        ...event,
        user_email: event.user_email?.trim() || null,
        risk_score: event.risk_score ?? 0,
        threat_flags: event.threat_flags ?? [],
      };

  if (missingActor) {
    console.error('[AuditLog] Mutation event rejected because actor email is missing', {
      action: event.action,
      resource_type: event.resource_type,
      resource_id: event.resource_id,
      endpoint: event.endpoint,
      ip_address: event.ip_address,
    });
  }

  const {
    event_type, action, severity,
    user_email, user_role,
    resource_type, resource_id,
    old_data, new_data,
    endpoint, ip_address, user_agent,
    risk_score = 0,
    threat_flags = [],
    session_id,
  } = eventToWrite;

  pool.query(
    `INSERT INTO public.security_audit_logs (
       event_type,    action,       severity,
       user_email,    user_role,
       resource_type, resource_id,
       old_data,      new_data,
       endpoint,      ip_address,   user_agent,
       risk_score,    threat_flags, session_id,
       created_at
     ) VALUES (
       $1, $2, $3,
       $4, $5,
       $6, $7,
       $8, $9,
       $10, $11, $12,
       $13, $14, $15,
       NOW()
     )`,
    [
      event_type,   action,      severity,
      user_email ?? null,   user_role ?? null,
      resource_type, resource_id ?? null,
      old_data   ? JSON.stringify(old_data)   : null,
      new_data   ? JSON.stringify(new_data)   : null,
      endpoint   ?? null, ip_address ?? null, user_agent ?? null,
      risk_score, threat_flags, session_id ?? null,
    ]
  ).then(() => {
    // ── Auto-alert cho HIGH/CRITICAL events ──
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      import('@/lib/security-alert').then(({ sendSecurityAlert }) => {
        sendSecurityAlert(eventToWrite);
      }).catch(() => {/* non-blocking */});
    }
  }).catch((err: Error) => {
    console.error('[AuditLog] Failed to write log:', err.message, { action, event_type });
  });
}

// ─── Helper: extract request metadata ────────────────────────

export function getRequestMeta(req: NextRequest) {
  return {
    ip: (
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'
    ),
    userAgent: req.headers.get('user-agent') ?? '',
    endpoint: `${req.method} ${req.nextUrl.pathname}`,
  };
}

// ─── AUTH events ─────────────────────────────────────────────

/** Đăng nhập thành công */
export function logLoginSuccess(args: {
  email: string;
  role:  string;
  ip:    string;
  userAgent: string;
  sessionId?: string;
}) {
  writeAuditLog({
    event_type:    'AUTH',
    action:        'LOGIN_SUCCESS',
    severity:      'INFO',
    user_email:    args.email,
    user_role:     args.role,
    resource_type: 'session',
    ip_address:    args.ip,
    user_agent:    args.userAgent,
    risk_score:    0,
    session_id:    args.sessionId,
  });
}

/** Đăng nhập thất bại */
export function logLoginFailed(args: {
  email:     string;
  ip:        string;
  userAgent: string;
  reason:    string;
}) {
  // Kiểm tra brute force sau khi ghi log
  writeAuditLog({
    event_type:    'AUTH',
    action:        'LOGIN_FAILED',
    severity:      'WARNING',
    user_email:    args.email,
    resource_type: 'account',
    resource_id:   args.email,
    new_data:      { reason: args.reason },
    ip_address:    args.ip,
    user_agent:    args.userAgent,
    risk_score:    40,
    threat_flags:  ['FAILED_LOGIN'],
  });
}

/** Đăng xuất */
export function logLogout(args: {
  email:     string;
  role:      string;
  ip:        string;
  userAgent: string;
  sessionId?: string;
}) {
  writeAuditLog({
    event_type:    'AUTH',
    action:        'LOGOUT',
    severity:      'INFO',
    user_email:    args.email,
    user_role:     args.role,
    resource_type: 'session',
    ip_address:    args.ip,
    user_agent:    args.userAgent,
    risk_score:    0,
    session_id:    args.sessionId,
  });
}

// ─── PRIVILEGE ESCALATION events ─────────────────────────────

/** Truy cập endpoint không có quyền */
export function logUnauthorizedAccess(args: {
  email?:       string | null;
  role?:        string | null;
  ip:           string;
  userAgent:    string;
  endpoint:     string;
  requiredRole?: string;
}) {
  const flags: string[] = ['UNAUTHORIZED_ACCESS'];
  if (!args.email)        flags.push('UNAUTHENTICATED');
  if (args.requiredRole)  flags.push(`REQUIRED_ROLE:${args.requiredRole}`);

  // Phát hiện công cụ tấn công
  const ua = args.userAgent.toLowerCase();
  if (ua.includes('python') || ua.includes('curl') || ua.includes('postman')) {
    flags.push('SUSPICIOUS_CLIENT');
  }

  const emit = (recentFailures = 0, alreadyAlerted = false) => {
    const policy = classifyUnauthorizedAccess(Boolean(args.email), recentFailures, alreadyAlerted);
    writeAuditLog({
      event_type: policy.eventType, action: policy.action, severity: policy.severity,
      user_email: args.email, user_role: args.role,
      resource_type: 'endpoint', resource_id: args.endpoint,
      new_data: { required_role: args.requiredRole ?? null, recent_failures: recentFailures },
      endpoint: args.endpoint, ip_address: args.ip, user_agent: args.userAgent,
      risk_score: policy.risk,
      threat_flags: [...flags, ...(policy.action === 'AUTH_FAILURE_BURST' ? ['AUTH_FAILURE_BURST'] : [])],
    });
  };
  if (args.email) { emit(); return; }
  // Database-backed window works across serverless instances. Keep every rejection
  // in the audit trail, but notify only once per burst window.
  void pool.query(
    `SELECT COUNT(*)::int AS failures,
       COUNT(*) FILTER (WHERE severity = 'HIGH')::int AS alerted
     FROM public.security_audit_logs
     WHERE ip_address = $1 AND endpoint = $2
       AND user_email IS NULL
       AND created_at >= NOW() - INTERVAL '5 minutes'
       AND action IN ('AUTHENTICATION_REQUIRED', 'AUTH_FAILURE_BURST', 'UNAUTHORIZED_ACCESS')`,
    [args.ip, args.endpoint],
  ).then(result => emit(Number(result.rows[0]?.failures || 0) + 1, Number(result.rows[0]?.alerted || 0) > 0))
    .catch(() => emit());
}

/** Thay đổi role của user */
export function logRoleChange(args: {
  actorEmail:   string;
  actorRole:    string;
  targetEmail:  string;
  targetId:     string | number;
  oldRole:      string;
  newRole:      string;
  ip:           string;
  userAgent:    string;
  endpoint:     string;
}) {
  const isSelf          = args.actorEmail === args.targetEmail;
  const isEscToAdmin    = ['admin', 'superadmin', 'root'].includes(args.newRole.toLowerCase());

  const flags: string[] = ['ROLE_CHANGE'];
  if (isSelf)        flags.push('SELF_ROLE_ESCALATION');
  if (isEscToAdmin)  flags.push('ESCALATION_TO_ADMIN');

  const risk = isSelf ? 100 : isEscToAdmin ? 80 : 50;

  writeAuditLog({
    event_type:    'PRIVILEGE_ESCALATION',
    action:        isSelf ? 'SELF_ROLE_ESCALATION' : 'ROLE_CHANGE',
    severity:      risk >= 90 ? 'CRITICAL' : 'HIGH',
    user_email:    args.actorEmail,
    user_role:     args.actorRole,
    resource_type: 'app_users',
    resource_id:   String(args.targetId),
    old_data:      { email: args.targetEmail, role: args.oldRole },
    new_data:      { email: args.targetEmail, role: args.newRole },
    endpoint:      args.endpoint,
    ip_address:    args.ip,
    user_agent:    args.userAgent,
    risk_score:    risk,
    threat_flags:  flags,
  });
}

// ─── DATA MUTATION events ─────────────────────────────────────

/** Tạo record mới */
export function logCreate(args: {
  actorEmail:  string;
  actorRole:   string;
  table:       string;
  recordId:    string | number;
  newRecord:   Record<string, unknown>;
  ip:          string;
  userAgent:   string;
  endpoint:    string;
}) {
  const { password_hash: _ph, ...safeRecord } = args.newRecord as Record<string, unknown> & { password_hash?: unknown };

  writeAuditLog({
    event_type:    'DATA_MUTATION',
    action:        'CREATE',
    severity:      'INFO',
    user_email:    args.actorEmail,
    user_role:     args.actorRole,
    resource_type: args.table,
    resource_id:   String(args.recordId),
    new_data:      safeRecord,
    endpoint:      args.endpoint,
    ip_address:    args.ip,
    user_agent:    args.userAgent,
    risk_score:    10,
  });
}

/** Cập nhật record */
export function logUpdate(args: {
  actorEmail:  string;
  actorRole:   string;
  table:       string;
  recordId:    string | number;
  oldRecord:   Record<string, unknown>;
  newRecord:   Record<string, unknown>;
  ip:          string;
  userAgent:   string;
  endpoint:    string;
}) {
  const strip = (obj: Record<string, unknown>) => {
    const { password_hash: _ph, ...safe } = obj as Record<string, unknown> & { password_hash?: unknown };
    return safe;
  };

  writeAuditLog({
    event_type:    'DATA_MUTATION',
    action:        'UPDATE',
    severity:      'INFO',
    user_email:    args.actorEmail,
    user_role:     args.actorRole,
    resource_type: args.table,
    resource_id:   String(args.recordId),
    old_data:      strip(args.oldRecord),
    new_data:      strip(args.newRecord),
    endpoint:      args.endpoint,
    ip_address:    args.ip,
    user_agent:    args.userAgent,
    risk_score:    20,
  });
}

/** Xóa record */
export function logDelete(args: {
  actorEmail:    string;
  actorRole:     string;
  table:         string;
  recordId:      string | number;
  deletedRecord: Record<string, unknown>;
  ip:            string;
  userAgent:     string;
  endpoint:      string;
}) {
  const { password_hash: _ph, ...safeRecord } = args.deletedRecord as Record<string, unknown> & { password_hash?: unknown };

  writeAuditLog({
    event_type:    'DATA_MUTATION',
    action:        'DELETE',
    severity:      'WARNING',
    user_email:    args.actorEmail,
    user_role:     args.actorRole,
    resource_type: args.table,
    resource_id:   String(args.recordId),
    old_data:      safeRecord,
    endpoint:      args.endpoint,
    ip_address:    args.ip,
    user_agent:    args.userAgent,
    risk_score:    50,
  });
}

// ─── SENSITIVE DATA ACCESS events ────────────────────────────

/** Truy cập bulk dữ liệu nhạy cảm (salary, HR, ...) */
export function logSensitiveRead(args: {
  actorEmail: string;
  actorRole:  string;
  table:      string;
  rowCount:   number;
  filters?:   Record<string, unknown>;
  ip:         string;
  userAgent:  string;
  endpoint:   string;
}) {
  const flags: string[] = [];
  let   risk   = 10;

  if (args.rowCount > 20)  { flags.push('BULK_READ');    risk += 30; }
  if (args.rowCount > 100) { flags.push('MASS_EXPORT');  risk += 40; }

  const hasFilter = args.filters && Object.keys(args.filters).length > 0;
  if (!hasFilter) { flags.push('NO_FILTER'); risk += 20; }

  writeAuditLog({
    event_type:    'SENSITIVE_DATA_ACCESS',
    action:        'READ',
    severity:      risk >= 70 ? 'HIGH' : risk >= 40 ? 'WARNING' : 'INFO',
    user_email:    args.actorEmail,
    user_role:     args.actorRole,
    resource_type: args.table,
    resource_id:   'query',
    new_data:      { rows_accessed: args.rowCount, filters: args.filters ?? null },
    endpoint:      args.endpoint,
    ip_address:    args.ip,
    user_agent:    args.userAgent,
    risk_score:    Math.min(risk, 100),
    threat_flags:  flags,
  });
}
