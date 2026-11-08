'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react'
import { readQueryValue, writeQueryValue, type QueryValue } from './query-state-codec'
import { subscribeQueryState, querySnapshot, queryServerSnapshot, getQueryUrl, commitQueryUrl } from './use-query-state'

/** Explicit field mapping prevents a future private form field from reaching the URL. */
export function useQueryFilters<T extends object>(initial: T | (() => T), fields: Partial<Record<keyof T, string>>, booleanFields: Array<keyof T> = [], itemFields: Partial<Record<keyof T, { valueKey: string; labelKey: string }>> = {}): [T, Dispatch<SetStateAction<T>>] {
  const [defaults] = useState<T>(() => typeof initial === 'function' ? initial() : initial)
  const [local, setLocal] = useState(defaults)
  const localRef = useRef(local)
  useEffect(() => { localRef.current = local }, [local])
  const mappingKey = JSON.stringify(fields)
  const mapping: Partial<Record<keyof T, string>> = useMemo(() => JSON.parse(mappingKey), [mappingKey])
  const booleanKey = JSON.stringify(booleanFields)
  const nullableBooleans: Array<keyof T> = useMemo(() => JSON.parse(booleanKey), [booleanKey])
  const itemKey = JSON.stringify(itemFields)
  const items: typeof itemFields = useMemo(() => JSON.parse(itemKey), [itemKey])
  const search = useSyncExternalStore(subscribeQueryState, querySnapshot, queryServerSnapshot)
  const read = useCallback((params: URLSearchParams, base: T) => {
    const result = { ...base }
    for (const field of Object.keys(mapping) as Array<keyof T>) {
      result[field] = readQueryValue(params, mapping[field]!, defaults[field] as QueryValue, {
        kind: nullableBooleans.includes(field) ? 'boolean' : /date/i.test(mapping[field]!) ? 'date' : undefined,
      }) as T[keyof T]
      const item = items[field]
      if (item) {
        const codes = result[field] as string[]
        result[field] = codes.map(code => {
          const known = (base[field] as Array<Record<string, string>>).find(value => value[item.valueKey] === code)
          return known || { [item.valueKey]: code, [item.labelKey]: code }
        }) as T[keyof T]
      }
    }
    return result
  }, [defaults, mapping, nullableBooleans, items])
  const encoded = JSON.stringify(read(new URLSearchParams(search), local))
  const value: T = useMemo(() => JSON.parse(encoded), [encoded])
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    let url = getQueryUrl()
    const previousUrl = url.href
    const current = read(url.searchParams, localRef.current)
    const next = typeof action === 'function' ? action(current) : action
    localRef.current = next
    setLocal(next)
    for (const field of Object.keys(mapping) as Array<keyof T>) {
      const item = items[field]
      const fieldValue = item ? (next[field] as Array<Record<string, string>>).map(value => value[item.valueKey]) : next[field]
      url = writeQueryValue(url, mapping[field]!, fieldValue as QueryValue, defaults[field] as QueryValue)
    }
    if (url.href !== previousUrl) {
      commitQueryUrl(url, 'push')
    }
  }, [defaults, mapping, read, items])
  return [value, setValue]
}
