'use client'

import { PageContainer } from '@/components/PageContainer'
import { SecureDocViewer } from '@/components/secure-viewer/SecureDocViewer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { ArrowLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type DocumentMetadata = {
  id: number
  title: string
  description: string | null
  fileName: string
  fileType: string
  fileSize: number
  kind: 'docx' | 'pptx' | 'pdf' | 'image' | 'file'
  subjectName: string
  courseName: string | null
  documentLevel: string
  lessonNumber: string
}

async function readJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {
      success: false,
      error: text.startsWith('Internal Server Error')
        ? 'Máy chủ đang lỗi nội bộ. Vui lòng thử lại sau khi server ổn định.'
        : text,
    }
  }
}

function normalizeSubject(subject: string) {
  if (subject === 'Robotics') return 'Robotic'
  if (subject === 'Digital Art' || subject === 'Game Design' || subject === 'Khoa học máy tính') return 'Coding'
  return subject
}

function parentRouteForSubject(subject: string) {
  if (subject === 'Trải nghiệm') return '/admin/giao-trinh-trai-nghiem'
  return '/admin/giao-trinh-chuyen-mon'
}

export default function GiaoTrinhDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const documentId = Number(params.id)
  const validDocumentId = Number.isInteger(documentId) && documentId > 0 ? documentId : null
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!validDocumentId) return
    let mounted = true

    async function loadMetadata() {
      try {
        const response = await fetch(`/api/documents/stream/${validDocumentId}?action=metadata`, {
          cache: 'no-store',
        })
        const data = await readJsonResponse(response)
        if (!response.ok || !data.success) throw new Error(data.error || 'Không thể tải thông tin giáo trình')
        if (mounted) {
          setMetadata(data.document)
          setMessage('')
        }
      } catch (error: any) {
        if (mounted) setMessage(error?.message || 'Không thể tải thông tin giáo trình')
      }
    }

    void loadMetadata()

    return () => {
      mounted = false
    }
  }, [validDocumentId])

  const breadcrumb = useMemo(() => {
    if (!metadata) return null

    const subject = normalizeSubject(metadata.subjectName)
    const course = metadata.courseName || 'Chưa phân môn'
    const levelLabel = `${course} ${metadata.documentLevel}`
    const baseRoute = parentRouteForSubject(subject)
    const subjectHref = `${baseRoute}?subject=${encodeURIComponent(subject)}`
    const courseHref = `${subjectHref}&course=${encodeURIComponent(course)}`
    const levelHref = `${courseHref}&level=${encodeURIComponent(metadata.documentLevel)}`

    return (
      <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold text-slate-600" aria-label="Đường dẫn giáo trình">
        <Link href={subjectHref} className="rounded-sm hover:text-rose-700 hover:underline">
          {subject}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <Link href={courseHref} className="rounded-sm hover:text-rose-700 hover:underline">
          {course}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <Link href={levelHref} className="rounded-sm hover:text-rose-700 hover:underline">
          {levelLabel}
        </Link>
      </nav>
    )
  }, [metadata])

  return (
    <PageContainer
      title={metadata?.title || 'Đang tải giáo trình...'}
      description={breadcrumb || message || 'Đang tải đường dẫn giáo trình...'}
      maxWidth="full"
      headerActions={
        <Button type="button" variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Button>
      }
    >
      <Card className="rounded-lg border border-slate-200 p-3">
        <div className="mb-3 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          <ShieldCheck className="h-4 w-4 text-rose-700" />
          Tài liệu chỉ được stream qua phiên đăng nhập hiện tại, có watermark và token xem tạm thời.
        </div>
        <SecureDocViewer
          documentId={validDocumentId}
          viewerEmail={user?.email}
          className="min-h-[calc(100vh-220px)]"
        />
      </Card>
    </PageContainer>
  )
}
