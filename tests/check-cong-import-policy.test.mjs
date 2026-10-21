import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(
  new URL('../lib/check-cong-service.ts', import.meta.url),
  'utf8',
)
const ast = ts.createSourceFile(
  'check-cong-service.ts',
  source,
  ts.ScriptTarget.Latest,
  true,
)
const declaration = ast.statements.find(
  (node) =>
    ts.isFunctionDeclaration(node) &&
    node.name?.text === 'selectPrimaryImportMonth',
)
assert.ok(declaration, 'selectPrimaryImportMonth must exist')

const compiled = ts.transpileModule(
  `${declaration.getText(ast)}\nexport { selectPrimaryImportMonth };`,
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText
const { selectPrimaryImportMonth } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
)

function rows(count) {
  return [['Slot time'], ...Array.from({ length: count }, () => ['value'])]
}

test('a monthly upload only selects its dominant month', () => {
  const result = selectPrimaryImportMonth(
    new Map([
      ['2026-08', rows(3)],
      ['2026-09', rows(15_524)],
    ]),
  )

  assert.equal(result.month, '2026-09')
  assert.equal(result.rows.length - 1, 15_524)
  assert.deepEqual(result.ignoredMonths, [
    { month: '2026-08', recordCount: 3 },
  ])
})

test('single-month uploads have no ignored groups', () => {
  const result = selectPrimaryImportMonth(
    new Map([['2026-08', rows(17_550)]]),
  )

  assert.equal(result.month, '2026-08')
  assert.deepEqual(result.ignoredMonths, [])
})

test('ambiguous uploads are rejected instead of replacing an arbitrary month', () => {
  assert.throws(
    () =>
      selectPrimaryImportMonth(
        new Map([
          ['2026-08', rows(5)],
          ['2026-09', rows(5)],
        ]),
      ),
    /Không xác định được tháng chính/,
  )
})
