'use client'

import { ExternalLink, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'

export function AchievementReviewControls({
  achievementId,
  evidenceUrl,
}: {
  achievementId: number
  evidenceUrl?: string | null
}) {
  const { token } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState<'verified' | 'rejected' | null>(null)

  const review = async (status: 'verified' | 'rejected') => {
    setSubmitting(status)
    try {
      const response = await fetch(
        `/api/admin/teacher-portfolio/achievements/${achievementId}/verification`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(token),
          },
          body: JSON.stringify({ status }),
        },
      )
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Không thể cập nhật trạng thái duyệt.')
      toast.success(status === 'verified' ? 'Đã xác thực giải thưởng.' : 'Đã từ chối minh chứng.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái duyệt.')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e7ded2] pt-4 print:hidden">
      {evidenceUrl ? (
        <a
          href={evidenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[#d9cec0] bg-white px-3 text-xs font-bold text-[#413a33] transition hover:border-[#bd0026]/40 hover:text-[#bd0026]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Xem minh chứng
        </a>
      ) : null}
      <button
        type="button"
        disabled={submitting !== null}
        onClick={() => review('verified')}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {submitting === 'verified' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        Xác thực
      </button>
      <button
        type="button"
        disabled={submitting !== null}
        onClick={() => review('rejected')}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
      >
        {submitting === 'rejected' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
        Từ chối
      </button>
    </div>
  )
}

