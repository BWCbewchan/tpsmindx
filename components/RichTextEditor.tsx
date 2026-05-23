'use client'

import { normalizeStorageUrl } from '@/lib/storage-url'
import { mergeAttributes, Node, type Editor as TiptapEditor } from '@tiptap/core'
import Color from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import { NodeSelection } from '@tiptap/pm/state'
import { Extension } from '@tiptap/core'
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo,
  X,
  Columns,
  Rows,
  TableProperties,
} from 'lucide-react'
import React, { memo, startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/lib/app-toast'
import { Button } from './ui/button'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  error?: string
  textColor?: string
  showToolbar?: boolean
  minHeight?: string
}

// ─── ResizableImage ──────────────────────────────────────────────────────────

function ImageFloatControls({ float, onFloat, onDelete }: {
  float: string
  onFloat: (f: string) => void
  onDelete: () => void
}) {
  return (
    <div className="img-float-controls" contentEditable={false}>
      <button className={`ifc-btn${float === 'left' ? ' active' : ''}`}
        onMouseDown={e => { e.preventDefault(); onFloat(float === 'left' ? 'none' : 'left') }} title="Float trái">◧</button>
      <button className={`ifc-btn${(!float || float === 'none') ? ' active' : ''}`}
        onMouseDown={e => { e.preventDefault(); onFloat('none') }} title="Block (không float)">▣</button>
      <button className={`ifc-btn${float === 'right' ? ' active' : ''}`}
        onMouseDown={e => { e.preventDefault(); onFloat(float === 'right' ? 'none' : 'right') }} title="Float phải">◨</button>
      <div className="ifc-sep" />
      <button className="ifc-btn ifc-del" onMouseDown={e => { e.preventDefault(); onDelete() }} title="Xóa ảnh">✕</button>
    </div>
  )
}

function ResizableImageNodeView(props: NodeViewProps) {
  const { node, selected, updateAttributes, editor, getPos } = props
  const currentWidth = typeof node.attrs.width === 'number' ? node.attrs.width : null
  const float: string = node.attrs.float || 'none'
  const verticalAlign = typeof node.attrs.verticalAlign === 'string' ? node.attrs.verticalAlign : 'text-bottom'
  const wrapperRef = useRef<HTMLSpanElement>(null)

  const getNodePos = useCallback(() => {
    try {
      const pos = typeof getPos === 'function' ? getPos() : null
      return typeof pos === 'number' ? pos : null
    } catch { return null }
  }, [getPos])

  const selectNode = useCallback(() => {
    const pos = getNodePos()
    if (pos !== null) editor?.commands?.setNodeSelection?.(pos)
  }, [editor, getNodePos])

  // ── Disable Tiptap's native drag trên parent element ──
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    // Tiptap set draggable="true" trên span.react-renderer (parent của NodeViewWrapper)
    const tiptapParent = wrapper.closest('.react-renderer') as HTMLElement | null
    if (tiptapParent) {
      tiptapParent.draggable = false
      tiptapParent.setAttribute('draggable', 'false')
    }
    // Cũng disable trên chính wrapper
    wrapper.draggable = false
  }, [])

  // ── Resize bằng pointer events ──
  const onPointerDownHandle = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    const img = wrapperRef.current?.querySelector('img') as HTMLImageElement | null
    if (!img) return
    const rect = img.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = rect.width
    const startHeight = rect.height || 1
    const aspectRatio = startWidth / startHeight
    let rafId: number | null = null
    let pendingWidth: number | null = null

    const commit = (w: number) => updateAttributes({ width: Math.max(60, Math.min(1400, Math.round(w))) })
    const onMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX
      const deltaY = ev.clientY - startY
      const nextX = (corner === 'se' || corner === 'ne') ? startWidth + deltaX : startWidth - deltaX
      const nextY = ((corner === 'se' || corner === 'sw') ? startHeight + deltaY : startHeight - deltaY) * aspectRatio
      const next = Math.abs(deltaX) > Math.abs(deltaY) ? nextX : nextY
      if (next < 60 || next > 1400) return
      pendingWidth = next
      if (rafId != null) return
      rafId = window.requestAnimationFrame(() => { rafId = null; if (pendingWidth != null) commit(pendingWidth) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      if (rafId != null) window.cancelAnimationFrame(rafId)
      if (pendingWidth != null) commit(pendingWidth)
    }
    selectNode()
    document.body.style.cursor = (corner === 'nw' || corner === 'se') ? 'nwse-resize' : 'nesw-resize'
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp, { passive: true })
  }

  // ── Drag-to-move bằng native pointer events ──
  const onPointerDownWrapper = useCallback((e: React.PointerEvent) => {
    // Chỉ xử lý chuột trái
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    // Không xử lý nếu click vào resize handle hoặc float controls
    if (target.closest('.resize-handle') || target.closest('.img-float-controls')) return

    // Chọn node ngay khi nhấn (onMouseDown) để người dùng thấy phản hồi nhanh
    selectNode()

    const startX = e.clientX
    const startY = e.clientY
    const THRESHOLD = 8 // Ngưỡng để phân biệt click và drag
    let dragging = false
    let overlay: HTMLDivElement | null = null

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY

      if (!dragging && Math.hypot(dx, dy) > THRESHOLD) {
        dragging = true
        const img = wrapperRef.current?.querySelector('img') as HTMLImageElement | null
        overlay = document.createElement('div')
        overlay.style.cssText = [
          'position:fixed', 'pointer-events:none', 'z-index:9999',
          'opacity:0.8', 'border:2px solid #3b82f6', 'border-radius:6px',
          'overflow:hidden', 'box-shadow:0 8px 24px rgba(0,0,0,0.3)',
        ].join(';')
        if (img) {
          const clone = img.cloneNode() as HTMLImageElement
          const rect = img.getBoundingClientRect()
          const w = Math.min(rect.width, 240)
          clone.style.cssText = `width:${w}px;height:auto;display:block;`
          overlay.appendChild(clone)
        }
        document.body.appendChild(overlay)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }

      if (dragging && overlay) {
        overlay.style.left = `${ev.clientX - 30}px`
        overlay.style.top = `${ev.clientY - 20}px`
      }
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (overlay) { overlay.remove(); overlay = null }

      if (!dragging) return

      if (!editor) return
      const fromPos = getNodePos()
      if (fromPos === null) return

      const state = editor.state
      const imgNode = state.doc.nodeAt(fromPos)
      if (!imgNode || imgNode.type.name !== 'image') return

      const view = editor.view
      let toPos: number | null = null

      // Tìm vị trí drop
      const coordResult = view.posAtCoords({ left: ev.clientX, top: ev.clientY })
      if (coordResult != null) toPos = coordResult.pos

      if (toPos === null) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY)
        if (el) {
          const nearestWrapper = el.closest('.image-wrapper') || el.querySelector('.image-wrapper')
          if (nearestWrapper && nearestWrapper !== wrapperRef.current) {
            try {
              const p = view.posAtDOM(nearestWrapper, 0)
              const rect = nearestWrapper.getBoundingClientRect()
              toPos = ev.clientX < rect.left + rect.width / 2 ? p : p + 1
            } catch { /* ignore */ }
          } else {
            try {
              const p = view.posAtDOM(el, 0)
              if (p > 0) toPos = p
            } catch { /* ignore */ }
          }
        }
      }

      if (toPos === null) return

      const { tr, schema } = state
      const imageType = schema.nodes.image
      if (!imageType) return

      const nodeSize = imgNode.nodeSize
      const attrs = { ...imgNode.attrs }
      
      // Thực hiện di chuyển
      tr.delete(fromPos, fromPos + nodeSize)
      const insertAt = toPos > fromPos ? Math.max(0, toPos - nodeSize) : Math.max(0, toPos)
      tr.insert(insertAt, imageType.create(attrs))
      
      // Chọn ảnh sau khi di chuyển
      const newPos = insertAt
      tr.setSelection(NodeSelection.create(tr.doc, newPos))
      
      view.dispatch(tr)
      view.focus()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
  }, [editor, getNodePos, selectNode])

  const handleFloat = (f: string) => updateAttributes({ float: f })
  const handleDelete = () => {
    const pos = getNodePos()
    if (pos !== null) editor?.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
  }

  const isFloating = float === 'left' || float === 'right'
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: isFloating ? 'block' : 'inline-block',
    maxWidth: isFloating ? '50%' : '100%',
    float: isFloating ? (float as 'left' | 'right') : undefined,
    margin: float === 'left' ? '2px 14px 8px 0' : float === 'right' ? '2px 0 8px 14px' : '4px 0',
    verticalAlign: !isFloating ? verticalAlign : undefined,
    cursor: 'grab',
    zIndex: selected ? 10 : undefined,
  }

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      as="span"
      className={`image-wrapper${selected ? ' image-wrapper-selected' : ''}${isFloating ? ` img-float-${float}` : ''}`}
      style={wrapperStyle}
      onPointerDown={onPointerDownWrapper}
    >
      {selected && <ImageFloatControls float={float} onFloat={handleFloat} onDelete={handleDelete} />}
      { }
      <img
        src={normalizeStorageUrl(node.attrs.src)} alt={node.attrs.alt || ''} title={node.attrs.title || ''}
        className="tiptap-image" draggable={false}
        style={{ width: currentWidth ? `${currentWidth}px` : undefined, height: 'auto', maxWidth: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
      />
      {selected && (
        <>
          <div className="resize-handle resize-nw" onPointerDown={onPointerDownHandle('nw')} />
          <div className="resize-handle resize-ne" onPointerDown={onPointerDownHandle('ne')} />
          <div className="resize-handle resize-sw" onPointerDown={onPointerDownHandle('sw')} />
          <div className="resize-handle resize-se" onPointerDown={onPointerDownHandle('se')} />
        </>
      )}
    </NodeViewWrapper>
  )
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      float: {
        default: 'none',
        parseHTML: (el) => el.getAttribute('data-float') || el.style.float || 'none',
        renderHTML: (attrs) => {
          const f = attrs.float
          if (!f || f === 'none') return {}
          return { 'data-float': f, style: `float:${f};margin:${f === 'left' ? '2px 14px 8px 0' : '2px 0 8px 14px'};` }
        },
      },
      verticalAlign: {
        default: 'text-bottom',
        parseHTML: (el) => el.getAttribute('data-vertical-align') || 'top',
        renderHTML: (attrs) => attrs.verticalAlign
          ? { 'data-vertical-align': attrs.verticalAlign, style: `vertical-align:${attrs.verticalAlign};` }
          : {},
      },
      width: {
        default: null,
        parseHTML: (el) => {
          const d = el.getAttribute('data-width')
          if (d) { const n = Number(d); return Number.isFinite(n) ? n : null }
          const sw = (el as HTMLElement).style?.width
          if (sw?.endsWith('px')) { const n = Number(sw.replace('px', '')); return Number.isFinite(n) ? n : null }
          return null
        },
        renderHTML: (attrs) => {
          if (!attrs.width) return {}
          const w = Number(attrs.width)
          if (!Number.isFinite(w)) return {}
          return { 'data-width': String(Math.round(w)), style: `width:${Math.round(w)}px;height:auto;` }
        },
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView, {
      as: 'span',
      update: ({ oldNode, newNode }) => oldNode.eq(newNode),
    })
  },
  renderHTML({ HTMLAttributes }) {
    // Render wrapper span + img để user view hiển thị đúng như trong editor
    const float = HTMLAttributes['data-float'] || ''
    const width = HTMLAttributes['data-width'] || ''
    const verticalAlign = HTMLAttributes['data-vertical-align'] || 'top'

    const isFloating = float === 'left' || float === 'right'

    const wrapperStyle = [
      'display:inline-block',
      'position:relative',
      'max-width:' + (isFloating ? '50%' : '100%'),
      isFloating ? `float:${float}` : '',
      float === 'left' ? 'margin:2px 14px 8px 0' : float === 'right' ? 'margin:2px 0 8px 14px' : 'margin:0 5px 5px 5px',
      !isFloating ? `vertical-align:${verticalAlign}` : '',
    ].filter(Boolean).join(';')

    const imgStyle = [
      width ? `width:${width}px` : '',
      'height:auto',
      'max-width:100%',
      'display:block',
      'border-radius:0.375rem',
    ].filter(Boolean).join(';')

    return [
      'span',
      { class: `image-wrapper${isFloating ? ` img-float-${float}` : ''}`, style: wrapperStyle },
      ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { style: imgStyle })],
    ]
  },
})

// ─── InlineIcon ──────────────────────────────────────────────────────────────

const ICON_SIZE_THRESHOLD = 36
const SOCIAL_ICON_DOMAINS = ['fbcdn.net','facebook.com','fbsbx.com','twimg.com','twitter.com','zaloapp.com','zadn.vn','emoji.slack-edge.com']

function isSocialIconSrc(src: string): boolean {
  try { return SOCIAL_ICON_DOMAINS.some(d => new URL(src).hostname.includes(d)) } catch { return false }
}

const InlineIcon = Image.extend({
  name: 'inlineIcon',
  inline: true,
  group: 'inline',
  addAttributes() {
    return { src: { default: null }, alt: { default: null }, title: { default: null }, style: { default: null }, width: { default: null }, height: { default: null } }
  },
  parseHTML() { return [{ tag: 'img[data-icon="true"]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { 'data-icon': 'true', style: HTMLAttributes.style || 'display:inline;vertical-align:text-bottom;' })]
  },
})

// ─── FontSize Extension ──────────────────────────────────────────────────────

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
      },
    }
  },
})

// ─── ImageGallery Node ───────────────────────────────────────────────────────

interface GalleryImage { src: string; alt: string }

function ImageGalleryNodeView(props: NodeViewProps) {
  const { node, updateAttributes, editor, getPos, selected } = props
  const cols: number = node.attrs.cols || 3
  const images: GalleryImage[] = node.attrs.images || []
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setCols = (c: number) => updateAttributes({ cols: c })

  const removeImage = (idx: number) => {
    const next = images.filter((_, i) => i !== idx)
    if (next.length === 0) {
      // Xóa toàn bộ gallery node
      try {
        const pos = typeof getPos === 'function' ? getPos() : null
        if (typeof pos === 'number') {
          editor?.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
        }
      } catch { /* ignore */ }
      return
    }
    updateAttributes({ images: next })
  }

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return
    const newImgs: GalleryImage[] = []
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    try {
      toast.loading('Dang tai anh len...', { id: 'gallery-upload' })
      for (const file of imageFiles) {
        const src = await uploadQuestionImageFile(file)
        newImgs.push({ src, alt: file.name })
      }
      updateAttributes({ images: [...images, ...newImgs] })
      toast.success('Da them anh vao gallery', { id: 'gallery-upload' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Khong the tai anh len', { id: 'gallery-upload' })
      return
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Drag-drop reorder trong gallery
  const onDragStartItem = (e: React.DragEvent, idx: number) => {
    e.stopPropagation()
    setDraggingIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
  const onDragOverItem = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIdx(idx)
  }
  const onDropItem = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    const fromIdx = draggingIdx
    setDragOverIdx(null)
    setDraggingIdx(null)
    if (fromIdx === null || fromIdx === toIdx) return
    const next = [...images]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    updateAttributes({ images: next })
  }
  const onDragEnd = () => { setDragOverIdx(null); setDraggingIdx(null) }

  // Drop ảnh từ ngoài vào gallery
  const onDropExternal = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverIdx(null)
    const files = e.dataTransfer.files
    if (files?.length) { addImages(files); return }
    // Drop ảnh từ editor (ResizableImage)
    const imgPos = e.dataTransfer.getData('application/x-tiptap-image-pos')
    if (imgPos && editor) {
      const pos = parseInt(imgPos, 10)
      if (!Number.isFinite(pos)) return
      const node2 = editor.state.doc.nodeAt(pos)
      if (node2?.type.name === 'image') {
        updateAttributes({ images: [...images, { src: node2.attrs.src || '', alt: node2.attrs.alt || '' }] })
        editor.chain().deleteRange({ from: pos, to: pos + node2.nodeSize }).run()
      }
    }
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: '6px',
  }

  return (
    <NodeViewWrapper
      className={`image-gallery-node${selected ? ' image-gallery-selected' : ''}`}
      contentEditable={false}
      onDragOver={(e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }}
      onDrop={onDropExternal}
    >
      {/* Toolbar nổi */}
      <div className="image-gallery-toolbar">
        <span className="text-xs text-gray-500 font-medium">🖼 Gallery</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Cột:</span>
          {[2, 3, 4].map(c => (
            <button
              key={c}
              onClick={() => setCols(c)}
              className={`gallery-col-btn${cols === c ? ' active' : ''}`}
            >{c}</button>
          ))}
        </div>
        <button
          className="gallery-add-btn"
          title="Thêm ảnh"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="h-3 w-3" /> Thêm ảnh
        </button>
        <button
          className="gallery-delete-btn"
          title="Xóa gallery"
          onClick={() => {
            try {
              const pos = typeof getPos === 'function' ? getPos() : null
              if (typeof pos === 'number') editor?.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
            } catch { /* ignore */ }
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addImages(e.target.files)} />
      </div>

      {/* Grid ảnh */}
      <div style={gridStyle} className="image-gallery-grid">
        {images.map((img, idx) => (
          <div
            key={idx}
            className={`image-gallery-item${dragOverIdx === idx ? ' drag-over' : ''}${draggingIdx === idx ? ' dragging' : ''}`}
            draggable
            onDragStart={e => onDragStartItem(e, idx)}
            onDragOver={e => onDragOverItem(e, idx)}
            onDrop={e => onDropItem(e, idx)}
            onDragEnd={onDragEnd}
          >
            { }
            <img src={normalizeStorageUrl(img.src)} alt={img.alt} className="gallery-img" draggable={false} />
            <div className="gallery-item-overlay">
              <GripVertical className="h-4 w-4 text-white opacity-70" />
              <button className="gallery-remove-btn" onClick={() => removeImage(idx)} title="Xóa ảnh">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {/* Drop zone thêm ảnh */}
        <div
          className="image-gallery-dropzone"
          onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); addImages(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="h-5 w-5 text-gray-400" />
          <span className="text-xs text-gray-400">Thêm / kéo ảnh</span>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

const ImageGalleryExtension = Node.create({
  name: 'imageGallery',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      cols: { default: 3 },
      images: { default: [] },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-gallery"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const cols = HTMLAttributes.cols || 3
    const images: GalleryImage[] = HTMLAttributes.images || []
    const children: [string, Record<string, string>][] = images.map(img => [
      'img',
      { src: normalizeStorageUrl(img.src), alt: img.alt || '', style: 'width:100%;height:160px;object-fit:cover;border-radius:4px;' },
    ])
    return [
      'div',
      mergeAttributes({ 'data-type': 'image-gallery', 'data-cols': String(cols), style: `display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:8px;` }),
      ...children,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGalleryNodeView, {
      update: ({ oldNode, newNode }) => oldNode.eq(newNode),
    })
  },
})

// ─── sanitizePastedHTML ──────────────────────────────────────────────────────

function sanitizePastedHTML(html: string): string {
  if (typeof window === 'undefined') return html
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body

  // 1. Xử lý icon/emoji: chỉ các <img> nhỏ từ mạng xã hội
  body.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || ''
    const w = parseInt(img.getAttribute('width') || img.style.width || '0', 10)
    const h = parseInt(img.getAttribute('height') || img.style.height || '0', 10)
    const alt = img.getAttribute('alt') || ''
    const isEmojiClass = img.classList.contains('img') || img.classList.contains('emoji') || img.classList.contains('emoticon') || img.getAttribute('role') === 'img'
    const isSmallIcon = (w > 0 && w <= ICON_SIZE_THRESHOLD) || (h > 0 && h <= ICON_SIZE_THRESHOLD)
    const hasEmojiAlt = alt.length > 0 && /\p{Emoji}/u.test(alt)
    const isEmojiSrc = /emoji|sticker|emoticon/i.test(src)
    const isIcon = isEmojiClass || isSmallIcon || (isSocialIconSrc(src) && isSmallIcon) || isEmojiSrc

    if (isIcon || hasEmojiAlt) {
      if (hasEmojiAlt && alt) {
        img.parentNode?.replaceChild(doc.createTextNode(alt), img)
        return
      }
      img.style.display = 'inline'
      img.style.verticalAlign = 'text-bottom'
      img.style.width = w > 0 ? `${w}px` : '1.2em'
      img.style.height = h > 0 ? `${h}px` : '1.2em'
      img.style.margin = '0 1px'
      img.style.borderRadius = '0'
      img.removeAttribute('class')
      img.setAttribute('data-icon', 'true')
    }
  })

  // 2. Normalize table — giữ nguyên cấu trúc, chỉ fix style
  body.querySelectorAll('table').forEach((table) => {
    table.removeAttribute('width')
    table.style.width = '100%'
    table.style.maxWidth = '100%'
    table.style.tableLayout = 'auto' // Chuyển sang auto để bảng có thể co lại linh hoạt hơn
    table.style.borderCollapse = 'collapse'
    table.style.fontSize = '0.85em' // Giảm nhẹ font size mặc định của bảng để dễ hiển thị toàn bộ
    table.removeAttribute('cellpadding')
    table.removeAttribute('cellspacing')
    table.removeAttribute('border')

    const firstRow = table.querySelector('tr')
    if (firstRow && firstRow.querySelectorAll('th').length > 0 && !table.querySelector('thead')) {
      const thead = doc.createElement('thead')
      firstRow.parentNode?.insertBefore(thead, firstRow)
      thead.appendChild(firstRow)
    }

    table.querySelectorAll('td, th').forEach((cell) => {
      const el = cell as HTMLElement
      el.removeAttribute('width')
      el.style.width = 'auto' 
      el.style.border = '1px solid #d1d5db'
      el.style.padding = '4px 8px' // Giảm padding để tiết kiệm diện tích
      el.style.wordBreak = 'normal' // Ưu tiên giữ chữ trên cùng hàng nếu có thể
      el.style.verticalAlign = 'top'
      el.removeAttribute('bgcolor')
      el.removeAttribute('valign')
    })

    table.querySelectorAll('tr').forEach((row) => {
      row.removeAttribute('bgcolor')
      row.removeAttribute('height')
    })
  })

  // KHÔNG xóa style/class của p, span, div — giữ nguyên cấu trúc để
  // Tiptap parse đúng paragraph, xuống dòng, bold, italic...

  return body.innerHTML
}

// Stable extension list — must not be recreated per render (useEditor deps: [])
const EDITOR_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  ResizableImage.configure({ inline: true, allowBase64: true, HTMLAttributes: { class: 'tiptap-image' } }),
  InlineIcon.configure({ inline: true, allowBase64: false }),
  ImageGalleryExtension,
  Table.configure({ resizable: true, HTMLAttributes: { class: 'tiptap-table' } }),
  TableRow,
  TableHeader.configure({ HTMLAttributes: { class: 'tiptap-th' } }),
  TableCell.configure({ HTMLAttributes: { class: 'tiptap-td' } }),
  Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-500 underline hover:text-blue-700' } }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyle,
  FontSize,
  Color,
]

function normalizeEditorHtml(html: string): string {
  const trimmed = (html || '').trim()
  if (
    trimmed === '' ||
    trimmed === '<p></p>' ||
    trimmed === '<p><br></p>' ||
    trimmed === '<p><br class="ProseMirror-trailingBreak"></p>'
  ) {
    return ''
  }
  return trimmed
}

function editorHtmlMatches(a: string, b: string): boolean {
  if (a === b) return true
  return normalizeEditorHtml(a) === normalizeEditorHtml(b)
}

async function uploadQuestionImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Chi ho tro dinh dang anh')
  if (file.size > 10 * 1024 * 1024) throw new Error('Kich thuoc anh toi da 10MB')

  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch('/api/upload-question-image', {
    method: 'POST',
    body: formData,
  })
  const data = await response.json()
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Upload anh that bai')
  }
  return data.url as string
}

// ─── Main Component ──────────────────────────────────────────────────────────

function RichTextEditor({
  content,
  onChange,
  error,
  textColor = '#000000',
  showToolbar = true,
  minHeight = 'min-h-[300px]',
}: RichTextEditorProps) {
  const [selectedImageWidth, setSelectedImageWidth] = useState<string>('auto')
  const [selectedImageAlign, setSelectedImageAlign] = useState<string>('text-bottom')
  const [selectedImageFloat, setSelectedImageFloat] = useState<string>('none')
  const [showImageControls, setShowImageControls] = useState(false)
  const lastEmittedHtmlRef = useRef<string>('')
  const isComposingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const editorRef = useRef<TiptapEditor | null>(null)
  const initialContentRef = useRef(content || '')
  const hasHydratedInitialContentRef = useRef(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const uploadImageFile = useCallback(async (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) throw new Error('Chỉ hỗ trợ định dạng ảnh')
    if (file.size > 10 * 1024 * 1024) throw new Error('Kích thước ảnh tối đa 10MB')

    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch('/api/upload-question-image', {
      method: 'POST',
      body: formData,
    })
    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Upload ảnh thất bại')
    }
    return data.url as string
  }, [])

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      extensions: EDITOR_EXTENSIONS,
      content: '',
      editorProps: {
        attributes: {
          class: `prose prose-xs sm:prose-sm max-w-none focus:outline-none ${minHeight} px-4 py-3 ${error ? 'border-red-500' : ''}`,
          spellcheck: 'false',
          autocorrect: 'off',
          autocapitalize: 'off',
          autocomplete: 'off',
        },
        handleDOMEvents: {
          compositionstart: () => {
            isComposingRef.current = true
            return false
          },
          compositionend: () => {
            isComposingRef.current = false
            return false
          },
          compositionupdate: () => {
            isComposingRef.current = true
            return false
          },
        },
        handlePaste: (_view, event) => {
          const activeEditor = editorRef.current
          if (!activeEditor) return false

          const typeList = event.clipboardData?.types ? Array.from(event.clipboardData.types) : []
          const items = event.clipboardData?.items

          if (items?.length) {
            for (const item of Array.from(items)) {
              if (!item.type.startsWith('image/')) continue
              const file = item.getAsFile()
              if (!file) continue
              event.preventDefault()
              ;(async () => {
                try {
                  toast.loading('Đang xử lý ảnh...', { id: 'img-upload' })
                  const url = await uploadImageFile(file)
                  const { tr } = activeEditor.state
                  const node = activeEditor.state.schema.nodes.image.create({ src: url, alt: file.name || 'image' })
                  const insertPos = activeEditor.state.selection.from
                  tr.replaceSelectionWith(node)
                  tr.setSelection(NodeSelection.create(tr.doc, insertPos))
                  activeEditor.view.dispatch(tr)
                  activeEditor.view.focus()
                  toast.success('Đã chèn ảnh', { id: 'img-upload' })
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Không thể xử lý ảnh', { id: 'img-upload' })
                }
              })()
              return true
            }
          }

          if (typeList.includes('text/html')) {
            const html = event.clipboardData?.getData('text/html') || ''
            const sanitized = sanitizePastedHTML(html)
            if (sanitized) {
              event.preventDefault()
              activeEditor.commands.insertContent(sanitized, { parseOptions: { preserveWhitespace: 'full' } })
              return true
            }
            return false
          }

          return false
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false
          const activeEditor = editorRef.current
          if (!activeEditor) return false

          const files = Array.from(event.dataTransfer?.files || [])
          const imageFile = files.find(f => f.type.startsWith('image/'))
          if (imageFile) {
            event.preventDefault()
            const insertPos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? activeEditor.state.selection.from
            ;(async () => {
              try {
                toast.loading('Đang xử lý ảnh...', { id: 'img-upload' })
                const url = await uploadImageFile(imageFile)
                const { tr } = activeEditor.state
                const node = activeEditor.state.schema.nodes.image.create({ src: url, alt: imageFile.name || 'image' })
                tr.insert(insertPos, node)
                tr.setSelection(NodeSelection.create(tr.doc, insertPos))
                activeEditor.view.dispatch(tr)
                activeEditor.view.focus()
                toast.success('Đã chèn ảnh', { id: 'img-upload' })
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Không thể xử lý ảnh', { id: 'img-upload' })
              }
            })()
            return true
          }

          return false
        },
      },
    },
    [],
  )

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          class: `prose prose-xs sm:prose-sm max-w-none focus:outline-none ${minHeight} px-4 py-3 ${error ? 'border-red-500' : ''}`,
          spellcheck: 'false',
          autocorrect: 'off',
          autocapitalize: 'off',
          autocomplete: 'off',
        },
      },
    })
  }, [editor, minHeight, error])

  // Hydrate initial HTML once (prop is not bound into useEditor to avoid remount loops)
  useEffect(() => {
    if (!editor || hasHydratedInitialContentRef.current) return
    const initial = initialContentRef.current
    hasHydratedInitialContentRef.current = true
    lastEmittedHtmlRef.current = initial
    if (!initial) return

    queueMicrotask(() => {
      if (editor.isDestroyed) return
      startTransition(() => {
        if (!editor.isDestroyed && !editorHtmlMatches(editor.getHTML(), initial)) {
          editor.commands.setContent(initial, { emitUpdate: false })
        }
      })
    })
  }, [editor])

  useEffect(() => {
    if (!editor) return

    const emitHtmlToParent = () => {
      if (editor.isDestroyed) return
      const html = editor.getHTML()
      lastEmittedHtmlRef.current = html
      queueMicrotask(() => {
        if (!editor.isDestroyed) {
          onChangeRef.current(html)
        }
      })
    }

    const handleUpdate = () => {
      if (editor.isDestroyed) return
      if (isComposingRef.current || editor.view.composing) return
      emitHtmlToParent()
    }

    const handleCompositionEnd = () => {
      isComposingRef.current = false
      if (editor.view.composing) return
      emitHtmlToParent()
    }

    const handleSelectionUpdate = () => {
      if (editor.isDestroyed) return
      const sel = editor.state.selection
      const isImage = sel instanceof NodeSelection && sel.node.type.name === 'image'

      if (isImage) {
        const w = sel.node.attrs.width
        const width = typeof w === 'number' && Number.isFinite(w) ? `${Math.round(w)}px` : 'auto'
        const align = sel.node.attrs.verticalAlign
        const alignVal = typeof align === 'string' && align ? align : 'top'
        const f = sel.node.attrs.float
        const floatVal = typeof f === 'string' && f ? f : 'none'

        setShowImageControls(true)
        setSelectedImageWidth(width)
        setSelectedImageAlign(alignVal)
        setSelectedImageFloat(floatVal)
      } else {
        setShowImageControls(false)
      }
    }

    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleSelectionUpdate)

    const editorDom = editor.view.dom
    editorDom.addEventListener('compositionend', handleCompositionEnd)

    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleSelectionUpdate)
      editorDom.removeEventListener('compositionend', handleCompositionEnd)
    }
  }, [editor])

  // External content only — skip echoes from onChange and never overwrite while focused / composing
  useEffect(() => {
    if (!editor || content === undefined || content === null) return
    if (editorHtmlMatches(content, lastEmittedHtmlRef.current)) return
    if (isComposingRef.current || editor.view.composing) return
    if (editor.isFocused) return

    const rafId = requestAnimationFrame(() => {
      if (
        editor.isDestroyed ||
        isComposingRef.current ||
        editor.view.composing ||
        editor.isFocused ||
        editorHtmlMatches(editor.getHTML(), content)
      ) {
        return
      }

      startTransition(() => {
        if (
          !editor.isDestroyed &&
          !isComposingRef.current &&
          !editor.view.composing &&
          !editor.isFocused &&
          !editorHtmlMatches(editor.getHTML(), content)
        ) {
          editor.commands.setContent(content, { emitUpdate: false })
          lastEmittedHtmlRef.current = content
        }
      })
    })

    return () => cancelAnimationFrame(rafId)
  }, [content, editor])

  useEffect(() => {
    setShowImageControls(false)
  }, [editor])

  // Smart image layout: CSS-only approach, không touch DOM trực tiếp
  // Layout được xử lý hoàn toàn qua CSS class trên paragraph

  const uploadImage = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !editor) return
      try {
        toast.loading('Đang xử lý ảnh...', { id: 'img-upload' })
        const url = await uploadImageFile(file)
        
        const { tr } = editor.state
        const node = editor.state.schema.nodes.image.create({ src: url, alt: file.name || 'image' })
        const insertPos = editor.state.selection.from
        tr.replaceSelectionWith(node)
        tr.setSelection(NodeSelection.create(tr.doc, insertPos))
        editor.view.dispatch(tr)
        editor.view.focus()
        
        toast.success('Đã chèn ảnh', { id: 'img-upload' })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không thể xử lý ảnh', { id: 'img-upload' })
      }
    }
    input.click()
  }, [editor, uploadImageFile])

  const insertGallery = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertContent({
      type: 'imageGallery',
      attrs: { cols: 3, images: [] },
    }).run()
    toast('Đã tạo gallery — kéo ảnh vào hoặc nhấn "+ Thêm ảnh"', { id: 'gallery' })
  }, [editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('Nhập URL:', prev)
    if (url === null) return
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const deleteImage = useCallback(() => {
    if (!editor) return
    editor.chain().focus().deleteSelection().run()
    setShowImageControls(false)
  }, [editor])

  const setImageVerticalAlign = useCallback((align: string) => {
    if (!editor) return
    editor.chain().focus().updateAttributes('image', { verticalAlign: align }).run()
    setSelectedImageAlign(align)
  }, [editor])

  const applyAlignToAllSelectedImages = useCallback((align: string) => {
    if (!editor || !align) return
    const { state } = editor
    const { from, to } = state.selection
    const { tr, doc, schema } = state
    const imageType = schema.nodes.image
    if (!imageType) return
    let changed = false
    doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === imageType) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, verticalAlign: align }); changed = true }
    })
    if (changed) { editor.view.dispatch(tr); toast.success(`Đã căn ${align}`, { id: 'bulk-align' }) }
    else toast('Không tìm thấy ảnh nào trong vùng bôi đen', { id: 'bulk-align' })
  }, [editor])

  if (!editor) return null

  return (
    <div className={`overflow-hidden ${error ? 'border-red-500 shadow-sm shadow-red-100' : ''}`}>

      {/* Image Controls */}
      {showImageControls && (
        <div className="image-controls-panel bg-blue-50 border-b border-blue-200 p-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-blue-900">📐 Resize góc · Kéo để di chuyển</span>
          <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">{selectedImageWidth}</span>

          {/* Float layout */}
          <div className="flex items-center gap-1 border-l border-blue-200 pl-2">
            <span className="text-xs text-blue-700">Layout:</span>
            {[
              { val: 'left',  label: '◧', title: 'Float trái — text wrap phải' },
              { val: 'none',  label: '▣', title: 'Block — chiếm toàn bộ chiều rộng' },
              { val: 'right', label: '◨', title: 'Float phải — text wrap trái' },
            ].map(({ val, label, title }) => (
              <button key={val} title={title}
                className={`ifc-btn-toolbar${selectedImageFloat === val ? ' active' : ''}`}
                onClick={() => {
                  editor.chain().focus().updateAttributes('image', { float: val }).run()
                  setSelectedImageFloat(val)
                }}
              >{label}</button>
            ))}
          </div>

          {/* Vertical align — chỉ khi không float */}
          {selectedImageFloat === 'none' && (
            <div className="flex items-center gap-1 border-l border-blue-200 pl-2">
              <span className="text-xs text-blue-700">Căn dọc:</span>
              <select value={selectedImageAlign}
                onChange={e => { editor.chain().focus().updateAttributes('image', { verticalAlign: e.target.value }).run(); setSelectedImageAlign(e.target.value) }}
                className="h-7 rounded border border-blue-200 bg-white/90 px-1.5 text-xs text-blue-900">
                <option value="top">Trên</option>
                <option value="middle">Giữa</option>
                <option value="bottom">Dưới</option>
                <option value="text-bottom">Chân chữ</option>
              </select>
            </div>
          )}

          <Button type="button" size="sm" variant="ghost"
            onClick={() => { editor.chain().focus().deleteSelection().run(); setShowImageControls(false) }}
            className="h-7 w-7 p-0 cursor-pointer hover:bg-red-100 hover:text-red-600 ml-auto" title="Xóa ảnh">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <button onClick={() => setShowImageControls(false)} className="text-xs text-blue-500 hover:text-blue-700">✕</button>
        </div>
      )}

      {/* Toolbar */}
      {showToolbar && (
        <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1">

          {/* Text Formatting */}
          <div className="flex gap-1 pr-2 border-r border-gray-300">
            <Button type="button" size="sm" variant={editor.isActive('bold') ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleBold().run()} className="h-8 w-8 p-0 cursor-pointer" title="Bold">
              <Bold className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive('italic') ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleItalic().run()} className="h-8 w-8 p-0 cursor-pointer" title="Italic">
              <Italic className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive('underline') ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleUnderline().run()} className="h-8 w-8 p-0 cursor-pointer" title="Underline">
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive('code') ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleCode().run()} className="h-8 w-8 p-0 cursor-pointer" title="Code">
              <Code className="h-4 w-4" />
            </Button>
          </div>

          {/* Headings */}
          <div className="flex gap-1 pr-2 border-r">
            <Button type="button" size="sm" variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="h-8 w-8 p-0 cursor-pointer" title="H1">
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="h-8 w-8 p-0 cursor-pointer" title="H2">
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className="h-8 w-8 p-0 cursor-pointer" title="H3">
              <Heading3 className="h-4 w-4" />
            </Button>
          </div>

          {/* Lists */}
          <div className="flex gap-1 pr-2 border-r">
            <Button type="button" size="sm" variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleBulletList().run()} className="h-8 w-8 p-0 cursor-pointer" title="Bullet List">
              <List className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleOrderedList().run()} className="h-8 w-8 p-0 cursor-pointer" title="Ordered List">
              <ListOrdered className="h-4 w-4" />
            </Button>
          </div>

          {/* Alignment */}
          <div className="flex gap-1 pr-2 border-r">
            <Button type="button" size="sm" variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().setTextAlign('left').run()} className="h-8 w-8 p-0 cursor-pointer" title="Align Left">
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().setTextAlign('center').run()} className="h-8 w-8 p-0 cursor-pointer" title="Align Center">
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().setTextAlign('right').run()} className="h-8 w-8 p-0 cursor-pointer" title="Align Right">
              <AlignRight className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()} className="h-8 w-8 p-0 cursor-pointer" title="Justify">
              <AlignJustify className="h-4 w-4" />
            </Button>
          </div>

          {/* Insert: Image, Link, Quote, HR */}
          <div className="flex gap-1 pr-2 border-r">
            <Button type="button" size="sm" variant="ghost" onClick={uploadImage} className="h-8 w-8 p-0 cursor-pointer" title="Chèn ảnh đơn">
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive('link') ? 'default' : 'ghost'}
              onClick={setLink} className="h-8 w-8 p-0 cursor-pointer" title="Link">
              <LinkIcon className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().toggleBlockquote().run()} className="h-8 w-8 p-0 cursor-pointer" title="Quote">
              <Quote className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost"
              onClick={() => editor.chain().focus().setHorizontalRule().run()} className="h-8 w-8 p-0 cursor-pointer" title="Horizontal Line">
              <Minus className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="flex gap-1 pr-2 border-r">
            <Button type="button" size="sm" variant={editor.isActive('table') ? 'default' : 'ghost'}
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className="h-8 w-8 p-0 cursor-pointer" title="Thêm Bảng">
              <TableIcon className="h-4 w-4" />
            </Button>
            {editor.isActive('table') && (
              <div className="flex items-center bg-blue-50/50 rounded-md border border-blue-100 p-0.5 gap-0.5 ml-1">
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="h-7 px-2 text-[10px] text-blue-700 hover:bg-blue-100 cursor-pointer">+Cột</Button>
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="h-7 px-2 text-[10px] text-blue-700 hover:bg-blue-100 cursor-pointer">+Dòng</Button>
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="h-7 px-2 text-[10px] text-orange-600 hover:bg-orange-100 cursor-pointer" title="Xóa các cột đang chọn">-Cột</Button>
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="h-7 px-2 text-[10px] text-orange-600 hover:bg-orange-100 cursor-pointer" title="Xóa các hàng đang chọn">-Dòng</Button>
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="h-7 px-2 text-[10px] text-red-600 hover:bg-red-100 cursor-pointer">Xóa</Button>
              </div>
            )}
          </div>

          {/* Text Color */}
          <div className="flex gap-1 pr-2 border-r">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground px-1">Màu:</span>
              <input type="color" value={editor.getAttributes('textStyle').color || textColor}
                onChange={e => editor?.chain().focus().setColor(e.target.value).run()}
                className="h-8 w-10 rounded cursor-pointer border border-border" title="Text Color" />
            </div>
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-1 pr-2 border-r">
            <span className="text-xs text-muted-foreground px-1 whitespace-nowrap">Cỡ chữ:</span>
            <select
              className="h-8 px-1.5 py-0 text-xs border border-input rounded bg-background hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-ring min-w-[70px] cursor-pointer"
              value={editor.getAttributes('textStyle').fontSize || ''}
              onChange={(e) => {
                const size = e.target.value
                if (!editor) return
                if (size === '') {
                  editor.chain().focus().unsetFontSize().run()
                } else {
                  editor.chain().focus().setFontSize(size).run()
                }
              }}
            >
              <option value="">Mặc định</option>
              {['10px', '11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px', '28px', '32px', '36px'].map(size => (
                <option key={size} value={size}>{size.replace('px', '')}</option>
              ))}
            </select>
          </div>

          {/* Undo/Redo */}
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()} className="h-8 w-8 p-0 cursor-pointer" title="Undo">
              <Undo className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()} className="h-8 w-8 p-0 cursor-pointer" title="Redo">
              <Redo className="h-4 w-4" />
            </Button>
          </div>

        </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} className="bg-background" />

      {/* {showSlashMenu && (
        <div className="absolute left-4 top-16 z-40 w-90 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-2xl">
          <div className="mb-2 px-2 text-sm font-semibold text-gray-700">Insert block...</div>
          <div className="space-y-1">
            {filteredSlashCommands.length === 0 ? (
              <div className="rounded-md px-2 py-2 text-sm text-gray-500">Không tìm thấy block phù hợp</div>
            ) : (
              filteredSlashCommands.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => executeSlashCommand(item)}
                  className="w-full rounded-md px-2 py-2 text-left hover:bg-gray-100"
                >
                  <div className="text-sm font-medium text-gray-800">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {showEmbedDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeEmbedDialog}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Nhúng liên kết</h3>
              <p className="mt-1 text-sm text-gray-500">Nhập URL để chèn link embed vào nội dung</p>
            </div>

            <div className="px-5 py-4">
              <input
                type="url"
                value={embedUrlValue}
                onChange={(event) => setEmbedUrlValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitEmbedUrl()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeEmbedDialog()
                  }
                }}
                autoFocus
                placeholder="https://example.com"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={closeEmbedDialog}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={submitEmbedUrl}
                className="rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#830018]"
              >
                Chèn link
              </button>
            </div>
          </div>
        </div>
      )}

      {showLinkDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeLinkDialog}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Thêm liên kết</h3>
              <p className="mt-1 text-sm text-gray-500">Để trống rồi bấm cập nhật để gỡ liên kết hiện tại</p>
            </div>

            <div className="px-5 py-4">
              <input
                type="url"
                value={linkUrlValue}
                onChange={(event) => setLinkUrlValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitLinkDialog()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeLinkDialog()
                  }
                }}
                autoFocus
                placeholder="https://example.com"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={closeLinkDialog}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={submitLinkDialog}
                className="rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#830018]"
              >
                Cập nhật link
              </button>
            </div>
          </div>
        </div>
      )} */}
    </div>
  )
}

export default memo(RichTextEditor, (prev, next) =>
  prev.content === next.content &&
  prev.showToolbar === next.showToolbar &&
  prev.minHeight === next.minHeight &&
  prev.error === next.error &&
  prev.textColor === next.textColor,
)
