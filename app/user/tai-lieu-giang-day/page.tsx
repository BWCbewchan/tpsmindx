'use client'

import { PageContainer } from '@/components/PageContainer'
import { SecureDocViewer } from '@/components/secure-viewer/SecureDocViewer'
import { useAuth } from '@/lib/auth-context'
import { BookOpen, ChevronDown, FileText, FolderOpen, Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type TeachingDocument = {
  id: number
  title: string
  description: string | null
  file_name: string
  file_size: number
  file_type: string
  subject_name: string
  document_level: 'Basic' | 'Advance' | 'Intensive'
  lesson_number: string
  created_at: string
}

type Tree = Record<string, Record<string, Record<string, TeachingDocument[]>>>

const LEVEL_ORDER = ['Basic', 'Advance', 'Intensive']

function buildTree(documents: TeachingDocument[]): Tree {
  return documents.reduce<Tree>((tree, document) => {
    tree[document.subject_name] ??= {}
    tree[document.subject_name][document.document_level] ??= {}
    tree[document.subject_name][document.document_level][document.lesson_number] ??= []
    tree[document.subject_name][document.document_level][document.lesson_number].push(document)
    return tree
  }, {})
}

function docExtension(fileName: string) {
  return fileName.split('.').pop()?.toUpperCase() || 'FILE'
}

export default function TaiLieuGiangDayPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<TeachingDocument[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeLesson, setActiveLesson] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/teaching-documents', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Không thể tải tài liệu')
      const nextDocuments = data.documents || []
      setDocuments(nextDocuments)
      if (!selectedId && nextDocuments[0]) {
        setSelectedId(nextDocuments[0].id)
        setActiveLesson(`${nextDocuments[0].subject_name}-${nextDocuments[0].document_level}-${nextDocuments[0].lesson_number}`)
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể tải tài liệu')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return documents
    return documents.filter((document) =>
      [document.title, document.description, document.file_name, document.subject_name, document.document_level, document.lesson_number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    )
  }, [documents, query])

  const tree = useMemo(() => buildTree(filteredDocuments), [filteredDocuments])
  const selectedDocument = documents.find((document) => document.id === selectedId) || null

  return (
    <PageContainer
      title="Tài liệu giảng dạy"
      description="Duyệt tài liệu theo bộ môn, level và buổi học trong vùng xem bảo mật"
    >
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tài liệu..."
                className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang tải...
            </div>
          ) : error ? (
            <div className="p-4 text-sm font-semibold text-rose-700">{error}</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Chưa có tài liệu phù hợp.</div>
          ) : (
            <div className="max-h-[720px] overflow-auto p-3">
              {Object.entries(tree).map(([subject, levels]) => (
                <details key={subject} open className="group/subject mb-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-black text-slate-950 hover:bg-slate-50">
                    <ChevronDown className="h-4 w-4 transition group-open/subject:rotate-180" />
                    <FolderOpen className="h-4 w-4 text-rose-700" />
                    {subject}
                  </summary>

                  <div className="ml-4 border-l border-slate-200 pl-2">
                    {Object.entries(levels)
                      .sort(([a], [b]) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))
                      .map(([level, lessons]) => (
                        <details key={level} open className="group/level mb-1">
                          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            <ChevronDown className="h-4 w-4 transition group-open/level:rotate-180" />
                            <BookOpen className="h-4 w-4 text-slate-500" />
                            {level}
                          </summary>

                          <div className="ml-4 space-y-1 border-l border-slate-100 pl-2">
                            {Object.entries(lessons).map(([lesson, lessonDocuments]) => {
                              const lessonKey = `${subject}-${level}-${lesson}`
                              const active = activeLesson === lessonKey
                              return (
                                <div key={lesson} className="rounded-md">
                                  <button
                                    type="button"
                                    onClick={() => setActiveLesson(active ? '' : lessonKey)}
                                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-bold ${
                                      active ? 'bg-rose-50 text-rose-800' : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span>{lesson}</span>
                                    <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500">
                                      {lessonDocuments.length}
                                    </span>
                                  </button>
                                  {active && (
                                    <div className="space-y-1 px-1 pb-2 pt-1">
                                      {lessonDocuments.map((document) => (
                                        <button
                                          type="button"
                                          key={document.id}
                                          onClick={() => setSelectedId(document.id)}
                                          className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left ${
                                            selectedId === document.id
                                              ? 'bg-slate-950 text-white'
                                              : 'bg-white text-slate-700 hover:bg-slate-50'
                                          }`}
                                        >
                                          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                                          <span className="min-w-0">
                                            <span className="block truncate text-sm font-bold">{document.title}</span>
                                            <span className="mt-0.5 block text-xs opacity-70">{docExtension(document.file_name)}</span>
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </details>
                      ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </aside>

        <section>
          {selectedDocument && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm font-black text-slate-950">{selectedDocument.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedDocument.subject_name} / {selectedDocument.document_level} / {selectedDocument.lesson_number}
              </p>
            </div>
          )}
          <SecureDocViewer documentId={selectedId} viewerEmail={user?.email} />
        </section>
      </div>
    </PageContainer>
  )
}
