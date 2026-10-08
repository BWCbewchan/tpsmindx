'use client'

import { cn } from '@/lib/utils'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type FacilityEvaluationCenterOption = {
  id: number
  fullName: string
  displayName?: string | null
  shortCode?: string | null
  region?: string | null
}

type CenterComboboxProps = {
  centers: FacilityEvaluationCenterOption[]
  selectedCenterId: string
  onChange: (centerId: string) => void
  placeholder?: string
  className?: string
  buttonClassName?: string
  contentClassName?: string
  renderButtonContent?: (
    selectedCenter: FacilityEvaluationCenterOption | null,
    placeholder: string,
  ) => ReactNode
}

function normalizeSearch(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function CenterCombobox({
  centers,
  selectedCenterId,
  onChange,
  placeholder = 'Chọn cơ sở',
  className,
  buttonClassName,
  contentClassName,
  renderButtonContent,
}: CenterComboboxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedCenter = useMemo(
    () => centers.find((center) => String(center.id) === selectedCenterId) ?? null,
    [centers, selectedCenterId],
  )

  const filteredCenters = useMemo(() => {
    const keyword = normalizeSearch(query)
    const rows = keyword
      ? centers.filter((center) => normalizeSearch(center.fullName).includes(keyword))
      : centers
    return rows.slice(0, 40)
  }, [centers, query])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function selectCenter(center: FacilityEvaluationCenterOption) {
    onChange(String(center.id))
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative mt-1', className)}>
      <button
        type="button"
        onClick={() => {
          setQuery('')
          setOpen((current) => !current)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm transition-colors focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15',
          selectedCenter ? 'font-semibold text-gray-900' : 'font-medium text-gray-500',
          buttonClassName,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', contentClassName)}>
          {renderButtonContent
            ? renderButtonContent(selectedCenter, placeholder)
            : selectedCenter?.fullName || placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false)
                }
                if (event.key === 'Enter' && filteredCenters[0]) {
                  event.preventDefault()
                  selectCenter(filteredCenters[0])
                }
              }}
              placeholder="Tìm kiếm cơ sở..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-9 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/15"
              autoFocus
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            className="mt-2 max-h-56 overflow-y-auto pr-1"
          >
            {filteredCenters.length > 0 ? (
              filteredCenters.map((center) => {
                const selected = String(center.id) === selectedCenterId
                return (
                  <button
                    key={center.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCenter(center)}
                    className={cn(
                      'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-[#f1f3f7] hover:text-[#a1001f]',
                      selected && 'bg-[#fff7f8] text-[#a1001f]',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{center.fullName}</span>
                    {selected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-2 text-sm font-medium text-gray-500">
                Không tìm thấy cơ sở phù hợp
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
