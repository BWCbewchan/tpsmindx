'use client'

import { PageContainer } from '@/components/PageContainer'
import {
  TeachingDocumentLibrary,
  type TeachingDocument,
} from '@/components/teaching-documents/TeachingDocumentLibrary'
import { UserClassAssistant } from '@/components/teaching-documents/UserClassAssistant'
import { Card } from '@/components/ui/card'
import { useEffect, useMemo, useState } from 'react'

type TeachingDocumentReadOnlyPageProps = {
  title: string
  description: string
  subjects: readonly string[]
  viewerBasePath: string
  showClassAssistant?: boolean
}

function normalizeSubject(subject: string) {
  if (subject === 'Robotics') return 'Robotic'
  if (subject === 'Digital Art' || subject === 'Game Design' || subject === 'Khoa học máy tính') return 'Coding'
  return subject
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

export function TeachingDocumentReadOnlyPage({
  title,
  description,
  subjects,
  viewerBasePath,
  showClassAssistant = false,
}: TeachingDocumentReadOnlyPageProps) {
  const [documents, setDocuments] = useState<TeachingDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadDocuments() {
      setLoading(true)
      try {
        const response = await fetch('/api/teaching-documents', { cache: 'no-store' })
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
      documents.filter((document) =>
        subjects.includes(normalizeSubject(document.subject_name)),
      ),
    [documents, subjects],
  )

  return (
    <PageContainer title={title} description={description}>
      {message && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{message}</p>
      )}
      {showClassAssistant && <UserClassAssistant />}
      <Card className="rounded-lg border border-slate-200 p-0">
        <TeachingDocumentLibrary
          documents={visibleDocuments}
          loading={loading}
          subjects={subjects}
          viewerBasePath={viewerBasePath}
        />
      </Card>
    </PageContainer>
  )
}
