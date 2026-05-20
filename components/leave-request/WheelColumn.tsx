'use client'

import { cn } from '@/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

const ITEM_H = 36
const PAD_ROWS = 1

export type WheelColumnProps = {
  options: string[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  /** compact: số HH/mm; wide: nhãn dài (Buổi 1…) */
  variant?: 'compact' | 'wide'
}

export function WheelColumn({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
  variant = 'compact',
}: WheelColumnProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isProgrammaticScrollRef = useRef(false)

  const foundIndex = value ? options.indexOf(value) : -1
  const selectedIndex = foundIndex >= 0 ? foundIndex : 0
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  useEffect(() => {
    setActiveIndex(selectedIndex)
  }, [selectedIndex])

  const scrollToIndex = useCallback((index: number, smooth = false) => {
    const el = scrollerRef.current
    if (!el) return
    isProgrammaticScrollRef.current = true
    setActiveIndex(index)
    el.scrollTo({ top: index * ITEM_H, behavior: smooth ? 'smooth' : 'auto' })
    window.setTimeout(() => {
      isProgrammaticScrollRef.current = false
    }, smooth ? 240 : 50)
  }, [])

  useEffect(() => {
    scrollToIndex(selectedIndex)
  }, [selectedIndex, scrollToIndex])

  const syncFromScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el || isProgrammaticScrollRef.current) return
    const index = Math.round(el.scrollTop / ITEM_H)
    const clamped = Math.max(0, Math.min(options.length - 1, index))
    setActiveIndex(clamped)
    const next = options[clamped]
    if (next && next !== value) onChange(next)
  }, [onChange, options, value])

  const handleScroll = () => {
    const el = scrollerRef.current
    if (!el || isProgrammaticScrollRef.current) return
    const index = Math.round(el.scrollTop / ITEM_H)
    const clamped = Math.max(0, Math.min(options.length - 1, index))
    setActiveIndex(clamped)

    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current)
    scrollEndTimerRef.current = setTimeout(syncFromScroll, 80)
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScrollEnd = () => syncFromScroll()
    el.addEventListener('scrollend', onScrollEnd)
    return () => {
      el.removeEventListener('scrollend', onScrollEnd)
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current)
    }
  }, [syncFromScroll])

  return (
    <div
      className={cn(
        'relative h-[108px] shrink-0',
        variant === 'wide' ? 'w-full' : 'w-[3.25rem]',
      )}
      role="listbox"
      aria-label={ariaLabel}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-9 -translate-y-1/2 rounded-md border border-[#a1001f]/25 bg-[#a1001f]/[0.06]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-9 bg-gradient-to-b from-white via-white/80 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-9 bg-gradient-to-t from-white via-white/80 to-transparent"
        aria-hidden
      />

      <div
        ref={scrollerRef}
        className={cn(
          'h-full overflow-y-auto overscroll-contain scroll-smooth',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          disabled && 'pointer-events-none opacity-50',
        )}
        style={{ scrollSnapType: 'y mandatory' }}
        onScroll={handleScroll}
      >
        <div style={{ height: ITEM_H * PAD_ROWS }} aria-hidden />
        {options.map((opt, index) => {
          const distance = Math.abs(index - activeIndex)
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(opt)
                scrollToIndex(index, true)
              }}
              className={cn(
                'flex h-9 w-full items-center justify-center px-1 text-sm font-medium transition-[color,transform,opacity] duration-150',
                'snap-center outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/30',
                variant === 'compact' && 'tabular-nums',
                distance === 0
                  ? 'scale-100 text-gray-900'
                  : distance === 1
                    ? 'scale-[0.94] text-gray-500'
                    : 'scale-[0.88] text-gray-300',
              )}
              style={{ scrollSnapAlign: 'center' }}
              role="option"
              aria-selected={opt === value}
            >
              {opt}
            </button>
          )
        })}
        <div style={{ height: ITEM_H * PAD_ROWS }} aria-hidden />
      </div>
    </div>
  )
}
