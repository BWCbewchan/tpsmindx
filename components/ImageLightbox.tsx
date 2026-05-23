'use client'

import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

interface ImageLightboxProps {
  images: { src: string; alt: string }[]
  initialIndex: number
  onClose: () => void
}

export default function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  const [current, setCurrent] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const total = images.length
  const img = images[current]

  const prev = useCallback(() => {
    setCurrent(i => (i - 1 + total) % total)
    setZoom(1); setOffset({ x: 0, y: 0 })
  }, [total])

  const next = useCallback(() => {
    setCurrent(i => (i + 1) % total)
    setZoom(1); setOffset({ x: 0, y: 0 })
  }, [total])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 4))
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  // Scroll zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.min(Math.max(z - e.deltaY * 0.001, 0.5), 4))
  }

  // Drag pan khi zoom > 1
  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const onPointerUp = () => setIsDragging(false)

  return (
    <div
      className="lightbox-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Close */}
      <button className="lightbox-close" onClick={onClose} title="Đóng (Esc)">
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      <div className="lightbox-counter">{current + 1} / {total}</div>

      {/* Zoom controls */}
      <div className="lightbox-zoom-controls">
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} title="Thu nhỏ (-)">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-xs text-white/80 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} title="Phóng to (+)">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }} className="text-xs text-white/70 hover:text-white px-1">
          Reset
        </button>
      </div>

      {/* Prev */}
      {total > 1 && (
        <button className="lightbox-nav lightbox-nav-prev" onClick={prev} title="Ảnh trước (←)">
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}

      {/* Image */}
      <div
        className="lightbox-img-wrap"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        { }
        <img
          src={img.src}
          alt={img.alt}
          className="lightbox-img"
          draggable={false}
          style={{
            transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            transition: isDragging ? 'none' : 'transform 0.15s ease',
          }}
        />
      </div>

      {/* Next */}
      {total > 1 && (
        <button className="lightbox-nav lightbox-nav-next" onClick={next} title="Ảnh tiếp (→)">
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      {/* Thumbnails */}
      {total > 1 && (
        <div className="lightbox-thumbs">
          {images.map((im, i) => (
            <button
              key={i}
              className={`lightbox-thumb${i === current ? ' active' : ''}`}
              onClick={() => { setCurrent(i); setZoom(1); setOffset({ x: 0, y: 0 }) }}
            >
              { }
              <img src={im.src} alt={im.alt} draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
