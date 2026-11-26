'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Save, Shirt, X } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MascotOutfit {
  id: string
  name: string
  flagCode?: string
  colors?: string[]
  /** Frames dùng cho phase walk (và preview trong modal) */
  previewFrames: string[] | null
  /** Frames dùng cho phase jump — nếu null sẽ fallback về default jump */
  jumpFrames?: string[] | null
  /** Frames dùng cho phase wave (hover) — nếu null sẽ fallback về default wave */
  waveFrames?: string[] | null
  /**
   * staticMode = true  → mascot đứng yên tại chỗ, loop previewFrames liên tục, không di chuyển,
   *                       không jump, không turn. Hover vẫn vẫy tay bình thường.
   * staticMode = false → luồng mặc định: walk sang trái/phải, turn ở biên, jump random
   */
  staticMode?: boolean
  previewStatic: string | null
  spriteBase: string | null
  available: boolean
  tag?: 'default' | 'new' | 'special' | 'coming-soon'
  color: string
  bgColor: string
}

/** Trả về walk frames của outfit (fallback về default walk) */
export function getOutfitFrames(outfit: MascotOutfit, phase: 'walk' | 'jump' | 'wave'): string[] | null {
  if (phase === 'walk') return outfit.previewFrames ?? null
  if (phase === 'jump') return outfit.jumpFrames ?? null
  if (phase === 'wave') return outfit.waveFrames ?? null
  return null
}

/** true nếu outfit dùng static mode (đứng yên, loop previewFrames) */
export function isStaticOutfit(outfit: MascotOutfit): boolean {
  return outfit.staticMode === true
}

// ─── Frame sets ──────────────────────────────────────────────────────────────
const WALK_FRAMES_DEFAULT = Array.from({ length: 25 }, (_, i) => `/mascot/walk/frame-${i + 1}.webp`)
const OUTFIT_ASSET_VERSION = 'bdn-siu-arms-refresh-20260621'
const outfitAsset = (path: string) => `${path}?v=${OUTFIT_ASSET_VERSION}`
const outfitFrameSet = (slug: string) => Array.from(
  { length: 25 },
  (_, i) => outfitAsset(`/mascot/${slug}/frame-${i + 1}.webp`),
)
const VIETNAM_FRAMES = outfitFrameSet('mascot-vn')
const PORTUGAL_FRAMES = outfitFrameSet('mascot-bdn')
const BRAZIL_FRAMES = outfitFrameSet('mascot-bz')
const FRANCE_FRAMES = outfitFrameSet('mascot-phap')
const ARGENTINA_FRAMES = outfitFrameSet('mascot-argen')
const STANDREAD_FRAMES    = [
  '/mascot/standAndRead/tải xuống.webp',
  ...Array.from({ length: 23 }, (_, i) => `/mascot/standAndRead/tải xuống (${i + 1}).webp`),
]

// ─── Danh sách trang phục ────────────────────────────────────────────────────
export const MASCOT_OUTFITS: MascotOutfit[] = [
  {
    id: 'default',
    name: 'Mặc định',
    previewFrames: WALK_FRAMES_DEFAULT,
    jumpFrames: null,    // fallback default jump
    waveFrames: null,    // fallback default wave
    staticMode: false,   // ← luồng cũ: walk/turn/jump
    previewStatic: '/mascot/walk.webp',
    spriteBase: null,
    available: true,
    tag: 'default',
    color: '#a1001f',
    bgColor: '#fff5f5',
  },
  {
    id: 'mascot-vn',
    name: 'Vi\u1ec7t Nam',
    previewFrames: VIETNAM_FRAMES,
    jumpFrames: null,
    waveFrames: null,
    staticMode: true,
    previewStatic: outfitAsset('/mascot/mascot-vn.webp'),
    spriteBase: outfitAsset('/mascot/mascot-vn-sheet.webp'),
    available: true,
    tag: 'new',
    color: '#dc2626',
    bgColor: '#fff5f5',
  },
  {
    id: 'mascot-bdn',
    name: 'B\u1ed3 \u0110\u00e0o Nha',
    previewFrames: PORTUGAL_FRAMES,
    jumpFrames: null,
    waveFrames: null,
    staticMode: true,
    previewStatic: outfitAsset('/mascot/mascot-bdn.webp'),
    spriteBase: outfitAsset('/mascot/mascot-bdn-sheet.webp'),
    available: true,
    tag: 'new',
    color: '#16a34a',
    bgColor: '#fff5f5',
  },
  {
    id: 'mascot-bz',
    name: 'Brazil',
    previewFrames: BRAZIL_FRAMES,
    jumpFrames: null,
    waveFrames: null,
    staticMode: true,
    previewStatic: outfitAsset('/mascot/mascot-bz.webp'),
    spriteBase: outfitAsset('/mascot/mascot-bz-sheet.webp'),
    available: true,
    tag: 'new',
    color: '#eab308',
    bgColor: '#fff5f5',
  },
  {
    id: 'mascot-phap',
    name: 'Ph\u00e1p',
    previewFrames: FRANCE_FRAMES,
    jumpFrames: null,
    waveFrames: null,
    staticMode: true,
    previewStatic: outfitAsset('/mascot/mascot-phap.webp'),
    spriteBase: outfitAsset('/mascot/mascot-phap-sheet.webp'),
    available: true,
    tag: 'new',
    color: '#2563eb',
    bgColor: '#fff5f5',
  },
  {
    id: 'mascot-argen',
    name: 'Argentina',
    previewFrames: ARGENTINA_FRAMES,
    jumpFrames: null,
    waveFrames: null,
    staticMode: true,
    previewStatic: outfitAsset('/mascot/mascot-argen.webp'),
    spriteBase: outfitAsset('/mascot/mascot-argen-sheet.webp'),
    available: true,
    tag: 'new',
    color: '#38bdf8',
    bgColor: '#fff5f5',
  },
  {
    id: 'santa',
    name: 'World Cup',
    previewFrames: null,
    jumpFrames: null,
    waveFrames: null,
    staticMode: true,
    previewStatic: null,
    spriteBase: null,
    available: false,
    tag: 'coming-soon',
    color: '#16a34a',
    bgColor: '#f0fdf4',
  },
]

const TAG_LABELS: Record<string, string> = {
  default: 'Mặc định',
  new: 'Mới',
  special: 'Đặc biệt',
  'coming-soon': 'Sắp có',
}

const FLAME_THEMES: Record<string, { a: string; b: string; c: string; glow: string; flag: string }> = {
  default: { a: '#111827', b: '#f9fafb', c: '#f97316', glow: 'rgba(249,115,22,0.32)', flag: 'ball' },
  'mascot-vn': { a: '#da251d', b: '#ffde00', c: '#b91c1c', glow: 'rgba(255,222,0,0.36)', flag: 'vn' },
  'mascot-bdn': { a: '#006847', b: '#ffcc00', c: '#ce1126', glow: 'rgba(206,17,38,0.36)', flag: 'bdn' },
  'mascot-bz': { a: '#009b3a', b: '#ffdf00', c: '#002776', glow: 'rgba(255,223,0,0.34)', flag: 'bz' },
  'mascot-phap': { a: '#0055a4', b: '#ffffff', c: '#ef4135', glow: 'rgba(239,65,53,0.32)', flag: 'phap' },
  'mascot-argen': { a: '#74acdf', b: '#ffffff', c: '#f6b40e', glow: 'rgba(116,172,223,0.38)', flag: 'argen' },
  santa: { a: '#16a34a', b: '#ffffff', c: '#ce1126', glow: 'rgba(22,163,74,0.28)', flag: 'phap' },
}

// ─── localStorage helpers ────────────────────────────────────────────────────
const STORAGE_KEY_PREFIX = 'mascot_outfit_'

export function getMascotOutfitId(userEmail: string): string {
  if (typeof window === 'undefined') return 'default'
  return localStorage.getItem(STORAGE_KEY_PREFIX + userEmail) ?? 'default'
}

export function setMascotOutfitId(userEmail: string, outfitId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_PREFIX + userEmail, outfitId)
}

export function getMascotOutfit(userEmail: string): MascotOutfit {
  const id = getMascotOutfitId(userEmail)
  return MASCOT_OUTFITS.find(o => o.id === id && o.available) ?? MASCOT_OUTFITS[0]
}

/** @deprecated dùng getOutfitFrames(outfit, 'walk') thay thế */
export function getOutfitWalkFrames(outfit: MascotOutfit): string[] {
  return outfit.previewFrames ?? WALK_FRAMES_DEFAULT
}

function shouldReduceModalEffects() {
  if (typeof window === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  const cores = navigator.hardwareConcurrency || 8
  return (
    window.matchMedia('(max-width: 767px), (pointer: coarse), (prefers-reduced-motion: reduce)').matches ||
    connection?.saveData === true ||
    cores <= 4
  )
}

// ─── Animated Preview Canvas ─────────────────────────────────────────────────
function AnimatedPreview({
  frames, staticSrc, fps = 14, accentColor, bgColor, isSelected, animated = true,
}: {
  frames: string[] | null
  staticSrc: string | null
  fps?: number
  accentColor: string
  bgColor: string
  isSelected: boolean
  animated?: boolean
}) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const imagesRef   = useRef<Map<string, HTMLImageElement>>(new Map())
  const frameIdxRef = useRef(0)
  const rafRef      = useRef(0)
  const lastTimeRef = useRef(0)

  const drawFrame = useCallback(() => {
    if (!frames || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const src = frames[frameIdxRef.current] ?? frames[0]
    const img = imagesRef.current.get(src)
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.clearRect(0, 0, 160, 160)
      ctx.drawImage(img, 0, 0, 160, 160)
    }
  }, [frames])

  useEffect(() => {
    if (!animated || !frames) return
    frames.forEach(src => {
      if (!imagesRef.current.has(src)) {
        const img = new window.Image()
        img.decoding = 'async'
        img.onload = () => drawFrame()
        img.src = src
        imagesRef.current.set(src, img)
      }
    })
    const msPerFrame = 1000 / fps
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick)
      if (now - lastTimeRef.current < msPerFrame) return
      lastTimeRef.current = now
      frameIdxRef.current = (frameIdxRef.current + 1) % frames.length
      drawFrame()
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animated, frames, fps, drawFrame])

  const previewSrc = staticSrc ?? frames?.[0] ?? null

  if (!animated || !frames) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl" style={{ background: bgColor }}>
        {previewSrc ? (
          <img src={previewSrc} alt="" loading="eager" decoding="async" className="h-[80%] w-[80%] object-contain opacity-80" draggable={false} />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <Shirt className="h-10 w-10" strokeWidth={1.2} />
            <span className="text-[11px]">🔒 Sắp có</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full items-end justify-center overflow-hidden rounded-xl" style={{ background: bgColor }}>
      {isSelected && (
        <div className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ boxShadow: `inset 0 0 0 2.5px ${accentColor}` }} />
      )}
      <canvas ref={canvasRef} width={160} height={160}
        className="relative z-10 h-full w-full object-contain"
        style={{ imageRendering: 'pixelated' }} />
    </div>
  )
}

function OutfitFlameBanner({ outfit, isSelected }: { outfit: MascotOutfit; isSelected: boolean }) {
  const dynamicColors = outfit.colors?.length ? outfit.colors : [outfit.color, '#ffcf33', '#ef4444']
  const theme = FLAME_THEMES[outfit.id] ?? {
    a: dynamicColors[0] ?? outfit.color,
    b: dynamicColors[1] ?? '#ffcf33',
    c: dynamicColors[2] ?? '#ef4444',
    glow: `${outfit.color}55`,
    flag: outfit.flagCode ? 'dynamic' : 'ball',
  }

  return (
    <div
      className="outfit-flame-banner"
      aria-hidden="true"
      style={{
        '--flame-a': theme.a,
        '--flame-b': theme.b,
        '--flame-c': theme.c,
        '--flame-glow': theme.glow,
        '--flame-scale': isSelected ? '1.04' : '1',
      } as React.CSSProperties}
    >
      <span className={`outfit-flame-mark outfit-flame-mark-${theme.flag}`}>
        <img
          src={theme.flag === 'dynamic' && outfit.flagCode ? `https://flagcdn.com/${outfit.flagCode}.svg` : '/mascot/ui/football-icon.webp'}
          alt=""
          draggable={false}
        />
        <span />
        <span />
        <span />
        <i />
      </span>
      <span className="outfit-flame-heat" />
      <span className="outfit-flame-core" />
      <span className="outfit-flame-tongue outfit-flame-tongue-1" />
      <span className="outfit-flame-tongue outfit-flame-tongue-2" />
      <span className="outfit-flame-tongue outfit-flame-tongue-3" />
      <span className="outfit-flame-tongue outfit-flame-tongue-4" />
      <span className="outfit-flame-spark outfit-flame-spark-1" />
      <span className="outfit-flame-spark outfit-flame-spark-2" />
      <span className="outfit-flame-spark outfit-flame-spark-3" />
    </div>
  )
}

// ─── Outfit Card ─────────────────────────────────────────────────────────────
function OutfitCard({ outfit, isPendingSave, onSelect, performanceMode }: {
  outfit: MascotOutfit
  isPendingSave: boolean
  onSelect: () => void
  performanceMode: boolean
}) {
  const isComingSoon = !outfit.available
  return (
    <button
      type="button"
      disabled={isComingSoon}
      onClick={onSelect}
      className={[
        'group relative flex min-h-0 flex-col items-center gap-2 rounded-xl border-2 p-1.5 pb-2 sm:gap-2.5 sm:rounded-2xl sm:p-2 sm:pb-2.5',
        performanceMode ? '' : 'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        isComingSoon
          ? 'cursor-not-allowed border-gray-200 bg-gray-50/80 opacity-60'
          : isPendingSave
            ? 'cursor-pointer bg-white shadow-lg scale-[1.02]'
            : 'cursor-pointer border-gray-200 bg-white hover:shadow-md hover:scale-[1.015] active:scale-[0.98]',
      ].join(' ')}
      style={isPendingSave ? {
        borderColor: outfit.color,
        boxShadow: `0 8px 24px -4px ${outfit.color}33`,
      } : undefined}
      aria-label={`Chọn trang phục ${outfit.name}`}
      aria-pressed={isPendingSave}
    >
      {outfit.tag && (
        <span className={[
          'absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap z-10',
          outfit.tag === 'default' ? 'bg-gray-200 text-gray-600'
            : outfit.tag === 'coming-soon' ? 'bg-gray-300 text-gray-500'
              : outfit.tag === 'special' ? 'bg-amber-400 text-amber-900'
                : 'text-white',
        ].join(' ')}
          style={outfit.tag !== 'default' && outfit.tag !== 'coming-soon'
            ? { backgroundColor: outfit.color } as React.CSSProperties
            : undefined}
        >
          {TAG_LABELS[outfit.tag]}
        </span>
      )}

      <div className="mt-1 w-full overflow-hidden rounded-xl" style={{ height: 'clamp(64px, 12dvh, 104px)' }}>
        <AnimatedPreview
          frames={outfit.previewFrames}
          staticSrc={outfit.previewStatic}
          fps={outfit.staticMode ? 7 : 14}
          accentColor={outfit.color}
          bgColor={outfit.bgColor}
          isSelected={isPendingSave}
          animated={!performanceMode}
        />
      </div>

      {!performanceMode && <OutfitFlameBanner outfit={outfit} isSelected={isPendingSave} />}

      {isPendingSave && (
        <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-white shadow"
          style={{ backgroundColor: outfit.color }}>
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      {isComingSoon && (
        <div className={['pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/50', performanceMode ? '' : 'backdrop-blur-[1px]'].join(' ')}>
          <span className="text-xl">🔒</span>
        </div>
      )}
    </button>
  )
}

// ─── World Cup decorations ────────────────────────────────────────────────────

/** Dải cờ các đội tham dự — hiệu ứng marquee cuộn liên tục */
function FlagTicker() {
  const flags = ['🇺🇸','🇨🇦','🇲🇽','🇧🇷','🇫🇷','🇩🇪','🇦🇷','🇪🇸','🇵🇹','🇬🇧','🇳🇱','🇯🇵','🇰🇷','🇲🇦','🇸🇳','🇦🇺','🇺🇸','🇨🇦','🇲🇽','🇧🇷','🇫🇷','🇩🇪','🇦🇷','🇪🇸']
  return (
    <div className="relative overflow-hidden h-7 flex items-center"
      style={{ background: 'rgba(0,0,0,0.15)' }}>
      <div className="flex gap-3 animate-marquee whitespace-nowrap px-2">
        {[...flags, ...flags].map((f, i) => (
          <span key={i} className="text-lg leading-none select-none">{f}</span>
        ))}
      </div>
      {/* fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/30 to-transparent" />
    </div>
  )
}

function WorldCupBanner({ performanceMode = false }: { performanceMode?: boolean }) {
  return (
    <div className="relative mb-3 overflow-hidden rounded-xl sm:mb-3.5"
      style={{
        background: 'linear-gradient(135deg, #006847 0%, #007a52 30%, #ce1126 70%, #a00d1e 100%)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Mexico coat-of-arms inspired grid pattern */}
      <div className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle at 25% 50%, #ffffff 1px, transparent 1px), radial-gradient(circle at 75% 50%, #ffffff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

      {/* Top shimmer */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

      {/* Mexico tricolor stripe — top */}
      <div className="absolute top-0 left-0 right-0 flex h-[3px]">
        <div className="flex-1" style={{ background: '#006847' }} />
        <div className="flex-1" style={{ background: '#ffffff' }} />
        <div className="flex-1" style={{ background: '#ce1126' }} />
      </div>

      <div className="relative z-10 px-2.5 pt-2 pb-0 sm:px-3 sm:pt-2.5">
        {/* Row 1: Jersey SVG + title + Jersey SVG */}
        <div className="mb-2.5 flex items-center justify-between sm:mb-3">
          {/* Jersey SVG — Mexico green */}
          <svg width="28" height="28" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg shrink-0">
            <path d="M10 18L20 12H40L50 18L44 26V52H16V26L10 18Z" fill="#006847" stroke="#004d34" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M20 12C20 12 22 20 30 20C38 20 40 12 40 12" fill="#ffffff" stroke="#e0e0e0" strokeWidth="1"/>
            <path d="M10 18L16 26" stroke="#004d34" strokeWidth="1" strokeLinecap="round"/>
            <path d="M50 18L44 26" stroke="#004d34" strokeWidth="1" strokeLinecap="round"/>
            <rect x="26" y="28" width="8" height="6" rx="1" fill="#ffffff" opacity="0.3"/>
          </svg>
          <div className="text-center">
            <p className="font-sans text-[9px] font-black uppercase tracking-[0.18em] text-white/70 mb-0.5">FIFA World Cup™</p>
            <p className="font-sans text-[15px] font-black text-white leading-tight tracking-tight drop-shadow sm:text-base">
              USA · Canada · Mexico
            </p>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-yellow-400/90 px-2.5 py-0.5">
              <span className="text-[10px] font-black text-yellow-900 tracking-wide">THE LAST DANCE</span>
            </div>
          </div>
          {/* Jersey SVG — Mexico red (away) */}
          <svg width="28" height="28" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg shrink-0" style={{ transform: 'scaleX(-1)' }}>
            <path d="M10 18L20 12H40L50 18L44 26V52H16V26L10 18Z" fill="#ce1126" stroke="#9b0d1e" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M20 12C20 12 22 20 30 20C38 20 40 12 40 12" fill="#ffffff" stroke="#e0e0e0" strokeWidth="1"/>
            <path d="M10 18L16 26" stroke="#9b0d1e" strokeWidth="1" strokeLinecap="round"/>
            <path d="M50 18L44 26" stroke="#9b0d1e" strokeWidth="1" strokeLinecap="round"/>
            <rect x="26" y="28" width="8" height="6" rx="1" fill="#ffffff" opacity="0.3"/>
          </svg>
        </div>

        {/* Row 2: GOAT badges — compact */}
        <div className="mb-2.5 flex items-stretch gap-2 sm:mb-3 sm:gap-2.5">
          {/* CR7 */}
          <div className="flex flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 sm:gap-2 sm:rounded-xl sm:px-2 sm:py-1.5"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-600 border-2 border-white/40 shrink-0 text-sm leading-none">🐐</div>
            <div>
              <p className="font-sans text-[10px] font-black text-yellow-300 uppercase tracking-wide leading-none">CR7</p>
              <p className="font-sans text-[11px] font-bold text-white leading-tight">Ronaldo</p>
              <p className="font-sans text-[9px] text-white/60">SIUUUU 🔥</p>
            </div>
          </div>
          {/* M10 */}
          <div className="flex flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 sm:gap-2 sm:rounded-xl sm:px-2 sm:py-1.5"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-600 border-2 border-white/40 shrink-0 text-sm leading-none">🐐</div>
            <div>
              <p className="font-sans text-[10px] font-black text-sky-300 uppercase tracking-wide leading-none">M10</p>
              <p className="font-sans text-[11px] font-bold text-white leading-tight">Messi</p>
              <p className="font-sans text-[9px] text-white/60">La Pulga 🌟</p>
            </div>
          </div>
          {/* Neymar */}
          <div className="flex flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 sm:gap-2 sm:rounded-xl sm:px-2 sm:py-1.5"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500 border-2 border-white/40 shrink-0 text-sm leading-none">🌪️</div>
            <div>
              <p className="font-sans text-[10px] font-black text-yellow-300 uppercase tracking-wide leading-none">NJR11</p>
              <p className="font-sans text-[11px] font-bold text-white leading-tight">Neymar</p>
              <p className="font-sans text-[9px] text-white/60">Joga Bonito 🇧🇷</p>
            </div>
          </div>
        </div>
      </div>

      {/* Flag ticker */}
      {!performanceMode && <FlagTicker />}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface MascotOutfitModalProps {
  isOpen: boolean
  onClose: () => void
  userEmail: string
  currentOutfitId: string
  onOutfitChange: (outfit: MascotOutfit) => void
  outfits?: MascotOutfit[]
}

export function MascotOutfitModal({
  isOpen, onClose, userEmail, currentOutfitId, onOutfitChange, outfits = MASCOT_OUTFITS,
}: MascotOutfitModalProps) {
  const [mounted, setMounted]     = useState(false)
  const [visible, setVisible]     = useState(false)
  const [pendingId, setPendingId] = useState(currentOutfitId)
  // savedId tracks what's actually persisted — để phân biệt hasChanges
  const [savedId, setSavedId]     = useState(currentOutfitId)
  const [justSaved, setJustSaved] = useState(false)
  const [performanceMode, setPerformanceMode] = useState(false)

  useEffect(() => {
    setMounted(true)
    setPerformanceMode(shouldReduceModalEffects())
  }, [])

  useEffect(() => {
    if (isOpen) {
      setPendingId(currentOutfitId)
      setSavedId(currentOutfitId)
      setJustSaved(false)
    }
  }, [isOpen, currentOutfitId])

  useEffect(() => {
    if (isOpen) {
      if (performanceMode) {
        setVisible(true)
        return
      }
      const t = setTimeout(() => setVisible(true), 10)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
    }
  }, [isOpen, performanceMode])

  const handleSave = () => {
    const outfit = outfits.find(o => o.id === pendingId && o.available)
    if (!outfit) return
    setMascotOutfitId(userEmail, outfit.id)
    onOutfitChange(outfit)          // ← triggers MascotWalker re-render via parent state
    setSavedId(outfit.id)
    setJustSaved(true)
    handleClose()
  }

  const handleClose = () => {
    setVisible(false)
    if (performanceMode) {
      onClose()
      return
    }
    setTimeout(onClose, 200)
  }

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, performanceMode])

  const pendingOutfit = outfits.find(o => o.id === pendingId) ?? outfits[0]
  const hasChanges    = pendingId !== savedId

  if (!mounted || !isOpen) return null

  return createPortal(
    <div
      className={['mascot-outfit-modal font-sans fixed inset-0 z-[9999] flex items-center justify-center p-4', performanceMode ? 'is-performance-mode' : ''].join(' ')}
      role="dialog" aria-modal="true" aria-label="Chọn trang phục mascot"
    >
      {/* Overlay */}
      <div
        className={[
          'absolute inset-0 bg-black/50',
          performanceMode ? '' : 'backdrop-blur-sm transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={handleClose}
        aria-hidden="true"
      />

      <style>{`
        @keyframes outfit-flame-flow {
          0% { background-position: 0% 50%; transform: translateX(0) scaleX(var(--flame-scale)) skewX(-1deg); opacity: 0.92; }
          28% { background-position: 46% 42%; transform: translateX(1px) scaleX(var(--flame-scale)) skewX(2deg); opacity: 1; }
          64% { background-position: 100% 58%; transform: translateX(2px) scaleX(var(--flame-scale)) skewX(-2deg); opacity: 0.88; }
          100% { background-position: 0% 50%; transform: translateX(0) scaleX(var(--flame-scale)) skewX(-1deg); opacity: 0.92; }
        }

        @keyframes outfit-flame-flicker {
          0%, 100% { transform: translateY(0) scaleX(1) rotate(0deg); opacity: 0.82; filter: blur(0); }
          22% { transform: translateY(-1px) scaleX(1.08) rotate(-1deg); opacity: 1; filter: blur(0.15px); }
          55% { transform: translateY(1px) scaleX(0.95) rotate(1.5deg); opacity: 0.72; filter: blur(0.35px); }
          78% { transform: translateY(-0.5px) scaleX(1.04) rotate(-0.5deg); opacity: 0.95; filter: blur(0.1px); }
        }

        @keyframes outfit-flame-heat {
          0%, 100% { transform: translateX(0) scaleY(0.9); opacity: 0.22; }
          45% { transform: translateX(3px) scaleY(1.18); opacity: 0.36; }
          70% { transform: translateX(1px) scaleY(0.96); opacity: 0.18; }
        }

        @keyframes outfit-flame-spark {
          0% { transform: translateX(-2px) translateY(0) scale(0.65); opacity: 0; }
          18% { opacity: 0.95; }
          100% { transform: translateX(54px) translateY(-8px) scale(0.18); opacity: 0; }
        }

        .outfit-flame-banner {
          --flame-scale: 1;
          position: relative;
          isolation: isolate;
          width: calc(100% + 18px);
          max-width: 168px;
          height: 30px;
          flex: 0 0 30px;
          margin-inline: -9px;
          transform-origin: left center;
          filter: drop-shadow(0 7px 13px var(--flame-glow));
          overflow: visible;
        }

        .outfit-flame-banner::before {
          content: "";
          position: absolute;
          inset: 6px -10px 0 22px;
          border-radius: 999px 999px 999px 40%;
          background:
            radial-gradient(48px 15px at 12% 54%, #fff7ad 0 14%, var(--flame-b) 15% 34%, transparent 36%),
            radial-gradient(60px 18px at 40% 42%, color-mix(in srgb, var(--flame-b), white 18%) 0 18%, transparent 38%),
            linear-gradient(90deg, var(--flame-b), #ff8a00 34%, var(--flame-c) 68%, transparent 100%);
          background-size: 210% 100%;
          clip-path: polygon(0 39%, 12% 12%, 24% 38%, 38% 5%, 52% 34%, 67% 8%, 80% 40%, 100% 51%, 80% 59%, 66% 92%, 48% 70%, 31% 96%, 17% 70%, 0 82%);
          animation: outfit-flame-flow 0.96s cubic-bezier(.45,0,.2,1) infinite;
        }

        .outfit-flame-banner::after {
          content: "";
          position: absolute;
          inset: 9px -3px 4px 39px;
          border-radius: 999px;
          background:
            radial-gradient(32px 11px at 16% 50%, white 0 9%, #fff7ad 10% 27%, transparent 44%),
            linear-gradient(90deg, #fff7ad, var(--flame-b) 43%, #ff7a18 72%, transparent);
          clip-path: polygon(0 51%, 16% 18%, 31% 46%, 48% 10%, 64% 44%, 83% 23%, 100% 56%, 73% 73%, 54% 92%, 34% 70%, 12% 86%);
          mix-blend-mode: screen;
          opacity: 0.84;
          animation: outfit-flame-flicker 0.58s ease-in-out infinite;
        }

        .outfit-flame-heat {
          position: absolute;
          left: 28px;
          right: 0;
          bottom: -3px;
          height: 12px;
          border-radius: 999px;
          background: radial-gradient(ellipse at center, var(--flame-glow) 0 34%, transparent 70%);
          filter: blur(4px);
          animation: outfit-flame-heat 1.25s ease-in-out infinite;
        }

        .outfit-flame-mark {
          position: absolute;
          left: 1px;
          top: 6px;
          z-index: 3;
          width: 38px;
          height: 21px;
          overflow: hidden;
          border: 1px solid rgba(17,24,39,0.28);
          border-radius: 3px;
          transform: rotate(-10deg);
          box-shadow: 0 2px 4px rgba(0,0,0,0.24), inset 0 0 0 1px rgba(255,255,255,0.22);
        }

        .outfit-flame-mark img,
        .outfit-flame-mark span,
        .outfit-flame-mark i {
          position: absolute;
          display: block;
        }

        .outfit-flame-mark img {
          display: none;
          inset: -2px;
          width: calc(100% + 4px);
          height: calc(100% + 4px);
          object-fit: contain;
          pointer-events: none;
          user-select: none;
        }

        .outfit-flame-mark-ball {
          width: 28px;
          height: 28px;
          top: 2px;
          left: 6px;
          overflow: visible;
          border: 0;
          border-radius: 999px;
          background: transparent;
          transform: rotate(-10deg);
          box-shadow: none;
        }

        .outfit-flame-mark-ball img {
          display: block;
        }

        .outfit-flame-mark-ball span,
        .outfit-flame-mark-ball i {
          display: none;
        }

        .outfit-flame-mark-dynamic {
          background: #ffffff;
        }

        .outfit-flame-mark-dynamic img {
          display: block;
          object-fit: cover;
        }

        .outfit-flame-mark-dynamic span,
        .outfit-flame-mark-dynamic i {
          display: none;
        }

        .outfit-flame-mark-vn { background: #da251d; }
        .outfit-flame-mark-vn i {
          left: 50%;
          top: 50%;
          width: 12px;
          height: 12px;
          background: #ffde00;
          transform: translate(-50%, -50%);
          clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 56%, 79% 91%, 50% 70%, 21% 91%, 32% 56%, 2% 35%, 39% 35%);
        }

        .outfit-flame-mark-bdn { background: linear-gradient(90deg, #006847 0 40%, #ce1126 40% 100%); }
        .outfit-flame-mark-bdn i {
          left: 38%;
          top: 50%;
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: radial-gradient(circle, #ffffff 0 27%, #ffcc00 29% 58%, #b91c1c 60% 100%);
          transform: translate(-50%, -50%);
          box-shadow: 0 0 0 0.5px rgba(255,255,255,0.7);
        }

        .outfit-flame-mark-bz { background: #009b3a; }
        .outfit-flame-mark-bz span:nth-child(1) {
          inset: 2px 5px;
          background: #ffdf00;
          clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
        }
        .outfit-flame-mark-bz i {
          left: 50%;
          top: 50%;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #002776;
          transform: translate(-50%, -50%);
          box-shadow: inset 0 2px 0 rgba(255,255,255,0.82);
        }

        .outfit-flame-mark-phap {
          background: linear-gradient(90deg, #0055a4 0 33.33%, #ffffff 33.33% 66.66%, #ef4135 66.66% 100%);
        }

        .outfit-flame-mark-argen {
          background: linear-gradient(180deg, #74acdf 0 33.33%, #ffffff 33.33% 66.66%, #74acdf 66.66% 100%);
        }
        .outfit-flame-mark-argen i {
          left: 50%;
          top: 50%;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #f6b40e;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 0 0.5px rgba(146,88,0,0.3);
        }

        .outfit-flame-core,
        .outfit-flame-tongue,
        .outfit-flame-spark {
          position: absolute;
          pointer-events: none;
          border-radius: 999px;
        }

        .outfit-flame-core {
          left: 35px;
          top: 11px;
          z-index: 2;
          width: 72px;
          height: 10px;
          background:
            radial-gradient(30px 8px at 12% 50%, white 0 18%, transparent 46%),
            linear-gradient(90deg, #fff7ad, var(--flame-b), #ff7a18);
          clip-path: polygon(0 45%, 22% 7%, 39% 43%, 58% 10%, 78% 51%, 100% 44%, 77% 74%, 55% 89%, 34% 65%, 10% 88%);
          animation: outfit-flame-flicker 0.48s ease-in-out infinite reverse;
        }

        .outfit-flame-tongue-1 {
          right: -10px;
          top: 10px;
          width: 68px;
          height: 12px;
          background: linear-gradient(90deg, var(--flame-c), #ff6a00, transparent);
          clip-path: polygon(0 50%, 22% 8%, 47% 35%, 100% 45%, 48% 67%, 28% 93%);
          animation: outfit-flame-flicker 0.82s ease-in-out infinite;
        }

        .outfit-flame-tongue-2 {
          right: 14px;
          top: 5px;
          width: 58px;
          height: 10px;
          background: linear-gradient(90deg, var(--flame-a), var(--flame-b), transparent);
          clip-path: polygon(0 55%, 45% 0, 100% 45%, 40% 80%);
          opacity: 0.72;
          animation: outfit-flame-flicker 0.66s ease-in-out infinite reverse;
        }

        .outfit-flame-tongue-3 {
          right: 18px;
          bottom: 2px;
          width: 72px;
          height: 9px;
          background: linear-gradient(90deg, color-mix(in srgb, var(--flame-c), #6b0000 35%), var(--flame-a), transparent);
          clip-path: polygon(0 30%, 48% 0, 100% 38%, 42% 100%);
          opacity: 0.54;
          animation: outfit-flame-flicker 1.02s ease-in-out infinite;
        }

        .outfit-flame-tongue-4 {
          left: 44px;
          top: 4px;
          width: 54px;
          height: 9px;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--flame-b), white 18%), transparent);
          clip-path: polygon(0 70%, 32% 10%, 54% 49%, 100% 0, 72% 78%, 32% 100%);
          opacity: 0.62;
          animation: outfit-flame-flicker 0.7s ease-in-out infinite;
        }

        .outfit-flame-spark {
          z-index: 4;
          width: 3.5px;
          height: 3.5px;
          background: var(--flame-b);
          box-shadow: 0 0 6px var(--flame-b);
          animation: outfit-flame-spark 1.05s linear infinite;
        }

        .outfit-flame-spark-1 { left: 52px; top: 7px; }
        .outfit-flame-spark-2 { left: 68px; top: 20px; animation-delay: 0.42s; }
        .outfit-flame-spark-3 { left: 92px; top: 9px; animation-delay: 0.68s; }

        @media (prefers-reduced-motion: reduce) {
          .outfit-flame-banner::before,
          .outfit-flame-banner::after,
          .outfit-flame-heat,
          .outfit-flame-core,
          .outfit-flame-tongue,
          .outfit-flame-spark {
            animation: none;
          }
        }

        .mascot-outfit-modal.is-performance-mode,
        .mascot-outfit-modal.is-performance-mode *,
        .mascot-outfit-modal.is-performance-mode *::before,
        .mascot-outfit-modal.is-performance-mode *::after {
          animation: none !important;
          transition: none !important;
          filter: none !important;
          scroll-behavior: auto !important;
        }

        .mascot-outfit-modal.is-performance-mode .outfit-flame-banner {
          display: none !important;
        }
      `}</style>

      {/* Panel — resize về cũ với scroll */}
      <div
        className={[
          'relative w-full max-w-[720px] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]',
          'pointer-events-auto overflow-hidden',
          'rounded-[1.35rem] sm:rounded-[2rem]',
          performanceMode ? '' : 'transition-all duration-200',
          performanceMode ? 'opacity-100 scale-100' : visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        ].join(' ')}
        style={{
          background: 'linear-gradient(160deg, #f5fdf9 0%, #ffffff 40%, #fff5f5 100%)',
          boxShadow: '0 32px 80px -16px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── World Cup decorative background layer ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.35rem] sm:rounded-[2rem]">
          {/* Mexico tricolor gradient wash — xanh lá (006847) → trắng → đỏ (CE1126) */}
          <div className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,104,71,0.06) 0%, rgba(255,255,255,0) 45%, rgba(206,17,38,0.05) 100%)',
            }} />

          {/* Left side: Mexico green panel */}
          <div className="absolute top-0 left-0 bottom-0 w-1.5 rounded-l-[2rem]"
            style={{ background: 'linear-gradient(180deg, #006847, #007a52)' }} />
          {/* Right side: Mexico red panel */}
          <div className="absolute top-0 right-0 bottom-0 w-1.5 rounded-r-[2rem]"
            style={{ background: 'linear-gradient(180deg, #ce1126, #a00d1e)' }} />

          {/* Large CR7 silhouette — bottom left */}
          <div className="absolute bottom-2 left-4 select-none"
            style={{ fontSize: '5.5rem', lineHeight: 1, opacity: 0.055, transform: 'scaleX(-1)' }}>
            ⚽
          </div>
          {/* Large trophy — top right */}
          <div className="absolute top-4 right-6 select-none"
            style={{ fontSize: '4.5rem', lineHeight: 1, opacity: 0.055 }}>
            🏆
          </div>
          {/* SIUU text watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none"
            style={{
              fontSize: '6rem',
              fontWeight: 900,
              opacity: 0.025,
              letterSpacing: '-0.05em',
              color: '#ce1126',
              whiteSpace: 'nowrap',
              fontFamily: 'sans-serif',
            }}>
            SIUUUU
          </div>
          {/* Star decorations */}
          <div className="absolute top-5 left-8 select-none" style={{ fontSize: '1.4rem', opacity: 0.12 }}>⭐</div>
          <div className="absolute top-12 right-12 select-none" style={{ fontSize: '1rem', opacity: 0.10 }}>⭐</div>
          <div className="absolute bottom-20 right-6 select-none" style={{ fontSize: '1.2rem', opacity: 0.10 }}>⭐</div>
          <div className="absolute bottom-6 left-1/3 select-none" style={{ fontSize: '1rem', opacity: 0.10 }}>⭐</div>
          {/* Scattered flags */}
          <div className="absolute top-8 left-1/4 select-none" style={{ fontSize: '1.3rem', opacity: 0.15 }}>🇲🇽</div>
          <div className="absolute top-8 right-1/4 select-none" style={{ fontSize: '1.3rem', opacity: 0.15 }}>🇵🇹</div>
          <div className="absolute bottom-12 left-1/5 select-none" style={{ fontSize: '1.2rem', opacity: 0.13 }}>🇦🇷</div>
          <div className="absolute bottom-12 right-1/5 select-none" style={{ fontSize: '1.2rem', opacity: 0.13 }}>🇧🇷</div>
        </div>

        {/* Top stripe — Mexico tricolor */}
        <div className="absolute top-0 left-0 right-0 flex h-[5px] rounded-t-[2rem] overflow-hidden">
          <div className="flex-1" style={{ background: '#006847' }} />
          <div className="flex-1" style={{ background: '#ffffff' }} />
          <div className="flex-1" style={{ background: '#ce1126' }} />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/8 text-gray-500 transition-all duration-200 hover:bg-black/12 hover:scale-110 hover:text-gray-800"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">

          {/* Header */}
          <div className="mb-2.5 flex flex-col items-center text-center sm:mb-3">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-red-200/60 px-2.5 py-0.5 sm:px-3 sm:py-1"
              style={{ background: 'linear-gradient(90deg, rgba(0,104,71,0.08), rgba(206,17,38,0.08))' }}>
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest"
                style={{ background: 'linear-gradient(90deg, #006847, #ce1126)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Trang phục Dodo
              </span>
            </div>
            <h2 className="font-sans text-base font-black text-gray-900 sm:text-lg">
              MẶC GÌ HÔM NAY ?
            </h2>
          </div>

          {/* World Cup banner */}
          <WorldCupBanner performanceMode={performanceMode} />

          {/* Grid 3 cols */}
          <div className="grid grid-cols-3 gap-3 sm:gap-3.5">
            {outfits.map(outfit => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                isPendingSave={pendingId === outfit.id}
                performanceMode={performanceMode}
                onSelect={() => {
                  if (outfit.available) {
                    setPendingId(outfit.id)
                    setJustSaved(false)
                  }
                }}
              />
            ))}
          </div>

          {/* Save bar */}
          <div className="mt-3.5 flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-sans text-sm text-gray-500 shrink-0">Đang chọn:</span>
              {pendingOutfit && (
                <span className="font-sans text-sm font-semibold truncate"
                  style={{ color: pendingOutfit.color }}>
                  {pendingOutfit.name}
                </span>
              )}
              {savedId === pendingId && !justSaved && savedId !== 'default' && (
                <span className="text-xs text-gray-400">(đang dùng)</span>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={!hasChanges && !justSaved}
              className={[
                'font-sans inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95',
                justSaved
                  ? 'bg-emerald-500 text-white shadow-md'
                  : hasChanges
                    ? 'bg-[#a1001f] text-white shadow-md hover:bg-[#870019] hover:shadow-lg'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed',
              ].join(' ')}
            >
              {justSaved ? (
                <><Check className="h-4 w-4" strokeWidth={2.5} />Đã lưu!</>
              ) : (
                <><Save className="h-4 w-4" />Lưu trang phục</>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body,
  )
}
