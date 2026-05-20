'use client'

import html2canvas from 'html2canvas'
import Image from 'next/image'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/body-scroll-lock'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, X } from 'lucide-react'

interface BirthdayPerson {
  id: number
  name: string
  date: string
  masked?: boolean
  avatar_url?: string | null
}

interface WishItem {
  id: number
  senderName: string
  message: string
  createdAt: string
}

interface Balloon {
  id: number
  x: number
  color: string
  size: number
  delay: number
  duration: number
}

const BALLOON_COLORS = [
  '#FF6B6B',
  '#FFD93D',
  '#6BCB77',
  '#4D96FF',
  '#FF8BD2',
  '#C9B1FF',
]
const CELEBRATION_WISHES = [
  'Chúc thầy cô tuổi mới thật nhiều niềm vui và năng lượng tích cực.',
  'Mừng sinh nhật, chúc mọi điều tốt đẹp luôn đồng hành cùng thầy cô.',
  'Chúc thầy cô một năm mới bình an, hạnh phúc và bứt phá.',
  'Happy Birthday! Chúc thầy cô luôn rạng rỡ và tràn đầy cảm hứng.',
  'Tuổi mới thật nhiều sức khỏe, thành công và những kỷ niệm đẹp.',
  'Chúc thầy cô luôn giữ lửa nghề và lan tỏa thật nhiều giá trị.',
  'Mừng sinh nhật, chúc thầy cô gặp nhiều may mắn trong mọi chặng đường.',
  'Chúc thầy cô thêm một tuổi mới thật vui, thật ý nghĩa và thật đáng nhớ.',
  'Kính chúc thầy cô tuổi mới an vui, công việc thuận lợi, mọi sự như ý.',
  'Chúc thầy cô luôn được yêu thương, trân trọng và thành công rực rỡ.',
]

interface BirthdayWishPopupProps {
  isOpen: boolean
  onClose: () => void
  currentWeek: number
  currentMonth: number
  currentYear: number
  userArea: string | null
  birthdays: BirthdayPerson[]
}

function hasUnsupportedColorFunction(value: string): boolean {
  const normalized = value.toLowerCase()
  return (
    normalized.includes('lab(') ||
    normalized.includes('lch(') ||
    normalized.includes('oklab(') ||
    normalized.includes('oklch(')
  )
}

function getRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)))

  if (diffMinutes < 60) return `${diffMinutes} phút trước`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} ngày trước`
}

function formatBirthdayDate(rawDate: string): string {
  const parsed = new Date(rawDate)
  if (Number.isNaN(parsed.getTime())) {
    return rawDate
  }

  return parsed.toLocaleDateString('vi-VN')
}

export function BirthdayWishPopup({
  isOpen,
  onClose,
  currentWeek,
  currentMonth,
  currentYear,
  userArea,
  birthdays,
}: BirthdayWishPopupProps) {
  const [wishes, setWishes] = useState<WishItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [randomWish, setRandomWish] = useState('')
  const [balloons, setBalloons] = useState<Balloon[]>([])
  const [isMounted, setIsMounted] = useState(false)

  const posterRef = useRef<HTMLDivElement | null>(null)

  const visibleBirthdays = useMemo(
    () =>
      birthdays
        .filter((b) => !b.masked)
        .map((b) => ({ name: b.name, date: formatBirthdayDate(b.date), avatar_url: b.avatar_url || null })),
    [birthdays],
  )
  const shouldScrollReceivedWishes = wishes.length > 5

  useEffect(() => {
    if (!isOpen) return

    const loadWishes = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          month: String(currentMonth),
          week: String(currentWeek),
          year: String(currentYear),
        })

        if (userArea) {
          params.set('area', userArea)
        }

        const res = await fetch(`/api/birthday-wishes?${params.toString()}`)
        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Không tải được lời chúc')
        }

        setWishes(data.data || [])
      } catch (fetchError: any) {
        setError(fetchError?.message || 'Đã có lỗi xảy ra')
      } finally {
        setIsLoading(false)
      }
    }

    loadWishes()
  }, [isOpen, currentMonth, currentWeek, currentYear, userArea])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    lockBodyScroll()
    return () => {
      window.removeEventListener('keydown', handleEscape)
      unlockBodyScroll()
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return

    const initialBalloons: Balloon[] = Array.from(
      { length: 14 },
      (_, index) => ({
        id: index,
        x: Math.random() * 100,
        color:
          BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
        size: 38 + Math.random() * 26,
        delay: Math.random() * 4,
        duration: 8 + Math.random() * 6,
      }),
    )
    setBalloons(initialBalloons)

    const interval = window.setInterval(() => {
      setBalloons((prev) => {
        const newBalloon: Balloon = {
          id: Date.now(),
          x: Math.random() * 100,
          color:
            BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
          size: 38 + Math.random() * 26,
          delay: 0,
          duration: 8 + Math.random() * 6,
        }

        return [...prev.slice(-22), newBalloon]
      })
    }, 1800)

    return () => window.clearInterval(interval)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    setRandomWish(
      CELEBRATION_WISHES[Math.floor(Math.random() * CELEBRATION_WISHES.length)],
    )
    const interval = window.setInterval(() => {
      setRandomWish(
        CELEBRATION_WISHES[
          Math.floor(Math.random() * CELEBRATION_WISHES.length)
        ],
      )
    }, 5000)

    return () => window.clearInterval(interval)
  }, [isOpen])

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  if (!isOpen || !isMounted) return null

  const handleDownloadPng = async () => {
    if (!posterRef.current) return

    const posterElement = posterRef.current
    const targetWidth = 1080
    const targetHeight = 1920

    setIsDownloading(true)
    setError(null)

    try {
      const imageElements = Array.from(posterElement.querySelectorAll('img'))
      await Promise.all(
        imageElements.map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete && image.naturalWidth > 0) {
                if (typeof image.decode === 'function') {
                  image.decode().finally(() => resolve())
                  return
                }

                resolve()
                return
              }

              const done = () => {
                if (typeof image.decode === 'function') {
                  image.decode().finally(() => resolve())
                  return
                }

                resolve()
              }
              image.addEventListener('load', done, { once: true })
              image.addEventListener('error', done, { once: true })
            }),
        ),
      )

      // Let browser finish layout/paint after image decoding before snapshot.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )

      const { width: posterWidth, height: posterHeight } =
        posterElement.getBoundingClientRect()
      const minScaleForWidth = targetWidth / Math.max(posterWidth, 1)
      const minScaleForHeight = targetHeight / Math.max(posterHeight, 1)
      const renderScale = Math.min(
        4,
        Math.max(
          2,
          window.devicePixelRatio || 1,
          minScaleForWidth,
          minScaleForHeight,
        ),
      )

      const renderedCanvas = await html2canvas(posterElement, {
        backgroundColor: '#8B0E1B',
        scale: renderScale,
        useCORS: true,
        onclone: (clonedDoc) => {
          const clonedPoster = clonedDoc.getElementById(
            'birthday-export-poster',
          )
          if (!clonedPoster) return

          // Re-layout the poster for social-story portrait export (9:16).
          clonedPoster.style.width = `${targetWidth}px`
          clonedPoster.style.height = `${targetHeight}px`
          clonedPoster.style.maxWidth = 'none'
          clonedPoster.style.maxHeight = 'none'
          clonedPoster.style.aspectRatio = '9 / 16'
          clonedPoster.style.padding = '30px 40px 30px'
          clonedPoster.style.display = 'grid'
          clonedPoster.style.gridTemplateRows = 'auto 700px 1fr'
          clonedPoster.style.rowGap = '14px'

          const exportHeader = clonedPoster.querySelector<HTMLElement>(
            '[data-export="header"]',
          )
          const exportCakeWrap = clonedPoster.querySelector<HTMLElement>(
            '[data-export="cake"]',
          )
          const exportWish = clonedPoster.querySelector<HTMLElement>(
            '[data-export="wish"]',
          )
          const exportCakeImage = clonedPoster.querySelector<HTMLImageElement>(
            '[data-export="cake-image"]',
          )
          const exportTitle = clonedPoster.querySelector<HTMLElement>(
            '[data-export="title"]',
          )
          const exportNameList = clonedPoster.querySelectorAll<HTMLElement>(
            '[data-export="name"]',
          )
          const exportDateList = clonedPoster.querySelectorAll<HTMLElement>(
            '[data-export="date"]',
          )
          const exportWishText = clonedPoster.querySelector<HTMLElement>(
            '[data-export="wish-text"]',
          )
          const exportStars = clonedPoster.querySelectorAll<HTMLElement>(
            '[data-export="star"]',
          )
          const exportCorners = clonedPoster.querySelectorAll<HTMLElement>(
            '[data-export="corner"]',
          )
          const exportTapeTop = clonedPoster.querySelector<HTMLElement>(
            '[data-export="tape-top"]',
          )
          const exportTapeBottom = clonedPoster.querySelector<HTMLElement>(
            '[data-export="tape-bottom"]',
          )
          const exportLineLeft = clonedPoster.querySelector<HTMLElement>(
            '[data-export="line-left"]',
          )
          const exportLineRight = clonedPoster.querySelector<HTMLElement>(
            '[data-export="line-right"]',
          )

          if (exportHeader) {
            exportHeader.style.marginTop = '2px'
            exportHeader.style.marginBottom = '0'
          }

          if (exportTitle) {
            exportTitle.style.fontSize = '78px'
            exportTitle.style.lineHeight = '1.04'
            exportTitle.style.letterSpacing = '-0.02em'
          }

          exportNameList.forEach((nameNode) => {
            nameNode.style.fontSize = '68px'
            nameNode.style.lineHeight = '1.06'
          })

          exportDateList.forEach((dateNode) => {
            dateNode.style.fontSize = '40px'
            dateNode.style.lineHeight = '1.14'
          })

          if (exportCakeWrap) {
            exportCakeWrap.style.marginTop = '0'
            exportCakeWrap.style.marginBottom = '0'
            exportCakeWrap.style.display = 'flex'
            exportCakeWrap.style.alignItems = 'center'
            exportCakeWrap.style.justifyContent = 'center'
          }

          if (exportWish) {
            exportWish.style.marginTop = '0'
            exportWish.style.minHeight = '0'
            exportWish.style.height = '100%'
            exportWish.style.padding = '30px 36px'
          }

          if (exportWishText) {
            exportWishText.style.fontSize = '54px'
            exportWishText.style.lineHeight = '1.2'
          }

          if (exportCakeImage) {
            exportCakeImage.style.width = '650px'
            exportCakeImage.style.height = '650px'
            exportCakeImage.style.maxWidth = '100%'
            exportCakeImage.style.objectFit = 'contain'
          }

          exportStars.forEach((star) => {
            star.style.fontSize = '46px'
          })

          exportCorners.forEach((corner) => {
            corner.style.fontSize = '62px'
          })

          if (exportTapeTop) {
            exportTapeTop.style.width = '250px'
            exportTapeTop.style.height = '28px'
          }

          if (exportTapeBottom) {
            exportTapeBottom.style.width = '250px'
            exportTapeBottom.style.height = '28px'
          }

          if (exportLineLeft) {
            exportLineLeft.style.width = '10px'
            exportLineLeft.style.height = '240px'
          }

          if (exportLineRight) {
            exportLineRight.style.width = '10px'
            exportLineRight.style.height = '240px'
          }

          const elements = [
            clonedPoster,
            ...Array.from(clonedPoster.querySelectorAll('*')),
          ]
          const colorProps = [
            'color',
            'backgroundColor',
            'borderColor',
            'borderTopColor',
            'borderRightColor',
            'borderBottomColor',
            'borderLeftColor',
            'outlineColor',
            'textDecorationColor',
            'caretColor',
            'columnRuleColor',
            'fill',
            'stroke',
          ]

          elements.forEach((node) => {
            const htmlNode = node as HTMLElement
            const computed = clonedDoc.defaultView?.getComputedStyle(htmlNode)
            if (!computed) return

            colorProps.forEach((prop) => {
              const computedValue = (computed as any)[prop] as
                | string
                | undefined
              if (!computedValue || !hasUnsupportedColorFunction(computedValue))
                return

              if (prop === 'backgroundColor') {
                ;(htmlNode.style as any)[prop] = '#ffffff'
                return
              }

              if (
                prop.includes('border') ||
                prop === 'outlineColor' ||
                prop === 'columnRuleColor'
              ) {
                ;(htmlNode.style as any)[prop] = '#fecaca'
                return
              }

              if (prop === 'fill' || prop === 'stroke') {
                ;(htmlNode.style as any)[prop] = '#b91c1c'
                return
              }

              ;(htmlNode.style as any)[prop] = '#7f1d1d'
            })

            if (hasUnsupportedColorFunction(computed.boxShadow)) {
              htmlNode.style.boxShadow = 'none'
            }

            if (hasUnsupportedColorFunction(computed.textShadow)) {
              htmlNode.style.textShadow = 'none'
            }
          })
        },
      })

      const outputCanvas = document.createElement('canvas')
      outputCanvas.width = targetWidth
      outputCanvas.height = targetHeight
      const outputContext = outputCanvas.getContext('2d')

      if (!outputContext) {
        throw new Error('Không thể tạo ảnh để tải xuống')
      }

      outputContext.imageSmoothingEnabled = true
      outputContext.imageSmoothingQuality = 'high'

      outputContext.drawImage(renderedCanvas, 0, 0, targetWidth, targetHeight)

      const link = document.createElement('a')
      link.download = `birthday-story-week-${currentWeek}-month-${currentMonth}.png`
      link.href = outputCanvas.toDataURL('image/png')
      link.click()
    } catch (downloadError: any) {
      setError(downloadError?.message || 'Không thể tải ảnh PNG')
    } finally {
      setIsDownloading(false)
    }
  }

  const popupContent = (
    <div className="fixed inset-0 z-9999 overflow-y-auto">
      <div className="relative min-h-dvh w-screen overflow-hidden bg-linear-to-br from-[#5b0b12] via-[#8a1220] to-[#4b070d]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {balloons.map((balloon) => (
            <div
              key={balloon.id}
              className="absolute animate-popup-float"
              style={{
                left: `${balloon.x}%`,
                bottom: '-90px',
                animationDelay: `${balloon.delay}s`,
                animationDuration: `${balloon.duration}s`,
              }}
            >
              <svg
                width={balloon.size}
                height={balloon.size * 1.3}
                viewBox="0 0 40 52"
                fill="none"
              >
                <ellipse cx="20" cy="18" rx="18" ry="18" fill={balloon.color} />
                <ellipse
                  cx="20"
                  cy="18"
                  rx="18"
                  ry="18"
                  fill="white"
                  fillOpacity="0.28"
                />
                <ellipse
                  cx="14"
                  cy="12"
                  rx="4"
                  ry="6"
                  fill="white"
                  fillOpacity="0.4"
                />
                <polygon points="20,36 18,40 22,40" fill={balloon.color} />
                <path
                  d="M20 40 Q22 45 20 50 Q18 45 20 40"
                  stroke={balloon.color}
                  strokeWidth="1"
                  fill="none"
                />
              </svg>
            </div>
          ))}

          <div className="absolute -top-20 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-24 right-0 h-72 w-72 rounded-full bg-rose-300/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-red-300/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl items-start px-2 py-2 sm:items-center sm:px-6 sm:py-4">
          <div className="w-full h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] max-h-205 rounded-2xl border border-white/20 bg-[#980f24]/70 shadow-2xl backdrop-blur-md overflow-hidden animate-popup-entry origin-top flex flex-col">
            <div className="flex items-center justify-end gap-1 border-b border-white/15 px-4 py-3">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={isDownloading}
                className="rounded-lg p-1.5 text-white/85 hover:text-white hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Tải ảnh PNG"
              >
                {isDownloading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-white/85 hover:text-white hover:bg-white/10"
                onClick={onClose}
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 flex-1 min-h-0 overflow-y-auto">
              <div
                className={
                  wishes.length > 0
                    ? 'grid grid-cols-1 lg:grid-cols-2 gap-3 h-full min-h-0'
                    : ''
                }
              >
                <div
                  ref={posterRef}
                  id="birthday-export-poster"
                  className="rounded-[30px] border-2 border-rose-200/90 bg-linear-to-br from-[#fffaf5] via-[#fff4f6] to-[#ffeef2] p-4 sm:p-6 relative overflow-visible sm:overflow-hidden shadow-[0_18px_50px_rgba(127,29,29,0.24)]"
                >
                  <div className="absolute inset-0 z-0 opacity-60 bg-[radial-gradient(circle_at_18%_16%,rgba(251,113,133,0.28),transparent_42%),radial-gradient(circle_at_84%_76%,rgba(254,205,211,0.36),transparent_38%)]" />

                  <div
                    className="absolute top-3 right-4 h-3 w-20 rounded-sm bg-rose-200/80 rotate-[7deg] z-20"
                    data-export="tape-top"
                  />
                  <div
                    className="absolute bottom-3 left-4 h-3 w-20 rounded-sm bg-rose-200/80 rotate-[-7deg] z-20"
                    data-export="tape-bottom"
                  />
                  <div
                    className="absolute top-24 left-3 z-10 h-24 w-1 rounded-full bg-rose-200/55"
                    data-export="line-left"
                  />
                  <div
                    className="absolute bottom-24 right-3 z-10 h-24 w-1 rounded-full bg-rose-200/55"
                    data-export="line-right"
                  />

                  {/* Decorative corners - Nơ góc trên trái */}
                  <div
                    className="absolute top-2 left-2 text-red-500 text-2xl z-10"
                    data-export="corner"
                  >
                    ✦
                  </div>
                  {/* Nơ góc trên phải */}
                  <div
                    className="absolute top-2 right-2 text-red-500 text-2xl z-10"
                    data-export="corner"
                  >
                    ✦
                  </div>
                  {/* Nơ góc dưới trái */}
                  <div
                    className="absolute bottom-2 left-2 text-red-500 text-2xl z-10"
                    data-export="corner"
                  >
                    ✦
                  </div>
                  {/* Nơ góc dưới phải */}
                  <div
                    className="absolute bottom-2 right-2 text-red-500 text-2xl z-10"
                    data-export="corner"
                  >
                    ✦
                  </div>

                  {/* Decorative stars scattered */}
                  <div
                    className="absolute top-8 left-6 text-red-300 text-lg opacity-70 z-10"
                    data-export="star"
                  >
                    ★
                  </div>
                  <div
                    className="absolute top-10 right-8 text-red-300 text-lg opacity-70 z-10"
                    data-export="star"
                  >
                    ★
                  </div>
                  <div
                    className="absolute bottom-8 left-8 text-red-300 text-lg opacity-70 z-10"
                    data-export="star"
                  >
                    ★
                  </div>
                  <div
                    className="absolute bottom-10 right-6 text-red-300 text-lg opacity-70 z-10"
                    data-export="star"
                  >
                    ★
                  </div>

                  <p
                    className="mt-1 mb-1 text-center relative z-20 text-[30px] leading-[1.12] tracking-wide bg-linear-to-b from-[#1d3f78] via-[#10274f] to-[#0a0f1e] bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.16)] sm:mt-2 sm:mb-2 sm:text-[44px]"
                    style={{ fontFamily: 'var(--font-kaushan-script), cursive' }}
                    data-export="title"
                  >
                    Happy Birthday
                  </p>
                  <div
                    className="mt-3 flex items-center justify-center relative z-20"
                    data-export="cake"
                  >
                    <Image
                      src="/images/mindx-birthday-cake.png"
                      alt="Bánh sinh nhật MindX"
                      width={280}
                      height={280}
                      className="w-32 h-32 sm:w-48 sm:h-48 object-contain drop-shadow-[0_14px_30px_rgba(127,29,29,0.26)]"
                      priority
                      unoptimized
                      data-export="cake-image"
                    />
                  </div>

                    <div
                      className="mt-2 text-center relative z-20"
                      data-export="header"
                    >
                      <div className="space-y-2">
                        {visibleBirthdays.length > 0 ? (
                          visibleBirthdays.map((person, index) => (
                            <div
                              key={`${person.name}-${index}`}
                              className="text-black flex flex-col items-center gap-1"
                            >
                              {person.avatar_url && (
                                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden border-4 border-rose-300 shadow-lg mx-auto">
                                  <img
                                    src={person.avatar_url}
                                    alt={person.name}
                                    className="w-full h-full object-cover"
                                    crossOrigin="anonymous"
                                    data-export="avatar"
                                  />
                                </div>
                              )}
                              <p
                                className="text-[24px] sm:text-[38px] font-black leading-tight tracking-tight"
                                data-export="name"
                              >
                                {person.name}
                              </p>
                              <p
                                className="text-sm sm:text-lg text-black font-medium"
                                data-export="date"
                              >
                                {person.date}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-black text-base" data-export="name">
                            Đội ngũ giáo viên MindX
                          </p>
                        )}
                      </div>
                    </div>

                  <div
                    className="mt-2 rounded-2xl bg-white/90 border border-rose-300 border-dashed p-3 text-center min-h-14 max-h-20 sm:max-h-28 overflow-y-auto custom-scrollbar flex items-start justify-center relative z-20 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                    data-export="wish"
                  >
                    <p
                      className="text-black text-sm sm:text-base font-semibold transition-all duration-500 leading-relaxed wrap-break-word whitespace-pre-line"
                      data-export="wish-text"
                    >
                      {randomWish}
                    </p>
                  </div>
                </div>

                {wishes.length > 0 && (
                  <div
                    className={`rounded-2xl border border-white/20 bg-black/10 p-3 min-h-0 h-full overflow-hidden flex flex-col ${
                      shouldScrollReceivedWishes
                        ? 'max-h-[44vh] lg:max-h-full'
                        : ''
                    }`}
                  >
                    <p className="text-white text-sm font-bold uppercase tracking-wide mb-2">
                      Lời chúc đã nhận
                    </p>
                    <div
                      className={`space-y-2.5 min-h-0 flex-1 ${
                        shouldScrollReceivedWishes
                          ? 'overflow-y-auto custom-scrollbar pr-1'
                          : 'overflow-y-visible'
                      }`}
                    >
                      {wishes.map((wish) => (
                        <div
                          key={wish.id}
                          className="rounded-xl border border-white/15 bg-white/10 p-3 text-white"
                        >
                          <p className="text-sm font-semibold">
                            {wish.senderName}
                          </p>
                          <p className="text-sm text-white/90 mt-1 leading-relaxed">
                            {wish.message}
                          </p>
                          <p className="text-[11px] text-white/70 mt-1.5">
                            {getRelativeTime(wish.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isLoading && (
                <div className="mt-4 space-y-2.5">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-white/15 bg-white/10 p-3 animate-pulse"
                    >
                      <div className="h-3.5 w-2/5 rounded bg-white/25" />
                      <div className="h-3 w-4/5 rounded bg-white/20 mt-2" />
                      <div className="h-3 w-3/5 rounded bg-white/20 mt-1.5" />
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && wishes.length === 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-white/25 p-4 text-center text-white/75 text-sm">
                  Chưa có lời chúc nào. Hãy gửi lời chúc đầu tiên.
                </div>
              )}

              {error && (
                <p className="mt-3 text-sm text-red-100 bg-red-500/35 border border-red-200/40 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes popup-entry {
          0% {
            transform: scale(1.12);
            opacity: 0;
          }
          55% {
            transform: scale(0.96);
            opacity: 1;
          }
          75% {
            transform: scale(1.02);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes popup-float {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          90% {
            opacity: 0.85;
          }
          100% {
            transform: translateY(-115vh) rotate(8deg);
            opacity: 0;
          }
        }

        .animate-popup-entry {
          animation: popup-entry 420ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform, opacity;
        }

        .animate-popup-float {
          animation: popup-float linear forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-popup-entry,
          .animate-popup-float {
            animation: none;
          }
        }
      `}</style>
    </div>
  )

  return createPortal(popupContent, document.body)
}
