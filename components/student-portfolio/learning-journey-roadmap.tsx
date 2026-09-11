'use client';

import { Award, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';
import type { StudentPortfolioData } from '@/lib/student-portfolio/types';

interface LearningJourneyRoadmapProps {
  journey: StudentPortfolioData['learningJourney'];
  projects?: StudentPortfolioData['projects'];
  theme: {
    ink: string;
    accent: string;
    surface: string;
    label: string;
  };
  sectionNo: string;
}

function scoreText(value?: number | null) {
  return typeof value === 'number' ? value.toFixed(1).replace(/\.0$/, '') : '';
}

function normalizeStatus(value?: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isCompletedLearningStatus(status?: string) {
  const text = normalizeStatus(status);
  return text.includes('finished') || text.includes('da hoan thanh');
}

function isRunningLearningStatus(status?: string) {
  const text = normalizeStatus(status);
  return text.includes('running') || text.includes('dang dien ra');
}

function awardTone(level?: string, title?: string) {
  const text = (title || '').toLowerCase();
  if (level === 'gold' || text.includes('nhat') || text.includes('nhất')) {
    return { bg: '#fffbeb', border: '#fde68a', ink: '#b45309', medal: '#f59e0b' };
  }
  if (level === 'silver' || text.includes('nhi') || text.includes('nhì')) {
    return { bg: '#f8fafc', border: '#cbd5e1', ink: '#475569', medal: '#64748b' };
  }
  if (level === 'bronze' || text.includes('ba')) {
    return { bg: '#fff7ed', border: '#fed7aa', ink: '#c2410c', medal: '#d97706' };
  }
  return { bg: '#f0f9ff', border: '#bae6fd', ink: '#0369a1', medal: '#0284c7' };
}

function sameText(a?: string, b?: string) {
  if (!a || !b) return false;
  const clean = (s: string) => normalizeStatus(s).replace(/[^a-z0-9]/g, '');
  return clean(a).includes(clean(b)) || clean(b).includes(clean(a));
}

function sameClassCode(a?: string, b?: string) {
  if (!a || !b) return false;
  return normalizeStatus(a).replace(/[^a-z0-9]/g, '') === normalizeStatus(b).replace(/[^a-z0-9]/g, '');
}

function projectAnchorId(index: number) {
  return `portfolio-project-${index + 1}`;
}

function projectHasContent(project?: StudentPortfolioData['projects'][number]) {
  if (!project) return false;
  return Boolean(
    project.link ||
      project.imageUrl ||
      project.imageUrls?.length ||
      project.videoUrls?.length ||
      project.attachmentUrls?.length ||
      project.relatedUrls?.length
  );
}

export function LearningJourneyRoadmap({
  journey,
  projects = [],
  theme,
  sectionNo,
}: LearningJourneyRoadmapProps) {
  if (!journey || journey.length === 0) return null;

  const scrollToProject = (index: number) => {
    const el = document.getElementById(projectAnchorId(index));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const projectsSec = document.getElementById('projects');
      if (projectsSec) projectsSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section id="journey" className="mx-auto max-w-6xl px-5 py-10 scroll-mt-12 sm:py-20">
      {/* Section Header */}
      <div className="mb-8 sm:mb-12">
        <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: theme.ink }}>
          {sectionNo} · LỘ TRÌNH HỌC TẬP
        </p>
        <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#171512]">
          Học đến đâu, làm ra đến đó.
        </h2>
        <p className="mt-2.5 text-base text-[#55504a] font-medium">
          Mỗi môn học là một cột mốc tích lũy kỹ năng và hoàn thiện sản phẩm sáng tạo.
        </p>
      </div>

      {/* Timeline List (Responsive Vertical Layout) */}
      <div className="space-y-8 sm:space-y-10 border-l-2 border-[#ded6c9] pl-5 sm:pl-7 md:pl-8 ml-2 sm:ml-4">
        {journey.map((item, index) => {
          const isCompleted = isCompletedLearningStatus(item.status);
          const statusLabel = isCompleted ? 'Hoàn thành' : isRunningLearningStatus(item.status) ? 'Đang diễn ra' : item.status || 'Đang diễn ra';
          const cp1 = scoreText(item.cp1Score);
          const cp2 = scoreText(item.cp2Score);
          const demo = scoreText(item.demoScore);
          const tbck = scoreText(item.tbckScore);
          const award = item.awardTitle ? awardTone(item.awardLevel, item.awardTitle) : null;
          const displayDate = item.period || (item.code ? `Mã môn: ${item.code}` : '');

          const projectIndexByClass = projects.findIndex(
            (proj) => projectHasContent(proj) && sameClassCode(proj.classCode, item.code)
          );
          const projectIndex = projectIndexByClass >= 0
            ? projectIndexByClass
            : projects.findIndex(
                (proj) =>
                  projectHasContent(proj) &&
                  (sameText(proj.course, item.title) ||
                    sameText(proj.course, item.code) ||
                    sameText(proj.title, item.title) ||
                    sameText(proj.title, item.code))
              );
          const hasMatchedProject = projectIndex >= 0;
          const matchedProject = hasMatchedProject ? projects[projectIndex] : null;
          const projectImage = matchedProject?.imageUrl || matchedProject?.imageUrls?.[0];

          return (
            <div key={`${item.title}-${index}`} className="relative grid gap-4 sm:gap-6 md:grid-cols-[220px_1fr]">
              {/* Green / Accent Node Dot on Line (Precisely aligned to line) */}
              <span
                className="absolute -left-[29px] sm:-left-[37px] md:-left-[41px] top-6 sm:top-7 h-4 w-4 sm:h-5 sm:w-5 rounded-full border-3 sm:border-4 border-white shadow-xs"
                style={{ backgroundColor: isCompleted ? '#16a34a' : theme.ink }}
              />

              {/* Left Column: Course Title & Start Date */}
              <div>
                <h3 className="text-base sm:text-lg font-extrabold leading-snug text-[#171512]">{item.title}</h3>
                {displayDate ? (
                  <p className="mt-1 text-xs font-semibold text-[#777067]">
                    {displayDate.startsWith('Ngày') ? displayDate : `Thời gian: ${displayDate}`}
                  </p>
                ) : null}
              </div>

              {/* Right Column: Clean White Card (Clickable to scroll to project) */}
              <div
                onClick={hasMatchedProject ? () => scrollToProject(projectIndex) : undefined}
                className={`group relative overflow-hidden rounded-2xl border border-[#e4ded6] bg-white p-4 sm:p-6 md:p-7 shadow-[0_8px_24px_rgba(23,21,18,0.04)] transition-all duration-300 ${
                  hasMatchedProject
                    ? 'cursor-pointer hover:-translate-y-1 hover:border-[#cbd5e1] hover:shadow-[0_16px_36px_rgba(23,21,18,0.09)]'
                    : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#8b8176]">
                      {item.title}
                    </p>
                    <h3 className="mt-1.5 break-words text-2xl sm:text-[26px] font-extrabold leading-tight text-[#bd0026]">
                      {item.code ? `Lớp: ${item.code}` : item.title}
                    </h3>
                  </div>

                  {/* Status & Score Badges */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {cp1 ? (
                      <span className="rounded-full border border-[#e5ded5] bg-[#faf8f5] px-3.5 py-1.5 text-xs font-extrabold text-[#171512]">
                        CP1 {cp1}
                      </span>
                    ) : null}
                    {cp2 ? (
                      <span className="rounded-full border border-[#e5ded5] bg-[#faf8f5] px-3.5 py-1.5 text-xs font-extrabold text-[#171512]">
                        CP2 {cp2}
                      </span>
                    ) : null}
                    {demo ? (
                      <span className="rounded-full border border-[#e5ded5] bg-[#faf8f5] px-3.5 py-1.5 text-xs font-extrabold text-[#171512]">
                        SPCK {demo}
                      </span>
                    ) : null}
                    {tbck ? (
                      <span className="rounded-full border border-[#e5ded5] bg-[#faf8f5] px-3.5 py-1.5 text-xs font-extrabold text-[#171512]">
                        TBCK {tbck}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-extrabold ${
                        isCompleted
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-sky-200 bg-sky-50 text-sky-800'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}
                      <span>{statusLabel}</span>
                    </span>
                  </div>
                </div>

                {/* Award Badge (Image 1 Style) */}
                {award && item.awardTitle ? (
                  <div className="mt-4">
                    <span
                      className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-extrabold shadow-2xs"
                      style={{
                        backgroundColor: award.bg,
                        borderColor: award.border,
                        color: award.ink,
                      }}
                    >
                      <Award className="h-4 w-4" style={{ color: award.medal, fill: award.medal }} />
                      <span>{item.awardTitle}</span>
                    </span>
                  </div>
                ) : null}

                {/* Teacher Comment (Summarized 2-3 positive lines from session 14) */}
                {item.finalComment ? (
                  <p className="mt-4 text-sm font-medium leading-relaxed text-[#4e4740] border-t border-[#f3eee7] pt-4">
                    {item.finalComment}
                  </p>
                ) : null}

                {/* Project Thumbnail Image Preview */}
                {matchedProject ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollToProject(projectIndex >= 0 ? projectIndex : 0);
                    }}
                    className="mt-4 flex flex-col sm:flex-row items-stretch gap-4 rounded-xl border border-[#e5ded5] bg-[#faf8f5] p-3.5 transition-all hover:bg-white hover:shadow-md hover:border-[#cbd5e1]"
                  >
                    {projectImage ? (
                      <div className="relative h-32 sm:h-24 w-full sm:w-36 shrink-0 overflow-hidden rounded-lg border border-[#e2dcd3] bg-[#171512]">
                        <img
                          src={projectImage}
                          alt={matchedProject.title || 'Sản phẩm cuối khóa'}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : null}
                    <div className="flex flex-col justify-center min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-[#bd0026]">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Sản phẩm cuối khóa</span>
                      </div>
                      <h4 className="mt-1 text-sm font-extrabold text-[#171512] truncate">
                        {matchedProject.title || 'Dự án thực hành cuối khóa'}
                      </h4>
                      {matchedProject.description ? (
                        <p className="mt-1 text-xs font-medium text-[#666057] line-clamp-2">
                          {matchedProject.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* Click Hint Footer */}
                {matchedProject ? (
                  <div className="mt-4 flex items-center justify-end gap-1.5 text-xs font-extrabold text-[#bd0026] opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Xem chi tiết sản phẩm dự án</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
