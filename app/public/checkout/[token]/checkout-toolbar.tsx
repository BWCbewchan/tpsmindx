'use client'

import { useState } from 'react'
import { Check, Copy, Download, Loader2 } from 'lucide-react'

function formatDdMmYyyyCompact(dateVal: string | null | undefined): string {
  if (!dateVal) {
    const now = new Date()
    const d = String(now.getDate()).padStart(2, '0')
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const y = now.getFullYear()
    return `${d}${m}${y}`
  }

  // If already DD/MM/YYYY
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(dateVal.trim())
  if (slashMatch) {
    const d = slashMatch[1].padStart(2, '0')
    const m = slashMatch[2].padStart(2, '0')
    const y = slashMatch[3]
    return `${d}${m}${y}`
  }

  // If YYYY-MM-DD
  const dashMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dateVal.trim())
  if (dashMatch) {
    const y = dashMatch[1]
    const m = dashMatch[2].padStart(2, '0')
    const d = dashMatch[3].padStart(2, '0')
    return `${d}${m}${y}`
  }

  // Digits fallback
  const digits = dateVal.replace(/\D/g, '')
  if (digits.length === 8) return digits

  const d = new Date(dateVal)
  if (!Number.isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}${month}${year}`
  }

  return '01012027'
}

function sanitizeForFilename(str: string): string {
  return str
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
}

export function CheckoutToolbar({
  recordId,
  studentName,
  subject,
  trialDate,
}: {
  recordId: number
  studentName: string | null
  subject?: string | null
  trialDate?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleCopy = async () => {
    try {
      if (typeof window !== 'undefined') {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Fallback
    }
  }

  const handleDownloadPdf = async () => {
    if (typeof window === 'undefined' || isExporting) return

    setIsExporting(true)

    try {
      const originalTitle = document.title
      const cleanStudent = sanitizeForFilename(studentName || `HocVien_${recordId}`)
      const cleanSubject = sanitizeForFilename(subject || 'MindX')
      const compactDate = formatDdMmYyyyCompact(trialDate)
      document.title = `${cleanStudent}-${cleanSubject}-${compactDate}`
      window.print()
      window.setTimeout(() => {
        document.title = originalTitle
      }, 500)
    } catch (err) {
      console.error('Lỗi khi xuất file PDF:', err)
      window.print()
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <aside
      aria-label="Thanh công cụ phiếu đánh giá"
      className="print:hidden sticky top-0 z-40 mx-auto mb-6 max-w-[960px] rounded-b-xl border border-t-0 border-gray-200/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm transition-all"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Info */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="font-bold text-gray-900">Phiếu đánh giá #{recordId}</span>
          {studentName ? (
            <span className="text-gray-500">
              · Học viên: <strong className="text-gray-800">{studentName}</strong>
            </span>
          ) : null}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-gray-500" />
                <span>Sao chép link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#ed1c24] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#b00020] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang tạo PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Xuất PDF / In phiếu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}
