'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { WheelColumn } from '@/components/leave-request/WheelColumn'
import { Clock } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0'),
)
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, '0'),
)

const SHELL_CLASS =
  'relative flex min-h-11 w-full sm:max-w-[11.5rem] items-center overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition-[border-color,box-shadow] focus-within:border-[#a1001f] focus-within:ring-2 focus-within:ring-[#a1001f]/20'

const INPUT_CLASS =
  'min-w-0 flex-1 border-0 bg-transparent py-3 pl-3 pr-10 text-[16px] font-medium tabular-nums text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'

function formatHhMm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseHhMm(value: string | null): { hour: string; minute: string } {
  if (!value?.trim()) return { hour: '', minute: '' }
  const [h, m] = value.trim().split(':')
  const hour = Math.min(23, Math.max(0, parseInt(h ?? '', 10) || 0))
  const minute = Math.min(59, Math.max(0, parseInt(m ?? '', 10) || 0))
  return {
    hour: String(hour).padStart(2, '0'),
    minute: String(minute).padStart(2, '0'),
  }
}

/** 13:45, 1345, 945 → HH:mm hoặc null nếu không hợp lệ */
function parseFlexibleTimeInput(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null

  if (/^\d{1,2}:\d{1,2}$/.test(t)) {
    const [hs, ms] = t.split(':')
    const h = parseInt(hs, 10)
    const m = parseInt(ms, 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return formatHhMm(h, m)
    return null
  }

  const digits = t.replace(/\D/g, '')
  if (digits.length === 4) {
    const h = parseInt(digits.slice(0, 2), 10)
    const m = parseInt(digits.slice(2), 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return formatHhMm(h, m)
  }
  if (digits.length === 3) {
    const h = parseInt(digits.slice(0, 1), 10)
    const m = parseInt(digits.slice(1), 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return formatHhMm(h, m)
  }

  return null
}

function sanitizeTyping(raw: string): string {
  let v = raw.replace(/[^\d:]/g, '')
  const colonAt = v.indexOf(':')
  if (colonAt >= 0) {
    const before = v.slice(0, colonAt).replace(/\D/g, '').slice(0, 2)
    const after = v.slice(colonAt + 1).replace(/\D/g, '').slice(0, 2)
    v = before + (before.length || after.length ? ':' : '') + after
  } else {
    v = v.replace(/\D/g, '').slice(0, 4)
    if (v.length > 2) v = `${v.slice(0, 2)}:${v.slice(2)}`
  }
  return v.slice(0, 5)
}

type Time24SelectProps = {
  id: string
  value: string | null
  onChange: (value: string | null) => void
  className?: string
  hourLabel?: string
  minuteLabel?: string
  groupAriaLabel?: string
  disabled?: boolean
}

/** Gõ HH:mm hoặc chọn giờ/phút 24h (00:00–23:59). */
export function Time24Select({
  id,
  value,
  onChange,
  className,
  hourLabel = 'Giờ',
  minuteLabel = 'Phút',
  groupAriaLabel,
  disabled,
}: Time24SelectProps) {
  const listId = useId()
  const [text, setText] = useState(value ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const { hour, minute } = parseHhMm(value)

  useEffect(() => {
    setText(value ?? '')
  }, [value])

  const commit = (next: string | null) => {
    onChange(next)
    setText(next ?? '')
  }

  const commitFromText = () => {
    const parsed = parseFlexibleTimeInput(text)
    if (parsed) {
      commit(parsed)
      return
    }
    if (!text.trim()) {
      commit(null)
      return
    }
    setText(value ?? '')
  }

  const emitFromPicker = (nextHour: string, nextMinute: string) => {
    if (!nextHour || !nextMinute) {
      commit(null)
      return
    }
    commit(`${nextHour}:${nextMinute}`)
  }

  return (
    <div
      className={cn(SHELL_CLASS, disabled && 'opacity-60', className)}
      role="group"
      {...(groupAriaLabel ? { 'aria-label': groupAriaLabel } : {})}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        list={listId}
        disabled={disabled}
        value={text}
        placeholder="00:00"
        onChange={(e) => setText(sanitizeTyping(e.target.value))}
        onBlur={commitFromText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitFromText()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className={INPUT_CLASS}
        aria-label={groupAriaLabel ?? 'Thời gian (24 giờ)'}
        maxLength={5}
      />

      <datalist id={listId}>
        {['08:00', '09:00', '14:00', '18:00', '19:00'].map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-gray-400 outline-none transition hover:text-[#a1001f] focus-visible:text-[#a1001f] disabled:pointer-events-none"
            aria-label="Chọn giờ và phút"
          >
            <Clock
              className={cn(
                'h-4 w-4',
                value ? 'text-[#a1001f]/80' : 'text-current',
              )}
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-2"
          align="end"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-center gap-1 px-1">
            <WheelColumn
              options={HOUR_OPTIONS}
              value={hour || '00'}
              disabled={disabled}
              ariaLabel={hourLabel}
              onChange={(h) => emitFromPicker(h, minute || '00')}
            />
            <span
              className="pb-0.5 text-lg font-semibold leading-none text-gray-400"
              aria-hidden
            >
              :
            </span>
            <WheelColumn
              options={MINUTE_OPTIONS}
              value={minute || '00'}
              disabled={disabled}
              ariaLabel={minuteLabel}
              onChange={(m) => emitFromPicker(hour || '00', m)}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
