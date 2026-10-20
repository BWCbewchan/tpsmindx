'use client'

import { cn } from '@/lib/utils'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef } from 'react'

type CommentRichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
}

type ToolbarButtonProps = {
  label: string
  icon: LucideIcon
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

const COMMENT_EDITOR_EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
  }),
  TextAlign.configure({ types: ['paragraph'] }),
]

function normalizeEditorHtml(value: string): string {
  const trimmed = (value || '').trim()
  if (
    !trimmed
    || trimmed === '<p></p>'
    || trimmed === '<p><br></p>'
    || trimmed === '<p><br class="ProseMirror-trailingBreak"></p>'
  ) {
    return ''
  }
  return trimmed
}

function escapeEditorText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function contentForEditor(value: string): string {
  const normalized = normalizeEditorHtml(value)
  if (!normalized || /<\/?[a-z][^>]*>/i.test(normalized)) return normalized
  return normalized
    .split(/\r?\n/)
    .map((line) => line.trim() ? `<p>${escapeEditorText(line)}</p>` : '<p><br></p>')
    .join('')
}

function ToolbarButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors',
        'hover:bg-white hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156d4]/30',
        active && 'bg-white text-[#a1001f] shadow-sm ring-1 ring-gray-200',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-gray-600',
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.1} />
    </button>
  )
}

export function CommentRichTextEditor({
  value,
  onChange,
  placeholder = 'Nhập nhận xét',
  disabled = false,
  ariaLabel = 'Nội dung nhận xét',
}: CommentRichTextEditorProps) {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: COMMENT_EDITOR_EXTENSIONS,
      content: contentForEditor(value),
      editable: !disabled,
      editorProps: {
        attributes: {
          class: 'min-h-[132px] max-h-[260px] overflow-y-auto px-3 py-2.5 text-sm leading-6 text-gray-900 focus:outline-none [&_p]:my-0',
          role: 'textbox',
          'aria-label': ariaLabel,
          'aria-multiline': 'true',
          spellcheck: 'true',
        },
      },
      onUpdate: ({ editor: activeEditor }) => {
        onChangeRef.current(activeEditor.isEmpty ? '' : normalizeEditorHtml(activeEditor.getHTML()))
      },
    },
    [],
  )

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) return
    const currentValue = editor.isEmpty ? '' : normalizeEditorHtml(editor.getHTML())
    const nextValue = contentForEditor(value)
    if (currentValue !== nextValue) {
      editor.commands.setContent(nextValue || '', { emitUpdate: false })
    }
  }, [editor, value])

  const controlsDisabled = disabled || !editor
  const hasContent = editor ? !editor.isEmpty : Boolean(normalizeEditorHtml(value))
  const leftAligned = editor
    ? editor.isActive({ textAlign: 'left' }) || !editor.getAttributes('paragraph').textAlign
    : true

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-gray-200 bg-white transition',
        'focus-within:border-[#3156d4] focus-within:ring-2 focus-within:ring-[#3156d4]/10',
        disabled && 'bg-gray-50',
      )}
    >
      <div className="flex h-10 items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2">
        <ToolbarButton
          label="In đậm (Ctrl+B)"
          icon={Bold}
          active={Boolean(editor?.isActive('bold'))}
          disabled={controlsDisabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="In nghiêng (Ctrl+I)"
          icon={Italic}
          active={Boolean(editor?.isActive('italic'))}
          disabled={controlsDisabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Gạch chân (Ctrl+U)"
          icon={Underline}
          active={Boolean(editor?.isActive('underline'))}
          disabled={controlsDisabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-gray-200" />

        <ToolbarButton
          label="Căn trái"
          icon={AlignLeft}
          active={leftAligned}
          disabled={controlsDisabled}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
        />
        <ToolbarButton
          label="Căn giữa"
          icon={AlignCenter}
          active={Boolean(editor?.isActive({ textAlign: 'center' }))}
          disabled={controlsDisabled}
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
        />
        <ToolbarButton
          label="Căn phải"
          icon={AlignRight}
          active={Boolean(editor?.isActive({ textAlign: 'right' }))}
          disabled={controlsDisabled}
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
        />
        <ToolbarButton
          label="Căn đều"
          icon={AlignJustify}
          active={Boolean(editor?.isActive({ textAlign: 'justify' }))}
          disabled={controlsDisabled}
          onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
        />
      </div>

      <div className="relative">
        {!hasContent ? (
          <span className="pointer-events-none absolute left-3 top-2.5 text-sm leading-6 text-gray-400">
            {placeholder}
          </span>
        ) : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
