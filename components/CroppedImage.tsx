'use client'

import React, { useEffect, useRef, useState } from 'react'
import { parseCrop } from './ThumbnailCropper'
import { normalizeStorageUrl } from '@/lib/storage-url'

interface CroppedImageProps {
  src: string
  alt: string
  cropData?: string | null
  className?: string
  style?: React.CSSProperties
}

/**
 * Hiển thị đúng vùng crop đã chọn trong ThumbnailCropper.
 *
 * Ảnh gốc KHÔNG bị thay đổi — chỉ dùng CSS transform để hiển thị đúng vùng.
 * Khi mở lại modal crop, ảnh gốc vẫn đầy đủ để chỉnh lại vị trí.
 *
 * Cơ chế:
 * crop.x/y/w/h là tỷ lệ so với ảnh rendered (contain) trong modal canvas.
 * Để hiển thị vùng crop trong container:
 *   - Scale ảnh lên: scale = 1/crop.w (theo chiều ngang) hoặc 1/crop.h (theo chiều dọc)
 *   - Dịch ảnh: translateX = -crop.x * scaledImgW, translateY = -crop.y * scaledImgH
 */
export default function CroppedImage({ src, alt, cropData, className = '', style }: CroppedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })

  const crop = parseCrop(cropData)

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current
      if (!el) return
      setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!src) return
    const normalizedSrc = normalizeStorageUrl(src)
    const img = new window.Image()
    img.onload = () => setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = normalizedSrc
  }, [src])

  const imgStyle = React.useMemo((): React.CSSProperties => {
    const isFullCrop = crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1
    const hasSize = containerSize.w > 0 && imgNatural.w > 0

    if (isFullCrop || !hasSize) {
      return {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: '50% 50%',
        userSelect: 'none',
        pointerEvents: 'none',
      }
    }

    // Tỷ lệ ảnh gốc
    const imgAspect = imgNatural.w / imgNatural.h
    // Tỷ lệ container
    const containerAspect = containerSize.w / containerSize.h

    // Kích thước ảnh rendered (contain) trong modal canvas (aspect 4:3)
    // Ta không biết canvas size chính xác, nhưng tỷ lệ ảnh rendered = tỷ lệ ảnh gốc
    // crop.x/y/w/h là tỷ lệ so với imgRendered.w và imgRendered.h

    // Để hiển thị vùng crop trong container:
    // Bước 1: Tính scale để vùng crop fill container
    //   cropW_px = crop.w * imgRendered.w  →  ta cần cropW_px = containerW
    //   → imgRendered.w = containerW / crop.w
    //   → imgRendered.h = imgRendered.w / imgAspect
    //   Kiểm tra: cropH_px = crop.h * imgRendered.h, cần = containerH
    //   Nếu không khớp → dùng scale lớn hơn (cover behavior)

    const scaleByW = 1 / crop.w
    const scaleByH = (1 / crop.h) * (imgAspect / containerAspect)
    const scale = Math.max(scaleByW, scaleByH)

    // Kích thước ảnh sau scale (px)
    const scaledW = containerSize.w * scale / crop.w * crop.w  // = containerW * scale
    const scaledH = scaledW / imgAspect

    // Thực ra đơn giản hơn: ảnh rendered có width = containerW / crop.w
    const renderedW = containerSize.w / crop.w
    const renderedH = renderedW / imgAspect

    // Kiểm tra nếu renderedH * crop.h < containerH → cần scale theo H
    const renderedCropH = renderedH * crop.h
    let finalW = renderedW
    let finalH = renderedH
    if (renderedCropH < containerSize.h) {
      finalH = containerSize.h / crop.h
      finalW = finalH * imgAspect
    }

    // Offset: dịch ảnh để vùng crop.x/y nằm ở góc trên trái container
    // Thêm phần bù để căn giữa vùng crop nếu vùng đó lớn hơn container (do tỷ lệ khác nhau)
    const offsetX = -crop.x * finalW + (containerSize.w - crop.w * finalW) / 2
    const offsetY = -crop.y * finalH + (containerSize.h - crop.h * finalH) / 2

    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: `${finalW}px`,
      height: `${finalH}px`,
      transform: `translate(${offsetX}px, ${offsetY}px)`,
      userSelect: 'none',
      pointerEvents: 'none',
      objectFit: 'fill',
      maxWidth: 'none',
      maxHeight: 'none',
    }
  }, [crop, containerSize, imgNatural])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      { }
      <img
        src={normalizeStorageUrl(src) || '/placeholder.svg'}
        alt={alt}
        draggable={false}
        style={imgStyle}
      />
    </div>
  )
}
