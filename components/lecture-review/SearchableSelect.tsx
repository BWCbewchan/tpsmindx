'use client'

import { cn } from '@/lib/utils'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export type SearchableSelectOption = {
  value: string
  label: string
  subtext?: string
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Nhập để tìm nhanh...',
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.removeEventListener('mousedown', handleOutside)
    }
  }, [open])

  const filteredOptions = useMemo(() => {
    const normalized = normalizeSearch(search.trim())
    if (!normalized) return options
    return options.filter((option) =>
      normalizeSearch(`${option.label} ${option.subtext || ''}`).includes(normalized),
    )
  }, [options, search])
  const selected = options.find((option) => option.value === value)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          setSearch('')
          setOpen((current) => !current)
        }}
        className={cn(
          'flex min-h-12 w-full items-center justify-between rounded-xl border bg-white px-4 text-left text-sm outline-none transition',
          open
            ? 'border-[#b00020] ring-4 ring-[#b00020]/10'
            : 'border-slate-200 hover:border-slate-300',
          selected ? 'text-slate-900' : 'text-slate-400',
          disabled && 'cursor-not-allowed bg-slate-50 opacity-70',
        )}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {selected?.label || placeholder}
          </span>
          {selected?.subtext ? (
            <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">
              {selected.subtext}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'ml-3 h-4 w-4 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-[70] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)]">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[#b00020] focus:bg-white focus:ring-2 focus:ring-[#b00020]/10"
            />
          </div>
          <div className="max-h-[min(60vh,28rem)] space-y-1 overflow-y-auto overscroll-contain pr-1">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                      isSelected
                        ? 'bg-[#b00020]/8 text-[#9b001c]'
                        : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {option.label}
                      </span>
                      {option.subtext ? (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {option.subtext}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-8 text-center text-sm text-slate-500">
                Không tìm thấy dữ liệu phù hợp
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
