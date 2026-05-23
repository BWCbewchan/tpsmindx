"use client";

import { Card } from "@/components/Card";
import { Modal } from "@/components/ui/modal";
import { PageContainer } from "@/components/PageContainer";
import { SkeletonCard } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import { Bot, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Code2, GripVertical, Palette, PlusCircle, Settings2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/app-toast";
import {
  BlockCode,
  ExamSetRecord,
  ExamSubjectRecord,
  SubjectConfig,
  getSetsBySubject,
  inferLevel,
  mapSubjectRecordToConfig,
} from "./subject-mapping";

interface EvaluationEvent {
  id: string;
  title: string;
  specialty: string;
  startAt: string;
  endAt: string;
  registrationTemplate?: "official" | "supplement" | null;
  metadata?: Record<string, any>;
  eventType?: "registration" | "exam" | "workshop_teaching" | "meeting" | "advanced_training_release" | "holiday";
}

interface PlannedEvent {
  id: string;
  subjectId: string;
  label: string;
  eventKind: "exam" | "registration";
  durationMinutes: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  registrationTemplate: "official" | "supplement";
  flowRound: number;
  selectedSetId: number | null;
  isGeneratedSupplement?: boolean;
  sourceEventId?: string | null;
}

interface MonthlyDefaultSelection {
  setId: number;
  setCode: string;
  setName: string;
  selectionMode: "manual" | "random";
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const REGISTRATION_EVENT_LABELS = {
  official: "Đăng ký kiểm tra chuyên sâu chính thức",
  supplement: "Đăng ký kiểm tra chuyên sâu bổ sung",
} as const;

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

function addMinutesToTime(timeStr: string, minsToAdd: number) {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = h * 60 + m + minsToAdd;
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function splitTime(timeStr: string) {
  const [hourRaw, minuteRaw] = timeStr.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return {
    hour: Number.isNaN(hour) ? "00" : String(Math.min(23, Math.max(0, hour))).padStart(2, "0"),
    minute: Number.isNaN(minute) ? "00" : String(Math.min(59, Math.max(0, minute))).padStart(2, "0"),
  };
}

function normalizeTime(value: string, fallback = "00:00") {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return splitTime(fallback);
  }

  return {
    hour: String(Math.min(23, Math.max(0, hour))).padStart(2, "0"),
    minute: String(Math.min(59, Math.max(0, minute))).padStart(2, "0"),
  };
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const MAX_EVENTS_PER_DAY_IN_CELL = 3;

function formatDateKey(date: Date) {
  const pad = (v: number) => v.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) return null;
  return { year, month, day };
}

function toIsoUtcFromLocal(dateKey: string, timeStr: string) {
  const parsedDate = parseDateKey(dateKey);
  const [hourText, minuteText] = timeStr.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!parsedDate || Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const date = new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (value: number) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHour = Math.floor(absoluteOffset / 60);
  const offsetMinute = absoluteOffset % 60;

  // Keep local wall-clock time with explicit offset to avoid day-shift across services.
  return `${parsedDate.year}-${pad(parsedDate.month)}-${pad(parsedDate.day)}T${pad(hour)}:${pad(minute)}:00${sign}${pad(offsetHour)}:${pad(offsetMinute)}`;
}

function getSubjectDurationMinutes(subjectId: string) {
  if (subjectId.startsWith('registration-')) return 24 * 60 - 1;
  return 120;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function generateMonthlyDateKeys(startDateKey: string, endDateKey: string) {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  if (!start || !end) return [];

  const startDate = new Date(start.year, start.month - 1, start.day);
  const endDate = new Date(end.year, end.month - 1, end.day);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return [];
  }

  const result: string[] = [];
  const targetDay = start.day;
  let cursorYear = start.year;
  let cursorMonth = start.month;

  while (true) {
    const day = Math.min(targetDay, daysInMonth(cursorYear, cursorMonth));
    const current = new Date(cursorYear, cursorMonth - 1, day);
    if (current > endDate) break;

    result.push(formatDateKey(current));

    cursorMonth += 1;
    if (cursorMonth > 12) {
      cursorMonth = 1;
      cursorYear += 1;
    }
  }

  return result;
}

function buildCalendarCells(focusDate: Date) {
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

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, select, button, textarea, label"));
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const mapSpecialtyToSubjectLabel = (specialty: string) => {
  const normalized = normalizeText(specialty);

  if (normalized.includes("scratch")) return "[COD] Scratch (S)";
  if (normalized.includes("gamemaker")) return "[COD] GameMaker (G)";
  if (normalized.includes("python")) return "[COD] Python (PT)";
  if (normalized.includes("web")) return "[COD] Web (JS)";
  if (normalized.includes("computerscience") || normalized.includes("cs")) return "[COD] Computer Science (CS)";
  if (normalized.includes("lego")) return "[ROB] Lego 4+";
  if (normalized.includes("vexgo")) return "[ROB] Vex Go";
  if (normalized.includes("vexiq")) return "[ROB] Vex IQ";
  if (normalized.includes("quytrinh") || normalized.includes("trainghiem")) return "Kiểm tra quy trình & kỹ năng trải nghiệm";
  if (normalized.includes("art") || normalized.includes("mythuat") || normalized.includes("dohoa")) return "[ART] Arts";

  return specialty;
};

interface BlockConfig {
  blockCode: BlockCode;
  label: string;
  description: string;
  icon: typeof Code2;
  iconWrapClass: string;
  iconClass: string;
  columnsClass: string;
}

const BLOCK_CONFIGS: BlockConfig[] = [
  {
    blockCode: "CODING",
    label: "Coding",
    description: "Danh sách bộ đề theo môn và cấp độ",
    icon: Code2,
    iconWrapClass: "bg-violet-100",
    iconClass: "text-violet-600",
    columnsClass: "grid-cols-1 md:grid-cols-3",
  },
  {
    blockCode: "ROBOTICS",
    label: "Robotics",
    description: "Danh sách bộ đề lắp ráp và lập trình robot",
    icon: Bot,
    iconWrapClass: "bg-orange-100",
    iconClass: "text-orange-600",
    columnsClass: "grid-cols-1 md:grid-cols-3",
  },
  {
    blockCode: "ART",
    label: "Art",
    description: "Danh sách bộ đề mỹ thuật và đồ họa",
    icon: Palette,
    iconWrapClass: "bg-pink-100",
    iconClass: "text-pink-600",
    columnsClass: "grid-cols-1 md:grid-cols-3",
  },
  {
    blockCode: "PROCESS",
    label: "KIỂM TRA QUY TRÌNH & KỸ NĂNG TRẢI NGHIỆM",
    description: "Đánh giá các kỹ năng mềm và quy trình làm việc",
    icon: CheckCircle2,
    iconWrapClass: "bg-green-100",
    iconClass: "text-green-600",
    columnsClass: "grid-cols-1 md:grid-cols-3",
  },
];

const buildProcessSubjectName = (customName: string) => {
  const clean = customName.trim();
  return `Kiểm tra quy trình - Kỹ năng trải nghiệm [${clean || "Art"}]`;
};

const buildProcessBlockCode = (customName: string): BlockCode => {
  const normalized = customName
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `PROCESS-${normalized || "CUSTOM"}` as BlockCode;
};


export default function ProfessionalAssignmentLibraryPage() {
  const [subjectConfigs, setSubjectConfigs] = useState<SubjectConfig[]>([]);
  const [sets, setSets] = useState<ExamSetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateSubjectModalOpen, setIsCreateSubjectModalOpen] = useState(false);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectBlockCode, setNewSubjectBlockCode] = useState<BlockCode>("CODING");
  const [newProcessCustomName, setNewProcessCustomName] = useState("");
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [newSubjectDurationMinutes, setNewSubjectDurationMinutes] = useState(120);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedBlockCode, setSelectedBlockCode] = useState<BlockCode>("CODING");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [setName, setSetName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [scheduleEvents, setScheduleEvents] = useState<EvaluationEvent[]>([]);

  const [isAutoCreateModalOpen, setIsAutoCreateModalOpen] = useState(false);
  const [isPreparingAutoCreateModal, setIsPreparingAutoCreateModal] = useState(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [isPlannedEventsViewerOpen, setIsPlannedEventsViewerOpen] = useState(false);
  
  const [autoStartDate, setAutoStartDate] = useState(() => {
    const start = new Date();
    start.setDate(1);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  });
  const [autoEndDate, setAutoEndDate] = useState(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + 1, 0);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  });
  const [autoStartTime, setAutoStartTime] = useState("19:00");
  const [isDurationSettingsOpen, setIsDurationSettingsOpen] = useState(false);
  const [isSavingDurationSettings, setIsSavingDurationSettings] = useState(false);
  const [durationFocusSubjectId, setDurationFocusSubjectId] = useState<string | null>(null);
  const [isDeletingSubject, setIsDeletingSubject] = useState(false);
  const [deleteSubjectConfirm, setDeleteSubjectConfirm] = useState(false);
  const [subjectDurations, setSubjectDurations] = useState<Record<string, number>>({});

  const [plannedEvents, setPlannedEvents] = useState<PlannedEvent[]>([]);
  const [monthlyDefaultBySubjectId, setMonthlyDefaultBySubjectId] = useState<Record<string, MonthlyDefaultSelection>>({});
  const [history, setHistory] = useState<PlannedEvent[][]>([]);
  const [future, setFuture] = useState<PlannedEvent[][]>([]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const dragOverDateKeyRef = useRef<string | null>(null);
  const dragOverRafRef = useRef<number | null>(null);
  const pendingDragOverDateKeyRef = useRef<string | null>(null);
  const [selectedCalendarEventIds, setSelectedCalendarEventIds] = useState<string[]>([]);
  const [leftPanelTab, setLeftPanelTab] = useState<"both" | "setup" | "queue">("both");
  const [leftTopSectionHeight, setLeftTopSectionHeight] = useState(320);
  const [isLeftPanelResizing, setIsLeftPanelResizing] = useState(false);
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const leftTopSectionRef = useRef<HTMLDivElement | null>(null);
  const leftDividerRef = useRef<HTMLDivElement | null>(null);
  const liveLeftTopSectionHeightRef = useRef(320);
  const resizeGrabOffsetYRef = useRef(0);
  const autoCreatePrepareTokenRef = useRef(0);
  const [focusDate, setFocusDate] = useState(new Date());

  const examDurationConfigSubjects = useMemo(() => {
    return subjectConfigs.filter((s) => s.examType === "expertise" || s.examType === "experience");
  }, [subjectConfigs]);

  const durationSubjectsForModal = useMemo(() => {
    if (!durationFocusSubjectId) return examDurationConfigSubjects;
    return examDurationConfigSubjects.filter((subject) => subject.id === durationFocusSubjectId);
  }, [examDurationConfigSubjects, durationFocusSubjectId]);

  const getEffectiveDurationMinutes = (subjectId: string) => {
    const subject = subjectConfigs.find((item) => item.id === subjectId);
    return subjectDurations[subjectId] ?? subject?.durationMinutes ?? getSubjectDurationMinutes(subjectId);
  };

  const openDurationSettings = (subjectId?: string) => {
    setDurationFocusSubjectId(subjectId || null);
    setIsDurationSettingsOpen(true);
  };

  const closeDurationSettings = () => {
    setIsDurationSettingsOpen(false);
    setDurationFocusSubjectId(null);
    setDeleteSubjectConfirm(false);
  };

  const setDragOverDateKeyThrottled = useCallback((nextKey: string | null) => {
    pendingDragOverDateKeyRef.current = nextKey;
    if (dragOverRafRef.current !== null) return;

    dragOverRafRef.current = window.requestAnimationFrame(() => {
      dragOverRafRef.current = null;
      const next = pendingDragOverDateKeyRef.current;
      if (dragOverDateKeyRef.current === next) return;
      dragOverDateKeyRef.current = next;
      setDragOverDateKey(next);
    });
  }, []);

  const commitPlannedEvents = (nextState: PlannedEvent[]) => {
    setHistory((prev) => [...prev, plannedEvents]);
    setFuture([]);
    setPlannedEvents(nextState);
  };

  const createRegistrationPlannedEvent = (
    template: "official" | "supplement",
    flowRound = 0
  ): PlannedEvent => {
    const baseLabel = REGISTRATION_EVENT_LABELS[template];
    return {
      id: `registration-${template}-${crypto.randomUUID()}`,
      subjectId: `registration-${template}-${flowRound || "official"}`,
      label: template === "supplement" ? `${baseLabel} #${flowRound}` : baseLabel,
      eventKind: "registration",
      durationMinutes: 24 * 60 - 1,
      startDate: autoStartDate,
      endDate: autoEndDate,
      startTime: "00:00",
      endTime: "23:59",
      registrationTemplate: template,
      flowRound,
      selectedSetId: null,
      isGeneratedSupplement: template === "supplement",
    };
  };

  const toggleOfficialRegistrationEvent = (enabled: boolean) => {
    const hasOfficial = plannedEvents.some(
      (event) => event.eventKind === "registration" && event.registrationTemplate === "official"
    );

    if (enabled && !hasOfficial) {
      commitPlannedEvents([createRegistrationPlannedEvent("official"), ...plannedEvents]);
      return;
    }

    if (!enabled && hasOfficial) {
      commitPlannedEvents(
        plannedEvents.filter(
          (event) => !(event.eventKind === "registration" && event.registrationTemplate === "official")
        )
      );
    }
  };

  const addSupplementRegistrationEvent = () => {
    const supplementCount = plannedEvents.filter(
      (event) => event.eventKind === "registration" && event.registrationTemplate === "supplement"
    ).length;
    const nextRound = supplementCount + 1;

    const baseOfficialExams = plannedEvents
      .filter((event) => event.eventKind === "exam" && event.flowRound === 0)
      .map((event) => ({
        ...event,
        id: `${event.subjectId}-supplement-${nextRound}-${crypto.randomUUID()}`,
        label: `${event.label} (Bổ sung #${nextRound})`,
        registrationTemplate: "supplement" as const,
        flowRound: nextRound,
        isGeneratedSupplement: true,
      }));

    if (baseOfficialExams.length === 0) {
      toast.error("Không có môn kiểm tra luồng chính thức để tạo đợt bổ sung.");
      return;
    }

    const next = [
      ...plannedEvents,
      createRegistrationPlannedEvent("supplement", nextRound),
      ...baseOfficialExams,
    ];

    commitPlannedEvents(next);
  };

  const removePlannedEvent = (eventId: string) => {
    const target = plannedEvents.find((event) => event.id === eventId);
    if (!target) return;

    if (target.eventKind === "registration" && target.registrationTemplate === "supplement") {
      commitPlannedEvents(
        plannedEvents.filter(
          (event) =>
            !(
              event.registrationTemplate === "supplement" &&
              event.flowRound === target.flowRound
            )
        )
      );
      return;
    }

    commitPlannedEvents(plannedEvents.filter((event) => event.id !== eventId));
  };

  const loadMonthlyDefaultsForAutoCreate = async (dateKey?: string) => {
    const parsed = dateKey ? parseDateKey(dateKey) : null;
    const fallbackNow = new Date();
    const year = parsed?.year ?? fallbackNow.getFullYear();
    const month = parsed?.month ?? (fallbackNow.getMonth() + 1);

    const subjectSelections = await Promise.all(
      subjectConfigs
        .filter((s) => s.examType === "expertise" || s.examType === "experience")
        .map(async (subjectConfig) => {
          const matchedSets = getSetsBySubject(sets, subjectConfig);
          const candidateSubjectDbIds = Array.from(
            new Set(
              matchedSets
                .map((set) => Number(set.subject_id))
                .filter((subjectId) => Number.isFinite(subjectId) && subjectId > 0)
            )
          );

          if (candidateSubjectDbIds.length === 0) {
            return null;
          }

          const candidateSelections = await Promise.all(
            candidateSubjectDbIds.map(async (subjectDbId) => {
              const response = await fetch(
                `/api/chuyensau-chonde-thang?subject_id=${subjectDbId}&year=${year}&month=${month}`
              );
              const data = await response.json();

              if (!response.ok || !data?.success || !data?.data?.set_id) {
                return null;
              }

              const questionCount = Number(data.data.question_count || 0);
              if (questionCount <= 0) {
                return null;
              }

              return {
                setId: Number(data.data.set_id),
                setCode: String(data.data.set_code || ""),
                setName: String(data.data.set_name || ""),
                selectionMode: (data.data.selection_mode || "manual") as "manual" | "random",
              } satisfies MonthlyDefaultSelection;
            })
          );

          const activeSetOptions = activeSetsBySubjectId.get(subjectConfig.id) || [];
          const chosenSelection = candidateSelections.find((selection) => {
            if (!selection) return false;
            return activeSetOptions.some((set) => Number(set.id) === selection.setId);
          });

          if (!chosenSelection) {
            return null;
          }

          return {
            subjectId: subjectConfig.id,
            selection: chosenSelection,
          };
        })
    );

    const next: Record<string, MonthlyDefaultSelection> = {};
    subjectSelections.forEach((item) => {
      if (!item) return;

      next[item.subjectId] = item.selection;
    });

    setMonthlyDefaultBySubjectId(next);
    return next;
  };

  const handleCloseAutoCreateModal = () => {
    autoCreatePrepareTokenRef.current += 1;
    setIsPreparingAutoCreateModal(false);
    setIsAutoCreateModalOpen(false);
  };

  const handleOpenAutoCreateModal = async () => {
    const prepareToken = autoCreatePrepareTokenRef.current + 1;
    autoCreatePrepareTokenRef.current = prepareToken;

    const openDate = new Date();
    const startDateForCreate = formatDateKey(openDate);
    const endOfOpenMonth = new Date(openDate.getFullYear(), openDate.getMonth() + 1, 0);
    const endDateForCreate = formatDateKey(endOfOpenMonth);

    setAutoStartDate(startDateForCreate);
    setAutoEndDate(endDateForCreate);
    setFocusDate(openDate);

    setIsAutoCreateModalOpen(true);
    setIsPreparingAutoCreateModal(true);
    setHistory([]);
    setFuture([]);
    setPlannedEvents([]);
    setLeftPanelTab("both");
    setLeftTopSectionHeight(320);

    try {
      if (sets.length === 0) {
        await fetchSets();
      }

      const latestScheduleEvents = await fetchScheduleEvents();

      if (autoCreatePrepareTokenRef.current !== prepareToken) return;

      const monthlyDefaults = await loadMonthlyDefaultsForAutoCreate(startDateForCreate);
      if (autoCreatePrepareTokenRef.current !== prepareToken) return;

      const existingMonthlyTemplates = (() => {
        const toDateKey = (value: string) => {
          const parsed = new Date(value);
          if (Number.isNaN(parsed.getTime())) return "";
          return formatDateKey(parsed);
        };

        const toTimeKey = (value: string) => {
          const parsed = new Date(value);
          if (Number.isNaN(parsed.getTime())) return "00:00";
          return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
        };

        const inRange = (dateKey: string) => dateKey >= startDateForCreate && dateKey <= endDateForCreate;

        const registrationMap = new Map<string, PlannedEvent>();
        const examMap = new Map<string, PlannedEvent>();

        latestScheduleEvents
          .filter((event) => (event.eventType || "exam") === "registration")
          .forEach((event) => {
            const metadata = event.metadata || {};
            const occurrenceDate = String(metadata.occurrence_date || toDateKey(event.startAt));
            if (!occurrenceDate || !inRange(occurrenceDate)) return;

            const registrationTemplate =
              (event.registrationTemplate || metadata.registration_template || "official") as "official" | "supplement";
            const flowRound = Number(metadata.flow_round || 0);
            const key = `${registrationTemplate}-${flowRound}`;

            if (registrationMap.has(key)) return;

            const label =
              registrationTemplate === "supplement"
                ? `${REGISTRATION_EVENT_LABELS.supplement} #${Math.max(1, flowRound)}`
                : REGISTRATION_EVENT_LABELS.official;

            registrationMap.set(key, {
              id: `existing-registration-${key}`,
              subjectId: `registration-${registrationTemplate}-${flowRound || "official"}`,
              label,
              eventKind: "registration",
              durationMinutes: 24 * 60 - 1,
              startDate: startDateForCreate,
              endDate: endDateForCreate,
              startTime: toTimeKey(event.startAt),
              endTime: toTimeKey(event.endAt),
              registrationTemplate,
              flowRound,
              selectedSetId: null,
              isGeneratedSupplement: registrationTemplate === "supplement",
              sourceEventId: event.id,
            });
          });

        latestScheduleEvents
          .filter((event) => (event.eventType || "exam") === "exam")
          .forEach((event) => {
            const metadata = event.metadata || {};
            const occurrenceDate = String(metadata.occurrence_date || toDateKey(event.startAt));
            if (!occurrenceDate || !inRange(occurrenceDate)) return;

            // Khớp môn học qua specialty (chuyen_nganh) vì DB không lưu metadata.subject_id
            const subjectConfig = subjectConfigs.find(
              (subject) => event.specialty && subject.label === event.specialty
            );
            if (!subjectConfig) return;

            const registrationTemplate =
              (event.registrationTemplate || metadata.registration_template || "official") as "official" | "supplement";
            const flowRound = Number(metadata.flow_round || 0);
            const key = `${subjectConfig.id}-${registrationTemplate}-${flowRound}`;

            if (examMap.has(key)) return;

            const durationMinutes = getEffectiveDurationMinutes(subjectConfig.id);
            // Ưu tiên: set được chọn thủ công → set mặc định tháng → set đầu tiên có câu hỏi
            const firstValidSetId = (activeSetsBySubjectId.get(subjectConfig.id) || [])
              .find(set => Number(set.question_count) > 0)?.id ?? null;
            const selectedSetId = Number(metadata.selected_set_id || monthlyDefaults[subjectConfig.id]?.setId || firstValidSetId || 0) || null;

            examMap.set(key, {
              id: `existing-exam-${key}`,
              subjectId: subjectConfig.id,
              label: subjectConfig.label,
              eventKind: "exam",
              durationMinutes,
              startDate: startDateForCreate,
              endDate: endDateForCreate,
              startTime: toTimeKey(event.startAt),
              endTime: toTimeKey(event.endAt),
              registrationTemplate,
              flowRound,
              selectedSetId,
              isGeneratedSupplement: registrationTemplate === "supplement",
              sourceEventId: event.id,
            });
          });

        if (registrationMap.size === 0 && examMap.size === 0) return [] as PlannedEvent[];

        return [...registrationMap.values(), ...examMap.values()].sort((a, b) => {
          if (a.eventKind !== b.eventKind) return a.eventKind === "registration" ? -1 : 1;
          if (a.flowRound !== b.flowRound) return a.flowRound - b.flowRound;
          return a.label.localeCompare(b.label);
        });
      })();

      if (existingMonthlyTemplates.length > 0) {
        // Merge: giữ lịch cũ + thêm các môn chưa có lịch
        const existingSubjectIds = new Set(
          existingMonthlyTemplates
            .filter(e => e.eventKind === "exam")
            .map(e => e.subjectId)
        );

        const allExamSubjects = subjectConfigs.filter(
          s => s.examType === "expertise" || s.examType === "experience"
        );

        const missingSubjects = allExamSubjects.filter(s => !existingSubjectIds.has(s.id));

        const missingEvents: PlannedEvent[] = missingSubjects.map(s => ({
          id: s.id,
          subjectId: s.id,
          label: s.label,
          eventKind: "exam" as const,
          durationMinutes: getEffectiveDurationMinutes(s.id),
          startDate: startDateForCreate,
          endDate: endDateForCreate,
          startTime: "19:00",
          endTime: addMinutesToTime("19:00", getEffectiveDurationMinutes(s.id)),
          registrationTemplate: "official" as const,
          flowRound: 0,
          selectedSetId: monthlyDefaults[s.id]?.setId
            ?? (activeSetsBySubjectId.get(s.id) || []).find(set => Number(set.question_count) > 0)?.id
            ?? null,
          isGeneratedSupplement: false,
          sourceEventId: null,
        }));

        setPlannedEvents([...existingMonthlyTemplates, ...missingEvents]);
        toast.success(
          missingEvents.length > 0
            ? `Đã nạp lịch tháng cũ + thêm ${missingEvents.length} môn mới`
            : "Đã nạp lịch tháng cũ từ event_schedules để bạn chỉnh sửa"
        );
        return;
      }

      // Tất cả môn expertise/experience đều được phép đặt lịch
      const eligibleExamSubjects = subjectConfigs.filter(
        s => s.examType === "expertise" || s.examType === "experience"
      );

      if (eligibleExamSubjects.length === 0) {
        toast.error("Không có môn nào trong hệ thống. Vui lòng thêm môn học trước.");
        setPlannedEvents([]);
        return;
      }

      const registrationEvent = {
        ...createRegistrationPlannedEvent("official"),
        startDate: startDateForCreate,
        endDate: endDateForCreate,
      };

      setPlannedEvents(
        [
          registrationEvent,
          ...eligibleExamSubjects.map((s) => ({
            id: s.id,
            subjectId: s.id,
            label: s.label,
            eventKind: "exam" as const,
            durationMinutes: getEffectiveDurationMinutes(s.id),
            startDate: startDateForCreate,
            endDate: endDateForCreate,
            startTime: "19:00",
            endTime: addMinutesToTime("19:00", getEffectiveDurationMinutes(s.id)),
            registrationTemplate: "official" as const,
            flowRound: 0,
            selectedSetId: monthlyDefaults[s.id]?.setId
              ?? (activeSetsBySubjectId.get(s.id) || []).find(set => Number(set.question_count) > 0)?.id
              ?? null,
            isGeneratedSupplement: false,
            sourceEventId: null,
          })),
        ]
      );
    } finally {
      if (autoCreatePrepareTokenRef.current === prepareToken) {
        setIsPreparingAutoCreateModal(false);
      }
    }
  };

  const handleChangeSubjectDuration = (subjectId: string, value: number) => {
    setSubjectDurations((prev) => ({
      ...prev,
      [subjectId]: Math.max(1, value || 1),
    }));
  };

  const handleResetSubjectDurations = () => {
    if (durationFocusSubjectId) {
      const defaultMinutes = getSubjectDurationMinutes(durationFocusSubjectId);
      setSubjectDurations((prev) => ({
        ...prev,
        [durationFocusSubjectId]: defaultMinutes,
      }));
      return;
    }

    const next: Record<string, number> = {};
    examDurationConfigSubjects.forEach((s) => {
      next[s.id] = s.durationMinutes ?? 120;
    });
    setSubjectDurations(next);
  };

  const handleDeleteSubject = async () => {
    if (!durationFocusSubjectId) return;
    setIsDeletingSubject(true);
    try {
      const res = await fetch(`/api/exam-subjects?id=${durationFocusSubjectId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Xóa thất bại');
      closeDurationSettings();
      setDeleteSubjectConfirm(false);
      await fetchSubjects();
    } catch (err: any) {
      alert('Lỗi khi xóa môn: ' + err.message);
    } finally {
      setIsDeletingSubject(false);
    }
  };

  const applyDurationSettingsToPlannedEvents = async () => {
    try {
      setIsSavingDurationSettings(true);

      const subjectsToPersist = durationSubjectsForModal.filter((subject) => {
        const duration = subjectDurations[subject.id] ?? subject.durationMinutes ?? getSubjectDurationMinutes(subject.id);
        return Number.isFinite(duration) && duration > 0;
      });

      if (subjectsToPersist.length > 0) {
        const persistResults = await Promise.all(
          subjectsToPersist.map(async (subject) => {
            const duration = Math.max(
              1,
              Math.floor(subjectDurations[subject.id] ?? subject.durationMinutes ?? getSubjectDurationMinutes(subject.id))
            );

            const response = await fetch('/api/exam-subjects', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: Number(subject.id),
                duration_minutes: duration,
              }),
            });

            const data = await response.json();
            if (!response.ok || !data?.success) {
              throw new Error(data?.error || `Không thể cập nhật thời lượng môn ${subject.label}`);
            }
          })
        );

        if (persistResults.length) {
          await fetchSubjects();
        }
      }

      const next = plannedEvents.map((evt) => {
        if (evt.eventKind !== "exam") return evt;
        const durationMinutes = getEffectiveDurationMinutes(evt.subjectId);
        return {
          ...evt,
          durationMinutes,
          endTime: addMinutesToTime(evt.startTime, durationMinutes),
        };
      });

      commitPlannedEvents(next);
      closeDurationSettings();
      toast.success("Đã lưu thời lượng theo bộ môn và áp dụng lịch");
    } catch (error: any) {
      console.error('Error applying subject durations:', error);
      toast.error(error?.message || 'Không thể lưu thời lượng bộ môn');
    } finally {
      setIsSavingDurationSettings(false);
    }
  };

  const groupedByBlock = useMemo(() => {
    return BLOCK_CONFIGS.map((block) => {
      const subjects = subjectConfigs.filter((subject) => {
        if (block.blockCode === "PROCESS") {
          return subject.blockCode === "PROCESS" || subject.blockCode.startsWith("PROCESS-");
        }
        return subject.blockCode === block.blockCode;
      }).map((subject) => {
        const subjectSets = getSetsBySubject(sets, subject);

        return {
          ...subject,
          sets: subjectSets,
        };
      });

      return {
        ...block,
        subjects,
      };
    });
  }, [sets, subjectConfigs]);

  const calendarCells = useMemo(() => buildCalendarCells(focusDate), [focusDate]);

  const plannedEventsByDate = useMemo(() => {
    const byDate = new Map<string, PlannedEvent[]>();
    plannedEvents.forEach((event) => {
      if (!event.startDate) return;
      const existing = byDate.get(event.startDate) || [];
      existing.push(event);
      byDate.set(event.startDate, existing);
    });
    return byDate;
  }, [plannedEvents]);

  const blockOptions = useMemo(() => {
    const blockMap = new Map<BlockCode, string>();
    subjectConfigs.filter((item) => item.examType === "expertise").forEach((item) => {
      if (!blockMap.has(item.blockCode)) {
        blockMap.set(item.blockCode, item.blockCode);
      }
    });

    return [
      { value: "CODING" as BlockCode, label: "Coding" },
      { value: "ROBOTICS" as BlockCode, label: "Robotics" },
      { value: "ART" as BlockCode, label: "Art" },
      { value: "PROCESS" as BlockCode, label: "Quy trình & trải nghiệm" },
    ].filter((item) => blockMap.has(item.value));
  }, [subjectConfigs]);

  const subjectOptions = useMemo(() => {
    return subjectConfigs.filter(
      (subject) => subject.examType === "expertise" && subject.blockCode === selectedBlockCode
    );
  }, [subjectConfigs, selectedBlockCode]);

  const selectedSubject = useMemo(() => {
    return subjectOptions.find((subject) => subject.id === selectedSubjectId) || subjectOptions[0];
  }, [subjectOptions, selectedSubjectId]);

  const activeSetsBySubjectId = useMemo(() => {
    const map = new Map<string, ExamSetRecord[]>();

    subjectConfigs.forEach((subject) => {
      const subjectSets = getSetsBySubject(sets, subject).filter((set) => set.status === "active");
      map.set(subject.id, subjectSets);
    });

    return map;
  }, [sets, subjectConfigs]);

  const fetchSubjects = async () => {
    try {
      const response = await fetch('/api/exam-subjects');
      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error(data.error || 'Không thể tải danh sách bộ môn');
        setSubjectConfigs([]);
        return;
      }

      const mapped = ((data.data || []) as ExamSubjectRecord[]).map(mapSubjectRecordToConfig);
      setSubjectConfigs(mapped);
      setSubjectDurations((previous) => {
        const next: Record<string, number> = {};
        mapped.forEach((subject) => {
          next[subject.id] = previous[subject.id] ?? subject.durationMinutes ?? 120;
        });
        return next;
      });
    } catch (error) {
      console.error('Error fetching exam subjects:', error);
      toast.error('Có lỗi xảy ra khi tải danh sách bộ môn');
      setSubjectConfigs([]);
    }
  };

  useEffect(() => {
    if (sets.length === 0) return;

    let cancelled = false;
    const dateKey = formatDateKey(new Date());

    (async () => {
      try {
        const defaults = await loadMonthlyDefaultsForAutoCreate(dateKey);
        if (cancelled) return;
        setMonthlyDefaultBySubjectId(defaults);
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading monthly defaults for subject cards:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sets, activeSetsBySubjectId]);

  useEffect(() => {
    if (!isAutoCreateModalOpen || sets.length === 0) return;

    setPlannedEvents((prev) =>
      prev.map((event) => {
        if (event.eventKind === "registration") {
          if (event.selectedSetId === null) return event;
          return { ...event, selectedSetId: null };
        }

        const monthlyDefault = monthlyDefaultBySubjectId[event.subjectId];
        if (monthlyDefault) {
          if (event.selectedSetId === monthlyDefault.setId) return event;
          return { ...event, selectedSetId: monthlyDefault.setId };
        }

        const options = activeSetsBySubjectId.get(event.subjectId) || [];
        if (options.length === 0) {
          if (event.selectedSetId === null) return event;
          return { ...event, selectedSetId: null };
        }

        const hasCurrent = options.some((set) => Number(set.id) === event.selectedSetId);
        if (hasCurrent) return event;
        return { ...event, selectedSetId: Number(options[0].id) };
      })
    );
  }, [isAutoCreateModalOpen, sets, activeSetsBySubjectId, monthlyDefaultBySubjectId]);

  const fetchSets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/exam-sets');
      const data = await response.json();
      if (data.success) {
        setSets(data.data || []);
      } else {
        toast.error(data.error || 'Không thể tải danh sách bộ đề');
      }
    } catch (error) {
      console.error('Error fetching exam sets:', error);
      toast.error('Có lỗi xảy ra khi tải danh sách bộ đề');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
    fetchSets();
  }, []);

  const fetchScheduleEvents = async () => {
    try {
      const response = await fetch('/api/event-schedules');
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể tải lịch sự kiện');
      }

      const rows = (data.data || []) as Array<{
        id: string;
        title: string;
        specialty: string | null;
        start_at: string;
        end_at: string;
        registration_template?: "official" | "supplement" | null;
        metadata?: Record<string, any>;
        event_type: EvaluationEvent['eventType'];
      }>;

      const mapped = rows.map((item) => ({
        id: item.id,
        title: item.title,
        specialty: item.specialty || item.title,
        startAt: item.start_at,
        endAt: item.end_at,
        registrationTemplate: item.registration_template || null,
        metadata: item.metadata || {},
        eventType: item.event_type,
      }));

      setScheduleEvents(mapped);
      return mapped;
    } catch {
      setScheduleEvents([]);
      return [] as EvaluationEvent[];
    }
  };

  useEffect(() => {
    fetchScheduleEvents();
  }, []);

  const upcomingSubjectsInMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const examEvents = scheduleEvents
      .filter((event) => (event.eventType || "exam") === "exam")
      .map((event) => ({
        ...event,
        startDate: new Date(event.startAt),
        endDate: new Date(event.endAt),
      }))
      .filter((event) => !Number.isNaN(event.startDate.getTime()) && !Number.isNaN(event.endDate.getTime()))
      .filter((event) => event.startDate >= monthStart && event.startDate <= monthEnd)
      .filter((event) => event.endDate >= now);

    const map = new Map<string, { startAt: Date; endAt: Date }>();
    examEvents.forEach((event) => {
      const subjectLabel = mapSpecialtyToSubjectLabel(event.specialty);
      const existing = map.get(subjectLabel);
      if (!existing || event.startDate < existing.startAt) {
        map.set(subjectLabel, {
          startAt: event.startDate,
          endAt: event.endDate,
        });
      }
    });

    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        startAt: value.startAt,
        endAt: value.endAt,
        isOpenNow: now >= value.startAt && now <= value.endAt,
      }))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [scheduleEvents]);

  useEffect(() => {
    if (!subjectOptions.some((subject) => subject.id === selectedSubjectId)) {
      setSelectedSubjectId(subjectOptions[0]?.id || "");
    }
  }, [selectedBlockCode, subjectOptions, selectedSubjectId]);

  useEffect(() => {
    if (subjectConfigs.length === 0) return;
    if (!subjectConfigs.some((subject) => subject.blockCode === selectedBlockCode)) {
      setSelectedBlockCode(subjectConfigs[0].blockCode);
    }
  }, [subjectConfigs, selectedBlockCode]);

  const resetCreateForm = () => {
    const firstSubject = subjectConfigs.find((subject) => subject.examType === 'expertise');
    setSelectedBlockCode(firstSubject?.blockCode || "CODING");
    setSelectedSubjectId(firstSubject?.id || "");
    setSetName("");
    setStatus("active");
  };

  const handleOpenCreateModal = () => {
    resetCreateForm();
    setIsCreateModalOpen(true);
  };

  const handleOpenCreateSubjectModal = (blockCode?: BlockCode) => {
    const nextBlock = blockCode || selectedBlockCode || "CODING";
    setNewSubjectBlockCode(nextBlock);
    if (nextBlock === "PROCESS") {
      setNewProcessCustomName("");
      setNewSubjectName(buildProcessSubjectName(""));
    } else {
      setNewSubjectName(nextBlock === "ART" ? "[ART] Chuyên Sâu" : "");
    }
    setIsSubjectDropdownOpen(false);
    setNewSubjectDurationMinutes(nextBlock.startsWith("PROCESS") ? 60 : 120);
    setIsCreateSubjectModalOpen(true);
  };

  const handleCreateSubject = async (event: React.FormEvent) => {
    event.preventDefault();

    const finalSubjectName = newSubjectBlockCode === "PROCESS"
      ? buildProcessSubjectName(newProcessCustomName)
      : newSubjectName.trim();
    const finalBlockCode = newSubjectBlockCode === "PROCESS"
      ? buildProcessBlockCode(newProcessCustomName)
      : newSubjectBlockCode;

    if (newSubjectBlockCode === "PROCESS") {
      if (!newProcessCustomName.trim()) {
        toast.error("Vui lòng nhập tên môn cho Quy trình & Kỹ năng trải nghiệm");
        return;
      }
    }

    if (!finalSubjectName) {
      toast.error("Vui lòng nhập tên môn");
      return;
    }

    if (!Number.isFinite(newSubjectDurationMinutes) || newSubjectDurationMinutes <= 0) {
      toast.error("Vui lòng nhập thời lượng hợp lệ");
      return;
    }

    try {
      setIsCreatingSubject(true);
      const response = await fetch('/api/exam-subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_code: finalBlockCode,
          subject_name: finalSubjectName,
          duration_minutes: Math.max(1, Math.floor(newSubjectDurationMinutes)),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        toast.error(data?.error || 'Không thể tạo môn học');
        return;
      }

      toast.success('Đã tạo môn học mới');
      setIsCreateSubjectModalOpen(false);
      setNewSubjectName('');
      setNewProcessCustomName('');
      setNewSubjectDurationMinutes(newSubjectBlockCode.startsWith("PROCESS") ? 60 : 120);
      if (newSubjectBlockCode !== "PROCESS") {
        setSelectedBlockCode(newSubjectBlockCode);
      }
      await fetchSubjects();
    } catch (error) {
      console.error('Error creating subject:', error);
      toast.error('Có lỗi xảy ra khi tạo môn học');
    } finally {
      setIsCreatingSubject(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    // Some browsers only start/propagate HTML5 drag smoothly when payload is set.
    e.dataTransfer.setData("text/plain", id);
  };

  const isPlannedEventScheduled = (event: PlannedEvent) => {
    return Boolean(event.startDate && event.endDate);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverDateKeyThrottled(null);
  };

  const handleCalendarEventClick = (eventId: string, additive: boolean) => {
    setSelectedCalendarEventIds((prev) => {
      if (!additive) {
        return [eventId];
      }

      if (prev.includes(eventId)) {
        return prev.filter((id) => id !== eventId);
      }

      return [...prev, eventId];
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId || draggedId === dropId) return;

    const draggedIndex = plannedEvents.findIndex((item) => item.id === draggedId);
    const dropIndex = plannedEvents.findIndex((item) => item.id === dropId);
    if (draggedIndex === -1 || dropIndex === -1) return;

    const next = [...plannedEvents];
    const [removed] = next.splice(draggedIndex, 1);
    next.splice(dropIndex, 0, removed);
    commitPlannedEvents(next);
    setDraggedId(null);
    setDragOverDateKeyThrottled(null);
  };

  const handleRemoveZoneDragOver = (e: React.DragEvent) => {
    if (!draggedId) return;
    const draggedEvent = plannedEvents.find((item) => item.id === draggedId);
    if (!draggedEvent || !isPlannedEventScheduled(draggedEvent)) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleRemoveFromCalendarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId) return;

    const draggedEvent = plannedEvents.find((item) => item.id === draggedId);
    if (!draggedEvent || !isPlannedEventScheduled(draggedEvent)) {
      setDraggedId(null);
      return;
    }

    const next = plannedEvents.map((item) =>
      item.id === draggedId
        ? { ...item, startDate: "", endDate: "" }
        : item
    );

    commitPlannedEvents(next);
    setDraggedId(null);
    setDragOverDateKeyThrottled(null);
  };

  const handleCalendarDrop = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId) return;
    setDragOverDateKeyThrottled(null);

    const draggedEvent = plannedEvents.find((item) => item.id === draggedId);
    if (!draggedEvent) return;

    if (draggedEvent.eventKind === "registration") {
      const next = plannedEvents.map((item) =>
        item.id === draggedId
          ? { ...item, startDate: dateKey, endDate: dateKey, startTime: "00:00", endTime: "23:59" }
          : item
      );
      commitPlannedEvents(next);
      setDraggedId(null);
      return;
    }

    const durationMins = draggedEvent.durationMinutes || getEffectiveDurationMinutes(draggedEvent.subjectId);
    
    let newStart = autoStartTime;
    const existingOnDate = plannedEvents.filter(
      (p) => p.eventKind === "exam" && p.startDate === dateKey && p.endDate === dateKey && p.id !== draggedId
    );
    
    if (existingOnDate.length > 0) {
      let maxEnd = "00:00";
      existingOnDate.forEach(evt => {
        if (evt.endTime > maxEnd) maxEnd = evt.endTime;
      });
      newStart = maxEnd;
    }

    const newEnd = addMinutesToTime(newStart, durationMins);

    const next = plannedEvents.map((item) =>
      item.id === draggedId
        ? { ...item, startDate: dateKey, endDate: dateKey, startTime: newStart, endTime: newEnd }
        : item
    );
    commitPlannedEvents(next);
    setDraggedId(null);
  };

  useEffect(() => {
    return () => {
      if (dragOverRafRef.current !== null) {
        window.cancelAnimationFrame(dragOverRafRef.current);
      }
    };
  }, []);

  const updatePlannedEvent = <K extends keyof PlannedEvent>(id: string, field: K, value: PlannedEvent[K]) => {
    const next = plannedEvents.map((evt) => {
      if (evt.id !== id) return evt;

      const updated = { ...evt, [field]: value } as PlannedEvent;
      if (field === "startTime") {
        const normalized = normalizeTime(String(value), evt.startTime);
        updated.startTime = `${normalized.hour}:${normalized.minute}`;
      }
      if (updated.eventKind === "registration" && field === "registrationTemplate") {
        if (updated.registrationTemplate === "official") {
          updated.label = REGISTRATION_EVENT_LABELS.official;
          updated.flowRound = 0;
          updated.isGeneratedSupplement = false;
        } else {
          const existingSupplementCount = plannedEvents.filter(
            (event) =>
              event.eventKind === "registration" &&
              event.registrationTemplate === "supplement" &&
              event.id !== id
          ).length;
          updated.flowRound = existingSupplementCount + 1;
          updated.label = `${REGISTRATION_EVENT_LABELS.supplement} #${updated.flowRound}`;
          updated.isGeneratedSupplement = true;
        }
      }

      if (updated.eventKind === "exam" && (field === "startTime" || field === "durationMinutes")) {
        updated.endTime = addMinutesToTime(updated.startTime, updated.durationMinutes || 120);
      }
      return updated;
    });
    commitPlannedEvents(next);
  };

  const applyMasterDatesToAll = () => {
    let currentStart = autoStartTime;
    
    const next = plannedEvents.map((evt) => {
      if (evt.eventKind === "registration") {
        return {
          ...evt,
          startDate: autoStartDate,
          endDate: autoEndDate,
          startTime: "00:00",
          endTime: "23:59",
        };
      }

      const assignedStart = currentStart;
      const assignedEnd = addMinutesToTime(
        assignedStart,
        evt.durationMinutes || getEffectiveDurationMinutes(evt.subjectId)
      );
      currentStart = assignedEnd;

      return {
        ...evt,
        startDate: autoStartDate,
        endDate: autoEndDate,
        startTime: assignedStart,
        endTime: assignedEnd,
      };
    });
    commitPlannedEvents(next);
  };

  const applyMasterDatesSequentially = () => {
    if (!autoStartDate) return;
    const start = new Date(autoStartDate);
    const next = plannedEvents.map((evt, idx) => {
      const d = new Date(start);
      d.setDate(d.getDate() + idx);
      const dateKey = formatDateKey(d);

      if (evt.eventKind === "registration") {
        return {
          ...evt,
          startDate: dateKey,
          endDate: dateKey,
          startTime: "00:00",
          endTime: "23:59",
        };
      }

      return {
        ...evt,
        startDate: dateKey,
        endDate: dateKey,
        startTime: autoStartTime,
        endTime: addMinutesToTime(autoStartTime, evt.durationMinutes || getEffectiveDurationMinutes(evt.subjectId)),
      };
    });
    commitPlannedEvents(next);
  };

  useEffect(() => {
    if (!isAutoCreateModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        setHistory((prevHistory) => {
          if (prevHistory.length === 0) return prevHistory;
          const prev = prevHistory[prevHistory.length - 1];
          setFuture((prevFuture) => [plannedEvents, ...prevFuture]);
          setPlannedEvents(prev);
          return prevHistory.slice(0, -1);
        });
      }

      // Ctrl + Y or Ctrl + Shift + Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        setFuture((prevFuture) => {
          if (prevFuture.length === 0) return prevFuture;
          const next = prevFuture[0];
          setHistory((prevHistory) => [...prevHistory, plannedEvents]);
          setPlannedEvents(next);
          return prevFuture.slice(1);
        });
      }

      // Arrow navigation
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") {
        return;
      }
      if (e.key === "ArrowLeft") {
        setFocusDate((prev) => {
          const d = new Date(prev);
          d.setMonth(d.getMonth() - 1);
          return d;
        });
      }
      if (e.key === "ArrowRight") {
        setFocusDate((prev) => {
          const d = new Date(prev);
          d.setMonth(d.getMonth() + 1);
          return d;
        });
      }

      // Ctrl + S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!isAutoCreating) {
          handleAutoCreateEvents();
        }
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedCalendarEventIds.length > 0) {
        e.preventDefault();
        const selectedSet = new Set(selectedCalendarEventIds);
        commitPlannedEvents(plannedEvents.filter((event) => !selectedSet.has(event.id)));
        setSelectedCalendarEventIds([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAutoCreateModalOpen,
    history,
    future,
    plannedEvents,
    isAutoCreating,
    selectedCalendarEventIds,
  ]);

  useEffect(() => {
    if (selectedCalendarEventIds.length === 0) return;
    const validIds = new Set(plannedEvents.map((event) => event.id));
    setSelectedCalendarEventIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [plannedEvents, selectedCalendarEventIds.length]);

  useEffect(() => {
    liveLeftTopSectionHeightRef.current = leftTopSectionHeight;
  }, [leftTopSectionHeight]);

  useEffect(() => {
    if (!isAutoCreateModalOpen || !isLeftPanelResizing) return;

    let rafId: number | null = null;
    let pendingClientY: number | null = null;

    const updatePanelHeightByClientY = (clientY: number) => {
      const host = leftPanelRef.current;
      const topPanel = leftTopSectionRef.current;
      if (!host || !topPanel) return;

      const hostRect = host.getBoundingClientRect();
      const topPanelRect = topPanel.getBoundingClientRect();
      const rawHeight = clientY - topPanelRect.top - resizeGrabOffsetYRef.current;
      const minTop = 220;
      const maxTop = Math.max(minTop, hostRect.bottom - topPanelRect.top - 220);
      const nextHeight = Math.min(maxTop, Math.max(minTop, rawHeight));
      liveLeftTopSectionHeightRef.current = nextHeight;

      topPanel.style.height = `${nextHeight}px`;
    };

    const scheduleHeightUpdate = (clientY: number) => {
      pendingClientY = clientY;
      if (rafId !== null) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (pendingClientY === null) return;
        updatePanelHeightByClientY(pendingClientY);
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      scheduleHeightUpdate(event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 0) return;
      scheduleHeightUpdate(event.touches[0].clientY);
      event.preventDefault();
    };

    const handleMouseUp = () => {
      setLeftTopSectionHeight(Math.round(liveLeftTopSectionHeightRef.current));
      setIsLeftPanelResizing(false);
    };

    const handleTouchEnd = () => {
      setLeftTopSectionHeight(Math.round(liveLeftTopSectionHeightRef.current));
      setIsLeftPanelResizing(false);
    };

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isAutoCreateModalOpen, isLeftPanelResizing]);

  const getAutoEventTitle = (label: string) => {
    if (label.toLowerCase().includes("quy trình")) {
      return "Kiểm tra quy trình - kỹ năng trải nghiệm";
    }
    return `Kiểm tra chuyên sâu ${label}`;
  };

  const parseYearMonthFromDate = (value: string) => {
    const [yearText, monthText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    return { year, month };
  };

  const handleAutoCreateEvents = async (evt?: React.FormEvent) => {
    if (evt) evt.preventDefault();

    const scheduledEvents = plannedEvents.filter(isPlannedEventScheduled);
    if (scheduledEvents.length === 0) {
      toast.error("Vui lòng kéo ít nhất 1 môn vào calendar trước khi lưu");
      return;
    }

    const missingSchedule = scheduledEvents.find(
      (p) => !p.startDate || !p.endDate || !p.startTime || !p.endTime
    );
    if (missingSchedule) {
      toast.error(`Vui lòng gán lịch đầy đủ cho môn ${missingSchedule.label}`);
      return;
    }

    if (scheduledEvents.some((p) => p.endDate < p.startDate)) {
      toast.error("Có bộ môn có ngày kết thúc trước ngày bắt đầu!");
      return;
    }

    const missingSet = scheduledEvents.find((event) => {
      if (event.eventKind !== 'exam') return false;
      const mode = monthlyDefaultBySubjectId[event.subjectId]?.selectionMode;
      if (mode === 'random') return false;
      return !event.selectedSetId;
    });
    if (missingSet) {
      toast.error(`Vui lòng chọn bộ đề cho môn ${missingSet.label}`);
      return;
    }

    try {
      setIsAutoCreating(true);
      let successCount = 0;
      const selectionUpdated = new Set<string>();
      const workingScheduleEvents = [...scheduleEvents];

      const findExistingAutoEvent = (params: {
        occurrenceDate: string;
        eventType: "registration" | "exam";
        registrationTemplate: "official" | "supplement";
        flowRound: number;
        subjectId?: number;
      }) => {
        return workingScheduleEvents.find((event) => {
          const metadata = event.metadata || {};
          if ((event.eventType || "exam") !== params.eventType) return false;
          if ((event.registrationTemplate || metadata.registration_template || "official") !== params.registrationTemplate) return false;
          if (String(metadata.occurrence_date || "") !== params.occurrenceDate) return false;
          if (Number(metadata.flow_round || 0) !== params.flowRound) return false;
          if (params.eventType === "exam" && params.subjectId) {
            return Number(metadata.subject_id || 0) === params.subjectId;
          }
          return true;
        });
      };

      const upsertEventSchedule = async (payload: Record<string, any>, matcher: Parameters<typeof findExistingAutoEvent>[0]) => {
        const existing = findExistingAutoEvent(matcher);
        const response = await fetch("/api/event-schedules", {
          method: existing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existing ? { ...payload, id: existing.id } : { ...payload, id: crypto.randomUUID() }),
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "Không thể lưu sự kiện lịch");
        }

        const saved = data?.data;
        if (saved?.id) {
          const nextEvent: EvaluationEvent = {
            id: saved.id,
            title: saved.title,
            specialty: saved.specialty || saved.title,
            startAt: saved.start_at,
            endAt: saved.end_at,
            registrationTemplate: saved.registration_template || null,
            metadata: saved.metadata || {},
            eventType: saved.event_type,
          };

          const existingIndex = workingScheduleEvents.findIndex((event) => event.id === nextEvent.id);
          if (existingIndex >= 0) {
            workingScheduleEvents[existingIndex] = nextEvent;
          } else {
            workingScheduleEvents.push(nextEvent);
          }
        }

        return data;
      };
      
      for (const planned of scheduledEvents) {
        if (planned.eventKind === "registration") {
          const monthlyDateKeys = generateMonthlyDateKeys(planned.startDate, planned.endDate);

          for (const occurrenceDate of monthlyDateKeys) {
            const startAtIso = toIsoUtcFromLocal(occurrenceDate, planned.startTime);
            const endAtIso = toIsoUtcFromLocal(occurrenceDate, planned.endTime);
            if (!startAtIso || !endAtIso) {
              throw new Error(`Thời gian không hợp lệ cho lịch đăng ký ${planned.label}`);
            }

            const createData = await upsertEventSchedule(
              {
                title: planned.label,
                event_type: "registration",
                specialty: "Lịch đăng ký kiểm tra",
                registration_template: planned.registrationTemplate,
                start_at: startAtIso,
                end_at: endAtIso,
                note: "Lịch đăng ký kiểm tra tạo tự động theo tháng",
                metadata: {
                  recurrence: "monthly",
                  range_start_date: planned.startDate,
                  range_end_date: planned.endDate,
                  occurrence_date: occurrenceDate,
                  auto_created_from: planned.id,
                  flow_round: planned.flowRound,
                  registration_template: planned.registrationTemplate,
                  subject_list: plannedEvents
                    .filter(
                      (event) =>
                        event.eventKind === "exam" &&
                        event.registrationTemplate === planned.registrationTemplate &&
                        event.flowRound === planned.flowRound
                    )
                    .map((event) => event.label),
                },
              },
              {
                occurrenceDate,
                eventType: "registration",
                registrationTemplate: planned.registrationTemplate,
                flowRound: planned.flowRound,
              }
            );

            if (createData?.success) {
              successCount++;
            }
          }

          continue;
        }

        const plannedSet = sets.find((set) => Number(set.id) === planned.selectedSetId);
        const subjectDbIdFromSet = Number(plannedSet?.subject_id || 0);
        const fallbackSubjectDbId = Number(
          monthlyDefaultBySubjectId[planned.subjectId]?.setId
            ? sets.find((set) => Number(set.id) === monthlyDefaultBySubjectId[planned.subjectId]?.setId)?.subject_id
            : 0
        );
        // Fallback cuối: lấy subject_id từ bất kỳ set active có câu hỏi nào của môn này
        const autoFallbackSet = (activeSetsBySubjectId.get(planned.subjectId) || [])
          .find(set => Number(set.question_count) > 0);
        const subjectDbId = subjectDbIdFromSet || fallbackSubjectDbId || Number(autoFallbackSet?.subject_id || 0);
        if (!subjectDbId) {
          throw new Error(`Khong tim thay subject_id cho mon ${planned.label}`);
        }

        const monthlyDateKeys = generateMonthlyDateKeys(planned.startDate, planned.endDate);

        for (const occurrenceDate of monthlyDateKeys) {
          const startAtIso = toIsoUtcFromLocal(occurrenceDate, planned.startTime);
          if (!startAtIso) {
            throw new Error(`Thời gian không hợp lệ cho môn ${planned.label}`);
          }
          // Tính endAt từ startAt + durationMinutes (tránh lỗi midnight-crossing khi % 24)
          const durationMins = planned.durationMinutes || getEffectiveDurationMinutes(planned.subjectId) || 120;
          const endAtIso = new Date(new Date(startAtIso).getTime() + durationMins * 60_000).toISOString();

          const { year, month } = parseYearMonthFromDate(occurrenceDate);
          const selectionKey = `${subjectDbId}-${year}-${month}`;
          const isRandomMode = monthlyDefaultBySubjectId[planned.subjectId]?.selectionMode === 'random';
          // Nếu không có selectedSetId được chọn, tự động dùng set đầu tiên có câu hỏi của môn
          let selectedSet: typeof plannedSet = plannedSet
            ?? (activeSetsBySubjectId.get(planned.subjectId) || []).find(set => Number(set.question_count) > 0);

          if (!selectionUpdated.has(selectionKey)) {
            const selectionResponse = await fetch('/api/chuyensau-chonde-thang', {
              method: isRandomMode ? 'PATCH' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(
                isRandomMode
                  ? {
                      subject_id: subjectDbId,
                      year,
                      month,
                    }
                  : {
                      subject_id: subjectDbId,
                      selected_set_id: selectedSet?.id,
                      year,
                      month,
                      note: `Auto set from schedule ${planned.startDate} -> ${planned.endDate}`,
                    }
              ),
            });

            const selectionData = await selectionResponse.json();
            if (!selectionResponse.ok || !selectionData?.success) {
              throw new Error(selectionData?.error || `Không thể chọn bộ đề cho ${planned.label}`);
            }

            if (isRandomMode) {
              const pickedId = Number(selectionData?.picked?.id || selectionData?.data?.selected_set_id || 0);
              const pickedSet = sets.find((set) => Number(set.id) === pickedId);
              if (!pickedSet) {
                throw new Error(`Khong tim thay bo de duoc random cho mon ${planned.label}`);
              }
              selectedSet = pickedSet;
            }

            selectionUpdated.add(selectionKey);
          } else if (isRandomMode) {
            const latestSelectionResponse = await fetch(
              `/api/chuyensau-chonde-thang?subject_id=${subjectDbId}&year=${year}&month=${month}`
            );
            const latestSelectionData = await latestSelectionResponse.json();
            if (!latestSelectionResponse.ok || !latestSelectionData?.success || !latestSelectionData?.data?.set_id) {
              throw new Error(`Khong the lay bo de random hien tai cho mon ${planned.label}`);
            }
            const pickedId = Number(latestSelectionData.data.set_id);
            const pickedSet = sets.find((set) => Number(set.id) === pickedId);
            if (!pickedSet) {
              throw new Error(`Khong tim thay bo de random (${pickedId}) cho mon ${planned.label}`);
            }
            selectedSet = pickedSet;
          }

          if (!selectedSet) {
            throw new Error(`Khong tim thay bo de hop le cho mon ${planned.label}`);
          }

          const createData = await upsertEventSchedule(
            {
              title: getAutoEventTitle(planned.label),
              event_type: "exam",
              specialty: planned.label,
              registration_template: planned.registrationTemplate,
              start_at: startAtIso,
              end_at: endAtIso,
              note: "Lịch kiểm tra tạo tự động theo tháng",
              metadata: {
                recurrence: "monthly",
                range_start_date: planned.startDate,
                range_end_date: planned.endDate,
                occurrence_date: occurrenceDate,
                flow_round: planned.flowRound,
                registration_template: planned.registrationTemplate,
                subject_id: selectedSet.subject_id,
                selected_set_id: selectedSet.id,
                selected_set_code: selectedSet.set_code,
                selected_set_name: selectedSet.set_name,
                selection_mode: isRandomMode ? 'random' : 'default',
                duration_minutes: planned.durationMinutes,
              },
            },
            {
              occurrenceDate,
              eventType: "exam",
              registrationTemplate: planned.registrationTemplate,
              flowRound: planned.flowRound,
              subjectId: Number(selectedSet.subject_id),
            }
          );

          if (createData?.success) {
            successCount++;
          }
        }
      }
      
      toast.success(`Khởi tạo thành công ${successCount} sự kiện kiểm tra.`);
      setIsAutoCreateModalOpen(false);
      await fetchScheduleEvents();
    } catch (error) {
      console.error("Error auto creating events:", error);
      toast.error("Có lỗi xảy ra khi tạo sự kiện tự động");
    } finally {
      setIsAutoCreating(false);
    }
  };

  const handleCreateSet = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedSubject) {
      toast.error("Vui lòng chọn môn");
      return;
    }

    if (!setName.trim()) {
      toast.error("Vui lòng nhập ghi chú bộ đề");
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch("/api/exam-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_type: selectedSubject.examType,
          block_code: selectedSubject.blockCode,
          subject_key: selectedSubject.subjectKey,
          subject_code: selectedSubject.label,
          subject_name: selectedSubject.label,
          set_name: setName.trim(),
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || "Không thể tạo bộ đề");
        return;
      }

      toast.success("Tạo bộ đề thành công");
      setIsCreateModalOpen(false);
      await fetchSets();
    } catch (error) {
      console.error("Error creating exam set:", error);
      toast.error("Có lỗi xảy ra khi tạo bộ đề");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <PageContainer
      title="Bộ đề đánh giá chuyên môn"
    >
      <div className="mb-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleOpenAutoCreateModal}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <CalendarDays className="h-4 w-4" />
          Tạo sự kiện tự động
        </button>
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo đề kiểm tra chuyên môn
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-700" />
            <p className="text-sm font-semibold text-blue-900">Bộ môn mở sắp tới trong tháng</p>
          </div>
          <button
            type="button"
            onClick={() => openDurationSettings()}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Cấu hình tất cả
          </button>
        </div>
        {upcomingSubjectsInMonth.length === 0 ? (
          <p className="text-xs text-blue-800/80">Chưa có lịch mở bộ môn nào trong tháng hiện tại.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {upcomingSubjectsInMonth.map((item) => (
              <span
                key={`${item.label}-${item.startAt.toISOString()}`}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                  item.isOpenNow
                    ? "border-green-300 bg-green-50 text-green-800"
                    : "border-blue-200 bg-white text-blue-800"
                )}
                title={`Mở từ ${item.startAt.toLocaleString("vi-VN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })} đến ${item.endAt.toLocaleString("vi-VN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}`}
              >
                {item.isOpenNow && <span className="mr-1 font-semibold">Đang mở •</span>}
                {item.label} • {item.startAt.toLocaleDateString("vi-VN")} • {item.startAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })} - {item.endAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] font-medium text-blue-900/80">
          Chuẩn lưu thời gian: ISO 8601 (UTC). Giao diện hiển thị theo múi giờ máy của bạn (24h).
        </p>
      </div>

      <div className="space-y-4">
        {groupedByBlock.map((group) => {
          const Icon = group.icon;

          return (
            <Card key={group.blockCode} className="rounded-xl" padding="md">
              <div className="mb-4 flex items-start gap-3">
                <div className={cn("rounded-lg p-2", group.iconWrapClass)}>
                  <Icon className={cn("h-5 w-5", group.iconClass)} />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{group.label}</h2>
                  <p className="text-sm text-gray-500">{group.description}</p>
                </div>
              </div>

              <div className={cn("grid gap-3", group.columnsClass)}>
                {group.subjects.map((subject) => (
                  <div key={`${group.blockCode}-${subject.id}`} className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openDurationSettings(subject.id);
                      }}
                      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white/95 px-2 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
                      title="Chỉnh cấu hình thời gian bộ môn"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Cấu hình
                    </button>

                    <Link
                      href={`/admin/thu-vien-de/subjects/${subject.id}`}
                      className={cn(
                        "block rounded-lg border border-gray-200 bg-gray-50 p-3 pr-24 transition-colors",
                        "h-45 overflow-hidden hover:border-red-200 hover:bg-red-50/40"
                      )}
                    >
                      <p className="text-sm font-semibold text-gray-900 hover:text-red-700">
                        {subject.label}
                      </p>
                      {subject.sets.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500">{subject.sets.length} bộ đề</p>
                      )}

                      {monthlyDefaultBySubjectId[subject.id] ? (
                        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">
                          Đề tháng đang áp dụng ({monthlyDefaultBySubjectId[subject.id].selectionMode === "random" ? "ngẫu nhiên" : "mặc định"}): Mã đề {monthlyDefaultBySubjectId[subject.id].setCode}{monthlyDefaultBySubjectId[subject.id].setName ? ` • Ghi chú: ${monthlyDefaultBySubjectId[subject.id].setName}` : ""}
                        </div>
                      ) : (
                        <div className="mt-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600">
                          Đề tháng đang áp dụng: chưa chọn
                        </div>
                      )}

                      {subject.sets.length === 0 ? (
                        <p className="mt-1 text-xs text-gray-500">Chưa có bộ đề.</p>
                      ) : (
                        <>
                          <div className="mt-2 space-y-1.5">
                            {subject.sets.slice(0, 3).map((set) => {
                              const level = inferLevel(set);

                              return (
                                <div key={set.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", level.className)}>
                                        {level.label}
                                      </span>
                                      <span className="truncate text-xs text-gray-700">{set.set_code}</span>
                                    </div>
                                    {set.set_name ? (
                                      <p className="truncate text-[11px] text-gray-500">Ghi chú: {set.set_name}</p>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                            {subject.sets.length > 3 && (
                              <p className="text-[11px] text-gray-500">+ {subject.sets.length - 3} bộ đề khác</p>
                            )}
                          </div>
                        </>
                      )}
                    </Link>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => handleOpenCreateSubjectModal(group.blockCode)}
                  className={cn(
                    "block rounded-lg border border-dashed border-red-200 bg-red-50/40 p-3 text-left transition-colors",
                    "h-30 overflow-hidden hover:border-red-300 hover:bg-red-100/50"
                  )}
                >
                  <p className="text-sm font-semibold text-red-700">+ Thêm môn</p>
                  <div className="mt-2 rounded-md border border-red-200 bg-white px-2 py-1.5 text-[11px] text-gray-600">
                    Nhập tên môn và tạo nhanh
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Bấm để tạo môn mới trong khối này.</p>
                </button>
              </div>

              {group.blockCode === "ART" && (
                <p className="mt-3 text-xs text-gray-500">* Mỗi môn tạo gồm 3 cấp độ (Basic, Advanced, Intensive).</p>
              )}
            </Card>
          );
        })}
      </div>

      {loading && (
        <div className="mt-4 text-sm text-gray-500">Đang tải danh sách bộ đề...</div>
      )}

      <Modal
        isOpen={isCreateSubjectModalOpen}
        onClose={() => setIsCreateSubjectModalOpen(false)}
        title="Thêm môn mới"
        subtitle="Nhập tên môn để tạo thẻ môn học mới"
        maxWidth="md"
        headerColor="from-[#7f1d1d] to-[#b91c1c]"
        overflowContent="visible"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Tạo trong khối: <span className="font-semibold text-gray-800">{BLOCK_CONFIGS.find((block) => block.blockCode === newSubjectBlockCode)?.label || newSubjectBlockCode}</span>
          </div>

          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">Tên môn</label>
            {newSubjectBlockCode === "CODING" ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSubjectDropdownOpen((v) => !v)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-left flex items-center justify-between bg-white"
                >
                  <span className={newSubjectName ? "text-gray-900" : "text-gray-400"}>
                    {newSubjectName || "-- Chọn môn --"}
                  </span>
                  <svg className={`h-4 w-4 text-gray-500 transition-transform ${isSubjectDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isSubjectDropdownOpen && (
                  <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-y-auto" style={{ maxHeight: '112px' }}>
                    {["-- Chọn môn --", "[COD] Scratch", "[COD] GameMaker", "[COD] App Producer", "[COD] Web", "[COD] Computer Science"].map((opt) => (
                      <li
                        key={opt}
                        onClick={() => { setNewSubjectName(opt === "-- Chọn môn --" ? "" : opt); setIsSubjectDropdownOpen(false); }}
                        className={`cursor-pointer px-3 py-2 text-sm hover:bg-violet-50 hover:text-violet-700 ${
                          (newSubjectName === opt || (opt === "-- Chọn môn --" && !newSubjectName)) ? "bg-violet-50 font-medium text-violet-700" : "text-gray-700"
                        }`}
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : newSubjectBlockCode === "ROBOTICS" ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSubjectDropdownOpen((v) => !v)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-left flex items-center justify-between bg-white"
                >
                  <span className={newSubjectName ? "text-gray-900" : "text-gray-400"}>
                    {newSubjectName || "-- Chọn môn --"}
                  </span>
                  <svg className={`h-4 w-4 text-gray-500 transition-transform ${isSubjectDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isSubjectDropdownOpen && (
                  <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-y-auto" style={{ maxHeight: '112px' }}>
                    {["-- Chọn môn --", "[ROB] Vex GO", "[ROB] Vex IQ"].map((opt) => (
                      <li
                        key={opt}
                        onClick={() => { setNewSubjectName(opt === "-- Chọn môn --" ? "" : opt); setIsSubjectDropdownOpen(false); }}
                        className={`cursor-pointer px-3 py-2 text-sm hover:bg-orange-50 hover:text-orange-700 ${
                          (newSubjectName === opt || (opt === "-- Chọn môn --" && !newSubjectName)) ? "bg-orange-50 font-medium text-orange-700" : "text-gray-700"
                        }`}
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : newSubjectBlockCode === "ART" ? (
              <input
                value={newSubjectName || "[ART] Chuyên Sâu"}
                onChange={(e) => setNewSubjectName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                readOnly
              />
            ) : newSubjectBlockCode === "PROCESS" ? (
              <div className="space-y-2">
                <input
                  value={newProcessCustomName}
                  onChange={(e) => {
                    setNewProcessCustomName(e.target.value);
                    setNewSubjectName(buildProcessSubjectName(e.target.value));
                  }}
                  placeholder="Tên môn học mới."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />

                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Tên môn học mới: <span className="font-semibold">{buildProcessSubjectName(newProcessCustomName)}</span>
                  <br />
                </div>
              </div>
            ) : (
              <input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Ví dụ: [COD] JavaScript Nâng cao"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Thời lượng (phút)</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={newSubjectDurationMinutes}
              onChange={(e) => setNewSubjectDurationMinutes(Math.max(1, Number(e.target.value || 1)))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateSubjectModalOpen(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCreatingSubject}
              className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              <PlusCircle className="h-4 w-4" />
              {isCreatingSubject ? "Đang tạo..." : "Tạo môn"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo đề kiểm tra chuyên môn"
        subtitle="Tạo trực tiếp trong Library, không chuyển trang"
        maxWidth="md"
        headerColor="from-[#a1001f] to-[#c41230]"
      >
        <form onSubmit={handleCreateSet} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Khối</label>
            <select
              value={selectedBlockCode}
              onChange={(e) => setSelectedBlockCode(e.target.value as BlockCode)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {blockOptions.map((block) => (
                <option key={block.value} value={block.value}>
                  {block.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Môn</label>
            <select
              value={selectedSubject?.id || ""}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ghi chú bộ đề</label>
            <input
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="Ví dụ: Dùng cho tháng 04/2026"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              <PlusCircle className="h-4 w-4" />
              {isCreating ? "Đang tạo..." : "Tạo đề"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isAutoCreateModalOpen}
        onClose={handleCloseAutoCreateModal}
        title="Khởi tạo lịch kiểm tra hằng tháng (Visual Calendar)"
        subtitle="Kéo các môn học từ danh sách bên trái và thả vào Lịch để gán ngày kiểm tra."
        maxWidth="6xl"
        headerColor="from-[#1e3a8a] to-[#2563eb]"
      >
        {isPreparingAutoCreateModal ? (
          <div className="flex h-[82vh] flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
              <SkeletonCard height="h-[300px]" className="w-full" />
              <SkeletonCard height="h-[420px]" className="w-full" />
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <div className="h-10 w-24 animate-pulse rounded-md bg-gray-200" />
              <div className="h-10 w-40 animate-pulse rounded-md bg-blue-200" />
            </div>
          </div>
        ) : (
        <form onSubmit={handleAutoCreateEvents} className="flex flex-col h-[82vh]">
          <div className="flex flex-1 flex-col gap-6 overflow-hidden lg:flex-row">
            <div ref={leftPanelRef} className="w-full lg:w-90 h-full min-h-0 flex flex-col border-b border-gray-200 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="font-bold text-gray-800 text-sm">Danh sách chờ lên lịch</h3>
                 <button
                   type="button"
                   onClick={() => setIsPlannedEventsViewerOpen(true)}
                   className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                 >
                   Mở xem riêng
                 </button>
              </div>

              <div className="mb-2 grid grid-cols-3 gap-1 rounded border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setLeftPanelTab("setup")}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-semibold",
                    leftPanelTab === "setup" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:bg-white"
                  )}
                >
                  Tab Trên
                </button>
                <button
                  type="button"
                  onClick={() => setLeftPanelTab("both")}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-semibold",
                    leftPanelTab === "both" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:bg-white"
                  )}
                >
                  Chia 2
                </button>
                <button
                  type="button"
                  onClick={() => setLeftPanelTab("queue")}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-semibold",
                    leftPanelTab === "queue" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:bg-white"
                  )}
                >
                  Tab Dưới
                </button>
              </div>
              
              {leftPanelTab !== "queue" && (
                <div
                  ref={leftTopSectionRef}
                  className={cn(
                    "flex flex-col",
                    leftPanelTab === "both" ? "overflow-y-auto" : "flex-1 overflow-y-auto"
                  )}
                  style={leftPanelTab === "both" ? { height: leftTopSectionHeight } : undefined}
                >
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 mb-3 rounded border border-blue-100">
                    * Kéo từ đây thả vào Lịch bên phải. Môn đứng trên cùng sẽ được tạo đầu tiên.
                  </div>

                  <div
                    onDragOver={handleRemoveZoneDragOver}
                    onDrop={handleRemoveFromCalendarDrop}
                    className={cn(
                      "mb-3 rounded border border-dashed px-3 py-2 text-xs",
                      draggedId && (() => {
                        const draggedEvent = plannedEvents.find((item) => item.id === draggedId);
                        return draggedEvent ? isPlannedEventScheduled(draggedEvent) : false;
                      })()
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-gray-300 bg-gray-50 text-gray-600"
                    )}
                  >
                    Kéo môn từ ô lịch thả vào đây để xóa khỏi calendar.
                  </div>

                  <div className="flex flex-col gap-2 p-2 mb-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex gap-2 w-full">
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] uppercase tracking-wider font-semibold text-gray-500">Từ ngày (Chung)</label>
                        <input
                          type="date"
                          value={autoStartDate}
                          onChange={(e) => setAutoStartDate(e.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] uppercase tracking-wider font-semibold text-gray-500">Đến (Chung)</label>
                        <input
                          type="date"
                          value={autoEndDate}
                          onChange={(e) => setAutoEndDate(e.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 w-full mt-2">
                      <div className="w-full">
                        <label className="mb-1 block text-[10px] uppercase tracking-wider font-semibold text-gray-500">Giờ BĐ (Chung)</label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={splitTime(autoStartTime).hour}
                            onChange={(e) => {
                              const current = normalizeTime(autoStartTime, "19:00");
                              const next = normalizeTime(`${e.target.value}:${current.minute}`, "19:00");
                              setAutoStartTime(`${next.hour}:${next.minute}`);
                            }}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            {HOUR_OPTIONS.map((hour) => (
                              <option key={hour} value={hour}>{hour}</option>
                            ))}
                          </select>
                          <select
                            value={splitTime(autoStartTime).minute}
                            onChange={(e) => {
                              const current = normalizeTime(autoStartTime, "19:00");
                              const next = normalizeTime(`${current.hour}:${e.target.value}`, "19:00");
                              setAutoStartTime(`${next.hour}:${next.minute}`);
                            }}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            {MINUTE_OPTIONS.map((minute) => (
                              <option key={minute} value={minute}>{minute}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full mt-2">
                      <button
                        type="button"
                        onClick={() => openDurationSettings()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded border border-indigo-300 bg-indigo-50 px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Cài đặt thời gian từng bộ môn
                      </button>
                    </div>
                    <div className="flex gap-2 w-full mt-2">
                      <label className="inline-flex flex-1 items-center gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={plannedEvents.some((event) => event.eventKind === "registration" && event.registrationTemplate === "official")}
                          onChange={(e) => toggleOfficialRegistrationEvent(e.target.checked)}
                        />
                        Bật đăng ký chính thức
                      </label>
                      <button
                        type="button"
                        onClick={addSupplementRegistrationEvent}
                        className="flex-1 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        + Đăng ký bổ sung
                      </button>
                    </div>
                    <div className="flex gap-2 w-full mt-2">
                      <button
                        type="button"
                        title="Gán tất cả môn chung 1 khoảng thời gian"
                        onClick={applyMasterDatesToAll}
                        className="flex-1 rounded bg-gray-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                      >
                        Cùng ngày
                      </button>
                      <button
                        type="button"
                        title="Từ ngày bắt đầu, gán tuần tự mỗi ngày 1 môn"
                        onClick={applyMasterDatesSequentially}
                        className="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Tuần tự (+1)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {leftPanelTab === "both" && (
                <div
                  ref={leftDividerRef}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    const dividerRect = leftDividerRef.current?.getBoundingClientRect();
                    resizeGrabOffsetYRef.current = dividerRect ? event.clientY - dividerRect.top : 0;
                    setIsLeftPanelResizing(true);
                  }}
                  onTouchStart={(event) => {
                    event.preventDefault();
                    const dividerRect = leftDividerRef.current?.getBoundingClientRect();
                    const touchClientY = event.touches[0]?.clientY ?? 0;
                    resizeGrabOffsetYRef.current = dividerRect ? touchClientY - dividerRect.top : 0;
                    setIsLeftPanelResizing(true);
                  }}
                  className={cn(
                    "mb-2 h-3 cursor-row-resize rounded transition-colors",
                    isLeftPanelResizing ? "bg-blue-400" : "bg-gray-200 hover:bg-blue-300"
                  )}
                  title="Kéo để tăng/giảm phần trên và dưới"
                />
              )}

              {leftPanelTab !== "setup" && (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4">
                  {plannedEvents.map((evt) => (
                    <div
                      key={evt.id}
                      draggable
                      onDragStart={(e) => {
                        if (isInteractiveTarget(e.target)) {
                          e.preventDefault();
                          return;
                        }
                        handleDragStart(e, evt.id);
                      }}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, evt.id)}
                      className={cn(
                        "flex flex-col gap-2 rounded-md border p-2 bg-white transition-colors cursor-move",
                        draggedId === evt.id ? "opacity-50 border-blue-400 shadow-sm" : "border-gray-200 hover:border-gray-300 shadow-sm"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-semibold text-sm text-gray-900 truncate" title={evt.label}>{evt.label}</span>
                        {evt.isGeneratedSupplement && (
                          <button
                            type="button"
                            onClick={() => removePlannedEvent(evt.id)}
                            className="ml-auto rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-100"
                            title="Xóa đợt bổ sung"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pl-6">
                        <select
                          value={evt.registrationTemplate}
                          onChange={(e) => updatePlannedEvent(evt.id, "registrationTemplate", e.target.value as PlannedEvent["registrationTemplate"])}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-[11px] bg-gray-50"
                        >
                          <option value="official">ĐK Chính thức</option>
                          <option value="supplement">ĐK Bổ sung</option>
                        </select>
                      </div>

                      {evt.eventKind === "exam" ? (
                        <div className="flex items-center gap-2 pl-6">
                          {monthlyDefaultBySubjectId[evt.subjectId] ? (
                            <div className="w-full rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
                              Bộ đề tháng ({monthlyDefaultBySubjectId[evt.subjectId].selectionMode === "random" ? "ngẫu nhiên" : "mặc định"}): {monthlyDefaultBySubjectId[evt.subjectId].setCode} - {monthlyDefaultBySubjectId[evt.subjectId].setName}
                            </div>
                          ) : evt.selectedSetId ? (
                            (() => {
                              const autoSet = sets.find((s) => Number(s.id) === evt.selectedSetId);
                              return autoSet ? (
                                <div className="w-full rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                                  Bộ đề tự động: {autoSet.set_code}{autoSet.set_name ? ` · ${autoSet.set_name}` : ""} ({autoSet.question_count ?? 0} câu)
                                </div>
                              ) : (
                                <div className="w-full rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                                  Môn này chưa có bộ đề hợp lệ (có câu hỏi).
                                </div>
                              );
                            })()
                          ) : (
                            <div className="w-full rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                              Môn này chưa có bộ đề tháng hợp lệ (có câu hỏi).
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pl-6 text-[11px] font-medium text-blue-700">
                          Event đăng ký, không cần chọn bộ đề.
                        </div>
                      )}

                      <div className="flex items-center gap-1 pl-6">
                        <input
                          type="date"
                          value={evt.startDate}
                          onChange={(e) => updatePlannedEvent(evt.id, "startDate", e.target.value)}
                          className="w-[45%] rounded border border-gray-300 px-1 py-1 text-[11px]"
                        />
                        <span className="text-gray-400 text-xs text-center w-[10%]">-</span>
                        <input
                          type="date"
                          value={evt.endDate}
                          onChange={(e) => updatePlannedEvent(evt.id, "endDate", e.target.value)}
                          className="w-[45%] rounded border border-gray-300 px-1 py-1 text-[11px]"
                        />
                      </div>
                      <div className="flex items-center gap-1 pl-6">
                        <div className="grid w-[45%] grid-cols-2 gap-1">
                          <input
                            type="number"
                            min={0}
                            max={23}
                            inputMode="numeric"
                            value={Number(splitTime(evt.startTime).hour)}
                            onChange={(e) => {
                              const current = splitTime(evt.startTime);
                              const normalized = normalizeTime(`${e.target.value}:${current.minute}`, evt.startTime);
                              updatePlannedEvent(evt.id, "startTime", `${normalized.hour}:${normalized.minute}`);
                            }}
                            className="w-full rounded border border-gray-300 px-1 py-1 text-center text-[11px]"
                          />
                          <input
                            type="number"
                            min={0}
                            max={59}
                            inputMode="numeric"
                            value={Number(splitTime(evt.startTime).minute)}
                            onChange={(e) => {
                              const current = splitTime(evt.startTime);
                              const normalized = normalizeTime(`${current.hour}:${e.target.value}`, evt.startTime);
                              updatePlannedEvent(evt.id, "startTime", `${normalized.hour}:${normalized.minute}`);
                            }}
                            className="w-full rounded border border-gray-300 px-1 py-1 text-center text-[11px]"
                          />
                        </div>
                        {evt.eventKind === "exam" ? (
                          <>
                            <input
                              type="number"
                              min={1}
                              value={evt.durationMinutes}
                              onChange={(e) => updatePlannedEvent(evt.id, "durationMinutes", Math.max(1, Number(e.target.value || 1)))}
                              className="w-[25%] rounded border border-gray-300 px-1 py-1 text-[11px]"
                            />
                            <span className="w-[20%] text-center text-[10px] font-medium text-gray-600">
                              phút<br />
                              KT {evt.endTime}
                            </span>
                          </>
                        ) : (
                          <span className="w-[55%] text-center text-[10px] font-medium text-gray-600">Kết thúc tự động 23:59</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col min-w-0">
               <div className="flex items-center justify-between mb-3 bg-gray-50 p-2 rounded border border-gray-200">
                  <div className="font-bold text-lg text-blue-900">
                    Tháng {focusDate.getMonth() + 1} - Năm {focusDate.getFullYear()}
                    <div className="text-[11px] font-normal text-blue-700">
                      Ctrl/Cmd + Click để chọn nhiều mục, nhấn Delete để xóa.
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                     <button
                       type="button"
                       onClick={() => {
                         const d = new Date(focusDate);
                         d.setMonth(d.getMonth() - 1);
                         setFocusDate(d);
                       }}
                       className="rounded p-1.5 hover:bg-gray-200 text-gray-700"
                     >
                        <ChevronLeft className="h-5 w-5" />
                     </button>
                     <button
                       type="button"
                       onClick={() => setFocusDate(new Date())}
                       className="rounded px-3 py-1.5 hover:bg-gray-200 text-sm font-medium text-gray-700"
                     >
                       Hôm nay
                     </button>
                     <button
                       type="button"
                       onClick={() => {
                         const d = new Date(focusDate);
                         d.setMonth(d.getMonth() + 1);
                         setFocusDate(d);
                       }}
                       className="rounded p-1.5 hover:bg-gray-200 text-gray-700"
                     >
                        <ChevronRight className="h-5 w-5" />
                     </button>
                  </div>
               </div>

               <div className="flex-1 flex flex-col bg-white border-l border-t border-gray-200">
                 <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 h-10">
                    {WEEKDAY_LABELS.map(w => (
                       <div key={w} className="border-r border-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm">
                          {w}
                       </div>
                    ))}
                 </div>
                  <div className="grid grid-cols-7 flex-1 min-h-0">
                    {calendarCells.map((cell, idx) => {
                       const cellKey = formatDateKey(cell.date);
                      const eventsOnDay = plannedEventsByDate.get(cellKey) || [];
                      const visibleEvents = eventsOnDay.slice(0, MAX_EVENTS_PER_DAY_IN_CELL);
                      const hiddenEventsCount = Math.max(0, eventsOnDay.length - visibleEvents.length);
                       const isToday = isSameDate(startOfDay(cell.date), startOfDay(new Date()));
                       
                       return (
                          <div
                            key={idx}
                            onDragEnter={() => {
                              if (draggedId) {
                                setDragOverDateKeyThrottled(cellKey);
                              }
                            }}
                            onDragOver={(e) => {
                              handleDragOver(e);
                              if (draggedId) {
                                setDragOverDateKeyThrottled(cellKey);
                              }
                            }}
                            onDrop={(e) => handleCalendarDrop(e, cellKey)}
                            onClick={() => setSelectedCalendarEventIds([])}
                            className={cn(
                              "border-r border-b border-gray-200 p-1 flex flex-col gap-1 min-h-12.5 transition-colors duration-150",
                              !cell.inCurrentMonth ? "bg-gray-50/50 text-gray-400" : "bg-white",
                              "hover:bg-blue-50/30",
                              draggedId && dragOverDateKey === cellKey && "ring-2 ring-blue-400 ring-inset border-blue-300 bg-blue-50/40"
                            )}
                          >
                             <div className="w-full flex justify-end">
                                <span className={cn(
                                   "text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full",
                                   isToday ? "bg-blue-600 text-white" : "text-gray-600"
                                )}>
                                   {cell.date.getDate()}
                                </span>
                             </div>
                             
                             <div className="flex-1 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                {visibleEvents.map((evt) => (
                                   <div
                                     key={evt.id}
                                     draggable
                                     onDragStart={(e) => handleDragStart(e, evt.id)}
                                     onDragEnd={handleDragEnd}
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleCalendarEventClick(evt.id, e.ctrlKey || e.metaKey);
                                     }}
                                     title={evt.label}
                                     className={cn(
                                       "text-[10px] leading-tight px-1.5 py-1 rounded truncate border cursor-move transition-transform active:scale-95 shadow-sm",
                                       selectedCalendarEventIds.includes(evt.id) && "ring-2 ring-offset-1 ring-blue-500",
                                        evt.eventKind === "registration"
                                          ? evt.registrationTemplate === "official"
                                            ? "bg-blue-100 text-blue-800 border-blue-200"
                                            : "bg-amber-100 text-amber-800 border-amber-200"
                                          : evt.registrationTemplate === "official" 
                                            ? "bg-green-100 text-green-800 border-green-200" 
                                            : "bg-red-100 text-red-800 border-red-200"
                                     )}
                                   >
                                      {evt.label}
                                   </div>
                                ))}
                                  {hiddenEventsCount > 0 && (
                                   <div className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                                    +{hiddenEventsCount} sự kiện
                                   </div>
                                  )}
                             </div>
                          </div>
                       );
                    })}
                 </div>
               </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4 border-gray-200 shrink-0">
            <button
              type="button"
              onClick={handleCloseAutoCreateModal}
              className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isAutoCreating}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 shadow-sm"
            >
              <CalendarDays className="h-4 w-4" />
              {isAutoCreating ? "Đang xử lý..." : "Lưu lịch tự động"}
            </button>
          </div>
        </form>
        )}
      </Modal>

      <Modal
        isOpen={isPlannedEventsViewerOpen}
        onClose={() => setIsPlannedEventsViewerOpen(false)}
        title="Danh sách chờ lên lịch"
        subtitle="Xem toàn bộ event theo dạng danh sách cuộn dài"
        maxWidth="4xl"
        headerColor="from-blue-700 to-cyan-600"
      >
        <div className="max-h-[76vh] space-y-2 overflow-y-auto pr-1">
          {plannedEvents.map((evt) => (
            <div key={`viewer-${evt.id}`} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-gray-900">{evt.label}</p>
                <span className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-semibold",
                  evt.eventKind === "registration"
                    ? evt.registrationTemplate === "official"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-800"
                    : evt.registrationTemplate === "official"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                )}>
                  {evt.registrationTemplate === "official" ? "Chính thức" : `Bổ sung #${evt.flowRound}`}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                {evt.startDate} - {evt.endDate} | {evt.startTime} - {evt.endTime}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setIsPlannedEventsViewerOpen(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Đóng
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isDurationSettingsOpen}
        onClose={closeDurationSettings}
        title={durationFocusSubjectId ? "Cài đặt thời gian bộ môn" : "Cài đặt thời gian theo bộ môn"}
        subtitle="Thời gian làm bài (phút) sẽ dùng để tự tính giờ kết thúc"
        maxWidth="lg"
        headerColor="from-indigo-700 to-indigo-500"
      >
        <div className="space-y-3">
          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {durationSubjectsForModal.map((subject) => (
              <div
                key={subject.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2",
                  durationFocusSubjectId && subject.id === durationFocusSubjectId
                    ? "border-indigo-400 ring-2 ring-indigo-100"
                    : "border-gray-200"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{subject.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={subjectDurations[subject.id] ?? getSubjectDurationMinutes(subject.id)}
                    onChange={(e) => handleChangeSubjectDuration(subject.id, Number(e.target.value || 1))}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                  />
                  <span className="text-xs font-medium text-gray-600">phút</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-2 border-t border-gray-200 pt-3">
            {durationFocusSubjectId ? (
              deleteSubjectConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-medium">Xác nhận xóa môn này?</span>
                  <button
                    type="button"
                    onClick={handleDeleteSubject}
                    disabled={isDeletingSubject}
                    className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                  >
                    {isDeletingSubject ? "Đang xóa..." : "Xác nhận"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteSubjectConfirm(false)}
                    disabled={isDeletingSubject}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteSubjectConfirm(true)}
                  disabled={isSavingDurationSettings}
                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  Xóa môn
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleResetSubjectDurations}
                disabled={isSavingDurationSettings}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Khôi phục mặc định
              </button>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeDurationSettings}
                disabled={isSavingDurationSettings}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={applyDurationSettingsToPlannedEvents}
                disabled={isSavingDurationSettings}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingDurationSettings ? "Đang lưu..." : "Áp dụng"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
