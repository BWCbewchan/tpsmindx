'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { WheelColumn } from '@/components/leave-request/WheelColumn'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

/** Số buổi tối đa (Buổi 1 – Buổi 14). */
export const MAX_LEAVE_SESSION_COUNT = 14

const SESSION_OPTIONS = Array.from(
  { length: MAX_LEAVE_SESSION_COUNT },
  (_, index) => `Buổi ${index + 1}`,
)

const SHELL_CLASS =
  'relative flex min-h-11 w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-gray-300 bg-white text-[16px] shadow-sm transition-[border-color,box-shadow] focus-within:border-[#a1001f] focus-within:ring-2 focus-within:ring-[#a1001f]/20 sm:text-sm'

const PREFIX_CLASS =
  'flex shrink-0 items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-600'

const INPUT_CLASS =
  'min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-10 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'

export function parseLeaveSessionNumber(value: string): number | null {
  const t = value.trim()
  if (!t) return null
  const m = t.match(/(?:buổi\s*)?(\d{1,2})/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n < 1 || n > MAX_LEAVE_SESSION_COUNT) return null
  return n
}

export function formatLeaveSession(n: number): string {
  return `Buổi ${n}`
}

type LeaveSessionFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  className?: string
  maxSessions?: number
}

/** Buổi học xin nghỉ: gõ số hoặc lướt chọn bánh xe (Buổi 1–14). */
export function LeaveSessionField({
  id,
  value,
  onChange,
  disabled,
  required,
  className,
  maxSessions = MAX_LEAVE_SESSION_COUNT,
}: LeaveSessionFieldProps) {
  const [draft, setDraft] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const sessionNum = parseLeaveSessionNumber(value)
  const wheelOptions = SESSION_OPTIONS.slice(0, maxSessions)

  useEffect(() => {
    setDraft(sessionNum != null ? String(sessionNum) : '')
  }, [value, sessionNum])

  const commit = (formatted: string) => {
    onChange(formatted)
    const n = parseLeaveSessionNumber(formatted)
    setDraft(n != null ? String(n) : '')
  }

  const commitDraft = () => {
    const t = draft.trim()
    if (!t) {
      onChange('')
      setDraft('')
      return
    }
    const n = parseInt(t, 10)
    if (!Number.isFinite(n) || n < 1 || n > maxSessions) {
      setDraft(sessionNum != null ? String(sessionNum) : '')
      return
    }
    commit(formatLeaveSession(n))
  }

  const handleWheelPick = (next: string) => {
    commit(next)
    setPickerOpen(false)
  }

  return (
    <div className={cn('relative w-full min-w-0 max-w-full', className)}>
      {required ? (
        <input
          tabIndex={-1}
          required
          value={value}
          readOnly
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          aria-hidden
        />
      ) : null}

      <div className={SHELL_CLASS}>
        <span className={PREFIX_CLASS} aria-hidden>
          Buổi
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={draft}
          placeholder="1–14"
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '').slice(0, 2)
            setDraft(next)
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className={INPUT_CLASS}
          aria-label="Số buổi học xin nghỉ"
          aria-required={required || undefined}
        />

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-gray-400 outline-none transition hover:text-[#a1001f] focus-visible:text-[#a1001f] disabled:pointer-events-none"
              aria-label="Lướt chọn buổi học"
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  pickerOpen && 'rotate-180',
                  value && 'text-[#a1001f]/80',
                )}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-2"
            align="start"
            sideOffset={6}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <WheelColumn
              variant="wide"
              options={wheelOptions}
              value={value}
              disabled={disabled}
              ariaLabel="Buổi học xin nghỉ"
              onChange={handleWheelPick}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
