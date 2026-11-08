'use client'

import { useCallback, useMemo, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react'
import { readQueryValue, writeQueryValue, type QueryOptions, type QueryValue } from './query-state-codec'

const CHANGE_EVENT = 'tps:query-state'
let lastEditedUrl = ''
let pending: { url: URL; pathname: string; mode: 'push' | 'replace' } | null = null
let replacingReset = false
export function getQueryUrl() { return new URL(pending?.url.href || window.location.href) }
/** Multiple setters in one interaction create one history entry and merge keys. */
export function commitQueryUrl(url: URL, mode: 'push' | 'replace') {
  if (pending) {
    pending.url = url
    if (mode === 'push' && !replacingReset) pending.mode = 'push'
    return
  }
  pending = { url, pathname: window.location.pathname, mode: replacingReset ? 'replace' : mode }
  Promise.resolve().then(() => {
    const change = pending
    pending = null
    if (!change || change.pathname !== window.location.pathname || change.url.href === window.location.href) return
    window.history[change.mode === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', change.url)
    notifyQueryEdit()
  })
}
/** An effect-driven filter reset replaces the filter's entry rather than adding a second step. */
export function resetQueryPage(setPage: Dispatch<SetStateAction<number>>) {
  replacingReset = true
  try { setPage(1) } finally { replacingReset = false }
}
export function isQueryUserEdit() { return lastEditedUrl === window.location.href }
export function notifyQueryEdit() {
  lastEditedUrl = window.location.href
  window.dispatchEvent(new Event(CHANGE_EVENT))
}
export function subscribeQueryState(listener: () => void) {
  const onRestore = () => { lastEditedUrl = ''; listener() }
  window.addEventListener('popstate', onRestore)
  window.addEventListener(CHANGE_EVENT, listener)
  return () => {
    window.removeEventListener('popstate', onRestore)
    window.removeEventListener(CHANGE_EVENT, listener)
  }
}
export const querySnapshot = () => window.location.search
export const queryServerSnapshot = () => ''

/** Query state is UI state only. Every data endpoint must still authorize its request. */
export function useQueryState<T extends QueryValue>(key: string, initial: T | (() => T), options: QueryOptions = {}): [T, Dispatch<SetStateAction<T>>] {
  const [fallback] = useState<T>(() => typeof initial === 'function' ? initial() : initial)
  const inferredKind = /(?:datefrom|dateto)$|^(?:date|fromDate|toDate)$/i.test(key) ? 'date'
    : /^(year|tableYear)$/.test(key) ? 'year' : key === 'month' ? 'month' : undefined
  const optionKey = JSON.stringify({ kind: inferredKind, ...options })
  const policy: QueryOptions = useMemo(() => JSON.parse(optionKey), [optionKey])
  const search = useSyncExternalStore(subscribeQueryState, querySnapshot, queryServerSnapshot)
  const encoded = JSON.stringify(readQueryValue(new URLSearchParams(search), key, fallback, policy))
  const value: T = useMemo(() => JSON.parse(encoded), [encoded])
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const url = getQueryUrl()
    const current = readQueryValue(url.searchParams, key, fallback, policy)
    const next = typeof action === 'function' ? action(current) : action
    const updated = writeQueryValue(url, key, next, fallback)
    if (updated.href === url.href) return
    const history = policy.history ?? (/search|query/i.test(key) ? 'replace' : 'push')
    commitQueryUrl(updated, history)
  }, [key, fallback, policy])
  return [value, setValue]
}

