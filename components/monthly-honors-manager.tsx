'use client'
import { useQueryState } from '@/lib/use-query-state'


import { useState, useRef, useCallback, useEffect } from 'react'
import { Trophy, Upload, X, CheckCircle, AlertCircle, Trash2, Eye, Star, Crown, Medal, Download, RefreshCw, Plus, Crop, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useSWR, { useSWRConfig } from 'swr'
import { cn } from '@/lib/utils'
import { normalizeStorageUrl } from '@/lib/storage-url'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HonorRecord {
  id: number
  stt: number | null
  full_name: string
  email: string | null
  khoi_day: string | null
  co_so: string | null
  thang: string
  so_case: number
  so_hoc_sinh: number
  ti_le: number
  loai: string | null
  thuong_cr: number
  avatar_url: string | null
  slogan: string | null
}

interface VinhDanhData {
  success: boolean
  months: string[]
  current_month: string
  data: HonorRecord[]
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
const HONORS_SCORE_LABEL = 'CR45'
const AVATAR_CROP_OUTPUT_SIZE = 720
const AVATAR_CROP_FILE_TYPE = 'image/jpeg'
const AVATAR_CROP_FILE_QUALITY = 0.92
const AVATAR_CROP_MIN_ZOOM = 1
const AVATAR_CROP_MAX_ZOOM = 3

type AvatarCropDraft = {
  src: string
  fileName: string
  title: string
}

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1
    ? p[0].slice(0, 2).toUpperCase()
    : (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase()
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('Không thể đọc ảnh'))
    }
    reader.onerror = () => reject(new Error('Không thể đọc ảnh'))
    reader.readAsDataURL(file)
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('Không thể tạo preview ảnh'))
    }
    reader.onerror = () => reject(new Error('Không thể tạo preview ảnh'))
    reader.readAsDataURL(blob)
  })
}

function makeCroppedAvatarFileName(fileName: string) {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${base || 'honors-avatar'}-cropped.jpg`
}

function AvatarCropDialog({
  src,
  fileName,
  title,
  onCancel,
  onSave,
}: AvatarCropDraft & {
  onCancel: () => void
  onSave: (file: File, previewUrl: string) => void
}) {
  const cropBoxRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [cropSize, setCropSize] = useState(0)
  const [imageNatural, setImageNatural] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startOffset: { x: number; y: number }
  } | null>(null)

  const normalizedSrc = normalizeStorageUrl(src)
  const hasImage = cropSize > 0 && imageNatural.w > 0 && imageNatural.h > 0
  const baseScale = hasImage ? Math.max(cropSize / imageNatural.w, cropSize / imageNatural.h) : 1
  const effectiveScale = baseScale * zoom
  const displayedImage = {
    w: imageNatural.w * effectiveScale,
    h: imageNatural.h * effectiveScale,
  }

  const clampOffset = useCallback((nextOffset: { x: number; y: number }, nextZoom = zoom) => {
    if (!cropSize || !imageNatural.w || !imageNatural.h) return { x: 0, y: 0 }

    const nextScale = Math.max(cropSize / imageNatural.w, cropSize / imageNatural.h) * nextZoom
    const nextDisplayedW = imageNatural.w * nextScale
    const nextDisplayedH = imageNatural.h * nextScale
    const maxX = Math.max(0, (nextDisplayedW - cropSize) / 2)
    const maxY = Math.max(0, (nextDisplayedH - cropSize) / 2)

    return {
      x: clampNumber(nextOffset.x, -maxX, maxX),
      y: clampNumber(nextOffset.y, -maxY, maxY),
    }
  }, [cropSize, imageNatural, zoom])

  const applyZoom = useCallback((nextZoom: number) => {
    const safeZoom = clampNumber(nextZoom, AVATAR_CROP_MIN_ZOOM, AVATAR_CROP_MAX_ZOOM)
    setZoom(safeZoom)
    setOffset(current => clampOffset(current, safeZoom))
  }, [clampOffset])

  useEffect(() => {
    const measure = () => {
      const el = cropBoxRef.current
      if (!el) return
      setCropSize(el.clientWidth)
    }

    measure()
    const observer = new ResizeObserver(measure)
    if (cropBoxRef.current) observer.observe(cropBoxRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [src])

  useEffect(() => {
    setOffset(current => clampOffset(current))
  }, [clampOffset])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const resetCrop = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!hasImage) return

    event.preventDefault()
    cropBoxRef.current?.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offset,
    }
  }, [hasImage, offset])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const nextOffset = {
      x: drag.startOffset.x + event.clientX - drag.startX,
      y: drag.startOffset.y + event.clientY - drag.startY,
    }
    setOffset(clampOffset(nextOffset))
  }, [clampOffset])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    applyZoom(zoom + (event.deltaY > 0 ? -0.08 : 0.08))
  }, [applyZoom, zoom])

  const handleSaveCrop = useCallback(async () => {
    const image = imageRef.current
    if (!image || !cropSize || !imageNatural.w || !imageNatural.h) return

    setIsSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_CROP_OUTPUT_SIZE
      canvas.height = AVATAR_CROP_OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Không thể tạo canvas crop')

      const imageLeft = cropSize / 2 + offset.x - displayedImage.w / 2
      const imageTop = cropSize / 2 + offset.y - displayedImage.h / 2
      const sourceX = clampNumber(-imageLeft / effectiveScale, 0, imageNatural.w)
      const sourceY = clampNumber(-imageTop / effectiveScale, 0, imageNatural.h)
      const sourceSize = Math.min(cropSize / effectiveScale, imageNatural.w - sourceX, imageNatural.h - sourceY)

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, AVATAR_CROP_OUTPUT_SIZE, AVATAR_CROP_OUTPUT_SIZE)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        AVATAR_CROP_OUTPUT_SIZE,
        AVATAR_CROP_OUTPUT_SIZE,
      )

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, AVATAR_CROP_FILE_TYPE, AVATAR_CROP_FILE_QUALITY)
      })
      if (!blob) throw new Error('Không thể xuất ảnh đã crop')

      const previewUrl = await blobToDataUrl(blob)
      const croppedFile = new File([blob], makeCroppedAvatarFileName(fileName), {
        type: AVATAR_CROP_FILE_TYPE,
        lastModified: Date.now(),
      })

      onSave(croppedFile, previewUrl)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể crop ảnh này. Hãy thử chọn lại ảnh gốc.')
    } finally {
      setIsSaving(false)
    }
  }, [cropSize, displayedImage, effectiveScale, fileName, imageNatural, offset, onSave])

  return (
    <div
      className="fixed inset-0 z-modal-raised-custom flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="honors-avatar-crop-title"
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Crop className="h-4 w-4" />
            </div>
            <h3 id="honors-avatar-crop-title" className="text-sm font-black text-gray-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
            aria-label="Đóng crop avatar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_190px]">
          <div
            ref={cropBoxRef}
            className="relative mx-auto aspect-square w-full max-w-[440px] touch-none overflow-hidden rounded-2xl bg-gray-950 select-none shadow-inner"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            <img
              ref={imageRef}
              src={normalizedSrc}
              alt=""
              draggable={false}
              onLoad={(event) => {
                const image = event.currentTarget
                setImageNatural({ w: image.naturalWidth, h: image.naturalHeight })
              }}
              className="absolute max-w-none select-none"
              style={{
                left: cropSize / 2 + offset.x,
                top: cropSize / 2 + offset.y,
                width: displayedImage.w || '100%',
                height: displayedImage.h || '100%',
                transform: 'translate(-50%, -50%)',
                cursor: hasImage ? 'grab' : 'default',
              }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'radial-gradient(circle at center, transparent 0 49%, rgba(0,0,0,0.54) 49.5% 100%)',
              }}
            />
            <div className="pointer-events-none absolute inset-[8%] rounded-full border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.22),0_0_36px_rgba(255,255,255,0.18)]" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/18" />
            <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/18" />
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-4">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">Preview</p>
                <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-4 ring-amber-100">
                  <div className="relative h-full w-full overflow-hidden">
                    <img
                      src={normalizedSrc}
                      alt=""
                      draggable={false}
                      className="absolute max-w-none select-none"
                      style={{
                        left: 64 + (offset.x / Math.max(cropSize, 1)) * 128,
                        top: 64 + (offset.y / Math.max(cropSize, 1)) * 128,
                        width: cropSize ? displayedImage.w * 128 / cropSize : '100%',
                        height: cropSize ? displayedImage.h * 128 / cropSize : '100%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-500">Zoom</span>
                <input
                  type="range"
                  min={AVATAR_CROP_MIN_ZOOM}
                  max={AVATAR_CROP_MAX_ZOOM}
                  step="0.01"
                  value={zoom}
                  onChange={event => applyZoom(Number(event.target.value))}
                  className="w-full accent-amber-600"
                  aria-label="Phóng to ảnh avatar"
                />
              </label>

              <Button type="button" variant="outline" size="sm" onClick={resetCrop} className="w-full gap-2">
                <RotateCcw className="h-3.5 w-3.5" />
                Đặt lại
              </Button>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex-1">
                Hủy
              </Button>
              <Button type="button" variant="mindx" size="sm" onClick={handleSaveCrop} disabled={!hasImage || isSaving} className="flex-1">
                {isSaving ? 'Đang crop...' : 'Lưu ảnh'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Honor Card (preview display) ────────────────────────────────────────────

function HonorCard({
  record, rank, onSave,
}: {
  record: HonorRecord; rank: number
  onSave?: (id: number, values: { full_name: string; co_so: string; ti_le: string }, avatarFile?: File | null) => Promise<void>
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [fullNameDraft, setFullNameDraft] = useState(record.full_name)
  const [coSoDraft, setCoSoDraft] = useState(record.co_so || '')
  const [tiLeDraft, setTiLeDraft] = useState(String(record.ti_le))
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarCropSource, setAvatarCropSource] = useState<string | null>(null)
  const [avatarCropDraft, setAvatarCropDraft] = useState<AvatarCropDraft | null>(null)
  const [hovered, setHovered] = useState(false)
  const [saving, setSaving] = useState(false)
  const rankConfigs = [
    { badge: 'bg-[#a1001f] text-white', ring: 'ring-amber-200', stripe: 'bg-[#a1001f]', icon: Crown },
    { badge: 'bg-amber-600 text-white', ring: 'ring-amber-100', stripe: 'bg-amber-500', icon: Medal },
    { badge: 'bg-gray-700 text-white', ring: 'ring-gray-200', stripe: 'bg-gray-500', icon: Medal },
  ]
  const cfg = rankConfigs[rank - 1] || rankConfigs[2]
  const Icon = cfg.icon
  const isDirty = fullNameDraft.trim() !== record.full_name
    || coSoDraft.trim() !== (record.co_so || '')
    || Number(tiLeDraft.replace(',', '.')) !== record.ti_le
    || Boolean(avatarFile)

  useEffect(() => {
    setFullNameDraft(record.full_name)
    setCoSoDraft(record.co_so || '')
    setTiLeDraft(String(record.ti_le))
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarCropSource(null)
    setAvatarCropDraft(null)
  }, [record.co_so, record.full_name, record.id, record.ti_le])

  const startAvatarCropFromFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Chỉ hỗ trợ file ảnh')
      return
    }

    try {
      const sourceUrl = await readFileAsDataUrl(file)
      setAvatarCropSource(sourceUrl)
      setAvatarCropDraft({
        src: sourceUrl,
        fileName: file.name,
        title: `Canh avatar cho ${record.full_name}`,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể đọc ảnh')
    }
  }, [record.full_name])

  const startCurrentAvatarCrop = useCallback(() => {
    const sourceUrl = avatarCropSource || avatarPreview || record.avatar_url
    if (!sourceUrl) {
      avatarInputRef.current?.click()
      return
    }

    setAvatarCropSource(sourceUrl)
    setAvatarCropDraft({
      src: sourceUrl,
      fileName: `${record.full_name || 'avatar'}-${record.id}.jpg`,
      title: `Canh avatar cho ${record.full_name}`,
    })
  }, [avatarCropSource, avatarPreview, record.avatar_url, record.full_name, record.id])

  const applyCroppedAvatar = useCallback((file: File, previewUrl: string) => {
    setAvatarFile(file)
    setAvatarPreview(previewUrl)
    setAvatarCropDraft(null)
  }, [])

  useEffect(() => {
    if (!hovered || !onSave) return

    const onWindowPaste = (event: ClipboardEvent) => {
      const pastedImage = getClipboardImageFile(event.clipboardData?.items)
      if (!pastedImage) return

      event.preventDefault()
      void startAvatarCropFromFile(pastedImage)
    }

    window.addEventListener('paste', onWindowPaste)
    return () => window.removeEventListener('paste', onWindowPaste)
  }, [hovered, onSave, startAvatarCropFromFile])

  const submit = async () => {
    if (!onSave || !isDirty) return
    const percent = Number(tiLeDraft.replace(',', '.'))
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      alert('CR45 cần là số từ 0 đến 100')
      return
    }
    setSaving(true)
    try {
      await onSave(record.id, {
        full_name: fullNameDraft.trim(),
        co_so: coSoDraft.trim(),
        ti_le: tiLeDraft.trim(),
      }, avatarFile)
      setAvatarFile(null)
      setAvatarPreview(null)
      setAvatarCropSource(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể lưu thông tin vinh danh')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className={cn(
          'relative grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden rounded-2xl border border-amber-100 bg-white p-4 text-gray-900 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md'
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
      <div className={cn('absolute left-4 top-3 rounded-lg px-2.5 py-1 text-[11px] font-black shadow-sm', cfg.badge)}>
        Top {rank}
      </div>
      <div className={cn('absolute inset-y-0 left-0 w-1.5', cfg.stripe)} />
      {rank === 1 && <Icon className="absolute right-4 top-3 h-5 w-5 text-amber-500" />}

      <div className={cn(
        'group/avatar relative mt-5 flex h-[78px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-full ring-2',
        cfg.ring
      )}>
        {avatarPreview || record.avatar_url ? (
          <img src={avatarPreview || record.avatar_url || ''} alt={record.full_name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-amber-50">
            <span className="text-xl font-black text-amber-700">
              {initials(record.full_name)}
            </span>
          </div>
        )}
          {onSave && (
            <>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className={cn(
                  'absolute inset-0 z-10 flex items-center justify-center bg-black/45 text-white transition-opacity focus:opacity-100',
                  hovered ? 'opacity-100' : 'opacity-0 group-hover/avatar:opacity-100'
                )}
                title="Đổi và crop avatar"
                aria-label={`Đổi và crop avatar cho ${record.full_name}`}
              >
                <Upload className="w-4 h-4" />
              </button>
              {(avatarPreview || record.avatar_url) && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    startCurrentAvatarCrop()
                  }}
                  className="absolute bottom-0.5 right-0.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white text-[#a1001f] shadow-md transition hover:scale-105 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  title="Crop lại avatar"
                  aria-label={`Crop lại avatar cho ${record.full_name}`}
                >
                  <Crop className="h-3.5 w-3.5" />
                </button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0]
                  if (nextFile) void startAvatarCropFromFile(nextFile)
                  e.currentTarget.value = ''
                }}
              />
            </>
          )}
      </div>

      <div className="min-w-0 space-y-2 pt-4">
        {onSave ? (
          <input
            value={fullNameDraft}
            onChange={e => setFullNameDraft(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-base font-black leading-tight text-gray-900 outline-none placeholder:text-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            placeholder="Họ và tên"
          />
        ) : (
          <p className="truncate text-base font-black leading-tight">{record.full_name}</p>
        )}
        {onSave ? (
          <input
            value={coSoDraft}
            onChange={e => setCoSoDraft(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 outline-none placeholder:text-gray-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
            placeholder="Cơ sở"
          />
        ) : (
          <p className="truncate text-sm font-semibold text-gray-600">{record.co_so || '—'}</p>
        )}

        <div
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[#6b0015]"
          title={`Chỉ số ${HONORS_SCORE_LABEL}: ${record.ti_le.toFixed(1)}%`}
          aria-label={`Chỉ số ${HONORS_SCORE_LABEL}: ${record.ti_le.toFixed(1)}%`}
        >
          <Star className="h-3 w-3 shrink-0 fill-[#a1001f] text-[#a1001f]" />
          <span className="text-[10px] font-black uppercase leading-none">
            {HONORS_SCORE_LABEL}
          </span>
          <span className="h-3.5 w-px bg-[#a1001f]/20" />
          {onSave ? (
            <label className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={tiLeDraft}
                onChange={e => setTiLeDraft(e.target.value)}
                className="w-16 bg-transparent text-[15px] font-black tabular-nums text-[#6b0015] outline-none"
                aria-label={`Nhập chỉ số ${HONORS_SCORE_LABEL}`}
              />
              <span className="text-[15px] font-black">%</span>
            </label>
          ) : (
            <span className="text-[15px] font-black tabular-nums">
              {record.ti_le.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {onSave && (
        <div className="flex justify-end pt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={submit}
            disabled={!isDirty || saving || !fullNameDraft.trim()}
            className="min-w-20 border-amber-200 bg-amber-50 text-[#a1001f] hover:bg-amber-100 disabled:bg-gray-50 disabled:text-gray-400"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-gray-900" />
                Lưu
              </span>
            ) : (
              'Lưu'
            )}
          </Button>
        </div>
      )}
      </div>

      {avatarCropDraft && (
        <AvatarCropDialog
          {...avatarCropDraft}
          onCancel={() => setAvatarCropDraft(null)}
          onSave={applyCroppedAvatar}
        />
      )}
    </>
  )
}

// ─── Podium Preview ───────────────────────────────────────────────────────────

function PodiumPreview({
  records, onSaveRecord,
}: {
  records: HonorRecord[]
  onSaveRecord?: (id: number, values: { full_name: string; co_so: string; ti_le: string }, avatarFile?: File | null) => Promise<void>
}) {
  const top3 = records.slice(0, 3)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      {top3.map((r, i) => (
        <HonorCard
          key={r.id}
          record={r}
          rank={i + 1}
          onSave={onSaveRecord}
        />
      ))}
    </div>
  )
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function HonorRow({ record, index }: { record: HonorRecord; index: number }) {
  return (
    <tr className={cn('transition-colors hover:bg-amber-50/50', index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
      <td className="px-4 py-3 text-center">
        <span className={cn(
          'inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-black',
          record.stt === 1 ? 'bg-yellow-100 text-yellow-700' :
          record.stt === 2 ? 'bg-gray-100 text-gray-600' :
          record.stt === 3 ? 'bg-orange-100 text-orange-600' :
          'bg-gray-100 text-gray-500'
        )}>
          {record.stt ?? index + 1}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-amber-100 flex items-center justify-center">
            {record.avatar_url ? (
              <img src={record.avatar_url} alt={record.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-black text-amber-700">{initials(record.full_name)}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">{record.full_name}</p>
            {record.email && <p className="text-xs text-gray-400 mt-0.5">{record.email}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{record.co_so || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{record.khoi_day || '—'}</td>
      <td className="px-4 py-3 text-center tabular-nums text-sm font-semibold text-gray-700">{record.so_case}</td>
      <td className="px-4 py-3 text-center tabular-nums text-sm font-semibold text-gray-700">{record.so_hoc_sinh}</td>
      <td className="px-4 py-3 text-center">
        <span
          className="inline-flex items-center overflow-hidden rounded-lg border border-amber-200 bg-white text-xs font-black whitespace-nowrap shadow-sm"
          title={`Chỉ số ${HONORS_SCORE_LABEL}: ${record.ti_le.toFixed(1)}%`}
          aria-label={`Chỉ số ${HONORS_SCORE_LABEL}: ${record.ti_le.toFixed(1)}%`}
        >
          <span className="bg-amber-300 px-1.5 py-0.5 text-[9px] uppercase leading-none text-red-950">
            {HONORS_SCORE_LABEL}
          </span>
          <span className="bg-red-950 px-1.5 py-0.5 text-yellow-100 tabular-nums leading-none">
            {record.ti_le.toFixed(1)}%
          </span>
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{record.loai || '—'}</td>
      <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-emerald-700">
        {record.thuong_cr > 0 ? record.thuong_cr.toLocaleString('vi-VN') : '—'}
      </td>
    </tr>
  )
}

// ─── Import Dialog ────────────────────────────────────────────────────────────

interface ImportResult {
  success: boolean
  inserted?: number
  total?: number
  source_total?: number
  deleted?: number
  current_month?: string | null
  errors?: string[]
  preview?: Record<string, unknown>[]
  error?: string
}

type TopImageBox = 'top1' | 'top2' | 'top3'
type ImportMode = 'csv' | 'manual'
type TopImageCropDraft = AvatarCropDraft & { box: TopImageBox }

type ManualHonorRow = {
  full_name: string
  email: string
  co_so: string
  khoi_day: string
  ti_le: string
  so_case: string
  so_hoc_sinh: string
  loai: string
  thuong_cr: string
}

const emptyManualRow = (): ManualHonorRow => ({
  full_name: '',
  email: '',
  co_so: '',
  khoi_day: '',
  ti_le: '',
  so_case: '',
  so_hoc_sinh: '',
  loai: '',
  thuong_cr: '',
})

function csvCell(value: string) {
  const escaped = value.replace(/"/g, '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function getClipboardImageFile(items: DataTransferItemList | undefined | null): File | null {
  if (!items) return null

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }

  return null
}

function getTopImageLabel(box: TopImageBox) {
  return box === 'top1' ? 'Top 1' : box === 'top2' ? 'Top 2' : 'Top 3'
}

function ImportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (month?: string | null) => void }) {
  const [mode, setMode] = useState<ImportMode>('csv')
  const [file, setFile] = useState<File | null>(null)
  const [thang, setThang] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [manualRows, setManualRows] = useState<ManualHonorRow[]>([
    emptyManualRow(),
    emptyManualRow(),
    emptyManualRow(),
  ])
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Track which image box is hovered for paste
  const [hoveredImageBox, setHoveredImageBox] = useState<TopImageBox | null>(null)
  const [activeImageBox, setActiveImageBox] = useState<TopImageBox | null>(null)
  // Images for top 1, 2, 3
  const [top1Image, setTop1Image] = useState<File | null>(null)
  const [top2Image, setTop2Image] = useState<File | null>(null)
  const [top3Image, setTop3Image] = useState<File | null>(null)
  const [top1Preview, setTop1Preview] = useState<string | null>(null)
  const [top2Preview, setTop2Preview] = useState<string | null>(null)
  const [top3Preview, setTop3Preview] = useState<string | null>(null)
  const [top1CropSource, setTop1CropSource] = useState<string | null>(null)
  const [top2CropSource, setTop2CropSource] = useState<string | null>(null)
  const [top3CropSource, setTop3CropSource] = useState<string | null>(null)
  const [imageCropDraft, setImageCropDraft] = useState<TopImageCropDraft | null>(null)
  const top1PasteRef = useRef<HTMLDivElement>(null)
  const top2PasteRef = useRef<HTMLDivElement>(null)
  const top3PasteRef = useRef<HTMLDivElement>(null)

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) {
      alert('Chỉ hỗ trợ file CSV')
      return
    }
    setFile(f)
    setResult(null)
  }, [])

  const updateManualRow = useCallback((index: number, field: keyof ManualHonorRow, value: string) => {
    setManualRows(rows => rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )))
    setResult(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const setTopImageSource = useCallback((box: TopImageBox, sourceUrl: string) => {
    if (box === 'top1') setTop1CropSource(sourceUrl)
    else if (box === 'top2') setTop2CropSource(sourceUrl)
    else setTop3CropSource(sourceUrl)
  }, [])

  const applyCroppedImageToBox = useCallback((box: TopImageBox, imageFile: File, previewUrl: string) => {
    if (box === 'top1') {
      setTop1Image(imageFile)
      setTop1Preview(previewUrl)
    } else if (box === 'top2') {
      setTop2Image(imageFile)
      setTop2Preview(previewUrl)
    } else {
      setTop3Image(imageFile)
      setTop3Preview(previewUrl)
    }
    setResult(null)
  }, [])

  const startTopImageCropFromFile = useCallback(async (box: TopImageBox, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Chỉ hỗ trợ file ảnh')
      return
    }

    try {
      const sourceUrl = await readFileAsDataUrl(file)
      setTopImageSource(box, sourceUrl)
      setImageCropDraft({
        box,
        src: sourceUrl,
        fileName: file.name,
        title: `Canh avatar ${getTopImageLabel(box)}`,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể đọc ảnh')
    }
  }, [setTopImageSource])

  const applyImageToBox = useCallback((box: TopImageBox, imageFile: File) => {
    void startTopImageCropFromFile(box, imageFile)
  }, [startTopImageCropFromFile])

  const openImagePicker = useCallback((box: TopImageBox) => {
    setActiveImageBox(box)
    document.getElementById(`${box}ImageInput`)?.click()
  }, [])

  const openCurrentImageCropper = useCallback((box: TopImageBox) => {
    const sourceUrl = box === 'top1'
      ? (top1CropSource || top1Preview)
      : box === 'top2'
        ? (top2CropSource || top2Preview)
        : (top3CropSource || top3Preview)

    if (!sourceUrl) {
      openImagePicker(box)
      return
    }

    setActiveImageBox(box)
    setImageCropDraft({
      box,
      src: sourceUrl,
      fileName: `${box}-avatar.jpg`,
      title: `Canh avatar ${getTopImageLabel(box)}`,
    })
  }, [openImagePicker, top1CropSource, top1Preview, top2CropSource, top2Preview, top3CropSource, top3Preview])

  const handleCroppedTopImage = useCallback((imageFile: File, previewUrl: string) => {
    if (!imageCropDraft) return
    applyCroppedImageToBox(imageCropDraft.box, imageFile, previewUrl)
    setImageCropDraft(null)
  }, [applyCroppedImageToBox, imageCropDraft])

  const focusImagePasteCatcher = useCallback((box: TopImageBox) => {
    setActiveImageBox(box)

    requestAnimationFrame(() => {
      const target = box === 'top1'
        ? top1PasteRef.current
        : box === 'top2'
          ? top2PasteRef.current
          : top3PasteRef.current

      if (!target) return

      target.textContent = ''
      target.focus({ preventScroll: true })

      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(target)
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
  }, [])

  const handleImageBoxKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, box: TopImageBox) => {
    if (e.key !== 'Enter' && e.key !== ' ') return

    e.preventDefault()
    openImagePicker(box)
  }, [openImagePicker])

  const handleImagePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>, box: TopImageBox) => {
    const pastedImage = getClipboardImageFile(event.clipboardData?.items)

    event.preventDefault()
    event.stopPropagation()
    setActiveImageBox(box)

    if (pastedImage) {
      applyImageToBox(box, pastedImage)
    }
  }, [applyImageToBox])

  useEffect(() => {
    const onWindowPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return

      const targetBox = hoveredImageBox || activeImageBox
      if (!targetBox) return

      const pastedImage = getClipboardImageFile(event.clipboardData?.items)
      if (!pastedImage) return

      event.preventDefault()
      applyImageToBox(targetBox, pastedImage)
    }

    window.addEventListener('paste', onWindowPaste)
    return () => window.removeEventListener('paste', onWindowPaste)
  }, [activeImageBox, applyImageToBox, hoveredImageBox])

  // Handle drag event for image boxes
  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Handle drop event for image boxes
  const handleImageDrop = (e: React.DragEvent, box: TopImageBox) => {
    e.preventDefault()
    setActiveImageBox(box)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      applyImageToBox(box, file)
    }
  }

  const buildManualCsvFile = () => {
    const cleanRows = manualRows.map((row, index) => ({ ...row, stt: String(index + 1) }))
    const missingName = cleanRows.findIndex(row => !row.full_name.trim())
    if (!thang.trim()) {
      setResult({ success: false, error: 'Vui lòng nhập tháng trước khi lưu thủ công.' })
      return null
    }
    if (missingName >= 0) {
      setResult({ success: false, error: `Top ${missingName + 1} đang thiếu họ và tên.` })
      return null
    }

    const headers = ['STT', 'Tên', 'Email', 'Khối dạy', 'Cơ sở', 'Tháng', 'Số case', 'Số học sinh', 'CR45', 'Loại/Chọn', 'Thưởng CR']
    const lines = [
      headers.join(','),
      ...cleanRows.map(row => [
        row.stt,
        row.full_name,
        row.email,
        row.khoi_day,
        row.co_so,
        thang.trim(),
        row.so_case,
        row.so_hoc_sinh,
        row.ti_le,
        row.loai,
        row.thuong_cr,
      ].map(value => csvCell(value.trim())).join(',')),
    ]
    return new File([lines.join('\n')], `vinh-danh-thu-cong-${Date.now()}.csv`, { type: 'text/csv;charset=utf-8' })
  }

  const handleSubmit = async () => {
    const sourceFile = mode === 'csv' ? file : buildManualCsvFile()
    if (!sourceFile) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', sourceFile)
      if (thang) fd.append('thang', thang)
      if (top1Image) fd.append('top1Image', top1Image)
      if (top2Image) fd.append('top2Image', top2Image)
      if (top3Image) fd.append('top3Image', top3Image)
      const res = await fetch('/api/truyenthong/vinh-danh/import', { method: 'POST', body: fd })
      const data: ImportResult = await res.json()
      setResult(data)
      if (data.success && (data.inserted ?? 0) > 0) {
        setTimeout(() => { onSuccess(data.current_month); onClose() }, 1800)
      }
    } catch {
      setResult({ success: false, error: 'Lỗi kết nối máy chủ' })
    } finally {
      setLoading(false)
    }
  }

  const top1PasteTarget = hoveredImageBox === 'top1' || activeImageBox === 'top1'
  const top2PasteTarget = hoveredImageBox === 'top2' || activeImageBox === 'top2'
  const top3PasteTarget = hoveredImageBox === 'top3' || activeImageBox === 'top3'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Cập nhật Vinh Danh Tháng</h2>
              <p className="text-xs text-gray-500">Import CSV hoặc nhập thủ công Top 1/2/3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-180px)] overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => { setMode('csv'); setResult(null) }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition-colors',
                mode === 'csv' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => { setMode('manual'); setResult(null) }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition-colors',
                mode === 'manual' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Nhập thủ công
            </button>
          </div>

          {/* Tháng override */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              {mode === 'csv' ? 'Tháng (để trống nếu file đã có cột tháng)' : 'Tháng vinh danh'}
            </label>
            <input
              type="text"
              value={thang}
              onChange={e => setThang(e.target.value)}
              placeholder="vd: 06/2025"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          {mode === 'csv' ? (
            <>
              {/* Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                  dragOver
                    ? 'border-amber-400 bg-amber-50'
                    : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/40'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                    <p className="text-sm font-bold text-green-700">{file.name}</p>
                    <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-600">Kéo thả file CSV vào đây</p>
                    <p className="text-xs text-gray-400">hoặc click để chọn file</p>
                  </div>
                )}
              </div>

              {/* CSV format hint */}
              <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold">Định dạng file CSV:</p>
                  <a
                    href="/templates/vinh-danh-mau.csv"
                    download="vinh-danh-mau.csv"
                    className="flex items-center gap-1 text-amber-700 font-bold hover:text-amber-900 hover:underline transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Tải file mẫu
                  </a>
                </div>
                <p className="text-amber-700 font-mono break-all">STT, Tên, Email, Khối dạy, Cơ sở, Tháng, Số case, Số học sinh, CR45, Loại/Chọn, Thưởng CR</p>
                <p className="text-amber-700/80">Cột cần có để import chính xác: Tên, Email, Tháng, CR45. Ảnh Top 1/2/3 upload riêng ở bên dưới.</p>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[52px_1.45fr_1.25fr_1fr_0.75fr] gap-2 bg-amber-50/70 px-3 py-2 text-[11px] font-black text-amber-800">
                <span>Top</span>
                <span>Họ tên</span>
                <span>Email</span>
                <span>Cơ sở</span>
                <span>CR45</span>
              </div>
              <div className="divide-y divide-gray-100">
                {manualRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-[52px_1.45fr_1.25fr_1fr_0.75fr] gap-2 px-3 py-3">
                    <div className="flex items-center">
                      <span className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black',
                        index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'
                      )}>
                        {index + 1}
                      </span>
                    </div>
                    <input
                      value={row.full_name}
                      onChange={e => updateManualRow(index, 'full_name', e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      value={row.email}
                      onChange={e => updateManualRow(index, 'email', e.target.value)}
                      placeholder="email@mindx.edu.vn"
                      className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      value={row.co_so}
                      onChange={e => updateManualRow(index, 'co_so', e.target.value)}
                      placeholder="Cơ sở"
                      className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      value={row.ti_le}
                      onChange={e => updateManualRow(index, 'ti_le', e.target.value)}
                      placeholder="95"
                      className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <div className="col-start-2 col-span-4 grid grid-cols-5 gap-2">
                      <input
                        value={row.khoi_day}
                        onChange={e => updateManualRow(index, 'khoi_day', e.target.value)}
                        placeholder="Khối dạy"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <input
                        value={row.so_case}
                        onChange={e => updateManualRow(index, 'so_case', e.target.value)}
                        placeholder="Số case"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <input
                        value={row.so_hoc_sinh}
                        onChange={e => updateManualRow(index, 'so_hoc_sinh', e.target.value)}
                        placeholder="Số học sinh"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <input
                        value={row.loai}
                        onChange={e => updateManualRow(index, 'loai', e.target.value)}
                        placeholder="Loại"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <input
                        value={row.thuong_cr}
                        onChange={e => updateManualRow(index, 'thuong_cr', e.target.value)}
                        placeholder="Thưởng CR"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload images for Top 3 */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-3">
            <div>
              <p className="text-xs font-bold text-gray-700">Ảnh đại diện Top 3 (tùy chọn)</p>
              <p className="mt-0.5 text-[10px] font-medium text-gray-400">Ảnh chọn hoặc dán sẽ được canh khung trước khi lưu.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* Top 1 */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-amber-700 flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Top 1 {top1PasteTarget && <span className="text-[9px] text-amber-500">— Paste ảnh tại đây</span>}
                </p>
                <div
                  role="group"
                  tabIndex={0}
                  aria-label="Vùng dán ảnh đại diện Top 1"
                  onClick={() => focusImagePasteCatcher('top1')}
                  onKeyDown={(e) => handleImageBoxKeyDown(e, 'top1')}
                  onFocus={() => focusImagePasteCatcher('top1')}
                  onMouseEnter={() => setHoveredImageBox('top1')}
                  onMouseLeave={() => setHoveredImageBox(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={(e) => handleImageDrop(e, 'top1')}
                  className={cn(
                    'relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
                    top1Preview
                      ? 'border-amber-300 bg-amber-50'
                      : top1PasteTarget
                      ? 'border-amber-400 bg-amber-100'
                      : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/40'
                  )}
                >
                  <div
                    ref={top1PasteRef}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    tabIndex={-1}
                    aria-hidden="true"
                    onPaste={(e) => handleImagePaste(e, 'top1')}
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0 outline-none caret-transparent"
                  />
                  {top1Preview ? (
                    <>
                      <img src={top1Preview} alt="Top 1" className="relative z-10 w-full h-full object-cover pointer-events-none" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openCurrentImageCropper('top1') }}
                        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-amber-200 bg-white/95 text-amber-700 shadow-sm transition hover:bg-amber-50"
                        aria-label="Crop lại ảnh Top 1"
                        title="Crop lại"
                      >
                        <Crop className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center gap-1 pointer-events-none">
                      <Upload className="w-5 h-5 text-gray-300" />
                      <span className="text-[9px] font-semibold text-gray-400">Dán ảnh</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openImagePicker('top1') }}
                    className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-200 bg-white/90 px-2 py-0.5 text-[9px] font-black text-amber-700 shadow-sm transition-colors hover:bg-white"
                  >
                    Chọn ảnh
                  </button>
                </div>
                <input
                  id="top1ImageInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const nextFile = e.target.files?.[0]
                    if (nextFile) void startTopImageCropFromFile('top1', nextFile)
                    e.currentTarget.value = ''
                  }}
                />
              </div>
              {/* Top 2 */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-600 flex items-center gap-1">
                  <Medal className="w-3 h-3" /> Top 2 {top2PasteTarget && <span className="text-[9px] text-gray-500">— Paste ảnh tại đây</span>}
                </p>
                <div
                  role="group"
                  tabIndex={0}
                  aria-label="Vùng dán ảnh đại diện Top 2"
                  onClick={() => focusImagePasteCatcher('top2')}
                  onKeyDown={(e) => handleImageBoxKeyDown(e, 'top2')}
                  onFocus={() => focusImagePasteCatcher('top2')}
                  onMouseEnter={() => setHoveredImageBox('top2')}
                  onMouseLeave={() => setHoveredImageBox(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={(e) => handleImageDrop(e, 'top2')}
                  className={cn(
                    'relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
                    top2Preview
                      ? 'border-gray-300 bg-gray-50'
                      : top2PasteTarget
                      ? 'border-gray-400 bg-gray-100'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/40'
                  )}
                >
                  <div
                    ref={top2PasteRef}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    tabIndex={-1}
                    aria-hidden="true"
                    onPaste={(e) => handleImagePaste(e, 'top2')}
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0 outline-none caret-transparent"
                  />
                  {top2Preview ? (
                    <>
                      <img src={top2Preview} alt="Top 2" className="relative z-10 w-full h-full object-cover pointer-events-none" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openCurrentImageCropper('top2') }}
                        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-sm transition hover:bg-gray-50"
                        aria-label="Crop lại ảnh Top 2"
                        title="Crop lại"
                      >
                        <Crop className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center gap-1 pointer-events-none">
                      <Upload className="w-5 h-5 text-gray-300" />
                      <span className="text-[9px] font-semibold text-gray-400">Dán ảnh</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openImagePicker('top2') }}
                    className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-gray-200 bg-white/90 px-2 py-0.5 text-[9px] font-black text-gray-600 shadow-sm transition-colors hover:bg-white"
                  >
                    Chọn ảnh
                  </button>
                </div>
                <input
                  id="top2ImageInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const nextFile = e.target.files?.[0]
                    if (nextFile) void startTopImageCropFromFile('top2', nextFile)
                    e.currentTarget.value = ''
                  }}
                />
              </div>
              {/* Top 3 */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-orange-700 flex items-center gap-1">
                  <Medal className="w-3 h-3" /> Top 3 {top3PasteTarget && <span className="text-[9px] text-orange-500">— Paste ảnh tại đây</span>}
                </p>
                <div
                  role="group"
                  tabIndex={0}
                  aria-label="Vùng dán ảnh đại diện Top 3"
                  onClick={() => focusImagePasteCatcher('top3')}
                  onKeyDown={(e) => handleImageBoxKeyDown(e, 'top3')}
                  onFocus={() => focusImagePasteCatcher('top3')}
                  onMouseEnter={() => setHoveredImageBox('top3')}
                  onMouseLeave={() => setHoveredImageBox(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={(e) => handleImageDrop(e, 'top3')}
                  className={cn(
                    'relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2',
                    top3Preview
                      ? 'border-orange-300 bg-orange-50'
                      : top3PasteTarget
                      ? 'border-orange-400 bg-orange-100'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/40'
                  )}
                >
                  <div
                    ref={top3PasteRef}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    tabIndex={-1}
                    aria-hidden="true"
                    onPaste={(e) => handleImagePaste(e, 'top3')}
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0 outline-none caret-transparent"
                  />
                  {top3Preview ? (
                    <>
                      <img src={top3Preview} alt="Top 3" className="relative z-10 w-full h-full object-cover pointer-events-none" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openCurrentImageCropper('top3') }}
                        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-orange-200 bg-white/95 text-orange-700 shadow-sm transition hover:bg-orange-50"
                        aria-label="Crop lại ảnh Top 3"
                        title="Crop lại"
                      >
                        <Crop className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center gap-1 pointer-events-none">
                      <Upload className="w-5 h-5 text-gray-300" />
                      <span className="text-[9px] font-semibold text-gray-400">Dán ảnh</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openImagePicker('top3') }}
                    className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-orange-200 bg-white/90 px-2 py-0.5 text-[9px] font-black text-orange-700 shadow-sm transition-colors hover:bg-white"
                  >
                    Chọn ảnh
                  </button>
                </div>
                <input
                  id="top3ImageInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const nextFile = e.target.files?.[0]
                    if (nextFile) void startTopImageCropFromFile('top3', nextFile)
                    e.currentTarget.value = ''
                  }}
                />
              </div>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={cn(
              'rounded-xl p-3 text-sm',
              result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            )}>
              {result.success ? (
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                  <div>
                    <p className="font-bold">Import thành công!</p>
                    <p className="text-xs mt-0.5">
                      Đã xoá {result.deleted ?? 0} bản ghi cũ của tháng này và lưu {result.inserted}/{result.total} giáo viên Top 3 mới.
                    </p>
                    {(result.source_total ?? 0) > (result.total ?? 0) && (
                      <p className="text-xs mt-1 text-green-700/80">
                        CSV có {result.source_total} dòng, hệ thống chỉ lấy 3 giáo viên vinh danh đầu bảng.
                      </p>
                    )}
                    {(result.errors?.length ?? 0) > 0 && (
                      <p className="text-xs mt-1 text-amber-700">{result.errors?.length} dòng bị bỏ qua.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <p className="font-semibold">{result.error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="mindx"
            size="sm"
            onClick={handleSubmit}
            disabled={(mode === 'csv' && !file) || loading}
            className="gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Đang lưu...
              </span>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                {mode === 'csv' ? 'Nhập dữ liệu' : 'Lưu thủ công'}
              </>
            )}
          </Button>
        </div>
      </div>
      {imageCropDraft && (
        <AvatarCropDialog
          {...imageCropDraft}
          onCancel={() => setImageCropDraft(null)}
          onSave={handleCroppedTopImage}
        />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyHonorsManager() {
  const [showImport, setShowImport] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [selectedMonth, setSelectedMonth] = useQueryState<string | null>('honorsMonth', null)
  const [viewMode, setViewMode] = useQueryState<'podium' | 'table'>('honorsView', 'podium', { values: ["podium","table"] })
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { mutate: mutateGlobal } = useSWRConfig()

  const queryKey = selectedMonth
    ? `/api/truyenthong/vinh-danh?thang=${encodeURIComponent(selectedMonth)}`
    : '/api/truyenthong/vinh-danh'

  const { data, mutate, isLoading } = useSWR<VinhDanhData>(
    showPanel ? queryKey : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const months = data?.months || []
  const currentMonth = selectedMonth || data?.current_month || ''
  const records = data?.data || []

  const handleDelete = async () => {
    if (!currentMonth) return
    if (!confirm(`Xóa toàn bộ dữ liệu vinh danh tháng ${currentMonth}?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/truyenthong/vinh-danh?thang=${encodeURIComponent(currentMonth)}`, { method: 'DELETE' })
      setSelectedMonth(null)
      mutate()
    } finally {
      setDeleting(false)
    }
  }

  const handleRefreshAvatars = async () => {
    setRefreshing(true)
    try {
      const url = currentMonth
        ? `/api/truyenthong/vinh-danh/refresh-avatars?thang=${encodeURIComponent(currentMonth)}`
        : '/api/truyenthong/vinh-danh/refresh-avatars'
      await fetch(url, { method: 'POST' })
      mutate()
    } finally {
      setRefreshing(false)
    }
  }

  const handleSaveRecord = async (
    id: number,
    values: { full_name: string; co_so: string; ti_le: string },
    avatarFile?: File | null
  ) => {
    if (avatarFile && !avatarFile.type.startsWith('image/')) {
      alert('Chỉ hỗ trợ file ảnh')
      return
    }
    const fd = new FormData()
    fd.append('id', String(id))
    fd.append('full_name', values.full_name)
    fd.append('co_so', values.co_so)
    fd.append('ti_le', values.ti_le)
    if (avatarFile) fd.append('avatar', avatarFile)
    const res = await fetch('/api/truyenthong/vinh-danh', { method: 'PATCH', body: fd })
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || 'Không thể lưu thông tin vinh danh')
    }
    mutateGlobal('/api/truyenthong/top-teachers')
    mutate()
  }

  return (
    <>
      {/* ── Trigger button ── */}
      <Button
        variant="outline"
        className="gap-2 shadow-sm font-semibold border-amber-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 text-amber-700"
        onClick={() => setShowPanel(true)}
      >
        <Trophy className="h-3.5 w-4 text-amber-600" />
        Vinh Danh Tháng
      </Button>

      {/* ── Side Panel ── */}
      {showPanel && (
        <div className="fixed inset-0 z-40 flex" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPanel(false)}
          />

          {/* Drawer */}
          <div className="relative ml-auto w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">Vinh Danh Giáo Viên Tháng</h2>
                  <p className="text-xs text-gray-500">Quản lý bảng xếp hạng vinh danh theo tháng</p>
                </div>
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                aria-label="Đóng"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
              {/* View toggle */}
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('podium')}
                  className={cn('px-3 py-1.5 text-xs font-bold transition-colors', viewMode === 'podium' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
                >
                  Top 3
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn('px-3 py-1.5 text-xs font-bold transition-colors', viewMode === 'table' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
                >
                  Bảng đầy đủ
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {currentMonth && records.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshAvatars}
                      disabled={refreshing}
                      className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-xs"
                      title="Cập nhật lại ảnh đại diện từ database"
                    >
                      <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                      Làm mới avatar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 text-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                      Xóa tháng này
                    </Button>
                  </>
                )}
                <Button
                  variant="mindx"
                  size="sm"
                  onClick={() => setShowImport(true)}
                  className="gap-1.5 text-xs"
                >
                  <Upload className="w-3 h-3" />
                  Thêm vinh danh
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                </div>
              ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                  <Trophy className="w-14 h-14 text-gray-200 mb-4" />
                  <p className="text-lg font-bold text-gray-400">Chưa có dữ liệu vinh danh</p>
                  <p className="text-sm text-gray-400 mt-1 mb-5">
                    {months.length === 0
                      ? 'Import CSV hoặc nhập thủ công để bắt đầu cập nhật bảng vinh danh'
                      : `Tháng ${currentMonth} chưa có dữ liệu`}
                  </p>
                  <Button variant="mindx" size="sm" onClick={() => setShowImport(true)} className="gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Thêm dữ liệu vinh danh
                  </Button>
                </div>
              ) : viewMode === 'podium' ? (
                <div className="px-6 py-6">
                  <div className="text-center mb-6">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                      <Trophy className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs font-black tracking-wider text-amber-700 uppercase">
                        Top Giảng Viên Tháng {currentMonth}
                      </span>
                    </span>
                  </div>
                  <PodiumPreview records={records} onSaveRecord={handleSaveRecord} />
                  {records.length > 3 && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setViewMode('table')}
                        className="text-sm text-amber-600 font-bold hover:underline flex items-center gap-1 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Xem tất cả {records.length} giáo viên
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-amber-50/60 border-b border-amber-100">
                      <tr>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-center w-14">STT</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800">Giáo viên</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800">Cơ sở</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800">Khối dạy</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-center">Case</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-center">HS</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-center">CR45</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800">Loại</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-right">Thưởng CR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {records.map((r, i) => (
                        <HonorRow key={r.id} record={r} index={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Import Dialog ── */}
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onSuccess={(importedMonth) => {
            if (importedMonth) setSelectedMonth(importedMonth)
            mutateGlobal('/api/truyenthong/top-teachers')
            mutateGlobal('/api/truyenthong/vinh-danh')
            mutate()
            setShowImport(false)
          }}
        />
      )}
    </>
  )
}
