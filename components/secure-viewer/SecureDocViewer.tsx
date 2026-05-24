'use client'

import {
  ChevronLeft,
  ChevronRight,
  Expand,
  FileText,
  Image as ImageIcon,
  Loader2,
  PanelBottom,
  Shield,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SecureDocViewerProps = {
  documentId: number | null
  viewerEmail?: string
  className?: string
}

type Metadata = {
  id: number
  title: string
  description: string | null
  fileName: string
  fileType: string
  fileSize: number
  kind: 'docx' | 'pptx' | 'pdf' | 'image' | 'file'
  subjectName: string
  documentLevel: string
  lessonNumber: string
}

type MetadataResponse = {
  success: boolean
  document: Metadata
  token: string
  expiresInSeconds: number
  error?: string
}

function formatFileSize(bytes: number) {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function addTokenToUrl(documentId: number, token: string) {
  return `/api/documents/stream/${documentId}?token=${encodeURIComponent(token)}`
}

function addSearchParam(url: string, key: string, value: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

export function SecureDocViewer({ documentId, viewerEmail, className = '' }: SecureDocViewerProps) {
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [token, setToken] = useState('')
  const [assetUrl, setAssetUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAway, setIsAway] = useState(false)
  const [securityNotice, setSecurityNotice] = useState('')
  const [watermarkTime, setWatermarkTime] = useState(() => new Date().toLocaleString('vi-VN'))
  const [slideIndex, setSlideIndex] = useState(1)
  const [thumbnailOpen, setThumbnailOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const watermarkRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docxContainerRef = useRef<HTMLDivElement>(null)
  const docxStyleRef = useRef<HTMLDivElement>(null)

  const isPresentation = metadata?.kind === 'pptx'
  const displayEmail = viewerEmail || 'secure-viewer'
  const watermarkText = `MindX / ${displayEmail} / ${watermarkTime}`

  const loadMetadata = useCallback(async () => {
    if (!documentId) {
      setMetadata(null)
      setToken('')
      setAssetUrl('')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/documents/stream/${documentId}?action=metadata&page=${slideIndex}`, {
        cache: 'no-store',
      })
      const data = (await response.json()) as MetadataResponse
      if (!response.ok || !data.success) throw new Error(data.error || 'Không thể mở tài liệu')

      setMetadata(data.document)
      setToken(data.token)
      const url = addTokenToUrl(documentId, data.token)

      if (data.document.kind === 'docx') {
        setAssetUrl(addSearchParam(url, 'mode', 'raw'))
      } else {
        setAssetUrl(url)
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể tải tài liệu')
    } finally {
      setLoading(false)
    }
  }, [documentId, slideIndex])

  useEffect(() => {
    void loadMetadata()
  }, [loadMetadata])

  useEffect(() => {
    if (!metadata || metadata.kind !== 'docx' || !assetUrl || !docxContainerRef.current) return

    let cancelled = false
    const container = docxContainerRef.current
    const styleContainer = docxStyleRef.current || undefined
    container.innerHTML = ''
    if (styleContainer) styleContainer.innerHTML = ''
    setLoading(true)
    setError('')

    async function renderDocx() {
      try {
        const response = await fetch(assetUrl, { cache: 'no-store' })
        if (!response.ok) {
          const text = await response.text()
          throw new Error(text || 'Không thể đọc nội dung DOCX')
        }

        const blob = await response.blob()
        const { renderAsync } = await import('docx-preview')
        if (cancelled) return

        await renderAsync(blob, container, styleContainer, {
          className: 'secure-docx-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          experimental: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
        })
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Không thể tải định dạng DOCX')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void renderDocx()

    return () => {
      cancelled = true
      container.innerHTML = ''
      if (styleContainer) styleContainer.innerHTML = ''
    }
  }, [assetUrl, metadata])

  useEffect(() => {
    if (!metadata || metadata.kind !== 'image' || !assetUrl || !canvasRef.current) return

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const maxWidth = 1200
      const scale = Math.min(1, maxWidth / image.width)
      canvas.width = image.width * scale
      canvas.height = image.height * scale
      const context = canvas.getContext('2d')
      if (!context) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      context.globalAlpha = 0.16
      context.fillStyle = '#7f1d1d'
      context.font = '600 18px sans-serif'
      context.rotate(-Math.PI / 8)
      for (let y = 120; y < canvas.height * 1.5; y += 120) {
        for (let x = -canvas.width; x < canvas.width * 1.5; x += 360) {
          context.fillText(watermarkText, x, y)
        }
      }
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.globalAlpha = 1
    }
    image.src = assetUrl
  }, [assetUrl, metadata, watermarkText])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWatermarkTime(new Date().toLocaleString('vi-VN'))
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let noticeTimer: number | undefined

    const showSecurityNotice = (message: string) => {
      setIsAway(true)
      setSecurityNotice(message)
      if (noticeTimer) window.clearTimeout(noticeTimer)
      noticeTimer = window.setTimeout(() => {
        setSecurityNotice('')
        if (document.hasFocus() && !document.hidden) setIsAway(false)
      }, 2500)
    }

    const blockEvent = (event: Event, message = 'Thao tác này đã bị khóa để bảo vệ tài liệu.') => {
      event.preventDefault()
      event.stopPropagation()
      showSecurityNotice(message)
    }

    const blockKeys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const ctrlOrMeta = event.ctrlKey || event.metaKey
      const blockedCombo =
        (ctrlOrMeta && ['c', 'p', 's', 'u', 'a'].includes(key)) ||
        (ctrlOrMeta && event.shiftKey && ['c', 'i', 'j', 'k'].includes(key)) ||
        (event.metaKey && event.altKey && ['c', 'i', 'j', 'u'].includes(key)) ||
        (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(key))
      const blockedKey = ['f12', 'printscreen', 'snapshot'].includes(key)

      if (blockedCombo || blockedKey) {
        event.preventDefault()
        event.stopPropagation()
        if (key === 'printscreen' || key === 'snapshot' || (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(key))) {
          void navigator.clipboard?.writeText?.('').catch(() => undefined)
        }
        showSecurityNotice(
          key === 'printscreen' || key === 'snapshot' || (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(key))
            ? 'Nội dung tạm ẩn khi phát hiện phím chụp màn hình.'
            : 'Phím tắt này đã bị khóa để bảo vệ tài liệu.',
        )
        return
      }

      if (!isPresentation) return
      if (['arrowright', ' ', 'pagedown'].includes(key)) {
        event.preventDefault()
        setSlideIndex((current) => current + 1)
      }
      if (['arrowleft', 'pageup'].includes(key)) {
        event.preventDefault()
        setSlideIndex((current) => Math.max(1, current - 1))
      }
    }

    const blur = () => setIsAway(true)
    const focus = () => setIsAway(false)
    const visibility = () => setIsAway(document.hidden)
    const contextMenu = (event: MouseEvent) => blockEvent(event, 'Chuột phải đã bị khóa để bảo vệ tài liệu.')
    const beforePrint = (event: Event) => blockEvent(event, 'In tài liệu đã bị khóa.')
    const copy = (event: ClipboardEvent) => blockEvent(event, 'Sao chép nội dung đã bị khóa.')
    const selectStart = (event: Event) => blockEvent(event, 'Chọn nội dung đã bị khóa.')
    const dragStart = (event: DragEvent) => blockEvent(event, 'Kéo thả nội dung đã bị khóa.')

    window.addEventListener('keydown', blockKeys)
    window.addEventListener('blur', blur)
    window.addEventListener('focus', focus)
    window.addEventListener('beforeprint', beforePrint)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('contextmenu', contextMenu)
    document.addEventListener('copy', copy)
    document.addEventListener('cut', copy)
    document.addEventListener('selectstart', selectStart)
    document.addEventListener('dragstart', dragStart)
    return () => {
      if (noticeTimer) window.clearTimeout(noticeTimer)
      window.removeEventListener('keydown', blockKeys)
      window.removeEventListener('blur', blur)
      window.removeEventListener('focus', focus)
      window.removeEventListener('beforeprint', beforePrint)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('contextmenu', contextMenu)
      document.removeEventListener('copy', copy)
      document.removeEventListener('cut', copy)
      document.removeEventListener('selectstart', selectStart)
      document.removeEventListener('dragstart', dragStart)
    }
  }, [isPresentation])

  useEffect(() => {
    if (!rootRef.current || !watermarkRef.current) return
    const observer = new MutationObserver(() => {
      if (!watermarkRef.current || !rootRef.current?.contains(watermarkRef.current)) {
        setIsAway(true)
      }
    })
    observer.observe(rootRef.current, { childList: true, subtree: true, attributes: true })
    return () => observer.disconnect()
  }, [metadata])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const threshold = 160
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        setIsAway(true)
      }
    }, 1200)
    return () => window.clearInterval(interval)
  }, [])

  const watermarkTiles = useMemo(() => Array.from({ length: 48 }, (_, index) => index), [])

  const requestFullscreen = () => {
    void rootRef.current?.requestFullscreen?.()
  }

  if (!documentId) {
    return (
      <div className={`flex min-h-[560px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white ${className}`}>
        <div className="max-w-sm text-center">
          <Shield className="mx-auto mb-4 h-10 w-10 text-rose-700" />
          <h3 className="text-base font-bold text-slate-950">Chọn tài liệu để xem</h3>
          <p className="mt-2 text-sm text-slate-500">Nội dung sẽ mở trong vùng xem bảo mật.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={`secure-doc-viewer relative min-h-[640px] select-none overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-white shadow-sm ${className}`}
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {metadata?.kind === 'image' ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            <h3 className="truncate text-sm font-bold">{metadata?.title || 'Đang mở tài liệu'}</h3>
          </div>
          {metadata && (
            <p className="mt-1 truncate text-xs text-slate-300">
              {metadata.subjectName} / {metadata.documentLevel} / {metadata.lessonNumber} / {formatFileSize(metadata.fileSize)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={requestFullscreen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10"
          aria-label="Xem toàn màn hình"
          title="Xem toàn màn hình"
        >
          <Expand className="h-4 w-4" />
        </button>
      </div>

      <div className={`relative min-h-[584px] bg-slate-100 text-slate-950 transition duration-200 ${isAway ? 'blur-md' : ''}`}>
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-rose-700" />
            <span className="text-sm font-semibold text-slate-700">Đang tải tài liệu...</span>
          </div>
        )}

        {error && (
          <div className="flex min-h-[584px] items-center justify-center p-6">
            <div className="max-w-md rounded-lg border border-rose-200 bg-rose-50 p-5 text-center">
              <Shield className="mx-auto mb-3 h-8 w-8 text-rose-700" />
              <p className="text-sm font-semibold text-rose-900">{error}</p>
              <button
                type="button"
                onClick={() => void loadMetadata()}
                className="mt-4 rounded-md bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800"
              >
                Tải lại
              </button>
            </div>
          </div>
        )}

        {!error && metadata?.kind === 'docx' && (
          <div className="secure-docx-frame min-h-[584px] overflow-auto bg-slate-200 p-3 md:p-6">
            <div ref={docxStyleRef} className="hidden" />
            <div ref={docxContainerRef} className="secure-docx-container" />
          </div>
        )}

        {!error && metadata?.kind === 'image' && (
          <div className="flex min-h-[584px] items-start justify-center overflow-auto bg-slate-200 p-6">
            <canvas ref={canvasRef} className="max-w-full rounded-md bg-white shadow-lg" />
          </div>
        )}

        {!error && metadata && ['pdf', 'pptx'].includes(metadata.kind) && assetUrl && (
          <iframe
            title={metadata.title}
            src={assetUrl}
            className="h-[584px] w-full bg-white"
            sandbox="allow-same-origin"
          />
        )}

        <div
          ref={watermarkRef}
          className="pointer-events-none absolute inset-0 z-10 grid grid-cols-3 gap-6 overflow-hidden p-8 opacity-[0.18] mix-blend-multiply sm:grid-cols-4"
          aria-hidden="true"
        >
          {watermarkTiles.map((tile) => (
            <div
              key={tile}
              className="-rotate-12 select-none whitespace-nowrap text-[11px] font-bold uppercase text-rose-900"
              style={{ letterSpacing: '0.16em' }}
            >
              {watermarkText}
            </div>
          ))}
        </div>
      </div>

      {isAway && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/72 backdrop-blur-sm">
          <div className="rounded-lg border border-white/15 bg-slate-900 px-5 py-4 text-center shadow-2xl">
            <Shield className="mx-auto mb-3 h-8 w-8 text-rose-300" />
            <p className="text-sm font-bold text-white">
              {securityNotice || 'Nội dung tạm ẩn khi cửa sổ mất focus'}
            </p>
          </div>
        </div>
      )}

      {isPresentation && (
        <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/15 bg-slate-950/85 px-3 py-2 shadow-2xl backdrop-blur">
          <button
            type="button"
            onClick={() => setSlideIndex((current) => Math.max(1, current - 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
            aria-label="Slide trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            value={slideIndex}
            onChange={(event) => setSlideIndex(Number(event.target.value))}
            className="h-9 rounded-md border border-white/10 bg-slate-900 px-2 text-sm text-white"
            aria-label="Chọn slide"
          >
            {Array.from({ length: 50 }, (_, index) => index + 1).map((slide) => (
              <option key={slide} value={slide}>
                Slide {slide}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSlideIndex((current) => current + 1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
            aria-label="Slide sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setThumbnailOpen((current) => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
            aria-label="Mở danh sách thumbnail"
          >
            <PanelBottom className="h-4 w-4" />
          </button>
        </div>
      )}

      {thumbnailOpen && isPresentation && (
        <div className="absolute bottom-20 left-4 right-4 z-40 grid grid-cols-5 gap-2 rounded-lg border border-white/15 bg-slate-950/90 p-3 backdrop-blur">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((slide) => (
            <button
              type="button"
              key={slide}
              onClick={() => setSlideIndex(slide)}
              className={`h-16 rounded-md border text-xs font-bold ${
                slide === slideIndex ? 'border-rose-300 bg-rose-500/20' : 'border-white/10 bg-white/5'
              }`}
            >
              {slide}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
