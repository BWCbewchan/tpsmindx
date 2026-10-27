import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../app/api/app-auth/user-roles/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function harness({ allowed = true, role = 'manager', failSave = false } = {}) {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('SELECT role')) return { rows: role ? [{ role }] : [] };
      if (failSave && sql.includes('INSERT INTO app_permissions')) throw new Error('save failed');
      return { rows: [] };
    },
    release() { queries.push({ sql: 'RELEASE' }); },
  };
  const exports = {};
  const dependencies = {
    '@/lib/auth-server': { requireBearerSuperAdminMutation: async () => allowed
      ? { ok: true, sessionEmail: 'admin@example.test', role: 'super_admin' }
      : { ok: false, response: { status: 403 } } },
    '@/lib/teacher-session-routing': { INTERFACE_SWITCH_DISABLED: '/account/interface-switch-disabled' },
    '@/lib/db': { default: { connect: async () => client } },
    'next/server': { NextResponse: { json: (body, options) => ({ status: options?.status ?? 200, body }) } },
  };
  vm.runInNewContext(compiled, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected import ${name}`);
    return dependencies[name];
  }, console: { error() {} } });
  return { queries, post: body => exports.POST({ json: async () => body }) };
}

test('only super administrators can update switching and roles', async () => {
  const { post, queries } = harness({ allowed: false });
  assert.equal((await post({ userId: 1, roleCodes: [], allowInterfaceSwitch: false })).status, 403);
  assert.equal(queries.length, 0);
});

test('rejects malformed settings before opening a transaction', async () => {
  for (const payload of [
    { userId: 1, roleCodes: [], allowInterfaceSwitch: 'false' },
    { userId: -1, roleCodes: [] }, { userId: 1, roleCodes: [null] },
  ]) {
    const { post, queries } = harness();
    assert.equal((await post(payload)).status, 400);
    assert.equal(queries.length, 0);
  }
});

test('disabling writes an account restriction and commits it with roles', async () => {
  const { post, queries } = harness();
  assert.equal((await post({ userId: 1, roleCodes: ['SO'], allowInterfaceSwitch: false })).status, 200);
  assert.ok(queries.some(q => q.sql.includes('INSERT INTO user_roles')));
  const restriction = queries.find(q => q.sql.includes('INSERT INTO app_permissions'));
  assert.deepEqual(Array.from(restriction.params), [1, '/account/interface-switch-disabled']);
  assert.equal(queries.at(-2).sql, 'COMMIT');
  assert.equal(queries.at(-1).sql, 'RELEASE');
});

test('enabling removes only the restriction; super administrators always retain switching', async () => {
  for (const [role, allowInterfaceSwitch] of [['manager', true], ['super_admin', false]]) {
    const { post, queries } = harness({ role });
    assert.equal((await post({ userId: 1, roleCodes: [], allowInterfaceSwitch })).status, 200);
    assert.ok(queries.some(q => q.sql.includes('DELETE FROM app_permissions') && q.params[1] === '/account/interface-switch-disabled'));
    assert.ok(!queries.some(q => q.sql.includes('INSERT INTO app_permissions')));
  }
});

test('older role-only callers preserve switching configuration', async () => {
  const { post, queries } = harness();
  assert.equal((await post({ userId: 1, roleCodes: [] })).status, 200);
  assert.ok(!queries.some(q => q.sql.includes('app_permissions')));
});

test('failed setting save rolls back role edits and releases the connection', async () => {
  const { post, queries } = harness({ failSave: true });
  assert.equal((await post({ userId: 1, roleCodes: ['SO'], allowInterfaceSwitch: false })).status, 500);
  assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
  assert.ok(!queries.some(q => q.sql === 'COMMIT'));
  assert.equal(queries.at(-1).sql, 'RELEASE');
});

test('missing accounts do not change any grants', async () => {
  const { post, queries } = harness({ role: null });
  assert.equal((await post({ userId: 1, roleCodes: [], allowInterfaceSwitch: false })).status, 404);
  assert.ok(!queries.some(q => q.sql.startsWith('DELETE') || q.sql.startsWith('INSERT')));
  assert.equal(queries.at(-2).sql, 'ROLLBACK');
});
