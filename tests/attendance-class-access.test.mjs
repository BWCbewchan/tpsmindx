import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Load pure access helpers from the actual route without importing DB/LMS services.
const source = fs.readFileSync(new URL('../app/api/user/diem-danh-lop-hoc/route.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
const declarations = ast.statements.filter(n => ts.isFunctionDeclaration(n) && !n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword));
const pureNames = new Set(['normalizeEmail', 'normalizeStatus', 'normalizeRoleText', 'roleValues', 'teacherMatches', 'hasMatchingTeacherAttendance', 'isLecAssignment', 'isTaAssignment', 'isJudgeAssignment', 'sortedSlots', 'userRolesForClass', 'hasTeacherAccessToClass', 'compareDateLike', 'toDateKey']);
const pureSource = 'const SESSION_COUNT = 14;\n' + declarations.filter(n => pureNames.has(n.name?.text)).map(n => n.getText(ast)).join('\n');
const compiled = ts.transpileModule(pureSource + '\nexport { hasTeacherAccessToClass };', { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { hasTeacherAccessToClass: canAccess } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const email = 'teacher@example.test';
const assignment = (role = 'LEC', isActive = true) => ({ isActive, teacher: { email }, role: { shortName: role } });

test('assigned lecturers, assistants and judges can access their class', () => {
  for (const role of ['LEC', 'TA', 'JUDGE']) assert.equal(canAccess({ teachers: [assignment(role)] }, email), true);
});
test('slot and class-site assignments use the same access policy', () => {
  assert.equal(canAccess({ slots: [{ teachers: [assignment('TA')] }] }, email), true);
  assert.equal(canAccess({ classSites: [{ teachers: [assignment()] }] }, email), true);
  assert.equal(canAccess({ classSites: [{ classSiteSlots: [{ teachers: [assignment()] }] }] }, email), true);
});
test('existing attendance grants access and email matching is normalized', () => {
  assert.equal(canAccess({ slots: [{ teacherAttendance: [{ teacher: { email } }] }] }, ' TEACHER@example.test '), true);
});
test('unrelated, inactive and empty-email users cannot access a class', () => {
  assert.equal(canAccess({ teachers: [assignment()] }, 'other@example.test'), false);
  assert.equal(canAccess({ teachers: [assignment('LEC', false)] }, email), false);
  assert.equal(canAccess({ slots: [{ teacherAttendance: [{}] }] }, ''), false);
  assert.equal(canAccess({}, email), false);
});
