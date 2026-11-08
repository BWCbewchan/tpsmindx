import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(
  new URL('../app/admin/hr-candidates/components/GenOverviewTab.tsx', import.meta.url),
  'utf8',
);
const ast = ts.createSourceFile('GenOverviewTab.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = ast.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'shouldAutoFocusFetchedSchedule',
);

assert.ok(declaration, 'calendar focus policy helper should exist');

const compiled = ts.transpileModule(
  `${declaration.getText(ast)}\nexport { shouldAutoFocusFetchedSchedule };`,
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText;
const { shouldAutoFocusFetchedSchedule } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('aggregate GEN calendar stays on the current period after schedules load', () => {
  assert.equal(shouldAutoFocusFetchedSchedule(false, 2), false);
});

test('a selected GEN still opens the period containing its first schedule', () => {
  assert.equal(shouldAutoFocusFetchedSchedule(true, 2), true);
});

test('an empty selected GEN does not change the focused period', () => {
  assert.equal(shouldAutoFocusFetchedSchedule(true, 0), false);
});
