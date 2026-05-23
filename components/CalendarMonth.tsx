"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from '@/lib/auth-context'

type CalendarView = "day" | "week" | "month";

interface PersonalCalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  type?: "work" | "meeting" | "training" | "personal";
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_TIMELINE_START_HOUR = 5;
const DAY_TIMELINE_END_HOUR = 22;
const DAY_TIMELINE_ROW_HEIGHT = 56;

const DEMO_EVENTS: PersonalCalendarEvent[] = [
  {
    id: "1",
    title: "Họp team tuần",
    startAt: "2026-05-06T09:00:00",
    endAt: "2026-05-06T10:00:00",
    type: "meeting",
  },
  {
    id: "2",
    title: "Chuẩn bị học liệu",
    startAt: "2026-05-08T14:00:00",
    endAt: "2026-05-08T16:00:00",
    type: "work",
  },
  {
    id: "3",
    title: "Onboarding nội bộ",
    startAt: "2026-05-14T08:30:00",
    endAt: "2026-05-14T10:00:00",
    type: "training",
  },
];

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDate(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getWeekStartMonday(date: Date) {
  const current = startOfDay(date);
  const start = new Date(current);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  return start;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const hhmm = (value: Date) =>
    `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  return `${hhmm(start)} - ${hhmm(end)}`;
}

function getEventChipClass(type: PersonalCalendarEvent["type"]) {
  switch (type) {
    case "meeting":
      return "border-primary/20 bg-primary/10 text-primary";
    case "training":
      return "border-primary/20 bg-primary/10 text-primary";
    case "personal":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "work":
    default:
      return "border-primary/20 bg-primary/10 text-primary";
  }
}

function getEventDotClass(type: PersonalCalendarEvent["type"]) {
  switch (type) {
    case "meeting":
      return "bg-primary";
    case "training":
      return "bg-primary";
    case "personal":
      return "bg-amber-500";
    case "work":
    default:
      return "bg-primary";
  }
}

function buildCalendarCells(focusDate: Date, view: CalendarView) {
  if (view === "day") {
    return [{ date: new Date(focusDate), inCurrentMonth: true }];
  }

  if (view === "week") {
    const start = getWeekStartMonday(focusDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, inCurrentMonth: true };
    });
  }

  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  const monthStartDay = monthStart.getDay();
  const diff = monthStartDay === 0 ? -6 : 1 - monthStartDay;
  gridStart.setDate(monthStart.getDate() + diff);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() };
  });
}

const CalendarMonth = () => {
  const now = useMemo(() => new Date(), []);
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(now);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(now));
  const { user } = useAuth()
  const [teacherRegistrations, setTeacherRegistrations] = useState<any[]>([])
  const [registrationsLoading, setRegistrationsLoading] = useState(false)

  const calendarCells = useMemo(
    () => buildCalendarCells(focusDate, view),
    [focusDate, view],
  );

  const dayTimelineHours = useMemo(
    () =>
      Array.from(
        { length: DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR + 1 },
        (_, index) => DAY_TIMELINE_START_HOUR + index,
      ),
    [],
  );

  const visibleEventsByDateKey = useMemo(() => {
    const map = new Map<string, PersonalCalendarEvent[]>();
    DEMO_EVENTS.forEach((event) => {
      const dateKey = formatDateKey(new Date(event.startAt));
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });

    // Merge teacher lecture-review registrations as calendar events
    teacherRegistrations.forEach((reg) => {
      const startAt = reg.bat_dau_luc || reg.start_at || reg.bat_dau_luc
      const endAt = reg.ket_thuc_luc || reg.end_at || reg.ket_thuc_luc
      if (!startAt) return
      const dateKey = formatDateKey(new Date(startAt))
      const evt: PersonalCalendarEvent = {
        id: `lrr-${reg.id}`,
        title: `Duyệt giảng: ${reg.event_title || reg.ten || 'Duyệt giảng'}` + (reg.review_lesson ? ` · Slide: ${reg.review_lesson}` : ''),
        startAt: startAt,
        endAt: endAt || startAt,
        type: 'training',
      }
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(evt)
    })

    return map;
  }, [teacherRegistrations]);

  const selectedDayEvents = useMemo(() => {
    return visibleEventsByDateKey.get(formatDateKey(selectedDate)) || [];
  }, [selectedDate, visibleEventsByDateKey]);

  useEffect(() => {
    const load = async () => {
      if (!user || user.role !== 'teacher' || !user.email) return
      try {
        setRegistrationsLoading(true)
        const resp = await fetch(`/api/lecture-review-registrations?teacher_email=${encodeURIComponent(String(user.email))}`)
        const data = await resp.json()
        if (resp.ok && data?.success) {
          setTeacherRegistrations(data.data || [])
        } else {
          setTeacherRegistrations([])
        }
      } catch (e) {
        setTeacherRegistrations([])
      } finally {
        setRegistrationsLoading(false)
      }
    }
    void load()
  }, [user?.email, user?.role])

  const periodLabel = useMemo(() => {
    if (view === "day") {
      return selectedDate.toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    if (view === "week") {
      const start = getWeekStartMonday(focusDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString("vi-VN")} - ${end.toLocaleDateString("vi-VN")}`;
    }

    return `Tháng ${focusDate.getMonth() + 1}/${focusDate.getFullYear()}`;
  }, [focusDate, selectedDate, view]);

  const stepDate = (amount: number) => {
    const next = new Date(focusDate);

    if (view === "day") {
      next.setDate(next.getDate() + amount);
      setSelectedDate(startOfDay(next));
    } else if (view === "week") {
      next.setDate(next.getDate() + amount * 7);
      setSelectedDate(startOfDay(next));
    } else {
      next.setMonth(next.getMonth() + amount);
      setSelectedDate(startOfDay(next));
    }

    setFocusDate(next);
  };

  const dayTimelineEvents = useMemo(() => {
    const dayKey = formatDateKey(view === "day" ? focusDate : selectedDate);
    return visibleEventsByDateKey.get(dayKey) || [];
  }, [focusDate, selectedDate, view, visibleEventsByDateKey]);

  const dayTimelineEventsByHour = useMemo(() => {
    const grouped: Record<number, PersonalCalendarEvent[]> = {};
    dayTimelineHours.forEach((hour) => {
      grouped[hour] = [];
    });

    dayTimelineEvents.forEach((event) => {
      const hour = Math.max(
        DAY_TIMELINE_START_HOUR,
        Math.min(new Date(event.startAt).getHours(), DAY_TIMELINE_END_HOUR),
      );
      grouped[hour].push(event);
    });

    return grouped;
  }, [dayTimelineEvents, dayTimelineHours]);

  const weekDates = useMemo(
    () => buildCalendarCells(focusDate, "week").map((cell) => cell.date),
    [focusDate],
  );

  const weekTimelineEventsByDateHour = useMemo(() => {
    const grouped: Record<string, Record<number, PersonalCalendarEvent[]>> = {};

    weekDates.forEach((date) => {
      const dateKey = formatDateKey(date);
      grouped[dateKey] = {};
      dayTimelineHours.forEach((hour) => {
        grouped[dateKey][hour] = [];
      });

      const eventsOfDay = visibleEventsByDateKey.get(dateKey) || [];
      eventsOfDay.forEach((event) => {
        const hour = Math.max(
          DAY_TIMELINE_START_HOUR,
          Math.min(new Date(event.startAt).getHours(), DAY_TIMELINE_END_HOUR),
        );
        grouped[dateKey][hour].push(event);
      });
    });

    return grouped;
  }, [dayTimelineHours, visibleEventsByDateKey, weekDates]);

  return (
    <Card className="overflow-hidden rounded-xl border-border bg-card shadow-sm" padding="none">
      <div className="border-b border-border bg-gradient-to-r from-muted to-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex items-center gap-3 text-foreground">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Tháng</p>
              <p className="text-xl font-bold text-foreground">{periodLabel}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">
              Lịch Cá Nhân
            </p>
          </div>

          <div className="flex justify-start lg:justify-end">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => stepDate(-1)}
                variant="outline"
                size="icon"
                aria-label="Thời gian trước"
                className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setFocusDate(startOfDay(now))}
                variant="outline"
                size="default"
                className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                Hôm nay
              </Button>
              <Button
                onClick={() => stepDate(1)}
                variant="outline"
                size="icon"
                aria-label="Thời gian sau"
                className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

              <div className="mt-4 flex justify-end">
          <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
            {([
              ["day", "Ngày"],
              ["week", "Tuần"],
              ["month", "Tháng"],
            ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  onClick={() => setView(value)}
                  variant={view === value ? "default" : "ghost"}
                  size="sm"
                  className={`focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${view === value ? "shadow-sm" : "text-muted-foreground"}`}
                >
                  {label}
                </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground sm:px-6">
        {periodLabel}
      </div>

      {view === "day" ? (
        <div className="grid gap-0 border-t border-border lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-card">
            <div className="grid grid-cols-[64px_1fr]">
              <div className="border-r border-border bg-muted/60">
                {dayTimelineHours.map((hour) => (
                  <div
                    key={`day-label-${hour}`}
                    className="relative"
                    style={{ height: `${DAY_TIMELINE_ROW_HEIGHT}px` }}
                  >
                    <span className="absolute top-1 right-2 text-xs font-medium text-muted-foreground">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              <div className="relative" style={{ minHeight: `${dayTimelineHours.length * DAY_TIMELINE_ROW_HEIGHT}px` }}>
                {dayTimelineHours.map((hour) => {
                  const hourEvents = dayTimelineEventsByHour[hour] || [];
                  const expandedHeight =
                    hourEvents.length > 0
                      ? Math.max(DAY_TIMELINE_ROW_HEIGHT, hourEvents.length * 34)
                      : DAY_TIMELINE_ROW_HEIGHT;

                  return (
                    <div
                      key={`day-slot-${hour}`}
                      className="border-t border-border px-2 py-2"
                      style={{ minHeight: `${expandedHeight}px` }}
                    >
                      <div className="space-y-1.5">
                                  {hourEvents.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Không có lịch</p>
                                  ) : (
                                    hourEvents.map((event) => (
                                      <button
                                        key={event.id}
                                        type="button"
                                        tabIndex={0}
                                        aria-label={`${event.title} ${formatTimeRange(event.startAt, event.endAt)}`}
                                        className={`w-full text-left rounded-lg border px-2 py-2 text-xs font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${getEventChipClass(event.type)}`}
                                      >
                                        <p className="text-xs font-semibold opacity-80">
                                          {formatTimeRange(event.startAt, event.endAt)}
                                        </p>
                                        <p className="mt-1 leading-4">{event.title}</p>
                                      </button>
                                    ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="border-t border-border bg-muted/40 px-4 py-4 lg:border-l lg:border-t-0">
            <Card className="rounded-xl border-border bg-card p-4 shadow-sm" padding="none">
              <CardContent>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Hôm nay
              </p>
              <h4 className="mt-1 text-lg font-bold text-foreground">
                {formatDateLabel(view === "day" ? focusDate : selectedDate)}
              </h4>
              <div className="mt-4 space-y-3">
                {selectedDayEvents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
                    Chưa có lịch cá nhân trong ngày này.
                  </div>
                ) : (
                  selectedDayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      tabIndex={0}
                      aria-label={`${event.title} ${formatTimeRange(event.startAt, event.endAt)}`}
                      className="w-full rounded-lg border border-border bg-card p-3 shadow-sm text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${getEventDotClass(event.type)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {event.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatTimeRange(event.startAt, event.endAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : view === "week" ? (
        <div className="overflow-hidden border-t border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted">
            {weekDates.map((date) => {
              const key = formatDateKey(date);
              const isToday = isSameDate(startOfDay(date), startOfDay(now));
              const weekdayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(startOfDay(date))}
                  className={`border-r border-border px-2 py-2 text-center transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${isSameDate(date, selectedDate) ? "bg-muted/80" : "bg-card hover:bg-muted/60"}`}
                >
                  <p className="text-xs font-semibold text-muted-foreground">
                    {WEEKDAY_LABELS[weekdayIndex]}
                  </p>
                  <p
                    className={`mt-1 text-sm font-bold ${isToday ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {String(date.getDate()).padStart(2, "0")}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-7">
            {weekDates.map((date) => {
              const dateKey = formatDateKey(date);
              const dayEvents = visibleEventsByDateKey.get(dateKey) || [];

              return (
                <div key={dateKey} className="min-h-48 border-r border-border p-2">
                  <div className="space-y-2">
                    {dayEvents.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted p-3 text-xs text-muted-foreground">
                        Trống
                      </div>
                    ) : (
                      dayEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          tabIndex={0}
                          aria-label={`${event.title} ${formatTimeRange(event.startAt, event.endAt)}`}
                          className={`w-full text-left rounded-lg border px-2 py-2 text-xs font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${getEventChipClass(event.type)}`}
                        >
                          <p className="text-xs font-semibold opacity-80">
                            {formatTimeRange(event.startAt, event.endAt)}
                          </p>
                          <p className="mt-1 leading-4">{event.title}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border-t border-border bg-card">
          <div className="grid grid-cols-7 border-l border-t border-border">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="flex h-10 items-center justify-center border-b border-r border-border bg-muted text-xs font-semibold text-muted-foreground sm:text-sm"
              >
                {label}
              </div>
            ))}

            {calendarCells.map(({ date, inCurrentMonth }) => {
              const isToday = isSameDate(startOfDay(date), startOfDay(now));
              const dateKey = formatDateKey(date);
              const dayEvents = visibleEventsByDateKey.get(dateKey) || [];

              return (
                <button
                  key={dateKey}
                  type="button"
                  className={`min-h-24 flex flex-col border-r border-b border-border p-2 text-left transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${isToday ? "bg-muted/70" : inCurrentMonth ? "bg-card hover:bg-muted/60" : "bg-muted/40 text-muted-foreground"}`}
                  onClick={() => setSelectedDate(startOfDay(date))}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-primary text-primary-foreground" : inCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-foreground">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        tabIndex={0}
                        aria-label={event.title}
                        className={`w-full text-left rounded-md border px-2 py-2 text-xs font-semibold leading-4 ${getEventChipClass(event.type)} focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary`}
                      >
                        <p className="line-clamp-2">{event.title}</p>
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-xs font-semibold text-muted-foreground">
                        +{dayEvents.length - 3} sự kiện khác
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

export default CalendarMonth;
