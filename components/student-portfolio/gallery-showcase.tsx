'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Maximize2,
  Sparkles,
  X,
} from 'lucide-react';

interface GalleryItem {
  url?: string;
  src?: string;
  caption?: string;
  title?: string;
  type?: string;
  category?: string;
}

type TabType = 'certificates' | 'activities' | 'events';

function categorizeItem(item: any): TabType {
  const src = typeof item === 'string' ? item : item.url || item.src || '';
  const text = (
    typeof item === 'string'
      ? item
      : `${item.type || ''} ${item.category || ''} ${item.caption || ''} ${item.title || ''} ${src}`
  ).toLowerCase();

  if (/certificate|chung_chi|chứng chỉ|chứng nhận|bằng|diploma|giấy khen|giải thưởng|bang cap/i.test(text)) {
    return 'certificates';
  }

  if (/sự kiện|su_kien|event|workshop|hackathon|cuộc thi|lễ trao giải|demo day|hội thảo|exhibition/i.test(text)) {
    return 'events';
  }

  return 'activities';
}

export function GalleryShowcase({
  gallery,
  achievements = [],
}: {
  gallery: any[];
  achievements?: any[];
}) {
  const { certificates, activities, events } = useMemo(() => {
    const certs: any[] = [];
    const acts: any[] = [];
    const evts: any[] = [];

    (gallery || []).forEach((item) => {
      const cat = categorizeItem(item);
      if (cat === 'certificates') certs.push(item);
      else if (cat === 'events') evts.push(item);
      else acts.push(item);
    });

    return { certificates: certs, activities: acts, events: evts };
  }, [gallery]);

  // Determine initial active tab (defaulting to the first category with items, or 'certificates')
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (certificates.length > 0) return 'certificates';
    if (activities.length > 0) return 'activities';
    if (events.length > 0) return 'events';
    return 'certificates';
  });

  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const currentItems = useMemo(() => {
    if (activeTab === 'certificates') return certificates;
    if (activeTab === 'events') return events;
    return activities;
  }, [activeTab, certificates, events, activities]);

  const totalCurrent = currentItems.length;

  const nextImage = () => {
    if (activeImageIndex === null || totalCurrent === 0) return;
    setActiveImageIndex((activeImageIndex + 1) % totalCurrent);
  };

  const prevImage = () => {
    if (activeImageIndex === null || totalCurrent === 0) return;
    setActiveImageIndex((activeImageIndex - 1 + totalCurrent) % totalCurrent);
  };

  // Keyboard navigation
  useEffect(() => {
    if (activeImageIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveImageIndex(null);
      } else if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'ArrowLeft') {
        prevImage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageIndex, totalCurrent]);

  // Body scroll lock
  useEffect(() => {
    if (activeImageIndex === null) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, [activeImageIndex]);

  // Touch Swipe
  const minSwipeDistance = 45;
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const dist = touchStart - touchEnd;
    if (dist > minSwipeDistance) nextImage();
    if (dist < -minSwipeDistance) prevImage();
  };

  if (!gallery || gallery.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* 3 Menu Tabs: Chứng chỉ | Hoạt động | Sự kiện (Responsive Horizontal Scroll) */}
      <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-3 border-b border-[#e5ded5] scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('certificates')}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-extrabold uppercase tracking-wide transition-all duration-200 ${
            activeTab === 'certificates'
              ? 'bg-[#bd0026] text-white shadow-md'
              : 'bg-white text-[#5d554d] border border-[#ded6c9] hover:bg-[#faf8f5]'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Chứng chỉ ({certificates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activities')}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-extrabold uppercase tracking-wide transition-all duration-200 ${
            activeTab === 'activities'
              ? 'bg-[#bd0026] text-white shadow-md'
              : 'bg-white text-[#5d554d] border border-[#ded6c9] hover:bg-[#faf8f5]'
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          <span>Hoạt động ({activities.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-extrabold uppercase tracking-wide transition-all duration-200 ${
            activeTab === 'events'
              ? 'bg-[#bd0026] text-white shadow-md'
              : 'bg-white text-[#5d554d] border border-[#ded6c9] hover:bg-[#faf8f5]'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Sự kiện ({events.length})</span>
        </button>
      </div>

      {/* Image Grid for Active Tab */}
      {currentItems.length > 0 ? (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {currentItems.map((img: any, idx: number) => {
            const src = typeof img === 'string' ? img : img.url || img.src || '';
            const caption = typeof img === 'string' ? '' : img.caption || img.title || '';
            return (
              <div
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#e4dcd0] bg-white shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <img
                  src={src}
                  alt={caption || `Hình ảnh ${idx + 1}`}
                  className="h-52 sm:h-56 w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-[#171512] shadow-md backdrop-blur-md">
                    <Maximize2 className="h-3.5 w-3.5 text-[#bd0026]" /> Xem Phóng to
                  </span>
                </div>
                {caption ? <p className="p-3.5 text-xs font-extrabold text-[#3b352f] line-clamp-2">{caption}</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State for Selected Category */
        <div className="rounded-2xl border border-dashed border-[#ded6c9] bg-white p-8 sm:p-12 text-center text-[#777067]">
          <Sparkles className="mx-auto h-8 w-8 text-[#bd0026]/40 mb-3" />
          <p className="font-extrabold text-base text-[#171512]">Chưa có hình ảnh ở mục này</p>
          <p className="mt-1 text-xs text-[#8c8275]">
            Hình ảnh thuộc danh mục này sẽ được cập nhật trong quá trình học tập.
          </p>
        </div>
      )}

      {/* Fullscreen Gallery Lightbox Modal with NEXT & PREV BUTTONS */}
      {activeImageIndex !== null && currentItems[activeImageIndex] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-5 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setActiveImageIndex(null)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex flex-col w-full max-h-[95vh] max-w-5xl overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-[#141210] shadow-[0_25px_80px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar with Counter and Close Button */}
            <div className="flex items-center justify-between border-b border-white/10 bg-[#1a1715] px-4 py-3 sm:px-6 text-white">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold text-white">
                  {activeImageIndex + 1} / {totalCurrent}
                </span>
                <span className="hidden sm:inline text-xs text-white/60">
                  {activeTab === 'certificates'
                    ? 'Chứng chỉ'
                    : activeTab === 'events'
                    ? 'Sự kiện'
                    : 'Hoạt động'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveImageIndex(null)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-[#bd0026] hover:scale-105"
                aria-label="Đóng xem ảnh"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main Image Area with Prominent Next & Prev Buttons */}
            <div className="relative flex-1 flex items-center justify-center bg-black p-2 sm:p-4 min-h-[260px] sm:min-h-[400px] max-h-[75vh]">
              {/* Prev Button */}
              {totalCurrent > 1 ? (
                <button
                  type="button"
                  onClick={prevImage}
                  className="absolute left-2 sm:left-4 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl backdrop-blur-md transition hover:bg-[#bd0026] hover:scale-110 active:scale-95"
                  aria-label="Ảnh trước"
                >
                  <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
                </button>
              ) : null}

              {/* Next Button */}
              {totalCurrent > 1 ? (
                <button
                  type="button"
                  onClick={nextImage}
                  className="absolute right-2 sm:right-4 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl backdrop-blur-md transition hover:bg-[#bd0026] hover:scale-110 active:scale-95"
                  aria-label="Ảnh tiếp theo"
                >
                  <ChevronRight className="h-6 w-6 stroke-[2.5]" />
                </button>
              ) : null}

              {(() => {
                const item = currentItems[activeImageIndex];
                const src = typeof item === 'string' ? item : item.url || item.src || '';
                const caption = typeof item === 'string' ? '' : item.caption || item.title || '';
                return (
                  <img
                    src={src}
                    alt={caption || `Hình ảnh ${activeImageIndex + 1}`}
                    className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-2xl select-none"
                  />
                );
              })()}
            </div>

            {/* Caption Bar */}
            {(() => {
              const item = currentItems[activeImageIndex];
              const caption = typeof item === 'string' ? '' : item.caption || item.title || '';
              return caption ? (
                <div className="border-t border-white/10 bg-[#171412] px-4 py-3 text-center text-xs sm:text-sm font-bold text-white/90">
                  {caption}
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
