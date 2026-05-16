'use client'

import { authHeaders } from '@/lib/auth-headers'
import { useCallback, useEffect, useRef, useState } from 'react'

export type SubstituteSuggestRow = {
  code: string
  full_name: string
  work_email: string
}

type Props = {
  id: string
  value: string
  onChange: (next: string) => void
  /** Khi chọn một dòng gợi ý: điền cả tên + email */
  onPickRow?: (row: { fullName: string; workEmail: string }) => void
  token: string | null
  inputClassName: string
  disabled?: boolean
}

export function SubstituteWorkEmailSuggestInput({
  id,
  value,
  onChange,
  onPickRow,
  token,
  inputClassName,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<SubstituteSuggestRow[]>([])
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastQueryRef = useRef('')

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (trimmed.length < 2) {
        setItems([])
        setLoading(false)
        return
      }
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      lastQueryRef.current = trimmed
      try {
        const res = await fetch(
          `/api/teachers/work-email-suggest?q=${encodeURIComponent(trimmed)}`,
          {
            credentials: 'include',
            headers: authHeaders(token),
            signal: ac.signal,
          },
        )
        const data = await res.json()
        if (!res.ok || !data?.success) {
          setItems([])
          return
        }
        const list = Array.isArray(data.data?.items) ? data.data.items : []
        if (lastQueryRef.current === trimmed) {
          setItems(list)
          setHighlight(0)
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setItems([])
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    },
    [token],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const scheduleSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch(q)
    }, 280)
  }

  const pick = (row: SubstituteSuggestRow) => {
    const fullName = (row.full_name || '').trim()
    const workEmail = (row.work_email || '').trim()
    if (onPickRow) {
      onPickRow({ fullName, workEmail })
    } else {
      onChange(workEmail)
    }
    setOpen(false)
    setItems([])
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="email"
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const v = e.target.value
          onChange(v)
          setOpen(true)
          scheduleSearch(v)
        }}
        onFocus={() => {
          setOpen(true)
          scheduleSearch(value)
        }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((i) => (i + 1) % items.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((i) => (i - 1 + items.length) % items.length)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(items[highlight]!)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className={inputClassName}
        aria-autocomplete="list"
        aria-expanded={open && items.length > 0}
        aria-controls={`${id}-suggest-list`}
      />
      {open && (loading || items.length > 0) ? (
        <div
          id={`${id}-suggest-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {loading && items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">Đang tìm…</div>
          ) : null}
          {items.map((row, idx) => (
            <button
              key={`${row.code}-${row.work_email}`}
              type="button"
              role="option"
              aria-selected={idx === highlight}
              className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                idx === highlight ? 'bg-[#a1001f]/5' : ''
              }`}
              onMouseEnter={() => setHighlight(idx)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(row)
              }}
            >
              <span className="font-medium text-gray-900">
                {(row.full_name || '(Chưa có tên)').trim()}
              </span>
              <span className="w-full break-all text-xs text-blue-800 leading-snug">
                {row.work_email}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-1 text-xs text-gray-500">
        Gõ ít nhất 2 ký tự — gợi ý từ email công việc (work_email) trong danh sách giáo viên.
      </p>
    </div>
  )
}
