import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', { url: 'https://example.test/list' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = fs.readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, window, URL, URLSearchParams, Event, require: name => {
    if (name === 'react') return React;
    assert.ok(name.startsWith('./'), `Unexpected dependency ${name}`);
    return load(name.slice(2));
  } });
  cache.set(file, exports);
  return exports;
}
const { useQueryState, isQueryUserEdit, resetQueryPage } = load('use-query-state');
const { useQueryFilters } = load('use-query-filters');
const { useQueryDate } = load('use-query-date');
const { useQueryRestore } = load('use-query-restore');

test('URL-backed state restores filters, validates page values and preserves unrelated keys', async () => {
  window.history.replaceState({ frameworkState: true }, '', '/list?search=Hello&page=3&campus=HN&campus=HCM&return_to=%2Fuser#rows');
  let state;
  function Screen() {
    state = { search: useQueryState('search', ''), page: useQueryState('page', 1), campuses: useQueryState('campus', []) };
    return React.createElement('p', null, `${state.search[0]}:${state.page[0]}`);
  }
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Screen)));
  assert.equal(state.search[0], 'Hello');
  assert.equal(state.page[0], 3);
  assert.deepEqual(Array.from(state.campuses[0]), ['HN', 'HCM']);
  const previousArray = state.campuses[0];
  await act(async () => { state.search[1]('Nguyễn & A'); state.page[1](4); });
  const url = new URL(window.location.href);
  assert.equal(url.searchParams.get('search'), 'Nguyễn & A');
  assert.equal(url.searchParams.get('page'), '4');
  assert.equal(url.searchParams.get('return_to'), '/user');
  assert.equal(url.hash, '#rows');
  assert.equal(window.history.state.frameworkState, true);
  assert.equal(state.campuses[0], previousArray, 'unrelated changes keep array references stable');
  await act(async () => root.unmount());
});

test('browser Back restores the previous tab and pagination state', async () => {
  window.history.replaceState(null, '', '/list');
  let tab, page;
  function Screen() {
    tab = useQueryState('tab', 'users', {values:['users','roles'], history:'push'});
    page = useQueryState('page', 1);
    return null;
  }
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Screen)));
  await act(async () => tab[1]('roles'));
  await act(async () => page[1](3));
  assert.equal(page[0], 3);
  await act(async () => new Promise(resolve => {
    window.addEventListener('popstate', resolve, {once:true});
    window.history.back();
  }));
  assert.equal(page[0], 1);
  assert.equal(tab[0], 'roles');
  await act(async () => root.unmount());
});

test('structured filters serialize only explicitly mapped non-sensitive fields', async () => {
  window.history.replaceState(null, '', '/list?centre=HN&flexible=false&tab=users');
  let filters;
  function Screen() {
    filters = useQueryFilters({centre:'', flexible:null, privateDraft:''}, {centre:'centre', flexible:'flexible'}, ['flexible']);
    return null;
  }
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Screen)));
  assert.equal(filters[0].centre, 'HN');
  assert.equal(filters[0].flexible, false);
  const setter = filters[1];
  await act(async () => setter(previous => ({...previous, privateDraft:'private text'})));
  await act(async () => setter(previous => ({...previous, centre:'HCM'})));
  assert.equal(filters[0].privateDraft, 'private text');
  assert.equal(new URL(window.location.href).searchParams.get('centre'), 'HCM');
  assert.equal(window.location.search.includes('private'), false);
  assert.equal(new URL(window.location.href).searchParams.get('tab'), 'users');
  await act(async () => root.unmount());
});

test('server rendering and hydration restore query without a hydration mismatch', async () => {
  window.history.replaceState(null, '', '/list?tab=roles');
  function Screen() {
    const [tab] = useQueryState('tab', 'users', {values:['users','roles']});
    return React.createElement('p', null, tab);
  }
  const container = document.getElementById('root');
  container.innerHTML = renderToString(React.createElement(Screen));
  assert.equal(container.textContent, 'users');
  const errors = [];
  let root;
  await act(async () => { root = hydrateRoot(container, React.createElement(Screen), {onRecoverableError: e => errors.push(e)}); });
  assert.equal(container.textContent, 'roles');
  assert.equal(errors.length, 0);
  await act(async () => root.unmount());
});

test('calendar dates validate impossible dates and roundtrip local calendar days', async () => {
  window.history.replaceState(null, '', '/list?date=2026-02-31');
  let date;
  function Screen() { date = useQueryDate('date', () => new Date(2026,9,28)); return null; }
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Screen)));
  assert.equal(date[0].getMonth(), 9);
  await act(async () => date[1](new Date(2026,10,2)));
  assert.equal(new URL(window.location.href).searchParams.get('date'), '2026-11-02');
  await act(async () => root.unmount());
});

test('restoring query-backed filters does not reset a requested page', async () => {
  window.history.replaceState(null, '', '/list?search=Hello&page=3');
  window.dispatchEvent(new Event('popstate'));
  let search, page;
  function Screen() {
    search = useQueryState('search', '');
    page = useQueryState('page', 1);
    React.useEffect(() => { if (isQueryUserEdit()) page[1](1); }, [search[0]]);
    return null;
  }
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Screen)));
  assert.equal(page[0], 3);
  await act(async () => search[1]('changed'));
  assert.equal(page[0], 1);
  await act(async () => root.unmount());
});

test('object multiselects put stable IDs rather than display payloads in query', async () => {
  window.history.replaceState(null, '', '/list?role=TM');
  let state;
  function Screen() {
    state = useQueryFilters({roles:[]}, {roles:'role'}, [], {roles:{valueKey:'role_code',labelKey:'role_name'}});
    return null;
  }
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Screen)));
  assert.equal(state[0].roles[0].role_code, 'TM');
  await act(async () => state[1]({roles:[{role_code:'TE',role_name:'Teacher coordinator'}]}));
  assert.equal(new URL(window.location.href).searchParams.get('role'), 'TE');
  assert.equal(window.location.search.includes('Teacher'), false);
  await act(async () => root.unmount());
});

test('explicit searches restore on Back after edits and clears without submitting every keystroke', async () => {
  window.history.replaceState(null, '', '/list?centre=HN');
  const restored = [];
  let filter;
  function Screen() {
    filter = useQueryState('centre', '');
    useQueryRestore(() => restored.push(filter[0]), ['centre']);
    return null;
  }
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Screen)));
  assert.deepEqual(restored, ['HN']);
  await act(async () => filter[1]('HCM'));
  assert.equal(restored.length, 1);
  await act(async () => new Promise(resolve => {
    window.addEventListener('popstate', resolve, {once:true}); window.history.back();
  }));
  assert.deepEqual(restored, ['HN', 'HN']);
  await act(async () => filter[1](''));
  await act(async () => new Promise(resolve => {
    window.addEventListener('popstate', resolve, {once:true}); window.history.back();
  }));
  assert.deepEqual(restored, ['HN', 'HN', 'HN']);
  await act(async () => root.unmount());
});

test('a filter change and pagination reset form one atomic history step', async () => {
  window.history.pushState(null, '', '/batch?page=3');
  let status, page;
  function Screen() {
    status = useQueryState('status', 'all');
    page = useQueryState('page', 1);
    React.useEffect(() => { if (isQueryUserEdit()) resetQueryPage(page[1]); }, [status[0]]);
    return null;
  }
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Screen)));
  const before = window.history.length;
  await act(async () => status[1]('new'));
  assert.equal(window.history.length, before + 1);
  assert.equal(page[0], 1);
  await act(async () => new Promise(resolve => {
    window.addEventListener('popstate', resolve, {once:true}); window.history.back();
  }));
  assert.equal(status[0], 'all');
  assert.equal(page[0], 3);
  await act(async () => root.unmount());
});
