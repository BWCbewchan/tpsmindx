'use client';

import { useEffect, useState } from 'react';

type Props = {
  frames: readonly string[];
  alt: string;
  /** ms giữa mỗi frame */
  intervalMs?: number;
  /** Lệch phase khi mount (0 … frames.length-1) */
  phaseOffset?: number;
  wrapperClassName: string;
  imgClassName?: string;
};

/**
 * Lặp tuần tự các ảnh frame (walk/jump) để tạo animation chuyển động.
 * Ảnh được preload trước để đổi frame mượt.
 */
export function MascotSpriteCycle({
  frames,
  alt,
  intervalMs = 115,
  phaseOffset = 0,
  wrapperClassName,
  imgClassName = 'h-auto max-h-[9.5rem] w-auto object-contain sm:max-h-[11rem]',
}: Props) {
  const n = frames.length;
  const [index, setIndex] = useState(() => (phaseOffset % n + n) % n);

  useEffect(() => {
    let cancelled = false;
    for (const src of frames) {
      const img = new window.Image();
      img.src = src;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || n <= 1) return;

    const id = window.setInterval(() => {
      if (cancelled) return;
      setIndex((i) => (i + 1) % n);
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [frames, intervalMs, n]);

  return (
    <div
      className={`bao-tri-mascot-wrap relative flex h-32 w-[7.5rem] items-end justify-center sm:h-40 sm:w-36 ${wrapperClassName}`}
    >
      { }
      <img
        src={frames[index]}
        alt={alt}
        width={160}
        height={160}
        className={imgClassName}
        draggable={false}
      />
    </div>
  );
}
