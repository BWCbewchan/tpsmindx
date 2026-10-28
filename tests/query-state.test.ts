import test from 'node:test'
import assert from 'node:assert/strict'
import { readQueryValue, writeQueryValue } from '../lib/query-state-codec.ts'

test('merging state preserves unrelated workflow parameters and the hash', () => {
  const url = writeQueryValue(new URL('https://example.test/list?return_to=%2Fuser&tab=roles#table'), 'search', 'Nguyễn & A', '')
  assert.equal(url.searchParams.get('return_to'), '/user')
  assert.equal(url.searchParams.get('tab'), 'roles')
  assert.equal(url.searchParams.get('search'), 'Nguyễn & A')
  assert.equal(url.hash, '#table')
})
test('default values remove only their own keys', () => {
  const url = writeQueryValue(new URL('https://example.test/?page=3&tab=users'), 'page', 1, 1)
  assert.equal(url.searchParams.has('page'), false)
  assert.equal(url.searchParams.get('tab'), 'users')
})
test('pagination rejects invalid, unsafe and out-of-range numbers', () => {
  for (const raw of ['-1', '0', '1.2', 'NaN', 'Infinity', '9007199254740993', '']) {
    assert.equal(readQueryValue(new URLSearchParams({page: raw}), 'page', 1), 1)
  }
  assert.equal(readQueryValue(new URLSearchParams('page=4'), 'page', 1), 4)
})
test('enum values and oversized text fall back safely', () => {
  assert.equal(readQueryValue(new URLSearchParams('tab=unknown'), 'tab', 'users', {values:['users','roles']}), 'users')
  assert.equal(readQueryValue(new URLSearchParams({search:'a'.repeat(501)}), 'search', ''), '')
})
test('multiselect filters roundtrip through repeated params and reject excessive values', () => {
  const next = writeQueryValue(new URL('https://example.test/?page=2'), 'centres', ['HN', 'HCM'], [] as string[])
  assert.deepEqual(readQueryValue(next.searchParams, 'centres', [] as string[]), ['HN', 'HCM'])
  assert.equal(next.searchParams.get('page'), '2')
  assert.deepEqual(readQueryValue(new URLSearchParams('centres=HN&centres=HN'), 'centres', [] as string[]), ['HN'])
  const tooMany = new URLSearchParams()
  for (let i=0; i<101; i++) tooMany.append('centres', String(i))
  assert.deepEqual(readQueryValue(tooMany, 'centres', [] as string[]), [])
})
test('boolean and optional identifiers parse without JavaScript coercion', () => {
  assert.equal(readQueryValue(new URLSearchParams('enabled=false'), 'enabled', true), false)
  assert.equal(readQueryValue(new URLSearchParams('enabled=anything'), 'enabled', true), true)
  assert.equal(readQueryValue(new URLSearchParams('category=coding'), 'category', null), 'coding')
})

test('invalid dates and month/year selectors fall back to valid defaults', () => {
  assert.equal(readQueryValue(new URLSearchParams('date=2026-02-31'), 'date', '', {kind:'date'}), '')
  assert.equal(readQueryValue(new URLSearchParams('month=13'), 'month', 'all', {kind:'month'}), 'all')
  assert.equal(readQueryValue(new URLSearchParams('month=2026-10'), 'month', 'all', {kind:'month'}), '2026-10')
  assert.equal(readQueryValue(new URLSearchParams('year=999999'), 'year', '2026', {kind:'year'}), '2026')
})
