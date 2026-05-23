'use client'

import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { LayoutGrid, Plus, Trash2, X } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

// ─── Layout definitions ──────────────────────────────────────────────────────

export interface LayoutDef {
  id: string
  label: string
  slots: number
  gridTemplate: string
  gridAreas: string[]
  aspectRatios: string[]
  /** số cột cho grid-template-columns */
  cols: number
}

export const LAYOUTS: LayoutDef[] = [
  { id: '1',       label: '1 ảnh',              slots: 1, cols: 1, gridTemplate: '"a"',                    gridAreas: ['a'],                aspectRatios: ['16/9'] },
  { id: '1+1',     label: '2 ngang',             slots: 2, cols: 2, gridTemplate: '"a b"',                  gridAreas: ['a','b'],             aspectRatios: ['1/1','1/1'] },
  { id: '1/1+1',   label: '1 trên + 2 dưới',     slots: 3, cols: 2, gridTemplate: '"a a" "b c"',            gridAreas: ['a','b','c'],         aspectRatios: ['16/7','1/1','1/1'] },
  { id: '1+2',     label: '1 lớn + 2 nhỏ phải',  slots: 3, cols: 2, gridTemplate: '"a b" "a c"',            gridAreas: ['a','b','c'],         aspectRatios: ['auto','4/3','4/3'] },
  { id: '2+1',     label: '2 nhỏ trái + 1 lớn',  slots: 3, cols: 2, gridTemplate: '"a c" "b c"',            gridAreas: ['a','b','c'],         aspectRatios: ['4/3','4/3','auto'] },
  { id: '2x2',     label: '2×2 grid',             slots: 4, cols: 2, gridTemplate: '"a b" "c d"',            gridAreas: ['a','b','c','d'],     aspectRatios: ['1/1','1/1','1/1','1/1'] },
  { id: 'big+4',   label: '1 lớn + 4 nhỏ',       slots: 5, cols: 3, gridTemplate: '"a b c" "a d e"',        gridAreas: ['a','b','c','d','e'], aspectRatios: ['auto','1/1','1/1','1/1','1/1'] },
  { id: 'mosaic5', label: 'Mosaic 5',             slots: 5, cols: 3, gridTemplate: '"a a b" "c d b" "c e e"',gridAreas: ['a','b','c','d','e'], aspectRatios: ['auto','auto','auto','1/1','auto'] },
]

// ─── SVG preview icons ────────────────────────────────────────────────────────

const LAYOUT_ICONS: Record<string, React.ReactNode> = {
  '1':       <svg viewBox="0 0 24 16" fill="none"><rect x="1" y="1" width="22" height="14" rx="1" fill="currentColor" opacity=".8"/></svg>,
  '1+1':     <svg viewBox="0 0 24 16" fill="none"><rect x="1" y="1" width="10" height="14" rx="1" fill="currentColor" opacity=".8"/><rect x="13" y="1" width="10" height="14" rx="1" fill="currentColor" opacity=".8"/></svg>,
  '1/1+1':   <svg viewBox="0 0 24 16" fill="none"><rect x="1" y="1" width="22" height="7" rx="1" fill="currentColor" opacity=".8"/><rect x="1" y="10" width="10" height="5" rx="1" fill="currentColor" opacity=".8"/><rect x="13" y="10" width="10" height="5" rx="1" fill="currentColor" opacity=".8"/></svg>,
  '1+2':     <svg viewBox="0 0 24 16" fill="none"><rect x="1" y="1" width="13" height="14" rx="1" fill="currentColor" opacity=".8"/><rect x="16" y="1" width="7" height="6" rx="1" fill="currentColor" opacity=".8"/><rect x="16" y="9" width="7" height="6" rx="1" fill="currentColor" opacity=".8"/></svg>,
  '2+1':     <svg viewBox="0 0 24 16" fill="none"><rect x="1" y="1" width="7" height="6" rx="1" fill="currentColor" opacity=".8"/><rect x="1" y="9" width="7" height="6" rx="1" fill="currentColor" opacity=".8"/><rect x="10" y="1" width="13" height="14" rx="1" fill="currentColor" opacity=".8"/></svg>,
  '2x2':     <svg viewBox="0 0 24 16" fill="none"><rect x="1" y="1" width="10" height="6" rx="1" fill="currentColor" opacity=".8"/><rect x="13" y="1" width="10" height="6" rx="1" fill="currentColor" opacity=".8"/><rect x="1" y="9" width="10" height="6" rx="1" fill="currentColor" opacity=".8"/><rect x="13" y="9" width="10" height="6" rx="1" fill="currentColor" opacity=".8"/></svg>,
  'big+4':   <svg viewBox="0 0 24 16" fill="none"><rect x="1" y="1" width="13" height="14" rx="1" fill="currentColor" opacity=".8"/><rect x="16" y="1" width="3" height="6" rx="1" fill="currentColor" opacity=".5"/><rect x="20" y="1" width="3" height="6" rx="1" fill="currentColor" opacity=".5"/><rect x="16" y="9" width="3" height="6" rx="1" fill="currentColor" opacity=".5"/><rect x="20" y="9" width="3" height="6" rx="1" fill="currentColor" opacity=".5"/></svg>,
  'mosaic5': <svg viewBox="0 0 24 16" fill="none"><rect x="1" y="1" width="13" height="6" rx="1" fill="currentColor" opacity=".8"/><rect x="16" y="1" width="7" height="14" rx="1" fill="currentColor" opacity=".8"/><rect x="1" y="9" width="7" height="6" rx="1" fill="currentColor" opacity=".8"/><rect x="10" y="9" width="4" height="6" rx="1" fill="currentColor" opacity=".5"/></svg>,
}

// ─── readFileAsDataURL ────────────────────────────────────────────────────────

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ─── SlotItem component ───────────────────────────────────────────────────────

interface SlotItemProps {
  src: string | null
  idx: number
  gridArea: string
  aspectRatio: string
  isDragOver: boolean
  isDragging: boolean
  onDragStart: (e: React.DragEvent<HTMLDivElement>, idx: number) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>, idx: number) => void
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>, idx: number) => void
  onDragEnd: () => void
  onPasteImage: (idx: number, e: React.ClipboardEvent) => void
  onOpenFilePicker: (idx: number) => void
  onRemove: (idx: number) => void
}

function SlotItem({
  src, idx, gridArea, aspectRatio,
  isDragOver, isDragging,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  onPasteImage, onOpenFilePicker, onRemove,
}: SlotItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const slotStyle: React.CSSProperties = {
    // Dùng CSS variable để set grid-area — tránh lỗi inline style với named areas
    gridArea,
    aspectRatio: aspectRatio !== 'auto' ? aspectRatio : undefined,
    minHeight: aspectRatio === 'auto' ? '160px' : undefined,
  }

  return (
    <div
      className={[
        'il-slot',
        src ? 'has-image' : 'empty',
        isDragOver ? 'drag-over' : '',
        isDragging ? 'dragging' : '',
        isHovered ? 'hovered' : '',
      ].filter(Boolean).join(' ')}
      style={slotStyle}
      draggable={!!src}
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      onDragStart={e => onDragStart(e, idx)}
      onDragOver={e => onDragOver(e, idx)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, idx)}
      onDragEnd={onDragEnd}
      // Paste ảnh khi slot đang hover/focus
      onPaste={e => onPasteImage(idx, e)}
    >
      {src ? (
        <>
          { }
          <img src={src} alt="" className="il-img" draggable={false} />
          <div className="il-slot-overlay">
            <button
              className="il-slot-btn"
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onOpenFilePicker(idx) }}
              title="Đổi ảnh"
            >↺</button>
            <button
              className="il-slot-btn il-slot-btn-del"
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onRemove(idx) }}
              title="Xóa ảnh"
            ><X className="h-3 w-3" /></button>
          </div>
          <div className="il-drag-hint">⠿ Kéo để đổi vị trí</div>
          {isHovered && (
            <div className="il-paste-hint">Ctrl+V để dán ảnh</div>
          )}
        </>
      ) : (
        <div
          className="il-slot-empty"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onOpenFilePicker(idx) }}
          onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
          onDrop={e => onDrop(e, idx)}
        >
          <Plus className="h-6 w-6 text-gray-300" />
          <span className="text-xs text-gray-400 mt-1 text-center leading-tight">
            Kéo ảnh vào<br />hoặc click chọn
          </span>
          {isHovered && (
            <span className="text-xs text-blue-400 mt-1">hoặc Ctrl+V dán ảnh</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ImageLayoutNodeView ──────────────────────────────────────────────────────

export function ImageLayoutNodeView(props: NodeViewProps) {
  const { node, updateAttributes, editor, getPos, selected } = props

  // ── Local state — KHÔNG sync trực tiếp từ node.attrs để tránh re-render loop ──
  const [layoutId, setLayoutId] = useState<string>(node.attrs.layoutId || '1+1')
  const [images, setImages] = useState<(string | null)[]>(node.attrs.images || [])
  const [showLayoutPicker, setShowLayoutPicker] = useState(false)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingSlotRef = useRef<number>(0)
  // Dùng ref để track commit timer — debounce commit vào Tiptap
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref giữ latest images để dùng trong closures
  const imagesRef = useRef(images)
  useEffect(() => {
    imagesRef.current = images
  }, [images])

  const layout = LAYOUTS.find(l => l.id === layoutId) || LAYOUTS[1]
  const slots: (string | null)[] = Array.from({ length: layout.slots }, (_, i) => images[i] ?? null)

  // ── Commit vào Tiptap — debounced 300ms để tránh trigger onChange liên tục ──
  const commitToTiptap = useCallback((newLayoutId: string, newImages: (string | null)[]) => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
    commitTimerRef.current = setTimeout(() => {
      updateAttributes({ layoutId: newLayoutId, images: newImages })
    }, 300)
  }, [updateAttributes])

  // Sync từ node.attrs vào local state CHỈ khi node thay đổi từ bên ngoài
  // (ví dụ undo/redo) — dùng JSON compare để tránh loop
  const lastCommittedRef = useRef<string>('')
  useEffect(() => {
    const incoming = JSON.stringify({ layoutId: node.attrs.layoutId, images: node.attrs.images })
    const current = JSON.stringify({ layoutId, images })
    // Chỉ sync nếu thay đổi đến từ bên ngoài (undo/redo), không phải từ local commit
    if (incoming !== lastCommittedRef.current && incoming !== current) {
      setLayoutId(node.attrs.layoutId || '1+1')
      setImages(node.attrs.images || [])
    }
  }, [node.attrs.layoutId, node.attrs.images])

  // Cleanup timer khi unmount
  useEffect(() => () => { if (commitTimerRef.current) clearTimeout(commitTimerRef.current) }, [])

  // ── Helpers ──

  const applyImages = useCallback((next: (string | null)[]) => {
    setImages(next)
    const committed = JSON.stringify({ layoutId, images: next })
    lastCommittedRef.current = committed
    commitToTiptap(layoutId, next)
  }, [layoutId, commitToTiptap])

  const applyLayout = useCallback((newId: string) => {
    const newLayout = LAYOUTS.find(l => l.id === newId)!
    const newImages = Array.from({ length: newLayout.slots }, (_, i) => imagesRef.current[i] ?? null)
    setLayoutId(newId)
    setImages(newImages)
    setShowLayoutPicker(false)
    const committed = JSON.stringify({ layoutId: newId, images: newImages })
    lastCommittedRef.current = committed
    commitToTiptap(newId, newImages)
  }, [commitToTiptap])

  // ── File input ──

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const src = await readFileAsDataURL(file)
    const next = [...imagesRef.current]
    // Pad nếu cần
    while (next.length <= pendingSlotRef.current) next.push(null)
    next[pendingSlotRef.current] = src
    applyImages(next)
    e.target.value = ''
  }, [applyImages])

  const openFilePicker = useCallback((slotIdx: number) => {
    pendingSlotRef.current = slotIdx
    fileInputRef.current?.click()
  }, [])

  const removeImage = useCallback((slotIdx: number) => {
    const next = [...imagesRef.current]
    next[slotIdx] = null
    applyImages(next)
  }, [applyImages])

  // ── Drag-drop giữa các slot (native HTML5 DnD) ──

  const onDragStartSlot = useCallback((e: React.DragEvent<HTMLDivElement>, slotIdx: number) => {
    e.stopPropagation()
    const src = imagesRef.current[slotIdx]
    if (!src) { e.preventDefault(); return }
    setDraggingSlot(slotIdx)
    e.dataTransfer.effectAllowed = 'move'
    // Encode slot index + src
    e.dataTransfer.setData('application/x-il-slot', String(slotIdx))
    e.dataTransfer.setData('application/x-il-src', src)
    // Ghost image
    const img = (e.currentTarget as HTMLElement).querySelector('img')
    if (img) e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2)
  }, [])

  const onDragOverSlot = useCallback((e: React.DragEvent<HTMLDivElement>, slotIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSlot(slotIdx)
  }, [])

  const onDragLeaveSlot = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Chỉ clear nếu rời khỏi slot thực sự (không phải vào child)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverSlot(null)
    }
  }, [])

  const onDropSlot = useCallback((e: React.DragEvent<HTMLDivElement>, toIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverSlot(null)
    setDraggingSlot(null)

    const fromSlotStr = e.dataTransfer.getData('application/x-il-slot')
    const fromSrc = e.dataTransfer.getData('application/x-il-src')

    // Swap giữa 2 slot trong cùng layout
    if (fromSlotStr !== '' && fromSrc) {
      const fromIdx = parseInt(fromSlotStr, 10)
      if (fromIdx === toIdx) return
      const next = [...imagesRef.current]
      while (next.length <= Math.max(fromIdx, toIdx)) next.push(null)
      const tmp = next[toIdx]
      next[toIdx] = next[fromIdx]
      next[fromIdx] = tmp
      applyImages(next)
      return
    }

    // Drop ảnh từ ResizableImage trong editor
    const imgPosStr = e.dataTransfer.getData('application/x-tiptap-image-pos')
    if (imgPosStr && editor) {
      const pos = parseInt(imgPosStr, 10)
      if (!Number.isFinite(pos)) return
      const imgNode = editor.state.doc.nodeAt(pos)
      if (!imgNode) return
      const src = imgNode.attrs.src as string
      const next = [...imagesRef.current]
      while (next.length <= toIdx) next.push(null)
      next[toIdx] = src
      applyImages(next)
      editor.chain().deleteRange({ from: pos, to: pos + imgNode.nodeSize }).run()
      return
    }

    // Drop file từ máy tính
    const files = e.dataTransfer.files
    if (files?.length) {
      readFileAsDataURL(files[0]).then(src => {
        const next = [...imagesRef.current]
        while (next.length <= toIdx) next.push(null)
        next[toIdx] = src
        applyImages(next)
      })
    }
  }, [applyImages, editor])

  const onDragEndSlot = useCallback(() => {
    setDraggingSlot(null)
    setDragOverSlot(null)
  }, [])

  // ── Paste ảnh vào slot khi hover (Ctrl+V) ──
  const pasteImageToSlot = useCallback(async (slotIdx: number, e: React.ClipboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const items = Array.from(e.clipboardData?.items || [])
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        const src = await readFileAsDataURL(file)
        const next = [...imagesRef.current]
        while (next.length <= slotIdx) next.push(null)
        next[slotIdx] = src
        applyImages(next)
        return
      }
    }
    // Paste URL text
    const text = e.clipboardData?.getData('text/plain') || ''
    if (text.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)/i)) {
      const next = [...imagesRef.current]
      while (next.length <= slotIdx) next.push(null)
      next[slotIdx] = text
      applyImages(next)
    }
  }, [applyImages])

  // ── Delete node ──

  const deleteNode = useCallback(() => {
    try {
      const pos = typeof getPos === 'function' ? getPos() : null
      if (typeof pos === 'number') editor?.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
    } catch { /* ignore */ }
  }, [editor, getPos, node.nodeSize])

  // ── Render ──

  return (
    <NodeViewWrapper
      className={`image-layout-node${selected ? ' selected' : ''}`}
      contentEditable={false}
      // Ngăn Tiptap bắt drag events của node này
      data-drag-handle=""
    >
      {/* Toolbar */}
      <div className="il-toolbar" onMouseDown={e => e.stopPropagation()}>
        <span className="il-toolbar-label">📐 Layout ảnh</span>
        <button
          className="il-toolbar-btn"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setShowLayoutPicker(v => !v) }}
          title="Đổi layout"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Đổi layout</span>
        </button>
        <button
          className="il-toolbar-btn il-toolbar-btn-danger"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); deleteNode() }}
          title="Xóa layout"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Layout picker */}
      {showLayoutPicker && (
        <div className="il-layout-picker-wrap" onMouseDown={e => e.stopPropagation()}>
          <div className="il-layout-picker">
            {LAYOUTS.map(l => (
              <button
                key={l.id}
                className={`il-layout-btn${layoutId === l.id ? ' active' : ''}`}
                onMouseDown={e => { e.preventDefault(); applyLayout(l.id) }}
                title={l.label}
              >
                <span className="il-preview-icon">{LAYOUT_ICONS[l.id] ?? <LayoutGrid size={14} />}</span>
                <span className="il-layout-label">{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div
        className="il-grid"
        style={{
          display: 'grid',
          gridTemplateAreas: layout.gridTemplate,
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gap: '3px',
        }}
        // Ngăn Tiptap xử lý drag trên grid
        onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
      >
        {slots.map((src, idx) => (
          <SlotItem
            key={idx}
            src={src}
            idx={idx}
            gridArea={layout.gridAreas[idx]}
            aspectRatio={layout.aspectRatios[idx]}
            isDragOver={dragOverSlot === idx}
            isDragging={draggingSlot === idx}
            onDragStart={onDragStartSlot}
            onDragOver={onDragOverSlot}
            onDragLeave={onDragLeaveSlot}
            onDrop={onDropSlot}
            onDragEnd={onDragEndSlot}
            onPasteImage={pasteImageToSlot}
            onOpenFilePicker={openFilePicker}
            onRemove={removeImage}
          />
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />
    </NodeViewWrapper>
  )
}

// ─── Tiptap Extension ────────────────────────────────────────────────────────

export const ImageLayoutExtension = TiptapNode.create({
  name: 'imageLayout',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      layoutId: {
        default: '1+1',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-layout') || '1+1',
        renderHTML: (attrs: any) => ({ 'data-layout': attrs.layoutId }),
      },
      images: {
        default: [],
        parseHTML: (el: HTMLElement) => {
          try { return JSON.parse(el.getAttribute('data-images') || '[]') } catch { return [] }
        },
        renderHTML: (attrs: any) => ({ 'data-images': JSON.stringify(attrs.images || []) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-layout"]' }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: any }) {
    const layoutId: string = HTMLAttributes['data-layout'] || '1+1'
    const images: (string | null)[] = (() => {
      try { return JSON.parse(HTMLAttributes['data-images'] || '[]') } catch { return [] }
    })()
    const layout = LAYOUTS.find(l => l.id === layoutId) || LAYOUTS[1]

    const children = layout.gridAreas.map((area, idx) => {
      const src = images[idx]
      const style = [
        `grid-area:${area}`,
        layout.aspectRatios[idx] !== 'auto' ? `aspect-ratio:${layout.aspectRatios[idx]}` : 'min-height:160px',
        'overflow:hidden',
        'border-radius:4px',
        'background:#1e293b',
      ].join(';')
      if (!src) return ['div', { style }] as [string, Record<string, string>]
      return ['div', { style }, ['img', { src, alt: '', style: 'width:100%;height:100%;object-fit:cover;display:block;' }]] as [string, Record<string, string>, [string, Record<string, string>]]
    })

    const gridStyle = [
      'display:grid',
      `grid-template-areas:${layout.gridTemplate}`,
      `grid-template-columns:repeat(${layout.cols},1fr)`,
      'gap:3px',
      'padding:4px',
      'background:#1e293b',
      'border-radius:6px',
    ].join(';')

    return [
      'div',
      mergeAttributes({
        'data-type': 'image-layout',
        'data-layout': layoutId,
        'data-images': JSON.stringify(images),
        style: gridStyle,
      }),
      ...children,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageLayoutNodeView)
  },
})
