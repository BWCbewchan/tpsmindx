"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth-context";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/app-toast";

type CalendarView = "day" | "week" | "month" | "year";
type EventCategory =
  | "registration"
  | "exam"
  | "workshop"
  | "workshop_teaching"
  | "meeting"
  | "teaching_review"
  | "advanced_training_release"
  | "holiday";
type EventMode = "online" | "offline";
type RegistrationTemplate = "official" | "supplement";

interface EvaluationEvent {
  id: string;
  title: string;
  specialty: string;
  startAt: string;
  endAt: string;
  note?: string;
  eventType?: EventCategory;
  registrationTemplate?: RegistrationTemplate;
  mode?: EventMode;
  centerId?: number | null;
  centerName?: string | null;
  centerAddress?: string | null;
  centerFullAddress?: string | null;
  centerMapUrl?: string | null;
  room?: string | null;
  meetingUrl?: string | null;
  meetingId?: string | null;
  lectureReviewer?: string | null;
  status?: string | null;
  allowRegistration?: boolean;
  slotLimit?: number | null;
}

interface EventRow {
  id: string;
  title: string;
  specialty: string | null;
  event_type: EventCategory;
  registration_template: RegistrationTemplate | null;
  start_at: string;
  end_at: string;
  note?: string | null;
  mode?: EventMode;
  center_id?: number | null;
  center_name?: string | null;
  center_address?: string | null;
  center_full_address?: string | null;
  center_map_url?: string | null;
  room?: string | null;
  meeting_url?: string | null;
  meeting_id?: string | null;
  lecture_reviewer?: string | null;
  status?: string | null;
  allow_registration?: boolean;
  slot_limit?: number | null;
}

interface CenterOption {
  id: number;
  center_name: string;
  display_name?: string | null;
  address?: string | null;
  full_address?: string | null;
  map_url?: string | null;
  hotline?: string | null;
}

interface ExamScheduleItem {
  specialty: string;
  startTime: string;
  endTime: string;
  subjectId: number | null;
  selectedSetId: number | null;
}

interface ExamSubjectOption {
  id: number;
  subject_code: string;
  subject_name: string;
  exam_type: string;
  duration_minutes: number | null;
}

interface ExamSetOption {
  id: number;
  set_code: string;
  set_name: string;
  question_count: number;
}

interface EventParticipant {
  id: number;
  event_id: string;
  teacher_code: string;
  teacher_name: string | null;
  teacher_email: string | null;
  response_status: "accepted" | "declined";
  responded_at: string;
}

interface TeachingReviewParticipant {
  id: number;
  event_id: string;
  teacher_code: string;
  teacher_name?: string | null;
  teacher_email?: string | null;
  teacher_center?: string | null;
  lecture_reviewer?: string | null;
  status: string;
  created_at: string;
}

interface TeacherLookupItem {
  teacher_code: string;
  lms_code: string;
  teacher_name: string;
  email?: string | null;
  center?: string | null;
}

interface LectureReviewRegistrationRow {
  id: number;
  event_id: string;
  teacher_code: string;
  teacher_name?: string | null;
  teacher_email?: string | null;
  teacher_center?: string | null;
  lecture_reviewer?: string | null;
  status: string;
  created_at: string;
}

const REGISTRATION_TEMPLATE_LABELS: Record<RegistrationTemplate, string> = {
  official: "Đăng ký kiểm tra chuyên sâu chính thức",
  supplement: "Kiểm tra chuyên sâu bổ sung",
};

const EVENT_TYPE_LABELS: Record<EventCategory, string> = {
  registration: "A: Lịch đăng ký kiểm tra",
  exam: "B: Lịch kiểm tra chuyên môn",
  workshop: "C: Workshop",
  workshop_teaching: "D: Lịch Workshop Teaching",
  meeting: "E: Lịch họp",
  teaching_review: "F: Duyệt giảng chuyên môn",
  advanced_training_release: "G: Lịch phát hành đào tạo nâng cao",
  holiday: "H: Lịch nghỉ",
};

const LECTURE_REVIEWERS = [
  "Cao Quang Sơn",
  "Trần Văn Nghĩa",
  "Nguyễn Cảnh An",
  "Phạm Tiến Thịnh",
  "Hoàng Việt Hùng",
];

interface CalendarCell {
  date: Date;
  inCurrentMonth: boolean;
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_HOURS = 24;
const HOUR_BLOCK_HEIGHT = 56;
const VIEW_OPTIONS: Array<{ value: CalendarView; label: string }> = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
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

function getEventClass(eventType: EventCategory | undefined) {
  switch (eventType) {
    case "registration":
      return "bg-red-100 text-red-900";
    case "workshop":
    case "workshop_teaching":
      return "bg-primary/10 text-primary";
    case "meeting":
      return "bg-primary/10 text-primary";
    case "teaching_review":
      return "bg-primary/15 text-primary";
    case "advanced_training_release":
      return "bg-indigo-200 text-indigo-900";
    case "holiday":
      return "bg-amber-200 text-amber-900";
    case "exam":
    default:
      return "bg-green-200 text-green-900";
  }
}

function getEventDetailSectionClass(_eventType: EventCategory) {
  return "border-gray-200 bg-gray-50";
}

function normalizeEventTitle(title: string, registrationTemplate?: RegistrationTemplate): string {
  // Normalize tên cũ → tên mới cho các event đã lưu trong DB
  if (title === "Đăng ký kiểm tra chuyên sâu bổ sung" || 
      (registrationTemplate === "supplement" && title.startsWith("Đăng ký kiểm tra chuyên sâu bổ sung"))) {
    return "Kiểm tra chuyên sâu bổ sung";
  }
  return title;
}

function mapEventRowToEvent(row: EventRow): EvaluationEvent {
  const template = (row.registration_template || undefined) as RegistrationTemplate | undefined;
  return {
    id: row.id,
    title: normalizeEventTitle(row.title, template),
    specialty: row.specialty || row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    note: row.note || "",
    eventType: row.event_type,
    registrationTemplate: row.registration_template || undefined,
    mode: row.mode,
    centerId: row.center_id,
    centerName: row.center_name || null,
    centerAddress: row.center_address || null,
    centerFullAddress: row.center_full_address || null,
    centerMapUrl: row.center_map_url || null,
    room: row.room || null,
    meetingUrl: row.meeting_url || null,
    meetingId: row.meeting_id || null,
    lectureReviewer: row.lecture_reviewer || null,
    status: row.status || null,
    allowRegistration: Boolean(row.allow_registration),
    slotLimit: row.slot_limit ?? null,
  };
}

function formatDateOnly(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function combineDateAndTime(date: string, time: string) {
  // Build a Date in local (browser) time so we preserve the admin's intended VN wall-clock.
  // Appending the local timezone offset makes the API round-trip timezone-independent.
  const [h, m] = (time || '00:00').split(':').map(Number);
  const [y, mo, d] = (date || '').split('-').map(Number);
  const dt = new Date(y, mo - 1, d, h || 0, m || 0, 0, 0);
  const offsetMinutes = -dt.getTimezoneOffset(); // e.g. 420 for UTC+7
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOff = Math.abs(offsetMinutes);
  const oh = Math.floor(absOff / 60).toString().padStart(2, '0');
  const om = (absOff % 60).toString().padStart(2, '0');
  return `${date}T${time}:00${sign}${oh}:${om}`; // e.g. "2026-04-05T22:30:00+07:00"
}

function formatEventTimeRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const hhmm = (value: Date) => {
    const h = value.getHours().toString().padStart(2, "0");
    const m = value.getMinutes().toString().padStart(2, "0");
    return `${h}h${m}`;
  };
  return `${hhmm(start)} - ${hhmm(end)}`;
}

function getExamEventTitle(label: string) {
  if (label.toLowerCase().includes("quy trình")) {
    return "Kiểm tra quy trình - kỹ năng trải nghiệm";
  }
  return `Kiểm tra chuyên sâu ${label}`;
}

function formatTimeOnly(value: string) {
  const date = new Date(value);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function addMinutes(timeStr: string, mins: number) {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function buildCalendarCells(focusDate: Date, view: CalendarView): CalendarCell[] {
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

  const totalCells = view === "month" ? 35 : 42;

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() };
  });
}

export default function ProfessionalEvaluationSchedulePage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDayEventsModal, setShowDayEventsModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<EvaluationEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [selectedParticipantEvent, setSelectedParticipantEvent] = useState<EvaluationEvent | null>(null);
  const [acceptedParticipants, setAcceptedParticipants] = useState<Array<EventParticipant | TeachingReviewParticipant>>([]);
  const [showLectureRegisterModal, setShowLectureRegisterModal] = useState(false);
  const [selectedLectureEvent, setSelectedLectureEvent] = useState<EvaluationEvent | null>(null);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherResults, setTeacherResults] = useState<TeacherLookupItem[]>([]);
  const [selectedTeacherCode, setSelectedTeacherCode] = useState("");
  const [registeringLectureReview, setRegisteringLectureReview] = useState(false);
  const [lectureRegistrationsLoading, setLectureRegistrationsLoading] = useState(false);
  const [lectureRegistrations, setLectureRegistrations] = useState<LectureReviewRegistrationRow[]>([]);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [centersLoading, setCentersLoading] = useState(false);
  const calendarPermissionPath = "/admin/page4/lich-danh-gia";

  // Subjects & sets (giống thu-vien-de)
  const [subjectList, setSubjectList] = useState<ExamSubjectOption[]>([]);
  const [setsBySubjectId, setSetsBySubjectId] = useState<Map<number, ExamSetOption[]>>(new Map());

  const [formData, setFormData] = useState(() => {
    const start = new Date();
    const defaultDate = formatDateOnly(start);
    return {
      eventType: "exam" as EventCategory,
      registrationTemplate: "official" as RegistrationTemplate,
      registrationStartDate: defaultDate,
      registrationStartTime: "08:00",
      registrationEndDate: defaultDate,
      registrationEndTime: "17:00",
      holidayStartDate: defaultDate,
      holidayEndDate: defaultDate,
      examDate: defaultDate,
      commonDate: defaultDate,
      commonStartTime: "08:00",
      commonEndTime: "09:00",
      examSchedules: [
        {
          specialty: "",
          startTime: "21:00",
          endTime: "21:45",
          subjectId: null,
          selectedSetId: null,
        },
      ] as ExamScheduleItem[],
      title: "",
        mode: "online" as EventMode,
        centerId: null as number | null,
        room: "",
        lectureReviewer: "",
        allowRegistration: false,
        slotLimit: "",
      note: "",
    };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoadingEvents(true);
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const response = await fetch(`/api/event-schedules?month=${month}`);
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể tải dữ liệu lịch sự kiện');
      }

      const mapped = (data.data || []).map((row: EventRow) => mapEventRowToEvent(row));
      setEvents(mapped);
    } catch (error: any) {
      console.error('Error fetching event schedules:', error);
      toast.error(error?.message || 'Không thể tải dữ liệu lịch sự kiện');
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    const fetchCenters = async () => {
      try {
        setCentersLoading(true);
        const response = await fetch('/api/event-schedules/centers');
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể tải danh sách cơ sở');
        }
        setCenters((data.centers || []) as CenterOption[]);
      } catch (error: any) {
        console.error('Error fetching event centers:', error);
        toast.error(error?.message || 'Không thể tải danh sách cơ sở');
        setCenters([]);
      } finally {
        setCentersLoading(false);
      }
    };

    fetchCenters();
  }, []);

  // Tải danh sách môn + bộ đề (giống thu-vien-de)
  useEffect(() => {
    const loadSubjectsAndSets = async () => {
      try {
        const [subjectRes, setRes] = await Promise.all([
          fetch('/api/exam-subjects'),
          fetch('/api/exam-sets'),
        ]);
        const subjectData = await subjectRes.json();
        const setData = await setRes.json();

        if (subjectData.success) {
          setSubjectList((subjectData.data || []) as ExamSubjectOption[]);
        }

        if (setData.success) {
          const allSets: Array<ExamSetOption & { subject_id: number }> = (setData.data || []).map((s: any) => ({
            id: Number(s.id),
            set_code: String(s.set_code || ''),
            set_name: String(s.set_name || ''),
            question_count: Number(s.question_count || 0),
            subject_id: Number(s.subject_id),
          }));

          const map = new Map<number, ExamSetOption[]>();
          allSets.forEach((s) => {
            const list = map.get(s.subject_id) || [];
            list.push({ id: s.id, set_code: s.set_code, set_name: s.set_name, question_count: s.question_count });
            map.set(s.subject_id, list);
          });
          setSetsBySubjectId(map);
        }
      } catch (err) {
        console.error('Error loading subjects/sets:', err);
      }
    };
    loadSubjectsAndSets();
  }, []);

  const canManageCalendar = user?.role === "super_admin";
  const canRegisterLectureReview = useMemo(() => {
    if (!user) return false;
    const elevatedRoles = new Set([
      "LEADER",
      "TE",
      "ACADEMIC_LEADER",
      "CODING_LEADER",
    ]);
    return (user.userRoles || []).some((role) => elevatedRoles.has(String(role || "").toUpperCase()));
  }, [user]);

  const yearOptions = useMemo(() => {
    const currentYear = currentTime.getFullYear();
    const focusYear = focusDate.getFullYear();
    const minYear = Math.min(currentYear - 5, focusYear - 5);
    const maxYear = Math.max(currentYear + 5, focusYear + 5);
    const length = maxYear - minYear + 1;
    return Array.from({ length }, (_, index) => minYear + index);
  }, [currentTime, focusDate]);

  const calendarCells = useMemo(
    () => buildCalendarCells(focusDate, view),
    [focusDate, view]
  );

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, EvaluationEvent[]>();
    events.forEach((event) => {
      if (event.eventType === "registration" || event.eventType === "holiday") {
        const startDate = startOfDay(new Date(event.startAt));
        const endDate = startOfDay(new Date(event.endAt));
        const cursor = new Date(startDate);

        while (cursor.getTime() <= endDate.getTime()) {
          const key = formatDateKey(cursor);
          const previous = map.get(key) || [];
          previous.push(event);
          map.set(key, previous);
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        const date = new Date(event.startAt);
        const key = formatDateKey(date);
        const previous = map.get(key) || [];
        previous.push(event);
        map.set(key, previous);
      }
    });

    map.forEach((list, key) => {
      map.set(
        key,
        list.sort(
          (first, second) =>
            new Date(first.startAt).getTime() - new Date(second.startAt).getTime()
        )
      );
    });

    return map;
  }, [events]);

  const periodLabel = useMemo(() => {
    if (view === "day") {
      return focusDate.toLocaleDateString("vi-VN", {
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

    if (view === "year") {
      return `Năm ${focusDate.getFullYear()}`;
    }

    return `Tháng ${focusDate.getMonth() + 1}/${focusDate.getFullYear()}`;
  }, [focusDate, view]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDateKey.get(formatDateKey(selectedDate)) || [];
  }, [eventsByDateKey, selectedDate]);

  const dayViewEvents = useMemo(() => {
    if (view !== "day") return { registration: [] as EvaluationEvent[], exam: [] as EvaluationEvent[] };
    const eventsOfDay = eventsByDateKey.get(formatDateKey(focusDate)) || [];
    return {
      registration: eventsOfDay.filter((event) => event.eventType === "registration"),
      exam: eventsOfDay.filter((event) => event.eventType !== "registration"),
    };
  }, [eventsByDateKey, focusDate, view]);

  const stepDate = (amount: number) => {
    const next = new Date(focusDate);

    if (view === "day") {
      next.setDate(next.getDate() + amount);
    } else if (view === "week") {
      next.setDate(next.getDate() + amount * 7);
    } else if (view === "year") {
      next.setFullYear(next.getFullYear() + amount);
    } else {
      next.setMonth(next.getMonth() + amount);
    }

    setFocusDate(next);
  };

  const goToToday = () => {
    setFocusDate(new Date());
  };

  const applyDefaultFormForDate = (baseDate: Date) => {
    const start = new Date(baseDate);
    start.setHours(8, 0, 0, 0);

    setFormData({
      eventType: "exam",
      registrationTemplate: "official",
      registrationStartDate: formatDateOnly(start),
      registrationStartTime: "08:00",
      registrationEndDate: formatDateOnly(start),
      registrationEndTime: "17:00",
      holidayStartDate: formatDateOnly(start),
      holidayEndDate: formatDateOnly(start),
      examDate: formatDateOnly(start),
      commonDate: formatDateOnly(start),
      commonStartTime: "08:00",
      commonEndTime: "09:00",
      examSchedules: [
        {
          specialty: "",
          startTime: "21:00",
          endTime: "21:45",
          subjectId: null,
          selectedSetId: null,
        },
      ],
      title: "",
      note: "",
      mode: "online",
      centerId: null,
      room: "",
      lectureReviewer: "",
      allowRegistration: false,
      slotLimit: "",
    });
  };

  const resetForm = () => {
    applyDefaultFormForDate(focusDate);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setEditingEventId(null);
  };

  const openCreateModal = () => {
    if (!canManageCalendar) {
      return;
    }
    resetForm();
    setEditingEventId(null);
    setShowCreateModal(true);
  };

  const openCreateModalForDay = (date: Date) => {
    if (!canManageCalendar) {
      return;
    }
    applyDefaultFormForDate(date);
    setEditingEventId(null);
    setShowDayEventsModal(false);
    setShowCreateModal(true);
  };

  const openEditEvent = (event: EvaluationEvent) => {
    if (!canManageCalendar) {
      return;
    }
    if (event.eventType === "registration") {
      setFormData((previous) => ({
        ...previous,
        eventType: "registration",
        registrationTemplate: event.registrationTemplate || "official",
        registrationStartDate: formatDateOnly(new Date(event.startAt)),
        registrationStartTime: formatTimeOnly(event.startAt),
        registrationEndDate: formatDateOnly(new Date(event.endAt)),
        registrationEndTime: formatTimeOnly(event.endAt),
        note: event.note || "",
      }));
    } else if (event.eventType === "exam") {
      setFormData((previous) => ({
        ...previous,
        eventType: "exam",
        examDate: formatDateOnly(new Date(event.startAt)),
        examSchedules: [
          {
            specialty: event.specialty,
            startTime: formatTimeOnly(event.startAt),
            endTime: formatTimeOnly(event.endAt),
            subjectId: null,
            selectedSetId: null,
          },
        ],
        note: event.note || "",
      }));
    } else if (event.eventType === "holiday") {
      setFormData((previous) => ({
        ...previous,
        eventType: "holiday",
        title: event.title,
        holidayStartDate: formatDateOnly(new Date(event.startAt)),
        holidayEndDate: formatDateOnly(new Date(event.endAt)),
        note: event.note || "",
      }));
    } else {
      setFormData((previous) => ({
        ...previous,
        eventType: event.eventType || "meeting",
        title: event.title,
        commonDate: formatDateOnly(new Date(event.startAt)),
        commonStartTime: formatTimeOnly(event.startAt),
        commonEndTime: formatTimeOnly(event.endAt),
        note: event.note || "",
        mode: event.mode || "online",
        centerId: event.centerId || null,
        room: event.room || "",
        lectureReviewer: event.lectureReviewer || "",
        allowRegistration: Boolean(event.allowRegistration),
        slotLimit: event.slotLimit != null ? String(event.slotLimit) : "",
      }));
    }

    setEditingEventId(event.id);
    setShowDayEventsModal(false);
    setShowCreateModal(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!canManageCalendar) {
      return;
    }
    try {
      const response = await fetch('/api/event-schedules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể xóa sự kiện');
      }

      setEvents((previous) => previous.filter((event) => event.id !== eventId));
      toast.success("Đã xóa sự kiện");
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa sự kiện');
    }
  };

  const handleViewParticipants = async (event: EvaluationEvent) => {
    try {
      setParticipantsLoading(true);
      setSelectedParticipantEvent(event);
      setShowParticipantsModal(true);

      const response = await fetch(
        event.eventType === 'teaching_review'
          ? `/api/lecture-review-registrations?event_id=${encodeURIComponent(event.id)}`
          : `/api/event-schedule-participants?event_id=${encodeURIComponent(event.id)}&status=accepted`
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể tải danh sách tham gia');
      }

      setAcceptedParticipants((data.data || []) as Array<EventParticipant | TeachingReviewParticipant>);
    } catch (error: any) {
      setAcceptedParticipants([]);
      toast.error(error?.message || 'Không thể tải danh sách tham gia');
    } finally {
      setParticipantsLoading(false);
    }
  };

  const loadLectureRegistrations = async (eventId: string) => {
    try {
      setLectureRegistrationsLoading(true);
      const response = await fetch(
        `/api/lecture-review-registrations?event_id=${encodeURIComponent(eventId)}`,
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Không thể tải danh sách đăng ký duyệt giảng");
      }
      setLectureRegistrations((data.data || []) as LectureReviewRegistrationRow[]);
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải danh sách đăng ký duyệt giảng");
      setLectureRegistrations([]);
    } finally {
      setLectureRegistrationsLoading(false);
    }
  };

  const loadTeachersForLectureReview = async (query: string) => {
    try {
      setTeachersLoading(true);
      const response = await fetch(
        `/api/event-schedules/teachers?q=${encodeURIComponent(query)}&limit=30`,
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Không thể tải danh sách giáo viên");
      }
      setTeacherResults((data.teachers || []) as TeacherLookupItem[]);
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải danh sách giáo viên");
      setTeacherResults([]);
    } finally {
      setTeachersLoading(false);
    }
  };

  const openLectureRegisterModal = async (event: EvaluationEvent) => {
    setSelectedLectureEvent(event);
    setShowLectureRegisterModal(true);
    setTeacherQuery("");
    setSelectedTeacherCode("");
    await Promise.all([
      loadTeachersForLectureReview(""),
      loadLectureRegistrations(event.id),
    ]);
  };

  const handleSubmitLectureRegistration = async () => {
    if (!selectedLectureEvent) return;
    if (!selectedTeacherCode) {
      toast.error("Vui lòng chọn giáo viên để đăng ký");
      return;
    }

    try {
      setRegisteringLectureReview(true);
      const response = await fetch('/api/lecture-review-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedLectureEvent.id,
          teacher_code: selectedTeacherCode,
          lecture_reviewer: selectedLectureEvent.lectureReviewer || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể đăng ký lịch duyệt giảng');
      }

      toast.success('Đăng ký lịch duyệt giảng thành công');
      await loadLectureRegistrations(selectedLectureEvent.id);
      setSelectedTeacherCode("");
    } catch (error: any) {
      toast.error(error?.message || 'Không thể đăng ký lịch duyệt giảng');
    } finally {
      setRegisteringLectureReview(false);
    }
  };

  // Kiểm tra sự kiện trùng để cảnh báo trong form
  const duplicateConflicts = useMemo(() => {
    if (!showCreateModal) return [];
    const conflicts: string[] = [];
    if (formData.eventType === "exam" && formData.examDate) {
      for (const schedule of formData.examSchedules) {
        if (!schedule.subjectId) continue;
        const subject = subjectList.find((s) => s.id === schedule.subjectId);
        if (!subject) continue;
        const exists = events.some(
          (ev) =>
            ev.eventType === "exam" &&
            ev.specialty === subject.subject_code &&
            formatDateKey(new Date(ev.startAt)) === formData.examDate &&
            ev.id !== editingEventId
        );
        if (exists) conflicts.push(subject.subject_name);
      }
    } else if (formData.eventType === "registration" && formData.registrationStartDate) {
      const exists = events.some(
        (ev) =>
          ev.eventType === "registration" &&
          ev.registrationTemplate === formData.registrationTemplate &&
          ev.id !== editingEventId
      );
      if (exists) conflicts.push(REGISTRATION_TEMPLATE_LABELS[formData.registrationTemplate]);
    }
    return conflicts;
  }, [showCreateModal, formData, events, subjectList, editingEventId]);

  const handleCreateEvent = async () => {
    if (!canManageCalendar) {
      return;
    }
    let nextEvents: EvaluationEvent[];

    if (formData.eventType === "registration") {
      if (!formData.registrationStartDate || !formData.registrationEndDate) {
        toast.error("Vui lòng chọn ngày mở và ngày đóng đăng ký");
        return;
      }

      if (new Date(formData.registrationEndDate) < new Date(formData.registrationStartDate)) {
        toast.error("Ngày kết thúc đăng ký phải sau hoặc bằng ngày mở đăng ký");
        return;
      }

      const startAt = combineDateAndTime(formData.registrationStartDate, formData.registrationStartTime);
      const endAt = combineDateAndTime(formData.registrationEndDate, formData.registrationEndTime);
      nextEvents = [{
        id: crypto.randomUUID(),
        eventType: "registration",
        registrationTemplate: formData.registrationTemplate,
        title: REGISTRATION_TEMPLATE_LABELS[formData.registrationTemplate],
        specialty: "Lịch đăng ký kiểm tra",
        startAt,
        endAt,
        note: formData.note.trim(),
      }];
    } else if (formData.eventType === "exam") {
      if (!formData.examDate) {
        toast.error("Vui lòng nhập đầy đủ thông tin sự kiện");
        return;
      }

      if (!Array.isArray(formData.examSchedules) || formData.examSchedules.length === 0) {
        toast.error("Vui lòng thêm ít nhất 1 lịch kiểm tra");
        return;
      }

      const hasInvalidSchedule = formData.examSchedules.some(
        (schedule) => !schedule.subjectId || !schedule.startTime || !schedule.endTime
      );
      if (hasInvalidSchedule) {
        toast.error("Vui lòng chọn môn kiểm tra và thời gian cho tất cả lịch");
        return;
      }

      // TODO: Bật lại khi cần bắt buộc chọn bộ đề
      // const hasNoSet = formData.examSchedules.some((s) => !s.selectedSetId);
      // if (hasNoSet) {
      //   toast.error("Vui lòng chọn bộ đề cho tất cả lịch kiểm tra");
      //   return;
      // }

      const hasInvalidTimeRange = formData.examSchedules.some((schedule) => {
        const startAt = combineDateAndTime(formData.examDate, schedule.startTime);
        const endAt = combineDateAndTime(formData.examDate, schedule.endTime);
        return new Date(endAt) <= new Date(startAt);
      });
      if (hasInvalidTimeRange) {
        toast.error("Mỗi lịch kiểm tra phải có thời gian kết thúc sau thời gian bắt đầu");
        return;
      }

      // Trước khi tạo event_schedule: set bộ đề mặc định tháng (giống thu-vien-de)
      const examDateObj = new Date(formData.examDate);
      const examYear = examDateObj.getFullYear();
      const examMonth = examDateObj.getMonth() + 1;

      for (const schedule of formData.examSchedules) {
        if (!schedule.subjectId || !schedule.selectedSetId) continue;
        try {
          await fetch('/api/chuyensau-chonde-thang', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject_id: schedule.subjectId,
              selected_set_id: schedule.selectedSetId,
              year: examYear,
              month: examMonth,
              note: `Set từ lich-danh-gia ${formData.examDate}`,
            }),
          });
        } catch (err) {
          console.error('chonde-thang error:', err);
        }
      }

      nextEvents = formData.examSchedules.map((schedule) => {
        const subject = subjectList.find((s) => s.id === schedule.subjectId);
        // specialty = ma_mon để khớp với chuyen_sau_monhoc khi lookup event
        const specialty = subject?.subject_code || schedule.specialty;
        const title = getExamEventTitle(subject?.subject_name || specialty);
        const startAt = combineDateAndTime(formData.examDate, schedule.startTime);
        const endAt = combineDateAndTime(formData.examDate, schedule.endTime);
        return {
          id: crypto.randomUUID(),
          eventType: "exam" as EventCategory,
          title,
          specialty,
          startAt,
          endAt,
          note: formData.note.trim(),
        };
      });
    } else {
      let startAt = "";
      let endAt = "";

      if (formData.eventType === "holiday") {
        if (!formData.holidayStartDate || !formData.holidayEndDate) {
          toast.error("Vui lòng chọn ngày bắt đầu và ngày kết thúc lịch nghỉ");
          return;
        }

        if (new Date(formData.holidayEndDate) < new Date(formData.holidayStartDate)) {
          toast.error("Ngày kết thúc lịch nghỉ phải sau hoặc bằng ngày bắt đầu");
          return;
        }

        startAt = combineDateAndTime(formData.holidayStartDate, '00:00');
        endAt = combineDateAndTime(formData.holidayEndDate, '23:59');
      } else {
        if (!formData.commonDate || !formData.commonStartTime || !formData.commonEndTime) {
          toast.error("Vui lòng nhập đầy đủ ngày và giờ sự kiện");
          return;
        }

        startAt = combineDateAndTime(formData.commonDate, formData.commonStartTime);
        endAt = combineDateAndTime(formData.commonDate, formData.commonEndTime);
        if (new Date(endAt) <= new Date(startAt)) {
          toast.error("Thời gian kết thúc phải sau thời gian bắt đầu");
          return;
        }
      }

      const titleByType: Record<EventCategory, string> = {
        registration: EVENT_TYPE_LABELS.registration,
        exam: EVENT_TYPE_LABELS.exam,
        workshop: "Workshop",
        workshop_teaching: "Workshop Teaching",
        meeting: "Lịch họp",
        teaching_review: "Duyệt giảng chuyên môn",
        advanced_training_release: "Phát hành đào tạo nâng cao",
        holiday: "Lịch nghỉ",
      };

      if (formData.mode === "offline" && !formData.centerId) {
        toast.error("Sự kiện offline bắt buộc chọn cơ sở tổ chức");
        return;
      }

      if (formData.eventType === "teaching_review" && !formData.lectureReviewer) {
        toast.error("Vui lòng chọn người duyệt giảng");
        return;
      }

      const selectedCenter =
        formData.centerId != null
          ? centers.find((center) => center.id === formData.centerId) || null
          : null;

      const finalTitle = formData.title.trim() || titleByType[formData.eventType];
      nextEvents = [
        {
          id: crypto.randomUUID(),
          eventType: formData.eventType,
          title: finalTitle,
          specialty: finalTitle,
          startAt,
          endAt,
          note: formData.note.trim(),
          mode: formData.mode,
          centerId: formData.centerId,
          centerName: selectedCenter?.center_name || null,
          centerAddress: selectedCenter?.address || null,
          centerFullAddress: selectedCenter?.full_address || null,
          centerMapUrl: selectedCenter?.map_url || null,
          room: formData.room.trim() || null,
          lectureReviewer: formData.lectureReviewer.trim() || null,
          allowRegistration: Boolean(formData.allowRegistration),
          slotLimit:
            formData.slotLimit === ""
              ? null
              : Number(formData.slotLimit) > 0
                ? Number(formData.slotLimit)
                : null,
        },
      ];
    }

    try {
      setIsSavingEvent(true);
      if (editingEventId) {
        const updated = nextEvents[0];
        const response = await fetch('/api/event-schedules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingEventId,
            title: updated.title,
            specialty: updated.specialty,
            event_type: updated.eventType,
            registration_template: updated.registrationTemplate || null,
            start_at: updated.startAt,
            end_at: updated.endAt,
            note: updated.note || null,
            mode: updated.mode || "online",
            center_id: updated.centerId || null,
            room: updated.room || null,
            lecture_reviewer: updated.lectureReviewer || null,
            allow_registration: Boolean(updated.allowRegistration),
            slot_limit: updated.slotLimit || null,
          }),
        });
        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể cập nhật sự kiện');
        }

        const mapped = mapEventRowToEvent(data.data as EventRow);
        setEvents((previous) =>
          previous.map((event) => (event.id === editingEventId ? mapped : event))
        );
        toast.success("Đã cập nhật sự kiện");
      } else {
        const createdRows = await Promise.all(
          nextEvents.map(async (event) => {
            const response = await fetch('/api/event-schedules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: event.id,
                title: event.title,
                specialty: event.specialty,
                event_type: event.eventType,
                registration_template: event.registrationTemplate || null,
                start_at: event.startAt,
                end_at: event.endAt,
                note: event.note || null,
                mode: event.mode || "online",
                center_id: event.centerId || null,
                room: event.room || null,
                lecture_reviewer: event.lectureReviewer || null,
                allow_registration: Boolean(event.allowRegistration),
                slot_limit: event.slotLimit || null,
              }),
            });
            const data = await response.json();
            if (!response.ok || !data?.success) {
              throw new Error(data?.error || 'Không thể tạo sự kiện');
            }
            return mapEventRowToEvent(data.data as EventRow);
          })
        );

        setEvents((previous) => [...previous, ...createdRows]);
        toast.success("Đã thêm lịch sự kiện");
      }

      closeCreateModal();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu sự kiện');
    } finally {
      setIsSavingEvent(false);
    }
  };

  const exportEvents = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lich-su-kien-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCreateModal();
        setShowDayEventsModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateModal, showDayEventsModal]);

  const dayTimelineHeight = DAY_HOURS * HOUR_BLOCK_HEIGHT;
  const dayIsToday = isSameDate(startOfDay(focusDate), startOfDay(currentTime));
  const currentMinuteOfDay = currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentTimeTop = (currentMinuteOfDay / 60) * HOUR_BLOCK_HEIGHT;
  const selectedCenter =
    formData.centerId != null
      ? centers.find((center) => center.id === formData.centerId) || null
      : null;

  return (
    <PageContainer title="Lịch sự kiện">
      <Card className="overflow-hidden" padding="sm">
        <div className="px-4 py-2 border-b flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-700" />
            <select
              value={focusDate.getMonth()}
              onChange={(event) => {
                const next = new Date(focusDate);
                next.setMonth(Number(event.target.value));
                setFocusDate(next);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index} value={index}>
                  Tháng {index + 1}
                </option>
              ))}
            </select>

            <select
              value={focusDate.getFullYear()}
              onChange={(event) => {
                const next = new Date(focusDate);
                next.setFullYear(Number(event.target.value));
                setFocusDate(next);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => stepDate(-1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
              aria-label="Trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => stepDate(1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
              aria-label="Sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setView(option.value)}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                  view === option.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}

            <button
              onClick={goToToday}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
            >
              Hôm nay
            </button>

            {canManageCalendar && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" /> Thêm mới
              </button>
            )}

            <button
              onClick={exportEvents}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Xuất file
            </button>
          </div>
        </div>

        <div className="px-4 py-2 text-sm font-semibold text-gray-700 border-b border-gray-200 bg-gray-50">
          {periodLabel}
        </div>

        {!canManageCalendar && (
          <div className="px-4 py-2 text-xs text-amber-800 border-b border-amber-200 bg-amber-50">
            Bạn đang ở chế độ chỉ xem. Các chức năng Thêm mới, Sửa và Xóa sự kiện chỉ dành cho Super Admin.
          </div>
        )}

        {isLoadingEvents && (
          <div className="px-4 py-2 text-xs text-blue-700 border-b border-gray-200 bg-blue-50">
            Đang tải dữ liệu lịch sự kiện từ hệ thống...
          </div>
        )}

        {view === "day" ? (
          <div className="border-l border-t border-gray-200">
            <div className="grid grid-cols-[78px_1fr] border-b border-gray-200 bg-gray-50">
              <div className="px-3 py-2 text-sm font-semibold text-gray-600">Giờ</div>
              <div className="px-3 py-2 text-sm font-semibold text-gray-700">
                {focusDate.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </div>
            </div>

            {dayViewEvents.registration.length > 0 && (
              <div className="border-b border-gray-200 bg-yellow-50 px-3 py-2">
                {dayViewEvents.registration.map((event) => (
                  <div
                    key={event.id}
                    className="text-sm font-bold leading-5 text-red-700 whitespace-pre-line"
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            )}

            <div className="relative grid grid-cols-[78px_1fr]">
              <div className="relative border-r border-gray-200 bg-white">
                {Array.from({ length: DAY_HOURS + 1 }, (_, hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0"
                    style={{ top: hour * HOUR_BLOCK_HEIGHT }}
                  >
                    <span className="-translate-y-1/2 block px-2 text-xs font-semibold text-blue-700">
                      {`${hour.toString().padStart(2, "0")}h00`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="relative bg-white" style={{ height: dayTimelineHeight }}>
                {Array.from({ length: DAY_HOURS + 1 }, (_, hour) => (
                  <div
                    key={`line-${hour}`}
                    className="absolute left-0 right-0 border-t border-gray-200"
                    style={{ top: hour * HOUR_BLOCK_HEIGHT }}
                  />
                ))}

                {dayViewEvents.exam.map((event) => {
                  const start = new Date(event.startAt);
                  const end = new Date(event.endAt);
                  const startMinute = start.getHours() * 60 + start.getMinutes();
                  const endMinute = end.getHours() * 60 + end.getMinutes();
                  const top = (startMinute / 60) * HOUR_BLOCK_HEIGHT;
                  const height = Math.max(26, ((endMinute - startMinute) / 60) * HOUR_BLOCK_HEIGHT);
                  const eventTitle =
                    event.specialty === "Quy trình quy định"
                      ? "Kiểm tra quy trình - kỹ năng trải nghiệm"
                      : event.title;

                  return (
                    <div
                      key={event.id}
                      className={`absolute left-2 right-2 rounded-sm px-2 py-1 text-[11px] leading-4 font-semibold ${getEventClass(event.eventType)}`}
                      style={{ top, height }}
                      title={`${eventTitle} (${formatEventTimeRange(event.startAt, event.endAt)})`}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        setSelectedDate(focusDate);
                        setShowDayEventsModal(true);
                      }}
                    >
                      <div className="truncate">{eventTitle}</div>
                      <div className="text-[10px] opacity-80">{formatEventTimeRange(event.startAt, event.endAt)}</div>
                    </div>
                  );
                })}

                {dayIsToday && (
                  <div className="absolute left-0 right-0 z-20" style={{ top: currentTimeTop }}>
                    <div className="border-t-2 border-red-500" />
                    <span className="absolute -top-2 right-1 bg-white px-1 text-[10px] font-semibold text-red-600">
                      {currentTime.toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 border-l border-t border-gray-200">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="h-10 border-r border-b border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600 flex items-center justify-center"
              >
                {label}
              </div>
            ))}

            {calendarCells.map(({ date, inCurrentMonth }) => {
              const isToday = isSameDate(startOfDay(date), startOfDay(currentTime));
              const dateKey = formatDateKey(date);
              const dayEvents = eventsByDateKey.get(dateKey) || [];

              return (
                <div
                  key={dateKey}
                  className={`min-h-28 border-r border-b border-gray-200 p-2 ${
                    isToday
                      ? "bg-yellow-50 border-yellow-300"
                      : inCurrentMonth
                        ? "bg-white"
                        : "bg-gray-50"
                  } cursor-pointer hover:bg-blue-50`}
                  onClick={() => {
                    setSelectedDate(date);
                    setShowDayEventsModal(true);
                  }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    {isToday ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-300 text-sm font-bold text-yellow-900">
                        {date.getDate()}
                      </span>
                    ) : (
                      <span
                        className={`text-sm font-medium ${
                          inCurrentMonth ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.map((event) => {
                      if (event.eventType === "registration") {
                        return (
                          <div
                            key={event.id}
                            className="py-1 text-center text-[12px] leading-4 font-bold text-red-700 whitespace-pre-line"
                            title={event.title.replace(/\n/g, " ")}
                          >
                            {event.title}
                          </div>
                        );
                      }

                      const eventTitle =
                        event.specialty === "Quy trình quy định"
                          ? "Kiểm tra quy trình - kỹ năng trải nghiệm"
                          : event.title;

                      return (
                        <div key={event.id} className="flex items-start gap-1">
                          <div className="w-18 shrink-0 text-[11px] font-semibold text-blue-700 leading-4">
                            {formatEventTimeRange(event.startAt, event.endAt)}
                          </div>
                          <div
                            className={`flex-1 rounded-sm px-1 py-1 text-[11px] leading-4 font-semibold text-center ${getEventClass(event.eventType)}`}
                            title={eventTitle}
                          >
                            {eventTitle}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-lg font-bold text-foreground">{editingEventId ? 'Cập nhật sự kiện' : 'Thêm mới sự kiện'}</h3>
              <button onClick={closeCreateModal} className="rounded-md p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4 flex-1 overflow-y-auto">
              {duplicateConflicts.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <span className="font-semibold">⚠ Đã có sự kiện tương tự:</span>
                  <ul className="mt-1 ml-3 list-disc text-xs">
                    {duplicateConflicts.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-amber-700">Bạn vẫn có thể lưu nếu cần tạo thêm lịch.</p>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Loại sự kiện</label>
                <select
                  value={formData.eventType}
                  onChange={(event) => {
                    const eventType = event.target.value as EventCategory;
                    setFormData((previous) => ({
                      ...previous,
                      eventType,
                      title:
                        eventType === "teaching_review"
                          ? "Duyệt giảng chuyên môn"
                          : previous.title,
                    }));
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {(Object.keys(EVENT_TYPE_LABELS) as EventCategory[]).map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {EVENT_TYPE_LABELS[eventType]}
                    </option>
                  ))}
                </select>

                {formData.eventType === "registration" && (
                  <p className="mt-2 text-xs text-gray-600">
                    Dùng cho form đăng ký [Chính thức]/[Bổ sung]
                  </p>
                )}
                {formData.eventType === "exam" && (
                  <p className="mt-2 text-xs text-gray-600">
                    1 ngày có thể tạo nhiều mục kiểm tra
                  </p>
                )}
                {formData.eventType === "holiday" && (
                  <p className="mt-2 text-xs text-gray-600">
                    Tạo lịch nghỉ theo thời gian bạn chọn
                  </p>
                )}
              </div>

              <div className={`rounded-lg border p-3 space-y-3 ${getEventDetailSectionClass(formData.eventType)}`}>
                <div className="text-sm font-semibold text-gray-800">Chi tiết nội dung sự kiện</div>

                {formData.eventType === "registration" ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Mẫu đăng ký *</label>
                      <select
                        value={formData.registrationTemplate}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            registrationTemplate: event.target.value as RegistrationTemplate,
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      >
                        <option value="official">{REGISTRATION_TEMPLATE_LABELS.official}</option>
                        <option value="supplement">{REGISTRATION_TEMPLATE_LABELS.supplement}</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Ngày bắt đầu mở đăng ký *</label>
                      <input
                        type="date"
                        value={formData.registrationStartDate}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            registrationStartDate: event.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Ngày kết thúc đăng ký *</label>
                      <input
                        type="date"
                        value={formData.registrationEndDate}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            registrationEndDate: event.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      />
                    </div>

                    {formData.registrationTemplate === "supplement" && (
                      <div className="grid grid-cols-2 gap-3 mt-2 p-3 rounded-lg border border-blue-100 bg-blue-50/50">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-blue-700">Giờ bắt đầu mở *</label>
                          <input
                            type="time"
                            value={formData.registrationStartTime}
                            onChange={(event) =>
                              setFormData((previous) => ({
                                ...previous,
                                registrationStartTime: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-blue-700">Giờ kết thúc *</label>
                          <input
                            type="time"
                            value={formData.registrationEndTime}
                            onChange={(event) =>
                              setFormData((previous) => ({
                                ...previous,
                                registrationEndTime: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : formData.eventType === "exam" ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Ngày kiểm tra chuyên môn *</label>
                      <input
                        type="date"
                        value={formData.examDate}
                        onChange={(event) =>
                          setFormData((previous) => ({ ...previous, examDate: event.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      />
                    </div>

                    <div className="space-y-3">
                      {formData.examSchedules.map((schedule, index) => (
                        <div key={index} className="rounded-md border border-gray-200 p-3 bg-white">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-gray-800">Lịch môn #{index + 1}</div>
                            {formData.examSchedules.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData((previous) => ({
                                    ...previous,
                                    examSchedules: previous.examSchedules.filter((_, itemIndex) => itemIndex !== index),
                                  }))
                                }
                                className="text-xs font-semibold text-red-600 hover:text-red-700"
                              >
                                Xóa
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">Môn kiểm tra</label>
                            <select
                              value={schedule.subjectId ?? ""}
                              onChange={(e) => {
                                const newSubjectId = Number(e.target.value) || null;
                                // Tạm thời bỏ điều kiện "bộ đề phải có câu hỏi" để phục vụ test.
                                // const firstValidSet = newSubjectId
                                //   ? (setsBySubjectId.get(newSubjectId) || []).find(s => s.question_count > 0)
                                //   : null;
                                const firstValidSet = newSubjectId
                                  // ? (setsBySubjectId.get(newSubjectId) || []).find(s => s.question_count > 0)
                                  ? (setsBySubjectId.get(newSubjectId) || [])[0] ?? null
                                  : null;
                                const subject = subjectList.find(s => s.id === newSubjectId);
                                setFormData((previous) => ({
                                  ...previous,
                                  examSchedules: previous.examSchedules.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          subjectId: newSubjectId,
                                          selectedSetId: firstValidSet?.id ?? null,
                                          specialty: subject?.subject_code || "",
                                          endTime: newSubjectId && subject?.duration_minutes
                                            ? addMinutes(item.startTime, subject.duration_minutes)
                                            : item.endTime,
                                        }
                                      : item
                                  ),
                                }));
                              }}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                            >
                              <option value="">-- Chọn môn --</option>
                              {subjectList.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.subject_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {schedule.subjectId && (
                            <div className="mt-2">
                              <label className="mb-1 block text-sm font-medium">Bộ đề áp dụng</label>
                              {(setsBySubjectId.get(schedule.subjectId) || []).length === 0 ? (
                                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                  Môn này chưa có bộ đề nào.
                                </div>
                              ) : (
                                <select
                                  value={schedule.selectedSetId ?? ""}
                                  onChange={(e) => {
                                    const newSetId = Number(e.target.value) || null;
                                    setFormData((previous) => ({
                                      ...previous,
                                      examSchedules: previous.examSchedules.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, selectedSetId: newSetId } : item
                                      ),
                                    }));
                                  }}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                                >
                                  <option value="">-- Chọn bộ đề --</option>
                                  {(setsBySubjectId.get(schedule.subjectId) || [])
                                    .map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.set_code}{s.set_name ? ` · ${s.set_name}` : ""} ({s.question_count} câu)
                                      </option>
                                    ))}
                                </select>
                              )}
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-sm font-medium">Bắt đầu *</label>
                              <input
                                type="time"
                                value={schedule.startTime}
                                onChange={(event) =>
                                  setFormData((previous) => ({
                                    ...previous,
                                    examSchedules: previous.examSchedules.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, startTime: event.target.value }
                                        : item
                                    ),
                                  }))
                                }
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-sm font-medium">Kết thúc *</label>
                              <input
                                type="time"
                                value={schedule.endTime}
                                onChange={(event) =>
                                  setFormData((previous) => ({
                                    ...previous,
                                    examSchedules: previous.examSchedules.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, endTime: event.target.value }
                                        : item
                                    ),
                                  }))
                                }
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {!editingEventId && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((previous) => ({
                              ...previous,
                              examSchedules: [
                                ...previous.examSchedules,
                                {
                                  specialty: "",
                                  startTime: "21:00",
                                  endTime: "21:45",
                                  subjectId: null,
                                  selectedSetId: null,
                                },
                              ],
                            }))
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
                        >
                          <Plus className="h-4 w-4" /> Thêm lịch / môn tiếp theo
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Tên sự kiện *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(event) =>
                          setFormData((previous) => ({ ...previous, title: event.target.value }))
                        }
                        placeholder="Nhập tên sự kiện"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium">Hình thức tổ chức *</label>
                        <select
                          value={formData.mode}
                          onChange={(event) =>
                            setFormData((previous) => ({
                              ...previous,
                              mode: event.target.value as EventMode,
                              centerId:
                                event.target.value === "online"
                                  ? null
                                  : previous.centerId,
                            }))
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="online">ONLINE</option>
                          <option value="offline">OFFLINE</option>
                        </select>
                      </div>

                      {formData.eventType === "teaching_review" && (
                        <div>
                          <label className="mb-1 block text-sm font-medium">Người duyệt giảng *</label>
                          <select
                            value={formData.lectureReviewer}
                            onChange={(event) =>
                              setFormData((previous) => ({
                                ...previous,
                                lectureReviewer: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          >
                            <option value="">-- Chọn reviewer --</option>
                            {LECTURE_REVIEWERS.map((reviewer) => (
                              <option key={reviewer} value={reviewer}>
                                {reviewer}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {formData.mode === "offline" && (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium">Cơ sở tổ chức *</label>
                          <select
                            value={formData.centerId ?? ""}
                            onChange={(event) =>
                              setFormData((previous) => ({
                                ...previous,
                                centerId: event.target.value ? Number(event.target.value) : null,
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          >
                            <option value="">-- Chọn cơ sở --</option>
                            {centers.map((center) => (
                              <option key={center.id} value={center.id}>
                                {center.center_name}
                              </option>
                            ))}
                          </select>
                          {centersLoading && (
                            <p className="mt-1 text-xs text-primary">Đang tải danh sách cơ sở...</p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-medium">Phòng học / địa điểm</label>
                          <input
                            type="text"
                            value={formData.room}
                            onChange={(event) =>
                              setFormData((previous) => ({ ...previous, room: event.target.value }))
                            }
                            placeholder="Ví dụ: Phòng 301"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          />
                        </div>

                        {selectedCenter && (
                          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                            <p className="font-semibold">{selectedCenter.center_name}</p>
                            <p className="mt-1 leading-5">
                              {selectedCenter.full_address || selectedCenter.address || "Chưa có địa chỉ"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const address =
                                    selectedCenter.full_address || selectedCenter.address || "";
                                  if (!address) return;
                                  navigator.clipboard.writeText(address);
                                  toast.success("Đã copy địa chỉ");
                                }}
                                className="inline-flex items-center gap-1 rounded border border-primary/20 bg-card px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
                              >
                                <Copy className="h-3.5 w-3.5" /> Copy địa chỉ
                              </button>
                              {selectedCenter.map_url && (
                                <button
                                  type="button"
                                  onClick={() => window.open(selectedCenter.map_url || "", "_blank", "noopener,noreferrer")}
                                  className="inline-flex items-center gap-1 rounded border border-primary/20 bg-card px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
                                >
                                  <MapPin className="h-3.5 w-3.5" /> Xem bản đồ
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {formData.mode === "online" && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                        Link meeting sẽ được gán từ cấu hình reviewer hoặc nhập thủ công vào sự kiện.
                      </div>
                    )}

                    {formData.eventType === "teaching_review" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-gray-200 bg-white p-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={formData.allowRegistration}
                            onChange={(event) =>
                              setFormData((previous) => ({
                                ...previous,
                                allowRegistration: event.target.checked,
                              }))
                            }
                            className="h-4 w-4"
                          />
                          Mở đăng ký lịch duyệt giảng
                        </label>
                        <div>
                          <label className="mb-1 block text-sm font-medium">Slot tối đa</label>
                          <input
                            type="number"
                            min={1}
                            value={formData.slotLimit}
                            onChange={(event) =>
                              setFormData((previous) => ({
                                ...previous,
                                slotLimit: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                            placeholder="Để trống nếu không giới hạn"
                          />
                        </div>
                      </div>
                    )}

                    {formData.eventType === "holiday" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium">Ngày bắt đầu nghỉ *</label>
                          <input
                            type="date"
                            value={formData.holidayStartDate}
                            onChange={(event) =>
                              setFormData((previous) => ({ ...previous, holidayStartDate: event.target.value }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium">Ngày kết thúc nghỉ *</label>
                          <input
                            type="date"
                            value={formData.holidayEndDate}
                            onChange={(event) =>
                              setFormData((previous) => ({ ...previous, holidayEndDate: event.target.value }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium">Ngày sự kiện *</label>
                          <input
                            type="date"
                            value={formData.commonDate}
                            onChange={(event) =>
                              setFormData((previous) => ({ ...previous, commonDate: event.target.value }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-sm font-medium">Bắt đầu *</label>
                            <input
                              type="time"
                              value={formData.commonStartTime}
                              onChange={(event) =>
                                setFormData((previous) => ({ ...previous, commonStartTime: event.target.value }))
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Kết thúc *</label>
                            <input
                              type="time"
                              value={formData.commonEndTime}
                              onChange={(event) =>
                                setFormData((previous) => ({ ...previous, commonEndTime: event.target.value }))
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="mb-1 block text-sm font-medium">Ghi chú</label>
                      <textarea
                        value={formData.note}
                        onChange={(event) =>
                          setFormData((previous) => ({ ...previous, note: event.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {(formData.eventType === "registration" || formData.eventType === "exam") && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Ghi chú</label>
                    <textarea
                      value={formData.note}
                      onChange={(event) =>
                        setFormData((previous) => ({ ...previous, note: event.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 shrink-0 bg-white">
              <button
                onClick={closeCreateModal}
                className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={isSavingEvent}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> {isSavingEvent ? "Đang lưu..." : editingEventId ? "Cập nhật sự kiện" : "Lưu sự kiện"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDayEventsModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-bold text-foreground">
                Sự kiện ngày {selectedDate.toLocaleDateString("vi-VN")}
              </h3>
              <div className="flex items-center gap-2">
                {canManageCalendar && (
                  <button
                    onClick={() => openCreateModalForDay(selectedDate)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" /> Thêm sự kiện mới
                  </button>
                )}
                <button
                  onClick={() => setShowDayEventsModal(false)}
                  className="rounded-md p-1 hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Không có sự kiện trong ngày này.
                </div>
              ) : (
                selectedDayEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-1 text-xs font-semibold text-muted-foreground">
                          {EVENT_TYPE_LABELS[event.eventType || "exam"]}
                        </div>
                        <div className="whitespace-pre-line text-sm font-bold text-foreground">{event.title}</div>
                        <div className="mt-1 text-xs text-primary">
                          {formatEventTimeRange(event.startAt, event.endAt)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{event.specialty}</div>
                        {event.lectureReviewer && (
                          <div className="mt-1 text-xs text-primary">
                            Reviewer: <span className="font-semibold">{event.lectureReviewer}</span>
                          </div>
                        )}
                        {event.mode && (
                          <div className="mt-1 text-xs text-muted-foreground">Hình thức: {event.mode.toUpperCase()}</div>
                        )}
                        {event.centerName && (
                          <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-foreground">
                            <p className="font-semibold">{event.centerName}</p>
                            <p className="mt-1 leading-5 text-muted-foreground">{event.centerFullAddress || event.centerAddress || "Chưa có địa chỉ"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const address = event.centerFullAddress || event.centerAddress || "";
                                  if (!address) return;
                                  navigator.clipboard.writeText(address);
                                  toast.success("Đã copy địa chỉ");
                                }}
                                className="inline-flex items-center gap-1 rounded border border-primary/20 bg-card px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5"
                              >
                                <Copy className="h-3.5 w-3.5" /> Copy địa chỉ
                              </button>
                              {event.centerMapUrl && (
                                <button
                                  type="button"
                                  onClick={() => window.open(event.centerMapUrl || "", "_blank", "noopener,noreferrer")}
                                  className="inline-flex items-center gap-1 rounded border border-primary/20 bg-card px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5"
                                >
                                  <MapPin className="h-3.5 w-3.5" /> Xem bản đồ
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {event.meetingUrl && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => window.open(event.meetingUrl || "", "_blank", "noopener,noreferrer")}
                              className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Join Meeting
                            </button>
                          </div>
                        )}
                        {event.eventType === "teaching_review" && Boolean(event.allowRegistration) && canRegisterLectureReview && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => openLectureRegisterModal(event)}
                              className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                            >
                              <Plus className="h-3.5 w-3.5" /> Đăng ký duyệt giảng
                            </button>
                          </div>
                        )}
                      </div>

                      {canManageCalendar && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewParticipants(event)}
                            className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                          >
                            <Users className="h-3.5 w-3.5" /> Xem tham gia
                          </button>
                          <button
                            onClick={() => openEditEvent(event)}
                            className="rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => setShowDayEventsModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showParticipantsModal && selectedParticipantEvent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedParticipantEvent.eventType === 'teaching_review'
                    ? 'Danh sách đăng ký duyệt giảng'
                    : 'Danh sách xác nhận tham gia'}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {selectedParticipantEvent.title} • {formatEventTimeRange(selectedParticipantEvent.startAt, selectedParticipantEvent.endAt)}
                </p>
              </div>
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {participantsLoading ? (
                <div className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500">
                  Đang tải danh sách {selectedParticipantEvent.eventType === 'teaching_review' ? 'đăng ký duyệt giảng' : 'tham gia'}...
                </div>
              ) : acceptedParticipants.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  {selectedParticipantEvent.eventType === 'teaching_review'
                    ? 'Chưa có đăng ký duyệt giảng nào.'
                    : 'Chưa có mentor tham gia.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {acceptedParticipants.map((participant, index) => (
                    <div key={participant.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {index + 1}. {participant.teacher_name || participant.teacher_code}
                          </p>
                          <p className="text-xs text-gray-600">Mã GV: {participant.teacher_code}</p>
                          {participant.teacher_email && (
                            <p className="text-xs text-gray-600">Email: {participant.teacher_email}</p>
                          )}
                          {'teacher_center' in participant && participant.teacher_center && (
                            <p className="text-xs text-gray-600">Cơ sở: {participant.teacher_center}</p>
                          )}
                          {'status' in participant && (
                            <p className="text-xs text-gray-600">Trạng thái: {participant.status}</p>
                          )}
                        </div>
                        {'status' in participant ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {participant.status}
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                            Đã xác nhận
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showLectureRegisterModal && selectedLectureEvent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Đăng ký lịch duyệt giảng</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {selectedLectureEvent.title} • {formatEventTimeRange(selectedLectureEvent.startAt, selectedLectureEvent.endAt)}
                </p>
              </div>
              <button
                onClick={() => setShowLectureRegisterModal(false)}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-4">
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                <p>
                  Reviewer: <span className="font-semibold">{selectedLectureEvent.lectureReviewer || 'Chưa gán reviewer'}</span>
                </p>
                {selectedLectureEvent.centerName && (
                  <p className="mt-1">Cơ sở: <span className="font-semibold">{selectedLectureEvent.centerName}</span></p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                  <input
                    type="text"
                    value={teacherQuery}
                    onChange={(event) => setTeacherQuery(event.target.value)}
                    placeholder="Tìm theo tên giáo viên hoặc LMS code"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => loadTeachersForLectureReview(teacherQuery)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    Tìm giáo viên
                  </button>
                </div>

                <select
                  value={selectedTeacherCode}
                  onChange={(event) => setSelectedTeacherCode(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">-- Chọn giáo viên --</option>
                  {teacherResults.map((teacher) => (
                    <option key={teacher.teacher_code} value={teacher.teacher_code}>
                      {teacher.teacher_name} ({teacher.lms_code}){teacher.center ? ` - ${teacher.center}` : ""}
                    </option>
                  ))}
                </select>

                {teachersLoading && (
                  <p className="text-xs text-blue-700">Đang tải danh sách giáo viên...</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmitLectureRegistration}
                    disabled={registeringLectureReview}
                    className="inline-flex items-center gap-1 rounded-md bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" /> {registeringLectureReview ? "Đang đăng ký..." : "Xác nhận đăng ký"}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 text-sm font-semibold text-gray-800">Danh sách đã đăng ký</div>
                {lectureRegistrationsLoading ? (
                  <p className="text-sm text-gray-500">Đang tải danh sách đăng ký...</p>
                ) : lectureRegistrations.length === 0 ? (
                  <p className="text-sm text-gray-500">Chưa có đăng ký nào.</p>
                ) : (
                  <div className="space-y-2">
                    {lectureRegistrations.map((registration, index) => (
                      <div key={registration.id} className="rounded-md border border-gray-200 p-2 text-sm">
                        <p className="font-semibold text-gray-900">
                          {index + 1}. {registration.teacher_name || registration.teacher_code}
                        </p>
                        <p className="text-xs text-gray-600">LMS: {registration.teacher_code}</p>
                        {registration.teacher_center && (
                          <p className="text-xs text-gray-600">Cơ sở: {registration.teacher_center}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Trạng thái: {registration.status}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
