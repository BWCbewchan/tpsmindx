'use client';

import { authHeaders } from '@/lib/auth-headers';
import { toast } from '@/lib/app-toast';
import { useAuth } from '@/lib/auth-context';
import type { StudentPortfolioData, StudentPortfolioRecord } from '@/lib/student-portfolio/types';
import { generateSlug } from '@/lib/utils';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Brain,
  Camera,
  Code2,
  Eye,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Trophy,
  User,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type SectionId =
  | 'profile'
  | 'journey'
  | 'skills'
  | 'dna'
  | 'projects'
  | 'gallery'
  | 'awards'
  | 'rewards';

const sections: Array<{ id: SectionId; label: string; icon: React.ElementType }> = [
  { id: 'profile', label: 'Thông tin học viên', icon: User },
  { id: 'journey', label: 'Lộ trình học tập', icon: BookOpen },
  { id: 'skills', label: 'Kỹ năng (Cứng & Mềm)', icon: Layers },
  { id: 'dna', label: 'DNA Năng lực & Đánh giá', icon: Brain },
  { id: 'projects', label: 'Dự án / Sản phẩm', icon: Sparkles },
  { id: 'gallery', label: 'Thư viện hình ảnh', icon: Camera },
  { id: 'awards', label: 'Thành tích & Chứng nhận', icon: Award },
  { id: 'rewards', label: 'Điểm thưởng & Hoạt động', icon: Trophy },
];

function getRecommendedSkillsForCourse(courseLineOrName: string) {
  const text = (courseLineOrName || '').toUpperCase();

  if (text.includes('C4K') || text.includes('KID') || text.includes('SCRATCH') || text.includes('GAME')) {
    return {
      hardSkills: ['Lập trình Kịch bản Game', 'Tư duy Thuật toán 2D', 'Lập trình Trò chơi Điện tử', 'Thiết kế Giao diện Ứng dụng', 'Logic Cấu trúc Điều kiện'],
      softSkills: ['Tư duy Sáng tạo', 'Thuyết trình Sản phẩm', 'Giải quyết Vấn đề', 'Kiên trì Sửa lỗi'],
      technologies: ['Scratch', 'Construct', 'App Lab', 'Canva'],
    };
  }
  if (text.includes('XART') || text.includes('DESIGN') || text.includes('VISUAL') || text.includes('ART')) {
    return {
      hardSkills: ['Chỉnh sửa Ảnh Chuyên nghiệp', 'Thiết kế Đồ họa Vector', 'Giao diện Người dùng', 'Phối màu và Bố cục', 'Kể chuyện bằng Hình ảnh'],
      softSkills: ['Tư duy Thẩm mỹ', 'Tiếp nhận Lắng nghe Góp ý', 'Thuyết trình Ý tưởng Thiết kế', 'Quản lý Tiến độ Thiết kế'],
      technologies: ['Photoshop', 'Illustrator', 'Figma', 'Procreate'],
    };
  }
  if (text.includes('ROB') || text.includes('BOT') || text.includes('MAKER')) {
    return {
      hardSkills: ['Lập trình Mạch Điều khiển', 'Lắp ráp Cảm biến Điện tử', 'Mạch Điện Cơ bản', 'Thuật toán Điều khiển Môtơ'],
      softSkills: ['Khéo léo Kỹ thuật', 'Tư duy Hệ thống', 'Làm việc Nhóm', 'Thử nghiệm và Tối ưu'],
      technologies: ['Arduino', 'C/C++', 'Tinkercad', 'Sensors'],
    };
  }
  return {
    hardSkills: ['Lập trình Trang Web', 'Ngôn ngữ Lập trình Python', 'Xây dựng Ứng dụng', 'Thiết kế Cơ sở Dữ liệu', 'Quản lý Mã nguồn'],
    softSkills: ['Tư duy Logic', 'Làm việc Nhóm', 'Tự Nghiên cứu Tài liệu', 'Phản biện Giải thuật'],
    technologies: ['HTML/CSS', 'JavaScript', 'React', 'Node.js', 'Python', 'Git'],
  };
}

const emptyData = (params: URLSearchParams): StudentPortfolioData => {
  const studentName = params.get('studentName') || 'Học viên MindX';
  const className = params.get('className') || '';
  const courseLine = params.get('courseLine') || '';
  const courseName = params.get('courseName') || courseLine || 'Khóa học MindX';
  const submissionTitle = params.get('submissionTitle') || 'Sản phẩm cuối khóa';
  const submissionLink = params.get('submissionLink') || '';
  const studentId = params.get('studentId') || '';

  const rec = getRecommendedSkillsForCourse(courseLine || courseName);

  return {
    profile: {
      studentName,
      slug: generateSlug(studentName),
      className,
      classId: params.get('classId') || '',
      studentId,
      centreName: params.get('centreName') || '',
      courseLine,
      courseName,
      teacherName: params.get('teacherName') || '',
      headline: `${studentName} đang biến ý tưởng thành sản phẩm có thể chia sẻ.`,
      intro:
        'Portfolio này ghi lại hành trình học tập, kỹ năng nổi bật và những sản phẩm mà học viên đã xây dựng tại MindX.',
    },
    learningJourney: [
      { title: courseName, code: className, status: 'Đang diễn ra', description: 'Theo dõi tiến độ học tập và sản phẩm cuối khóa từ LMS.' },
    ],
    hardSkills: rec.hardSkills.map((name) => ({ name })),
    softSkills: rec.softSkills.map((name) => ({ name })),
    dnaScores: [],
    mindsetScores: [],
    orientationScores: [],
    projects: submissionLink
      ? [
          {
            title: submissionTitle,
            course: courseName,
            description: '',
            link: submissionLink,
            featured: true,
          },
        ]
      : [],
    technologies: rec.technologies,
    gallery: [],
    achievements: [],
    rewards: { points: 0, history: [] },
    customSections: [],
    quote: '',
    visibility: 'public',
  };
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  rightSlot,
  disabled = false,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rightSlot?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-neutral-500">
        <span>{label}</span>
        {rightSlot}
      </span>
      <input
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`h-11 w-full rounded-lg border px-3 text-sm font-medium outline-none transition ${
          disabled
            ? 'cursor-not-allowed border-neutral-100 bg-neutral-100 text-neutral-600'
            : 'border-neutral-100 bg-neutral-50 text-neutral-800 focus:border-mindx-red focus:bg-white focus:ring-4 focus:ring-mindx-red/10'
        }`}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-neutral-500">{label}</span>
      <textarea
        value={value || ''}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-800 outline-none transition focus:border-mindx-red focus:bg-white focus:ring-4 focus:ring-mindx-red/10"
      />
    </label>
  );
}

function LmsTag() {
  return null;
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
      {label}
    </div>
  );
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-neutral-900">{title}</h2>
        <p className="mt-1 text-xs text-neutral-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  tone = 'neutral',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger'
          ? 'border border-red-100 bg-red-50 text-red-600 hover:bg-red-100'
          : 'border border-neutral-200 bg-white text-neutral-700 hover:border-mindx-red/30 hover:bg-rose-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function PortfolioBuilderPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ portfolioKey: string }>();
  const [portfolio, setPortfolio] = useState<StudentPortfolioRecord | null>(null);
  const [data, setData] = useState<StudentPortfolioData>(() => emptyData(searchParams));
  const [active, setActive] = useState<SectionId>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hardSkillDraft, setHardSkillDraft] = useState('');
  const [softSkillDraft, setSoftSkillDraft] = useState('');
  const [internshipDraft, setInternshipDraft] = useState('');
  const [isSyncingJourney, setIsSyncingJourney] = useState(false);

  const studentId = searchParams.get('studentId') || '';
  const classId = searchParams.get('classId') || '';
  const publicUrl = portfolio?.public_slug ? `/public/portfolio/${portfolio.public_slug}` : '';
  const isLmsSynced = useCallback(
    (field: string) => Boolean(data.lmsSyncedFields?.includes(field)),
    [data.lmsSyncedFields],
  );

  const handleSyncLmsJourney = async () => {
    const sId = studentId || data.profile.studentId || '';
    if (!sId) {
      toast.error('Không tìm thấy Student ID của học viên để tải từ LMS');
      return;
    }
    setIsSyncingJourney(true);
    try {
      const res = await fetch(`/api/admin/portfolio/students/${sId}/study-classes`, {
        headers: authHeaders(token),
      });
      const resData = await res.json();
      if (resData.success && resData.data?.length > 0) {
        setData((prev) => ({
          ...prev,
          learningJourney: resData.data,
          profile: { ...prev.profile, studentId: sId },
        }));
        toast.success(`Đã tự động đồng bộ ${resData.data.length} khóa học từ LMS!`);
      } else {
        toast.error(resData.error || 'Không tìm thấy dữ liệu khóa học trên LMS');
      }
    } catch {
      toast.error('Lỗi kết nối server khi tải lộ trình học tập');
    } finally {
      setIsSyncingJourney(false);
    }
  };

  const updateProfile = (patch: Partial<StudentPortfolioData['profile']>) => {
    setData((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
  };

  const updateData = (patch: Partial<StudentPortfolioData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const autoFetchLmsData = useCallback(async (sId: string) => {
    if (!sId) return;
    try {
      const journeyRes = await fetch(`/api/admin/portfolio/students/${sId}/study-classes`, {
        headers: authHeaders(token),
      }).then((r) => r.json()).catch(() => null);

      if (journeyRes?.success && journeyRes.data?.length > 0) {
        setData((prev) => ({
          ...prev,
          learningJourney: journeyRes.data,
          profile: { ...prev.profile, studentId: sId },
        }));
      }
    } catch {
      // Silently continue if LMS background auto-fetch has transient network issue
    }
  }, [token]);

  const loadPortfolio = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '';
      if (params.portfolioKey !== 'new') {
        url = `/api/admin/portfolio/portfolios/${params.portfolioKey}`;
      } else if (studentId && classId) {
        const query = new URLSearchParams({
          studentId,
          classId,
          studentName: searchParams.get('studentName') || '',
          className: searchParams.get('className') || '',
          centreName: searchParams.get('centreName') || '',
          courseName: searchParams.get('courseName') || '',
          courseLine: searchParams.get('courseLine') || '',
          teacherName: searchParams.get('teacherName') || '',
        });
        url = `/api/admin/portfolio/portfolios?${query.toString()}`;
      }
      if (!url) return;
      const res = await fetch(url, { headers: authHeaders(token), cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.portfolio) {
        setPortfolio(json.portfolio);
        setData(json.portfolio.data);
        const sId = studentId || json.portfolio.student_lms_id || json.portfolio.data?.profile?.studentId || '';
        if (sId) {
          autoFetchLmsData(sId);
        }
      } else if (json.success && json.seedData) {
        setData(json.seedData);
        const sId = studentId || json.seedData?.profile?.studentId || '';
        if (sId) {
          autoFetchLmsData(sId);
        }
      } else if (studentId) {
        autoFetchLmsData(studentId);
      }
    } catch {
      toast.error('Không thể tải portfolio');
    } finally {
      setIsLoading(false);
    }
  }, [autoFetchLmsData, classId, params.portfolioKey, searchParams, studentId, token]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const persistPortfolio = async (): Promise<StudentPortfolioRecord> => {
    const nextData = {
      ...data,
      profile: {
        ...data.profile,
        slug: generateSlug(data.profile.slug || data.profile.studentName),
      },
    };
    const method = portfolio?.id ? 'PUT' : 'POST';
    const url = portfolio?.id
      ? `/api/admin/portfolio/portfolios/${portfolio.id}`
      : '/api/admin/portfolio/portfolios';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({
        studentId: studentId || nextData.profile.classId || params.portfolioKey,
        classId: classId || nextData.profile.classId || 'manual',
        studentName: nextData.profile.studentName,
        className: nextData.profile.className,
        centreName: nextData.profile.centreName,
        courseName: nextData.profile.courseName,
        courseLine: nextData.profile.courseLine,
        status: nextData.visibility === 'private' ? 'draft' : 'published',
        data: nextData,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Không thể lưu portfolio');
    setPortfolio(json.portfolio);
    setData(json.portfolio.data);
    if (params.portfolioKey === 'new') {
      router.replace(`/admin/portfolio/builder/${json.portfolio.id}?studentId=${encodeURIComponent(json.portfolio.student_lms_id)}&classId=${encodeURIComponent(json.portfolio.class_lms_id)}`);
    }
    return json.portfolio;
  };

  const savePortfolio = async () => {
    setIsSaving(true);
    try {
      await persistPortfolio();
      toast.success('Đã lưu portfolio');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu portfolio');
    } finally {
      setIsSaving(false);
    }
  };

  const previewPortfolio = async (modeOverride?: 'private' | 'public') => {
    setIsSaving(true);
    try {
      const saved = await persistPortfolio();
      const slugToOpen = data.profile.slug || saved?.public_slug || '';
      const modeParam = modeOverride ? `?mode=${modeOverride}` : (data.visibility === 'private' ? '?mode=private' : '?mode=public');
      const url = `/public/portfolio/${encodeURIComponent(slugToOpen)}${modeParam}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success(
        (modeOverride || data.visibility) === 'private'
          ? 'Đã mở xem Bản thô (Dữ liệu tự động LMS)'
          : 'Đã mở xem Bản tùy chỉnh (Hiển thị đầy đủ)',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xem portfolio');
    } finally {
      setIsSaving(false);
    }
  };

  const content = useMemo(() => {
    if (active === 'profile') {
      return (
        <SectionShell
          title="Thông tin cá nhân học viên"
          description="Trường đã đồng bộ từ LMS sẽ được khóa; trường LMS chưa có dữ liệu vẫn có thể nhập bổ sung."
        >
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <Field label="Họ và tên học viên" value={data.profile.studentName} onChange={(v) => updateProfile({ studentName: v })} rightSlot={isLmsSynced('profile.studentName') ? <LmsTag /> : null} disabled={isLmsSynced('profile.studentName')} />
            <Field label="Public URL Slug" value={data.profile.slug} onChange={(v) => updateProfile({ slug: v })} />
            <Field label="Avatar Image URL" value={data.profile.avatarUrl} onChange={(v) => updateProfile({ avatarUrl: v })} rightSlot={<LmsTag />} disabled={isLmsSynced('profile.avatarUrl')} />
            <Field label="Email học viên/phụ huynh" value={data.profile.studentEmail} onChange={(v) => updateProfile({ studentEmail: v })} rightSlot={<LmsTag />} disabled={isLmsSynced('profile.studentEmail')} />
            <Field label="Số điện thoại liên hệ" value={data.profile.phone} onChange={(v) => updateProfile({ phone: v })} rightSlot={<LmsTag />} disabled={isLmsSynced('profile.phone')} />
            <Field label="Họ và tên phụ huynh" value={data.profile.parentName} onChange={(v) => updateProfile({ parentName: v })} rightSlot={isLmsSynced('profile.parentName') ? <LmsTag /> : null} disabled={isLmsSynced('profile.parentName')} />
            <Field label="Tuổi học viên" value={data.profile.age} onChange={(v) => updateProfile({ age: v })} />
            <Field label="Lớp LMS" value={data.profile.className} onChange={(v) => updateProfile({ className: v })} rightSlot={<LmsTag />} disabled={isLmsSynced('profile.className')} />
            <Field label="Cơ sở" value={data.profile.centreName} onChange={(v) => updateProfile({ centreName: v })} rightSlot={<LmsTag />} disabled={isLmsSynced('profile.centreName')} />
            <Field label="Khóa / Course Line" value={data.profile.courseName} onChange={(v) => updateProfile({ courseName: v })} rightSlot={isLmsSynced('profile.courseName') ? <LmsTag /> : null} disabled={isLmsSynced('profile.courseName')} />
            <Field label="Giáo viên phụ trách" value={data.profile.teacherName} onChange={(v) => updateProfile({ teacherName: v })} rightSlot={isLmsSynced('profile.teacherName') ? <LmsTag /> : null} disabled={isLmsSynced('profile.teacherName')} />
          </div>
        </SectionShell>
      );
    }
    if (active === 'journey') {
      const locked = false;
      return (
        <SectionShell title="Lộ trình học tập" description="Hiển thị toàn bộ khóa học của học viên tại MindX, mỗi khóa là một mốc riêng.">
          <div className="max-w-3xl space-y-3 border-l border-neutral-200 pl-6">
            {data.learningJourney.map((item, index) => (
              <div key={index} className="relative rounded-lg px-1 py-2">
                <span className="absolute -left-[31px] top-4 h-3 w-3 rounded-full bg-mindx-red ring-4 ring-white" />
                <div className="grid gap-2 md:grid-cols-[1.1fr_150px_130px_32px]">
                  <input
                    className="h-8 rounded-md border border-transparent bg-transparent px-2 text-sm font-bold text-neutral-900 outline-none hover:border-neutral-200 hover:bg-neutral-50 focus:border-mindx-red focus:bg-white"
                    value={item.title}
                    disabled={locked}
                    onChange={(event) => updateData({ learningJourney: data.learningJourney.map((it, i) => i === index ? { ...it, title: event.target.value } : it) })}
                  />
                  <input
                    className="h-8 rounded-md border border-transparent bg-transparent px-2 text-xs font-semibold text-neutral-600 outline-none hover:border-neutral-200 hover:bg-neutral-50 focus:border-mindx-red focus:bg-white"
                    value={item.code || ''}
                    placeholder="Mã lớp"
                    disabled={locked}
                    onChange={(event) => updateData({ learningJourney: data.learningJourney.map((it, i) => i === index ? { ...it, code: event.target.value } : it) })}
                  />
                  <input
                    className="h-8 rounded-md border border-transparent bg-emerald-50 px-2 text-xs font-bold text-emerald-700 outline-none focus:border-mindx-red focus:bg-white"
                    value={item.status || ''}
                    placeholder="Trạng thái"
                    disabled={locked}
                    onChange={(event) => updateData({ learningJourney: data.learningJourney.map((it, i) => i === index ? { ...it, status: event.target.value } : it) })}
                  />
                  <button type="button" onClick={() => updateData({ learningJourney: data.learningJourney.filter((_, i) => i !== index) })} className="grid h-8 w-8 place-items-center rounded-md text-neutral-300 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  className="mt-1 h-7 w-full rounded-md border border-transparent bg-transparent px-2 text-xs text-neutral-500 outline-none hover:border-neutral-200 hover:bg-neutral-50 focus:border-mindx-red focus:bg-white"
                  value={item.period || ''}
                  placeholder="Ngày bắt đầu / khoảng thời gian"
                  disabled={locked}
                  onChange={(event) => updateData({ learningJourney: data.learningJourney.map((it, i) => i === index ? { ...it, period: event.target.value } : it) })}
                />
              </div>
            ))}
          </div>
          <ActionButton onClick={() => updateData({ learningJourney: [...data.learningJourney, { title: 'Khóa học mới', status: 'Đang diễn ra' }] })}>
            <Plus className="h-4 w-4" />
            Thêm lộ trình
          </ActionButton>
        </SectionShell>
      );
    }
    if (active === 'skills') {
      const handleLoadRecommendedSkills = () => {
        const rec = getRecommendedSkillsForCourse(data.profile.courseLine || data.profile.courseName || '');
        updateData({
          hardSkills: rec.hardSkills.map((name) => ({ name })),
          softSkills: rec.softSkills.map((name) => ({ name })),
          technologies: Array.from(new Set([...data.technologies, ...rec.technologies])),
        });
        toast.success(`Đã tự động tải bộ kỹ năng gợi ý cho khóa ${data.profile.courseLine || data.profile.courseName || 'học'}!`);
      };

      return (
        <SectionShell title="Kỹ năng mềm và kỹ năng chuyên môn" description="Mỗi kỹ năng hiển thị như chip/card nhỏ trên trang public.">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={handleLoadRecommendedSkills}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3.5 py-2 text-xs font-bold text-mindx-red hover:bg-rose-100 transition shadow-sm"
            >
              <Sparkles className="h-4 w-4 text-mindx-red" />
              Tải gợi ý kỹ năng cho {data.profile.courseLine || data.profile.courseName || 'Khóa học'}
            </button>
          </div>
          <div className="space-y-7">
            {([
              {
                key: 'hardSkills',
                title: 'Kỹ năng cứng (Lập trình, công nghệ...)',
                Icon: Code2,
                draft: hardSkillDraft,
                setDraft: setHardSkillDraft,
                placeholder: 'Thêm kỹ năng cứng',
              },
              {
                key: 'softSkills',
                title: 'Kỹ năng mềm (Thuyết trình, làm việc nhóm...)',
                Icon: Sparkles,
                draft: softSkillDraft,
                setDraft: setSoftSkillDraft,
                placeholder: 'Thêm kỹ năng mềm...',
              },
            ] as const).map(({ key, title, Icon, draft, setDraft, placeholder }) => (
              <div key={key} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-800">
                  <Icon className="h-4 w-4 text-mindx-red" />
                  {title}
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_74px]">
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={placeholder}
                    className="h-10 rounded-lg border border-neutral-100 bg-neutral-50 px-3 text-sm outline-none focus:border-mindx-red focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const value = draft.trim();
                      if (!value) return;
                      updateData({ [key]: [...data[key], { name: value }] } as Partial<StudentPortfolioData>);
                      setDraft('');
                    }}
                    className="h-10 rounded-lg bg-[#111827] px-4 text-sm font-bold text-white hover:bg-black"
                  >
                    Thêm
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data[key].map((skill, index) => (
                    <span key={`${skill.name}-${index}`} className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm">
                      <input
                        value={skill.name}
                        onChange={(event) => updateData({ [key]: data[key].map((it, i) => i === index ? { ...it, name: event.target.value } : it) } as Partial<StudentPortfolioData>)}
                        className="w-32 bg-transparent outline-none"
                      />
                      <button type="button" onClick={() => updateData({ [key]: data[key].filter((_, i) => i !== index) } as Partial<StudentPortfolioData>)} className="text-neutral-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionShell>
      );
    }
    if (active === 'dna') {
      const locked = false;
      const setScoreSection = (
        key: 'checkpoint1Score' | 'checkpoint2Score' | 'demoScore' | 'tbckScore' | 'rank',
        value: string,
      ) => {
        const numeric = value.trim() === '' ? null : Number(value);
        updateData({
          academicSummary: {
            ...(data.academicSummary || {}),
            [key === 'rank' ? 'rank' : key]: key === 'rank' ? value : (Number.isFinite(numeric) ? numeric : null),
          },
        });
      };

      const groups = [
        {
          key: 'dnaScores',
          title: 'NHÓM 1: TƯ DUY & NĂNG LỰC CỐT LÕI',
          dot: 'bg-emerald-500',
          accent: 'accent-emerald-600',
          text: 'text-emerald-700',
        },
        {
          key: 'mindsetScores',
          title: 'NHÓM 2: KỸ THUẬT & THỰC HÀNH DỰ ÁN',
          dot: 'bg-blue-500',
          accent: 'accent-blue-600',
          text: 'text-blue-700',
        },
      ] as const;

      return (
        <SectionShell title="DNA Năng lực & Kết quả Học tập" description="Theo dõi điểm số Checkpoint thực tế từ LMS và đánh giá các trục năng lực học tập cốt lõi của học viên.">
          <div className="space-y-6">
            <div className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-rose-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-mindx-red flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-mindx-red" />
                  1. Điểm kiểm tra Checkpoint & Kết quả LMS
                </h3>
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-mindx-red">Dữ liệu từ LMS</span>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <Field
                  label="Checkpoint 1"
                  placeholder="0 - 10"
                  value={data.academicSummary?.checkpoint1Score != null ? String(data.academicSummary.checkpoint1Score) : ''}
                  onChange={(v) => setScoreSection('checkpoint1Score', v)}
                />
                <Field
                  label="Checkpoint 2"
                  placeholder="0 - 10"
                  value={data.academicSummary?.checkpoint2Score != null ? String(data.academicSummary.checkpoint2Score) : ''}
                  onChange={(v) => setScoreSection('checkpoint2Score', v)}
                />
                <Field
                  label="SPCK / Demo Score"
                  placeholder="0 - 10"
                  value={data.academicSummary?.demoScore != null ? String(data.academicSummary.demoScore) : ''}
                  onChange={(v) => setScoreSection('demoScore', v)}
                />
                <Field
                  label="TBCK Score"
                  placeholder="0 - 10"
                  value={data.academicSummary?.tbckScore != null ? String(data.academicSummary.tbckScore) : ''}
                  onChange={(v) => setScoreSection('tbckScore', v)}
                />
                <Field
                  label="Xếp loại học tập"
                  placeholder="Xuất sắc / Giỏi / Khá"
                  value={data.academicSummary?.rank || ''}
                  onChange={(v) => setScoreSection('rank', v)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {groups.map((group) => {
              const scores = (data[group.key] && data[group.key].length > 0)
                ? data[group.key]
                : (group.key === 'dnaScores'
                    ? [
                        { label: 'Tư duy Thuật toán', value: 4.5 },
                        { label: 'Tư duy Sáng tạo', value: 4.8 },
                        { label: 'Giải quyết Vấn đề', value: 4.2 },
                        { label: 'Khả năng Tự học', value: 4.0 },
                      ]
                    : [
                        { label: 'Kỹ năng Lập trình & Thiết kế', value: 4.5 },
                        { label: 'Hoàn thiện Sản phẩm', value: 4.6 },
                        { label: 'Thuyết trình Dự án', value: 4.3 },
                        { label: 'Làm việc Nhóm', value: 4.4 },
                      ]);
              return (
                <div key={group.key} className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-5 shadow-sm">
                  <div className={`mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-wide ${group.text}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${group.dot}`} />
                    {group.title}
                  </div>
                  <div className="space-y-5">
                    {scores.map((score, index) => (
                      <div key={index} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-xs font-bold text-neutral-800 outline-none hover:border-neutral-200 hover:bg-white focus:border-mindx-red"
                            value={score.label}
                            disabled={locked}
                            onChange={(event) => updateData({ [group.key]: scores.map((it, i) => i === index ? { ...it, label: event.target.value } : it) } as Partial<StudentPortfolioData>)}
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-black ${group.text}`}>{score.value}/5</span>
                            <button type="button" disabled={locked} onClick={() => updateData({ [group.key]: scores.filter((_, i) => i !== index) } as Partial<StudentPortfolioData>)} className="text-neutral-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={5}
                          step={0.1}
                          value={score.value}
                          disabled={locked}
                          onChange={(event) => updateData({ [group.key]: scores.map((it, i) => i === index ? { ...it, value: Number(event.target.value) } : it) } as Partial<StudentPortfolioData>)}
                          className={`w-full ${group.accent}`}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => updateData({ [group.key]: [...scores, { label: 'Tiêu chí mới', value: 4.0 }] } as Partial<StudentPortfolioData>)}
                      className="mt-2 text-xs font-bold text-neutral-500 hover:text-mindx-red disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      + Thêm tiêu chí đánh giá
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </SectionShell>
      );
    }
    if (active === 'projects') {
      const locked = false;
      return (
        <SectionShell title="Dự án & sản phẩm của học viên" description="Mỗi sản phẩm là một card có ảnh, link và mô tả riêng.">
          <div className="space-y-5 border-l border-neutral-200 pl-6">
            {data.projects.map((project, index) => (
              <div key={index} className="relative rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <span className="absolute -left-[31px] top-8 h-3 w-3 rounded-full bg-mindx-red ring-4 ring-white" />
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={project.course || data.profile.courseName || ''}
                      disabled={locked}
                      onChange={(event) => updateData({ projects: data.projects.map((it, i) => i === index ? { ...it, course: event.target.value } : it) })}
                      className="h-8 rounded-md border border-transparent bg-transparent px-1 text-sm font-bold text-neutral-900 outline-none hover:border-neutral-200 hover:bg-neutral-50 focus:border-mindx-red focus:bg-white"
                    />
                    <span className="rounded bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700">
                      Mã lớp: {data.profile.className || 'Chưa có'}
                    </span>
                  </div>
                  <ActionButton tone="danger" onClick={() => updateData({ projects: data.projects.filter((_, i) => i !== index) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa
                  </ActionButton>
                </div>

                <div className="rounded-xl bg-neutral-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <input
                        className="h-8 w-full rounded-md border border-transparent bg-transparent px-1 text-sm font-bold text-neutral-900 outline-none hover:border-neutral-200 hover:bg-white focus:border-mindx-red"
                        value={project.title}
                        disabled={locked}
                        onChange={(event) => updateData({ projects: data.projects.map((it, i) => i === index ? { ...it, title: event.target.value } : it) })}
                      />
                      <p className="text-xs text-neutral-500">Sản phẩm học viên</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                      <input
                        type="checkbox"
                        checked={Boolean(project.featured)}
                        disabled={locked}
                        onChange={(event) => updateData({ projects: data.projects.map((it, i) => i === index ? { ...it, featured: event.target.checked } : it) })}
                        className="accent-mindx-red"
                      />
                      Nổi bật (Featured)
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                    <div className="space-y-2">
                      <div className="h-24 overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-rose-100 to-amber-100">
                        {project.imageUrl ? (
                          <img src={project.imageUrl} alt={project.title || 'Project'} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-neutral-400">
                            <ImageIcon className="h-7 w-7" />
                          </div>
                        )}
                      </div>
                      <input
                        value={project.imageUrl || ''}
                        disabled={locked}
                        onChange={(event) => updateData({ projects: data.projects.map((it, i) => i === index ? { ...it, imageUrl: event.target.value } : it) })}
                        placeholder="Image URL"
                        className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-xs outline-none focus:border-mindx-red"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-blue-500" />
                        <input
                          value={project.link || ''}
                          disabled={locked}
                          onChange={(event) => updateData({ projects: data.projects.map((it, i) => i === index ? { ...it, link: event.target.value } : it) })}
                          placeholder="File sản phẩm / link sản phẩm"
                          className="h-9 min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-mindx-red"
                        />
                      </div>
                      {project.link ? (
                        <a
                          href={project.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {project.attachmentName || 'Tải file sản phẩm'}
                        </a>
                      ) : null}
                      {locked ? (
                        <div>
                          <span className="mb-1.5 block text-xs font-semibold text-neutral-500">Mô tả sản phẩm</span>
                          <div className="min-h-24 rounded-lg border border-neutral-100 bg-neutral-100 px-3 py-2.5 text-sm text-neutral-600">
                            {project.description || 'Chưa có mô tả từ LMS'}
                          </div>
                        </div>
                      ) : (
                        <TextArea label="Mô tả sản phẩm" rows={4} value={project.description} onChange={(v) => updateData({ projects: data.projects.map((it, i) => i === index ? { ...it, description: v } : it) })} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <ActionButton onClick={() => updateData({ projects: [...data.projects, { title: 'Sản phẩm mới', course: data.profile.courseName, description: '', featured: data.projects.length === 0 }] })}>
              <Plus className="h-4 w-4" />
              Thêm sản phẩm
            </ActionButton>
          </div>
        </SectionShell>
      );
    }

    if (active === 'gallery') {
      return (
        <SectionShell title="Thư viện hình ảnh" description="Mỗi ảnh là một URL, hệ thống hiển thị preview để kiểm tra nhanh.">
          <div className="grid gap-4 md:grid-cols-2">
            {data.gallery.map((url, index) => (
              <div key={index} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                <div className="mb-3 h-36 overflow-hidden rounded-lg bg-neutral-100">
                  {url ? <img src={url} alt={`Gallery ${index + 1}`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-neutral-400"><ImageIcon className="h-7 w-7" /></div>}
                </div>
                <div className="flex gap-2">
                  <input value={url} onChange={(event) => updateData({ gallery: data.gallery.map((it, i) => i === index ? event.target.value : it) })} placeholder="Image URL" className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-mindx-red" />
                  <button type="button" onClick={() => updateData({ gallery: data.gallery.filter((_, i) => i !== index) })} className="grid h-10 w-10 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {data.gallery.length === 0 ? <EmptyHint label="Chưa có hình ảnh nào trong thư viện." /> : null}
          <ActionButton onClick={() => updateData({ gallery: [...data.gallery, ''] })}>
            <Plus className="h-4 w-4" />
            Thêm hình ảnh
          </ActionButton>
        </SectionShell>
      );
    }
    if (active === 'awards') {
      return (
        <SectionShell title="Thành tích & chứng nhận" description="Các thành tích sẽ lên dạng card ở cuối portfolio public.">
          <div className="grid gap-4 md:grid-cols-2">
            {data.achievements.map((award, index) => (
              <div key={index} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <Award className="h-5 w-5 text-mindx-red" />
                  <ActionButton tone="danger" onClick={() => updateData({ achievements: data.achievements.filter((_, i) => i !== index) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa
                  </ActionButton>
                </div>
                <div className="space-y-3">
                  <Field label="Tên thành tích" value={award.title} onChange={(v) => updateData({ achievements: data.achievements.map((it, i) => i === index ? { ...it, title: v } : it) })} />
                  <Field label="Mô tả" value={award.subtitle} onChange={(v) => updateData({ achievements: data.achievements.map((it, i) => i === index ? { ...it, subtitle: v } : it) })} />
                </div>
              </div>
            ))}
          </div>
          <ActionButton onClick={() => updateData({ achievements: [...data.achievements, { title: 'Thành tích mới', subtitle: '' }] })}>
            <Plus className="h-4 w-4" />
            Thêm thành tích
          </ActionButton>
        </SectionShell>
      );
    }
    if (active === 'rewards') {
      return (
        <SectionShell title="Điểm thưởng & hoạt động" description="Theo dõi điểm thưởng LMS và các hoạt động nổi bật của học viên.">
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-white text-2xl font-black text-amber-600 shadow-sm">
                {data.rewards.points || 0}
              </div>
              <label className="block min-w-0 flex-1">
                <span className="mb-1.5 block text-xs font-semibold text-neutral-500">Điểm thưởng hiện tại</span>
                <input
                  type="number"
                  min={0}
                  value={Number.isFinite(Number(data.rewards.points)) ? data.rewards.points : 0}
                  onChange={(event) => updateData({ rewards: { ...(data.rewards || { points: 0, history: [] }), points: Number(event.target.value) || 0 } })}
                  className="h-11 w-full rounded-lg border border-neutral-100 bg-white px-3 text-sm font-medium text-neutral-800 outline-none transition focus:border-mindx-red focus:ring-4 focus:ring-mindx-red/10"
                />
              </label>
            </div>
          </div>
          <div className="space-y-3">
            {data.rewards.history.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-neutral-200 bg-white p-3 md:grid-cols-[1fr_1fr_40px]">
                <input value={item.title} onChange={(event) => updateData({ rewards: { ...data.rewards, history: data.rewards.history.map((it, i) => i === index ? { ...it, title: event.target.value } : it) } })} placeholder="Hoạt động" className="h-10 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-mindx-red" />
                <input value={item.subtitle || ''} onChange={(event) => updateData({ rewards: { ...data.rewards, history: data.rewards.history.map((it, i) => i === index ? { ...it, subtitle: event.target.value } : it) } })} placeholder="Điểm/ngày" className="h-10 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-mindx-red" />
                <button type="button" onClick={() => updateData({ rewards: { ...data.rewards, history: data.rewards.history.filter((_, i) => i !== index) } })} className="grid h-10 w-10 place-items-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <ActionButton onClick={() => updateData({ rewards: { ...data.rewards, history: [...data.rewards.history, { title: '', subtitle: '' }] } })}>
            <Plus className="h-4 w-4" />
            Thêm hoạt động
          </ActionButton>
        </SectionShell>
      );
    }
    return (
      <SectionShell title="Mục tùy chỉnh" description="Thêm các khối nội dung riêng cho học viên và câu quote cuối trang.">
        <TextArea label="Câu quote cuối trang" rows={3} value={data.quote} onChange={(v) => updateData({ quote: v })} />
        <div className="space-y-3">
          {data.customSections.map((section, index) => (
            <div key={index} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex justify-end">
                <ActionButton tone="danger" onClick={() => updateData({ customSections: data.customSections.filter((_, i) => i !== index) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </ActionButton>
              </div>
              <div className="space-y-3">
                <Field label="Tiêu đề" value={section.title} onChange={(v) => updateData({ customSections: data.customSections.map((it, i) => i === index ? { ...it, title: v } : it) })} />
                <TextArea label="Nội dung" value={section.content} rows={4} onChange={(v) => updateData({ customSections: data.customSections.map((it, i) => i === index ? { ...it, content: v } : it) })} />
              </div>
            </div>
          ))}
        </div>
        <ActionButton onClick={() => updateData({ customSections: [...data.customSections, { title: 'Mục mới', content: '' }] })}>
          <Plus className="h-4 w-4" />
          Thêm mục tùy chỉnh
        </ActionButton>
      </SectionShell>
    );
  }, [active, data, hardSkillDraft, internshipDraft, isLmsSynced, softSkillDraft]);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-mindx-red" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f6] px-4 py-5">
      <div className="mx-auto max-w-[1360px] space-y-5">
      <div className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-[0_8px_28px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin/kiem-soat-spck" className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold text-neutral-900">{data.profile.studentName}</h1>
              {data.profile.courseLine ? <span className="rounded bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">{data.profile.courseLine}</span> : null}
            </div>
            <p className="truncate text-xs text-neutral-500">
              Lớp: {data.profile.className || 'Chưa có'} · Cơ sở: {data.profile.centreName || 'Chưa có'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={data.visibility}
            onChange={(event) => updateData({ visibility: event.target.value === 'private' ? 'private' : 'public' })}
            className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700"
          >
            <option value="private">Bản thô (Chỉ dữ liệu LMS)</option>
            <option value="public">Bản tùy chỉnh (Đầy đủ phần chuẩn bị)</option>
          </select>
          <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50" onClick={() => {
            loadPortfolio();
            toast.success('Đang làm mới dữ liệu từ LMS');
          }}>
            <GraduationCap className="h-4 w-4" />
            Làm mới dữ liệu
          </button>
          <button
            type="button"
            onClick={() => previewPortfolio('private')}
            disabled={isSaving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            title="Xem giao diện Bản thô (Tự động ẩn các tab nhập thủ công)"
          >
            <Eye className="h-3.5 w-3.5" />
            Xem bản Thô
          </button>
          <button
            type="button"
            onClick={() => previewPortfolio('public')}
            disabled={isSaving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
            title="Xem giao diện Bản tùy chỉnh (Hiển thị đầy đủ tất cả các tab)"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Xem bản Tùy chỉnh
          </button>
          <button
            onClick={savePortfolio}
            disabled={isSaving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-mindx-red px-4 text-xs font-bold text-white shadow-sm hover:bg-mindx-red-dark disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu thay đổi
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="self-start rounded-xl border border-neutral-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] lg:sticky lg:top-24">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Các phần hiển thị</p>
          <div className="space-y-1.5">
            {sections.map((section) => {
              const Icon = section.icon;
              const selected = active === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActive(section.id)}
                  className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition ${
                    selected
                      ? 'bg-rose-50 text-mindx-red shadow-inner'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-h-[640px] rounded-xl border border-neutral-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          {content}
        </section>
      </div>
      </div>
    </div>
  );
}
