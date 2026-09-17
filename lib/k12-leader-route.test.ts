import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as tree from './k12-leader-tree.ts';

// Exercise the actual route export without touching the configured database.
function harness({ failUpdate = false, role = 'super_admin' } = {}) {
  const calls: string[] = [];
  const rows = ['i', 'ii'].map((slug, index) => ({ id: index + 1, slug, relative_path: `${slug}.md`, parent_id: null, section_id: null, type: 'article', sort_order: index }));
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.startsWith('SELECT')) return { rows };
      if (failUpdate && sql.startsWith('UPDATE')) throw new Error('Simulated write failure');
      return { rows: [], rowCount: 1 };
    },
    release: () => calls.push('RELEASE'),
  };
  const pool = { query: async () => ({ rows: [{ role }] }), connect: async () => client };
  const module = { exports: {} as { PATCH: (request: Request) => Promise<Response> } };
  const code = ts.transpileModule(fs.readFileSync(new URL('../app/api/k12-leader-docs/route.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module, require: (id: string) => {
    if (id === '@/lib/db') return { __esModule: true, default: pool };
    if (id === '@/lib/datasource-api-auth') return { requireBearerSession: async () => ({ ok: true, sessionEmail: 'test@example.invalid' }) };
    if (id === '@/lib/k12-leader-docs') return { clearK12LeaderDocsCache: () => calls.push('CLEAR_CACHE') };
    if (id === '@/lib/k12-leader-tree') return tree;
    if (id === 'next/server') return { NextResponse: Response };
    if (id === 'path') return {};
    throw new Error(`Unexpected dependency: ${id}`);
  } });
  const request = () => new Request('http://localhost/api/k12-leader-docs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reorder_siblings', orderedSlugs: ['ii', 'i'] }) });
  return { calls, run: () => module.exports.PATCH(request()) };
}

test('PATCH accepts the drag payload and commits all sibling positions on one connection', async () => {
  const { calls, run } = harness();
  const response = await run();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(calls.filter(sql => sql.startsWith('UPDATE')).length, 2);
  assert.ok(calls.indexOf('COMMIT') < calls.indexOf('CLEAR_CACHE'));
  assert.equal(calls.at(-1), 'RELEASE');
});
test('failed tree updates roll back and release the connection', async () => {
  const { calls, run } = harness({ failUpdate: true });
  assert.equal((await run()).status, 400);
  assert.ok(calls.includes('ROLLBACK'));
  assert.ok(!calls.includes('COMMIT'));
  assert.ok(!calls.includes('CLEAR_CACHE'));
  assert.equal(calls.at(-1), 'RELEASE');
});
test('PATCH retains the route authorization gate', async () => {
  const { calls, run } = harness({ role: 'user' });
  assert.equal((await run()).status, 403);
  assert.deepEqual(calls, []);
});

for (const [file, functionName] of [
  ['../app/admin/quy-trinh-quy-dinh-leader/manage/page.tsx', 'buildSidebarTreeByRelativePath'],
  ['./k12-leader-docs.ts', 'buildTreeFromRelativePaths'],
]) {
  test(`${functionName}: stored order wins over Roman numbering after reload`, () => {
    const source = ts.createSourceFile(file, fs.readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declaration = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === functionName);
    assert.ok(declaration);
    const code = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const build = vm.runInNewContext(`${code}; ${functionName}`, {
      prettifySegment: (name: string) => name,
      prettifyName: (name: string) => name,
      normalizeRelativePath: (name: string) => name,
    });
    const documents = [
      { id: 1, slug: 'i-first', relativePath: 'i-first.md', title: 'I. First', sortOrder: 1, content: '' },
      { id: 2, slug: 'ii-second', relativePath: 'ii-second/index.md', title: 'II. Second', sortOrder: 0, content: '' },
      { id: 3, slug: 'ii-second/child', relativePath: 'ii-second/child.md', title: 'Child', sortOrder: 0, content: '' },
    ];
    const result = build(documents);
    assert.equal(result[0].slug, 'ii-second');
    assert.equal(result[1].slug, 'i-first');
    assert.equal(result[0].children[0].slug, 'ii-second/child');
  });
}
