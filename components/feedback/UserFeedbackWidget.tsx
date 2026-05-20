'use client'
import { toast } from '@/lib/app-toast'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/body-scroll-lock'
import { isTempHiddenUserRoute } from '@/lib/temp-hidden-user-routes'
import {
    ChevronLeft,
    ChevronRight,
    Map,
    MessageCircleMore,
    UploadCloud,
    X,
} from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ─── Mascot constants ────────────────────────────────────────────────────────
const WALK_FRAMES = Array.from({ length: 25 }, (_, i) => `/mascot/walk/frame-${i + 1}.png`)
const JUMP_FRAMES = Array.from({ length: 25 }, (_, i) => `/mascot/jump/frame-${i + 1}.png`)
const TURN_FRAMES = Array.from({ length: 25 }, (_, i) => `/mascot/turn_new/frame-${i + 1}.png`)
const WAVE_FRAMES = Array.from({ length: 25 }, (_, i) => `/mascot/wave/frame-${i + 1}.png`)
const AMPLITUDE = 100          // px left/right travel
const WALK_PX_PER_SEC = 40     // pixels per second while walking/jumping
const WALK_FPS = 20            // sprite animation fps for walk
const JUMP_FPS = 20            // sprite animation fps for jump
const TURN_FPS = 18            // sprite animation fps for turn
const WAVE_FPS = 15            // sprite animation fps for wave (slower = friendlier)
const JUMP_COOLDOWN_MIN = 2000
const JUMP_COOLDOWN_MAX = 8000
// ─────────────────────────────────────────────────────────────────────────────

const FEEDBACK_PAGE_OPTIONS = [
  { path: '/user/home', title: 'Trang chủ' },
  { path: '/user/truyenthong', title: 'Truyền thông nội bộ' },
  { path: '/user/thong-tin-giao-vien', title: 'Thông tin của tôi' },
  { path: '/user/hoat-dong-hang-thang', title: 'Hoạt động hàng tháng' },
  { path: '/user/xin-nghi-mot-buoi', title: 'Tạo yêu cầu xin nghỉ 1 buổi' },
  { path: '/user/nhan-lop-1-buoi', title: 'Tiếp nhận xin nghỉ 1 buổi' },
  { path: '/user/dao-tao-nang-cao', title: 'Đào tạo nâng cao' },
  { path: '/user/assignments', title: 'Quản lý kiểm tra' },
  { path: '/user/giaitrinh', title: 'Giải trình điểm kiểm tra' },
  { path: '/user/quy-trinh-quy-dinh', title: 'Quy trình & Quy định' },
  { path: '/user/quan-ly-phan-hoi', title: 'Trung tâm phản hồi' },
].filter((o) => !isTempHiddenUserRoute(o.path))

const getFallbackPageTitle = (path: string) => {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return 'Trang hiện tại'
  const raw = segments[segments.length - 1]
  return raw
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
// ─── Mascot walking component ────────────────────────────────────────────────
function MascotWalker({ onFeedback, onTour }: { onFeedback: () => void; onTour: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [bubble, setBubble] = useState(false)
  const hoveredRef = useRef(false)  // RAF reads this directly — no stale closure

  // Single render-state: what to actually display
  const [display, setDisplay] = useState({ src: WALK_FRAMES[0], posX: 0, scaleX: -1 })

  // All mutable animation state lives in ONE ref — no stale closure issues
  const s = useRef({
    phase: 'walk' as 'walk' | 'jump' | 'turn' | 'wave',
    frameIdx: 0,
    posX: 0,
    dirRight: false,
    lastFrameTime: 0,
    lastPosTime: 0,
    rafId: 0,
    jumpTimer: 0,
    bubbleTimer: 0,
    turnCount: 0,
    pausedPhase: null as 'walk' | 'jump' | 'turn' | null,
    pausedPosX: 0,
  })

  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync hoveredRef immediately (no useEffect delay)
  const handleMouseEnter = useCallback(() => {
    hoveredRef.current = true
    setHovered(true)
    const st = s.current
    if (st.phase !== 'wave') {
      st.pausedPhase = st.phase as any
      st.pausedPosX = st.posX
      st.phase = 'wave'
      st.frameIdx = 0
      st.lastFrameTime = 0
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = false
    setHovered(false)
    const st = s.current
    if (st.phase === 'wave') {
      st.phase = st.pausedPhase || 'walk'
      st.posX = st.pausedPosX
      st.frameIdx = 0
      st.lastFrameTime = 0
      st.lastPosTime = 0
      st.pausedPhase = null
    }
  }, [])

  // Preload
  useEffect(() => {
    ;[...WALK_FRAMES, ...JUMP_FRAMES, ...TURN_FRAMES, ...WAVE_FRAMES].forEach((src) => {
      const img = new window.Image(); img.src = src
    })
  }, [])

  // Bubble scheduler
  const scheduleBubble = useCallback(function pumpBubble() {
    const delay = (45 + Math.random() * 15) * 1000
    bubbleTimerRef.current = setTimeout(() => {
      setBubble(true)
      setTimeout(() => setBubble(false), 8000)
      pumpBubble()
    }, delay)
  }, [])

  useEffect(() => {
    scheduleBubble()
    return () => { if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current) }
  }, [scheduleBubble])

  // Main RAF loop
  useEffect(() => {
    const st = s.current

    // Schedule first jump
    const scheduleJump = () => {
      const delay = JUMP_COOLDOWN_MIN + Math.random() * (JUMP_COOLDOWN_MAX - JUMP_COOLDOWN_MIN)
      st.jumpTimer = window.setTimeout(() => {
        if (st.phase === 'walk') {  // only jump when walking, never during wave/turn/jump
          st.phase = 'jump'
          st.frameIdx = 0
          st.lastFrameTime = 0
        }
        scheduleJump()
      }, delay)
    }
    scheduleJump()

    const tick = (now: number) => {
      st.rafId = requestAnimationFrame(tick)

      const frames =
        st.phase === 'wave' ? WAVE_FRAMES :
          st.phase === 'jump' ? JUMP_FRAMES :
            st.phase === 'turn' ? TURN_FRAMES :
              WALK_FRAMES

      const fps =
        st.phase === 'wave' ? WAVE_FPS :
          st.phase === 'jump' ? JUMP_FPS :
            st.phase === 'turn' ? TURN_FPS :
              WALK_FPS

      const msPerFrame = 1000 / fps

      // ── Advance sprite frame ──────────────────────────────────────────────
      if (now - st.lastFrameTime >= msPerFrame) {
        st.lastFrameTime = now
        st.frameIdx++

        if (st.phase === 'wave' && st.frameIdx >= WAVE_FRAMES.length) {
          // Wave loops continuously while hovered
          st.frameIdx = 0
        } else if (st.phase === 'jump' && st.frameIdx >= JUMP_FRAMES.length) {
          // Jump done → back to walk
          st.phase = 'walk'
          st.frameIdx = 0
        } else if (st.phase === 'turn' && st.frameIdx >= TURN_FRAMES.length) {
          // Turn done → flip direction, walk
          st.turnCount = 0
          st.dirRight = !st.dirRight
          st.phase = 'walk'
          st.frameIdx = 0
        } else if (st.frameIdx >= frames.length) {
          st.frameIdx = 0
        }
      }

      // ── Move position (walk + jump both move, wave/turn freeze) ──────────────
      if (st.phase !== 'turn' && st.phase !== 'wave') {
        if (st.lastPosTime === 0) st.lastPosTime = now
        const dt = Math.min(now - st.lastPosTime, 50) // cap at 50ms to avoid jumps after tab switch
        st.lastPosTime = now

        const delta = (WALK_PX_PER_SEC * dt) / 1000
        if (st.dirRight) {
          st.posX = Math.min(0, st.posX + delta)
          if (st.posX >= 0 && st.phase === 'walk') {
            st.posX = 0
            st.phase = 'turn'
            st.frameIdx = 0
            st.turnCount = 0
            st.lastFrameTime = 0
          }
        } else {
          st.posX = Math.max(-AMPLITUDE, st.posX - delta)
          if (st.posX <= -AMPLITUDE && st.phase === 'walk') {
            st.posX = -AMPLITUDE
            st.phase = 'turn'
            st.frameIdx = 0
            st.turnCount = 0
            st.lastFrameTime = 0
          }
        }
      } else {
        st.lastPosTime = now // keep lastPosTime fresh during turn so no dt spike after
      }

      // ── Push to React render ──────────────────────────────────────────────
      const currentFrames =
        st.phase === 'wave' ? WAVE_FRAMES :
          st.phase === 'jump' ? JUMP_FRAMES :
            st.phase === 'turn' ? TURN_FRAMES :
              WALK_FRAMES
      const src = currentFrames[st.frameIdx] ?? currentFrames[0]
      const scaleX = st.dirRight ? 1 : -1

      setDisplay({ src, posX: st.posX, scaleX })
    }

    st.rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(st.rafId)
      clearTimeout(st.jumpTimer)
    }

  }, [])

  return (
    <div
      className="fixed z-[999]"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
        transform: `translateX(${display.posX}px)`,
        willChange: 'transform',
        paddingTop: '100px',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover buttons — hiện trực tiếp không có đám mây */}
      {hovered && (
        <div
          className="absolute flex flex-col items-stretch gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out pointer-events-auto"
          style={{
            bottom: '115px',
            right: '0px',
            zIndex: 1001,
            width: '160px',
          }}
        >
          <button
            onClick={onTour}
            className="flex items-center justify-center gap-2 border-2 border-[#a1001f] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#a1001f] bg-white hover:bg-[#a1001f]/5 shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 whitespace-nowrap"
          >
            <Map className="w-4 h-4 shrink-0" />
            Xem hướng dẫn
          </button>
          <button
            onClick={onFeedback}
            data-tour="tour-feedback-button"
            className="flex items-center justify-center gap-2 bg-[#a1001f] hover:bg-[#870019] rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(161,0,31,0.35)] hover:shadow-[0_6px_16px_rgba(161,0,31,0.45)] transition-all duration-200 hover:-translate-y-0.5 active:scale-95 whitespace-nowrap"
          >
            <MessageCircleMore className="w-4 h-4 shrink-0 stroke-[2.5]" />
            Gửi phản hồi
          </button>
        </div>
      )}

      {/* Bubble hỏi tự động */}
      {bubble && !hovered && (
        <div
          className="absolute flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-300 ease-out pointer-events-none"
          style={{
            zIndex: 1001,
            bottom: '120px',
            right: '-6px',
            transformOrigin: 'calc(100% - 66px) 100%',
          }}
        >
          {/* Main Cloud Bubble */}
          <div className="relative w-[260px] h-[180px]">
            <svg
              viewBox="0 0 260 180"
              width="260"
              height="180"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)] filter absolute inset-0 z-10"
            >
              <g stroke="#e5e7eb" strokeWidth="3" fill="#ffffff">
                <ellipse cx="130" cy="90" rx="85" ry="50" />
                <circle cx="130" cy="55" r="40" />
                <circle cx="130" cy="130" r="35" />
                <circle cx="60" cy="75" r="35" />
                <circle cx="200" cy="75" r="35" />
                <circle cx="75" cy="50" r="30" />
                <circle cx="185" cy="50" r="30" />
                <circle cx="75" cy="130" r="30" />
                <circle cx="185" cy="125" r="30" />
                <circle cx="35" cy="100" r="25" />
                <circle cx="225" cy="95" r="25" />
              </g>
              <g fill="#ffffff">
                <ellipse cx="130" cy="90" rx="85" ry="50" />
                <circle cx="130" cy="55" r="40" />
                <circle cx="130" cy="130" r="35" />
                <circle cx="60" cy="75" r="35" />
                <circle cx="200" cy="75" r="35" />
                <circle cx="75" cy="50" r="30" />
                <circle cx="185" cy="50" r="30" />
                <circle cx="75" cy="130" r="30" />
                <circle cx="185" cy="125" r="30" />
                <circle cx="35" cy="100" r="25" />
                <circle cx="225" cy="95" r="25" />
              </g>
            </svg>

            {/* Text Content */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center px-4 text-[14px] text-gray-700 whitespace-nowrap text-center leading-[1.5] font-medium z-20 pointer-events-auto"
              style={{ top: '15px', bottom: '15px' }}
            >
              <span className="font-semibold text-[#a1001f] text-[15px] mb-1">Xin chào! 👋</span>
              Bạn cần hướng dẫn<br />hay góp ý gì không?
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation()
                setBubble(false)
              }}
              className="absolute top-5 right-6 bg-white border border-gray-200 text-gray-400 rounded-full w-5 h-5 flex items-center justify-center hover:bg-gray-100 hover:text-gray-600 shadow-sm transition-all z-30 pointer-events-auto"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* 3 chấm đuôi */}
          <div className="absolute w-4 h-4 bg-white rounded-full border-[1.5px] border-[#e5e7eb] shadow-sm z-0" style={{ bottom: '18px', right: '102px' }} />
          <div className="absolute w-2.5 h-2.5 bg-white rounded-full border-[1.5px] border-[#e5e7eb] shadow-sm z-0" style={{ bottom: '6px', right: '92px' }} />
          <div className="absolute w-1.5 h-1.5 bg-white rounded-full border border-[#e5e7eb] shadow-sm z-0" style={{ bottom: '-6px', right: '82px' }} />
        </div>
      )}

      {/* Mascot sprite — to gấp đôi */}
      <div
        className="cursor-pointer select-none relative flex flex-col items-center justify-end"
        onClick={() => setBubble(false)}
      >
        {/* Bóng dưới chân — scale theo mascot */}
        <div className="absolute bottom-[28px] w-[60px] h-[10px] bg-black/20 mix-blend-multiply rounded-[100%] blur-[4px] pointer-events-none z-0" />

        <img
          src={display.src}
          alt="mascot"
          width={200}
          height={200}
          style={{ transform: `scaleX(${display.scaleX})` }}
          className="h-[160px] w-auto object-contain drop-shadow-sm relative z-10"
          draggable={false}
        />
      </div>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function UserFeedbackWidget() {
  const { user, token } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [selectedScreenPath, setSelectedScreenPath] = useState(pathname)
  const [images, setImages] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [previewImages, setPreviewImages] = useState<string[] | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  const selectedPageTitle = useMemo(() => {
    const selected = FEEDBACK_PAGE_OPTIONS.find(
      (item) => item.path === selectedScreenPath,
    )
    return selected?.title ?? getFallbackPageTitle(selectedScreenPath)
  }, [selectedScreenPath])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      setSelectedScreenPath(pathname)
    }
  }, [open, pathname])

  const canSubmit = useMemo(
    () => content.trim().length > 0 && !submitting,
    [content, submitting],
  )

  useEffect(() => {
    if (!open && !previewImages) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (previewImages) {
          setPreviewImages(null)
          return
        }
        if (open) setOpen(false)
        return
      }

      if (!previewImages || previewImages.length === 0) return
      if (event.key === 'ArrowLeft') {
        setPreviewIndex(
          (prev) => (prev - 1 + previewImages.length) % previewImages.length,
        )
      } else if (event.key === 'ArrowRight') {
        setPreviewIndex((prev) => (prev + 1) % previewImages.length)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, previewImages])

  useEffect(() => {
    if (!open && !previewImages) return

    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open, previewImages])

  const uploadImages = async () => {
    if (images.length === 0) return [] as string[]
    const uploaded = await Promise.all(
      images.map(async (image) => {
        const formData = new FormData()
        formData.append('file', image)
        const response = await fetch('/api/feedback/upload-image', {
          method: 'POST',
          headers: authHeaders(token),
          body: formData,
        })
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Không thể upload ảnh')
        }
        return data.storagePath || data.url
      }),
    )
    return uploaded.filter(Boolean)
  }

  const handleSubmit = async () => {
    if (!user?.email || !canSubmit) return
    try {
      setSubmitting(true)
      const imageUrls = await uploadImages()
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          requestEmail: user.email,
          userName: user.displayName,
          screenPath: selectedScreenPath,
          content: content.trim(),
          suggestion: suggestion.trim(),
          imageUrls,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Không thể gửi feedback')
      }

      setContent('')
      setSuggestion('')
      setImages([])
      toast.success('Đã gửi ý kiến phản hồi')
      setOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Lỗi gửi feedback')
    } finally {
      setSubmitting(false)
    }
  }

  const widget = (
    <>
      {/* Mascot walker replaces old button */}
      <MascotWalker
        onFeedback={() => setOpen(true)}
        onTour={() => {
          window.dispatchEvent(new Event('start-tour'))
        }}
      />

      {open && (
        <div
          className="fixed inset-0 z-1001 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-2xl max-h-[82vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="bg-[#a1001f] px-4 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">
                  Gửi ý kiến phản hồi
                </h3>
                <p className="text-xs text-white/85 mt-0.5">
                  Giúp hệ thống xử lý phản hồi nhanh và chính xác hơn
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto min-h-0">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Nội dung
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder="Mô tả vấn đề hoặc góp ý của bạn..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Đề xuất
                </label>
                <textarea
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  rows={3}
                  placeholder="Bạn muốn cải thiện như thế nào?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Đang ở trang nào
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={selectedScreenPath}
                    onChange={(e) => setSelectedScreenPath(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {FEEDBACK_PAGE_OPTIONS.map((option) => (
                      <option key={option.path} value={option.path}>
                        {option.title}
                      </option>
                    ))}
                    {!FEEDBACK_PAGE_OPTIONS.some(
                      (option) => option.path === selectedScreenPath,
                    ) && (
                        <option value={selectedScreenPath}>
                          {selectedPageTitle}
                        </option>
                      )}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedScreenPath) return
                      setOpen(false)
                      router.push(selectedScreenPath)
                    }}
                    className="shrink-0 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Đi tới trang
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Trang đang chọn:{' '}
                  <span className="font-medium">{selectedPageTitle}</span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Ảnh minh họa
                </label>
                <label className="border-2 border-dashed border-gray-300 rounded-xl p-4 block cursor-pointer hover:border-[#a1001f]/40 hover:bg-[#a1001f]/2 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) =>
                      setImages(Array.from(e.target.files || []))
                    }
                  />
                  <div
                    className="min-h-16 flex items-center justify-center text-center gap-2 text-sm text-gray-600"
                    onPaste={(e) => {
                      const fileItems = Array.from(e.clipboardData.items || [])
                        .filter((item) => item.type.startsWith('image/'))
                        .map((item) => item.getAsFile())
                        .filter((file): file is File => Boolean(file))
                      if (fileItems.length > 0) {
                        e.preventDefault()
                        setImages((prev) => [...prev, ...fileItems])
                      }
                    }}
                  >
                    <UploadCloud className="h-4 w-4" />
                    Chọn ảnh, kéo-thả, hoặc dán ảnh (Ctrl+V)
                  </div>
                </label>
                {images.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 overflow-x-auto">
                    {images.slice(0, 3).map((file, idx) => (
                      <div
                        key={file.name + file.size + idx}
                        className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
                      >
                        { }
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-24 h-24 object-cover"
                        />{' '}
                        <button
                          type="button"
                          onClick={() =>
                            setImages((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="absolute top-1 right-1 bg-black/60 text-white rounded p-0.5 hover:bg-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {images.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          const urls = images.map((file) =>
                            URL.createObjectURL(file),
                          )
                          setPreviewImages(urls)
                          setPreviewIndex(3)
                        }}
                        className="w-24 h-24 shrink-0 rounded-lg border border-gray-300 bg-gray-50 text-sm font-semibold text-gray-700"
                      >
                        +{images.length - 3}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="w-full px-4 py-2.5 rounded-lg bg-[#a1001f] text-white text-sm font-medium hover:bg-[#870019] disabled:opacity-60"
              >
                {submitting ? 'Đang gửi...' : 'Gửi ý kiến phản hồi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImages && previewImages.length > 0 && (
        <div className="fixed inset-0 z-1100 bg-black/80 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl">
            <button
              type="button"
              onClick={() => setPreviewImages(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="bg-black rounded-xl overflow-hidden border border-white/20">
              { }
              <img
                src={previewImages[previewIndex]}
                alt={`feedback-${previewIndex + 1}`}
                className="w-full max-h-[78vh] object-contain"
              />
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setPreviewIndex(
                    (prev) =>
                      (prev - 1 + previewImages.length) % previewImages.length,
                  )
                }
                className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-white">
                {previewIndex + 1} / {previewImages.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPreviewIndex((prev) => (prev + 1) % previewImages.length)
                }
                className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (!mounted) return null
  return createPortal(widget, document.body)
}
