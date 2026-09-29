'use client';

import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onChange: (range: { dateFrom: string; dateTo: string }) => void;
  className?: string;
  popoverAlign?: 'left' | 'right';
  placeholder?: string;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function parseYmd(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(value?: string) {
  const date = parseYmd(value);
  if (!date) return '';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date) {
  return formatYmd(a) === formatYmd(b);
}

function isBetween(day: Date, from: Date | null, to: Date | null) {
  if (!from || !to) return false;
  const time = day.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function buildMonthDays(monthDate: Date) {
  const firstDay = startOfMonth(monthDate);
  const totalDays = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const leadingBlanks = firstDay.getDay();

  return [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from(
      { length: totalDays },
      (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1),
    ),
  ];
}

export default function DateRangePicker({
  dateFrom,
  dateTo,
  onChange,
  className = '',
  popoverAlign = 'left',
  placeholder = 'Chọn thời gian',
}: DateRangePickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPickingRange, setIsPickingRange] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [monthDate, setMonthDate] = useState(() => {
    const selectedDate = parseYmd(dateFrom) || parseYmd(dateTo) || new Date();
    return startOfMonth(selectedDate);
  });

  const fromDate = useMemo(() => parseYmd(dateFrom), [dateFrom]);
  const toDate = useMemo(() => parseYmd(dateTo), [dateTo]);
  const days = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const previewRange = useMemo(() => {
    if (!isPickingRange || !fromDate || !hoverDate) {
      return { from: fromDate, to: toDate };
    }

    return hoverDate.getTime() < fromDate.getTime()
      ? { from: hoverDate, to: fromDate }
      : { from: fromDate, to: hoverDate };
  }, [fromDate, hoverDate, isPickingRange, toDate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsPickingRange(false);
        setHoverDate(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const displayValue = useMemo(() => {
    if (!dateFrom && !dateTo) return placeholder;
    if (dateFrom && (!dateTo || dateFrom === dateTo)) return formatShortDate(dateFrom);
    if (!dateFrom && dateTo) return formatShortDate(dateTo);
    return `${formatShortDate(dateFrom)} - ${formatShortDate(dateTo)}`;
  }, [dateFrom, dateTo, placeholder]);

  const handleDayClick = (day: Date) => {
    const nextValue = formatYmd(day);

    if (!dateFrom || !isPickingRange || (dateTo && dateFrom !== dateTo)) {
      onChange({ dateFrom: nextValue, dateTo: nextValue });
      setIsPickingRange(true);
      setHoverDate(null);
      return;
    }

    const startDate = parseYmd(dateFrom) || day;
    const [nextFrom, nextTo] =
      day.getTime() < startDate.getTime()
        ? [nextValue, formatYmd(startDate)]
        : [formatYmd(startDate), nextValue];

    onChange({ dateFrom: nextFrom, dateTo: nextTo });
    setIsPickingRange(false);
    setHoverDate(null);
  };

  const goToPreviousMonth = () => {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const clearRange = () => {
    onChange({ dateFrom: '', dateTo: '' });
    setIsPickingRange(false);
    setHoverDate(null);
    setIsOpen(false);
  };

  const selectToday = () => {
    const today = formatYmd(new Date());
    onChange({ dateFrom: today, dateTo: today });
    setMonthDate(startOfMonth(new Date()));
    setIsPickingRange(false);
    setHoverDate(null);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm font-medium text-slate-700 outline-none transition hover:border-[#bd0026]/30 focus:border-[#bd0026] focus:bg-white focus:ring-4 focus:ring-[#bd0026]/10"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate">{displayValue}</span>
        {(dateFrom || dateTo) ? (
          <span
            onClick={(event) => {
              event.stopPropagation();
              clearRange();
            }}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-3 w-3" />
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className={`absolute z-50 mt-2 w-[318px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl ${
            popoverAlign === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-slate-900">
              {monthDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <button
              type="button"
              onClick={goToNextMonth}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
            {WEEKDAYS.map((weekday, index) => (
              <div key={`${weekday}-${index}`} className="py-1.5">
                {weekday}
              </div>
            ))}
          </div>

          <div
            className="mt-1 grid grid-cols-7 gap-y-1"
            onMouseLeave={() => setHoverDate(null)}
          >
            {days.map((day, index) => {
              if (!day) {
                return <div key={`blank-${index}`} className="h-9" />;
              }

              const rangeFrom = previewRange.from;
              const rangeTo = previewRange.to;
              const isStart = Boolean(rangeFrom && sameDay(day, rangeFrom));
              const isEnd = Boolean(rangeTo && sameDay(day, rangeTo));
              const isSingle = Boolean(rangeFrom && rangeTo && sameDay(rangeFrom, rangeTo) && isStart);
              const inRange = isBetween(day, rangeFrom, rangeTo);

              return (
                <button
                  key={formatYmd(day)}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  onMouseEnter={() => {
                    if (isPickingRange && fromDate) setHoverDate(day);
                  }}
                  className="group relative flex h-9 items-center justify-center text-sm outline-none"
                >
                  {inRange && !isSingle ? (
                    <span
                      className={`absolute inset-y-0 bg-[#bd0026]/15 ${
                        isStart ? 'left-1/2 right-0 rounded-l-full' : ''
                      } ${
                        isEnd ? 'left-0 right-1/2 rounded-r-full' : ''
                      } ${!isStart && !isEnd ? 'inset-x-0' : ''}`}
                    />
                  ) : null}
                  <span
                    className={`relative z-10 grid h-9 w-9 place-items-center rounded-full transition ${
                      isStart || isEnd
                        ? 'bg-[#bd0026] font-semibold text-white shadow-[0_8px_18px_rgba(189,0,38,0.22)]'
                        : inRange
                          ? 'font-medium text-slate-950'
                          : 'text-slate-700 group-hover:bg-slate-100 group-hover:text-slate-950'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={clearRange}
              className="text-xs font-medium text-slate-500 transition hover:text-[#bd0026]"
            >
              Xóa
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectToday}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#bd0026]/30 hover:text-[#bd0026]"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsPickingRange(false);
                }}
                className="rounded-lg bg-[#bd0026] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#a80022]"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
