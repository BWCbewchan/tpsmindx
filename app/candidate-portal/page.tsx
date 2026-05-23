'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  FileText,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  Route,
  Search,
  UploadCloud,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import GenOverviewTab, { TrainingScheduleEvent } from '../admin/hr-candidates/components/GenOverviewTab';
import K12DocsClient, { K12ClientDocItem, K12ClientDocNode } from '@/components/k12-docs/K12DocsClient';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
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

type CandidateTabId = 'observe' | 'videos' | 'schedule' | 'roadmap' | 'te-leader-info' | 'k12-teaching-policy';

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
const CANDIDATE_TAB_HREFS: Record<CandidateTabId, string> = {
  observe: '/candidate-portal',
  videos: '/candidate-portal/videos',
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

      if (first.startsWith('HCM -')) {
        currentArea = first.replace('HCM -', '').trim();
        contacts.push({
          area: currentArea,
          center: currentArea,
          name: second,
          role: third,
          phone: fourth,
          email: fifth,
        });
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
  const [k12Docs, setK12Docs] = useState<CandidateK12Docs | null>(null);
  const [loadingK12Docs, setLoadingK12Docs] = useState(false);
  const [k12DocsError, setK12DocsError] = useState('');
  const [teLeaderContacts, setTeLeaderContacts] = useState<TeLeaderContact[]>([]);
  const [loadingTeLeaderContacts, setLoadingTeLeaderContacts] = useState(false);
  const [teLeaderContactsError, setTeLeaderContactsError] = useState('');
  const [teLeaderSearch, setTeLeaderSearch] = useState('');

  const allowedTabs = useMemo(() => {
    const tabs: CandidateTab[] = [
      { id: 'roadmap', label: 'Lộ trình đào tạo', href: CANDIDATE_TAB_HREFS.roadmap },
      { id: 'observe', label: 'Quản lý dự thính', href: CANDIDATE_TAB_HREFS.observe },
    ];
    if (!profile) return tabs;
    const perms = profile.permissions || [];
    
    if (perms.some(p => p === '/admin/hr-onboarding/videos')) {
      tabs.push({ id: 'videos', label: 'Video Đào tạo đầu vào', href: CANDIDATE_TAB_HREFS.videos });
    }
    
    if (perms.some(p => p === '/admin/hr-candidates/gen-planner/overview' || p === '/admin/hr-candidates')) {
      tabs.push({ id: 'schedule', label: 'Lịch đào tạo', href: CANDIDATE_TAB_HREFS.schedule });
    }

    tabs.push(
      { id: 'te-leader-info', label: 'Thông tin TE/Leader', href: CANDIDATE_TAB_HREFS['te-leader-info'] },
      { id: 'k12-teaching-policy', label: 'Quy trình quy định K12 Teaching', href: CANDIDATE_TAB_HREFS['k12-teaching-policy'] }
    );
    
    return tabs;
  }, [profile]);

  const renderTabIcon = (tabId: CandidateTabId) => {
    if (tabId === 'videos') return <Video className="h-3.5 w-3.5" />;
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
      const res = await fetch('/api/hr/onboarding/videos');
      const data = await res.json();
      if (data.success) {
        setVideos(((data.data || []) as CandidateVideo[]).filter((v) => v.status === 'active'));
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

    return Array.from(managerMap.values()).map((manager) => ({
      ...manager,
      centers: manager.centers.sort((a, b) => a.localeCompare(b, 'vi')),
    }));
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
    return filteredTeLeaderManagers.reduce<Record<string, TeLeaderManager[]>>((groups, manager) => {
      const key = manager.area || 'Khác';
      groups[key] = groups[key] || [];
      groups[key].push(manager);
      return groups;
    }, {});
  }, [filteredTeLeaderManagers]);

  useEffect(() => {
    const stored = window.localStorage.getItem('candidatePortalProfile');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CandidateProfile;
        setProfile(parsed);
        setCurrentGen(
          parsed.current_gen_name
            ? {
                id: parsed.current_gen_id || 0,
                genCode: parsed.current_gen_name,
                regionCode: parsed.region_code || '',
                regionName: parsed.region_name || '',
              }
            : null
        );
        fetchSessions(parsed.candidate_id);
        fetchTrainingSchedules(parsed.candidate_id);
        return;
      } catch {
        window.localStorage.removeItem('candidatePortalProfile');
      }
    }
    router.replace('/login?role=candidate');
  }, [fetchSessions, fetchTrainingSchedules, router]);

  function handleLogout() {
    setProfile(null);
    setSessions([]);
    setVideos([]);
    setK12Docs(null);
    setCurrentGen(null);
    setTrainingSchedules([]);
    window.localStorage.removeItem('candidatePortalProfile');
    router.replace('/login?role=candidate');
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
        className={`fixed inset-y-0 left-0 z-sidebar-custom h-dvh max-h-dvh w-56 overflow-hidden border-r border-gray-200 bg-white/95 shadow-xl backdrop-blur-xl transition-all duration-500 ease-in-out will-change-transform md:w-[300px] ${
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
                isDesktopSidebarOpen ? 'md:ml-[300px] md:w-[calc(100%_-_300px)]' : 'md:ml-0 md:w-full'
              }`
            : `mx-auto px-4 pb-6 pt-20 transition-all duration-500 sm:px-6 md:px-8 md:pt-6 ${
                isDesktopSidebarOpen
                  ? 'md:ml-[300px] md:w-[calc(100%_-_300px)] md:max-w-none'
                  : 'md:ml-0 md:w-full md:max-w-none'
              }`
        }
      >
        <div className="min-w-0">
      {activeTab === 'observe' && (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] animate-in fade-in duration-300">
          <section className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="bg-primary p-6 text-primary-foreground">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-primary-foreground/80">Tiến độ dự thính</p>
                    <h2 className="mt-1 text-3xl font-bold">{submittedCount}/5 bài</h2>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSubmitMessage('');
                      setIsObserveModalOpen(true);
                    }}
                    className="h-10 shrink-0 border-0 bg-primary-foreground font-bold text-primary shadow-sm hover:bg-primary-foreground/90 hover:text-primary"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Nộp thu hoạch
                  </Button>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-primary-foreground/20">
                  <div className="h-full rounded-full bg-primary-foreground transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border p-4 text-center">
                <div>
                  <p className="text-xl font-bold text-foreground">{submittedCount}</p>
                  <p className="text-xs font-semibold text-muted-foreground">Đã nộp</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-success">{approvedCount}</p>
                  <p className="text-xs font-semibold text-muted-foreground">Đã duyệt</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-primary">{Math.max(0, 5 - submittedCount)}</p>
                  <p className="text-xs font-semibold text-muted-foreground">Còn lại</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Lịch sử nộp thu hoạch</h2>
                <p className="text-sm text-muted-foreground">HR sẽ kiểm tra và duyệt từng bài nộp.</p>
              </div>
            </div>

            {loadingSessions ? (
              <div className="flex h-52 items-center justify-center text-muted-foreground">
                <LoadingSpinner size="md" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted text-center">
                <FileText className="mb-3 h-11 w-11 text-muted-foreground/50" />
                <p className="font-bold text-foreground">Chưa có bài thu hoạch</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Sau khi nộp, bài thu hoạch sẽ xuất hiện tại đây để theo dõi trạng thái.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const status = getStatusConfig(session.status);
                  return (
                    <article key={session.id} className="rounded-xl border border-border bg-muted p-4 transition hover:border-primary/30 hover:bg-primary/5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${status.className}`}>{status.label}</span>
                            <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
                              {session.class_type}
                            </span>
                          </div>
                          <h3 className="mt-3 font-bold text-foreground">{session.center_code}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Ngày dự thính: {new Date(session.observe_date).toLocaleDateString('vi-VN')}
                          </p>
                        </div>

                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                        >
                        <a
                          href={session.harvest_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Xem file
                          <ExternalLink className="h-3.5 w-3.5" />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
          onClick={() => setIsObserveModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white/95 shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="observe-submit-title"
          >
            <div className="border-b border-white/20 bg-linear-to-r from-[#a1001f] to-[#c41230] p-5 text-white shadow-md">
              <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="observe-submit-title" className="text-lg font-bold leading-tight text-white">
                    Nộp thu hoạch dự thính
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-white/80">
                    Hoàn thiện thông tin buổi observe và tải file thu hoạch từ máy tính.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="h-9 rounded-xl border border-white/25 bg-white font-bold text-[#a1001f] shadow-sm hover:bg-white/90 hover:text-[#a1001f]"
                >
                  <a href={HARVEST_TEMPLATE_URL} download>
                    <Download className="h-4 w-4" />
                    Tải mẫu
                  </a>
                </Button>
              <button
                type="button"
                onClick={() => setIsObserveModalOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Đóng modal"
              >
                <X className="h-5 w-5" />
              </button>
              </div>
              </div>
            </div>

            <div className="max-h-[76vh] overflow-y-auto px-5 py-4">
              <div className="mb-4 rounded-xl border border-[#a1001f]/10 bg-[#a1001f]/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Quy trình dự thính tại cơ sở</p>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      Trước khi nộp thu hoạch, ứng viên cần đối chiếu với mục Đào tạo tại cơ sở trong Quy Trình, Quy Định K12 Teaching.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-9 shrink-0 rounded-xl bg-white font-semibold">
                    <a href={K12_ONSITE_TRAINING_URL} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Xem quy trình
                    </a>
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-600">
                    <MapPin className="h-3.5 w-3.5" /> Cơ sở
                  </span>
                  <select
                    value={form.center_code}
                    onChange={(event) => setForm((prev) => ({ ...prev, center_code: event.target.value }))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/25"
                  >
                    {CENTER_OPTIONS.map((center) => (
                      <option key={center} value={center}>
                        {center}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-600">
                      <CalendarDays className="h-3.5 w-3.5" /> Ngày dự thính
                    </span>
                    <input
                      type="date"
                      value={form.observe_date}
                      onChange={(event) => setForm((prev) => ({ ...prev, observe_date: event.target.value }))}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/25"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-600">
                      <Building2 className="h-3.5 w-3.5" /> Hình thức lớp
                    </span>
                    <select
                      value={form.class_type}
                      onChange={(event) => setForm((prev) => ({ ...prev, class_type: event.target.value }))}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/25"
                    >
                      {CLASS_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-600">
                    <FileText className="h-3.5 w-3.5" /> File thu hoạch
                  </span>
                  <input
                    key={fileInputKey}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg,image/webp"
                    onChange={(event) => setHarvestFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 file:mr-4 file:rounded-lg file:border-0 file:bg-[#a1001f] file:px-3 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-[#8a001a] focus:outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/25"
                  />
                  {harvestFile && (
                    <span className="mt-2 block truncate text-xs font-semibold text-gray-500">
                      Đã chọn: {harvestFile.name}
                    </span>
                  )}
                </label>

                {submitMessage && (
                  <div className="rounded-xl border border-[#a1001f]/20 bg-[#a1001f]/10 px-4 py-3 text-sm font-semibold text-[#a1001f]">
                    {submitMessage}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-100 bg-white p-5">
              <Button
                type="button"
                onClick={handleSubmitObserve}
                loading={submitting}
                variant="mindx"
                className="rounded-xl font-semibold"
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
            <h2 className="text-xl font-bold text-foreground mb-1">Video Đào tạo đầu vào</h2>
            <p className="text-sm text-muted-foreground mb-6">Danh sách các video hướng dẫn và quy trình đào tạo dành cho ứng viên mới.</p>
            
            {loadingVideos ? (
              <div className="flex h-52 items-center justify-center text-muted-foreground">
                <LoadingSpinner size="md" />
              </div>
            ) : videos.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted text-center">
                <Video className="mb-3 h-11 w-11 text-muted-foreground/50" />
                <p className="font-bold text-foreground">Chưa có video đào tạo</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Hãy quay lại sau khi HR cập nhật danh sách video.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((video) => (
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
                    <h2 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">Lộ trình đào tạo</h2>
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
                <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2 shadow-sm sm:min-h-[340px] lg:min-h-[430px] xl:min-h-[500px]">
                  <img
                    src={ROADMAP_ILLUSTRATION_URL}
                    alt="Lộ trình đào tạo đầu vào"
                    className="h-auto max-h-full w-full object-contain"
                  />
                </div>
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

      {activeTab === 'te-leader-info' && (
        <div className="animate-in fade-in duration-300">
          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-primary px-5 py-5 text-primary-foreground sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                    <UsersRound className="h-3.5 w-3.5" />
                    Candidate Portal
                  </div>
                  <h1 className="mt-3 text-2xl font-bold text-primary-foreground sm:text-3xl">
                    Thông tin TE/Leader
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-primary-foreground/80 sm:text-base">
                    Danh sách TEGL, Leader và Teacher Coordinator theo từng cơ sở để ứng viên liên hệ trong quá trình đào tạo tại cơ sở.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={teLeaderSearch}
                  onChange={(event) => setTeLeaderSearch(event.target.value)}
                  placeholder="Tìm theo cơ sở, tên, vai trò, SĐT hoặc email..."
                  className="h-12 w-full rounded-lg border border-border bg-background pl-11 pr-4 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              {loadingTeLeaderContacts ? (
                <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
                  <LoadingSpinner size="md" />
                </div>
              ) : teLeaderContactsError ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm font-semibold text-destructive">
                  {teLeaderContactsError}
                </div>
              ) : filteredTeLeaderManagers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm font-semibold text-muted-foreground">
                  Không tìm thấy TE/Leader phù hợp.
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(teLeaderManagersByArea).map(([area, managers]) => (
                    <section key={area} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                          <Building2 className="h-5 w-5 text-primary" />
                          {area}
                        </h2>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                          {managers.length} nhân sự
                        </span>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        {managers.map((manager, index) => (
                          <article
                            key={`${area}-${manager.name}-${manager.role}-${index}`}
                            className="rounded-xl border border-border bg-background p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                  Ban quản lý
                                </p>
                                <h3 className="mt-2 text-lg font-bold text-foreground">{manager.name}</h3>
                              </div>
                              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                                {manager.role}
                              </span>
                            </div>

                            <div className="mt-4 grid gap-2 text-sm font-semibold text-muted-foreground sm:grid-cols-2">
                              {manager.phone && (
                                <a href={`tel:${manager.phone}`} className="inline-flex items-center gap-2 hover:text-primary">
                                  <Phone className="h-4 w-4" />
                                  {manager.phone}
                                </a>
                              )}
                              {manager.email && (
                                <a href={`mailto:${manager.email}`} className="inline-flex min-w-0 items-center gap-2 hover:text-primary">
                                  <Mail className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{manager.email}</span>
                                </a>
                              )}
                            </div>

                            <div className="mt-4 rounded-lg border border-border bg-muted/60 p-3">
                              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                Cơ sở quản lý
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {manager.centers.map((center) => (
                                  <span
                                    key={`${manager.name}-${center}`}
                                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-foreground"
                                  >
                                    {center}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'k12-teaching-policy' && (
        <div className="animate-in fade-in duration-300">
          {loadingK12Docs ? (
            <div className="flex h-[60vh] items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm">
              <LoadingSpinner size="md" />
            </div>
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
