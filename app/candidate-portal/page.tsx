'use client';
import { useQueryState } from '@/lib/use-query-state'


import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Flag,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  Route,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import GenOverviewTab, { TrainingScheduleEvent } from '../admin/hr-candidates/components/GenOverviewTab';
import K12DocsClient, { K12ClientDocItem, K12ClientDocNode } from '@/components/k12-docs/K12DocsClient';
import ImageLightbox from '@/components/ImageLightbox';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { setVideo } from '@/lib/redux/features/trainingSlice';
import { useAppDispatch } from '@/lib/redux/hooks';

type CandidateSession = {
  id: number;
  center_code: string;
  observe_date: string;
  class_type: string;
  harvest_file_url: string;
  status: 'submitted' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

type CandidateProfile = {
  candidate_id: number;
  candidate_code: string;
  full_name: string;
  current_gen_id?: number | null;
  current_gen_name?: string | null;
  region_code?: string | null;
  region_name?: string | null;
  permissions?: string[];
};

function isCandidateProfile(value: unknown): value is CandidateProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<CandidateProfile>;
  return (
    Number.isInteger(Number(profile.candidate_id)) &&
    Number(profile.candidate_id) > 0 &&
    typeof profile.full_name === 'string' &&
    typeof profile.candidate_code === 'string'
  );
}

type CandidateCurrentGen = {
  id: number;
  genCode: string;
  regionCode: string;
  regionName: string;
};

type CandidateK12Docs = {
  rootTitle: string;
  tree: K12ClientDocNode[];
  documents: K12ClientDocItem[];
  defaultSlug: string;
};

type CandidateVideo = {
  id: number;
  title: string;
  video_link: string;
  thumbnail_url?: string | null;
  description?: string | null;
  duration_minutes?: number | null;
  duration_seconds?: number | null;
  lesson_number?: number | null;
  status?: string | null;
};
type CandidateTrainingStage = 'centralized_training' | 'pedagogy_training';

type CandidateTabId = 'observe' | 'videos' | 'tests' | 'schedule' | 'roadmap' | 'te-leader-info' | 'k12-teaching-policy';

type CandidateTab = {
  id: CandidateTabId;
  label: string;
  href: string;
};

type TeLeaderContact = {
  area: string;
  center: string;
  name: string;
  role: string;
  phone: string;
  email: string;
};

type TeLeaderManager = {
  area: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  centers: string[];
};

function CandidateListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-xl border border-border bg-muted p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded-full bg-background" />
                <div className="h-6 w-24 rounded-full bg-background" />
              </div>
              <div className="h-5 w-40 rounded bg-background" />
              <div className="h-4 w-56 max-w-full rounded bg-background/70" />
            </div>
            <div className="h-9 w-24 rounded-lg bg-background" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CandidateVideoGridSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: items }).map((_, index) => (
        <article key={index} className="animate-pulse overflow-hidden rounded-xl border border-border bg-muted">
          <div className="aspect-video bg-background" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-4/5 rounded bg-background" />
            <div className="h-3 w-full rounded bg-background/70" />
            <div className="h-3 w-2/3 rounded bg-background/70" />
            <div className="h-9 w-full rounded-lg bg-background" />
          </div>
        </article>
      ))}
    </div>
  );
}

function ContactCardsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section key={sectionIndex} className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-6 w-40 rounded bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 2 }).map((__, cardIndex) => (
              <div key={cardIndex} className="rounded-xl border border-border bg-background p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-3">
                    <div className="h-3 w-24 rounded bg-muted" />
                    <div className="h-5 w-36 rounded bg-muted" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-muted" />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="h-4 w-28 rounded bg-muted" />
                  <div className="h-4 w-40 rounded bg-muted" />
                </div>
                <div className="mt-4 h-24 rounded-lg bg-muted" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function K12DocsSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 h-8 w-72 max-w-full rounded bg-muted" />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3 rounded-xl border border-border p-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-4 rounded bg-muted" style={{ width: `${90 - (index % 3) * 12}%` }} />
          ))}
        </div>
        <div className="space-y-4 rounded-xl border border-border p-5">
          <div className="h-7 w-2/3 rounded bg-muted" />
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-4 rounded bg-muted" style={{ width: `${100 - (index % 4) * 10}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const CENTER_OPTIONS = [
  'MindX 71 Nguyễn Chí Thanh',
  'MindX 22C Thành Công',
  'MindX 107 Nguyễn Phong Sắc',
  'MindX 29T1 Hoàng Đạo Thúy',
  'MindX 41 Vũ Trọng Phụng',
  'MindX 102 Thái Thịnh',
  'MindX 340 Nguyễn Trãi',
  'MindX 15 Hồ Đắc Di',
  'MindX Times City',
  'MindX Long Biên',
  'MindX Hà Đông',
  'MindX Mỹ Đình',
  'MindX Cầu Giấy',
  'MindX Tây Hồ',
  'MindX Hai Bà Trưng',
  'MindX Hoàng Mai',
  'MindX 20 Nguyễn Thị Minh Khai',
  'MindX 230 Nguyễn Đình Chiểu',
  'MindX 106 Nguyễn Văn Trỗi',
  'MindX 182 Lê Đại Hành',
  'MindX 20 Cộng Hòa',
  'MindX 82 Trần Huy Liệu',
  'MindX 35 Mạc Đĩnh Chi',
  'MindX 204 Điện Biên Phủ',
  'MindX Phú Nhuận',
  'MindX Tân Bình',
  'MindX Gò Vấp',
  'MindX Bình Thạnh',
  'MindX Quận 7',
  'MindX Thủ Đức',
  'MindX Bình Tân',
  'MindX Đà Nẵng',
  'MindX Hải Phòng',
  'MindX Cần Thơ',
  'MindX Biên Hòa',
  'MindX Bình Dương',
  'MindX Vinh',
  'MindX Huế',
  'MindX Nha Trang',
  'MindX Đà Lạt',
  'MindX Buôn Ma Thuột',
  'MindX Quy Nhơn',
  'MindX Hạ Long',
  'MindX Bắc Ninh',
];

const CLASS_TYPES = ['Lớp học chính', 'Lớp học trải nghiệm'];
const HARVEST_TEMPLATE_URL = '/templates/template-thu-hoach-sau-observe.pdf';
const ROADMAP_ILLUSTRATION_URL = '/candidate-portal/dao-tao-dau-vao.svg';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getRoleBadgeConfig(role: string) {
  const r = role.toLowerCase();
  if (r.includes('tegl')) {
    return {
      label: role,
      badgeClass: 'bg-[#a1001f] text-white border-[#a1001f]',
      cardClass: 'border-[#a1001f]/30 bg-[#a1001f]/[0.02] shadow-xs ring-1 ring-[#a1001f]/10',
      isLead: true,
    };
  }
  if (r.includes('coding')) {
    return {
      label: role,
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      cardClass: 'border-gray-100 bg-white hover:border-blue-200',
      isLead: false,
    };
  }
  if (r.includes('robotic')) {
    return {
      label: role,
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      cardClass: 'border-gray-100 bg-white hover:border-purple-200',
      isLead: false,
    };
  }
  if (r.includes('art')) {
    return {
      label: role,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      cardClass: 'border-gray-100 bg-white hover:border-amber-200',
      isLead: false,
    };
  }
  if (r.includes('teacher coordinator') || r.includes('tc')) {
    return {
      label: role,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      cardClass: 'border-gray-100 bg-white hover:border-emerald-200',
      isLead: false,
    };
  }
  return {
    label: role,
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
    cardClass: 'border-gray-100 bg-white',
    isLead: false,
  };
}
const CANDIDATE_TAB_HREFS: Record<CandidateTabId, string> = {
  observe: '/candidate-portal',
  videos: '/candidate-portal/videos',
  tests: '/candidate-portal/tests',
  schedule: '/candidate-portal/schedule',
  roadmap: '/candidate-portal/roadmap',
  'te-leader-info': '/candidate-portal/te-leader-info',
  'k12-teaching-policy': '/candidate-portal/k12-teaching-policy',
};
const TE_LEADER_INFO_CSV_URL = '/candidate-portal/te-leader-info.csv';
const K12_ONSITE_TRAINING_URL = `${CANDIDATE_TAB_HREFS['k12-teaching-policy']}?doc=iv.-quy-trinh-quy-dinh-chung/teaching-roadmap/quy-trinh-quy-dinh-dao-tao-dau-vao/dao-tao-tai-co-so`;

function resolveCandidateTab(pathname: string): CandidateTabId {
  const normalizedPath = pathname.replace(/\/$/, '');
  const match = (Object.entries(CANDIDATE_TAB_HREFS) as [CandidateTabId, string][])
    .find(([, href]) => href !== '/candidate-portal' && normalizedPath === href);

  return match?.[0] || 'observe';
}

function getStatusConfig(status: CandidateSession['status']) {
  if (status === 'approved') {
    return { label: 'Đã duyệt', className: 'bg-success/10 text-success ring-success/20' };
  }
  if (status === 'rejected') {
    return { label: 'Từ chối', className: 'bg-destructive/10 text-destructive ring-destructive/20' };
  }
  return { label: 'Đã nộp', className: 'bg-warning/10 text-warning ring-warning/20' };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseTeLeaderCsv(csvText: string): TeLeaderContact[] {
  const contacts: TeLeaderContact[] = [];
  let currentArea = 'HCM';

  csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [first = '', second = '', third = '', fourth = '', fifth = ''] = parseCsvLine(line);
      if (!first && !second && !third && !fourth && !fifth) return;

      if (first.includes(' - ')) {
        currentArea = first.split(' - ')[1].trim();
        if (second) {
          contacts.push({
            area: currentArea,
            center: currentArea,
            name: second,
            role: third,
            phone: fourth,
            email: fifth,
          });
        }
        return;
      }

      if (!second || second === 'Ngưng hoạt động') return;

      contacts.push({
        area: currentArea,
        center: first,
        name: second,
        role: third,
        phone: fourth,
        email: fifth,
      });
    });

  return contacts;
}

type RoadmapStageDefinition = {
  id: string;
  phase: string;
  week: string;
  group?: string;
  title: string;
  description: string;
  owner: string;
  requirement: string;
};

const ROADMAP_STAGES = [
  {
    id: 'training-registration',
    phase: 'Giai đoạn 1',
    week: 'Tuần 1',
    group: 'Đào tạo tập trung',
    title: 'Đăng ký tham gia đào tạo',
    description: 'Điền form đăng ký xác nhận tham gia đào tạo, nhận lịch đào tạo từ HR.',
    owner: 'HR Teaching',
    requirement: 'Hoàn thành khi ứng viên đã có mặt trong danh sách ứng viên.',
  },
  {
    id: 'orientation',
    phase: 'Giai đoạn 1',
    week: 'Tuần 1',
    group: 'Đào tạo tập trung',
    title: 'Đào tạo hội nhập',
    description: 'HR tạo buổi học trên hệ thống admin; ứng viên tham gia lịch đào tạo, có điểm danh hoặc hoàn thành bài kiểm tra sẽ được tính hoàn thành.',
    owner: 'HR Teaching',
    requirement: 'Có điểm danh hoặc hoàn thành bài kiểm tra sau buổi học.',
  },
  {
    id: 'program-overview',
    phase: 'Giai đoạn 1',
    week: 'Tuần 1',
    group: 'Đào tạo tập trung',
    title: 'Đào tạo sản phẩm',
    description: 'HR tạo buổi học trên hệ thống admin; ứng viên tham gia lịch đào tạo, có điểm danh hoặc hoàn thành bài kiểm tra sẽ được tính hoàn thành.',
    owner: 'HR Teaching',
    requirement: 'Có điểm danh hoặc hoàn thành bài kiểm tra sau buổi học.',
  },
  {
    id: 'observe',
    phase: 'Giai đoạn 2',
    week: 'Tuần 2',
    group: 'Đào tạo tại cơ sở',
    title: 'Dự thính tại các mô hình giảng dạy tại MindX',
    description: 'Tham gia dự thính lớp học, ghi lại mã lớp, nhận xét theo mẫu và nộp thu hoạch.',
    owner: 'Leader/TE',
    requirement: 'Tối thiểu 5 buổi observe và tuân thủ quy định dự thính lớp học.',
  },
  {
    id: 'onsite-training',
    phase: 'Giai đoạn 2',
    week: 'Tuần 2',
    group: 'Đào tạo tại cơ sở',
    title: 'Đào tạo văn hóa & kỹ năng giảng dạy',
    description: 'Ứng viên tham gia đào tạo với Leader/TE về văn hóa khu vực và các kỹ năng sư phạm, kỹ năng trải nghiệm cơ bản.',
    owner: 'Leader/TE',
    requirement: 'Có điểm danh hoặc hoàn thành bài kiểm tra sau buổi học.',
  },
  {
    id: 'pedagogy',
    phase: 'Giai đoạn 2',
    week: 'Tuần 2',
    group: 'Đào tạo tại cơ sở',
    title: 'Tập huấn sư phạm',
    description: 'Xem video đào tạo đầu vào và hoàn thành các bài học E-learning theo yêu cầu.',
    owner: 'Teaching HO',
    requirement: 'Thực hiện xuyên suốt giai đoạn 2 cho tới khi hoàn thành đủ bài.',
  },
  {
    id: 'technical-check',
    phase: 'Giai đoạn 2',
    week: 'Tuần 2',
    group: 'Đào tạo tại cơ sở',
    title: 'Kiểm tra chuyên môn đầu vào',
    description: 'Nhận đề kiểm tra chuyên môn đầu vào theo khối đăng ký dạy và hoàn thành đúng yêu cầu.',
    owner: 'Leader/TE',
    requirement: 'Làm cẩn thận để tránh kéo dài thời gian ký hợp đồng.',
  },
  {
    id: 'teaching-assessment',
    phase: 'Giai đoạn 2',
    week: 'Tuần 3',
    group: 'Đào tạo tại cơ sở',
    title: 'Duyệt giảng trial / TA',
    description: 'Chuẩn bị giáo án, slide và thực hiện phần dạy thử theo thời lượng được yêu cầu.',
    owner: 'Leader/TE',
    requirement: 'Chuẩn bị nội dung cho 30 phút dạy thử, có thể dùng kịch bản trải nghiệm có sẵn.',
  },
  {
    id: 'lms-materials',
    phase: 'Giai đoạn 2',
    week: 'Tuần 3',
    group: 'Đào tạo tại cơ sở',
    title: 'Cấp tài khoản LMS và tài liệu giảng dạy',
    description: 'Sử dụng tài khoản LMS để đăng nhập hệ thống TPS, theo dõi chỉ số cá nhân và các hoạt động khác.',
    owner: 'Leader/TE',
    requirement: 'Sử dụng LMS đúng quy trình sau khi được cấp tài khoản.',
  },
  {
    id: 'assessment-registration',
    phase: 'Giai đoạn 2',
    week: 'Tuần 3',
    group: 'Đào tạo tại cơ sở',
    title: 'Đăng ký duyệt giảng với Hội đồng đánh giá chuyên môn',
    description: 'Bước cuối để giáo viên trở thành X-teacher.',
    owner: 'Teaching HO',
    requirement: 'Tham gia đúng giờ, đảm bảo cam/mic/đường truyền và tác phong chuẩn mực.',
  },
  {
    id: 'uniform',
    phase: 'Giai đoạn 2',
    week: 'Tuần 5',
    group: 'Đào tạo tại cơ sở',
    title: 'Đăng ký nhận áo đồng phục',
    description: 'Đăng ký nhận áo đồng phục với Leader sau khi hoàn thành các yêu cầu đào tạo liên quan.',
    owner: 'Leader/TE',
    requirement: 'Theo dõi thông báo từ Leader để hoàn tất nhận đồng phục.',
  },
  {
    id: 'contract',
    phase: 'Giai đoạn 2',
    week: 'Tuần 6',
    group: 'Đào tạo tại cơ sở',
    title: 'Ký hợp đồng Full-time / Part-time',
    description: 'Hoàn tất thủ tục hợp đồng sau khi đạt yêu cầu đào tạo đối với giáo viên mới.',
    owner: 'HCNS',
    requirement: 'Thực hiện theo hướng dẫn từ HCNS.',
  },
] as const satisfies readonly RoadmapStageDefinition[];

type RoadmapStageStatus = 'done' | 'current' | 'scheduled' | 'pending';

function CandidatePortalContent() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);

  const [sessions, setSessions] = useState<CandidateSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [harvestFile, setHarvestFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isObserveModalOpen, setIsObserveModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setHarvestFile(e.dataTransfer.files[0]);
    }
  }, []);
  const [isRoadmapLightboxOpen, setIsRoadmapLightboxOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [currentGen, setCurrentGen] = useState<CandidateCurrentGen | null>(null);
  const [trainingSchedules, setTrainingSchedules] = useState<TrainingScheduleEvent[]>([]);

  const [form, setForm] = useState({
    center_code: CENTER_OPTIONS[0],
    observe_date: new Date().toISOString().split('T')[0],
    class_type: CLASS_TYPES[0],
  });

  const activeTab = useMemo(() => resolveCandidateTab(pathname), [pathname]);
  const [videos, setVideos] = useState<CandidateVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoStageTab, setVideoStageTab] = useQueryState<CandidateTrainingStage>('videoStage', 'centralized_training', { values: ["centralized_training","pedagogy_training"], history: 'push' });
  const [videoStages, setVideoStages] = useState<Record<number, CandidateTrainingStage>>({});
  const [k12Docs, setK12Docs] = useState<CandidateK12Docs | null>(null);
  const [loadingK12Docs, setLoadingK12Docs] = useState(false);
  const [k12DocsError, setK12DocsError] = useState('');
  const [teLeaderContacts, setTeLeaderContacts] = useState<TeLeaderContact[]>([]);
  const [loadingTeLeaderContacts, setLoadingTeLeaderContacts] = useState(false);
  const [teLeaderContactsError, setTeLeaderContactsError] = useState('');
  const [teLeaderSearch, setTeLeaderSearch] = useQueryState<string>('leaderSearch', '');

  const allowedTabs = useMemo(() => {
    return [
      { id: 'roadmap', label: 'Lộ Trình Đào Tạo', href: CANDIDATE_TAB_HREFS.roadmap },
      { id: 'observe', label: 'Quản Lý Dự Thính', href: CANDIDATE_TAB_HREFS.observe },
      { id: 'videos', label: 'Video Đào Tạo Đầu Vào', href: CANDIDATE_TAB_HREFS.videos },
      { id: 'tests', label: 'Bài Kiểm Tra Của Tôi', href: CANDIDATE_TAB_HREFS.tests },
      { id: 'schedule', label: 'Lịch Đào Tạo', href: CANDIDATE_TAB_HREFS.schedule },
      { id: 'te-leader-info', label: 'Thông Tin TE/Leader', href: CANDIDATE_TAB_HREFS['te-leader-info'] },
      { id: 'k12-teaching-policy', label: 'Quy Trình Quy Định K12 Teaching', href: CANDIDATE_TAB_HREFS['k12-teaching-policy'] },
    ] satisfies CandidateTab[];
  }, []);

  const renderTabIcon = (tabId: CandidateTabId) => {
    if (tabId === 'videos') return <Video className="h-3.5 w-3.5" />;
    if (tabId === 'tests') return <ClipboardList className="h-3.5 w-3.5" />;
    if (tabId === 'schedule') return <CalendarDays className="h-3.5 w-3.5" />;
    if (tabId === 'roadmap') return <Route className="h-3.5 w-3.5" />;
    if (tabId === 'te-leader-info') return <UsersRound className="h-3.5 w-3.5" />;
    if (tabId === 'k12-teaching-policy') return <ClipboardList className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  };

  const approvedCount = useMemo(() => sessions.filter((s) => s.status === 'approved').length, [sessions]);
  const submittedCount = sessions.length;
  const progressPercent = Math.min(100, Math.round((submittedCount / 5) * 100));
  const completedRoadmapStageIds = useMemo(
    () => new Set<(typeof ROADMAP_STAGES)[number]['id']>(['training-registration']),
    [],
  );
  const isCentralTrainingCompleted = useMemo(
    () => (['training-registration', 'orientation', 'program-overview'] as const).every((stageId) => completedRoadmapStageIds.has(stageId)),
    [completedRoadmapStageIds],
  );
  const currentRoadmapStageTitle = useMemo(() => {
    if (!isCentralTrainingCompleted) return 'Đào tạo tập trung';
    if (approvedCount < 5) return 'Dự giảng lớp học (Observe)';
    if (!currentGen) return 'Kiểm tra chuyên môn đầu vào';
    if (trainingSchedules.length > 0) return 'Đăng ký duyệt giảng với Hội đồng đánh giá chuyên môn';
    return 'Ký hợp đồng Full-time / Part-time';
  }, [approvedCount, currentGen, isCentralTrainingCompleted, trainingSchedules.length]);

  const getRoadmapStageStatus = useCallback((stageId: (typeof ROADMAP_STAGES)[number]['id']): RoadmapStageStatus => {
    if (completedRoadmapStageIds.has(stageId)) return 'done';
    if (stageId === 'orientation' || stageId === 'program-overview') return 'scheduled';
    if (!isCentralTrainingCompleted) return 'pending';
    if (stageId === 'onsite-training') return 'scheduled';
    if (stageId === 'observe') return approvedCount >= 5 ? 'done' : 'current';
    if (stageId === 'pedagogy') return approvedCount >= 5 ? 'scheduled' : 'current';
    if (stageId === 'technical-check') return approvedCount >= 5 ? 'current' : 'pending';
    if (stageId === 'assessment-registration') return approvedCount >= 5 && trainingSchedules.length > 0 ? 'current' : 'pending';
    return 'pending';
  }, [approvedCount, completedRoadmapStageIds, isCentralTrainingCompleted, trainingSchedules.length]);

  const fetchVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const [res, assignmentsRes] = await Promise.all([
        fetch('/api/hr/onboarding/videos'),
        fetch('/api/training-assignments?assignment_context=all'),
      ]);
      const [data, assignmentsData] = await Promise.all([res.json(), assignmentsRes.json()]);
      if (data.success) {
        setVideos(((data.data || []) as CandidateVideo[]).filter((v) => v.status === 'active'));
        const stages: Record<number, CandidateTrainingStage> = {};
        if (assignmentsData.success && Array.isArray(assignmentsData.data)) {
          assignmentsData.data.forEach((assignment: { video_id?: number; training_stage?: CandidateTrainingStage | null }) => {
            if (assignment.video_id && assignment.training_stage) stages[assignment.video_id] = assignment.training_stage;
          });
        }
        setVideoStages(stages);
      }
    } catch (err) {
      console.error('Error fetching videos:', err);
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  const handleOpenVideoLesson = useCallback((video: CandidateVideo) => {
    dispatch(setVideo({
      id: video.id,
      link: video.video_link,
      duration: video.duration_minutes || (video.duration_seconds ? Math.ceil(video.duration_seconds / 60) : 1),
      title: video.title,
      segments: video.video_link
        ? [{
            id: video.id,
            url: video.video_link,
            duration_minutes: video.duration_minutes || 0,
            duration_seconds: video.duration_seconds ?? null,
          }]
        : undefined,
    }));
    router.push(`/candidate-portal/videos/lesson?id=${video.id}`);
  }, [dispatch, router]);

  useEffect(() => {
    if (activeTab === 'videos') {
      fetchVideos();
    }
  }, [activeTab, fetchVideos]);

  const visibleVideos = useMemo(
    () => videos.filter((video) => videoStages[video.id] === videoStageTab),
    [videoStageTab, videoStages, videos],
  );

  const fetchSessions = useCallback(async (candidateId: number) => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/hr/onboarding/candidate-portal/observe?candidate_id=${candidateId}`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.data || []);
      }
    } catch (error) {
      console.error('Error loading observe sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const fetchTrainingSchedules = useCallback(async (candidateId: number) => {
    try {
      const res = await fetch(`/api/hr/onboarding/candidate-portal/training-sessions?candidate_id=${candidateId}`);
      const data = await res.json();
      if (data.success) {
        setCurrentGen(data.data?.currentGen || null);
        setTrainingSchedules(data.data?.sessions || []);
      }
    } catch (error) {
      console.error('Error loading training schedules:', error);
    }
  }, []);

  const applyCandidateProfile = useCallback((nextProfile: CandidateProfile) => {
    const normalizedProfile = {
      ...nextProfile,
      candidate_id: Number(nextProfile.candidate_id),
    };
    setProfile(normalizedProfile);
    setCurrentGen(
      normalizedProfile.current_gen_name
        ? {
            id: normalizedProfile.current_gen_id || 0,
            genCode: normalizedProfile.current_gen_name,
            regionCode: normalizedProfile.region_code || '',
            regionName: normalizedProfile.region_name || '',
          }
        : null
    );
    fetchSessions(normalizedProfile.candidate_id);
    fetchTrainingSchedules(normalizedProfile.candidate_id);
  }, [fetchSessions, fetchTrainingSchedules]);

  const fetchK12Docs = useCallback(async () => {
    if (k12Docs || loadingK12Docs) return;

    setLoadingK12Docs(true);
    setK12DocsError('');
    try {
      const res = await fetch('/api/hr/onboarding/candidate-portal/k12-docs');
      const data = await res.json();
      if (!data.success) {
        setK12DocsError(data.error || 'Không thể tải tài liệu K12 Teaching.');
        return;
      }
      setK12Docs(data.data);
    } catch (error) {
      console.error('Error loading K12 docs:', error);
      setK12DocsError('Không thể kết nối hệ thống tài liệu. Vui lòng thử lại.');
    } finally {
      setLoadingK12Docs(false);
    }
  }, [k12Docs, loadingK12Docs]);

  const fetchTeLeaderContacts = useCallback(async () => {
    if (teLeaderContacts.length > 0 || loadingTeLeaderContacts) return;

    setLoadingTeLeaderContacts(true);
    setTeLeaderContactsError('');
    try {
      const res = await fetch(TE_LEADER_INFO_CSV_URL);
      if (!res.ok) {
        setTeLeaderContactsError('Không thể tải danh sách TE/Leader.');
        return;
      }

      const csvText = await res.text();
      setTeLeaderContacts(parseTeLeaderCsv(csvText));
    } catch (error) {
      console.error('Error loading TE/Leader contacts:', error);
      setTeLeaderContactsError('Không thể kết nối dữ liệu TE/Leader. Vui lòng thử lại.');
    } finally {
      setLoadingTeLeaderContacts(false);
    }
  }, [loadingTeLeaderContacts, teLeaderContacts.length]);

  useEffect(() => {
    if (activeTab === 'k12-teaching-policy') {
      fetchK12Docs();
    }
  }, [activeTab, fetchK12Docs]);

  useEffect(() => {
    if (activeTab === 'te-leader-info') {
      fetchTeLeaderContacts();
    }
  }, [activeTab, fetchTeLeaderContacts]);

  const [selectedTeArea, setSelectedTeArea] = useQueryState<string>('leaderArea', 'all');

  const allTeAreas = useMemo(() => {
    const areas = new Set<string>();
    teLeaderContacts.forEach((c) => {
      if (c.area) areas.add(c.area);
    });
    return ['all', ...Array.from(areas)];
  }, [teLeaderContacts]);

  const teLeaderManagers = useMemo(() => {
    const managerMap = new Map<string, TeLeaderManager>();

    teLeaderContacts.forEach((contact) => {
      const key = [contact.area, contact.name, contact.role, contact.phone, contact.email].join('|');
      const current = managerMap.get(key);

      if (current) {
        if (contact.center && !current.centers.includes(contact.center)) {
          current.centers.push(contact.center);
        }
        return;
      }

      managerMap.set(key, {
        area: contact.area,
        name: contact.name,
        role: contact.role,
        phone: contact.phone,
        email: contact.email,
        centers: contact.center ? [contact.center] : [],
      });
    });

    const result = Array.from(managerMap.values()).map((manager) => ({
      ...manager,
      centers: manager.centers.sort((a, b) => a.localeCompare(b, 'vi')),
    }));

    const areaCentersMap = new Map<string, Set<string>>();
    result.forEach((m) => {
      if (!areaCentersMap.has(m.area)) areaCentersMap.set(m.area, new Set());
      m.centers.forEach((c) => {
        if (c !== m.area) areaCentersMap.get(m.area)?.add(c);
      });
    });

    return result.map((m) => {
      if (m.role.toLowerCase().includes('tegl') && (m.centers.length === 0 || m.centers.includes(m.area))) {
        const areaCenters = Array.from(areaCentersMap.get(m.area) || []);
        return {
          ...m,
          centers: areaCenters.length > 0 ? areaCenters.sort((a, b) => a.localeCompare(b, 'vi')) : [m.area],
        };
      }
      return m;
    });
  }, [teLeaderContacts]);

  const filteredTeLeaderManagers = useMemo(() => {
    const keyword = teLeaderSearch.trim().toLowerCase();
    if (!keyword) return teLeaderManagers;

    return teLeaderManagers.filter((manager) =>
      [manager.area, manager.name, manager.role, manager.phone, manager.email, ...manager.centers]
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [teLeaderManagers, teLeaderSearch]);

  const teLeaderManagersByArea = useMemo(() => {
    const grouped = filteredTeLeaderManagers.reduce<Record<string, TeLeaderManager[]>>((groups, manager) => {
      const key = manager.area || 'Khác';
      groups[key] = groups[key] || [];
      groups[key].push(manager);
      return groups;
    }, {});

    if (selectedTeArea === 'all') return grouped;
    return Object.fromEntries(Object.entries(grouped).filter(([area]) => area === selectedTeArea));
  }, [filteredTeLeaderManagers, selectedTeArea]);

  useEffect(() => {
    let cancelled = false;

    const restoreProfile = async () => {
      let restoredFromStorage = false;
      const stored = window.localStorage.getItem('candidatePortalProfile');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as unknown;
          if (isCandidateProfile(parsed)) {
            applyCandidateProfile(parsed);
            restoredFromStorage = true;
          }
        } catch {
          // Fall through to server session restore.
        }
        if (!restoredFromStorage) {
          window.localStorage.removeItem('candidatePortalProfile');
        }
      }

      try {
        const res = await fetch('/api/hr/onboarding/candidate-auth', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.ok && data.success && isCandidateProfile(data.data)) {
          window.localStorage.setItem('candidatePortalProfile', JSON.stringify(data.data));
          applyCandidateProfile(data.data);
          return;
        }

        if (restoredFromStorage && res.status !== 401 && res.status !== 403) {
          return;
        }
      } catch (error) {
        console.error('Error restoring candidate profile:', error);
        if (restoredFromStorage) {
          return;
        }
      }

      if (!cancelled) {
        window.localStorage.removeItem('candidatePortalProfile');
        router.replace('/login?role=candidate');
      }
    };

    void restoreProfile();

    return () => {
      cancelled = true;
    };
  }, [applyCandidateProfile, router]);

  async function handleLogout() {
    setProfile(null);
    setSessions([]);
    setVideos([]);
    setK12Docs(null);
    setCurrentGen(null);
    setTrainingSchedules([]);
    window.localStorage.removeItem('candidatePortalProfile');
    await logout('/login?role=candidate');
  }

  async function handleSubmitObserve() {
    if (!profile) return;
    if (!form.center_code || !form.observe_date || !form.class_type || !harvestFile) {
      setSubmitMessage('Vui lòng nhập đầy đủ thông tin và chọn file thu hoạch.');
      return;
    }

    setSubmitting(true);
    setSubmitMessage('');

    try {
      const uploadData = new FormData();
      uploadData.append('candidate_id', String(profile.candidate_id));
      uploadData.append('file', harvestFile);

      const uploadRes = await fetch('/api/hr/onboarding/candidate-portal/harvest-upload', {
        method: 'POST',
        body: uploadData,
      });
      const uploadJson = await uploadRes.json();

      if (!uploadJson.success) {
        setSubmitMessage(uploadJson.error || 'Không thể upload file thu hoạch.');
        return;
      }

      const res = await fetch('/api/hr/onboarding/candidate-portal/observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: profile.candidate_id,
          ...form,
          harvest_file_url: uploadJson.data.url,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setSubmitMessage(data.error || 'Không thể nộp bài thu hoạch.');
        return;
      }

      setForm((prev) => ({
        ...prev,
        observe_date: new Date().toISOString().split('T')[0],
      }));
      setHarvestFile(null);
      setFileInputKey((prev) => prev + 1);
      setSubmitMessage('Đã nộp bài thu hoạch thành công.');
      setIsObserveModalOpen(false);
      fetchSessions(profile.candidate_id);
    } catch (error) {
      console.error('Submit observe error:', error);
      setSubmitMessage('Không thể kết nối hệ thống. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile) {
    return null;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-muted">
      {!isSidebarOpen && (
      <header className="fixed left-0 right-0 top-0 z-sidebar-toggle border-b border-gray-200 bg-white shadow-sm md:hidden">
        <div className="flex h-14 items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <img
              src="/logo.svg"
              alt="MindX Technology School"
              className="h-7 w-auto"
            />
            <div className="flex flex-col justify-center leading-tight">
              <p className="text-sm font-bold tracking-wide text-[#2c2b2b]">
                Teaching Portal System
              </p>
              <p className="text-[11px] font-medium text-[#6a6a6a]">
                Candidate Portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Mở sidebar"
            className="rounded-md p-1.5 text-[#1f1f1f] transition-all duration-200 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>
      )}

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-sidebar-overlay-custom bg-black/50 backdrop-blur-sm transition-all duration-300 ease-in-out animate-in fade-in-0 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {!isDesktopSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsDesktopSidebarOpen(true)}
          aria-label="Mở sidebar"
          className="fixed left-3 top-3 z-sidebar-toggle hidden rounded-lg border border-gray-200 bg-white p-2 shadow-md transition-all duration-300 hover:scale-105 hover:border-[#a1001f] hover:bg-[#a1001f] hover:text-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2 md:block"
        >
          <Menu className="h-4 w-4 transition-transform duration-300" />
        </button>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-sidebar-custom h-dvh max-h-dvh w-56 overflow-hidden border-r border-gray-200 bg-white/95 shadow-xl backdrop-blur-xl transition-all duration-500 ease-in-out will-change-transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isDesktopSidebarOpen ? 'md:translate-x-0' : 'md:-translate-x-full'}`}
        aria-hidden={!isSidebarOpen && !isDesktopSidebarOpen}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="relative flex h-14 items-center justify-between bg-[#a1001f] px-4 py-2 text-white shadow-md">
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                router.push(CANDIDATE_TAB_HREFS.observe);
              }}
              className="flex items-center gap-2 text-left transition-opacity hover:opacity-80"
            >
              <div className="rounded-lg bg-white/20 p-1.5 backdrop-blur-sm">
                <img src="/x_white.svg" alt="MindX" className="h-4 w-4" />
              </div>
              <div className="flex flex-col justify-center leading-tight">
                <h2 className="text-sm font-bold tracking-wide">TPS</h2>
                <p className="text-[11px] text-white/80">Candidate Portal</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Đóng sidebar"
              className="rounded-lg p-1.5 transition-all duration-300 hover:rotate-90 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#a1001f] md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsDesktopSidebarOpen(false)}
              aria-label="Thu gọn sidebar"
              className="hidden rounded-lg p-1.5 transition-all duration-300 hover:rotate-90 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#a1001f] md:inline-flex"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1 pb-4 custom-scrollbar" aria-label="Candidate portal">
            {allowedTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    router.push(tab.href);
                  }}
                  className={`group/item flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2 ${
                    isActive
                      ? 'scale-[1.01] bg-[#a1001f] text-white shadow-md shadow-[#a1001f]/20'
                      : 'text-gray-700 hover:scale-[1.01] hover:bg-gray-100 hover:shadow-sm'
                  }`}
                >
                  <span className={`rounded-md p-1.5 transition-all duration-300 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700 group-hover/item:bg-white group-hover/item:shadow-sm'
                  }`}>
                    {renderTabIcon(tab.id)}
                  </span>
                  <span className="min-w-0 flex-1">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <div className="mb-2 rounded-lg border border-gray-100 bg-white p-2 shadow-sm">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a1001f] text-xs font-bold text-white shadow-md">
                  {profile.full_name?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-xs font-bold leading-snug text-gray-900">
                    {profile.full_name}
                  </p>
                  <p className="text-xs leading-snug text-gray-500">
                    {profile.candidate_code}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center rounded-full bg-[#a1001f] px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
                Ứng viên
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </aside>

      <div
        className={
          activeTab === 'k12-teaching-policy' || activeTab === 'roadmap'
            ? `w-full pb-0 pt-14 transition-all duration-500 md:pt-0 ${
                isDesktopSidebarOpen ? 'md:ml-56 md:w-[calc(100%_-_14rem)]' : 'md:ml-0 md:w-full'
              }`
            : `mx-auto px-4 pb-6 pt-20 transition-all duration-500 sm:px-6 md:px-8 md:pt-6 ${
                isDesktopSidebarOpen
                  ? 'md:ml-56 md:w-[calc(100%_-_14rem)] md:max-w-none'
                  : 'md:ml-0 md:w-full md:max-w-none'
              }`
        }
      >
        <div className="min-w-0">
                     {activeTab === 'observe' && (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] animate-in fade-in duration-300">
          <section className="space-y-6">
            {/* Tiến độ dự thính Card */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md transition-all">
              <div className="relative overflow-hidden bg-[#a1001f] p-6 text-white shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-xs">
                        {progressPercent}% hoàn thành
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-white/80 uppercase tracking-wider">Tiến độ dự thính</p>
                    <h2 className="mt-1 text-3xl font-extrabold text-white tracking-tight">{submittedCount} / 5 <span className="text-lg font-medium text-white/80">bài</span></h2>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSubmitMessage('');
                      setIsObserveModalOpen(true);
                    }}
                    className="h-11 shrink-0 rounded-xl border border-white/20 bg-white font-bold text-[#a1001f] shadow-md hover:bg-white/95 hover:scale-[1.02] transition-all"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Nộp thu hoạch
                  </Button>
                </div>
                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-black/20 p-0.5">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500 shadow-xs"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50/50 p-4 text-center">
                <div className="px-2 py-1">
                  <p className="text-2xl font-black text-gray-900">{submittedCount}</p>
                  <p className="mt-0.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Đã nộp</p>
                </div>
                <div className="px-2 py-1">
                  <p className="text-2xl font-black text-emerald-600">{approvedCount}</p>
                  <p className="mt-0.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Đã duyệt</p>
                </div>
                <div className="px-2 py-1">
                  <p className="text-2xl font-black text-[#a1001f]">{Math.max(0, 5 - submittedCount)}</p>
                  <p className="mt-0.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Còn lại</p>
                </div>
              </div>
            </div>

            {/* Hướng dẫn dự thính Card */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a1001f]/10 text-[#a1001f]">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Hướng dẫn làm bài & Nộp thu hoạch</h3>
                  <p className="text-xs text-gray-500">Các bước hoàn thành lộ trình observe tại cơ sở</p>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-gray-600">
                <div className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#a1001f] text-[10px] font-bold text-white">1</span>
                  <p><span className="font-bold text-gray-800">Tải mẫu phiếu thu hoạch</span> từ nút bên trên hoặc trong form nộp bài để có đúng định dạng quy định.</p>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#a1001f] text-[10px] font-bold text-white">2</span>
                  <p><span className="font-bold text-gray-800">Tham gia tối thiểu 5 buổi dự thính</span> tại cơ sở được phân công và ghi chép nội dung quan sát.</p>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#a1001f] text-[10px] font-bold text-white">3</span>
                  <p><span className="font-bold text-gray-800">Nộp thu hoạch</span> lên hệ thống sau mỗi buổi dự thính để HR/Leader kiểm tra và phê duyệt.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs font-semibold text-gray-700 hover:border-[#a1001f] hover:text-[#a1001f]"
                >
                  <a href={HARVEST_TEMPLATE_URL} download>
                    <Download className="h-3.5 w-3.5" /> Tải mẫu thu hoạch
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs font-semibold text-gray-700 hover:border-[#a1001f] hover:text-[#a1001f]"
                >
                  <Link href={K12_ONSITE_TRAINING_URL}>
                    <ExternalLink className="h-3.5 w-3.5" /> Quy định dự thính
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Right Section: Lịch sử nộp thu hoạch */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs flex flex-col">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Lịch sử nộp thu hoạch</h2>
                <p className="text-xs text-gray-500">Danh sách các bài observe bạn đã gửi lên hệ thống.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                {sessions.length} bài đã nộp
              </span>
            </div>

            {loadingSessions ? (
              <CandidateListSkeleton />
            ) : sessions.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center min-h-[320px]">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#a1001f]/10 text-[#a1001f]">
                  <FileText className="h-7 w-7" />
                </div>
                <p className="font-bold text-gray-900">Chưa có bài thu hoạch nào</p>
                <p className="mt-1 max-w-xs text-xs text-gray-500 leading-relaxed">
                  Sau khi nộp, các bài thu hoạch sẽ xuất hiện tại đây để bạn tiện theo dõi phản hồi và trạng thái phê duyệt từ HR.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setSubmitMessage('');
                    setIsObserveModalOpen(true);
                  }}
                  variant="mindx"
                  size="sm"
                  className="mt-4 rounded-xl font-semibold shadow-xs"
                >
                  <UploadCloud className="h-4 w-4" /> Nộp bài đầu tiên
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const status = getStatusConfig(session.status);
                  return (
                    <article
                      key={session.id}
                      className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4 transition-all duration-200 hover:border-[#a1001f]/30 hover:bg-white hover:shadow-md"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${status.className}`}>
                              {status.label}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200">
                              {session.class_type}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-900 flex items-center gap-1.5 text-base">
                            <MapPin className="h-4 w-4 text-[#a1001f]" />
                            {session.center_code}
                          </h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                            Ngày dự thính: <span className="font-semibold text-gray-700">{new Date(session.observe_date).toLocaleDateString('vi-VN')}</span>
                          </p>
                        </div>

                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl border-gray-200 font-semibold text-xs text-gray-700 hover:border-[#a1001f] hover:text-[#a1001f] hover:bg-[#a1001f]/5 transition-all shadow-xs shrink-0"
                        >
                          <a
                            href={session.harvest_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText className="h-3.5 w-3.5 text-[#a1001f]" />
                            Xem file
                            <ExternalLink className="h-3 w-3 text-gray-400" />
                          </a>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'observe' && isObserveModalOpen && (
        <div
          className="fixed inset-0 z-modal-backdrop-custom flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsObserveModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="observe-submit-title"
          >
            {/* Modal Header */}
            <div className="relative border-b border-white/10 bg-[#a1001f] p-5 text-white shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 shadow-inner backdrop-blur-xs">
                    <UploadCloud className="h-6 w-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 id="observe-submit-title" className="text-lg font-bold leading-tight text-white tracking-tight">
                      Nộp thu hoạch dự thính
                    </h2>
                    <p className="mt-1 text-xs font-medium text-white/80">
                      Hoàn thiện thông tin buổi observe và tải file thu hoạch từ máy tính.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    asChild
                    variant="secondary"
                    size="sm"
                    className="h-9 rounded-xl border border-white/20 bg-white/95 font-bold text-[#a1001f] shadow-xs hover:bg-white hover:text-[#a1001f] transition-all"
                  >
                    <a href={HARVEST_TEMPLATE_URL} download>
                      <Download className="h-4 w-4" />
                      Tải mẫu
                    </a>
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsObserveModalOpen(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                    aria-label="Đóng modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="max-h-[75vh] overflow-y-auto px-6 py-5 custom-scrollbar space-y-5">
              {/* Quy trình banner */}
              <div className="rounded-xl border border-[#a1001f]/15 bg-[#a1001f]/[0.03] p-4 transition-all hover:bg-[#a1001f]/[0.05]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <ClipboardList className="h-4 w-4 text-[#a1001f]" />
                      Quy trình dự thính tại cơ sở
                    </p>
                    <p className="text-xs leading-relaxed text-gray-600">
                      Trước khi nộp thu hoạch, ứng viên cần đối chiếu với mục Đào tạo tại cơ sở trong Quy Trình, Quy Định K12 Teaching.
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 rounded-lg bg-white font-semibold text-xs border-gray-200 text-gray-700 hover:border-[#a1001f] hover:text-[#a1001f] transition-all shadow-xs"
                    onClick={() => setIsObserveModalOpen(false)}
                  >
                    <Link href={K12_ONSITE_TRAINING_URL}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Xem quy trình
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Form Controls */}
              <div className="space-y-4">
                {/* Cơ sở */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600">
                    <MapPin className="h-3.5 w-3.5 text-[#a1001f]" /> Cơ sở dự thính <span className="text-[#a1001f]">*</span>
                  </label>
                  <select
                    value={form.center_code}
                    onChange={(event) => setForm((prev) => ({ ...prev, center_code: event.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-semibold text-gray-900 outline-none transition-all focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/20 hover:border-gray-300"
                  >
                    {CENTER_OPTIONS.map((center) => (
                      <option key={center} value={center}>
                        {center}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grid 2 cols: Ngày & Hình thức */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600">
                      <CalendarDays className="h-3.5 w-3.5 text-[#a1001f]" /> Ngày dự thính <span className="text-[#a1001f]">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.observe_date}
                      onChange={(event) => setForm((prev) => ({ ...prev, observe_date: event.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-semibold text-gray-900 outline-none transition-all focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/20 hover:border-gray-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600">
                      <Building2 className="h-3.5 w-3.5 text-[#a1001f]" /> Hình thức lớp <span className="text-[#a1001f]">*</span>
                    </label>
                    <select
                      value={form.class_type}
                      onChange={(event) => setForm((prev) => ({ ...prev, class_type: event.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-semibold text-gray-900 outline-none transition-all focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/20 hover:border-gray-300"
                    >
                      {CLASS_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* File Dropzone Upload Area */}
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-[#a1001f]" /> File thu hoạch <span className="text-[#a1001f]">*</span>
                    </span>
                    {harvestFile && (
                      <span className="text-[11px] font-semibold text-emerald-600 capitalize">Đã sẵn sàng nộp</span>
                    )}
                  </label>

                  <input
                    ref={fileInputRef}
                    key={fileInputKey}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg,image/webp"
                    onChange={(event) => setHarvestFile(event.target.files?.[0] ?? null)}
                    className="hidden"
                  />

                  {!harvestFile ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 ${
                        isDragging
                          ? 'border-[#a1001f] bg-[#a1001f]/10 scale-[1.01]'
                          : 'border-gray-200 bg-gray-50/40 hover:border-[#a1001f]/50 hover:bg-[#a1001f]/[0.02]'
                      }`}
                    >
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-gray-100 group-hover:scale-110 group-hover:border-[#a1001f]/30 transition-all duration-200">
                        <UploadCloud className="h-6 w-6 text-[#a1001f]" />
                      </div>
                      <p className="text-sm font-bold text-gray-800">
                        Kéo & thả file vào đây hoặc <span className="text-[#a1001f] underline decoration-[#a1001f]/40 underline-offset-4">bấm để chọn file</span>
                      </p>
                      <p className="mt-1 text-xs text-gray-500 font-medium">
                        Hỗ trợ PDF, Word (.doc, .docx), Excel (.xls, .xlsx) hoặc ảnh (.png, .jpg)
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-50/60 p-4 transition-all shadow-xs">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                          <FileCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-gray-900">{harvestFile.name}</p>
                          <p className="text-xs font-semibold text-emerald-700">
                            {formatFileSize(harvestFile.size)} • Đã chọn file
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-8 px-2.5 text-xs font-semibold text-gray-600 hover:bg-emerald-100 hover:text-gray-900 rounded-lg"
                        >
                          Đổi file
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setHarvestFile(null)}
                          className="h-8 w-8 text-gray-400 hover:bg-rose-100 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Feedback Message */}
                {submitMessage && (
                  <div
                    className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold animate-in fade-in duration-150 ${
                      submitMessage.includes('thành công')
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {submitMessage.includes('thành công') ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    )}
                    <span>{submitMessage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/80 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsObserveModalOpen(false)}
                className="h-10 rounded-xl px-4 font-semibold text-gray-700 hover:bg-gray-100 border-gray-200"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                onClick={handleSubmitObserve}
                loading={submitting}
                variant="mindx"
                className="h-10 rounded-xl px-5 font-semibold shadow-md shadow-[#a1001f]/20 hover:shadow-lg transition-all"
              >
                {!submitting && <UploadCloud className="h-4 w-4" />}
                Nộp thu hoạch
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'videos' && (
        <div className="animate-in fade-in duration-300">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-1">Video Đào Tạo Đầu Vào</h2>
            <p className="text-sm text-muted-foreground mb-6">Danh sách các video hướng dẫn và quy trình đào tạo dành cho ứng viên mới.</p>
            <div className="mb-6 inline-flex rounded-lg border border-border bg-muted p-1">
              {[{ id: 'centralized_training', label: 'Đào Tạo Tập Trung' }, { id: 'pedagogy_training', label: 'Tập Huấn Sư Phạm' }].map((stage) => (
                <button key={stage.id} type="button" onClick={() => setVideoStageTab(stage.id as CandidateTrainingStage)} className={`rounded-md px-3 py-2 text-sm font-bold transition ${videoStageTab === stage.id ? 'bg-[#a1001f] text-white shadow-sm' : 'text-muted-foreground hover:bg-background'}`}>{stage.label}</button>
              ))}
            </div>

            {loadingVideos ? (
              <CandidateVideoGridSkeleton />
            ) : visibleVideos.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted text-center">
                <Video className="mb-3 h-11 w-11 text-muted-foreground/50" />
                <p className="font-bold text-foreground">Chưa có video đào tạo</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Hãy quay lại sau khi HR cập nhật danh sách video.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleVideos.map((video) => (
                  <article key={video.id} className="group overflow-hidden rounded-xl border border-border bg-muted transition-all hover:border-primary/30 hover:bg-card hover:shadow-md flex flex-col h-full">
                    <div className="relative aspect-video w-full bg-muted overflow-hidden">
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt={video.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/10">
                          <Video className="h-10 w-10 text-primary" />
                        </div>
                      )}
                      {video.lesson_number && (
                        <span className="absolute top-3 left-3 bg-black/75 text-white text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-sm">
                          Bài {video.lesson_number}
                        </span>
                      )}
                      <span className="absolute bottom-3 right-3 bg-black/75 text-white text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-sm flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {video.duration_minutes || Math.ceil((video.duration_seconds || 0) / 60) || 1} phút
                      </span>
                    </div>

                    <div className="p-5 flex-grow flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-foreground leading-snug line-clamp-2">{video.title}</h3>
                        {video.description && (
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">{video.description}</p>
                        )}
                      </div>

                      <div className="mt-5">
                        <Button
                          type="button"
                          variant="mindx"
                          size="sm"
                          className="w-full"
                          onClick={() => handleOpenVideoLesson(video)}
                        >
                          Xem video
                          <Video className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="animate-in fade-in duration-300">
          <GenOverviewTab
            genEntries={[]}
            regionFilter=""
            activeGenKey={currentGen ? String(currentGen.id || currentGen.genCode) : ''}
            activeGenInfo={
              currentGen
                ? { genCode: currentGen.genCode, regionCode: currentGen.regionCode || currentGen.regionName }
                : null
            }
            onSelectGen={() => {}}
            schedules={trainingSchedules}
            scopeLabel={
              currentGen
                ? `Lịch training GEN hiện tại ${currentGen.genCode}`
                : 'Ứng viên chưa được gán GEN hiện tại'
            }
            hideInfoBox
          />
        </div>
      )}

      {activeTab === 'roadmap' && (
        <div className="animate-in fade-in duration-300 space-y-6">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr] xl:grid-cols-[0.75fr_1.25fr]">
              <div className="flex flex-col justify-between gap-6 p-5 sm:p-7 lg:p-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                    <Route className="h-3.5 w-3.5" />
                    Candidate Portal
                  </div>
                  <div>
                    <h2 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">Lộ Trình Đào Tạo</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                      Theo dõi toàn bộ hành trình từ dự thính, hoàn thành đào tạo đầu vào đến training theo GEN hiện tại.
                      Mỗi giai đoạn được cập nhật theo dữ liệu hiện tại của ứng viên.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:max-w-xs">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">GEN hiện tại</p>
                    <p className="mt-2 truncate text-2xl font-black text-foreground">{currentGen?.genCode || 'Chưa có'}</p>
                  </div>
                </div>

              </div>

              <div className="border-t border-border bg-muted/50 p-4 sm:p-5 lg:border-l lg:border-t-0 lg:p-6">
                <button
                  type="button"
                  onClick={() => setIsRoadmapLightboxOpen(true)}
                  className="group flex min-h-[260px] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-[340px] lg:min-h-[430px] xl:min-h-[500px]"
                  aria-label="Mở ảnh lộ trình đào tạo đầu vào"
                >
                  <img
                    src={ROADMAP_ILLUSTRATION_URL}
                    alt="Lộ trình đào tạo đầu vào"
                    className="h-auto max-h-full w-full object-contain transition duration-300 group-hover:scale-[1.01]"
                  />
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-foreground">Timeline đào tạo</h3>
                  <p className="text-sm text-muted-foreground">
                    Giai đoạn đang thực hiện: <span className="font-bold text-primary">{currentRoadmapStageTitle}</span>
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <Clock className="h-3.5 w-3.5" />
                  Đang cập nhật theo hồ sơ
                </span>
              </div>

              <div className="mb-6 overflow-x-auto rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex min-w-[820px] items-start">
                  {ROADMAP_STAGES.map((stage, index) => {
                    const status = getRoadmapStageStatus(stage.id);
                    const isDone = status === 'done';
                    const isCurrent = status === 'current';
                    const isScheduled = status === 'scheduled';
                    const milestoneLabel = index === 0 ? null : index + 1;
                    return (
                      <div
                        key={`rail-${stage.id}`}
                        className="relative flex min-w-28 flex-1 flex-col items-center px-2 text-center"
                        aria-current={isCurrent ? 'step' : undefined}
                      >
                        {index > 0 && (
                          <span
                            className={`absolute left-0 top-5 h-0.5 w-[calc(50%_-_24px)] ${
                              isDone || isCurrent || isScheduled ? 'bg-primary/50' : 'bg-border'
                            }`}
                          />
                        )}
                        {index < ROADMAP_STAGES.length - 1 && (
                          <span
                            className={`absolute right-0 top-5 h-0.5 w-[calc(50%_-_24px)] ${
                              isDone ? 'bg-primary/50' : 'bg-border'
                            }`}
                          />
                        )}
                        <span
                          className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm ${
                            isCurrent
                              ? 'border-primary bg-primary text-white'
                              : isDone
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : isScheduled
                                  ? 'border-primary/40 bg-primary/10 text-primary'
                                  : 'border-border bg-white text-gray-700'
                          }`}
                        >
                          {milestoneLabel === null ? <Flag className="h-4 w-4" /> : milestoneLabel}
                        </span>
                        <span className="mt-2 text-[11px] font-black uppercase tracking-wide text-primary">
                          {stage.phase}
                        </span>
                        <span className="mt-1 line-clamp-2 min-h-8 text-xs font-bold leading-4 text-foreground" title={stage.title}>
                          {stage.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative space-y-4">
                <div className="absolute bottom-6 left-5 top-6 hidden w-px bg-border sm:block" />
                {ROADMAP_STAGES.map((stage, index) => {
                  const status = getRoadmapStageStatus(stage.id);
                  const isDone = status === 'done';
                  const isCurrent = status === 'current';
                  const isScheduled = status === 'scheduled';
                  const stageGroup = (stage as RoadmapStageDefinition).group;
                  const previousStageGroup = (ROADMAP_STAGES[index - 1] as RoadmapStageDefinition | undefined)?.group;
                  const shouldShowGroup = stageGroup && stageGroup !== previousStageGroup;
                  return (
                    <div key={stage.id} className="relative">
                      {shouldShowGroup && (
                        <div className="mb-2 ml-0 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary sm:ml-14">
                          <span className="h-px w-8 bg-primary/30" />
                          {stageGroup}
                        </div>
                      )}
                      <article
                        className={`relative rounded-lg border p-4 transition ${
                          isCurrent
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : isDone
                              ? 'border-emerald-200 bg-emerald-50'
                              : isScheduled
                                ? 'border-info/30 bg-info/5'
                                : 'border-border bg-background'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black ${
                              isCurrent
                                ? 'border-primary bg-primary text-white'
                                : isDone
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : isScheduled
                                    ? 'border-info bg-info text-white'
                                    : 'border-border bg-card text-muted-foreground'
                            }`}
                          >
                            {isDone ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                                {stage.phase}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                                {stage.week}
                              </span>
                              {stage.id === 'pedagogy' ? (
                                <button
                                  type="button"
                                  onClick={() => router.push(CANDIDATE_TAB_HREFS.videos)}
                                  className="text-left font-bold text-foreground underline-offset-4 transition hover:text-primary hover:underline"
                                >
                                  {stage.title}
                                </button>
                              ) : (
                                <h4 className="font-bold text-foreground">{stage.title}</h4>
                              )}
                              {isCurrent && (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                                  Đang thực hiện
                                </span>
                              )}
                              {isDone && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                                  Hoàn thành
                                </span>
                              )}
                              {isScheduled && (
                                <span className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-bold text-info">
                                  Theo lịch hệ thống
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{stage.description}</p>
                            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                              <p className="rounded-md bg-muted px-3 py-2 font-semibold text-foreground">
                                Tổ chức bởi: {stage.owner}
                              </p>
                              <p className="rounded-md bg-muted px-3 py-2 font-semibold text-foreground">
                                Yêu cầu: {stage.requirement}
                              </p>
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
          </section>
        </div>
      )}

      {isRoadmapLightboxOpen && (
        <ImageLightbox
          images={[{ src: ROADMAP_ILLUSTRATION_URL, alt: 'Lộ trình đào tạo đầu vào' }]}
          initialIndex={0}
          onClose={() => setIsRoadmapLightboxOpen(false)}
        />
      )}

      {activeTab === 'te-leader-info' && (
        <div className="animate-in fade-in duration-300 space-y-6">
          {/* Solid Red Header Banner */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs">
            <div className="bg-[#a1001f] px-6 py-6 text-white shadow-md">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-xs">
                    <UsersRound className="h-3.5 w-3.5" />
                    Sơ đồ nhân sự & Quản lý
                  </div>
                  <h1 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl tracking-tight">
                    Thông tin TEGL & Đội ngũ Leader
                  </h1>
                  <p className="mt-2 max-w-3xl text-xs font-medium leading-relaxed text-white/90 sm:text-sm">
                    Danh sách TEGL Khu vực, Leader Chuyên môn (Coding, Robotics, Art) và Teacher Coordinator theo từng khu vực quản lý.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur-xs border border-white/20">
                    {teLeaderManagers.length} nhân sự quản lý
                  </span>
                </div>
              </div>
            </div>

            {/* Search & Area Filter Bar */}
            <div className="p-5 sm:p-6 space-y-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={teLeaderSearch}
                    onChange={(event) => setTeLeaderSearch(event.target.value)}
                    placeholder="Tìm theo cơ sở, tên TE/Leader, vai trò, SĐT hoặc email..."
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm font-medium text-gray-900 shadow-xs outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20"
                  />
                  {teLeaderSearch && (
                    <button
                      type="button"
                      onClick={() => setTeLeaderSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-700"
                    >
                      Xóa
                    </button>
                  )}
                </label>
              </div>

              {/* Area Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mr-1">Khu vực:</span>
                {allTeAreas.map((areaKey) => {
                  const isActive = selectedTeArea === areaKey;
                  const label = areaKey === 'all' ? 'Tất cả khu vực' : areaKey;
                  return (
                    <button
                      key={areaKey}
                      type="button"
                      onClick={() => setSelectedTeArea(areaKey)}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-[#a1001f] text-white shadow-xs'
                          : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List Content */}
            <div className="p-5 sm:p-6 space-y-8">
              {loadingTeLeaderContacts ? (
                <ContactCardsSkeleton />
              ) : teLeaderContactsError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">
                  {teLeaderContactsError}
                </div>
              ) : Object.keys(teLeaderManagersByArea).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                  <UsersRound className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-base font-bold text-gray-900">Không tìm thấy nhân sự phù hợp</p>
                  <p className="text-xs text-gray-500 mt-1">Thử điều chỉnh từ khóa tìm kiếm hoặc chọn lại bộ lọc khu vực.</p>
                </div>
              ) : (
                Object.entries(teLeaderManagersByArea).map(([area, managers]) => {
                  return (
                    <section key={area} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a1001f]/10 text-[#a1001f]">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Khu vực {area}</h2>
                            <p className="text-xs text-gray-500 font-medium">Ban quản lý và đội ngũ chuyên môn khu vực</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                          {managers.length} nhân sự
                        </span>
                      </div>

                      {/* Managers Grid */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        {managers.map((manager, index) => {
                          const roleConfig = getRoleBadgeConfig(manager.role);
                          return (
                            <article
                              key={`${area}-${manager.name}-${manager.role}-${index}`}
                              className={`rounded-2xl border p-5 transition-all duration-200 ${roleConfig.cardClass} hover:shadow-md`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {roleConfig.isLead ? (
                                      <ShieldCheck className="h-4 w-4 text-[#a1001f]" />
                                    ) : (
                                      <UsersRound className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                      {roleConfig.isLead ? 'Trưởng khu vực (TEGL)' : 'Nhân sự quản lý'}
                                    </span>
                                  </div>
                                  <h3 className="mt-1.5 text-lg font-bold text-gray-900 tracking-tight">{manager.name}</h3>
                                </div>
                                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${roleConfig.badgeClass}`}>
                                  {manager.role}
                                </span>
                              </div>

                              {/* Contact Information */}
                              <div className="mt-4 grid gap-2 text-xs font-semibold text-gray-700 sm:grid-cols-2 pt-3 border-t border-gray-100">
                                {manager.phone ? (
                                  <a
                                    href={`tel:${manager.phone}`}
                                    className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-gray-800 hover:bg-[#a1001f]/10 hover:text-[#a1001f] transition-all"
                                  >
                                    <Phone className="h-3.5 w-3.5 text-[#a1001f] shrink-0" />
                                    <span>{manager.phone}</span>
                                  </a>
                                ) : (
                                  <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-gray-400">
                                    <Phone className="h-3.5 w-3.5 shrink-0" />
                                    <span>Chưa có SĐT</span>
                                  </div>
                                )}

                                {manager.email ? (
                                  <a
                                    href={`mailto:${manager.email}`}
                                    className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-gray-800 hover:bg-[#a1001f]/10 hover:text-[#a1001f] transition-all min-w-0"
                                  >
                                    <Mail className="h-3.5 w-3.5 text-[#a1001f] shrink-0" />
                                    <span className="truncate">{manager.email}</span>
                                  </a>
                                ) : (
                                  <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-gray-400 min-w-0">
                                    <Mail className="h-3.5 w-3.5 shrink-0" />
                                    <span>Chưa có Email</span>
                                  </div>
                                )}
                              </div>

                              {/* Managed Centers List */}
                              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                  <MapPin className="h-3.5 w-3.5 text-[#a1001f]" />
                                  {roleConfig.isLead ? 'Cơ sở phụ trách trong khu vực' : 'Cơ sở quản lý'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {manager.centers.length > 0 ? (
                                    manager.centers.map((center) => (
                                      <span
                                        key={`${manager.name}-${center}`}
                                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 shadow-2xs"
                                      >
                                        {center}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">Toàn bộ khu vực</span>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'k12-teaching-policy' && (
        <div className="animate-in fade-in duration-300">
          {loadingK12Docs ? (
            <K12DocsSkeleton />
          ) : k12DocsError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm font-semibold text-destructive">
              {k12DocsError}
            </div>
          ) : k12Docs ? (
            <K12DocsClient
              basePath={CANDIDATE_TAB_HREFS['k12-teaching-policy']}
              pageTitle="Quy Trình, Quy Định K12 Teaching"
              tree={k12Docs.tree}
              documents={k12Docs.documents}
              selectedSlug={searchParams.get('doc') || k12Docs.defaultSlug}
              defaultSlug={k12Docs.defaultSlug}
            />
          ) : null}
        </div>
      )}

        </div>
      </div>
    </main>
  );
}

export default function CandidatePortalPage() {
  return (
    <Suspense fallback={null}>
      <CandidatePortalContent />
    </Suspense>
  );
}
