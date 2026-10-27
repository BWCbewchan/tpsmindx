import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path, dependencies = {}) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const { getFilteredAdminMenuItems, checkHrefPermission } = loadModule('../lib/menu-permissions.ts', {
  '@/lib/admin-permission-routes': loadModule('../lib/admin-permission-routes.ts'),
});
const calendar = '/admin/hr-candidates/training-calendar';
const manager = { role: 'manager', isAdmin: true, permissions: [calendar] };
const training = {
  label: 'Đào tạo đầu vào', href: '/admin/hr-candidates', submenu: [
    { label: 'Ứng viên', href: '/admin/hr-candidates' },
    { label: 'Lịch đào tạo', href: calendar },
  ],
};

test('a denied parent opens its first permitted child without granting parent access', () => {
  const [item] = getFilteredAdminMenuItems([training], manager);
  assert.equal(item.href, calendar);
  assert.equal(item.submenu.length, 1);
  assert.equal(checkHrefPermission('/admin/hr-candidates', manager), false);
  assert.equal(training.href, '/admin/hr-candidates', 'catalog must remain unchanged');
});

test('an allowed parent retains its original destination', () => {
  const [item] = getFilteredAdminMenuItems([training], { ...manager, permissions: ['/admin/hr-candidates'] });
  assert.equal(item.href, '/admin/hr-candidates');
  assert.equal(item.submenu.length, 2);
});

test('fallback searches recursively through submenu and grouped Dock items', () => {
  const menus = [{ label: 'Training', href: '/admin/training', submenu: [
    { groupLabel: 'Schedule', items: [training] },
  ] }];
  const [item] = getFilteredAdminMenuItems(menus, manager);
  assert.equal(item.href, calendar);
  assert.equal(item.submenu[0].items[0].href, calendar);
});

test('fallback uses the first allowed destination in catalog order', () => {
  const [item] = getFilteredAdminMenuItems([{ ...training, submenu: [
    { label: 'Denied', href: '/admin/denied' },
    { label: 'Calendar', href: calendar },
    { label: 'Portfolio', href: '/admin/portfolio' },
  ] }], { ...manager, permissions: [calendar, '/admin/portfolio'] });
  assert.equal(item.href, calendar);
});

test('heading-only groups retain their toggle behavior and inaccessible groups disappear', () => {
  const heading = { label: 'Training', submenu: [training] };
  assert.equal(getFilteredAdminMenuItems([heading], manager)[0].href, undefined);
  assert.equal(getFilteredAdminMenuItems([training], { ...manager, permissions: [] }).length, 0);
  assert.equal(getFilteredAdminMenuItems([training], null).length, 0);
});

test('super administrators retain the parent route', () => {
  assert.equal(getFilteredAdminMenuItems([training], { role: 'super_admin' })[0].href, '/admin/hr-candidates');
});
