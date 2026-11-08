'use client'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { isQueryUserEdit, queryServerSnapshot, querySnapshot, subscribeQueryState } from './use-query-state'

/** Re-run read-only applied searches on shared-link/history restoration, not on each keystroke. */
export function useQueryRestore(restore: () => void, keys: readonly string[], ready = true) {
  const search = useSyncExternalStore(subscribeQueryState, querySnapshot, queryServerSnapshot)
  const previous = useRef('')
  const key = JSON.stringify(keys)
  useEffect(() => {
    if (!ready || search !== window.location.search) return
    if (isQueryUserEdit()) { previous.current = ''; return }
    const params = new URLSearchParams(search)
    const names: string[] = JSON.parse(key)
    if (!names.some(name => params.has(name))) { previous.current = ''; return }
    const signature = JSON.stringify(names.map(name => params.getAll(name)))
    if (previous.current === signature) return
    previous.current = signature
    restore()
  }, [key, ready, restore, search])
}
