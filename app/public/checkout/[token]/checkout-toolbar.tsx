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

const COLOR_STYLE_PROPS = [
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'outlineColor',
  'textDecorationColor',
] as const

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

    const page1El = document.getElementById('evaluation-page-1')
    const page2El = document.getElementById('evaluation-page-2')
    const sheetEl = document.getElementById('evaluation-sheet')

    if (!page1El && !sheetEl) {
      window.print()
      return
    }

    setIsExporting(true)

    try {
      const html2canvasModule = await import('html2canvas')
      const html2canvas = html2canvasModule.default || html2canvasModule
      // @ts-expect-error - import self-contained UMD bundle to avoid Turbopack core-js subpath issues
      const jspdfModule = await import('jspdf/dist/jspdf.umd.min.js')
      const jsPDF = jspdfModule.jsPDF || jspdfModule.default?.jsPDF || jspdfModule.default

      // Helper canvas for converting any modern CSS colors (lab, oklch, oklab) into standard rgba
      const helperCanvas = document.createElement('canvas')
      helperCanvas.width = 1
      helperCanvas.height = 1
      const helperCtx = helperCanvas.getContext('2d', { willReadFrequently: true })

      const toRgba = (colorStr: string): string => {
        if (
          !colorStr ||
          (!colorStr.includes('lab(') &&
            !colorStr.includes('oklch(') &&
            !colorStr.includes('oklab(') &&
            !colorStr.includes('color('))
        ) {
          return colorStr
        }
        if (!helperCtx) return '#000000'
        try {
          helperCtx.clearRect(0, 0, 1, 1)
          helperCtx.fillStyle = colorStr
          helperCtx.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = helperCtx.getImageData(0, 0, 1, 1).data
          return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
        } catch {
          return '#000000'
        }
      }

      // Pre-clean cloned DOM before html2canvas parses styles
      const cleanClonedDoc = (clonedDoc: Document) => {
        const win = clonedDoc.defaultView || window
        const allElements = clonedDoc.querySelectorAll('*')
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement
          if (!el.style) continue

          // Remove box shadows and text shadows which trigger lab/oklch parser crashes in html2canvas
          el.style.boxShadow = 'none'
          el.style.textShadow = 'none'

          // Sanitize computed colors
          const cs = win.getComputedStyle(el)
          for (const prop of COLOR_STYLE_PROPS) {
            const val = cs[prop as any]
            if (
              val &&
              (val.includes('lab(') ||
                val.includes('oklch(') ||
                val.includes('oklab(') ||
                val.includes('color('))
            ) {
              ;(el.style as any)[prop] = toRgba(val)
            }
          }
        }
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = 210
      const pdfHeight = 297
      const margin = 8 // 8mm margin
      const printWidth = pdfWidth - margin * 2 // 194mm
      const printHeight = pdfHeight - margin * 2 // 281mm

      const renderPageToPdf = async (element: HTMLElement, isFirstPage: boolean) => {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: cleanClonedDoc,
        })

        if (!isFirstPage) {
          pdf.addPage()
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.98)
        const ratio = canvas.height / canvas.width
        let finalWidth = printWidth
        let finalHeight = printWidth * ratio

        // If height exceeds printable height, scale down proportionately
        if (finalHeight > printHeight) {
          const scale = printHeight / finalHeight
          finalHeight = printHeight
          finalWidth = finalWidth * scale
        }

        // Center horizontally
        const xOffset = margin + (printWidth - finalWidth) / 2
        const yOffset = margin

        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'FAST')
      }

      if (page1El && page2El) {
        await renderPageToPdf(page1El, true)
        await renderPageToPdf(page2El, false)
      } else if (sheetEl) {
        await renderPageToPdf(sheetEl, true)
      }

      // Filename format: [TenHocVien]-[BoMon]-[NgayThangNam].pdf
      const cleanStudent = sanitizeForFilename(studentName || `HocVien_${recordId}`)
      const cleanSubject = sanitizeForFilename(subject || 'MindX')
      const compactDate = formatDdMmYyyyCompact(trialDate)
      const fileName = `${cleanStudent}-${cleanSubject}-${compactDate}.pdf`

      // Auto download with blob link for guaranteed browser download
      const blob = pdf.output('blob')
      const blobUrl = URL.createObjectURL(blob)
      const downloadLink = document.createElement('a')
      downloadLink.href = blobUrl
      downloadLink.download = fileName
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch (err) {
      console.error('Lỗi khi xuất file PDF:', err)
      // Fallback to browser print dialog
      window.print()
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <aside
      aria-label="Thanh công cụ phiếu đánh giá"
      className="print:hidden sticky top-4 z-40 mx-auto mb-6 max-w-[960px] rounded-xl border border-gray-200/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm transition-all"
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
