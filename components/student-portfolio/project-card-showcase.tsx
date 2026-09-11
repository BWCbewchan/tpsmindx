'use client';

import { useMemo, useState } from 'react';
import type { ElementType } from 'react';
import {
  Bot,
  Brush,
  Code2,
  Download,
  ExternalLink,
  Film,
  Gamepad2,
  Image as ImageIcon,
  Maximize2,
  Monitor,
  Play,
  Sparkles,
} from 'lucide-react';
import {
  ProjectMediaGalleryModal,
  type GalleryMediaItem,
} from './project-media-gallery-modal';
import { ScratchPlayerModal } from './scratch-player-modal';

interface ProjectItem {
  title: string;
  course?: string;
  classCode?: string;
  imageUrl?: string | string[];
  imageUrls?: string[];
  videoUrls?: string[];
  attachmentUrls?: string[];
  relatedUrls?: Array<{ name?: string; url: string }>;
  description?: string;
  link?: string;
  attachmentName?: string;
  featured?: boolean;
}

type Track = 'coding' | 'robotics' | 'art';

const TRACKS: Record<Track, {
  label: string;
  icon: ElementType;
  symbol: ElementType;
  shell: string;
  badge: string;
  button: string;
  wash: string;
}> = {
  coding: {
    label: 'Coding',
    icon: Code2,
    symbol: Code2,
    shell: 'from-[#21050a] via-[#7d0019] to-[#ef3340]',
    badge: 'bg-white text-[#bd0026] border-white/40',
    button: 'bg-[#bd0026] text-white hover:bg-[#8e001c]',
    wash: 'bg-[#bd0026]',
  },
  robotics: {
    label: 'Robotics',
    icon: Bot,
    symbol: Bot,
    shell: 'from-[#26040a] via-[#830018] to-[#ef3340]',
    badge: 'bg-white text-[#bd0026] border-white/40',
    button: 'bg-[#bd0026] text-white hover:bg-[#8e001c]',
    wash: 'bg-[#0ea5e9]',
  },
  art: {
    label: 'Art',
    icon: Brush,
    symbol: Brush,
    shell: 'from-[#2a050b] via-[#8b001b] to-[#ef3340]',
    badge: 'bg-white text-[#bd0026] border-white/40',
    button: 'bg-[#bd0026] text-white hover:bg-[#8e001c]',
    wash: 'bg-[#f59e0b]',
  },
};

function normalize(value?: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
}

function detectTrack(value?: string): Track | null {
  const text = normalize(value);
  if (/\b(rob[a-z0-9]*|robot[a-z0-9]*|robotics)\b/.test(text)) return 'robotics';
  if (/\b(c4k[a-z0-9]*|c4t[a-z0-9]*|pt[a-z0-9]*|scratch|coding|code|js[a-z0-9]*|web|cs[a-z0-9]*|computer scientist|app producer|python)\b/.test(text)) return 'coding';
  if (/\b(xart[a-z0-9]*|art|fine art|creative art|my thuat|ve thuat|drawing|draw)\b/.test(text)) return 'art';
  return null;
}

function projectTrack(project: ProjectItem, trackHint?: string): Track {
  return detectTrack(trackHint) || detectTrack(`${project.course || ''} ${project.title || ''}`) || 'coding';
}

function uniqueUrls(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => (value || '').trim()).filter(Boolean)));
}

function isImageFileUrl(url?: string) {
  const text = url || '';
  return /\/uploads\/images\//i.test(text) || /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(text);
}

function isVideoFileUrl(url?: string) {
  const text = url || '';
  return /\.(mp4|webm|ogg|mov)(?:[?#]|$)/i.test(text);
}

function allProjectImages(project: ProjectItem) {
  const imageUrlImages = Array.isArray(project.imageUrl) ? project.imageUrl.filter(isImageFileUrl) : [];
  const explicitImages = uniqueUrls([
    ...imageUrlImages,
    ...(project.imageUrls || []),
    ...(project.attachmentUrls || []).filter(isImageFileUrl),
    ...(project.relatedUrls || []).map((item) => item.url).filter(isImageFileUrl),
  ]);
  const fallbackImage = typeof project.imageUrl === 'string' && isImageFileUrl(project.imageUrl) ? project.imageUrl : '';
  return uniqueUrls([...explicitImages, fallbackImage]);
}

function youtubeEmbedUrl(url?: string) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1` : null;
}

function scratchPlayerUrl(url?: string): string | null {
  if (!url) return null;
  const scratchMatch = url.match(/scratch\.mit\.edu\/projects\/(\d+)/i);
  if (scratchMatch) return `https://turbowarp.org/${scratchMatch[1]}/embed?autoplay=true`;
  const turbowarpMatch = url.match(/turbowarp\.org\/(\d+)/i);
  if (turbowarpMatch) return `https://turbowarp.org/${turbowarpMatch[1]}/embed?autoplay=true`;
  if (url.toLowerCase().split('?')[0].endsWith('.sb3')) {
    return `https://turbowarp.org/embed.html?project_url=${encodeURIComponent(url)}&autoplay=true&settings-button=true&fullscreen=true`;
  }
  return null;
}

function detectScratchFromProject(project: ProjectItem): { embedUrl: string; originalUrl?: string } | null {
  // 1. Direct link check
  if (project.link) {
    const embed = scratchPlayerUrl(project.link);
    if (embed) return { embedUrl: embed, originalUrl: project.link };
  }

  // 2. Attachment check
  for (const att of project.attachmentUrls || []) {
    const embed = scratchPlayerUrl(att);
    if (embed) return { embedUrl: embed, originalUrl: att };
  }

  // 3. Related URLs check
  for (const rel of project.relatedUrls || []) {
    const embed = scratchPlayerUrl(rel.url);
    if (embed) return { embedUrl: embed, originalUrl: rel.url };
  }

  // 4. Video URLs check (sometimes placed here)
  for (const v of project.videoUrls || []) {
    const embed = scratchPlayerUrl(v);
    if (embed) return { embedUrl: embed, originalUrl: v };
  }

  // 5. Description regex search
  if (project.description) {
    const match = project.description.match(/https?:\/\/(?:scratch\.mit\.edu\/projects\/\d+|turbowarp\.org\/\d+)/i);
    if (match) {
      const embed = scratchPlayerUrl(match[0]);
      if (embed) return { embedUrl: embed, originalUrl: match[0] };
    }
  }

  return null;
}

function isInteractiveExperience(project: ProjectItem, hasScratch: boolean): boolean {
  if (hasScratch) return true;
  const text = `${project.title || ''} ${project.course || ''} ${project.description || ''}`.toLowerCase();
  if (/\b(game|scratch|turbowarp|app|web app|ứng dụng|trò chơi|tro choi|chơi|flappy|mario|pong|snake|quiz|simulator|mô phỏng)\b/i.test(text)) return true;
  if (project.link && !isImageFileUrl(project.link) && !youtubeEmbedUrl(project.link)) return true;
  return false;
}

function fileNameFromUrl(url: string, fallback: string) {
  const clean = url.split('?')[0].split('#')[0];
  return decodeURIComponent(clean.split('/').pop() || fallback);
}

export function ProjectCardShowcase({
  project,
  defaultCourse,
  trackHint,
}: {
  project: ProjectItem;
  defaultCourse?: string;
  trackHint?: string;
}) {
  const [galleryModalState, setGalleryModalState] = useState<{
    isOpen: boolean;
    initialIndex: number;
  }>({ isOpen: false, initialIndex: 0 });

  const [scratchModalOpen, setScratchModalOpen] = useState(false);

  const track = projectTrack(project, trackHint);
  const theme = TRACKS[track];
  const ThemeIcon = theme.icon;
  const SymbolIcon = theme.symbol;

  const images = useMemo(() => allProjectImages(project), [project]);
  const scratchInfo = useMemo(() => detectScratchFromProject(project), [project]);
  const isInteractive = useMemo(() => isInteractiveExperience(project, Boolean(scratchInfo)), [project, scratchInfo]);

  // Aggregate all videos
  const videos = useMemo(() => {
    const rawUrls = uniqueUrls([
      ...(project.videoUrls || []),
      ...(project.link && youtubeEmbedUrl(project.link) ? [project.link] : []),
      ...(project.relatedUrls || []).map((r) => r.url).filter((u) => youtubeEmbedUrl(u) || isVideoFileUrl(u)),
    ]);
    return rawUrls;
  }, [project]);

  // Prepare full media list for Gallery Modal (videos first, then images)
  const galleryMediaItems = useMemo<GalleryMediaItem[]>(() => {
    const list: GalleryMediaItem[] = [];

    videos.forEach((vUrl, i) => {
      const ytEmbed = youtubeEmbedUrl(vUrl);
      if (ytEmbed) {
        list.push({
          id: `yt-${i}`,
          type: 'youtube',
          url: ytEmbed,
          title: `Video demo ${i + 1}`,
          thumbnailUrl: images[i] || undefined,
        });
      } else if (isVideoFileUrl(vUrl)) {
        list.push({
          id: `vid-${i}`,
          type: 'video',
          url: vUrl,
          title: `Video sản phẩm ${i + 1}`,
          thumbnailUrl: images[i] || undefined,
        });
      }
    });

    images.forEach((imgUrl, i) => {
      list.push({
        id: `img-${i}`,
        type: 'image',
        url: imgUrl,
        title: project.title ? `${project.title} - Tác phẩm ${i + 1}` : `Hình ảnh ${i + 1}`,
        thumbnailUrl: imgUrl,
      });
    });

    return list;
  }, [videos, images, project.title]);

  const youtube = videos.map(youtubeEmbedUrl).find(Boolean) || null;
  const downloadableAttachments = (project.attachmentUrls || []).filter(
    (url) => !isImageFileUrl(url) && !url.endsWith('.sb3')
  );

  const openGalleryAt = (index: number) => {
    setGalleryModalState({ isOpen: true, initialIndex: index });
  };

  /**
   * Action handler when clicking "Xem sản phẩm"
   * 1. If Scratch project -> Launch TurboWarp game modal
   * 2. If has gallery media (artworks, images, videos) -> Launch Gallery Modal (slideshow & lightbox)
   * 3. Else if external link -> Open external link
   */
  const handlePrimaryAction = () => {
    if (scratchInfo) {
      setScratchModalOpen(true);
    } else if (galleryMediaItems.length > 0) {
      openGalleryAt(0);
    } else if (project.link) {
      window.open(project.link, '_blank', 'noopener,noreferrer');
    }
  };

  const totalMediaCount = galleryMediaItems.length;
  const hasMultipleMedia = totalMediaCount > 1;

  return (
    <>
      <article className="group relative overflow-hidden rounded-[24px] sm:rounded-[28px] border border-[#ded6c9] bg-[#fffaf2] shadow-[0_16px_45px_rgba(23,21,18,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(23,21,18,0.12)]">
        {/* Glow ambient background */}
        <div className={`absolute -right-12 -top-16 h-44 w-44 rounded-full ${theme.wash} opacity-10 blur-2xl pointer-events-none`} />

        {/* Media Presentation Header Container */}
        <div className={`relative overflow-hidden bg-gradient-to-br ${theme.shell} p-3.5 sm:p-5`}>
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent pointer-events-none" />
          <div className="absolute -right-8 top-5 text-white/10 pointer-events-none">
            <SymbolIcon className="h-44 w-44 sm:h-48 sm:w-48" strokeWidth={1.25} />
          </div>

          {/* Media Body Display */}
          {youtube && !images.length ? (
            /* Single YouTube video without other images */
            <div className="relative w-full overflow-hidden rounded-[18px] sm:rounded-[22px] bg-black shadow-2xl aspect-video max-h-[360px]">
              <iframe
                src={youtube}
                title={project.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          ) : images.length > 0 ? (
            /* Responsive Grid of Images / Artwork with quick gallery launcher */
            <div className="relative">
              <div
                className={`grid min-h-[220px] sm:min-h-[280px] md:h-[340px] gap-2.5 sm:gap-3 ${
                  images.length === 1
                    ? 'grid-cols-1'
                    : images.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                }`}
              >
                {images.slice(0, 3).map((image, index) => {
                  const mediaItemIndex = videos.length + index;
                  return (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => openGalleryAt(mediaItemIndex)}
                      className="group/img relative h-48 sm:h-full w-full overflow-hidden rounded-[18px] sm:rounded-[20px] bg-black/20 text-left shadow-xl ring-1 ring-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      aria-label={`Xem ảnh/tác phẩm ${index + 1} phóng to`}
                    >
                      <img
                        src={image}
                        alt={`${project.title} ${index + 1}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                      />
                      <span className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover/img:opacity-100 flex items-center justify-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-[#171512] shadow-md backdrop-blur-sm">
                          <Maximize2 className="h-3.5 w-3.5 text-[#bd0026]" /> Xem chi tiết
                        </span>
                      </span>

                      {/* +N More Media Badge on the last visible card */}
                      {index === Math.min(images.length, 3) - 1 && images.length > 3 ? (
                        <span className="absolute inset-0 grid place-items-center bg-black/55 text-2xl sm:text-3xl font-black text-white backdrop-blur-xs">
                          +{images.length - 3}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Bottom Quick Bar inside Media Header */}
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                {/* View Gallery / Slideshow Button */}
                <button
                  type="button"
                  onClick={() => openGalleryAt(0)}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/75 hover:bg-black/90 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-black text-white shadow-lg backdrop-blur-md transition-all hover:scale-105 border border-white/20"
                >
                  <Play className="h-3.5 w-3.5 text-[#ef3340] fill-[#ef3340]" />
                  <span>Xem sản phẩm</span>
                </button>

                {/* Scratch indicator if available */}
                {scratchInfo ? (
                  <button
                    type="button"
                    onClick={() => setScratchModalOpen(true)}
                    className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-amber-500 hover:bg-amber-600 px-3.5 py-1.5 text-xs font-black text-white shadow-lg backdrop-blur-md transition-all hover:scale-105"
                  >
                    <Gamepad2 className="h-4 w-4" />
                    <span>Chơi thử</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : scratchInfo ? (
            /* Scratch project preview banner if no images uploaded */
            <div
              onClick={() => setScratchModalOpen(true)}
              className="relative grid h-[220px] sm:h-[300px] cursor-pointer place-items-center rounded-[20px] bg-black/30 p-6 text-white shadow-2xl ring-1 ring-white/15 transition hover:bg-black/40"
            >
              <div className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-950/50 mb-3 animate-pulse">
                  <Gamepad2 className="h-8 w-8" />
                </div>
                <h4 className="text-lg font-black">Game Lập trình Scratch</h4>
                <p className="mt-1 text-xs font-medium text-white/80">
                  Nhấn để mở và chơi thử game · Trải nghiệm tốt nhất ở trên máy tính
                </p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-black text-[#171512] shadow-md">
                  <Play className="h-3.5 w-3.5 fill-[#171512]" /> Chơi thử
                </span>
              </div>
            </div>
          ) : (
            /* Fallback empty visual */
            <div className="relative grid h-[220px] sm:h-[280px] place-items-center rounded-[20px] bg-white/10 p-6 text-white shadow-2xl ring-1 ring-white/15">
              <div className="text-center">
                <ThemeIcon className="mx-auto h-12 w-12 sm:h-14 sm:w-14 opacity-80" />
                <p className="mt-3 text-sm font-black">Sản phẩm hoàn thiện cuối khóa</p>
              </div>
            </div>
          )}

          {/* Badges on Top Left of Media Card */}
          <div className="absolute left-4 top-4 flex flex-wrap gap-2 pointer-events-none">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black shadow-xs ${theme.badge}`}>
              <ThemeIcon className="h-3.5 w-3.5" />
              {theme.label}
            </span>

            {/* Media Count Badge */}
            {hasMultipleMedia ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/50 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                {videos.length > 0 ? (
                  <>
                    <Film className="h-3 w-3 text-amber-300" />
                    <span>{videos.length} video · </span>
                  </>
                ) : null}
                <ImageIcon className="h-3 w-3 text-emerald-300" />
                <span>{images.length} tác phẩm</span>
              </span>
            ) : null}

            {project.featured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/20 px-3 py-1 text-[11px] font-black text-white backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                Nổi bật
              </span>
            ) : null}
          </div>
        </div>

        {/* Content Body */}
        <div className="relative flex flex-col justify-between p-5 sm:p-7">
          <div>
            <p className="text-xs font-black uppercase text-[#bd0026] tracking-wider">
              {project.course || defaultCourse || 'MindX Capstone Project'}
            </p>
            <h3 className="mt-2.5 text-xl sm:text-2xl md:text-3xl font-black leading-tight text-[#171512]">
              {project.title || 'Sản phẩm học viên'}
            </h3>
            <p className="mt-3.5 text-sm sm:text-base font-medium leading-relaxed text-[#55504a] line-clamp-4">
              {project.description ||
                'Sản phẩm thể hiện quá trình học tập, rèn luyện tư duy và hoàn thiện sản phẩm sáng tạo của học viên tại MindX.'}
            </p>
          </div>

          {/* Action Buttons Row (Responsive & Touch-friendly) */}
          <div className="mt-6 space-y-3 pt-3 border-t border-[#ede6dc]">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* PRIMARY ACTION BUTTON: "Xem sản phẩm" hoặc "Chơi thử" */}
              <button
                type="button"
                onClick={handlePrimaryAction}
                className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-xs sm:text-sm font-black shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${theme.button}`}
              >
                {scratchInfo ? (
                  <>
                    <Gamepad2 className="h-4 w-4" />
                    <span>Chơi thử</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4" />
                    <span>Xem sản phẩm</span>
                  </>
                )}
              </button>

              {/* Secondary button: Nếu dự án Scratch có kèm ảnh sản phẩm */}
              {scratchInfo && galleryMediaItems.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openGalleryAt(0)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#ded6c9] bg-white px-4 text-xs sm:text-sm font-black text-[#423d37] transition hover:border-[#bd0026] hover:text-[#bd0026]"
                >
                  <ImageIcon className="h-4 w-4 text-[#bd0026]" />
                  <span>Xem sản phẩm</span>
                </button>
              ) : null}

              {/* External Link button if provided and not scratch and no media */}
              {!scratchInfo && project.link && galleryMediaItems.length === 0 ? (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#ded6c9] bg-white px-4 text-xs sm:text-sm font-black text-[#423d37] transition hover:border-[#bd0026] hover:text-[#bd0026]"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Xem sản phẩm</span>
                </a>
              ) : null}
            </div>

            {/* Ghi chú trải nghiệm tốt nhất trên máy tính cho game/scratch/app/dự án tương tác */}
            {isInteractive ? (
              <div className="flex items-center gap-1.5 text-xs text-[#78716c] font-medium pt-0.5">
                <Monitor className="h-3.5 w-3.5 text-[#bd0026] shrink-0" />
                <span>Trải nghiệm tốt nhất ở trên máy tính</span>
              </div>
            ) : null}

            {/* Downloadable Attachments list */}
            {downloadableAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {downloadableAttachments.map((url, index) => (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#f3eadb] px-3.5 py-1.5 text-[11px] font-bold text-[#423d37] hover:bg-[#eadcc7] transition"
                  >
                    <Download className="h-3.5 w-3.5 text-[#bd0026]" />
                    <span>{fileNameFromUrl(url, `Tệp đính kèm ${index + 1}`)}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </article>

      {/* TurboWarp Scratch Player Modal */}
      {scratchModalOpen && scratchInfo ? (
        <ScratchPlayerModal
          url={scratchInfo.embedUrl}
          title={project.title}
          courseName={project.course || defaultCourse}
          originalScratchUrl={scratchInfo.originalUrl}
          onClose={() => setScratchModalOpen(false)}
        />
      ) : null}

      {/* Full Media Gallery Slideshow Lightbox Modal (5-10s Auto-Slideshow, Next/Prev, Responsive) */}
      {galleryModalState.isOpen && galleryMediaItems.length > 0 ? (
        <ProjectMediaGalleryModal
          items={galleryMediaItems}
          initialIndex={galleryModalState.initialIndex}
          projectTitle={project.title}
          courseName={project.course || defaultCourse}
          trackColor={theme.wash === 'bg-[#0ea5e9]' ? '#0284c7' : '#bd0026'}
          onClose={() => setGalleryModalState({ isOpen: false, initialIndex: 0 })}
        />
      ) : null}
    </>
  );
}
