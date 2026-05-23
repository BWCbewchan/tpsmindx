export type ExamType = "expertise" | "experience";
export type BlockCode = "CODING" | "ROBOTICS" | "ART" | "PROCESS" | `PROCESS-${string}`;
export type LevelTag = "B" | "A" | "I";

export interface ExamSetRecord {
  id: number;
  subject_id: number;
  subject_key?: string | null;
  set_code: string;
  set_name: string;
  question_count?: number;
  total_points: number;
  passing_score: number | null;
  min_questions_required?: number;
  scoring_mode?: string;
  random_weight?: number;
  setup_note?: string | null;
  status: "active" | "inactive";
  valid_from: string | null;
  valid_to: string | null;
  archived_at?: string | null;
  exam_type: ExamType;
  block_code: string;
  subject_code: string;
  subject_name: string;
}

export interface SubjectConfig {
  id: string;
  subjectKey: string;
  examType: ExamType;
  blockCode: BlockCode;
  label: string;
  matchKeys: string[];
  durationMinutes?: number;
  levelTags?: LevelTag[];
}

export interface ExamSubjectRecord {
  id: number;
  exam_type: ExamType;
  block_code: BlockCode;
  subject_code: string;
  subject_name: string;
  subject_key?: string | null;
  duration_minutes?: number | null;
  set_selection_mode?: 'default' | 'random';
  default_set_id?: number | null;
  default_set_code?: string | null;
  default_set_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const inferLevel = (set: ExamSetRecord): { label: string; className: string } => {
  const fullText = `${set.set_code} ${set.set_name}`.toLowerCase();

  if (fullText.includes("-b-") || fullText.includes("basic")) {
    return { label: "Basic", className: "bg-green-100 text-green-700" };
  }

  if (fullText.includes("-a-") || fullText.includes("advanced")) {
    return { label: "Advanced", className: "bg-blue-100 text-blue-700" };
  }

  if (fullText.includes("-i-") || fullText.includes("intensive")) {
    return { label: "Intensive", className: "bg-rose-100 text-rose-700" };
  }

  return { label: "Set", className: "bg-gray-100 text-gray-700" };
};

export const getSetsBySubject = (sets: ExamSetRecord[], subject: SubjectConfig) => {
  return sets
    .filter((set) => {
      if (set.exam_type !== subject.examType) return false;

      const subjectKey = normalize(set.subject_key || "");
      if (subjectKey && subjectKey === normalize(subject.subjectKey)) {
        return true;
      }

      const setCodeNormalized = normalize(set.subject_code || "");
      const setNameNormalized = normalize(set.subject_name || "");

      return subject.matchKeys.some((key) => {
        const normalizedKey = normalize(key);
        return (
          setCodeNormalized.includes(normalizedKey) ||
          setNameNormalized.includes(normalizedKey) ||
          normalizedKey.includes(setCodeNormalized)
        );
      });
    })
    .sort((a, b) => a.set_code.localeCompare(b.set_code));
};

const normalizeSubjectKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const mapSubjectRecordToConfig = (record: ExamSubjectRecord): SubjectConfig => {
  const subjectKey = record.subject_key?.trim()
    ? normalizeSubjectKey(record.subject_key)
    : normalizeSubjectKey(record.subject_code || record.subject_name || String(record.id));

  const apiDuration = Number(record.duration_minutes);
  const metadataDuration = Number((record.metadata as { duration_minutes?: number } | null)?.duration_minutes);
  const durationMinutes = Number.isFinite(apiDuration) && apiDuration > 0
    ? apiDuration
    : Number.isFinite(metadataDuration) && metadataDuration > 0
      ? metadataDuration
    : record.exam_type === 'experience'
      ? 60
      : 120;

  const lowerCode = (record.subject_code || '').toLowerCase();
  const levelTags: LevelTag[] | undefined =
    record.block_code === 'ROBOTICS' || record.block_code === 'ART'
      ? ['B', 'A', 'I']
      : undefined;

  return {
    id: String(record.id),
    subjectKey,
    examType: record.exam_type,
    blockCode: record.block_code,
    label: record.subject_name || record.subject_code,
    matchKeys: [record.subject_code, record.subject_name].filter(Boolean),
    durationMinutes,
    levelTags: lowerCode.includes('lego') || lowerCode.includes('vex') || record.block_code === 'ART'
      ? levelTags
      : undefined,
  };
};
