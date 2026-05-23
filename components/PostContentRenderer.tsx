'use client'

import ImageLightbox from '@/components/ImageLightbox'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { normalizeStorageUrl } from '@/lib/storage-url'
import React, { useCallback, useMemo, useState } from 'react'

interface ImageInfo {
  src: string
  alt: string
  width: number | null
}

// ─── HTML processor ───────────────────────────────────────────────────────────

type Segment =
  | { type: 'html'; html: string }
  | { type: 'images'; images: ImageInfo[] }

function isImageOnlyElement(el: HTMLElement): boolean {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.image-wrapper').forEach(w => w.remove())
  return (clone.textContent?.trim() || '').length === 0
}

function processHTML(html: string): Segment[] {
  if (typeof window === 'undefined') return [{ type: 'html', html }]

  // Normalize tất cả src= trong HTML — chuyển Supabase public URL sang proxy URL
  const normalizedHtml = html.replace(
    /src=(["'])(https?:\/\/[^"']*supabase\.co\/storage\/v1\/object\/(?:public|sign)\/[^"']+)\1/g,
    (_match, quote, url) => `src=${quote}${normalizeStorageUrl(url)}${quote}`
  )

  const doc = new DOMParser().parseFromString(`<div id="r">${normalizedHtml}</div>`, 'text/html')
  const root = doc.getElementById('r')!

  // Wrap tất cả <table> trong div.table-scroll-wrapper để scroll ngang trên mobile
  root.querySelectorAll('table').forEach(table => {
    if (table.parentElement?.classList.contains('table-scroll-wrapper')) return
    const wrapper = doc.createElement('div')
    wrapper.className = 'table-scroll-wrapper'
    table.parentNode!.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })

  const segments: Segment[] = []
  let pendingImages: ImageInfo[] = []
  let pendingHtml = ''

  const flushImages = () => {
    if (pendingImages.length > 0) { segments.push({ type: 'images', images: [...pendingImages] }); pendingImages = [] }
  }
  const flushHtml = () => {
    if (pendingHtml.trim()) { segments.push({ type: 'html', html: pendingHtml }); pendingHtml = '' }
  }

  const extractImages = (el: HTMLElement): ImageInfo[] => {
    const result: ImageInfo[] = []
    el.querySelectorAll('.image-wrapper').forEach(wrapper => {
      const img = wrapper.querySelector('img')
      if (!img) return
      const src = img.getAttribute('src') || ''
      if (!src) return
      const dw = img.getAttribute('data-width') || ''
      const w = dw ? parseInt(dw, 10) : null
      result.push({ src, alt: img.getAttribute('alt') || '', width: Number.isFinite(w) ? w : null })
    })
    return result
  }

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent?.trim() || ''
      if (t) { flushImages(); pendingHtml += child.textContent }
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as HTMLElement
    const wrappers = el.querySelectorAll('.image-wrapper')

    if (wrappers.length > 0 && isImageOnlyElement(el)) {
      flushHtml()
      pendingImages.push(...extractImages(el))
    } else if (el.tagName === 'P' && wrappers.length > 0) {
      flushImages(); flushHtml()
      segments.push({ type: 'html', html: el.outerHTML })
    } else {
      flushImages()
      pendingHtml += el.outerHTML
    }
  }
  flushImages(); flushHtml()
  return segments
}

// ─── SmartImageGroup ──────────────────────────────────────────────────────────
// Layout giống Facebook: tối đa 4 ảnh hiển thị, ảnh cuối có overlay "+N"

const MAX_VISIBLE = 4

interface SmartImageGroupProps {
  images: ImageInfo[]
  globalOffset: number
  onOpenLightbox: (index: number) => void
}

function SmartImageGroup({ images, globalOffset, onOpenLightbox }: SmartImageGroupProps) {
  const total = images.length
  const visible = images.slice(0, MAX_VISIBLE)
  const hidden = total - MAX_VISIBLE // số ảnh bị ẩn

  // ── Layout grid dựa trên số ảnh hiển thị ──
  const n = visible.length

  const getGridStyle = (): React.CSSProperties => {
    if (n === 1) return { display: 'block' }
    if (n === 2) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }
    if (n === 3) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4px' }
    // 4 ảnh: 2x2
    return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4px' }
  }

  const getItemStyle = (idx: number): React.CSSProperties => {
    // 3 ảnh: ảnh đầu chiếm hết cột trái (2 hàng)
    if (n === 3 && idx === 0) return { gridRow: '1 / 3', gridColumn: '1 / 2' }
    return {}
  }

  const getImgHeight = (idx: number): string => {
    if (n === 1) return 'auto'
    if (n === 2) return '400px'
    if (n === 3) return idx === 0 ? '404px' : '200px'
    return '200px'
  }

  // ── Single image: hiển thị tối ưu, giữ tỷ lệ gốc, max-height hợp lý ──
  if (n === 1) {
    const img = visible[0]
    return (
      <div
        className="smart-img-group"
        style={{ margin: '12px 0', borderRadius: '10px', overflow: 'hidden', lineHeight: 0 }}
      >
        <div
          className="smart-img-item"
          style={{ position: 'relative', cursor: 'pointer', display: 'inline-block', width: '100%' }}
          onClick={() => onOpenLightbox(globalOffset)}
        >
          { }
          <img
            src={img.src}
            alt={img.alt}
            className="smart-img-thumb"
            draggable={false}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              maxHeight: '600px',
              objectFit: 'contain',
              backgroundColor: '#f3f4f6',
              borderRadius: '10px',
            }}
          />
          <div className="smart-img-hover-overlay" style={{ borderRadius: '10px' }} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="smart-img-group"
      style={{ ...getGridStyle(), margin: '12px 0', borderRadius: '8px', overflow: 'hidden' }}
    >
      {visible.map((img, idx) => {
        const isLast = idx === MAX_VISIBLE - 1
        const showOverlay = isLast && hidden > 0

        return (
          <div
            key={idx}
            className="smart-img-item"
            style={{
              ...getItemStyle(idx),
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              lineHeight: 0,
            }}
            onClick={() => onOpenLightbox(globalOffset + idx)}
          >
            { }
            <img
              src={img.src}
              alt={img.alt}
              className="smart-img-thumb"
              draggable={false}
              style={{
                width: '100%',
                height: getImgHeight(idx),
                objectFit: 'cover',
                display: 'block',
              }}
            />

            {/* Hover overlay */}
            {!showOverlay && <div className="smart-img-hover-overlay" />}

            {/* "+N" overlay trên ảnh cuối */}
            {showOverlay && (
              <div className="smart-img-more-overlay">
                <span className="smart-img-more-count">+{hidden}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PostContentRendererProps {
  html: string
  className?: string
}

export default function PostContentRenderer({ html, className = '' }: PostContentRendererProps) {
  const segments = useMemo(() => processHTML(html), [html])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Gom tất cả ảnh trong bài để lightbox navigate
  const allImages = useMemo(() => {
    const imgs: ImageInfo[] = []
    for (const seg of segments) {
      if (seg.type === 'images') imgs.push(...seg.images)
    }
    return imgs
  }, [segments])

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), [])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  // Handler click ảnh trong HTML segments (ảnh đơn, mix text+ảnh)
  const handleHtmlClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const img = target.tagName === 'IMG' ? target as HTMLImageElement : target.closest('img') as HTMLImageElement | null
    if (!img) return
    const src = img.getAttribute('src') || ''
    if (!src) return
    const idx = allImages.findIndex(im => im.src === src)
    if (idx >= 0) openLightbox(idx)
  }, [allImages, openLightbox])

  return (
    <>
      <div className={`post-content-renderer ProseMirror prose prose-xs sm:prose-sm max-w-none text-gray-900 ${className}`}>
        {segments.map((seg, i) => {
          if (seg.type === 'images') {
            const groupOffset = segments.slice(0, i).reduce(
              (count, prevSeg) =>
                count + (prevSeg.type === 'images' ? prevSeg.images.length : 0),
              0,
            )
            return (
              <SmartImageGroup
                key={i}
                images={seg.images}
                globalOffset={groupOffset}
                onOpenLightbox={openLightbox}
              />
            )
          }
          return (
            <div
              key={i}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(seg.html) }}
              onClick={handleHtmlClick}
            />
          )
        })}
      </div>

      {lightboxIndex !== null && allImages.length > 0 && (
        <ImageLightbox
          images={allImages}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </>
  )
}
