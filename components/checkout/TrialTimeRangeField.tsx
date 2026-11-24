'use client'

import { cn } from '@/lib/utils'
import { ArrowRight, ChevronDown, Clock3 } from 'lucide-react'
import { useMemo } from 'react'

type TrialTimeRangeFieldProps = {
  startTime: string
  endTime: string
  onStartTimeChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  hasError?: boolean
  className?: string
}

const BASE_TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
})

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function withCurrentValue(options: string[], currentValue: string): string[] {
  if (!currentValue || options.includes(currentValue)) return options
  return [...options, currentValue].sort((left, right) => {
    return (timeToMinutes(left) ?? 0) - (timeToMinutes(right) ?? 0)
  })
}

export function TrialTimeRangeField({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  hasError = false,
  className,
}: TrialTimeRangeFieldProps) {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  const startOptions = useMemo(
    () => withCurrentValue(BASE_TIME_OPTIONS.filter((value) => (timeToMinutes(value) ?? 0) <= 23 * 60 + 30), startTime),
    [startTime],
  )
  const endOptions = useMemo(() => {
    const options = startMinutes == null
      ? BASE_TIME_OPTIONS.slice(1)
      : BASE_TIME_OPTIONS.filter((value) => (timeToMinutes(value) ?? 0) > startMinutes)
    return withCurrentValue(options, endTime)
  }, [endTime, startMinutes])

  function handleStartChange(nextStart: string) {
    onStartTimeChange(nextStart)
    const nextStartMinutes = timeToMinutes(nextStart)
    if (nextStartMinutes == null) {
      onEndTimeChange('')
      return
    }

    if (endMinutes == null || endMinutes <= nextStartMinutes) {
      const suggestedEnd = nextStartMinutes + 60
      onEndTimeChange(suggestedEnd <= 23 * 60 + 45 ? minutesToTime(suggestedEnd) : '')
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-3 transition-colors',
        hasError
          ? 'border-red-300 ring-2 ring-red-100'
          : 'border-gray-200 focus-within:border-[#b00020] focus-within:ring-2 focus-within:ring-[#b00020]/10',
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-end gap-2">
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Bắt đầu
          </span>
          <span className="relative block">
            <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#087f80]" />
            <select
              aria-label="Chọn giờ bắt đầu trải nghiệm"
              value={startTime}
              onChange={(event) => handleStartChange(event.target.value)}
              className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-sm font-bold tabular-nums text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#087f80] focus:bg-white focus:ring-2 focus:ring-[#087f80]/10"
            >
              <option value="">Chọn giờ</option>
              {startOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </span>
        </label>

        <span className="mb-2.5 grid h-7 w-7 place-items-center rounded-full bg-gray-100 text-gray-400" aria-hidden="true">
          <ArrowRight className="h-3.5 w-3.5" />
        </span>

        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Kết thúc
          </span>
          <span className="relative block">
            <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b00020]" />
            <select
              aria-label="Chọn giờ kết thúc trải nghiệm"
              value={endTime}
              disabled={!startTime}
              onChange={(event) => onEndTimeChange(event.target.value)}
              className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-sm font-bold tabular-nums text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#b00020] focus:bg-white focus:ring-2 focus:ring-[#b00020]/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">Chọn giờ</option>
              {endOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </span>
        </label>
      </div>

    </div>
  )
}

