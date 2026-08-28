import { cookies } from 'next/headers';
import { verifySessionCookieValue, TPS_SESSION_COOKIE } from '@/lib/session-cookie';
import { getPublishedPortfolioBySlug } from '@/lib/student-portfolio/service';
import type { StudentPortfolioData } from '@/lib/student-portfolio/types';
import { Award, Bot, Brush, Code2, ExternalLink, Star } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectCardShowcase } from '@/components/student-portfolio/project-card-showcase';
import { GalleryShowcase } from '@/components/student-portfolio/gallery-showcase';
import { LearningJourneyRoadmap } from '@/components/student-portfolio/learning-journey-roadmap';
import { PortfolioMobileMenu } from '@/components/student-portfolio/portfolio-mobile-menu';
import { PortfolioPdfDownloadButton } from '@/components/student-portfolio/portfolio-pdf-download-button';
import { PortfolioSideProgressNav } from '@/components/student-portfolio/portfolio-side-progress-nav';
import logoTechAi from '@/logo_tech_ai.jpg';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function DnaRadarChart({ scores, accent = '#bd0026' }: { scores: Array<{ label: string; value: number }>; accent?: string }) {
  const items = scores && scores.length > 0 ? scores : [
    { label: 'Tư duy Logic & Thuật toán', value: 4.5 },
    { label: 'Kỹ thuật Lập trình', value: 4.6 },
    { label: 'Giải quyết Vấn đề', value: 4.3 },
    { label: 'Hoàn thiện Sản phẩm', value: 4.7 },
    { label: 'Tự học & Sáng tạo', value: 4.4 },
  ];

  const size = 300;
  const center = size / 2;
  const radius = 95;
  const total = items.length;

  const getCoordinates = (index: number, val: number) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const r = (val / 5) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y, angle };
  };

  const polygonPoints = items
    .map((item, i) => {
      const { x, y } = getCoordinates(i, item.value);
      return `${x},${y}`;
    })
    .join(' ');

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <svg width={size} height={size} className="overflow-visible">
        {gridLevels.map((lvl, idx) => {
          const levelPoints = items
            .map((_, i) => {
              const { x, y } = getCoordinates(i, 5 * lvl);
              return `${x},${y}`;
            })
            .join(' ');
          return (
            <polygon
              key={idx}
              points={levelPoints}
              fill={idx % 2 === 0 ? 'rgba(230, 223, 212, 0.3)' : 'none'}
              stroke="#ded6c9"
              strokeWidth="1.5"
              strokeDasharray={idx === gridLevels.length - 1 ? 'none' : '3 3'}
            />
          );
        })}

        {items.map((_, i) => {
          const { x, y } = getCoordinates(i, 5);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#d8d0c2"
              strokeWidth="1.5"
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill={accent}
          opacity="0.22"
          stroke={accent}
          strokeWidth="3"
        />

        {items.map((item, i) => {
          const { x, y, angle } = getCoordinates(i, item.value);
          const labelDist = radius + 32;
          const lx = center + labelDist * Math.cos(angle);
          const ly = center + labelDist * Math.sin(angle);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill={accent} />
              <circle cx={x} cy={y} r="9" fill={accent} opacity="0.22" />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-[#171512] text-[11px] font-black"
              >
                {item.label} ({item.value})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DnaBarChart({ scores, accent = '#bd0026' }: { scores: Array<{ label: string; value: number }>; accent?: string }) {
  const items = scores && scores.length > 0 ? scores : [
    { label: 'Kỹ năng Lập trình & Thiết kế', value: 4.5 },
    { label: 'Hoàn thiện Sản phẩm', value: 4.6 },
    { label: 'Thuyết trình Dự án', value: 4.3 },
    { label: 'Làm việc Nhóm', value: 4.4 },
  ];

  return (
    <div className="space-y-4 p-2">
      {items.map((item, idx) => {
        const pct = Math.max(0, Math.min(100, (item.value / 5) * 100));
        return (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#171512]">
              <span>{item.label}</span>
              <span className="font-black" style={{ color: accent }}>{item.value} / 5</span>
            </div>
            <div className="h-3.5 w-full overflow-hidden rounded-full bg-[#f0eae1] p-0.5 shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: accent }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function normalizeTrack(value?: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

type PortfolioTrack = 'coding' | 'robotics' | 'art';

function detectPortfolioTrack(value?: string): PortfolioTrack | null {
  const text = normalizeTrack(value);
  if (/\b(rob[a-z0-9]*|robot[a-z0-9]*|robotics)\b/.test(text)) return 'robotics';
  if (/\b(c4k[a-z0-9]*|c4t[a-z0-9]*|pt[a-z0-9]*|scratch|coding|code|js[a-z0-9]*|web|cs[a-z0-9]*|computer scientist|app producer|python)\b/.test(text)) return 'coding';
  if (/\b(xart[a-z0-9]*|art|fine art|creative art|my thuat|ve thuat)\b/.test(text)) return 'art';
  return null;
}

function scoreText(value?: number | null) {
  return typeof value === 'number' ? value.toFixed(1).replace(/\.0$/, '') : '';
}

function isVisibleLearningStatus(status?: string) {
  const text = normalizeTrack(status).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!text) return false;
  return (
    text.includes('running') ||
    text.includes('finished') ||
    text.includes('dang dien ra') ||
    text.includes('da hoan thanh')
  );
}

function isHiddenLearningItem(item: StudentPortfolioData['learningJourney'][number]) {
  const text = normalizeTrack([item.status, item.title, item.code, item.description].filter(Boolean).join(' '))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return (
    text.includes('suspended') ||
    text.includes('cancelled') ||
    text.includes('canceled') ||
    text.includes('cancel') ||
    text.includes('da huy') ||
    /\bhuy\b/.test(text)
  );
}

function isCompletedLearningStatus(status?: string) {
  const text = normalizeTrack(status).replace(/[^a-z0-9]+/g, ' ').trim();
  return text.includes('finished') || text.includes('da hoan thanh');
}

function projectAnchorId(index: number) {
  return `portfolio-project-${index + 1}`;
}

function awardTone(level?: string, title?: string) {
  const text = (title || '').toLowerCase();
  if (level === 'gold' || text.includes('nhat') || text.includes('nhất')) {
    return { label: 'Giải Nhất', bg: '#fff7d6', border: '#f2c94c', ink: '#8a5a00', medal: '#f59e0b' };
  }
  if (level === 'silver' || text.includes('nhi') || text.includes('nhì')) {
    return { label: 'Giải Nhì', bg: '#f3f4f6', border: '#c7ced8', ink: '#475569', medal: '#64748b' };
  }
  if (level === 'bronze' || text.includes('ba')) {
    return { label: 'Giải Ba', bg: '#fff7ed', border: '#fed7aa', ink: '#c2410c', medal: '#d97706' };
  }
  return { label: 'Giải Khuyến Khích', bg: '#eef7ff', border: '#9cc8ee', ink: '#1d4f7a', medal: '#0284c7' };
}

function portfolioTrack(data: StudentPortfolioData): PortfolioTrack {
  const currentTrack = detectPortfolioTrack([
    data.profile.className,
    data.profile.courseLine,
    data.profile.courseName,
  ].filter(Boolean).join(' '));
  if (currentTrack) return currentTrack;
  return 'coding';
}

const trackTheme = {
  coding: {
    label: 'Lập trình',
    Icon: Code2,
    verb: 'Sáng tạo · Lập trình · Hoàn thiện',
    promise: 'Từ biến những câu hỏi “nếu như?” thành sản phẩm có thể chơi và trải nghiệm.',
    hero: 'from-[#2a050b] via-[#6f0616] to-[#bd0026]',
    cardShadow: 'shadow-[22px_22px_0_rgba(34,34,34,0.08)]',
    surface: 'bg-[#fbfaf7]',
    accent: 'text-[#bd0026]',
    ink: '#bd0026',
  },
  robotics: {
    label: 'Robotics',
    Icon: Bot,
    verb: 'Quan sát · Chuyển động · Giải quyết',
    promise: 'Biến ý tưởng chuyển động thành mô hình có thể quan sát, thử nghiệm và cải tiến.',
    hero: 'from-[#1b1d24] via-[#4a1620] to-[#8f1230]',
    cardShadow: 'shadow-[22px_22px_0_rgba(15,23,42,0.08)]',
    surface: 'bg-[#fbfdff]',
    accent: 'text-[#bd0026]',
    ink: '#bd0026',
  },
  art: {
    label: 'Mỹ thuật Kỹ thuật số',
    Icon: Brush,
    verb: 'Phác thảo · Phối màu · Thể hiện',
    promise: 'Biến quan sát và cảm xúc thành tác phẩm có cá tính, bố cục và câu chuyện riêng.',
    hero: 'from-[#2a050b] via-[#6f0616] to-[#bd0026]',
    cardShadow: 'shadow-[22px_22px_0_rgba(34,34,34,0.08)]',
    surface: 'bg-[#fbfaf7]',
    accent: 'text-[#bd0026]',
    ink: '#bd0026',
  },
} as const;

function sanitizeIntroText(text?: string, studentName: string = '') {
  if (!text) return '';
  const clean = text
    .replace(/.*đang ghi lại hành trình học tập tại MindX\.?/gi, `${studentName ? studentName + ' - ' : ''}Hành trình phát triển tư duy công nghệ và sản phẩm sáng tạo tại MindX.`)
    .replace(/đang ghi lại hành trình học tập/gi, 'hành trình phát triển sản phẩm công nghệ')
    .replace(/Portfolio này tổng hợp dữ liệu học tập, sản phẩm và đánh giá được đồng bộ từ LMS MindX\.?/gi, 'Hồ sơ tổng hợp quá trình học tập, các sản phẩm sáng tạo và đánh giá năng lực của học viên tại Trường học Công nghệ MindX.')
    .replace(/đồng bộ từ LMS MindX\.?/gi, 'tại Trường học Công nghệ MindX.')
    .replace(/đồng bộ từ LMS\.?/gi, 'tại MindX.')
    .replace(/\bLMS\b/gi, 'MindX');
  return clean;
}

export default async function PublicPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const { slug } = await params;
  const query = (await searchParams) || {};
  const portfolio = await getPublishedPortfolioBySlug(decodeURIComponent(slug));
  if (!portfolio) notFound();

  const data = portfolio.data as StudentPortfolioData;
  const profile = data.profile;
  const defaultIsPrivate = portfolio.status === 'draft' || data.visibility === 'private';
  const isPrivateMode = query.mode ? query.mode === 'private' : defaultIsPrivate;
  const isPublicMode = !isPrivateMode;
  const visibleLearningJourney = (data.learningJourney || []).filter(
    (item) => !isHiddenLearningItem(item) && isVisibleLearningStatus(item.status),
  );

  const academicItems = [
    { label: 'Checkpoint 1', value: data.academicSummary?.checkpoint1Score },
    { label: 'Checkpoint 2', value: data.academicSummary?.checkpoint2Score },
    { label: 'Điểm SPCK', value: data.academicSummary?.demoScore },
    { label: 'Điểm TBCK', value: data.academicSummary?.tbckScore },
    {
      label: 'Xếp loại học tập',
      value: data.academicSummary?.rank ? `${data.academicSummary.rank} ${data.academicSummary.rankLabel ? `- ${data.academicSummary.rankLabel}` : ''}` : '',
    },
  ].filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');

  const allSkills = isPublicMode ? [...(data.hardSkills || []), ...(data.softSkills || [])] : [];
  const hasJourney = visibleLearningJourney.length > 0;
  const hasProjects = Boolean(data.projects && data.projects.length > 0);
  const hasResults = Boolean(academicItems.length > 0);

  const hasDna = isPublicMode && Boolean((data.dnaScores && data.dnaScores.length > 0) || (data.mindsetScores && data.mindsetScores.length > 0));
  const hasAchievements = Boolean(data.achievements && data.achievements.length > 0);
  const hasGallery = isPublicMode && Boolean(data.gallery && data.gallery.length > 0);
  const hasRewards = isPublicMode && Boolean(data.rewards && data.rewards.points > 0);
  const hasIntroSection = isPublicMode && Boolean(profile.intro || allSkills.length > 0);
  const currentTrackHint = [profile.className, profile.courseLine, profile.courseName].filter(Boolean).join(' ');
  const track = portfolioTrack(data);
  const theme = trackTheme[track];
  const TrackIcon = theme.Icon;
  const allScores = [...(data.dnaScores || []), ...(data.mindsetScores || []), ...(data.orientationScores || [])];
  const dnaAverage = allScores.length
    ? Math.round((allScores.reduce((sum, score) => sum + Number(score.value || 0), 0) / allScores.length) * 10) / 10
    : null;
  const completedCourses = visibleLearningJourney.filter((item) => isCompletedLearningStatus(item.status)).length;
  const completionRate = visibleLearningJourney.length
    ? Math.round((completedCourses / visibleLearningJourney.length) * 100)
    : 0;
  const heroStats = [
    { value: visibleLearningJourney.length, label: 'Khóa học' },
    { value: data.projects?.length || 0, label: 'Sản phẩm' },
    isPublicMode && dnaAverage !== null
      ? { value: dnaAverage, label: 'Điểm DNA' }
      : { value: profile.courseLine || theme.label, label: 'Khối học' },
  ];
  const bannerStats = [
    { value: visibleLearningJourney.length, label: 'Khóa / Lộ trình học' },
    { value: data.projects?.length || 0, label: 'Sản phẩm hoàn thành' },
    { value: `${completionRate}%`, label: 'Khóa đã hoàn thành' },
    isPublicMode && dnaAverage !== null
      ? { value: `${dnaAverage} / 5`, label: 'Đánh giá Năng lực DNA' }
      : { value: profile.courseLine || theme.label, label: 'Khối học hiện tại' },
  ];
  const rawSubtitle = isPublicMode
    ? (profile.headline || profile.intro)
    : (profile.courseName || profile.className || 'Hồ sơ Học viên MindX');
  const heroSubtitle = sanitizeIntroText(rawSubtitle, profile.studentName) || `${profile.studentName} - Hành trình phát triển sản phẩm sáng tạo tại MindX.`;
  const nameTokens = profile.studentName.split(/\s+/).filter(Boolean);
  const heroLastName = nameTokens.length > 1 ? nameTokens.slice(-1).join(' ') : profile.studentName;
  const heroLeadName = nameTokens.length > 1 ? nameTokens.slice(0, -1).join(' ') : '';
  const visibleSectionKeys = [
    hasIntroSection ? 'intro' : '',
    hasJourney ? 'journey' : '',
    hasProjects ? 'projects' : '',
    hasDna ? 'dna' : '',
    hasResults ? 'results' : '',
    hasGallery ? 'gallery' : '',
    hasAchievements ? 'awards' : '',
    hasRewards ? 'rewards' : '',
  ].filter(Boolean);
  const sectionNo = (key: string) => String(visibleSectionKeys.indexOf(key) + 1).padStart(2, '0');

  const sideNavSections = [
    hasIntroSection ? { id: 'intro', label: 'Giới thiệu' } : null,
    hasJourney ? { id: 'journey', label: 'Lộ trình học tập' } : null,
    hasProjects ? { id: 'projects', label: 'Sản phẩm' } : null,
    hasDna ? { id: 'dna', label: 'Đánh giá DNA' } : null,
    hasResults ? { id: 'results', label: 'Kết quả học tập' } : null,
    hasGallery ? { id: 'gallery', label: 'Thư viện hình ảnh' } : null,
    hasAchievements ? { id: 'awards', label: 'Thành tích' } : null,
    hasRewards ? { id: 'rewards', label: 'Điểm thưởng' } : null,
  ].filter(Boolean) as Array<{ id: string; label: string }>;

  const displayIntro = sanitizeIntroText(profile.intro, profile.studentName) ||
    `Hồ sơ tổng hợp quá trình học tập, các sản phẩm sáng tạo và đánh giá năng lực của học viên ${profile.studentName} tại Trường học Công nghệ MindX.`;

  return (
    <main className={`scroll-smooth min-h-screen ${theme.surface} text-[#171512] antialiased portfolio-theme relative bg-[#faf8f5]`}>
      <div className="portfolio-pdf-brand hidden" style={{ display: 'none' }}>
        <img src={logoTechAi.src} alt="MindX Tech & AI School" />
      </div>

      {/* Floating Side Progress Navigation Bar (Hình 2) */}
      <div className="portfolio-print-hidden print:hidden">
        <PortfolioSideProgressNav sections={sideNavSections} themeColor={theme.ink} />
      </div>

      {/* Header Bar */}
      <header className="portfolio-print-hidden sticky top-0 z-50 border-b border-[#e8e2d8] bg-white/92 backdrop-blur-md transition-all duration-300 print:hidden">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 text-xs font-bold uppercase">
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <img src={logoTechAi.src} alt="MindX Technology School" className="h-10 w-auto max-w-[170px] object-contain sm:h-12" />
            <span className="h-4 w-px bg-[#d8d0c2]" />
            <span className="hidden whitespace-nowrap font-extrabold text-[#423d37] lg:inline">Hồ sơ Học viên MindX</span>
          </div>
          <div className="hidden min-w-0 flex-1 items-center justify-end gap-4 font-bold text-[#55504a] lg:flex xl:gap-6">
            {hasJourney ? <a href="#journey" className={`${theme.accent} whitespace-nowrap transition-colors duration-200`}>Lộ trình</a> : null}
            {hasDna ? <a href="#dna" className={`${theme.accent} whitespace-nowrap transition-colors duration-200`}>DNA Năng lực</a> : null}
            {hasResults ? <a href="#results" className={`${theme.accent} whitespace-nowrap transition-colors duration-200`}>Kết quả</a> : null}
            {hasGallery ? <a href="#gallery" className={`${theme.accent} whitespace-nowrap transition-colors duration-200`}>Thư viện ảnh</a> : null}
            {hasAchievements ? <a href="#awards" className={`${theme.accent} whitespace-nowrap transition-colors duration-200`}>Thành tích</a> : null}
            {hasRewards ? <a href="#rewards" className={`${theme.accent} whitespace-nowrap transition-colors duration-200`}>Điểm thưởng</a> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {hasProjects ? (
              <a
                href="#projects"
                className="hidden whitespace-nowrap rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all duration-200 hover:shadow-md sm:inline-flex"
                style={{ backgroundColor: theme.ink }}
              >
                Khám phá Sản phẩm
              </a>
            ) : null}
            <PortfolioPdfDownloadButton />
            <PortfolioMobileMenu sections={sideNavSections} themeColor={theme.ink} />
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="portfolio-print-section-hero relative overflow-hidden border-b border-[#e8e2d8]/80 bg-gradient-to-b from-white via-[#faf8f5] to-[#fff5f7]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-5 sm:py-16 md:min-h-[620px] md:grid-cols-[minmax(0,1fr)_430px] md:gap-14 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="min-w-0">
          <div className="mb-7 inline-flex max-w-full items-center gap-2 rounded-full border border-[#ded6c9] bg-white/80 px-4 py-1.5 text-xs font-extrabold shadow-2xs" style={{ color: theme.ink }}>
            <TrackIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{theme.label}</span>
            <span className="h-3 w-px bg-[#ded6c9]" />
            <span>Hồ sơ Học viên MindX</span>
          </div>
          <h1 className="max-w-[620px] text-[clamp(42px,5.5vw,72px)] font-extrabold leading-[1.08] tracking-tight text-[#171512]">
            {heroLeadName ? (
              <>
                <span className="block text-balance">{heroLeadName}</span>
                <span className="block text-balance" style={{ color: theme.ink }}>{heroLastName}.</span>
              </>
            ) : (
              <span className="block text-balance" style={{ color: theme.ink }}>{heroLastName}.</span>
            )}
          </h1>
          {heroSubtitle ? (
            <p className="mt-7 max-w-xl text-lg sm:text-xl font-medium leading-relaxed text-[#4a443e]">
              {isPublicMode ? heroSubtitle : theme.promise}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {hasProjects ? (
              <a
                href="#projects"
                className="portfolio-print-hidden inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg print:hidden"
                style={{ backgroundColor: theme.ink }}
              >
                Khám phá sản phẩm <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            {profile.className ? (
              <span className="rounded-full border border-[#ded6c9] bg-white px-5 py-3.5 text-sm font-bold text-[#423d37] shadow-xs">
                Lớp: {profile.className}
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative min-w-0">
          <div className="absolute -inset-x-8 inset-y-10 rounded-[36px] bg-[#bd0026]/10 blur-xl" />
          <div className={`relative rotate-1 overflow-hidden rounded-[32px] bg-gradient-to-br ${theme.hero} p-7 text-white ${theme.cardShadow} transition-all duration-500 ease-out hover:rotate-0 sm:rotate-2 sm:p-10`}>
            <TrackIcon className="absolute right-6 top-24 h-44 w-44 text-white/10" />
            <div className="relative">
            <div className="flex items-center justify-between">
              {/* Larger Avatar Image Container with Crisp Resolution & Initials Fallback */}
              <div className="grid h-20 w-20 sm:h-24 sm:w-24 place-items-center rounded-2xl bg-white/20 text-2xl sm:text-3xl font-extrabold border-2 border-white/30 backdrop-blur-md shadow-xl overflow-hidden shrink-0 aspect-square">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.studentName}
                    className="h-full w-full rounded-2xl object-cover object-center aspect-square"
                  />
                ) : (
                  <span className="tracking-widest text-white">{initials(profile.studentName)}</span>
                )}
              </div>
              <div className="text-right">
                <span className="rounded-full bg-white/20 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white/90">
                  {profile.courseLine || theme.label}
                </span>
              </div>
            </div>

            <div className="mt-10 max-w-[300px]">
              <p className="text-xs font-bold uppercase text-white/60">HỒ SƠ HỌC VIÊN</p>
              <h2 className="mt-2 text-2xl font-black leading-tight sm:text-[28px]">{profile.studentName}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/82">{profile.courseName || profile.className}</p>
              {profile.centreName ? (
                <p className="mt-1 text-xs leading-5 text-white/62">Cơ sở: {profile.centreName}</p>
              ) : null}
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 rounded-2xl bg-black/20 p-4 text-center border border-white/10 backdrop-blur-md">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <p className="truncate text-2xl font-black">{stat.value}</p>
                  <p className="text-[10px] font-bold uppercase text-white/60">{stat.label}</p>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Dark Contrast Intro & Skills Bar */}
      {hasIntroSection ? (
      <section className="portfolio-print-section-intro bg-[#171512] py-10 text-white sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-[240px_1fr]">
          <div>
            <p className="text-xs font-black uppercase" style={{ color: theme.ink }}>{sectionNo('intro')} · Giới thiệu</p>
            <h3 className="mt-2 text-2xl font-black leading-snug">Hành trình & Kỹ năng nổi bật.</h3>
          </div>
          <div>
            <p className="text-xl font-medium leading-relaxed text-white/90">
              {displayIntro}
            </p>
            {allSkills.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2.5">
                {allSkills.map((skill, index) => (
                  <span
                    key={`${skill.name}-${index}`}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white/90 backdrop-blur-sm hover:bg-white/20 transition-all duration-200"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      {/* Red Stat Banner */}
      <section className="border-y border-[#e8e2d8] bg-white py-8 shadow-[0_12px_30px_rgba(23,21,18,0.04)]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 text-center md:grid-cols-4">
          {bannerStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#ece5dc] bg-[#fbfaf7] px-4 py-5">
              <p className="truncate text-3xl font-black text-[#171512]">{stat.value}</p>
              <p className="mt-1.5 text-[11px] font-black uppercase text-[#777067]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Learning Journey Section with organic curved roadmap path (Image 4 style) */}
      {hasJourney ? (
        <LearningJourneyRoadmap
          journey={visibleLearningJourney}
          projects={data.projects}
          theme={{
            ink: theme.ink,
            accent: theme.accent,
            label: theme.label,
            surface: theme.surface,
          }}
          sectionNo={sectionNo('journey')}
        />
      ) : null}

      {/* Projects Section */}
      {hasProjects ? (
        <section id="projects" className="mx-auto max-w-6xl px-5 py-10 scroll-mt-12 sm:py-20">
          <div className="mb-12">
            <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: theme.ink }}>{sectionNo('projects')} · DỰ ÁN NỔI BẬT</p>
            <h2 className="mt-2 text-4xl font-extrabold leading-[1.08] text-[#171512] sm:text-5xl">Dự án & sản phẩm của học viên.</h2>
            <p className="mt-3 text-base text-[#55504a]">Những sản phẩm nổi bật được hoàn thiện trong quá trình học tập tại MindX.</p>
          </div>
          <div className="space-y-6">
            {(data.projects || []).map((project: StudentPortfolioData['projects'][number], index: number) => (
              <div id={projectAnchorId(index)} key={`${project.title}-${index}`} className="scroll-mt-24">
                <ProjectCardShowcase
                  project={project}
                  defaultCourse={profile.courseName || profile.className}
                  trackHint={currentTrackHint}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* DNA Competency Section with SVG Radar Chart */}
      {hasDna ? (
        <section id="dna" className="mx-auto max-w-6xl px-5 py-10 scroll-mt-12 sm:py-24">
          <div className="mb-12">
            <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: theme.ink }}>{sectionNo('dna')} · ĐÁNH GIÁ NĂNG LỰC DNA</p>
            <h2 className="mt-2 text-4xl font-extrabold leading-[1.08] text-[#171512] sm:text-5xl">DNA năng lực & thiên hướng.</h2>
            <p className="mt-3 text-base text-[#55504a]">Bảng phân tích trực quan hai trục năng lực cốt lõi và kỹ thuật thực hành dự án.</p>
          </div>

          {(() => {
            const dnaAvg = data.dnaScores && data.dnaScores.length > 0
              ? (data.dnaScores.reduce((acc, curr) => acc + Number(curr.value || 0), 0) / data.dnaScores.length).toFixed(1)
              : '4.5';
            const mindsetAvg = data.mindsetScores && data.mindsetScores.length > 0
              ? (data.mindsetScores.reduce((acc, curr) => acc + Number(curr.value || 0), 0) / data.mindsetScores.length).toFixed(1)
              : '4.5';
            return (
              <div className="grid gap-8 md:grid-cols-2">
                {/* Nhóm 1: Radar Chart */}
                <div className="rounded-2xl border border-[#e4dcd0] bg-white p-8 shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className="mb-6 flex items-center justify-between border-b border-[#e4dcd0] pb-4">
                    <h3 className="font-extrabold text-xl text-[#171512]">1. Tư duy & Năng lực Cốt lõi</h3>
                    <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-extrabold text-emerald-700">{dnaAvg} / 5.0</span>
                  </div>
                  <DnaRadarChart scores={data.dnaScores || []} accent={theme.ink} />
                </div>

                {/* Nhóm 2: Bar Chart */}
                <div className="rounded-2xl border border-[#e4dcd0] bg-white p-8 shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className="mb-6 flex items-center justify-between border-b border-[#e4dcd0] pb-4">
                    <h3 className="font-extrabold text-xl text-[#171512]">2. Kỹ thuật & Thực hành Dự án</h3>
                    <span className="rounded-full bg-blue-50 px-3.5 py-1 text-xs font-extrabold text-blue-700">{mindsetAvg} / 5.0</span>
                  </div>
                  <DnaBarChart scores={data.mindsetScores || []} accent={theme.ink} />
                </div>
              </div>
            );
          })()}
        </section>
      ) : null}

      {/* Checkpoint Results Section */}
      {hasResults ? (
        <section id="results" className="mx-auto max-w-6xl px-5 py-10 scroll-mt-12 sm:py-16">
          <div className="mb-10">
            <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: theme.ink }}>{sectionNo('results')} · KẾT QUẢ HỌC TẬP</p>
            <h2 className="mt-2 text-4xl font-extrabold leading-[1.08] text-[#171512] sm:text-5xl">Năng lực có căn cứ quan sát.</h2>
            <p className="mt-3 text-base text-[#55504a]">Kết quả điểm số các bài kiểm tra Checkpoint và xếp loại hoàn thành môn học.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {academicItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#e4dcd0] bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-center">
                <p className="text-[11px] font-extrabold uppercase text-[#777067]">{item.label}</p>
                <p className="mt-3 text-3xl font-extrabold" style={{ color: theme.ink }}>{String(item.value)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Gallery Section */}
      {hasGallery ? (
        <section id="gallery" className="mx-auto max-w-6xl px-5 py-10 scroll-mt-12 sm:py-20">
          <div className="mb-12">
            <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: theme.ink }}>{sectionNo('gallery')} · THƯ VIỆN HÌNH ẢNH</p>
            <h2 className="mt-2 text-4xl font-extrabold leading-[1.08] text-[#171512] sm:text-5xl">Thư viện hình ảnh & chứng chỉ.</h2>
            <p className="mt-3 text-base text-[#55504a]">Bộ sưu tập chứng chỉ, bằng cấp và hình ảnh hoạt động học tập tại MindX.</p>
          </div>
          <GalleryShowcase gallery={data.gallery} achievements={data.achievements} />
        </section>
      ) : null}

      {/* Achievements Section */}
      {hasAchievements ? (
        <section id="awards" className="mx-auto max-w-6xl px-5 py-10 scroll-mt-12 sm:py-20">
          <div className="mb-10">
            <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: theme.ink }}>{sectionNo('awards')} · THÀNH TÍCH & GIẢI THƯỞNG</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-extrabold leading-[1.25] text-[#171512]">Thành tích & dấu ấn cá nhân.</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(data.achievements || []).map((award: StudentPortfolioData['achievements'][number], index: number) => {
              const tone = awardTone(award.level, award.title);
              return (
              <article key={`${award.title}-${index}`} className="overflow-hidden rounded-[18px] border border-[#ded6c9] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="relative grid h-32 place-items-center overflow-hidden bg-[#171512]">
                  <div className="absolute -bottom-10 left-6 h-28 w-24 rotate-45 bg-[#bd0026]/70" />
                  <div className="absolute -bottom-8 right-6 h-24 w-24 -rotate-45 bg-white/8" />
                  <div className="relative grid h-16 w-16 place-items-center rounded-full border-4 border-white/55 shadow-lg" style={{ backgroundColor: tone.medal }}>
                    <Award className="h-8 w-8 text-white" fill="white" />
                  </div>
                  <span className="absolute bottom-4 rounded-full bg-white/12 px-3 py-1 text-[9px] font-extrabold uppercase tracking-wide text-white/80">
                    {tone.label}
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-extrabold uppercase" style={{ color: theme.ink }}>Giải thưởng MindX</p>
                  <h3 className="mt-2 font-extrabold text-lg leading-tight text-[#171512]">{award.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#777067]">{award.subtitle || 'MindX Technology School'}</p>
                  {award.date ? <p className="mt-3 text-xs font-bold text-[#9b9288]">{award.date}</p> : null}
                </div>
              </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Rewards & Activities Section */}
      {hasRewards ? (
        <section id="rewards" className="mx-auto max-w-6xl px-5 py-10 scroll-mt-12 sm:py-16">
          <div className="mb-8">
            <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: theme.ink }}>{sectionNo('rewards')} · ĐIỂM THƯỞNG & HOẠT ĐỘNG</p>
            <h2 className="mt-2 text-4xl sm:text-5xl font-extrabold leading-[1.25] text-[#171512]">Điểm thưởng & Hoạt động.</h2>
          </div>
          <div className="rounded-2xl border border-[#ded6c9] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-[#e5ded5] pb-5">
              <div>
                <h3 className="font-extrabold text-lg text-[#171512]">Tổng điểm thưởng tích lũy</h3>
                <p className="text-xs font-semibold text-[#8c8275] mt-0.5">Điểm thưởng ghi nhận từ hệ thống quản lý học tập MindX</p>
              </div>
              <span className="rounded-full bg-rose-50 px-5 py-2 text-lg font-extrabold" style={{ color: theme.ink }}>
                {data.rewards?.points || 0} Điểm
              </span>
            </div>

            {/* Lịch sử điểm thưởng */}
            {data.rewards?.history && data.rewards.history.length > 0 ? (
              <div className="mt-6 space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#777067]">LỊCH SỬ TÍCH LŨY ĐIỂM THƯỞNG</p>
                <div className="space-y-2.5">
                  {data.rewards.history.map((item, idx) => {
                    const isRedeem = item.subtitle?.startsWith('-');
                    return (
                      <div key={idx} className="flex items-center justify-between gap-4 rounded-xl border border-[#e8e2d8] bg-[#faf8f5] p-3.5 sm:p-4 transition-all hover:bg-white hover:shadow-xs">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {item.imageUrl ? (
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#e2dcd3] bg-white p-1 shadow-2xs">
                              <img src={item.imageUrl} alt={item.title || 'Món quà đổi'} className="h-full w-full object-contain" />
                            </div>
                          ) : null}
                          <div className="min-w-0">
                            <p className="font-extrabold text-sm text-[#171512] truncate">{item.title || 'Tích lũy điểm thưởng'}</p>
                            {item.date ? <p className="text-xs font-semibold text-[#8c8275] mt-0.5">{item.date}</p> : null}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-3.5 py-1 text-xs font-extrabold ${
                          isRedeem
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}>
                          {item.subtitle || '+Điểm'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Student Quote Banner */}
      <section className="bg-[#171512] px-5 py-10 text-center text-white sm:py-24">
        <Star className="mx-auto mb-6 h-9 w-9" style={{ color: theme.ink }} />
        <blockquote className="mx-auto max-w-5xl text-balance text-[clamp(22px,4vw,34px)] font-black leading-[1.35] tracking-tight">
          "{data.quote || 'Mỗi lần chương trình bị lỗi là một lần mình hiểu nó rõ hơn.'}"
        </blockquote>
      </section>

      {/* MindX Red Footer */}
      <footer className={`portfolio-print-footer-page bg-gradient-to-r ${theme.hero} px-5 py-12 text-white`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-black">
              Mind<span className="text-white/80">X</span>
            </p>
            <p className="text-xs text-white/80 mt-0.5">Hệ thống Hồ sơ Học viên MindX</p>
          </div>
          <p className="text-xs font-semibold text-white/80">
            Hồ sơ Học viên được xác thực bởi Trường học Công nghệ MindX · {profile.centreName || 'Trường học Công nghệ MindX'}
          </p>
        </div>
      </footer>
    </main>
  );
}
