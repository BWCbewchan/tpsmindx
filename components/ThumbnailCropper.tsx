'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Crop, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { normalizeStorageUrl } from '@/lib/storage-url'

// ─── Kiểu dữ liệu crop ───────────────────────────────────────────────────────
export interface CropData {
  // Vị trí & kích thước khung crop tính theo tỷ lệ so với ảnh rendered (0–1)
  x: number   // left của khung / imgRendered.w
  y: number   // top của khung / imgRendered.h
  w: number   // width của khung / imgRendered.w
  h: number   // height của khung / imgRendered.h
}

export function serializeCrop(data: CropData): string {
  return JSON.stringify(data)
}

export function parseCrop(raw: string | null | undefined): CropData {
  if (!raw) return { x: 0, y: 0, w: 1, h: 1 }
  try {
    if (raw.includes('%')) return { x: 0, y: 0, w: 1, h: 1 }
    const p = JSON.parse(raw)
    // Legacy formats
    if (typeof p.cx === 'number') return { x: 0, y: 0, w: 1, h: 1 }
    if (typeof p.offsetX === 'number') return { x: 0, y: 0, w: 1, h: 1 }
    if (typeof p.x === 'number') return p as CropData
  } catch {}
  return { x: 0, y: 0, w: 1, h: 1 }
}

// ─── Handle types ─────────────────────────────────────────────────────────────
type HandleDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'move'

const HANDLE_CURSOR: Record<HandleDir, string> = {
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  move: 'move',
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ThumbnailCropperProps {
  src: string
  aspectRatio?: number  // mặc định 16/9
  onSave: (cropJson: string) => void
  onCancel: () => void
  initialCrop?: string
}

const MIN_W = 80 // px tối thiểu chiều rộng khung

// ─── Component ────────────────────────────────────────────────────────────────
export default function ThumbnailCropper({
  src,
  aspectRatio = 16 / 9,
  onSave,
  onCancel,
  initialCrop,
}: ThumbnailCropperProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })

  // Khung crop tính bằng px trong canvas
  const [frame, setFrame] = useState({ x: 0, y: 0, w: 0, h: 0 })

  const dragRef = useRef<{
    dir: HandleDir
    startX: number; startY: number
    startFrame: { x: number; y: number; w: number; h: number }
  } | null>(null)

  // Load ảnh
  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = normalizeStorageUrl(src)
  }, [src])

  // Đo canvas
  useEffect(() => {
    const measure = () => {
      const el = canvasRef.current
      if (!el) return
      setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [])

  // Kích thước ảnh rendered (contain)
  const imgRendered = React.useMemo(() => {
    if (!canvasSize.w || !imgNatural.w) return { w: 0, h: 0, left: 0, top: 0 }
    const sw = canvasSize.w / imgNatural.w
    const sh = canvasSize.h / imgNatural.h
    const s = Math.min(sw, sh)
    const w = imgNatural.w * s
    const h = imgNatural.h * s
    return { w, h, left: (canvasSize.w - w) / 2, top: (canvasSize.h - h) / 2 }
  }, [canvasSize, imgNatural])

  // Khởi tạo frame từ initialCrop hoặc toàn bộ ảnh (giữ tỷ lệ)
  useEffect(() => {
    if (!imgRendered.w) return
    const crop = parseCrop(initialCrop)
    // Tính frame từ crop, enforce tỷ lệ
    let fw = crop.w * imgRendered.w
    let fh = fw / aspectRatio
    // Nếu fh vượt ảnh → thu nhỏ theo h
    if (fh > imgRendered.h) { fh = imgRendered.h; fw = fh * aspectRatio }
    const fx = imgRendered.left + crop.x * imgRendered.w
    const fy = imgRendered.top + crop.y * imgRendered.h
    setFrame(clampFrame({ x: fx, y: fy, w: fw, h: fh }))

  }, [imgRendered.w, imgRendered.h, aspectRatio])

  // Clamp frame trong bounds ảnh, giữ tỷ lệ aspectRatio
  const clampFrame = useCallback((f: typeof frame) => {
    const { left, top, w: iw, h: ih } = imgRendered
    const right = left + iw
    const bottom = top + ih

    let { x, y, w, h } = f

    // Enforce tỷ lệ: h = w / aspectRatio
    h = w / aspectRatio

    // Đảm bảo kích thước tối thiểu
    if (w < MIN_W) { w = MIN_W; h = w / aspectRatio }

    // Clamp vị trí trong bounds ảnh
    x = Math.max(left, Math.min(right - w, x))
    y = Math.max(top, Math.min(bottom - h, y))

    // Nếu sau khi clamp vị trí, kích thước vẫn tràn → thu nhỏ
    if (x + w > right) { w = right - x; h = w / aspectRatio }
    if (y + h > bottom) { h = bottom - y; w = h * aspectRatio; x = Math.max(left, Math.min(right - w, x)) }

    return { x, y, w, h }
  }, [imgRendered, aspectRatio])

  // Pointer down trên handle hoặc frame
  const handlePointerDown = useCallback((e: React.PointerEvent, dir: HandleDir) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startFrame: { ...frame },
    }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }, [frame])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { dir, startX, startY, startFrame: sf } = dragRef.current
    const dx = e.clientX - startX
    const dy = e.clientY - startY

    let { x, y, w, h } = sf

    if (dir === 'move') {
      x = sf.x + dx
      y = sf.y + dy
      // Giữ kích thước, chỉ di chuyển
      setFrame(clampFrame({ x, y, w, h }))
      return
    }

    // Resize — giữ tỷ lệ 16:9
    // Dùng delta lớn hơn (dx hoặc dy quy đổi) để tính w mới
    if (dir === 'e') {
      w = sf.w + dx
    } else if (dir === 'w') {
      w = sf.w - dx
      x = sf.x + dx
    } else if (dir === 's') {
      // Kéo cạnh dưới: tính w từ h mới
      h = sf.h + dy
      w = h * aspectRatio
    } else if (dir === 'n') {
      h = sf.h - dy
      w = h * aspectRatio
      y = sf.y + dy
      // Giữ cạnh phải cố định khi kéo cạnh trên
      x = sf.x + sf.w - w
    } else if (dir === 'se') {
      // Kéo góc se: dùng dx, tính h từ w
      w = sf.w + dx
      h = w / aspectRatio
    } else if (dir === 'sw') {
      w = sf.w - dx
      h = w / aspectRatio
      x = sf.x + dx
    } else if (dir === 'ne') {
      w = sf.w + dx
      h = w / aspectRatio
      y = sf.y + sf.h - h  // cạnh dưới cố định
    } else if (dir === 'nw') {
      w = sf.w - dx
      h = w / aspectRatio
      x = sf.x + dx
      y = sf.y + sf.h - h  // cạnh dưới cố định
    }

    setFrame(clampFrame({ x, y, w, h }))
  }, [clampFrame, aspectRatio])

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const handleSave = () => {
    if (!imgRendered.w) return
    const crop: CropData = {
      x: (frame.x - imgRendered.left) / imgRendered.w,
      y: (frame.y - imgRendered.top) / imgRendered.h,
      w: frame.w / imgRendered.w,
      h: frame.h / imgRendered.h,
    }
    onSave(serializeCrop(crop))
  }

  // Handles: 4 góc + 4 cạnh
  const handles: { dir: HandleDir; style: React.CSSProperties }[] = [
    // Góc
    { dir: 'nw', style: { top: -5, left: -5, cursor: 'nwse-resize' } },
    { dir: 'ne', style: { top: -5, right: -5, cursor: 'nesw-resize' } },
    { dir: 'sw', style: { bottom: -5, left: -5, cursor: 'nesw-resize' } },
    { dir: 'se', style: { bottom: -5, right: -5, cursor: 'nwse-resize' } },
    // Cạnh
    { dir: 'n', style: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
    { dir: 's', style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
    { dir: 'w', style: { left: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
    { dir: 'e', style: { right: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Chỉnh sửa thumbnail</h3>
          </div>
          <button type="button" onClick={onCancel}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas */}
        <div className="p-5 pb-4">
          <div
            ref={canvasRef}
            className="relative w-full bg-gray-100 rounded-xl overflow-hidden select-none"
            style={{ aspectRatio: '4/3' }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Ảnh gốc — contain */}
            { }
            <img
              src={normalizeStorageUrl(src)}
              alt="Original"
              draggable={false}
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: `${imgRendered.w}px`,
                height: `${imgRendered.h}px`,
                transform: 'translate(-50%, -50%)',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />

            {/* Overlay blur 4 vùng ngoài khung */}
            {frame.w > 0 && (() => {
              const { left: il, top: it, w: iw, h: ih } = imgRendered
              const ir = il + iw, ib = it + ih
              const fr = frame.x + frame.w, fb = frame.y + frame.h
              return (
                <>
                  {/* Top */}
                  {frame.y > it && (
                    <div style={{ position: 'absolute', left: il, top: it, width: iw, height: frame.y - it, backdropFilter: 'blur(3px)', backgroundColor: 'rgba(0,0,0,0.38)', pointerEvents: 'none' }} />
                  )}
                  {/* Bottom */}
                  {fb < ib && (
                    <div style={{ position: 'absolute', left: il, top: fb, width: iw, height: ib - fb, backdropFilter: 'blur(3px)', backgroundColor: 'rgba(0,0,0,0.38)', pointerEvents: 'none' }} />
                  )}
                  {/* Left */}
                  {frame.x > il && (
                    <div style={{ position: 'absolute', left: il, top: frame.y, width: frame.x - il, height: frame.h, backdropFilter: 'blur(3px)', backgroundColor: 'rgba(0,0,0,0.38)', pointerEvents: 'none' }} />
                  )}
                  {/* Right */}
                  {fr < ir && (
                    <div style={{ position: 'absolute', left: fr, top: frame.y, width: ir - fr, height: frame.h, backdropFilter: 'blur(3px)', backgroundColor: 'rgba(0,0,0,0.38)', pointerEvents: 'none' }} />
                  )}
                </>
              )
            })()}

            {/* Khung crop */}
            {frame.w > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: frame.x, top: frame.y,
                  width: frame.w, height: frame.h,
                  cursor: 'move',
                  boxSizing: 'border-box',
                }}
                onPointerDown={(e) => handlePointerDown(e, 'move')}
              >
                {/* Border */}
                <div className="absolute inset-0 border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />

                {/* Grid 3×3 */}
                <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.4 }}>
                  {[1, 2].map(i => (
                    <div key={`v${i}`} style={{ position: 'absolute', left: `${(i / 3) * 100}%`, top: 0, bottom: 0, width: 1, background: 'white' }} />
                  ))}
                  {[1, 2].map(i => (
                    <div key={`h${i}`} style={{ position: 'absolute', top: `${(i / 3) * 100}%`, left: 0, right: 0, height: 1, background: 'white' }} />
                  ))}
                </div>

                {/* Handles */}
                {handles.map(({ dir, style }) => (
                  <div
                    key={dir}
                    style={{
                      position: 'absolute',
                      width: dir.length === 1 ? 28 : 14,  // cạnh rộng hơn góc
                      height: dir.length === 1 ? 8 : 14,
                      ...(['n', 's'].includes(dir) ? { height: 8, width: 28 } : {}),
                      ...(['e', 'w'].includes(dir) ? { width: 8, height: 28 } : {}),
                      ...style,
                      zIndex: 10,
                    }}
                    onPointerDown={(e) => handlePointerDown(e, dir)}
                  >
                    {/* Visual handle */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'white',
                      borderRadius: dir.length === 2 ? 3 : 2,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center mt-2.5">
            Kéo khung để di chuyển · Kéo góc hoặc cạnh để thay đổi kích thước (giữ tỷ lệ 16:9) · Phần mờ sẽ không hiển thị
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onCancel}
            className="h-9 px-5 text-sm font-semibold">
            Hủy
          </Button>
          <Button type="button" onClick={handleSave}
            className="h-9 px-5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white">
            Lưu
          </Button>
        </div>
      </div>
    </div>
  )
}
