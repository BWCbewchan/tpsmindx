'use client'

import { PageContainer } from '@/components/PageContainer'
import {
  TeachingDocumentLibrary,
  type TeachingDocument,
} from '@/components/teaching-documents/TeachingDocumentLibrary'
import { Card } from '@/components/ui/card'
import { useEffect, useMemo, useState } from 'react'

const EXPERIENCE_SUBJECTS = ['Trải nghiệm'] as const

function normalizeStatus(document: TeachingDocument) {
  return document.document_status || 'published'
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

export default function GiaoTrinhTraiNghiemPage() {
  const [documents, setDocuments] = useState<TeachingDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadDocuments() {
      setLoading(true)
      try {
        const response = await fetch('/api/admin/teaching-documents', { cache: 'no-store' })
        const data = await readJsonResponse(response)
        if (!response.ok || !data.success) throw new Error(data.error || 'Không thể tải giáo trình')
        if (mounted) setDocuments(data.documents || [])
      } catch (error: any) {
        if (mounted) setMessage(error?.message || 'Không thể tải giáo trình')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadDocuments()

    return () => {
      mounted = false
    }
  }, [])

  const visibleDocuments = useMemo(
    () =>
      documents.filter(
        (document) => document.subject_name === 'Trải nghiệm' && normalizeStatus(document) === 'published',
      ),
    [documents],
  )

  return (
    <PageContainer
      title="Giáo trình trải nghiệm"
      description="Giáo trình trải nghiệm đã ban hành cho giáo viên"
    >
      {message && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{message}</p>
      )}
      <Card className="rounded-lg border border-slate-200 p-0">
        <TeachingDocumentLibrary documents={visibleDocuments} loading={loading} subjects={EXPERIENCE_SUBJECTS} />
      </Card>
    </PageContainer>
  )
}
