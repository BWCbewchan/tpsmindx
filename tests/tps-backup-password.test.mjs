import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import bcrypt from 'bcryptjs';

function load(path, dependencies) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Buffer, console: { warn() {}, error() {} }, require: name => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const password = 'Backup-for-test-only-42';
const hash = await bcrypt.hash(password, 4);
const account = { id: 27, email: 'person@example.test', role: 'manager', auth_type: 'firebase',
  is_active: true, display_name: 'Test', password_hash: hash };
const responseModule = { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
const request = body => ({ json: async () => body, headers: { get: () => '' } });

function loginHarness(user = account, blocked = false) {
  let failures = 0;
  const route = load('../app/api/app-auth/login/route.ts', {
    '@/lib/db': { default: { query: async sql => ({ rows: sql.includes('FROM app_users') ? (user.is_active ? [user] : []) : [] }) } },
    '@/lib/db-helpers': { isDatabaseUnavailableError: () => false },
    '@/lib/jwt-secret': { getJwtSecret: () => 'test-secret' },
    '@/lib/rate-limit-memory': { clientIpFromRequest: () => 'test-ip', rateLimitOr429Async: async () => null },
    '@/lib/session-cookie': { setSessionCookieOnResponse() {} },
    '@/lib/audit-logger': { logLoginFailed() { failures++; }, logLoginSuccess() {} },
    '@/lib/admin-permission-routes': { filterManagementPermissions: value => value },
    '@/lib/brute-force-guard': { isIpBlocked: async () => ({ blocked }), checkAndRecordThreat: async () => ({ blocked: false }) },
    bcryptjs: { default: bcrypt }, jsonwebtoken: { default: { sign: () => 'test-token' } }, 'next/server': responseModule,
  });
  return { login: value => route.POST(request({ email: account.email, password: value })), failures: () => failures };
}

test('Firebase account can sign in with its hashed TPS backup password', async () => {
  const h = loginHarness();
  const res = await h.login(password);
  assert.equal(res.status, 200);
  assert.equal(res.body.appUser, true);
  assert.equal(res.body.role, account.role);
  assert.equal('password_hash' in res.body, false);
});
test('a nonmatching backup password defers to LMS without counting a failure twice', async () => {
  const h = loginHarness();
  const res = await h.login('main-LMS-password');
  assert.equal(res.body.appUser, false);
  assert.equal(h.failures(), 0);
});
test('removing the backup password restores LMS-only login', async () => {
  const h = loginHarness({ ...account, password_hash: null });
  assert.equal((await h.login(password)).body.appUser, false);
});
test('app-only account wrong passwords still fail and retain brute-force tracking', async () => {
  const h = loginHarness({ ...account, auth_type: 'app' });
  assert.equal((await h.login('incorrect')).status, 401);
  assert.equal(h.failures(), 1);
});
test('backup password does not bypass an existing IP block or inactive account', async () => {
  assert.equal((await loginHarness(account, true).login(password)).status, 429);
  assert.equal((await loginHarness({ ...account, is_active: false }).login(password)).body.appUser, false);
});

function updateHarness(authType = 'firebase', allowed = true) {
  const updates = [];
  const route = load('../app/api/app-auth/users/route.ts', {
    '@/lib/auth-server': { requireBearerSuperAdminMutation: async () => allowed
      ? { ok: true, sessionEmail: 'admin@example.test', role: 'super_admin' } : { ok: false, response: { status: 403 } } },
    '@/lib/admin-permission-routes': {},
    '@/lib/db': { default: { query: async (sql, params) => {
      if (sql.startsWith('UPDATE')) updates.push({ sql, params });
      return { rows: [{ ...account, auth_type: authType }] };
    } } },
    '@/lib/audit-logger': { logUpdate() {}, getRequestMeta: () => ({}) },
    bcryptjs: { default: bcrypt }, 'next/server': responseModule,
  });
  return { updates, update: value => route.PUT(request({ id: 27, password: value })) };
}
test('only super administrators may configure backup passwords', async () => {
  const h = updateHarness('firebase', false);
  assert.equal((await h.update(password)).status, 403);
  assert.equal(h.updates.length, 0);
});
test('setting backup passwords stores bcrypt hashes and preserves Firebase auth', async () => {
  const h = updateHarness();
  assert.equal((await h.update(password)).status, 200);
  assert.equal(await bcrypt.compare(password, h.updates[0].params[0]), true);
  assert.ok(!h.updates[0].sql.includes('auth_type ='));
});
test('backup removal is allowed for Firebase accounts only', async () => {
  const firebase = updateHarness();
  assert.equal((await firebase.update(null)).status, 200);
  assert.match(firebase.updates[0].sql, /password_hash = NULL/);
  const app = updateHarness('app');
  assert.equal((await app.update(null)).status, 400);
  assert.equal(app.updates.length, 0);
});
test('server rejects invalid or silently truncated bcrypt passwords', async () => {
  for (const invalid of ['', 'short', 123, 'a'.repeat(73), '🙂'.repeat(19)]) {
    const h = updateHarness();
    assert.equal((await h.update(invalid)).status, 400);
    assert.equal(h.updates.length, 0);
  }
});
