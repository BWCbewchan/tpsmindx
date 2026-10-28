const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(path.join(root, entry.name)) : [path.join(root, entry.name)]);
}
const normalize = file => file.replaceAll('\\', '/');
const cache = new Map();
function inspect(file) {
  file = normalize(path.normalize(file));
  if (cache.has(file)) return cache.get(file);
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = { file: normalize(file), shared: [], existing: [], imports: [] };
  cache.set(file, result);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(ast);
      if (['useQueryState', 'useQueryDate'].includes(name) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const declaration = node.parent;
        result.shared.push({
          state: ts.isVariableDeclaration(declaration) ? declaration.name.getText(ast) : '',
          key: node.arguments[0].text,
          kind: name === 'useQueryDate' ? 'calendar date' : 'navigation state',
          options: node.arguments[2]?.getText(ast),
        });
      }
      if (name === 'useQueryFilters' && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
        for (const property of node.arguments[1].properties) {
          if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)) {
            result.shared.push({state: property.name.getText(ast), key: property.initializer.text, kind: 'filter'});
          }
        }
      }
      if (/searchParams\.get$/i.test(name) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) result.existing.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const spec = node.moduleSpecifier.text;
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
    const base = spec.startsWith('@/') ? spec.slice(2) : path.join(path.dirname(file), spec);
    const resolved = [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')]
      .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (resolved && /^(app|components)[/\\]/.test(resolved)) result.imports.push(resolved);
  }
  return result;
}
function collect(file, visited = new Set()) {
  file = normalize(path.normalize(file));
  if (visited.has(file)) return [];
  visited.add(file);
  const item = inspect(file);
  return [item, ...item.imports.flatMap(child => collect(child, visited))];
}
const pages = files('app').filter(file => /[/\\]page\.tsx$/.test(file));
const routes = pages.map(file => {
  const related = collect(file);
  const shared = related.flatMap(item => item.shared.map(state => ({...state, file:item.file})));
  const existing = [...new Set(related.flatMap(item => item.existing))];
  return { route: normalize(file).replace(/^app/, '').replace(/\/page\.tsx$/, '') || '/', shared, existing };
});
const modules = [...cache.values()].filter(item => item.shared.length).map(({imports, ...item}) => item);
fs.mkdirSync('docs/query-state', { recursive:true });
fs.writeFileSync('docs/query-state/manifest.json', JSON.stringify({routes, modules}, null, 2) + '\n');
const rows = routes.map(item => {
  const keys = [...new Set(item.shared.map(state => state.key))];
  const description = keys.length ? `Shared: ${keys.map(key => '`' + key + '`').join(', ')}`
    : item.existing.length ? `Existing workflow query: ${item.existing.map(key => '`'+key+'`').join(', ')}`
      : 'No shareable list state found in this route/import graph; detail, form, static or redirect route.';
  return `| \`${item.route}\` | ${description} |`;
});
fs.writeFileSync('docs/query-state/audit.md', [
  '# Project URL state audit', '',
  'Generated with `node scripts/audit-query-state.cjs`. This is a static route/import audit, not a claim that every route has been browser-tested.', '',
  `Scanned ${routes.length} page routes. ${modules.length} modules declare ${modules.reduce((sum,item)=>sum+item.shared.length,0)} URL-backed state fields.`, '',
  '## Policy', '',
  '- URL state never grants authorization. Existing route and API permission checks remain authoritative.',
  '- Preserve existing workflow identifiers, return destinations, signed/public URLs and unrelated query keys.',
  '- Repeated keys encode multiselects. Invalid enum, date, oversized text and numeric values fall back to screen defaults.',
  '- Search drafts use replaceState; tab/filter/page navigation uses history entries. Opening/restoring links must not reset pagination.',
  '- Keep passwords, SQL statements/row searches, grading answers, student/private form input, imports, uploads, bulk-action selection and modal editing drafts out of URLs.',
  '- Picker-only search boxes, sidebar open/close, hover state, loading state, generated reports and API results remain local.',
  '- Infinite-scroll result caches are reloaded rather than serialized. Explicit read-only search pages restore their filters and trigger the existing authorized loader.', '',
  '| Route | Query contract |', '| --- | --- |', ...rows, '',
].join('\n'));
console.log(`Audited ${routes.length} routes; ${modules.length} modules; ${modules.reduce((sum,item)=>sum+item.shared.length,0)} shared fields.`);
