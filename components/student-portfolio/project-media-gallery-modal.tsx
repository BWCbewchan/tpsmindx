'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';

export interface GalleryMediaItem {
  id: string;
  type: 'image' | 'youtube' | 'video' | 'other';
  url: string;
  title?: string;
  caption?: string;
  thumbnailUrl?: string;
}

interface ProjectMediaGalleryModalProps {
  items: GalleryMediaItem[];
  initialIndex?: number;
  projectTitle: string;
  courseName?: string;
  trackColor?: string;
  onClose: () => void;
}

export function ProjectMediaGalleryModal({
  items,
  initialIndex = 0,
  projectTitle,
  courseName,
  trackColor = '#bd0026',
  onClose,
}: ProjectMediaGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, items.length - 1))
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const SLIDE_DURATION_MS = 10000; // Mặc định chính xác 10 giây, không nhảy cóc
  const slideStartRef = useRef<number>(Date.now());
  const thumbnailScrollRef = useRef<HTMLDivElement>(null);

  const currentItem = items[currentIndex];
  const totalItems = items.length;
  const isVideo = currentItem?.type === 'youtube' || currentItem?.type === 'video';

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalItems);
    slideStartRef.current = Date.now();
    setProgress(0);
  }, [totalItems]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalItems) % totalItems);
    slideStartRef.current = Date.now();
    setProgress(0);
  }, [totalItems]);

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
    slideStartRef.current = Date.now();
    setProgress(0);
  };

  // Scroll active thumbnail into view
  useEffect(() => {
    if (!thumbnailScrollRef.current) return;
    const activeEl = thumbnailScrollRef.current.querySelector(
      `[data-thumb-index="${currentIndex}"]`
    ) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  // Slideshow 10s timer logic - tách biệt hoàn toàn timer chuyển slide và progress bar để không bao giờ bị nhảy cóc
  useEffect(() => {
    if (!isPlaying || totalItems <= 1 || isVideo) {
      setProgress(0);
      return;
    }

    slideStartRef.current = Date.now();
    setProgress(0);

    // 1. Timer chuẩn xác 10 giây chuyển sang hình tiếp theo một lần duy nhất
    const slideTimer = setTimeout(() => {
      goToNext();
    }, SLIDE_DURATION_MS);

    // 2. Timer chỉ cập nhật thanh tiến trình giao diện (tuyệt đối không gọi goToNext trong này)
    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - slideStartRef.current;
      const pct = Math.min(100, Math.max(0, (elapsed / SLIDE_DURATION_MS) * 100));
      setProgress(pct);
    }, 100);

    return () => {
      clearTimeout(slideTimer);
      clearInterval(progressTimer);
    };
  }, [currentIndex, isPlaying, totalItems, isVideo, goToNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onClose, goToNext, goToPrev]);

  // Body scroll lock
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Touch Swipe handlers
  const minSwipeDistance = 50;
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) goToNext();
    if (isRightSwipe) goToPrev();
  };

  if (!items || items.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-2xl animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Bộ sưu tập sản phẩm ${projectTitle}`}
    >
      <div
        className={`relative flex flex-col w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-[#121110] shadow-[0_25px_80px_rgba(0,0,0,0.7)] transition-all duration-300 ${
          isFullscreen
            ? 'h-full max-h-full max-w-full rounded-none border-0'
            : 'max-h-[96vh] max-w-6xl'
        }`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Slideshow Progress Bar at the very top */}
        <div className="relative h-1 w-full bg-white/10 overflow-hidden shrink-0">
          <div
            className="h-full transition-all duration-75 ease-linear"
            style={{
              width: `${isPlaying && !isVideo ? progress : 0}%`,
              backgroundColor: trackColor,
            }}
          />
        </div>

        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#191614]/95 px-3 py-2.5 sm:px-6 sm:py-3.5 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span
              className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl text-white shadow-md shrink-0"
              style={{ backgroundColor: trackColor }}
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-black uppercase tracking-wider text-white/60">
                  {courseName || 'Sản phẩm học viên'}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/80">
                  {currentIndex + 1} / {totalItems}
                </span>
              </div>
              <h3 className="truncate text-sm sm:text-base font-black text-white">
                {projectTitle}
              </h3>
            </div>
          </div>

          {/* Controls Right */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {/* Auto Play / Pause Toggle Button */}
            {totalItems > 1 ? (
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition border ${
                  isPlaying && !isVideo
                    ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/15 bg-white/10 text-white/80 hover:bg-white/20'
                }`}
                title={isPlaying ? 'Tạm dừng trình chiếu tự động' : 'Bật trình chiếu tự động'}
                aria-label={isPlaying ? 'Tạm dừng trình chiếu tự động' : 'Bật trình chiếu tự động'}
              >
                {isPlaying && !isVideo ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Tự động (10s)</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Phát tiếp</span>
                  </>
                )}
              </button>
            ) : null}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="hidden sm:grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              aria-label={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-[#bd0026] hover:scale-105"
              aria-label="Đóng thư viện ảnh/video"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Media Viewport */}
        <div className="relative flex-1 flex items-center justify-center bg-black/95 overflow-hidden min-h-[260px] sm:min-h-[420px] max-h-[68vh] sm:max-h-[72vh]">
          {/* Previous Button */}
          {totalItems > 1 ? (
            <button
              type="button"
              onClick={goToPrev}
              className="absolute left-2 sm:left-4 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl backdrop-blur-md transition hover:bg-[#bd0026] hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Media trước"
            >
              <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
            </button>
          ) : null}

          {/* Next Button */}
          {totalItems > 1 ? (
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-2 sm:right-4 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl backdrop-blur-md transition hover:bg-[#bd0026] hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Media tiếp theo"
            >
              <ChevronRight className="h-6 w-6 stroke-[2.5]" />
            </button>
          ) : null}

          {/* Media Content Display */}
          <div className="relative h-full w-full flex items-center justify-center p-2 sm:p-4">
            {currentItem.type === 'youtube' ? (
              <div className="w-full max-w-4xl aspect-video max-h-full rounded-xl overflow-hidden shadow-2xl bg-black">
                <iframe
                  src={currentItem.url}
                  title={currentItem.title || projectTitle}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : currentItem.type === 'video' ? (
              <div className="w-full max-w-4xl aspect-video max-h-full rounded-xl overflow-hidden shadow-2xl bg-black flex items-center justify-center">
                <video
                  src={currentItem.url}
                  controls
                  playsInline
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="relative max-h-full max-w-full flex items-center justify-center">
                <img
                  src={currentItem.url}
                  alt={currentItem.title || `${projectTitle} - Ảnh ${currentIndex + 1}`}
                  className="max-h-[62vh] sm:max-h-[66vh] w-auto max-w-full object-contain rounded-lg shadow-2xl transition-all duration-300 select-none"
                />
              </div>
            )}
          </div>

          {/* Mobile slide counter badge on image */}
          <div className="sm:hidden absolute bottom-3 left-3 z-10 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/15">
            {currentIndex + 1} / {totalItems}
          </div>
        </div>

        {/* Thumbnail Filmstrip & Caption Footer */}
        <div className="shrink-0 border-t border-white/10 bg-[#161311] px-3 py-2.5 sm:px-6 sm:py-3">
          {/* Caption text if any */}
          {currentItem.caption || currentItem.title ? (
            <p className="mb-2 text-center text-xs font-semibold text-white/80 line-clamp-1">
              {currentItem.caption || currentItem.title}
            </p>
          ) : null}

          {/* Filmstrip list */}
          {totalItems > 1 ? (
            <div
              ref={thumbnailScrollRef}
              className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {items.map((item, idx) => {
                const isActive = idx === currentIndex;
                const isItemVideo = item.type === 'youtube' || item.type === 'video';
                return (
                  <button
                    key={`${item.id}-${idx}`}
                    data-thumb-index={idx}
                    type="button"
                    onClick={() => goToIndex(idx)}
                    className={`relative h-14 w-20 sm:h-16 sm:w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                      isActive
                        ? 'border-white scale-105 shadow-[0_0_15px_rgba(255,255,255,0.4)] ring-2'
                        : 'border-white/20 opacity-60 hover:opacity-100 hover:scale-100'
                    }`}
                    style={{
                      borderColor: isActive ? trackColor : undefined,
                    }}
                    aria-label={`Chuyển tới item ${idx + 1}`}
                  >
                    {item.type === 'image' || item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl || item.url}
                        alt={`Thumb ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-[#25201c] text-white">
                        <Film className="h-5 w-5 text-white/70" />
                      </div>
                    )}
                    {/* Video badge indicator */}
                    {isItemVideo ? (
                      <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded bg-black/80 text-white shadow-xs">
                        <Film className="h-2.5 w-2.5" />
                      </span>
                    ) : (
                      <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded bg-black/60 text-white shadow-xs">
                        <ImageIcon className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>{projectTitle}</span>
              <span>1 sản phẩm</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
