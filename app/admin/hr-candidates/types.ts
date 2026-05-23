// ─── Row từ database hr_candidates ───────────────────────────────────────────
export interface HrCandidateRow {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  region_code: '1' | '2' | '3' | '4' | '5' | '';
  desired_campus: string;
  work_block: string;
  subject_code: string;
  gen_id: number | null;
  gen_name: string;       // join từ hr_gen_catalog
  status: 'new' | 'in_training' | 'passed' | 'failed' | 'dropped';
  source: 'manual' | 'csv';
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface HrSummary {
  total: number;
  assigned: number;
  unassigned: number;
  byGen: Record<string, number>;
  byRegion: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface HrPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GenEntry {
  key: string;
  genCode: string;
  count: number;
  regionCode: string;
  regionLabel: string;
  isTeacher4Plus: boolean;
  note: string;
}
