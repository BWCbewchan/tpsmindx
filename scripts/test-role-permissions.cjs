const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', output)((id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`, mocks);
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}

const { checkHrefPermission: can, getFilteredAdminMenuItems: menu } = load('lib/menu-permissions.ts');
const user = (permissions = [], role = 'manager') => ({ role, permissions, isAdmin: true, isActive: true });
for (const role of ['manager', 'admin', 'teacher']) {
  for (const route of ['/admin/deal-luong', '/admin/tao-deal-luong', '/admin/page2/manage', '/admin/quy-trinh-quy-dinh-leader']) {
    assert.equal(can(route, user([], role)), false, `${role} must not get ${route} implicitly`);
    assert.equal(can(route, user([route], role)), true);
  }
}
assert.equal(can('/admin/deal-luong', { ...user(), userRoles: ['SUPER_ADMIN', 'HR', 'TE'] }), false);
assert.equal(can('/admin/deal-luong', user([], 'super_admin')), true);
assert.equal(can('/admin/deal-luong', { ...user([], 'super_admin'), isActive: false }), false);
assert.equal(can('/admin/page2', user(['/admin/page2/manage'])), false);
assert.equal(can('/admin/page2/manage/123', user(['/admin/page2/manage'])), true);
assert.equal(can('/admin/page20', user(['/admin/page2'])), false);
assert.equal(can('/admin/page2/?tab=a', user(['/admin/page2/'])), true);
assert.equal(can('/admin/system-metrics', user(['/admin/system-metrics'])), false);
assert.equal(can('/admin/deal-luong', user(['/admin'])), false);
const items = [{ label: 'Group', items: [{ href: '/admin/deal-luong' }, { href: '/admin/page2/manage' }] }];
assert.deepEqual(menu(items, user()), []);
assert.deepEqual(menu(items, user(['/admin/page2/manage'])), [{ label: 'Group', items: [{ href: '/admin/page2/manage' }] }]);

const portfolioPolicy = load('lib/menu-permissions.ts');
const homindx = { ...user(['/admin/page2', '/admin/portfolio', '/admin/kiem-soat-spck']), userRoles: ['HOMINDX'] };
for (const route of ['/admin/page2', '/admin/portfolio', '/admin/kiem-soat-spck']) assert.equal(can(route, homindx), true);
for (const route of ['/admin/deal-luong', '/admin/tao-deal-luong', '/admin/page2/manage', '/admin/quy-trinh-quy-dinh-leader']) assert.equal(can(route, homindx), false);
const studentMenu = [{ label: 'Quản lý học viên', submenu: [{ href: '/admin/kiem-soat-spck' }, { href: '/admin/portfolio' }] }];
assert.deepEqual(menu(studentMenu, homindx), studentMenu);
assert.equal(portfolioPolicy.isPortfolioEditorUser(homindx), true);
assert.equal(portfolioPolicy.isPortfolioEditorUser(user(['/admin/portfolio'])), false);
assert.equal(portfolioPolicy.isPortfolioReadOnlyLeaderUser(user(['/admin/portfolio'])), true);
assert.equal(can('/admin/kiem-soat-spck', user(['/admin/portfolio'])), false);
assert.equal(can('/admin/portfolio/builder/123', user(['/admin/portfolio'])), false);
assert.equal(can('/admin/portfolio', { ...user(), userRoles: ['TE', 'TC', 'TEGL'] }), false);
const legacy = user(['/admin/page2', '/admin/portfolio', '/admin/portfolio/portfolios']);
assert.deepEqual(menu(studentMenu, legacy), studentMenu);
assert.equal(can('/admin/kiem-soat-spck', user(['/admin/portfolio/portfolios'])), false);

const catalog = require('../lib/default-screen-catalog.json');
const routes = catalog.map((s) => s.route_path);
assert.equal(new Set(routes).size, routes.length, 'No duplicate screen entries');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
for (const file of walk('app/admin').filter((f) => f.endsWith('page.tsx'))) {
  const route = '/' + path.dirname(file).replaceAll('\\', '/').replace(/^app\//, '');
  if (route === '/admin/profile') continue;
  assert.ok(routes.some((r) => route === r || route.startsWith(`${r}/`)), `Missing screen: ${route}`);
}

async function testApi() {
  let access = user();
  let dbCalls = 0;
  const api = load('app/api/salary-deals/route.ts', {
    '@/lib/db': { connect: async () => {
      dbCalls++;
      return { query: async () => ({ rows: [], rowCount: 0 }), release() {} };
    } },
    '@/lib/notification-service': { createNotification: async () => {} },
    '@/lib/datasource-api-auth': {
      requireBearerSession: async () => ({ ok: true, sessionEmail: 'a@example.com', privileged: true, resolvedAccess: access }),
      rejectIfEmailNotSelf: () => null,
    },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
  });
  assert.equal((await api.GET({ nextUrl: new URL('https://example.com/api/salary-deals') })).status, 403);
  assert.equal((await api.GET({ nextUrl: new URL('https://example.com/api/salary-deals?email=b@example.com') })).status, 403);
  assert.equal((await api.POST({ json: async () => ({}) })).status, 403);
  assert.equal((await api.PATCH({ json: async () => ({}) })).status, 403);
  assert.equal(dbCalls, 0, 'Deny before reading or mutating deals');
  access = user(['/admin/deal-luong']);
  assert.equal((await api.PATCH({ json: async () => ({ id: 1, action: 'typo', reviewer_name: 'A' }) })).status, 400);
  assert.equal(dbCalls, 0);
  assert.equal((await api.GET({ nextUrl: new URL('https://example.com/api/salary-deals') })).status, 200);
  access = user(['/admin/tao-deal-luong']);
  assert.equal((await api.GET({ nextUrl: new URL('https://example.com/api/salary-deals?email=a@example.com') })).status, 200);
  assert.equal((await api.GET({ nextUrl: new URL('https://example.com/api/salary-deals') })).status, 403);
  assert.equal((await api.POST({ json: async () => ({}) })).status, 400, 'Explicit create permission reaches input validation');
  access = user([], 'teacher');
  access.isAdmin = false;
  assert.equal((await api.GET({ nextUrl: new URL('https://example.com/api/salary-deals?email=a@example.com') })).status, 200, 'Teacher can still read own requests');
  console.log('PASS: explicit grants, navigation parity, route boundaries, catalog coverage and deal API denial.');
}

async function testRoleSave() {
  let calls = [];
  let exists = true;
  const api = load('app/api/app-auth/role-permissions/route.ts', {
    '@/lib/auth-server': { requireBearerSuperAdmin: async () => ({ ok: true }) },
    '@/lib/db': { connect: async () => ({
      query: async (sql, values) => {
        calls.push({ sql, values });
        return { rows: sql.startsWith('SELECT') && exists ? [{ role_code: 'TEST' }] : [] };
      }, release() {},
    }) },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
  });
  const save = (permissions) => api.POST({ json: async () => ({ roleCode: 'TEST', permissions }) });
  assert.equal((await save([null])).status, 400);
  assert.equal(calls.length, 0);
  const result = await save(['/admin/deal-luong', '/admin/deal-luong']);
  assert.equal(result.body.count, 1);
  assert.equal(calls.at(-1).sql, 'COMMIT');
  calls = [];
  assert.equal((await save([])).body.count, 0);
  assert.ok(calls.some((c) => c.sql.startsWith('DELETE')));
  assert.equal(calls.some((c) => c.sql.startsWith('INSERT')), false);
  calls = [];
  exists = false;
  assert.equal((await save([])).status, 404);
  assert.equal(calls.some((c) => c.sql.startsWith('DELETE')), false);
  console.log('PASS: role save validation, deduplication, empty-role revocation and missing-role rollback.');
}
async function testSelector() {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
  global.HTMLElement = dom.window.HTMLElement;
  const React = require('react');
  const { render, fireEvent, waitFor, cleanup } = require('@testing-library/react');
  const screens = [
    { route_path: '/admin/deal-luong', label: 'Duyệt lương', group_name: 'Lương', sort_order: 1, is_active: true },
    { route_path: '/admin/tao-deal-luong', label: 'Tạo lương', group_name: 'Lương', sort_order: 2, is_active: true },
    { route_path: '/admin/training-studio', label: 'Mục cũ đã ẩn', group_name: 'Lương', sort_order: 3, is_active: false },
    { route_path: '/user/tai-lieu-giang-day', label: 'Trang người dùng', group_name: 'Lương', sort_order: 4, is_active: true },
  ];
  global.fetch = async () => ({ ok: true, json: async () => ({ screens }) });
  const Selector = load('app/admin/user-management/components/PermSelector.tsx', {
    '@/lib/auth-context': { useAuth: () => ({ token: 'test' }) },
    '@/lib/auth-headers': { authHeaders: () => ({}) },
    '@/lib/default-screen-catalog': { DEFAULT_SCREEN_CATALOG: screens },
  }).default;
  let selected = [];
  function Harness() {
    const [perms, setPerms] = React.useState([]);
    selected = perms;
    return React.createElement(Selector, { perms, setPerms });
  }
  const ui = render(React.createElement(Harness));
  await waitFor(() => assert.ok(ui.getByText('Duyệt lương')));
  assert.equal(ui.queryByText('Mục cũ đã ẩn'), null, 'Hidden entries cannot receive new grants');
  assert.equal(ui.queryByText('Trang người dùng'), null, 'User routes are not admin grants');
  fireEvent.click(ui.getByRole('button', { name: /Lương/ }));
  assert.equal(ui.queryByText('Duyệt lương'), null, 'Last group stays collapsed');
  fireEvent.click(ui.getByRole('button', { name: /Lương/ }));
  fireEvent.change(ui.getByPlaceholderText('Tìm màn hình, đường dẫn, nhóm...'), { target: { value: 'Duyệt' } });
  fireEvent.click(ui.getByRole('checkbox', { name: 'Chọn nhóm Lương' }));
  assert.deepEqual(selected, ['/admin/deal-luong'], 'Group selection affects only filtered results');
  fireEvent.change(ui.getByPlaceholderText('Tìm màn hình, đường dẫn, nhóm...'), { target: { value: 'Tạo' } });
  fireEvent.click(ui.getByRole('button', { name: 'Chọn các kết quả' }));
  assert.deepEqual(selected, ['/admin/deal-luong', '/admin/tao-deal-luong']);
  fireEvent.click(ui.getByRole('button', { name: 'Bỏ chọn kết quả' }));
  assert.deepEqual(selected, ['/admin/deal-luong'], 'Deselect preserves hidden selections');
  cleanup();
  dom.window.close();
  console.log('PASS: permission selector collapse, filtered group selection and selection preservation.');
}
async function testPortfolioDataScope() {
  let access = { ok: true, sessionEmail: 'test@example.com', resolvedAccess: user(['/admin/kiem-soat-spck']), accessibleCenters: [] };
  let selectedFilter;
  const centers = [{ id: 1, full_name: 'Center A', short_code: 'A' }];
  const api = load('app/api/admin/portfolio/classes/route.ts', {
    '@/lib/datasource-api-auth': { requireBearerSession: async () => access },
    '@/lib/center-access': { getAccessibleCenters: async () => access.accessibleCenters },
    '@/lib/rate-limit-memory': { clientIpFromRequest: () => 'test', rateLimitOr429Async: async () => null },
    '@/lib/lms-token-helper': { getOrRefreshLmsToken: async () => ({}), applyRefreshedCookies: () => {} },
    '@/lib/portfolio/service': { fetchClassesForQC: async (filter) => {
      selectedFilter = filter;
      return { data: [{ centreName: 'Center A' }, { centreName: 'Center B' }], pagination: { total: 2 } };
    } },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
  });
  const request = (suffix = '') => ({ nextUrl: new URL('https://example.com/api/admin/portfolio/classes' + suffix) });
  assert.equal((await api.GET(request())).status, 403);
  assert.equal(selectedFilter, undefined, 'No assigned centres must not call LMS');
  access.accessibleCenters = centers;
  assert.equal((await api.GET(request('?centres=Center%20B'))).status, 403);
  const scoped = await api.GET(request());
  assert.deepEqual(selectedFilter.centreNames, ['Center A']);
  assert.deepEqual(scoped.body.data, [{ centreName: 'Center A' }]);

  const pages = [];
  let fail = false;
  const service = load('lib/portfolio/service.ts', {
    '@/lib/db': {},
    '@/lib/lms-api': { callLmsApi: async (input) => {
      if (fail) throw new Error('401 expired');
      pages.push(input.variables.pageIndex);
      return { data: { classes: { data: [], pagination: { total: 150 } } } };
    } },
  });
  for (const pageIndex of [0, 1, 2]) {
    const result = await service.fetchClassesForQC({ pageIndex });
    assert.equal(result.pagination.total, 150);
    assert.equal(result.pagination.itemsPerPage, 50);
  }
  assert.deepEqual(pages, [0, 1, 2], 'Each request consumes exactly one source page without fallback or skipped pages');
  fail = true;
  await assert.rejects(service.fetchClassesForQC({}), /401 expired/, 'Expired LMS sessions must reach route retry');
  console.log('PASS: assigned-centre enforcement, sequential pagination and LMS authentication errors.');
}

testApi().then(testRoleSave).then(testSelector).then(testPortfolioDataScope).catch((error) => { console.error(error); process.exitCode = 1; });
