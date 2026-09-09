'use client';

import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Gamepad2,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

interface ScratchPlayerModalProps {
  url: string;
  title: string;
  courseName?: string;
  onClose: () => void;
  originalScratchUrl?: string;
}

export function ScratchPlayerModal({
  url,
  title,
  courseName,
  onClose,
  originalScratchUrl,
}: ScratchPlayerModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Keyboard escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onClose]);

  // Prevent background body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Trải nghiệm game Scratch ${title}`}
    >
      <div
        className={`relative flex flex-col w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-[#121110] shadow-[0_25px_70px_rgba(0,0,0,0.55)] transition-all duration-300 ${
          isFullscreen
            ? 'h-full max-h-full max-w-full rounded-none border-0'
            : 'max-h-[95vh] max-w-5xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#1a1715]/95 px-4 py-3 sm:px-6 sm:py-3.5 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-orange-950/40">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-400 border border-orange-500/30">
                  <Sparkles className="h-2.5 w-2.5" /> TurboWarp Player
                </span>
                {courseName ? (
                  <span className="hidden truncate text-xs text-white/60 sm:inline">
                    · {courseName}
                  </span>
                ) : null}
              </div>
              <h3 className="truncate text-sm sm:text-base font-extrabold text-white">
                {title || 'Dự án Scratch học viên'}
              </h3>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Reload button */}
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
              title="Chạy lại game"
              aria-label="Chạy lại game"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Original Scratch link if exists */}
            {originalScratchUrl ? (
              <a
                href={originalScratchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                title="Mở trên Scratch MIT"
                aria-label="Mở trên Scratch MIT"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}

            {/* Fullscreen toggle button */}
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
              aria-label="Đóng trình chơi game"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile notice banner for keyboard controls */}
        <div className="sm:hidden flex items-center justify-center gap-1.5 bg-amber-500/15 border-b border-amber-500/25 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
          <Monitor className="h-3 w-3 shrink-0 text-amber-400" />
          <span>Trải nghiệm tốt nhất ở trên máy tính</span>
        </div>

        {/* Game Iframe Canvas */}
        <div className="relative flex-1 aspect-[4/3] sm:aspect-[16/10] max-h-[78vh] w-full bg-black">
          <iframe
            key={reloadKey}
            src={url}
            title={title}
            className="h-full w-full border-0"
            allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write; microphone"
            allowFullScreen
          />
        </div>

        {/* Footer info bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#161311] px-4 py-2.5 text-xs text-white/70">
          <span className="flex items-center gap-1.5 font-medium">
            <Monitor className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Trải nghiệm tốt nhất ở trên máy tính (sử dụng chuột & bàn phím)</span>
          </span>
          <span className="hidden sm:inline text-white/40">
            Nhấn ESC hoặc dấu X để đóng
          </span>
        </div>
      </div>
    </div>
  );
}
