'use client'

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Crown, Eye, Save, Shirt, Star, Sparkles, Trophy } from 'lucide-react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { normalizeStorageUrl } from '@/lib/storage-url'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Teacher {
  teacher_code: string
  full_name: string
  center: string
  total_score: number
  avatar_url: string | null
}
interface TopTeachersResponse { success: boolean; data: Teacher[] }

interface Rect { x: number; y: number; w: number; h: number }

// ─── Utils ───────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
const HONORS_SCORE_LABEL = 'CR45'
const CONFETTI_BURST_MS = 2400
const HONORS_DIALOG_TITLE_ID = 'teacher-honors-popup-title'
const HONORS_DIALOG_DESCRIPTION_ID = 'teacher-honors-popup-description'
const HONORS_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const MOCK_TOP_TEACHERS: Teacher[] = [
  {
    teacher_code: 'mock-rank-1',
    full_name: 'Phạm Thị Ngọc Anh',
    center: 'Hải Phòng - 268 Trần Nguyên Hãn',
    total_score: 85.00,
    avatar_url: null,
  },
  {
    teacher_code: 'mock-rank-2',
    full_name: 'Nguyễn Hải Dương',
    center: 'Bắc Ninh - 09 Lê Thái Tổ',
    total_score: 55.00,
    avatar_url: null,
  },
  {
    teacher_code: 'mock-rank-3',
    full_name: 'Trần Anh Khôi',
    center: 'HCM - 618 Đường 3/2',
    total_score: 53.57,
    avatar_url: null,
  },
]

const EMPTY_TOP_TEACHERS: Teacher[] = [
  {
    teacher_code: 'empty-rank-1',
    full_name: 'Đang cập nhật',
    center: '—',
    total_score: 0,
    avatar_url: null,
  },
  {
    teacher_code: 'empty-rank-2',
    full_name: 'Đang cập nhật',
    center: '—',
    total_score: 0,
    avatar_url: null,
  },
  {
    teacher_code: 'empty-rank-3',
    full_name: 'Đang cập nhật',
    center: '—',
    total_score: 0,
    avatar_url: null,
  },
]

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase()
    : (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase()
}

function fittedFontSize(length: number, minPx: number, maxPx: number, vwFactor: number) {
  const safeLength = Math.max(length, 10)
  const preferredVw = Math.max(minPx / 3.9, vwFactor / safeLength)
  return `clamp(${minPx}px, ${preferredVw.toFixed(3)}vw, ${maxPx}px)`
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getHonorsResponsiveScales() {
  const visualViewport = window.visualViewport
  const viewportWidth = visualViewport?.width ?? window.innerWidth
  const viewportHeight = visualViewport?.height ?? window.innerHeight
  const safeWidth = Math.max(320, viewportWidth)
  const safeHeight = Math.max(320, viewportHeight)
  const aspectRatio = safeWidth / safeHeight
  const isCompactPortrait = safeWidth < 640 && aspectRatio < 1
  const isDesktop = safeWidth >= 900
  const viewportGutter = isDesktop ? (safeHeight < 680 ? 16 : 24) : 8
  const desktopWidthCap = safeWidth >= 1440 ? 1120 : safeWidth >= 1180 ? 1060 : 980
  const desktopHeightCap = safeHeight >= 820 ? 720 : safeHeight >= 740 ? 690 : safeHeight - viewportGutter
  const dialogWidth = isDesktop
    ? clampNumber(Math.min(desktopWidthCap, safeWidth - viewportGutter), 860, desktopWidthCap)
    : Math.max(320, safeWidth - viewportGutter)
  const dialogHeight = isDesktop
    ? clampNumber(Math.min(desktopHeightCap, safeHeight - viewportGutter), 520, desktopHeightCap)
    : clampNumber(Math.min(safeHeight - viewportGutter, safeHeight * 0.94), 500, safeHeight - viewportGutter)

  const baseWidth = isCompactPortrait ? 390 : 1040
  const baseHeight = isCompactPortrait ? 720 : 700
  const maxVisualScale = safeWidth >= 1440 && safeHeight >= 800 ? 1.06 : 1
  const fitScale = Math.min(dialogWidth / baseWidth, dialogHeight / baseHeight, maxVisualScale)
  const shortScreenScale = safeHeight < 720 ? safeHeight / 720 : maxVisualScale
  const wideScreenScale = aspectRatio > 1.9 && safeHeight < 760 ? 1 - (aspectRatio - 1.9) * 0.13 : maxVisualScale
  const tallScreenScale = aspectRatio < 0.62 ? 0.96 : maxVisualScale
  const rawScale = isCompactPortrait
    ? fitScale
    : Math.min(fitScale, shortScreenScale, wideScreenScale, tallScreenScale)
  const baseScale = clampNumber(rawScale, isCompactPortrait ? 0.9 : 0.68, maxVisualScale)
  const podiumTopPad = isDesktop
    ? clampNumber(safeHeight * 0.024, safeHeight < 760 ? 10 : 16, safeHeight < 760 ? 18 : 24)
    : clampNumber(safeHeight * 0.012, 4, 12)

  return {
    width: safeWidth,
    height: safeHeight,
    dialogWidth,
    dialogHeight,
    uiScale: baseScale,
    medalScale: clampNumber(baseScale * (safeHeight < 580 ? 0.96 : 1), 0.64, maxVisualScale),
    scoreScale: clampNumber(baseScale * (safeHeight < 620 ? 0.94 : 1), 0.62, maxVisualScale),
    podiumTopPad,
  }
}

function getDeviceHints() {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean }
    deviceMemory?: number
  }
  return {
    cores: navigator.hardwareConcurrency || 8,
    memory: nav.deviceMemory || 8,
    saveData: nav.connection?.saveData === true,
  }
}

function shouldReduceVisualEffects() {
  if (typeof window === 'undefined') return false
  const { cores, memory, saveData } = getDeviceHints()
  return (
    window.matchMedia('(max-width: 767px), (pointer: coarse), (prefers-reduced-motion: reduce), (prefers-reduced-transparency: reduce)').matches ||
    saveData ||
    cores <= 4 ||
    memory <= 4
  )
}

function shouldAllowInteractiveTilt() {
  if (typeof window === 'undefined' || shouldReduceVisualEffects()) return false
  const { cores, memory } = getDeviceHints()
  return window.innerWidth >= 1024 && cores >= 8 && memory >= 8
}

// ─── Easing ──────────────────────────────────────────────────────────────────

const E = {
  outExpo: (t: number) => t >= 1 ? 1 : 1 - 2 ** (-10 * t),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  outQuart: (t: number) => 1 - (1 - t) ** 4,
  inQuart: (t: number) => t ** 4,
  inOutCubic: (t: number) => t < .5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2,
  outElastic: (t: number) => {
    if (t <= 0) return 0; if (t >= 1) return 1
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
  },
}

// ─── Canvas Genie Painter ─────────────────────────────────────────────────────

function paintGenie(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, sw: number, sh: number,
  tx: number, ty: number, tw: number, th: number,
  topT: number, botT: number,
  alpha: number,
  isClosing = false,
) {
  const lerpX = (a: number, b: number, t: number) => a + (b - a) * t
  const lerpY = (a: number, b: number, t: number) => a + (b - a) * t

  const stl = { x: sx - sw / 2, y: sy - sh / 2 }
  const str = { x: sx + sw / 2, y: sy - sh / 2 }
  const sbl = { x: sx - sw / 2, y: sy + sh / 2 }
  const sbr = { x: sx + sw / 2, y: sy + sh / 2 }

  const ttl = { x: tx, y: ty }
  const ttr = { x: tx + tw, y: ty }
  const tbl = { x: tx, y: ty + th }
  const tbr = { x: tx + tw, y: ty + th }

  const TL = { x: lerpX(stl.x, ttl.x, topT), y: lerpY(stl.y, ttl.y, topT) }
  const TR = { x: lerpX(str.x, ttr.x, topT), y: lerpY(str.y, ttr.y, topT) }
  const BL = { x: lerpX(sbl.x, tbl.x, botT), y: lerpY(sbl.y, tbl.y, botT) }
  const BR = { x: lerpX(sbr.x, tbr.x, botT), y: lerpY(sbr.y, tbr.y, botT) }

  const pinchFactor = Math.abs(topT - botT)
  const pinchPx = pinchFactor * Math.min(tw, th) * 0.55 * Math.sin(Math.PI * Math.min(topT, botT + 0.1))

  const lcpT = { x: TL.x + pinchPx, y: TL.y + (BL.y - TL.y) * 0.35 }
  const lcpB = { x: BL.x + pinchPx, y: TL.y + (BL.y - TL.y) * 0.65 }
  const rcpT = { x: TR.x - pinchPx, y: TR.y + (BR.y - TR.y) * 0.35 }
  const rcpB = { x: BR.x - pinchPx, y: TR.y + (BR.y - TR.y) * 0.65 }

  const minY = Math.min(TL.y, TR.y)
  const maxY = Math.max(BL.y, BR.y)
  const grad = ctx.createLinearGradient(0, minY, 0, maxY)
  if (isClosing) {
    grad.addColorStop(0, `rgba(244, 236, 221, ${alpha * 0.92})`)
    grad.addColorStop(0.4, `rgba(255, 249, 237, ${alpha * 0.82})`)
    grad.addColorStop(1, `rgba(255, 249, 237, ${alpha * 0.55})`)
  } else {
    grad.addColorStop(0, `rgba(255, 249, 237, ${alpha * 0.65})`)
    grad.addColorStop(0.5, `rgba(244, 236, 221, ${alpha * 0.88})`)
    grad.addColorStop(1, `rgba(244, 236, 221, ${alpha * 0.95})`)
  }

  ctx.beginPath()
  ctx.moveTo(TL.x, TL.y)
  ctx.lineTo(TR.x, TR.y)
  ctx.bezierCurveTo(rcpT.x, rcpT.y, rcpB.x, rcpB.y, BR.x, BR.y)
  ctx.lineTo(BL.x, BL.y)
  ctx.bezierCurveTo(lcpB.x, lcpB.y, lcpT.x, lcpT.y, TL.x, TL.y)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  ctx.strokeStyle = `rgba(212, 180, 106, ${alpha * 0.45})`
  ctx.lineWidth = 1.5
  ctx.stroke()
}

// ─── Particle System ─────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number
  size: number; opacity: number; decay: number; color: string
}

function spawnParticles(cx: number, cy: number, count: number): Particle[] {
  const colors = ['#d4b46a', '#e8c97a', '#f4ecd5', '#ffffff', '#c9a84c', '#ffe8a0', '#f5d78e']
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 1.5 + Math.random() * 4
    return {
      x: cx + (Math.random() - .5) * 40,
      y: cy + (Math.random() - .5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 2 + Math.random() * 4,
      opacity: 0.8 + Math.random() * 0.2,
      decay: 0.012 + Math.random() * 0.018,
      color: colors[Math.floor(Math.random() * colors.length)],
    }
  })
}

const CONFETTI_COLORS = ['#d4b46a', '#e8c97a', '#c9a84c', '#f5d78e', '#ffe8a0', '#ffffff', '#f4ecd5', '#f0d89a']
const CSS_CONFETTI = Array.from({ length: 24 }, (_, index) => ({
  left: (index * 37 + 11) % 100,
  size: 3 + ((index * 7) % 5),
  duration: 5.8 + ((index * 13) % 28) / 10,
  delay: -((index * 17) % 82) / 10,
  drift: ((index * 29) % 100) - 50,
  rotation: 240 + ((index * 47) % 540),
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  shape: index % 5 === 0 ? 'star' : index % 3 === 0 ? 'diamond' : 'ribbon',
}))

function ConfettiRain({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="honors-confetti absolute inset-0 z-10 overflow-hidden pointer-events-none" aria-hidden>
      {CSS_CONFETTI.map((particle, index) => (
        <i
          key={index}
          className={`honors-confetti-piece is-${particle.shape}`}
          style={{
            '--confetti-left': `${particle.left}%`,
            '--confetti-size': `${particle.size}px`,
            '--confetti-height': `${particle.size * 1.55}px`,
            '--confetti-duration': `${particle.duration}s`,
            '--confetti-delay': `${particle.delay}s`,
            '--confetti-drift': `${particle.drift}px`,
            '--confetti-rotation': `${particle.rotation}deg`,
            '--confetti-color': particle.color,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

// ─── SVG Laurel Leaf Wreath Component (Scaled Down) ─────────────────────────

function MedalLaurelLeaves({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 135 75"
      className="medal-laurel-leaves absolute -top-1.5 left-1/2 -translate-x-1/2 w-[105px] h-[58px] sm:w-[120px] sm:h-[66px] pointer-events-none z-10"
      fill="none"
    >
      <defs>
        <linearGradient id="gold-laurel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2B2" />
          <stop offset="40%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id="silver-laurel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="36%" stopColor="#CBD5E1" />
          <stop offset="72%" stopColor="#64748B" />
          <stop offset="100%" stopColor="#1F2937" />
        </linearGradient>
        <linearGradient id="bronze-laurel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFEDD5" />
          <stop offset="50%" stopColor="#C2410C" />
          <stop offset="100%" stopColor="#7C2D12" />
        </linearGradient>
      </defs>

      {/* Left branch */}
      <g fill={color}>
        <path d="M 42 66 C 24 56 14 36 20 16" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M 20 16 C 14 10, 12 2, 18 0 C 22 6, 24 12, 20 16 Z" opacity="0.95" />
        <path d="M 20 16 C 26 10, 34 8, 36 14 C 30 16, 24 18, 20 16 Z" opacity="0.85" />
        <path d="M 18 28 C 10 24, 6 16, 10 12 C 16 16, 20 22, 18 28 Z" opacity="0.95" />
        <path d="M 18 28 C 24 24, 32 24, 34 30 C 28 32, 22 32, 18 28 Z" opacity="0.85" />
        <path d="M 22 42 C 14 40, 8 34, 12 28 C 18 30, 22 36, 22 42 Z" opacity="0.95" />
        <path d="M 22 42 C 28 40, 36 42, 36 48 C 30 48, 24 46, 22 42 Z" opacity="0.85" />
        <path d="M 30 56 C 22 56, 16 50, 20 44 C 26 46, 28 52, 30 56 Z" opacity="0.95" />
      </g>

      {/* Right branch */}
      <g fill={color}>
        <path d="M 93 66 C 111 56 121 36 115 16" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M 115 16 C 121 10, 123 2, 117 0 C 113 6, 111 12, 115 16 Z" opacity="0.95" />
        <path d="M 115 16 C 109 10, 101 8, 99 14 C 105 16, 111 18, 115 16 Z" opacity="0.85" />
        <path d="M 117 28 C 125 24, 129 16, 125 12 C 119 16, 115 22, 117 28 Z" opacity="0.95" />
        <path d="M 117 28 C 111 24, 108 24, 101 30 C 107 32, 113 32, 117 28 Z" opacity="0.85" />
        <path d="M 113 42 C 121 40, 127 34, 123 28 C 117 30, 113 36, 113 42 Z" opacity="0.95" />
        <path d="M 113 42 C 107 40, 99 42, 99 48 C 105 48, 111 46, 113 42 Z" opacity="0.85" />
        <path d="M 105 56 C 113 56, 119 50, 115 44 C 109 46, 107 52, 105 56 Z" opacity="0.95" />
      </g>
    </svg>
  )
}

// ─── 3D Metallic Cylindrical Podium Base (Compact Proportions) ───────────────

function Metallic3DPodiumBase({ rank }: { rank: number }) {
  const isGold = rank === 1
  const isSilver = rank === 2

  const topGradient = isGold
    ? 'linear-gradient(135deg, #FFF6D1 0%, #F5C042 50%, #B87A0E 100%)'
    : isSilver
      ? 'linear-gradient(135deg, #FFFFFF 0%, #DDE5EF 24%, #94A3B8 50%, #F8FAFC 68%, #475569 100%)'
      : 'linear-gradient(135deg, #FFEBDD 0%, #D98859 50%, #7C3A18 100%)'

  const bodyGradient = isGold
    ? 'linear-gradient(180deg, #FDE68A 0%, #D97706 45%, #78350F 100%)'
    : isSilver
      ? 'linear-gradient(180deg, #E2E8F0 0%, #94A3B8 38%, #64748B 66%, #1E293B 100%)'
      : 'linear-gradient(180deg, #FFEDD5 0%, #EA580C 45%, #7C2D12 100%)'

  const ringBorder = isGold
    ? 'rgba(254, 240, 138, 0.95)'
    : isSilver
      ? 'rgba(148, 163, 184, 0.95)'
      : 'rgba(254, 215, 170, 0.95)'

  const heightCls = isGold ? 'h-8 sm:h-10 md:h-12' : isSilver ? 'h-6 sm:h-8 md:h-9' : 'h-5 sm:h-7 md:h-8'

  return (
    <div className={cn('podium-base relative w-[114%] -ml-[7%] flex flex-col items-center pointer-events-none select-none z-0', isGold ? '-mt-1.5 sm:-mt-2' : '-mt-1 sm:-mt-1.5')}>
      {/* Top 3D Ellipse Surface */}
      <div
        className="w-full h-4 sm:h-5 rounded-[50%] relative z-10 border shadow-sm overflow-hidden"
        style={{
          background: topGradient,
          borderColor: ringBorder,
          boxShadow: 'inset 0 1.5px 3px rgba(255,255,255,0.85), 0 3px 8px rgba(0,0,0,0.2)',
        }}
      >
        <div className="absolute inset-x-3 top-0.5 h-1.5 rounded-[50%] bg-white/40 blur-[1px]" />
      </div>
      {/* 3D Cylinder Body */}
      <div
        className={cn('w-full -mt-2 sm:-mt-2.5 rounded-b-[1rem] relative z-0 shadow-xl overflow-hidden', heightCls)}
        style={{
          background: bodyGradient,
          boxShadow: '0 14px 28px -8px rgba(0,0,0,0.35), inset 0 1.5px 3px rgba(255,255,255,0.5), inset 0 -4px 8px rgba(0,0,0,0.3)',
        }}
      >
        {/* Metallic sheen vertical highlights */}
        <div className="absolute left-[15%] inset-y-0 w-[20%] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />
        <div className="absolute right-[20%] inset-y-0 w-[12%] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        {/* Bottom edge highlight trim */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" />
      </div>
    </div>
  )
}

// ─── 3D Card Component ────────────────────────────────────────────────────────

interface PodiumCardProps {
  teacher: { teacher_code: string; full_name: string; center: string; total_score: number; avatar_url: string | null; rank: number }
  idx: number
  animCls: string
  triggerAnimate: boolean
  performanceMode: boolean
}

const PodiumCard = memo(function PodiumCard({ teacher, idx, animCls, triggerAnimate, performanceMode }: PodiumCardProps) {
  const cardEl = useRef<HTMLDivElement>(null)
  const scoreEl = useRef<SVGTextElement>(null)
  const rafTilt = useRef<number | null>(null)
  const targetTilt = useRef({ x: 0, y: 0 })
  const currentTilt = useRef({ x: 0, y: 0 })
  const allowInteractiveEffects = useRef(true)

  const isFirst = idx === 1

  useEffect(() => {
    allowInteractiveEffects.current = !performanceMode && shouldAllowInteractiveTilt()
  }, [performanceMode])

  useEffect(() => {
    const finalScore = `${teacher.total_score.toFixed(2)}%`
    if (!triggerAnimate) {
      if (scoreEl.current) scoreEl.current.textContent = '0.00%'
      return
    }
    if (performanceMode) {
      if (scoreEl.current) scoreEl.current.textContent = finalScore
      return
    }
    let startTimestamp: number | null = null
    const duration = 1200
    const target = teacher.total_score
    let rafId: number
    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      if (scoreEl.current) scoreEl.current.textContent = `${(easeProgress * target).toFixed(2)}%`
      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [triggerAnimate, teacher.total_score, performanceMode])

  const nameFontSize = fittedFontSize(teacher.full_name.length, isFirst ? 15 : 14, isFirst ? 19 : 17, isFirst ? 95 : 82)
  const centerFontSize = fittedFontSize(teacher.center.length, isFirst ? 11 : 10, isFirst ? 13 : 12, isFirst ? 72 : 64)
  const teacherInitials = initials(teacher.full_name)

  const awardThemes = useMemo(() => ([
    { // Hạng II (Silver, Left) - idx 0
      rankText: 'Hạng II',
      medalNumber: '2',
      laurelColor: 'url(#silver-laurel-grad)',
      metalBg: 'linear-gradient(135deg, #FFFFFF 0%, #D7DEE8 25%, #8A96A8 58%, #334155 100%)',
      metalBorder: '2.5px solid #94A3B8',
      metalColor: '#1E293B',
      ribbonBg: 'linear-gradient(180deg, #64748B 0%, #334155 48%, #111827 100%)',
      cardBg: 'linear-gradient(180deg, #FFFFFF 0%, #EEF2F7 42%, #D7DEE8 100%)',
      cardBorder: 'linear-gradient(135deg, #FFFFFF 0%, #BFC8D4 24%, #64748B 58%, #F8FAFC 100%)',
      outerBorderColor: 'rgba(100, 116, 139, 0.98)',
      shadow: '0 22px 46px -10px rgba(30, 41, 59, 0.42), 0 0 18px rgba(148, 163, 184, 0.72), 0 0 0 1.5px rgba(241, 245, 249, 0.95)',
      monogramColor: '#475569',
      innerLineColor: 'rgba(100, 116, 139, 0.5)',
    },
    { // Hạng I (Gold, Center) - idx 1
      rankText: 'Hạng I',
      medalNumber: '1',
      laurelColor: 'url(#gold-laurel-grad)',
      metalBg: 'linear-gradient(135deg, #FFF5C0 0%, #F59E0B 45%, #B45309 100%)',
      metalBorder: '3px solid #FDE68A',
      metalColor: '#78350F',
      ribbonBg: 'linear-gradient(180deg, #DC2626 0%, #991B1B 100%)',
      cardBg: 'linear-gradient(180deg, #FFFDF8 0%, #FFF9EC 50%, #FEF3DB 100%)',
      cardBorder: 'linear-gradient(135deg, #FFF5A5 0%, #FFC107 30%, #D97706 65%, #FFF5A5 100%)',
      outerBorderColor: 'rgba(217, 119, 6, 0.95)',
      shadow: '0 26px 52px -8px rgba(217, 119, 6, 0.45), 0 0 22px rgba(255, 193, 7, 0.65), 0 0 0 1.5px rgba(254, 240, 138, 0.85)',
      monogramColor: '#991B1B',
      innerLineColor: 'rgba(245, 158, 11, 0.45)',
    },
    { // Hạng III (Bronze, Right) - idx 2
      rankText: 'Hạng III',
      medalNumber: '3',
      laurelColor: 'url(#bronze-laurel-grad)',
      metalBg: 'linear-gradient(135deg, #FFEBDD 0%, #EA580C 45%, #7C2D12 100%)',
      metalBorder: '2.5px solid #FFEDD5',
      metalColor: '#7C2D12',
      ribbonBg: 'linear-gradient(180deg, #9A3412 0%, #431407 100%)',
      cardBg: 'linear-gradient(180deg, #FFFDFB 0%, #FFF2EC 100%)',
      cardBorder: 'linear-gradient(135deg, #FFEBDD 0%, #F97316 30%, #C2410C 65%, #FFEBDD 100%)',
      outerBorderColor: 'rgba(234, 88, 12, 0.9)',
      shadow: '0 20px 42px -8px rgba(194, 65, 12, 0.35), 0 0 16px rgba(251, 146, 60, 0.6), 0 0 0 1.5px rgba(254, 215, 170, 0.85)',
      monogramColor: '#7C2D12',
      innerLineColor: 'rgba(234, 88, 12, 0.4)',
    },
  ]), [])

  const award = awardThemes[idx]

  const animateTilt = useCallback(function animateTiltFrame() {
    currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * 0.12
    currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * 0.12
    const { x, y } = currentTilt.current
    if (cardEl.current) {
      const scale = window.innerWidth < 768 ? 1 : 1.025
      cardEl.current.style.transform = `perspective(900px) rotateX(${x}deg) rotateY(${y}deg) scale3d(${scale},${scale},${scale})`
    }
    if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01) rafTilt.current = requestAnimationFrame(animateTiltFrame)
    else rafTilt.current = null
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!allowInteractiveEffects.current) return
    const el = cardEl.current; if (!el) return
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    targetTilt.current = { x: -ny * 10, y: nx * 10 }
    if (!rafTilt.current) rafTilt.current = requestAnimationFrame(animateTilt)
  }, [animateTilt])

  const onMouseLeave = useCallback(() => {
    targetTilt.current = { x: 0, y: 0 }
    if (!rafTilt.current) rafTilt.current = requestAnimationFrame(animateTilt)
    if (cardEl.current) cardEl.current.style.transition = 'transform 0.6s cubic-bezier(0.34,1.2,0.64,1)'
    setTimeout(() => { if (cardEl.current) cardEl.current.style.transition = '' }, 600)
  }, [animateTilt])

  useEffect(() => () => { if (rafTilt.current) cancelAnimationFrame(rafTilt.current) }, [])

  return (
    <div
      className={cn('podium-card-wrap leaderboard-card-wrap relative flex-shrink cursor-pointer flex flex-col items-center', `card-podium-${idx === 1 ? 1 : idx === 0 ? 2 : 3}`, animCls, isFirst ? 'z-10' : 'z-0')}
      style={{ perspective: '900px', transform: 'translateZ(0)' }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* Medal Header Section */}
      <div className="podium-medal-header relative w-full flex justify-center -mb-4 sm:-mb-5 z-20 pointer-events-none">
        <div className="honors-medal-cluster relative flex items-center justify-center">
          {/* SVG Laurel Leaf Wreath */}
          <MedalLaurelLeaves color={award.laurelColor} />

          {/* Folded Ribbon Tails */}
          <div className="honors-medal-ribbons absolute -bottom-5 sm:-bottom-6 flex items-center justify-center gap-1 z-0">
            <div
              className="honors-medal-ribbon-tail w-2.5 sm:w-3 h-5 sm:h-6 rounded-b-sm shadow-md"
              style={{
                background: award.ribbonBg,
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
                transform: 'rotate(10deg)',
              }}
            />
            <div
              className="honors-medal-ribbon-tail w-2.5 sm:w-3 h-5 sm:h-6 rounded-b-sm shadow-md"
              style={{
                background: award.ribbonBg,
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
                transform: 'rotate(-10deg)',
              }}
            />
          </div>

          {/* Circular Medal Emblem */}
          <div
            className="honors-medal-emblem relative z-10 w-11 h-11 sm:w-[3.25rem] sm:h-[3.25rem] rounded-full flex flex-col items-center justify-center shadow-lg"
            style={{
              background: award.metalBg,
              border: award.metalBorder,
              boxShadow: '0 8px 18px rgba(0,0,0,0.25), inset 0 1.5px 3px rgba(255,255,255,0.85)',
            }}
          >
            <Crown className="honors-medal-crown w-3 h-3 sm:w-4 sm:h-4 stroke-[2.4]" style={{ color: award.metalColor }} />
            <span
              className="honors-medal-number text-sm sm:text-base font-black leading-none -mt-0.5"
              style={{ color: award.metalColor, textShadow: '0 1px 2px rgba(255,255,255,0.6)' }}
            >
              {award.medalNumber}
            </span>
          </div>
        </div>
      </div>

      {/* Main Card Shell */}
      <div
        ref={cardEl}
        className="podium-card-shell relative w-full flex-1 rounded-[1.2rem] sm:rounded-[1.5rem] p-2.5 pt-5 sm:p-3 sm:pt-6 flex flex-col items-center overflow-hidden shadow-xl z-10"
        style={{
          backgroundColor: '#FFFFFF',
          boxShadow: award.shadow,
          border: isFirst ? '3.5px solid transparent' : '3px solid transparent',
          backgroundImage: `${award.cardBg}, ${award.cardBorder}`,
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          willChange: 'auto',
          isolation: 'isolate',
        }}
      >
        {/* Avatar / Monogram Display — large and dominant */}
        <div className="relative w-full flex-1 flex items-center justify-center min-h-0">
          {teacher.avatar_url ? (
            <div
              className={cn(
                "podium-avatar-frame relative rounded-full overflow-hidden border-2 border-white shadow-lg",
                isFirst ? "w-[5.5rem] h-[5.5rem] sm:w-28 sm:h-28" : "w-[4.5rem] h-[4.5rem] sm:w-[5.5rem] sm:h-[5.5rem]"
              )}
            >
              <img
                src={normalizeStorageUrl(teacher.avatar_url)}
                alt={teacher.full_name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <span
              className={cn(
                "podium-monogram font-black tracking-tighter text-center uppercase select-none leading-[0.85]",
                isFirst ? "text-6xl sm:text-7xl md:text-8xl" : "text-5xl sm:text-6xl md:text-7xl"
              )}
              style={{
                color: award.monogramColor,
                textShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              {teacherInitials}
            </span>
          )}
        </div>

        {/* CR45 Score Badge — fixed height */}
        <div className="cr45-score-wrap relative flex-shrink-0 flex flex-col items-center select-none my-0.5">
          <svg
            viewBox="0 0 240 104"
            className={cn(
              "cr45-score-svg h-auto overflow-visible pointer-events-none",
              isFirst ? "w-[148px] sm:w-[170px]" : "w-[124px] sm:w-[144px]"
            )}
            fill="none"
          >
            <defs>
              <linearGradient id={`gold-shield-grad-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFEAC4" />
                <stop offset="48%" stopColor="#F8B66D" />
                <stop offset="100%" stopColor="#DD8530" />
              </linearGradient>
              <linearGradient id={`tab-champagne-grad-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFEAC2" />
                <stop offset="52%" stopColor="#FFC27A" />
                <stop offset="100%" stopColor="#EE9E58" />
              </linearGradient>
              <linearGradient id={`inner-red-grad-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F51C3A" />
                <stop offset="42%" stopColor="#BF001F" />
                <stop offset="100%" stopColor="#760012" />
              </linearGradient>
              <linearGradient id={`cr45-top-gloss-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.36" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <radialGradient id={`cr45-bottom-glow-${idx}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF6C8" stopOpacity="0.95" />
                <stop offset="42%" stopColor="#FFC95D" stopOpacity="0.58" />
                <stop offset="100%" stopColor="#FFC95D" stopOpacity="0" />
              </radialGradient>
              <filter id={`cr45-soft-shadow-${idx}`} x="-16%" y="-18%" width="132%" height="142%">
                <feDropShadow dx="0" dy="6.5" stdDeviation="4.4" floodColor="#7A1509" floodOpacity="0.2" />
                <feDropShadow dx="0" dy="1" stdDeviation="0.9" floodColor="#FFFFFF" floodOpacity="0.5" />
              </filter>
              <filter id={`cr45-score-shadow-${idx}`} x="-18%" y="-34%" width="136%" height="168%">
                <feDropShadow dx="0" dy="2.4" stdDeviation="1.5" floodColor="#4B000A" floodOpacity="0.74" />
                <feDropShadow dx="0" dy="0" stdDeviation="0.7" floodColor="#FFFFFF" floodOpacity="0.5" />
              </filter>
            </defs>
            <ellipse cx="120" cy="97" rx="58" ry="7.5" fill={`url(#cr45-bottom-glow-${idx})`} />
            <g filter={`url(#cr45-soft-shadow-${idx})`}>
              <rect
                x="21"
                y="37"
                width="198"
                height="62"
                rx="31"
                fill={`url(#gold-shield-grad-${idx})`}
              />
              <rect x="34" y="42.5" width="172" height="53" rx="26.5"
                fill={`url(#inner-red-grad-${idx})`} stroke="#F3B461" strokeWidth="2"
              />
              <rect x="40" y="48.5" width="160" height="41" rx="20.5"
                fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1.1"
              />
              <path
                d="M 60 48 C 92 45 148 45 180 48"
                stroke={`url(#cr45-top-gloss-${idx})`}
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.58"
              />
              <rect x="78" y="13" width="84" height="32.5" rx="16.25"
                fill={`url(#tab-champagne-grad-${idx})`}
              />
              <path
                d="M 93 17 C 108 14 132 14 147 17"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.3"
              />
            </g>
            <text
              x="120" y="35.5" textAnchor="middle" fill="#641407"
              fontSize="20.5" fontWeight="1000" letterSpacing="0.75"
              fontFamily="system-ui, -apple-system, sans-serif"
              style={{ textShadow: '0 1px 0 rgba(255,255,255,0.42)' }}
            >
              {HONORS_SCORE_LABEL}
            </text>
            <text
              ref={scoreEl}
              x="120" y="70"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#FFFFFF"
              fontSize="31"
              fontWeight="1000"
              letterSpacing="-0.6"
              fontFamily="system-ui, -apple-system, sans-serif"
              filter={`url(#cr45-score-shadow-${idx})`}
            >
              0.00%
            </text>
          </svg>
        </div>

        {/* Teacher Name & Center — anchored to bottom */}
        <div className="podium-copy w-full text-center px-1 mt-auto flex-shrink-0 pb-1.5 sm:pb-2.5">
          <h4
            className="font-black text-red-700 leading-tight tracking-tight line-clamp-1"
            style={{ fontSize: nameFontSize }}
            title={teacher.full_name}
          >
            {teacher.full_name}
          </h4>
          <p
            className="mt-0.5 text-slate-600 font-bold leading-snug truncate"
            style={{ fontSize: centerFontSize }}
            title={teacher.center}
          >
            {teacher.center}
          </p>
        </div>
      </div>

      {/* 3D Metallic Cylindrical Podium Pedestal */}
      <Metallic3DPodiumBase rank={teacher.rank} />
    </div>
  )
})

// ─── Popup UI Shell ──────────────────────────────────────────────────────────

interface PopupUIProps {
  cardRef: React.RefObject<HTMLDivElement | null>
  showCard: boolean
  contentPhase: number
  podium: { teacher_code: string; full_name: string; center: string; total_score: number; avatar_url: string | null; rank: number }[]
  onClose: () => void
  activeConfetti: boolean
  performanceMode: boolean
}

type PopupPanel = 'honors' | 'feature'
const POPUP_PANELS: PopupPanel[] = ['honors', 'feature']

function MascotFeaturePanel({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="mascot-feature-panel mx-auto flex w-full max-w-[620px] flex-col justify-center py-1">
      <div
        className="relative overflow-hidden rounded-[1.25rem] border border-red-100 bg-white/95 p-3.5 text-slate-900 shadow-[0_20px_50px_rgba(127,29,29,0.2)] sm:p-5"
        style={{
          background: 'radial-gradient(circle at 12% 10%, rgba(254,226,226,0.98), transparent 34%), radial-gradient(circle at 88% 12%, rgba(220,252,231,0.92), transparent 30%), linear-gradient(135deg, #fffaf7 0%, #ffffff 46%, #fff1f2 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-8 -top-8 text-[6rem] font-black leading-none text-red-900/[0.04] sm:text-[7.5rem]">2026</div>
          <div className="absolute bottom-3 left-4 text-[3.5rem] leading-none text-yellow-500/10 sm:text-[4rem]">🏆</div>
          <div className="absolute inset-x-0 top-0 flex h-1">
            <span className="flex-1 bg-[#006847]" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-[#ce1126]" />
          </div>
        </div>

        <div className="relative z-10">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-red-700">
            <Sparkles className="h-3.5 w-3.5" />
            Tính năng mới
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_170px] md:items-center">
            <div>
              <h2 className="text-xl font-black leading-tight text-slate-950 sm:text-2xl">Thay đổi trang phục cho mascot bé Mai</h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600 sm:text-sm">
                Bé Mai đã có tủ đồ World Cup: chọn outfit theo đội tuyển yêu thích, xem animation ngay trong modal và lưu để mascot ngoài màn hình dùng bộ trang phục mới.
              </p>
            </div>

            <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-yellow-300/30 blur-xl" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-yellow-200 bg-white shadow-[0_14px_35px_rgba(251,191,36,0.2)]">
                <Trophy className="h-12 w-12 text-yellow-300 drop-shadow-[0_6px_18px_rgba(250,204,21,0.4)]" strokeWidth={2.2} />
                <span className="absolute -bottom-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow">WC 2026</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1.5 sm:hidden">
            {[
              { icon: Shirt, shortTitle: 'Chọn áo', title: 'Chọn áo đội tuyển', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
              { icon: Eye, shortTitle: 'Preview', title: 'Xem preview trước', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { icon: Save, shortTitle: 'Lưu ngay', title: 'Lưu và dùng ngay', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            ].map(({ icon: Icon, shortTitle, title, color, bg, border }) => (
              <div
                key={title}
                className={`flex min-w-0 items-center justify-center gap-1 rounded-full border ${border} ${bg} px-2 py-1.5 shadow-xs`}
                aria-label={title}
                title={title}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} strokeWidth={2.5} />
                <span className="min-w-0 truncate text-[10px] font-black leading-none text-slate-900">{shortTitle}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden gap-2.5 sm:grid sm:grid-cols-3">
            {[
              { icon: Shirt, title: 'Chọn áo đội tuyển', body: 'Bấm vào bé Mai ở góc phải để mở tủ đồ và chọn bộ theo quốc gia bạn thích.', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
              { icon: Eye, title: 'Xem preview trước', body: 'Animation chạy ngay trong modal để bạn biết bộ nào hợp nhất trước khi lưu.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { icon: Save, title: 'Lưu và dùng ngay', body: 'Sau khi lưu, mascot ngoài màn hình tự đổi sang outfit mới.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            ].map(({ icon: Icon, title, body, color, bg, border }) => (
              <div key={title} className={`rounded-xl border ${border} ${bg} p-2.5 shadow-xs`}>
                <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white ${color} shadow-xs`}>
                  <Icon className="h-4 w-4" strokeWidth={2.4} />
                </div>
                <p className="text-xs font-black text-slate-900">{title}</p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-600">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_25px_rgba(220,38,38,0.25)] transition hover:-translate-y-0.5 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Khám phá
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PopupUI({ cardRef, showCard, contentPhase, podium, onClose, activeConfetti, performanceMode }: PopupUIProps) {
  const [activePanel, setActivePanel] = useState<PopupPanel>('honors')
  const [panelDirection, setPanelDirection] = useState<'next' | 'prev'>('next')
  const [showConfettiBurst, setShowConfettiBurst] = useState(false)

  useEffect(() => {
    if (!showCard || contentPhase < 3) {
      setPanelDirection('prev')
      setActivePanel('honors')
    }
  }, [showCard, contentPhase])

  useEffect(() => {
    if (!activeConfetti || activePanel !== 'honors' || performanceMode) {
      setShowConfettiBurst(false)
      return
    }
    setShowConfettiBurst(true)
    const timer = window.setTimeout(() => setShowConfettiBurst(false), CONFETTI_BURST_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [activeConfetti, activePanel, performanceMode])

  const handleExploreMascotOutfits = useCallback(() => {
    onClose()
    window.setTimeout(() => {
      window.dispatchEvent(new Event('start-mascot-outfit-tour'))
    }, performanceMode ? 0 : 260)
  }, [onClose, performanceMode])

  const switchPanel = useCallback((panel: PopupPanel) => {
    if (activePanel === panel) return
    setPanelDirection(POPUP_PANELS.indexOf(panel) > POPUP_PANELS.indexOf(activePanel) ? 'next' : 'prev')
    setActivePanel(panel)
  }, [activePanel])

  const togglePanel = useCallback(() => {
    switchPanel(activePanel === 'honors' ? 'feature' : 'honors')
  }, [activePanel, switchPanel])

  return (
    <div className="honors-popup-viewport fixed inset-0 z-modal-custom flex items-center justify-center p-2 sm:p-4 pointer-events-none select-none">
      <style>{`
        @keyframes honors-confetti-fall {
          0% {
            opacity: 0;
            transform: translate3d(0, -12vh, 0) rotate(0deg);
          }
          8% { opacity: 0.95; }
          82% { opacity: 0.9; }
          100% {
            opacity: 0;
            transform: translate3d(var(--confetti-drift), 112vh, 0) rotate(var(--confetti-rotation));
          }
        }
        @keyframes card-slide-left { from { opacity:0; transform:translate3d(-16px,10px,0) scale(0.96); } to { opacity:1; transform:translate3d(0,0,0) scale(1); } }
        @keyframes card-slide-center { from { opacity:0; transform:translateY(16px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes card-slide-right { from { opacity:0; transform:translate3d(16px,10px,0) scale(0.96); } to { opacity:1; transform:translate3d(0,0,0) scale(1); } }
        @keyframes title-reveal { from { opacity:0; transform:translateY(12px); filter:blur(3px); } to { opacity:1; transform:translateY(0); filter:blur(0); } }
        @keyframes gold-dot-float { 0%,100% { transform: translate3d(0,0,0) rotate(32deg); opacity: 0.42; } 50% { transform: translate3d(0,-6px,0) rotate(48deg); opacity: 0.76; } }

        .anim-slide-left { animation: card-slide-left 0.55s cubic-bezier(0.34,1.25,0.64,1) 0.35s both; }
        .anim-slide-center { animation: card-slide-center 0.65s cubic-bezier(0.34,1.35,0.64,1) 0.25s both; }
        .anim-slide-right { animation: card-slide-right 0.55s cubic-bezier(0.34,1.25,0.64,1) 0.35s both; }
        .anim-title-reveal { animation: title-reveal 0.5s cubic-bezier(0.34,1.2,0.64,1) 0.1s both; }

        .honors-confetti { contain: strict; transform: translateZ(0); }
        .honors-confetti-piece {
          position: absolute; top: 0; left: var(--confetti-left);
          width: var(--confetti-size); height: var(--confetti-height);
          border-radius: 1px; background: var(--confetti-color);
          box-shadow: 0 0 4px color-mix(in srgb, var(--confetti-color) 65%, transparent);
          opacity: 0; animation: honors-confetti-fall var(--confetti-duration) linear var(--confetti-delay) infinite;
        }

        .honors-popup-card {
          width: min(var(--honors-popup-width, 1080px), calc(var(--honors-viewport-width, 100vw) - 1.5rem));
          height: min(var(--honors-popup-height, 710px), calc(var(--honors-viewport-height, 100vh) - 1.5rem));
          max-height: calc(var(--honors-viewport-height, 100vh) - 1.5rem);
          contain: layout paint style;
          --honors-medal-scale-local: var(--honors-medal-scale, 1);
          --honors-score-scale-local: var(--honors-score-scale, 1);
        }

        .honors-popup-viewport {
          padding: clamp(0.5rem, 1.8vh, 1rem);
        }

        .honors-stage-depth {
          background:
            radial-gradient(circle at 50% 32%, rgba(255, 235, 175, 0.3), transparent 45%),
            radial-gradient(circle at 10% 15%, rgba(255, 255, 255, 0.9), transparent 25%),
            radial-gradient(circle at 90% 15%, rgba(255, 255, 255, 0.9), transparent 25%),
            linear-gradient(180deg, #FFFDF8 0%, #FFF8EF 50%, #F5EBDC 100%) !important;
        }

        .honors-red-wave {
          position: absolute; pointer-events: none; opacity: 0.98;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.18), transparent 60%),
            linear-gradient(135deg, #7b0715 0%, #b70b20 48%, #e51a2e 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -8px 14px rgba(69,10,10,0.22);
        }
        .honors-red-wave.is-top {
          left: -12%; top: -11.5rem; height: 17.5rem; width: 60%;
          border-radius: 0 0 100% 0 / 0 0 80% 0; transform: rotate(-8deg);
        }
        .honors-red-wave.is-top::after {
          content: ""; position: absolute; right: -1rem; bottom: 1.5rem;
          width: 92%; height: 0.16rem; border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(255,215,112,0.85), transparent);
        }

        .honors-bottom-wave-art {
          position: absolute;
          left: -7%;
          right: -7%;
          bottom: -1.65rem;
          z-index: 1;
          width: 114%;
          height: clamp(13.5rem, 27vh, 16.5rem);
          overflow: visible;
          filter: drop-shadow(0 -1px 0 rgba(255, 239, 184, 0.26));
        }

        .honors-gold-dot {
          position: absolute; width: 0.38rem; height: 0.38rem;
          border-radius: 0.1rem; background: linear-gradient(135deg, #fff1a8, #f0b429);
          opacity: 0.66; box-shadow: 0 0 14px rgba(250,204,21,0.36);
          transform: rotate(32deg); animation: gold-dot-float 6.5s ease-in-out infinite;
        }

        .leaderboard-eyebrow {
          background: linear-gradient(180deg, #991B1B 0%, #7F1D1D 100%);
          border: 1.8px solid #E5AC38;
          color: white;
          box-shadow: 0 6px 16px rgba(127,29,29,0.25), inset 0 1px 0 rgba(255,255,255,0.35);
        }

        .honors-title h1 {
          font-size: clamp(1.85rem, 3.2vw, 3rem);
          color: transparent;
          background: linear-gradient(180deg, #B91C1C 0%, #8A1020 50%, #5D0C12 100%);
          -webkit-background-clip: text; background-clip: text;
          letter-spacing: -0.01em; text-shadow: 0 10px 20px rgba(127,29,29,0.12);
        }

        .honors-stage { height: 100%; min-height: 0; padding-bottom: clamp(1.5rem, 3.2vh, 2.6rem); }
        .honors-content-panel { bottom: 0; }
        .honors-panel { display: flex; min-height: 0; flex-direction: column; }
        .honors-title { flex-shrink: 0; }
        .honors-podium {
          align-items: flex-start;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          min-height: 0;
          padding-top: var(--honors-podium-top-pad, 1.25rem);
        }
        .honors-footer-ribbon {
          min-height: clamp(5rem, 10vh, 6.35rem);
          padding-bottom: clamp(0.9rem, 2.1vh, 1.5rem);
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .honors-feature-panel {
          inset: 0 !important;
          display: grid;
          place-items: center;
          padding: clamp(2rem, 5vh, 3.25rem) clamp(2.25rem, 5vw, 4rem) clamp(3rem, 6vh, 4rem);
        }
        .honors-feature-panel .mascot-feature-panel {
          margin: auto;
        }
        .honors-swap-panel {
          opacity: 0; pointer-events: none;
          transition: opacity 500ms cubic-bezier(0.22, 1, 0.36, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .honors-swap-panel.is-active { opacity: 1; pointer-events: auto; }
        .honors-swap-panel.is-inactive { visibility: hidden; content-visibility: hidden; }

        .honors-podium-track {
          width: 100%;
          max-width: 910px;
          min-width: 0;
          gap: clamp(1rem, 2vw, 1.55rem) !important;
        }
        .podium-card-wrap {
          min-width: 0;
          --honors-medal-width: 7.2rem;
          --honors-medal-height: 4.45rem;
          --honors-laurel-width: 7.2rem;
          --honors-laurel-height: 4rem;
          --honors-medal-emblem-size: 3rem;
          --honors-medal-crown-size: 0.95rem;
          --honors-medal-number-size: 0.98rem;
          --honors-ribbon-width: 0.7rem;
          --honors-ribbon-height: 1.42rem;
          --honors-ribbon-bottom: -1.38rem;
          --honors-score-base-width: 9.25rem;
        }
        .card-podium-1 {
          --honors-medal-width: 7.75rem;
          --honors-medal-height: 4.8rem;
          --honors-laurel-width: 7.75rem;
          --honors-laurel-height: 4.25rem;
          --honors-medal-emblem-size: 3.35rem;
          --honors-medal-crown-size: 1.05rem;
          --honors-medal-number-size: 1.08rem;
          --honors-ribbon-width: 0.76rem;
          --honors-ribbon-height: 1.55rem;
          --honors-ribbon-bottom: -1.52rem;
          --honors-score-base-width: 10.75rem;
        }
        .podium-medal-header {
          margin-bottom: -1.25rem;
        }
        .honors-medal-cluster {
          width: var(--honors-medal-width);
          height: var(--honors-medal-height);
          transform: translateZ(0) scale(var(--honors-medal-scale-local));
          transform-origin: bottom center;
        }
        .medal-laurel-leaves {
          top: -0.36rem !important;
          width: var(--honors-laurel-width) !important;
          height: var(--honors-laurel-height) !important;
        }
        .honors-medal-ribbons {
          bottom: var(--honors-ribbon-bottom) !important;
          gap: 0.25rem !important;
        }
        .honors-medal-ribbon-tail {
          width: var(--honors-ribbon-width) !important;
          height: var(--honors-ribbon-height) !important;
        }
        .honors-medal-emblem {
          width: var(--honors-medal-emblem-size) !important;
          height: var(--honors-medal-emblem-size) !important;
          border-width: 2.6px !important;
        }
        .honors-medal-crown {
          width: var(--honors-medal-crown-size) !important;
          height: var(--honors-medal-crown-size) !important;
        }
        .honors-medal-number {
          font-size: var(--honors-medal-number-size) !important;
        }
        .podium-card-shell {
          min-width: 0;
        }
        .cr45-score-wrap {
          width: min(100%, var(--honors-score-base-width));
          transform: translateZ(0) scale(var(--honors-score-scale-local));
          transform-origin: top center;
        }
        .cr45-score-svg {
          width: min(100%, 100%) !important;
          max-width: 100%;
        }
        .podium-copy {
          min-width: 0;
        }
        .card-podium-1 { width: clamp(220px, 22vw, 268px); height: clamp(360px, 49vh, 426px); z-index: 20; transform: scale(1.055); filter: drop-shadow(0 8px 24px rgba(0,0,0,0.18)); }
        .card-podium-2 { width: clamp(190px, 19vw, 232px); height: clamp(318px, 43vh, 376px); z-index: 5; }
        .card-podium-3 { width: clamp(190px, 19vw, 232px); height: clamp(306px, 41vh, 366px); z-index: 5; }

        @media (min-width: 1200px) and (min-height: 780px) {
          .honors-podium-track {
            max-width: 955px;
            gap: clamp(1.35rem, 2.2vw, 1.9rem) !important;
          }
          .card-podium-1 {
            width: clamp(250px, 17vw, 292px);
            height: clamp(390px, 47vh, 442px);
            transform: scale(1.045);
          }
          .card-podium-2 {
            width: clamp(218px, 14.5vw, 252px);
            height: clamp(342px, 40vh, 392px);
          }
          .card-podium-3 {
            width: clamp(218px, 14.5vw, 252px);
            height: clamp(332px, 39vh, 382px);
          }
        }

        @media (max-width: 899px) {
          .honors-popup-card {
            width: min(var(--honors-popup-width, 760px), calc(var(--honors-viewport-width, 100vw) - 1.25rem));
            height: min(var(--honors-popup-height, 680px), calc(var(--honors-viewport-height, 100vh) - 1.25rem));
          }
          .honors-title h1 {
            font-size: clamp(1.65rem, 5vw, 2.15rem);
          }
          .card-podium-1 { width: clamp(190px, 28vw, 220px); height: clamp(310px, 47vh, 380px); }
          .card-podium-2 { width: clamp(165px, 24vw, 195px); height: clamp(280px, 40vh, 340px); }
          .card-podium-3 { width: clamp(165px, 24vw, 195px); height: clamp(270px, 39vh, 330px); }
        }

        @media (min-width: 900px) and (max-height: 760px) {
          .honors-popup-card {
            width: min(var(--honors-popup-width, 1040px), calc(var(--honors-viewport-width, 100vw) - 0.75rem));
            height: min(var(--honors-popup-height, 660px), calc(var(--honors-viewport-height, 100vh) - 0.75rem));
            max-height: calc(var(--honors-viewport-height, 100vh) - 0.75rem);
            border-radius: 1.35rem;
          }
          .honors-stage {
            padding: 0.8rem 3rem 0;
            padding-bottom: clamp(1.8rem, 3.2vh, 2.4rem);
          }
          .honors-title h1 {
            margin-top: 0.35rem;
            margin-bottom: 0.1rem;
            font-size: clamp(1.55rem, 4.1vh, 2.2rem);
          }
          .honors-subtitle {
            font-size: 0.62rem;
          }
          .honors-podium-track {
            max-width: 840px;
            gap: clamp(0.7rem, 1.6vw, 1rem);
          }
          .card-podium-1 { width: clamp(198px, 20vw, 238px); height: clamp(278px, 46vh, 344px); transform: scale(1.025); }
          .card-podium-2 { width: clamp(172px, 18vw, 208px); height: clamp(242px, 40vh, 306px); }
          .card-podium-3 { width: clamp(172px, 18vw, 208px); height: clamp(234px, 39vh, 296px); }
          .honors-footer-ribbon {
            min-height: clamp(4rem, 8.8vh, 5.2rem);
            padding-bottom: clamp(0.65rem, 1.6vh, 1rem);
          }
          .honors-bottom-wave-art {
            height: clamp(9.5rem, 22vh, 13rem);
          }
        }

        @media (max-width: 639px) {
          .honors-popup-card {
            width: calc(100vw - 0.75rem - env(safe-area-inset-left) - env(safe-area-inset-right));
            height: min(92vh, calc(var(--honors-viewport-height, 100vh) - 0.75rem));
            max-height: calc(var(--honors-viewport-height, 100vh) - 0.75rem);
            border-radius: 1rem;
          }
          .honors-red-wave.is-top {
            top: -7.2rem;
            height: 12rem;
            width: 72%;
          }
          .honors-title {
            padding: 1rem 2.35rem 0 2.35rem;
          }
          .honors-eyebrow {
            max-width: calc(100% - 3rem);
          }
          .honors-title h1 {
            margin-top: 0.75rem;
            font-size: clamp(1.7rem, 8vw, 2rem);
            line-height: 0.98;
          }
          .honors-subtitle {
            max-width: 18.5rem;
            line-height: 1.35;
          }
          .honors-stage {
            padding: 0.65rem 0.85rem 0;
          }
          .honors-panel {
            gap: 0.25rem;
          }
          .honors-feature-panel {
            padding: 3rem 1rem 3.25rem;
          }
          .honors-bottom-wave-art {
            bottom: -1.1rem;
            height: 10.8rem;
            left: -20%;
            width: 132%;
          }
          .honors-footer-ribbon { min-height: 4.95rem; padding-bottom: 1rem; }
          .honors-podium {
            align-items: center;
            margin-top: 0.15rem;
            margin-bottom: 0;
          }
          .honors-podium-track {
            flex-wrap: wrap;
            align-content: center;
            align-items: flex-end;
            column-gap: 0.7rem;
            row-gap: 0.35rem;
            max-width: 24rem;
          }
          .podium-card-wrap {
            --honors-medal-width: 4.8rem;
            --honors-medal-height: 3rem;
            --honors-laurel-width: 4.8rem;
            --honors-laurel-height: 2.6rem;
            --honors-medal-emblem-size: 2.2rem;
            --honors-medal-crown-size: 0.68rem;
            --honors-medal-number-size: 0.72rem;
            --honors-ribbon-width: 0.48rem;
            --honors-ribbon-height: 0.98rem;
            --honors-ribbon-bottom: -0.92rem;
            --honors-score-base-width: 7.2rem;
          }
          .card-podium-1 {
            order: 1;
            width: min(58%, 13.5rem);
            height: clamp(220px, 37vh, 285px);
            z-index: 20;
            transform: scale(1);
            filter: drop-shadow(0 6px 18px rgba(0,0,0,0.16));
            --honors-medal-width: 5.35rem;
            --honors-medal-height: 3.35rem;
            --honors-laurel-width: 5.35rem;
            --honors-laurel-height: 2.9rem;
            --honors-medal-emblem-size: 2.52rem;
            --honors-medal-crown-size: 0.78rem;
            --honors-medal-number-size: 0.82rem;
            --honors-ribbon-width: 0.54rem;
            --honors-ribbon-height: 1.1rem;
            --honors-ribbon-bottom: -1.02rem;
            --honors-score-base-width: 8.2rem;
          }
          .card-podium-2 {
            order: 2;
            width: min(45%, 10.8rem);
            height: clamp(188px, 31vh, 242px);
            z-index: 5;
          }
          .card-podium-3 {
            order: 3;
            width: min(46%, 10.5rem);
            height: clamp(165px, 27vh, 212px);
            z-index: 5;
          }
          .podium-card-shell {
            border-radius: 1rem !important;
            padding: 0.4rem 0.35rem 0.35rem !important;
            padding-top: 1.25rem !important;
          }
          .podium-avatar-frame {
            width: clamp(2.8rem, 13vw, 3.8rem) !important;
            height: clamp(2.8rem, 13vw, 3.8rem) !important;
          }
          .card-podium-1 .podium-avatar-frame {
            width: clamp(3.5rem, 15vw, 4.6rem) !important;
            height: clamp(3.5rem, 15vw, 4.6rem) !important;
          }
          .podium-monogram {
            font-size: clamp(1.8rem, 10vw, 2.8rem) !important;
          }
          .card-podium-1 .podium-monogram {
            font-size: clamp(2.2rem, 12vw, 3.4rem) !important;
          }
          .podium-copy h4 {
            font-size: clamp(11px, 3.4vw, 14px) !important;
            line-height: 1.15 !important;
            -webkit-line-clamp: 2 !important;
            line-clamp: 2 !important;
          }
          .podium-copy p {
            font-size: clamp(8.5px, 2.6vw, 11px) !important;
          }
          .podium-copy {
            padding-bottom: 0.25rem !important;
          }
          .honors-footer-ribbon {
            min-height: 3.6rem;
            padding-bottom: 0.65rem;
          }
          .honors-panel-navigation {
            display: none !important;
          }
        }

        @media (max-width: 380px) {
          .honors-popup-card {
            width: calc(100vw - 0.4rem);
            height: min(95vh, calc(var(--honors-viewport-height, 100vh) - 0.4rem));
          }
          .honors-stage {
            padding-left: 0.35rem;
            padding-right: 0.35rem;
          }
          .podium-card-wrap {
            --honors-medal-width: 4.35rem;
            --honors-medal-height: 2.72rem;
            --honors-laurel-width: 4.35rem;
            --honors-laurel-height: 2.36rem;
            --honors-medal-emblem-size: 2rem;
            --honors-score-base-width: 6.5rem;
          }
          .card-podium-1 {
            width: min(60%, 12.5rem);
            height: clamp(195px, 33vh, 245px);
            --honors-medal-width: 4.85rem;
            --honors-medal-height: 3.02rem;
            --honors-laurel-width: 4.85rem;
            --honors-laurel-height: 2.62rem;
            --honors-medal-emblem-size: 2.25rem;
            --honors-score-base-width: 7.5rem;
          }
          .card-podium-2,
          .card-podium-3 { width: min(46%, 9.8rem); height: clamp(160px, 26vh, 205px); }
          .honors-footer-ribbon { min-height: 3.2rem; padding-bottom: 0.5rem; }
        }

        @media (max-height: 640px) {
          .honors-popup-card {
            height: min(var(--honors-popup-height, 620px), calc(var(--honors-viewport-height, 100vh) - 0.5rem));
          }
          .honors-title {
            padding-top: 0.75rem;
          }
          .honors-title h1 {
            margin-top: 0.15rem;
            margin-bottom: 0;
            font-size: clamp(1.1rem, 4.5vw, 1.45rem);
          }
          .honors-footer-ribbon {
            min-height: 3.2rem;
            padding-bottom: 0.5rem;
          }
          .honors-footer-ribbon svg {
            height: 1.6rem;
            width: 5rem;
          }
          .card-podium-1 { height: clamp(185px, 32vh, 235px); }
          .card-podium-2 { height: clamp(155px, 26vh, 195px); }
          .card-podium-3 { height: clamp(150px, 25vh, 190px); }
        }

        @media (min-width: 900px) and (max-height: 640px) {
          .honors-popup-viewport {
            padding: 0.35rem 0.75rem;
          }
          .honors-popup-card {
            width: min(var(--honors-popup-width, 980px), calc(var(--honors-viewport-width, 100vw) - 0.75rem));
          }
          .honors-stage {
            padding: 0.45rem 3.5rem 0;
          }
          .honors-title h1 {
            font-size: clamp(1.2rem, 4vh, 1.65rem);
          }
          .honors-eyebrow {
            transform: scale(0.94);
            transform-origin: top center;
          }
          .honors-podium-track {
            max-width: 790px;
            gap: clamp(0.55rem, 1.3vw, 0.9rem) !important;
          }
          .card-podium-1 { width: clamp(174px, 19vw, 208px); height: clamp(208px, 40vh, 258px); transform: scale(1.01); }
          .card-podium-2 { width: clamp(152px, 17vw, 182px); height: clamp(178px, 34vh, 224px); }
          .card-podium-3 { width: clamp(152px, 17vw, 182px); height: clamp(172px, 33vh, 218px); }
          .podium-card-wrap {
            --honors-medal-width: 5.3rem;
            --honors-medal-height: 3.3rem;
            --honors-laurel-width: 5.3rem;
            --honors-laurel-height: 2.9rem;
            --honors-medal-emblem-size: 2.38rem;
            --honors-medal-crown-size: 0.74rem;
            --honors-medal-number-size: 0.78rem;
            --honors-ribbon-width: 0.52rem;
            --honors-ribbon-height: 1.08rem;
            --honors-ribbon-bottom: -1rem;
            --honors-score-base-width: 7.4rem;
          }
          .card-podium-1 {
            --honors-medal-width: 5.95rem;
            --honors-medal-height: 3.7rem;
            --honors-laurel-width: 5.95rem;
            --honors-laurel-height: 3.24rem;
            --honors-medal-emblem-size: 2.74rem;
            --honors-medal-crown-size: 0.85rem;
            --honors-medal-number-size: 0.9rem;
            --honors-ribbon-width: 0.58rem;
            --honors-ribbon-height: 1.2rem;
            --honors-ribbon-bottom: -1.12rem;
            --honors-score-base-width: 8.4rem;
          }
          .podium-base {
            transform: scaleY(0.78);
            transform-origin: top center;
          }
          .podium-copy h4 {
            font-size: clamp(10px, 1.5vw, 13px) !important;
            line-height: 1.08 !important;
          }
          .podium-copy p {
            font-size: clamp(8px, 1.1vw, 10px) !important;
          }
          .card-podium-1 { height: clamp(185px, 32dvh, 235px); }
          .card-podium-2 { height: clamp(155px, 26dvh, 195px); }
          .card-podium-3 { height: clamp(150px, 25dvh, 190px); }
        }

        @media (min-width: 900px) and (max-height: 580px) {
          .honors-popup-card {
            width: min(var(--honors-popup-width, 940px), calc(var(--honors-viewport-width, 100vw) - 0.75rem));
          }
          .honors-stage {
            padding: 0.25rem 3.25rem 0;
          }
          .honors-title h1 {
            margin-top: 0.12rem;
            font-size: clamp(1rem, 3.8vh, 1.35rem);
          }
          .honors-subtitle {
            font-size: 0.5rem;
            line-height: 1;
            letter-spacing: 0.05em;
          }
          .honors-eyebrow {
            transform: scale(0.88);
          }
          .card-podium-1 { width: clamp(150px, 18vw, 178px); height: clamp(172px, 38vh, 214px); }
          .card-podium-2 { width: clamp(132px, 16vw, 158px); height: clamp(150px, 32vh, 188px); }
          .card-podium-3 { width: clamp(132px, 16vw, 158px); height: clamp(146px, 31vh, 182px); }
          .podium-card-shell {
            border-radius: 0.9rem !important;
            padding: 0.4rem 0.35rem 0.3rem !important;
            padding-top: 1rem !important;
          }
          .podium-base {
            display: none;
          }
          .honors-footer-ribbon {
            min-height: 2.55rem;
            padding-bottom: 0.25rem;
          }
          .honors-footer-ribbon svg {
            display: none;
          }
          .honors-bottom-wave-art {
            height: 6.9rem;
          }
        }

        @media (orientation: landscape) and (max-height: 520px) {
          .honors-popup-card {
            width: min(var(--honors-popup-width, 960px), calc(var(--honors-viewport-width, 100vw) - 0.5rem));
            height: calc(var(--honors-viewport-height, 100vh) - 0.5rem);
          }
          .honors-stage {
            padding: 0.35rem 2.2rem 0;
          }
          .honors-title {
            padding-top: 0;
          }
          .honors-title h1 {
            font-size: clamp(1rem, 4.2vh, 1.35rem);
          }
          .honors-subtitle {
            font-size: 0.58rem;
          }
          .honors-eyebrow {
            padding-top: 0.18rem;
            padding-bottom: 0.18rem;
          }
          .honors-podium-track {
            flex-wrap: nowrap;
            max-width: 760px;
            gap: clamp(0.45rem, 1.1vw, 0.75rem) !important;
          }
          .card-podium-1 { order: 0; width: clamp(150px, 22vw, 178px); height: clamp(170px, 47vh, 205px); transform: scale(1.01); }
          .card-podium-2 { order: 0; width: clamp(130px, 19vw, 158px); height: clamp(145px, 39vh, 174px); }
          .card-podium-3 { order: 0; width: clamp(130px, 19vw, 158px); height: clamp(140px, 38vh, 170px); }
          .podium-card-wrap {
            --honors-medal-width: 3.65rem;
            --honors-medal-height: 2.26rem;
            --honors-laurel-width: 3.65rem;
            --honors-laurel-height: 2.05rem;
            --honors-medal-emblem-size: 1.72rem;
            --honors-medal-crown-size: 0.52rem;
            --honors-medal-number-size: 0.56rem;
            --honors-ribbon-width: 0.38rem;
            --honors-ribbon-height: 0.78rem;
            --honors-ribbon-bottom: -0.72rem;
            --honors-score-base-width: 5.9rem;
          }
          .card-podium-1 {
            --honors-medal-width: 4.1rem;
            --honors-medal-height: 2.55rem;
            --honors-laurel-width: 4.1rem;
            --honors-laurel-height: 2.28rem;
            --honors-medal-emblem-size: 1.95rem;
            --honors-medal-crown-size: 0.6rem;
            --honors-medal-number-size: 0.64rem;
            --honors-ribbon-width: 0.42rem;
            --honors-ribbon-height: 0.86rem;
            --honors-ribbon-bottom: -0.8rem;
            --honors-score-base-width: 6.8rem;
          }
          .podium-card-shell {
            border-radius: 0.85rem !important;
            padding: 0.35rem 0.3rem 0.3rem !important;
            padding-top: 0.95rem !important;
          }
          .podium-base {
            display: none;
          }
          .podium-medal-header {
            margin-bottom: -0.9rem !important;
          }
          .podium-monogram {
            font-size: clamp(1.45rem, 5vw, 2.25rem) !important;
          }
          .card-podium-1 .podium-monogram {
            font-size: clamp(1.8rem, 6vw, 2.8rem) !important;
          }
          .podium-copy h4 {
            font-size: clamp(9px, 2.2vw, 12px) !important;
            line-height: 1.05 !important;
          }
          .podium-copy p {
            display: none;
          }
          .podium-copy {
            padding-bottom: 0 !important;
          }
          .honors-footer-ribbon {
            min-height: 2.25rem;
            padding-bottom: 0.2rem;
          }
          .honors-bottom-wave-art {
            height: 6.4rem;
          }
          .honors-footer-ribbon svg {
            display: none;
          }
        }
      `}</style>

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={HONORS_DIALOG_TITLE_ID}
        aria-describedby={HONORS_DIALOG_DESCRIPTION_ID}
        tabIndex={-1}
        className={cn(
          'honors-popup-card is-premium-leaderboard relative pointer-events-auto overflow-hidden rounded-[1.2rem] sm:rounded-[1.8rem] transition-opacity duration-300',
          showCard ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        style={{
          background: 'linear-gradient(180deg, #FFFDF9 0%, #FFF8EF 100%)',
          boxShadow: '0 32px 90px -28px rgba(69,10,10,0.32), 0 0 0 1px rgba(127,29,29,0.12), inset 0 1px 0 rgba(255,255,255,0.82)',
          transform: 'translateZ(0)',
        }}
      >
        <ConfettiRain active={!performanceMode && showConfettiBurst && activePanel === 'honors'} />
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[1.2rem] sm:rounded-[1.8rem]">
          <div className="honors-stage-depth absolute inset-0" />
          <div className="honors-red-wave is-top" />
          <svg
            className="honors-bottom-wave-art"
            viewBox="0 0 1000 260"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="honors-bottom-wave-main" x1="0%" y1="0%" x2="100%" y2="85%">
                <stop offset="0%" stopColor="#8A0714" />
                <stop offset="42%" stopColor="#B50B1F" />
                <stop offset="100%" stopColor="#EC1B30" />
              </linearGradient>
              <linearGradient id="honors-bottom-wave-right" x1="12%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EF1B31" />
                <stop offset="52%" stopColor="#C80D25" />
                <stop offset="100%" stopColor="#8B0714" />
              </linearGradient>
              <linearGradient id="honors-bottom-wave-shadow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#64040E" stopOpacity="0.45" />
                <stop offset="52%" stopColor="#A00719" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.14" />
              </linearGradient>
              <linearGradient id="honors-bottom-wave-gold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFE78A" stopOpacity="0" />
                <stop offset="18%" stopColor="#FFD35A" stopOpacity="0.92" />
                <stop offset="66%" stopColor="#FFF3B8" stopOpacity="0.48" />
                <stop offset="100%" stopColor="#FFE78A" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="honors-bottom-wave-glow" cx="65%" cy="34%" r="32%">
                <stop offset="0%" stopColor="#FFE6A3" stopOpacity="0.45" />
                <stop offset="48%" stopColor="#FCA5A5" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path
              d="M0 190 C125 165 275 151 430 146 C590 141 660 122 735 101 C830 75 920 94 1000 116 L1000 260 L0 260 Z"
              fill="url(#honors-bottom-wave-main)"
            />
            <path
              d="M620 260 C712 206 778 157 832 98 C897 27 943 6 1000 0 L1000 260 Z"
              fill="url(#honors-bottom-wave-right)"
            />
            <path
              d="M0 220 C160 186 335 166 510 171 C660 175 800 158 1000 101 L1000 260 L0 260 Z"
              fill="url(#honors-bottom-wave-shadow)"
            />
            <path
              d="M30 184 C170 160 310 148 445 145 C596 142 666 122 738 102 C828 77 911 94 968 112"
              fill="none"
              stroke="url(#honors-bottom-wave-gold)"
              strokeWidth="3.2"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M662 222 C752 184 815 139 862 84 C916 21 958 7 1000 3"
              fill="none"
              stroke="#FB7185"
              strokeWidth="18"
              strokeLinecap="round"
              opacity="0.1"
            />
            <path
              d="M125 205 C300 164 475 153 642 171 C787 187 895 173 1000 135"
              fill="none"
              stroke="#F43F5E"
              strokeWidth="24"
              strokeLinecap="round"
              opacity="0.09"
            />
            <ellipse cx="650" cy="92" rx="230" ry="92" fill="url(#honors-bottom-wave-glow)" />
          </svg>
          <span className="honors-gold-dot" style={{ left: '8%', top: '20%' }} />
          <span className="honors-gold-dot" style={{ left: '18%', top: '72%', width: '0.2rem', height: '0.2rem', animationDelay: '1.4s' }} />
          <span className="honors-gold-dot" style={{ right: '13%', top: '26%', width: '0.24rem', height: '0.24rem', animationDelay: '0.8s' }} />
          <span className="honors-gold-dot" style={{ right: '9%', bottom: '18%', animationDelay: '2.1s' }} />
          <span className="honors-gold-dot" style={{ left: '14%', top: '43%', width: '0.4rem', height: '0.4rem', animationDelay: '1.9s' }} />
        </div>

        {/* Top Gold Shine Divider */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-30" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="honors-close-button absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 z-40 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center group transition-all duration-200 hover:scale-110"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,248,239,0.85))',
            border: '1px solid rgba(127, 29, 29, 0.2)',
            boxShadow: '0 8px 18px rgba(69,10,10,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
          aria-label="Đóng bảng vinh danh"
        >
          <X className="w-3.5 h-3.5 text-red-900/80 group-hover:text-red-950 group-hover:rotate-90 transition-all duration-300" />
        </button>

        {/* Panel Navigation Arrows */}
        <div className="honors-panel-navigation absolute inset-y-0 left-0 right-0 z-30 pointer-events-none flex items-center justify-between px-1.5 sm:px-3">
          <button
            type="button"
            onClick={togglePanel}
            className="honors-panel-arrow pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-red-900/15 bg-white/90 text-red-900 shadow-md transition hover:scale-110 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 sm:h-9 sm:w-9"
            aria-label="Quay lại popup trước"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.6} />
          </button>
          <button
            type="button"
            onClick={togglePanel}
            className="honors-panel-arrow pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-red-900/15 bg-white/90 text-red-900 shadow-md transition hover:scale-110 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 sm:h-9 sm:w-9"
            aria-label="Đi tới popup tiếp theo"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.6} />
          </button>
        </div>

        {/* Stage Content Area */}
        <div className={cn('honors-stage relative z-10 px-3 pt-3 sm:px-4 sm:pt-5 md:px-8', panelDirection === 'next' ? 'is-moving-next' : 'is-moving-prev')}>
          {/* Main Honors Panel */}
          <div className={cn('honors-panel honors-content-panel honors-swap-panel absolute inset-x-3 top-3 sm:inset-x-4 sm:top-5 md:inset-x-8', activePanel === 'honors' ? 'is-active' : 'is-inactive')}>

            {/* Header Titles */}
            <div className={cn('honors-title text-center', contentPhase >= 1 ? 'anim-title-reveal' : 'opacity-0')}>
              {/* Eyebrow Badge */}
              <div className="honors-eyebrow leaderboard-eyebrow inline-flex max-w-[calc(100%-3rem)] items-center justify-center gap-1.5 overflow-hidden rounded-full px-3.5 py-1 sm:gap-2 sm:px-5 sm:py-1.5">
                <Star className="relative z-[1] h-3 w-3 flex-none fill-amber-300 text-amber-300" />
                <span className="relative z-[1] text-[8px] font-black uppercase leading-tight tracking-[0.12em] sm:text-[10px] sm:tracking-[0.18em] md:text-[11px]">
                  BẢNG VINH DANH GIẢNG VIÊN XUẤT SẮC
                </span>
                <Star className="relative z-[1] h-3 w-3 flex-none fill-amber-300 text-amber-300" />
              </div>

              {/* Main Headline */}
              <h1 id={HONORS_DIALOG_TITLE_ID} className="mx-auto mt-1.5 mb-1 max-w-[840px] font-black leading-[0.95]">
                VINH DANH NGÔI SAO ĐÀO TẠO
              </h1>

              {/* Subtitle with Gold Lines */}
              <div className="mx-auto flex max-w-[720px] items-center justify-center gap-2 sm:gap-3">
                <span className="hidden h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent sm:block" />
                <p id={HONORS_DIALOG_DESCRIPTION_ID} className="honors-subtitle font-extrabold text-slate-700 text-[10px] sm:text-[11px] tracking-[0.08em] sm:tracking-[0.14em]">
                  TẬN TÂM TRÊN TỪNG BÀI GIẢNG • TRUYỀN CẢM HƯNG MỖI NGÀY
                </p>
                <span className="hidden h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent sm:block" />
              </div>
            </div>

            {/* Podium Track with 3 Ranks */}
            <div className={cn('honors-podium relative w-full flex-1 flex items-center justify-center my-1 sm:my-2', contentPhase >= 2 ? '' : 'opacity-0')}>
              <div className="honors-podium-track relative flex items-end justify-center gap-2.5 sm:gap-4 md:gap-5 px-0 sm:px-2">
                {podium.map((teacher, idx) => {
                  const isFirst = idx === 1
                  const animCls = performanceMode ? '' : contentPhase >= 2 ? (isFirst ? 'anim-slide-center' : idx === 0 ? 'anim-slide-left' : 'anim-slide-right') : 'opacity-0'
                  return <PodiumCard key={teacher.teacher_code} teacher={teacher} idx={idx} animCls={animCls} triggerAnimate={contentPhase >= 2} performanceMode={performanceMode} />
                })}
              </div>
            </div>

            {/* Footer Banner */}
            <div className={cn('honors-footer-ribbon transition-all duration-700 mt-auto', contentPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2')}>
              <div className="flex flex-col items-center justify-center text-center">
                <svg
                  viewBox="0 0 140 62"
                  className="mb-0.5 h-8 w-24 overflow-visible sm:h-11 sm:w-32"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="honors-footer-gold" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFF3B8" />
                      <stop offset="48%" stopColor="#F5C654" />
                      <stop offset="100%" stopColor="#C98414" />
                    </linearGradient>
                  </defs>
                  <path d="M50 50 C35 42 28 30 29 17" stroke="url(#honors-footer-gold)" strokeWidth="3" strokeLinecap="round" fill="none" />
                  <path d="M90 50 C105 42 112 30 111 17" stroke="url(#honors-footer-gold)" strokeWidth="3" strokeLinecap="round" fill="none" />
                  {[
                    [33, 22, -28], [36, 30, -18], [42, 38, -8], [50, 45, 4],
                    [107, 22, 28], [104, 30, 18], [98, 38, 8], [90, 45, -4],
                  ].map(([cx, cy, rotate]) => (
                    <ellipse
                      key={`${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      rx="3.2"
                      ry="6.2"
                      fill="url(#honors-footer-gold)"
                      transform={`rotate(${rotate} ${cx} ${cy})`}
                    />
                  ))}
                  <g fill="url(#honors-footer-gold)" filter="drop-shadow(0 3px 8px rgba(250,204,21,0.38))">
                    <path d="M55 14 H85 V24 C85 35 79 42 70 42 C61 42 55 35 55 24 Z" />
                    <path d="M55 18 H46 C43 18 41 20 41 23 C41 29 46 33 56 34 V29 C49 28 46 26 46 23 C46 22 47 22 48 22 H55 Z" />
                    <path d="M85 18 H94 C97 18 99 20 99 23 C99 29 94 33 84 34 V29 C91 28 94 26 94 23 C94 22 93 22 92 22 H85 Z" />
                    <rect x="66" y="41" width="8" height="8" rx="2" />
                    <path d="M58 51 H82 C84 51 86 53 86 55 V56 H54 V55 C54 53 56 51 58 51 Z" />
                  </g>
                </svg>
                <div className="flex w-full max-w-[620px] items-center justify-center gap-2 px-3 sm:gap-3 sm:px-4">
                  <span className="relative h-px w-6 flex-none bg-gradient-to-r from-transparent via-amber-300 to-amber-300 sm:w-24">
                    <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(250,204,21,0.75)]" />
                  </span>
                  <span
                    className="min-w-0 whitespace-nowrap text-[7px] font-black uppercase tracking-[0.08em] text-[#FFF8D8] sm:text-[11px] sm:tracking-[0.22em]"
                    style={{
                      textShadow: '0 2px 8px rgba(0,0,0,0.78), 0 0 14px rgba(255,215,112,0.5)',
                    }}
                  >
                    TÔN VINH NHỮNG NGƯỜI ĐƯA ĐÒ THẦM LẶNG
                  </span>
                  <span className="relative h-px w-6 flex-none bg-gradient-to-l from-transparent via-amber-300 to-amber-300 sm:w-24">
                    <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(250,204,21,0.75)]" />
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Feature Panel */}
          <div className={cn('honors-content-panel honors-feature-panel honors-swap-panel absolute inset-x-3 top-3 sm:inset-x-4 sm:top-5 md:inset-x-8', activePanel === 'feature' ? 'is-active' : 'is-inactive')}>
            <MascotFeaturePanel onExplore={handleExploreMascotOutfits} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Exported Component ──────────────────────────────────────────────────

interface TeacherHonorsPopupProps { isOpen: boolean; onOpen?: () => void; onClose: () => void }

export function TeacherHonorsPopup({ isOpen, onOpen, onClose }: TeacherHonorsPopupProps) {
  const [mounted, setMounted] = useState(false)
  const [performanceMode, setPerformanceMode] = useState(false)
  const [renderCard, setRenderCard] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const [contentPhase, setContentPhase] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const animStateRef = useRef<'idle' | 'in' | 'out'>('idle')
  const onCloseRef = useRef(onClose)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const triggerOpenRef = useRef<(() => void) | null>(null)
  const triggerCloseRef = useRef<(() => void) | null>(null)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    setMounted(true)
    setPerformanceMode(shouldReduceVisualEffects())
  }, [])

  const shouldUseLightweightMotion = useCallback(() => shouldReduceVisualEffects(), [])

  const getTabRect = useCallback((): Rect | null => {
    const el = document.getElementById('tab-vinh-danh'); if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
  }, [])

  const getCardRect = useCallback((): Rect | null => {
    const el = cardRef.current; if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }, [])

  const resizeCanvas = useCallback(() => {
    const c = canvasRef.current; if (!c) return
    c.width = window.innerWidth; c.height = window.innerHeight
  }, [])

  const runOpen = useCallback((src: Rect, dst: Rect) => {
    const canvas = canvasRef.current; const overlay = overlayRef.current; if (!canvas) return
    resizeCanvas(); const ctx = canvas.getContext('2d')!
    const TOTAL = 620; const PHASE1_END = 0.44; let start = -1; let hasRevealedCard = false; particlesRef.current = []
    const tick = (now: number) => {
      if (start < 0) start = now; const raw = Math.min((now - start) / TOTAL, 1)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (overlay) overlay.style.opacity = String(E.outCubic(Math.min(raw * 2, 1)) * 0.72)
      if (raw <= PHASE1_END) {
        const p = raw / PHASE1_END; const topT = E.outExpo(Math.min(p * 1.55, 1)); const botT = E.outCubic(Math.min(p * 0.7, 1)); const shapeAlpha = Math.min(p * 3, 1)
        paintGenie(ctx, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h, topT, botT, shapeAlpha, false)
        if (p > 0.3 && p < 0.8 && particlesRef.current.length < 48 && Math.random() > 0.82) {
          particlesRef.current.push(...spawnParticles(dst.x + dst.w / 2, src.y + (dst.y - src.y) * topT * 0.5, 2))
        }
      }
      if (raw > PHASE1_END * 0.9 && !hasRevealedCard) {
        hasRevealedCard = true
        setShowCard(true)
        setContentPhase(3)
      }
      particlesRef.current = particlesRef.current.filter(p => p.opacity > 0.02)
      for (const pt of particlesRef.current) {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.opacity -= pt.decay
        ctx.globalAlpha = pt.opacity; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
      }
      if (raw < 1 || particlesRef.current.length > 0) rafRef.current = requestAnimationFrame(tick)
      else { canvas.style.opacity = '0'; animStateRef.current = 'idle' }
    }
    canvas.style.opacity = '1'; canvas.style.pointerEvents = 'none'; rafRef.current = requestAnimationFrame(tick)
  }, [resizeCanvas])

  const runClose = useCallback((src: Rect, dst: Rect) => {
    const canvas = canvasRef.current; const overlay = overlayRef.current; if (!canvas) return
    resizeCanvas(); const ctx = canvas.getContext('2d')!
    const TOTAL = 420; let start = -1; setShowCard(false); setContentPhase(0); canvas.style.opacity = '1'
    const tick = (now: number) => {
      if (start < 0) start = now; const raw = Math.min((now - start) / TOTAL, 1)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (overlay) overlay.style.opacity = String(Math.max(0, 0.72 * (1 - E.outCubic(raw))))
      const botT = 1 - E.outExpo(1 - raw); const topT = E.inOutCubic(raw * 0.82); const shapeAlpha = Math.max(0, 1 - raw * 1.3)
      paintGenie(ctx, src.x + src.w / 2, src.y + src.h / 2, src.w, src.h, dst.x, dst.y, dst.w, dst.h, topT, botT, shapeAlpha, true)
      if (raw < 1) rafRef.current = requestAnimationFrame(tick)
      else { canvas.style.opacity = '0'; animStateRef.current = 'idle'; setRenderCard(false); onCloseRef.current() }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [resizeCanvas])

  const triggerOpen = useCallback(() => {
    if (renderCard || animStateRef.current === 'in') return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (shouldUseLightweightMotion()) {
      animStateRef.current = 'idle'
      setRenderCard(true)
      setShowCard(true)
      setContentPhase(3)
      return
    }
    const tabRect = getTabRect()
    if (tabRect) {
      animStateRef.current = 'in'; setShowCard(false); setContentPhase(0); setRenderCard(true)
      requestAnimationFrame(() => { requestAnimationFrame(() => { const cardRect = getCardRect(); if (cardRect) runOpen(tabRect, cardRect) }) })
    } else {
      animStateRef.current = 'in'; setRenderCard(true); setTimeout(() => setShowCard(true), 10); setTimeout(() => setContentPhase(3), 440)
    }
  }, [getTabRect, getCardRect, renderCard, runOpen, shouldUseLightweightMotion])

  const triggerClose = useCallback(() => {
    if (animStateRef.current === 'out') return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (shouldUseLightweightMotion()) {
      animStateRef.current = 'idle'
      setShowCard(false)
      setContentPhase(0)
      setRenderCard(false)
      onCloseRef.current()
      return
    }
    const tabRect = getTabRect(); const cardRect = getCardRect()
    if (tabRect && cardRect) { animStateRef.current = 'out'; runClose({ x: cardRect.x, y: cardRect.y, w: cardRect.w, h: cardRect.h }, tabRect) }
    else { animStateRef.current = 'out'; setShowCard(false); setContentPhase(0); setTimeout(() => { setRenderCard(false); onCloseRef.current() }, 200) }
  }, [getTabRect, getCardRect, runClose, shouldUseLightweightMotion])

  useEffect(() => { triggerOpenRef.current = triggerOpen; triggerCloseRef.current = triggerClose }, [triggerOpen, triggerClose])
  useEffect(() => { if (isOpen) triggerOpenRef.current?.(); else if (renderCard) triggerCloseRef.current?.() }, [isOpen, renderCard])
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])
  useEffect(() => {
    if (!renderCard) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    return () => {
      const previousFocus = previousFocusRef.current
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true })
      }
      previousFocusRef.current = null
    }
  }, [renderCard])

  useEffect(() => {
    if (!renderCard || !showCard) return

    const focusTimer = window.setTimeout(() => {
      cardRef.current?.focus({ preventScroll: true })
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
    }
  }, [renderCard, showCard])

  useEffect(() => {
    if (!renderCard) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault()
        event.stopPropagation()
        triggerCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab' || !showCard) return

      const dialog = cardRef.current
      if (!dialog) return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(HONORS_FOCUSABLE_SELECTOR))
        .filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true')

      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus({ preventScroll: true })
        return
      }

      const firstFocusable = focusable[0]
      const lastFocusable = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (!dialog.contains(activeElement)) {
        event.preventDefault()
        firstFocusable.focus({ preventScroll: true })
        return
      }

      if (event.shiftKey && (activeElement === firstFocusable || activeElement === dialog)) {
        event.preventDefault()
        lastFocusable.focus({ preventScroll: true })
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault()
        firstFocusable.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [renderCard, showCard])

  useEffect(() => {
    if (!renderCard) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [renderCard])

  useEffect(() => {
    if (!renderCard) return

    const root = document.documentElement
    const syncViewportSize = () => {
      const scales = getHonorsResponsiveScales()
      root.style.setProperty('--honors-viewport-width', `${scales.width}px`)
      root.style.setProperty('--honors-viewport-height', `${scales.height}px`)
      root.style.setProperty('--honors-popup-width', `${Math.round(scales.dialogWidth)}px`)
      root.style.setProperty('--honors-popup-height', `${Math.round(scales.dialogHeight)}px`)
      root.style.setProperty('--honors-ui-scale', scales.uiScale.toFixed(3))
      root.style.setProperty('--honors-medal-scale', scales.medalScale.toFixed(3))
      root.style.setProperty('--honors-score-scale', scales.scoreScale.toFixed(3))
      root.style.setProperty('--honors-podium-top-pad', `${Math.round(scales.podiumTopPad)}px`)
    }

    syncViewportSize()
    window.addEventListener('resize', syncViewportSize)
    window.visualViewport?.addEventListener('resize', syncViewportSize)
    window.visualViewport?.addEventListener('scroll', syncViewportSize)

    return () => {
      window.removeEventListener('resize', syncViewportSize)
      window.visualViewport?.removeEventListener('resize', syncViewportSize)
      window.visualViewport?.removeEventListener('scroll', syncViewportSize)
      root.style.removeProperty('--honors-viewport-width')
      root.style.removeProperty('--honors-viewport-height')
      root.style.removeProperty('--honors-popup-width')
      root.style.removeProperty('--honors-popup-height')
      root.style.removeProperty('--honors-ui-scale')
      root.style.removeProperty('--honors-medal-scale')
      root.style.removeProperty('--honors-score-scale')
      root.style.removeProperty('--honors-podium-top-pad')
    }
  }, [renderCard])

  const { data } = useSWR<TopTeachersResponse>('/api/truyenthong/top-teachers', fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 15_000,
  })
  const databaseTeachers = useMemo(
    () => data?.success && Array.isArray(data.data) ? data.data : [],
    [data],
  )
  const teachers = useMemo(
    () => databaseTeachers.length > 0
      ? Array.from({ length: 3 }, (_, index) => databaseTeachers[index] ?? EMPTY_TOP_TEACHERS[index])
      : MOCK_TOP_TEACHERS,
    [databaseTeachers],
  )
  useEffect(() => {
    teachers.slice(0, 3).forEach(teacher => {
      if (!teacher.avatar_url) return
      const src = normalizeStorageUrl(teacher.avatar_url)
      const image = new Image()
      image.decoding = 'async'
      image.loading = 'eager'
        ; (image as HTMLImageElement & { fetchPriority?: 'high' | 'low' | 'auto' }).fetchPriority = 'high'
      image.src = src
    })
  }, [teachers])

  const podium = useMemo(() => [
    { ...teachers[1], rank: 2 },
    { ...teachers[0], rank: 1 },
    { ...teachers[2], rank: 3 },
  ], [teachers])

  if (!mounted) return null

  return createPortal(
    <>
      {!performanceMode && <canvas ref={canvasRef} className="honors-transition-canvas fixed inset-0 z-modal-raised-custom pointer-events-none" style={{ opacity: 0, transition: 'opacity 0.15s' }} aria-hidden />}
      {renderCard && (
        <div
          ref={overlayRef}
          className="honors-popup-overlay fixed inset-0 z-modal-backdrop-custom bg-black/40 backdrop-blur-sm"
          style={{ opacity: performanceMode ? 1 : 0 }}
          onClick={triggerClose}
        />
      )}
      {renderCard && (
        <PopupUI
          cardRef={cardRef}
          showCard={showCard}
          contentPhase={contentPhase}
          podium={podium}
          onClose={triggerClose}
          activeConfetti={showCard && contentPhase >= 3}
          performanceMode={performanceMode}
        />
      )}
    </>,
    document.body
  )
}

export default TeacherHonorsPopup
