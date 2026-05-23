import type { Metadata } from 'next';
import { MascotSpriteCycle } from './MascotSpriteCycle';

export const metadata: Metadata = {
  title: 'TPS tạm đóng bảo trì | Teaching Portal System',
  description:
    'Teaching Portal System tạm đóng để bảo trì và nâng cấp trải nghiệm cho quý thầy cô.',
  robots: { index: false, follow: false },
};

/** Thứ tự frame walk — mỗi ảnh là một pha của chu kỳ đi bộ */
const WALK_FRAMES = [
  '/mascot/walk/frame-1.png',
  '/mascot/walk/frame-2.png',
  '/mascot/walk/frame-3.png',
  '/mascot/walk/frame-4.png',
  '/mascot/walk/frame-5.png',
] as const;

const JUMP_FRAMES = [
  '/mascot/jump/frame-1.png',
  '/mascot/jump/frame-2.png',
  '/mascot/jump/frame-3.png',
  '/mascot/jump/frame-4.png',
  '/mascot/jump/frame-5.png',
] as const;

export default function BaoTriPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#1a0a0e] via-[#0c1222] to-[#0a0f18] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-[100%] bg-[#a1001f]/20 blur-[80px] motion-safe:animate-pulse"
        aria-hidden
      />

      <main className="relative z-10 mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-12 sm:px-10 sm:py-16">
        <div className="bao-tri-fade-rise mb-8 flex flex-wrap items-end justify-center gap-6 sm:gap-10">
          <MascotSpriteCycle
            frames={WALK_FRAMES}
            alt="Mascot TPS đang đi bộ"
            intervalMs={115}
            phaseOffset={0}
            wrapperClassName="bao-tri-mascot-wrap--a"
          />
          <MascotSpriteCycle
            frames={JUMP_FRAMES}
            alt="Mascot TPS"
            intervalMs={105}
            phaseOffset={1}
            wrapperClassName="bao-tri-mascot-wrap--b"
          />
          <MascotSpriteCycle
            frames={WALK_FRAMES}
            alt="Mascot TPS đang đi bộ"
            intervalMs={115}
            phaseOffset={3}
            wrapperClassName="bao-tri-mascot-wrap--c"
          />
        </div>

        <p className="bao-tri-fade-rise bao-tri-fade-delay-1 bao-tri-badge-animated bao-tri-eyebrow-glow mb-4 text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#f87171]">
          Bảo trì &amp; nâng cấp
        </p>

        <h1 className="bao-tri-fade-rise bao-tri-fade-delay-2 bao-tri-gradient-title text-center font-exo text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
          TPS xin cảm ơn quý thầy cô
        </h1>

        <div className="bao-tri-fade-rise bao-tri-fade-delay-3 mt-8 space-y-5 text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
          <p>
            Sau khi nhận được những phản hồi quý giá từ quý thầy cô,{' '}
            <span className="font-semibold text-white">Teaching Portal System (TPS)</span> xin
            thông báo tạm đóng hệ thống để bảo trì và{' '}
            <span className="bg-gradient-to-r from-white/90 to-rose-100/90 bg-clip-text text-transparent">
              nâng cấp
            </span>
            , nhằm mang đến trải nghiệm tốt nhất cho quý thầy cô trong thời gian tới.
          </p>
          <p className="bao-tri-closing text-center text-lg font-medium text-white sm:text-xl">
            Xin chào và hẹn gặp lại.
          </p>
        </div>

        <div className="bao-tri-fade-rise bao-tri-fade-delay-4 mt-10 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center text-sm text-slate-400 backdrop-blur-sm transition-[box-shadow] duration-500 sm:px-6">
          Trong thời gian này quý thầy cô chưa thể đăng nhập hay sử dụng các chức năng trên TPS.
          Mọi thắc mắc xin liên hệ đội vận hành MindX.
        </div>

        <p className="mt-10 text-center text-xs text-slate-500 opacity-80">
          Teaching Portal System (TPS) · MindX
        </p>
      </main>
    </div>
  );
}
