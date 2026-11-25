import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { formatReviewDateTime } from '@/lib/format-date'

export interface LectureReviewExportItem {
  id?: number
  manager_leader_name?: string | null
  center_name?: string | null
  candidate_name?: string | null
  lms_code?: string | null
  reviewer_name?: string | null
  review_date?: string | null
  review_time?: string | null
  evaluation_score?: number | string | null
  theory_score?: number | string | null
  final_score?: number | string | null
  total_lesson?: number | string | null
  training_status?: string | null
}

export function formatEvaluationScore10(score: unknown): number | null {
  if (score === null || score === undefined || score === '') return null
  const num = Number(score)
  if (isNaN(num) || num <= 0) return null
  const val = num > 10 ? (num / 125) * 10 : num
  return Math.round(val * 10) / 10
}

export function formatTheoryScore10(score: unknown): number | null {
  if (score === null || score === undefined || score === '') return null
  const num = Number(score)
  if (isNaN(num) || num <= 0) return null
  const val = num > 10 ? (num / 100) * 10 : num
  return Math.round(val * 10) / 10
}

export function formatScoreDisplay(val: number | null): string | null {
  if (val === null) return null
  return val.toFixed(1)
}

export function computeFinalScore(row: {
  evaluation_score?: number | string | null
  theory_score?: number | string | null
  final_score?: number | string | null
}): string | null {
  const dg = formatEvaluationScore10(row.evaluation_score)
  const lt = formatTheoryScore10(row.theory_score)

  if (dg !== null && lt !== null) {
    const finalVal = 0.7 * dg + 0.3 * lt
    return (Math.round(finalVal * 10) / 10).toFixed(1)
  }
  if (dg !== null && lt === null) {
    const finalVal = 0.7 * dg
    return (Math.round(finalVal * 10) / 10).toFixed(1)
  }
  if (dg === null && lt !== null) {
    const finalVal = 0.3 * lt
    return (Math.round(finalVal * 10) / 10).toFixed(1)
  }
  return null
}

export function computeTrainingStatus(row: {
  theory_score?: number | string | null
  evaluation_score?: number | string | null
  final_score?: number | string | null
  total_lesson?: number | string | null
}) {
  const hasLT = formatTheoryScore10(row.theory_score) !== null
  const hasDG = formatEvaluationScore10(row.evaluation_score) !== null
  const hasTotal = computeFinalScore(row) !== null
  const hasLessons =
    row.total_lesson !== null &&
    row.total_lesson !== undefined &&
    String(row.total_lesson).trim() !== '' &&
    !isNaN(Number(row.total_lesson)) &&
    Number(row.total_lesson) > 0

  const isCompleted = hasLT && hasDG && hasTotal && hasLessons
  const missing: string[] = []
  if (!hasDG) missing.push('Điểm duyệt giảng')
  if (!hasLT) missing.push('Điểm lý thuyết')
  if (!hasTotal) missing.push('Tổng điểm')
  if (!hasLessons) missing.push('Tổng số bài học')

  return {
    label: isCompleted ? 'Đã hoàn thành tập huấn' : 'Chưa hoàn thành tập huấn',
    isCompleted,
    missing,
  }
}

export async function exportLectureReviewsToExcel(rows: LectureReviewExportItem[]): Promise<void> {
  if (!rows || rows.length === 0) {
    throw new Error('Không có dữ liệu để xuất file Excel')
  }

  const now = new Date()
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(
    2,
    '0',
  )}:${String(now.getMinutes()).padStart(2, '0')}`

  const headers = [
    'Leader quản lý',
    'Cơ sở',
    'Họ tên ứng viên',
    'Mã LMS',
    'Ban giám khảo',
    'Ngày đăng ký duyệt giảng',
    'Điểm duyệt giảng',
    'Điểm lý thuyết',
    'Điểm tổng kết',
    'Trạng thái',
  ]

  const wsData: (string | number)[][] = [
    ['DANH SÁCH ĐĂNG KÝ DUYỆT GIẢNG', '', '', '', '', '', '', '', '', ''],
    [`Thời gian xuất: ${dateStr} | Tổng cộng: ${rows.length} phiếu`, '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    headers,
  ]

  for (const row of rows) {
    const dgScore = formatScoreDisplay(formatEvaluationScore10(row.evaluation_score))
    const ltScore = formatScoreDisplay(formatTheoryScore10(row.theory_score))
    const finalScore = computeFinalScore(row)
    const status = computeTrainingStatus(row)
    const reviewDate = formatReviewDateTime(row.review_date, row.review_time)

    wsData.push([
      row.manager_leader_name || '-',
      row.center_name || '-',
      row.candidate_name || '-',
      row.lms_code || '-',
      row.reviewer_name || '-',
      reviewDate || '-',
      dgScore ?? '-',
      ltScore ?? '-',
      finalScore ?? '-',
      status.label,
    ])
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ]

  ws['!cols'] = [
    { wch: 22 }, // Leader quản lý
    { wch: 22 }, // Cơ sở
    { wch: 26 }, // Họ tên ứng viên
    { wch: 14 }, // Mã LMS
    { wch: 24 }, // Ban giám khảo
    { wch: 24 }, // Ngày đăng ký duyệt giảng
    { wch: 16 }, // Điểm duyệt giảng
    { wch: 16 }, // Điểm lý thuyết
    { wch: 16 }, // Điểm tổng kết
    { wch: 28 }, // Trạng thái
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách duyệt giảng')
  const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

  // Style the workbook using JSZip
  const zip = await JSZip.loadAsync(xlsxBuf)

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF1E293B"/><name val="Arial"/></font>
    <font><sz val="15"/><b/><color rgb="FFB00020"/><name val="Arial"/></font>
    <font><sz val="10"/><i/><color rgb="FF64748B"/><name val="Arial"/></font>
    <font><sz val="11"/><b/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><sz val="11"/><b/><color rgb="FF0F172A"/><name val="Arial"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFB00020"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF1F2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF991B1B"/></left>
      <right style="thin"><color rgb="FF991B1B"/></right>
      <top style="thin"><color rgb="FF991B1B"/></top>
      <bottom style="thin"><color rgb="FF991B1B"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`

  zip.file('xl/styles.xml', stylesXml)

  const sheetFile = zip.file('xl/worksheets/sheet1.xml')
  if (sheetFile) {
    let sheetXml = await sheetFile.async('string')

    // Set row heights
    sheetXml = sheetXml.replace(/<row r="1"(.*?)>/, '<row r="1" ht="36" customHeight="1"$1>')
    sheetXml = sheetXml.replace(/<row r="2"(.*?)>/, '<row r="2" ht="22" customHeight="1"$1>')
    sheetXml = sheetXml.replace(/<row r="4"(.*?)>/, '<row r="4" ht="30" customHeight="1"$1>')

    // Row 1: Title style s="1"
    sheetXml = sheetXml.replace(/(<row r="1"[^>]*>)([\s\S]*?)(<\/row>)/, (m, p1, p2, p3) => {
      return p1 + p2.replace(/<c r="([A-Z]+1)"([^>]*)>/g, '<c r="$1" s="1"$2>') + p3
    })

    // Row 2: Subtitle style s="2"
    sheetXml = sheetXml.replace(/(<row r="2"[^>]*>)([\s\S]*?)(<\/row>)/, (m, p1, p2, p3) => {
      return p1 + p2.replace(/<c r="([A-Z]+2)"([^>]*)>/g, '<c r="$1" s="2"$2>') + p3
    })

    // Row 4: Header style s="3"
    sheetXml = sheetXml.replace(/(<row r="4"[^>]*>)([\s\S]*?)(<\/row>)/, (m, p1, p2, p3) => {
      return p1 + p2.replace(/<c r="([A-Z]+4)"([^>]*)>/g, '<c r="$1" s="3"$2>') + p3
    })

    // Data rows (Row 5+)
    const centerCols = ['D', 'F', 'G', 'H', 'I', 'J']
    const lastRow = 4 + rows.length

    sheetXml = sheetXml.replace(/<row r="(\d+)"(.*?)>/g, (match, rNum, rest) => {
      const r = parseInt(rNum, 10)
      if (r >= 5) {
        return `<row r="${r}" ht="24" customHeight="1"${rest}>`
      }
      return match
    })

    sheetXml = sheetXml.replace(/(<row r="(\d+)"[^>]*>)([\s\S]*?)(<\/row>)/, (match, p1, rNum, p2, p3) => {
      const r = parseInt(rNum, 10)
      if (r >= 5) {
        const isAlt = r % 2 === 1
        const styledCells = p2.replace(/<c r="([A-Z]+)\d+"([^>]*)>/g, (cMatch, col, cRest) => {
          let styleId = isAlt ? 7 : 4
          if (col === 'C') {
            styleId = isAlt ? 9 : 6
          } else if (centerCols.includes(col)) {
            styleId = isAlt ? 8 : 5
          }
          return `<c r="${col}${r}" s="${styleId}"${cRest}>`
        })
        return p1 + styledCells + p3
      }
      return match
    })

    // Add autoFilter right before <mergeCells in OpenXML sequence
    if (rows.length > 0 && !sheetXml.includes('<autoFilter')) {
      if (sheetXml.includes('<mergeCells')) {
        sheetXml = sheetXml.replace('<mergeCells', `<autoFilter ref="A4:J${lastRow}"/><mergeCells`)
      } else {
        sheetXml = sheetXml.replace('</sheetData>', `</sheetData><autoFilter ref="A4:J${lastRow}"/>`)
      }
    }

    zip.file('xl/worksheets/sheet1.xml', sheetXml)
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const fileName = 'DANH SÁCH ĐĂNG KÝ DUYỆT GIẢNG.xlsx'

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
