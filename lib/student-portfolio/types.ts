export type PortfolioStatus = 'draft' | 'published';

export interface PortfolioSkill {
  name: string;
  level?: string;
}

export interface PortfolioScore {
  label: string;
  value: number;
}

export interface PortfolioLearningItem {
  title: string;
  code?: string;
  period?: string;
  status?: string;
  description?: string;
  cp1Score?: number | null;
  cp2Score?: number | null;
  demoScore?: number | null;
  tbckScore?: number | null;
  finalComment?: string;
  awardTitle?: string;
  awardLevel?: 'gold' | 'silver' | 'bronze' | 'merit';
}

export interface PortfolioProject {
  title: string;
  course?: string;
  classCode?: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  attachmentUrls?: string[];
  relatedUrls?: Array<{ name?: string; url: string }>;
  description?: string;
  link?: string;
  attachmentName?: string;
  featured?: boolean;
}

export interface PortfolioAward {
  title: string;
  subtitle?: string;
  date?: string;
  className?: string;
  level?: 'gold' | 'silver' | 'bronze' | 'merit';
  imageUrl?: string;
}

export interface PortfolioAcademicSummary {
  checkpoint1Score?: number | null;
  checkpoint2Score?: number | null;
  demoScore?: number | null;
  tbckScore?: number | null;
  rank?: 'A' | 'B' | 'C' | 'D' | null;
  rankLabel?: string;
  isPassed?: boolean;
  needsRetake?: boolean;
}

export interface StudentPortfolioData {
  lmsSyncedFields?: string[];
  profile: {
    studentName: string;
    slug: string;
    avatarUrl?: string;
    studentEmail?: string;
    parentName?: string;
    parentEmail?: string;
    phone?: string;
    age?: string;
    className?: string;
    classId?: string;
    studentId?: string;
    centreName?: string;
    courseLine?: string;
    courseName?: string;
    teacherName?: string;
    gpa?: string;
    headline?: string;
    intro?: string;
  };
  learningJourney: PortfolioLearningItem[];
  hardSkills: PortfolioSkill[];
  softSkills: PortfolioSkill[];
  dnaScores: PortfolioScore[];
  mindsetScores: PortfolioScore[];
  orientationScores?: PortfolioScore[];
  projects: PortfolioProject[];
  technologies: string[];
  gallery: string[];
  achievements: PortfolioAward[];
  rewards: {
    points: number;
    history: PortfolioAward[];
  };
  academicSummary?: PortfolioAcademicSummary;
  customSections: Array<{ title: string; content: string }>;
  quote: string;
  visibility: 'private' | 'public';
}

export interface StudentPortfolioRecord {
  id: string | number;
  student_lms_id: string;
  class_lms_id: string;
  student_name: string;
  class_name: string | null;
  centre_name: string | null;
  course_name: string | null;
  public_slug: string | null;
  status: PortfolioStatus;
  data: StudentPortfolioData;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentPortfolioListItem {
  id: string | number;
  student_lms_id: string;
  class_lms_id: string;
  student_name: string;
  class_name: string | null;
  centre_name: string | null;
  course_name: string | null;
  public_slug: string | null;
  status: PortfolioStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
