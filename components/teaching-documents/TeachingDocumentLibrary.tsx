'use client'

import { ChevronDown, Folder, FolderOpen, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

export type DocumentStatus = 'published' | 'draft' | 'disabled'

export type TeachingDocument = {
  id: number
  title: string
  description: string | null
  file_name: string
  file_size: number
  file_type: string
  subject_name: string
  course_name: string | null
  document_level: 'Basic' | 'Advance' | 'Intensive'
  lesson_number: string
  document_status?: DocumentStatus
  created_by_email: string
  created_at: string
}

export const LEVELS = ['Basic', 'Advance', 'Intensive'] as const
export const SUBJECT_FOLDERS = ['Coding', 'Robotic', 'Art', 'Trải nghiệm', 'E-Book'] as const
export const LEVELED_SUBJECTS = new Set(['Coding', 'Robotic', 'Art'])
export const COURSE_OPTIONS: Record<string, string[]> = {
  Coding: ['Scratch', 'Gamemaker', 'Python', 'Web', 'Computer Science'],
  Robotic: ['Robotic 4+', 'Robotic Vex Go N1', 'Robotic Vex Go N2', 'Robotic Vex IQ N3'],
  Art: [
    'Digital Art Foundation',
    'Visual Thinking',
    'Game Art',
    'Character & Mascot',
    'Graphic Design',
    'Visual Communication',
    'Multimedia Video',
  ],
  'Trải nghiệm': ['KIND - lớp 4+'],
  'E-Book': ['E-Book'],
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

function normalizeSubject(subject: string) {
  if (subject === 'Robotics') return 'Robotic'
  if (subject === 'Digital Art' || subject === 'Game Design' || subject === 'Khoa học máy tính') return 'Coding'
  return subject
}

function normalizeCourse(document: TeachingDocument) {
  return document.course_name || 'Chưa phân môn'
}

function documentExtension(fileName: string) {
  return fileName.split('.').pop()?.toUpperCase() || 'FILE'
}

function buildFolderTree(documents: TeachingDocument[], subjects: readonly string[]) {
  const tree = new Map<string, Map<string, Map<string, TeachingDocument[]>>>()

  subjects.forEach((subject) => {
    const courseMap = new Map<string, Map<string, TeachingDocument[]>>()
    ;(COURSE_OPTIONS[subject] || ['Tất cả tài liệu']).forEach((course) => {
      const levelMap = new Map<string, TeachingDocument[]>()
      if (LEVELED_SUBJECTS.has(subject)) {
        LEVELS.forEach((level) => levelMap.set(level, []))
      } else {
        levelMap.set('Tất cả tài liệu', [])
      }
      courseMap.set(course, levelMap)
    })
    tree.set(subject, courseMap)
  })

  documents.forEach((document) => {
    const subject = normalizeSubject(document.subject_name)
    if (!subjects.includes(subject)) return
    const course = normalizeCourse(document)
    if (!tree.has(subject)) tree.set(subject, new Map())
    const courseMap = tree.get(subject)!
    if (!courseMap.has(course)) courseMap.set(course, new Map())
    const levelMap = courseMap.get(course)!
    const level = LEVELED_SUBJECTS.has(subject) ? document.document_level : 'Tất cả tài liệu'
    if (!levelMap.has(level)) levelMap.set(level, [])
    levelMap.get(level)!.push(document)
  })

  return Array.from(tree.entries()).map(([subject, courseMap]) => ({
    subject,
    total: Array.from(courseMap.values()).reduce(
      (subjectSum, levelMap) =>
        subjectSum + Array.from(levelMap.values()).reduce((levelSum, items) => levelSum + items.length, 0),
      0,
    ),
    courses: Array.from(courseMap.entries()).map(([course, levelMap]) => ({
      course,
      total: Array.from(levelMap.values()).reduce((sum, items) => sum + items.length, 0),
      levels: Array.from(levelMap.entries()).map(([level, items]) => ({ level, items })),
    })),
  }))
}

type TeachingDocumentLibraryProps = {
  documents: TeachingDocument[]
  loading?: boolean
  subjects?: readonly string[]
  emptyText?: string
  viewerBasePath?: string
}

export function TeachingDocumentLibrary({
  documents,
  loading = false,
  subjects = SUBJECT_FOLDERS,
  emptyText = 'Chưa có tài liệu.',
  viewerBasePath = '/admin/giao-trinh',
}: TeachingDocumentLibraryProps) {
  const router = useRouter()
  const folderTree = useMemo(() => buildFolderTree(documents, subjects), [documents, subjects])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Đang tải danh sách...
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {folderTree.map((folder) => (
        <details key={folder.subject} open className="group rounded-lg border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <FolderOpen className="h-5 w-5 shrink-0 text-rose-700" />
              <span className="truncate text-sm font-black text-slate-950">{folder.subject}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-500">{folder.total}</span>
              <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
            </span>
          </summary>

          <div className="space-y-2 border-t border-slate-200 bg-white p-3">
            {folder.courses.map(({ course, total, levels }) => (
              <details key={`${folder.subject}-${course}`} open className="group/course rounded-md border border-slate-100 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder className="h-4 w-4 shrink-0 text-slate-600" />
                    <span className="truncate text-sm font-black text-slate-800">{course}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-500">{total}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition group-open/course:rotate-180" />
                  </span>
                </summary>

                <div className="space-y-2 border-t border-slate-100 p-2">
                  {levels.map(({ level, items }) => (
                    <details key={`${folder.subject}-${course}-${level}`} open className="group/level rounded-md border border-slate-100 bg-slate-50">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Folder className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="truncate text-sm font-bold text-slate-700">{level}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-slate-500">{items.length}</span>
                          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open/level:rotate-180" />
                        </span>
                      </summary>

                      <div className="border-t border-slate-100 bg-white px-3 py-2">
                        {items.length === 0 ? (
                          <p className="px-2 py-4 text-sm text-slate-400">{emptyText}</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((document) => (
                              <button
                                key={document.id}
                                type="button"
                                onClick={() => router.push(`${viewerBasePath}/${document.id}`)}
                                className="grid w-full gap-3 rounded-md border border-slate-100 bg-white p-3 text-left hover:border-rose-200 hover:bg-rose-50 md:grid-cols-[1fr_160px_150px]"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-950">{document.title}</p>
                                  <p className="mt-1 truncate text-xs text-slate-500">{document.file_name}</p>
                                </div>
                                <div className="text-xs text-slate-500">
                                  <p className="font-bold text-slate-700">{document.lesson_number}</p>
                                  <p>{formatFileSize(document.file_size)}</p>
                                </div>
                                <div className="text-xs text-slate-500 md:text-right">
                                  <span className="rounded-md bg-rose-50 px-2 py-1 font-bold text-rose-700">
                                    {documentExtension(document.file_name)}
                                  </span>
                                  <p className="mt-2">{new Date(document.created_at).toLocaleDateString('vi-VN')}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
