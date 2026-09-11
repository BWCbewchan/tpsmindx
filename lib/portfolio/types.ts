// ============================================================
// Types for Portfolio QC (Kiểm Soát Portfolio)
// ============================================================

/** Filter params for fetching classes */
export interface PortfolioQCFilter {
  centres?: string[];       // LMS centre IDs
  centreNames?: string[];   // Centre full_names (for matching)
  courses?: string[];       // Course IDs
  courseLines?: string[];    // Course line IDs
  dateFrom?: string;        // ISO date string
  dateTo?: string;          // ISO date string
  qcStatus?: string;        // 'completed' | 'partial' | 'none'
  status?: string;          // Class status
  teacherId?: string;       // LMS teacher ID
  search?: string;          // Text search
  pageIndex?: number;
  itemsPerPage?: number;
}

/** A class row in the QC list */
export interface PortfolioQCClass {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  finalSessionDate?: string | null;
  courseName: string;
  courseShortName: string;
  courseLineTag: string;     // e.g. "C4K", "XART"
  centreName: string;
  centreShortName: string;
  teacherName: string;
  totalSessions: number;    // Total number of slots
  /** Total active students in this class (activeInClass === true) */
  totalStudents: number;
  /** Active students with a representative product */
  submittedCount: number;
  /** Active students missing a product (totalStudents - submittedCount) */
  missingCount: number;
  /** Active students with approved representative product */
  approvedCount: number;
  /** Active students with rejected representative product */
  rejectedCount: number;
  /** Active students with pending/draft representative product */
  pendingCount: number;
  /** Submission ratio percentage (0–100) */
  submissionRatio: number;
  /** Approval ratio percentage (0–100) */
  approvalRatio: number;
  /** Overall class status for QC */
  qcStatus: 'completed' | 'partial' | 'none';
  /** True if class is missing Checkpoint 1 or 2 scores */
  hasMissingCheckpoint?: boolean;
}

/** Product status categories for ranking & filtering */
export type ProductStatusCategory = 'approved' | 'pending' | 'rejected' | 'draft' | 'none';

export interface StudentRepresentativeProduct {
  id?: string;
  title?: string | null;
  link?: string | null;
  status?: string | null;
  category: ProductStatusCategory;
  version?: number;
  updatedAt?: string | null;
  totalSubmissions?: number;
}

/** A student row inside the expanded class detail */
export interface PortfolioQCStudent {
  studentId: string;
  studentName: string;
  activeInClass: boolean;
  /** Whether the student has a representative product */
  hasSubmission: boolean;
  /** Which session the submission was found, or null */
  submissionSession: number | null;
  /** Submission count (1 or 0) */
  submissionCount: number;
  /** Ratio as percentage (0 or 100) */
  submissionRatio: number;
  /** Title of final product submission if available */
  submissionTitle?: string | null;
  /** URL / link of final product submission if available */
  submissionLink?: string | null;
  /** Representative product object selected by priority logic */
  representativeProduct?: StudentRepresentativeProduct | null;
  /** Portfolio status from DB */
  portfolioStatus: 'none' | 'draft' | 'published';
  /** Portfolio ID in DB if exists */
  portfolioId: string | number | null;
  /** Portfolio public slug if exists */
  portfolioSlug: string | null;
}

/** Response from the classes API */
export interface PortfolioQCClassesResponse {
  success: boolean;
  data: PortfolioQCClass[];
  pagination: {
    total: number;
    pageIndex: number;
    itemsPerPage: number;
  };
}

/** Response from the students API */
export interface PortfolioQCStudentsResponse {
  success: boolean;
  className: string;
  students: PortfolioQCStudent[];
}
