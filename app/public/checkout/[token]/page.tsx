import pool from '@/lib/db'
import {
  PROFICIENCY_LEVELS,
  RUBRICS,
  SCORE_COLUMNS,
  getProficiencyLevel,
  resolveRubricType,
  type RubricConfig,
  type ScoreColumn,
} from '@/lib/trial-checkout-rubrics'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { CheckoutToolbar } from './checkout-toolbar'

export const dynamic = 'force-dynamic'

type ScoreFieldMap = {
  [key in ScoreColumn]: string | number | null
}

type CheckoutRecord = ScoreFieldMap & {
  raw_id: number
  timestamp_at: string | Date | null
  trial_teacher_name: string | null
  sales_owner_name: string | null
  student_name: string | null
  student_age_label: string | null
  trial_date: string | Date | null
  track: string | null
  trial_subject: string | null
  center_name: string | null
  total_score: string | number | null
  case_result: string | null
  general_comment: string | null
  raw_payload: Record<string, unknown> | null
}

const SCORE_VALUES = [1, 2, 3, 4, 5]

function textValue(value: unknown, fallback = '-'): string {
  const text = String(value ?? '').trim()
  return text || fallback
}

function formatDate(value: unknown): string {
  if (!value) return '-'
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(value)
  }

  const str = String(value).trim()
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(str)
  if (slashMatch) {
    return `${slashMatch[1].padStart(2, '0')}/${slashMatch[2].padStart(2, '0')}/${slashMatch[3]}`
  }

  const dashMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str)
  if (dashMatch) {
    return `${dashMatch[3].padStart(2, '0')}/${dashMatch[2].padStart(2, '0')}/${dashMatch[1]}`
  }

  const dateObj = new Date(str)
  if (!Number.isNaN(dateObj.getTime())) {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(dateObj)
  }

  return str || '-'
}

function formatScore(value: unknown): string {
  if (value == null || value === '') return '-'
  const score = Number(value)
  if (!Number.isFinite(score)) return String(value)
  return score.toFixed(2)
}

function scoreFor(record: CheckoutRecord, key: ScoreColumn): number | null {
  const score = Number(record[key])
  if (!Number.isFinite(score)) return null
  return Math.round(score)
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="info-row flex flex-wrap sm:grid sm:grid-cols-[160px_minmax(0,1fr)] gap-1 sm:gap-3 text-[14px] sm:text-[15px] leading-snug sm:leading-6 text-[#171717] py-0.5">
      <dt className="font-bold shrink-0 min-w-0">{label}:</dt>
      <dd className="font-bold text-[#171717] break-words min-w-0">{textValue(value)}</dd>
    </div>
  )
}

function ScoreMark({
  record,
  scoreKey,
  value,
}: {
  record: CheckoutRecord
  scoreKey: ScoreColumn
  value: number
}) {
  return (
    <td className="h-10 border-l-2 border-[#171717] text-center align-middle text-[15px] font-black">
      {scoreFor(record, scoreKey) === value ? 'X' : ''}
    </td>
  )
}

function displaySectionTitle(title: string): string {
  return title.replace(/^[IVX]+\.\s*/i, '').trim()
}

function CommonRubricTable({
  record,
  rubric,
}: {
  record: CheckoutRecord
  rubric: RubricConfig
}) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-[13px] sm:text-[14px] text-[#171717]">
        <thead>
          <tr className="break-inside-avoid">
            <th className="w-[52%] sm:w-[58%] px-2 sm:px-3 pb-2 text-center text-sm sm:text-base font-black uppercase text-[#ed1c24]">
              Năng lực
            </th>
            <th colSpan={5} className="px-2 sm:px-3 pb-2 text-center text-sm sm:text-base font-black uppercase text-[#ed1c24]">
              Mức độ thể hiện
            </th>
          </tr>
          <tr className="border-b-2 border-[#171717] break-inside-avoid">
            <th />
            {SCORE_VALUES.map((score) => (
              <th key={score} className="h-8 sm:h-9 border-l-2 border-[#171717] text-center font-bold">
                {score}
              </th>
            ))}
          </tr>
        </thead>
        {rubric.sections.map((section, sectionIndex) => (
          <tbody key={section.id}>
            <tr className="break-inside-avoid" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <td colSpan={6} className="px-1 pt-4 pb-1 text-sm sm:text-base font-black uppercase text-[#ed1c24]">
                {sectionIndex + 1}. {section.title}
              </td>
            </tr>
            {section.criteria.map((criterion) => (
              <tr
                key={criterion.key}
                className="border-b-2 border-[#171717] break-inside-avoid"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <td className="h-11 sm:h-12 px-2 sm:px-4 text-center align-middle">{criterion.label}</td>
                {SCORE_VALUES.map((score) => (
                  <ScoreMark key={score} record={record} scoreKey={criterion.key} value={score} />
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function ArtRubricTable({
  record,
  rubric,
}: {
  record: CheckoutRecord
  rubric: RubricConfig
}) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-[12.5px] sm:text-[13.5px] text-[#171717]">
        <thead>
          <tr className="break-inside-avoid">
            <th className="w-[52%] sm:w-[56%] px-2 sm:px-3 pb-2 text-center text-sm sm:text-base font-black uppercase text-[#ed1c24]">
              Năng lực
            </th>
            <th colSpan={5} className="px-2 sm:px-3 pb-2 text-center text-sm sm:text-base font-black uppercase text-[#ed1c24]">
              Mức độ thể hiện
            </th>
          </tr>
          <tr className="border-b-2 border-[#171717] break-inside-avoid">
            <th />
            {SCORE_VALUES.map((score) => (
              <th key={score} className="h-8 sm:h-9 border-l-2 border-[#171717] text-center font-bold">
                {score}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rubric.sections.map((section, index) => {
            const criterion = section.criteria[0]
            const score = scoreFor(record, criterion.key)
            const selectedLevel = score ? criterion.levels?.[score - 1] : null

            return (
              <tr
                key={section.id}
                className="border-b-2 border-[#171717] break-inside-avoid"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <td className="px-2 sm:px-4 py-3 sm:py-4 align-middle">
                  <div className="font-black uppercase text-[#ed1c24]">
                    {index + 1}. {displaySectionTitle(section.title)}
                  </div>
                  <div className="mt-1 text-[12px] sm:text-[13px] leading-relaxed text-[#404040]">
                    {selectedLevel || criterion.label}
                  </div>
                </td>
                {SCORE_VALUES.map((level) => (
                  <td
                    key={level}
                    className="h-11 sm:h-12 border-l-2 border-[#171717] text-center align-middle text-[15px] font-black"
                  >
                    {score === level ? 'X' : ''}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LevelRubricTable({
  record,
  rubric,
}: {
  record: CheckoutRecord
  rubric: RubricConfig
}) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-[13px] sm:text-[14px] text-[#171717]">
        <thead>
          <tr className="border-b-2 border-[#171717] text-[#ed1c24] break-inside-avoid">
            <th className="w-[30%] sm:w-[28%] px-2 sm:px-3 py-2.5 sm:py-3 text-left text-sm sm:text-base font-black uppercase">
              Năng lực
            </th>
            <th className="w-[12%] sm:w-[10%] border-l-2 border-[#171717] px-2 sm:px-3 py-2.5 sm:py-3 text-center text-sm sm:text-base font-black uppercase">
              Điểm
            </th>
            <th className="border-l-2 border-[#171717] px-2.5 sm:px-4 py-2.5 sm:py-3 text-left text-sm sm:text-base font-black uppercase">
              Mức biểu hiện đã chọn
            </th>
          </tr>
        </thead>
        <tbody>
          {rubric.sections.map((section, index) => {
            const criterion = section.criteria[0]
            const score = scoreFor(record, criterion.key)
            const level = score ? criterion.levels?.[score - 1] : null

            return (
              <tr
                key={section.id}
                className="border-b-2 border-[#171717] break-inside-avoid"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <td className="px-2 sm:px-3 py-3 sm:py-4 align-top">
                  <div className="font-black uppercase text-[#ed1c24]">
                    {index + 1}. {section.title}
                  </div>
                  <div className="mt-1 text-[#404040] text-xs sm:text-sm">{criterion.label}</div>
                </td>
                <td className="border-l-2 border-[#171717] px-2 sm:px-3 py-3 sm:py-4 text-center align-top text-base sm:text-lg font-black">
                  {score || '-'}
                </td>
                <td className="border-l-2 border-[#171717] px-2.5 sm:px-4 py-3 sm:py-4 align-top leading-relaxed">
                  {level || '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

async function getCheckoutRecord(token: string): Promise<CheckoutRecord | null> {
  const numericId = /^\d+$/.test(token) ? Number.parseInt(token, 10) : null

  const result = await pool.query(
    `SELECT
        raw_id,
        timestamp_at,
        trial_teacher_name,
        sales_owner_name,
        student_name,
        student_age_label,
        trial_date,
        track,
        trial_subject,
        center_name,
        ${SCORE_COLUMNS.join(',\n        ')},
        total_score,
        case_result,
        general_comment,
        raw_payload
     FROM trial_checkout_raw
     WHERE raw_payload @> jsonb_build_object('publicToken', $1::text)
        OR ($2::bigint IS NOT NULL AND raw_id = $2::bigint)
     LIMIT 1`,
    [token, numericId],
  )

  return result.rows[0] || null
}

export default async function PublicCheckoutPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const record = await getCheckoutRecord(token)

  if (!record) notFound()

  const track = textValue(record.track, '')
  const subject = textValue(record.trial_subject, '')
  const rubric = RUBRICS[resolveRubricType(track, subject)]
  const city = textValue(record.raw_payload?.city || record.raw_payload?.region || 'Hồ Chí Minh')
  const caseResult = textValue(record.case_result, '')
  const formattedTrialDate = formatDate(record.trial_date)
  const numericScore =
    record.total_score != null && record.total_score !== '' ? Number(record.total_score) : null
  const proficiencyLevel = getProficiencyLevel(numericScore)
  const specialNote = textValue(
    record.raw_payload?.note ||
      record.raw_payload?.specialNote ||
      record.raw_payload?.special_note ||
      record.raw_payload?.['Định hướng thêm'] ||
      record.raw_payload?.['Lưu ý thêm'],
    '',
  )

  return (
    <main className="min-h-screen bg-[#e5e5e5] px-2 py-4 sm:px-4 sm:py-8 text-[#171717] print:bg-white print:p-0">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A4 portrait;
              margin: 8mm 8mm;
            }
            @media print {
              body {
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              article {
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                max-width: none !important;
              }
              .sheet-page {
                box-shadow: none !important;
                border: none !important;
                padding: 2mm 0 !important;
                margin: 0 !important;
                page-break-after: auto !important;
                break-after: auto !important;
              }
              .sheet-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              tr, .avoid-break {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
              .student-info-grid {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
                column-gap: 10mm !important;
                row-gap: 0 !important;
              }
              .student-info-column {
                min-width: 0 !important;
              }
              .info-row {
                display: grid !important;
                grid-template-columns: 42mm minmax(0, 1fr) !important;
                column-gap: 3mm !important;
                align-items: baseline !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
              .info-row dt,
              .info-row dd {
                min-width: 0 !important;
              }
            }
          `,
        }}
      />

      <CheckoutToolbar
        recordId={record.raw_id}
        studentName={record.student_name}
        subject={record.trial_subject}
        trialDate={formattedTrialDate}
      />

      <article
        id="evaluation-sheet"
        className="mx-auto max-w-[960px] text-[#171717] print:max-w-none print:p-0"
      >
        {/* ========================================================
            TRANG 1: Header + Thông tin học viên + Đánh giá năng lực
            ======================================================== */}
        <section
          id="evaluation-page-1"
          className="sheet-page bg-white px-5 py-6 sm:px-10 sm:py-8 md:px-12 md:py-10 shadow-xl border border-[#e5e5e5] print:border-none print:shadow-none"
        >
          {/* Header */}
          <header
            className="flex flex-col sm:grid sm:grid-cols-[260px_minmax(0,1fr)] items-center gap-3 bg-[#ed1c24] px-4 py-4 sm:px-6 sm:py-5 text-white avoid-break"
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            <div className="flex w-full justify-center sm:justify-start">
              <div className="inline-flex flex-col items-start text-white">
                <div className="flex items-end gap-1 leading-none">
                  <span className="text-[38px] sm:text-[44px] font-black leading-none">mind</span>
                  <Image src="/x_white.svg" alt="" width={42} height={46} className="mb-0.5 h-[40px] sm:h-[46px] w-auto" priority />
                </div>
                <div className="mt-1 text-[15px] sm:text-[17px] font-black leading-none">Tech &amp; AI School</div>
              </div>
            </div>
            <h1 className="text-center sm:text-right text-lg sm:text-[22px] md:text-[24px] font-black uppercase leading-snug tracking-normal">
              Đánh giá mức độ sẵn sàng
              <br />
              cho tương lai số
            </h1>
          </header>

          {/* A. THÔNG TIN HỌC VIÊN */}
          <div className="mt-6 avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <h2 className="mb-2 text-[16px] sm:text-[17px] font-black uppercase text-[#ed1c24]">
              A. Thông tin học viên
            </h2>
            <dl className="student-info-grid grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1 sm:gap-y-2">
              <div className="student-info-column">
                <InfoRow label="Họ và tên Học viên" value={record.student_name} />
                <InfoRow label="Môn trải nghiệm" value={record.trial_subject} />
                <InfoRow label="Giáo viên hướng dẫn" value={record.trial_teacher_name} />
                <InfoRow label="Cơ sở" value={record.center_name} />
              </div>
              <div className="student-info-column">
                <InfoRow label="Tuổi" value={record.student_age_label} />
                <InfoRow label="Ngày trải nghiệm" value={formattedTrialDate} />
                <InfoRow label="Tỉnh/ Thành phố" value={city} />
                {/* Đổi "Sale phụ trách" thành "Tư vấn phụ trách" */}
                <InfoRow label="Tư vấn phụ trách" value={record.sales_owner_name} />
              </div>
            </dl>
          </div>

          {/* B. ĐÁNH GIÁ NĂNG LỰC */}
          <div className="mt-6">
            <h2 className="mb-1 text-[16px] sm:text-[17px] font-black uppercase text-[#ed1c24] avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              B. Đánh giá năng lực
            </h2>
            <p className="text-[13px] sm:text-[14px] leading-relaxed text-[#333333] avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              Dưới đây là Kết quả chi tiết đánh giá mức độ sẵn sàng cho Tương lai số của Học viên sau buổi trải nghiệm tại MindX
              <br />
              (Mức độ đánh giá theo thang điểm 1 - 5 tương ứng với mức độ thể hiện từ thấp đến cao):
            </p>

            <div className="mt-4">
              {rubric.type === 'art' ? (
                <ArtRubricTable record={record} rubric={rubric} />
              ) : rubric.mode === 'matrix' ? (
                <CommonRubricTable record={record} rubric={rubric} />
              ) : (
                <LevelRubricTable record={record} rubric={rubric} />
              )}
            </div>
          </div>
        </section>

        {/* ========================================================
            TRANG 2: C. Đánh giá kết quả + D. Kết quả + Footer
            ======================================================== */}
        <section
          id="evaluation-page-2"
          className="sheet-page mt-6 print:mt-0 bg-white px-5 py-6 sm:px-10 sm:py-8 md:px-12 md:py-10 shadow-xl border border-[#e5e5e5] print:border-none print:shadow-none"
        >
          {/* C. ĐÁNH GIÁ NĂNG LỰC / KẾT QUẢ */}
          <div className="avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <h2 className="mb-1 text-[16px] sm:text-[17px] font-black uppercase text-[#ed1c24]">
              C. ĐÁNH GIÁ NĂNG LỰC
            </h2>
            <p className="text-[13px] sm:text-[14px] text-[#171717] leading-snug">
              <span className="font-bold">Điểm số trung bình Đánh giá mức độ sẵn sàng cho Tương lai số của Học viên: </span>
              <span className="italic text-[#525252]">(Tính bằng tổng điểm thành phần chia số tiêu chí được đánh giá)</span>
            </p>

            {/* Hiển thị đầy đủ tất cả các mức, làm nổi bật mức học viên đạt được */}
            <div className="mt-4 space-y-3 text-[14px] sm:text-[15px] leading-relaxed">
              {PROFICIENCY_LEVELS.map((level) => {
                const isCurrentLevel = proficiencyLevel?.key === level.key

                return (
                  <div
                    key={level.key}
                    className={cn(
                      'transition-all',
                      isCurrentLevel
                        ? 'rounded-lg border-2 border-[#ed1c24] bg-[#fff5f5] p-3 sm:p-4'
                        : 'p-1 text-[#404040]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[14px] sm:text-[15px]',
                          isCurrentLevel ? 'font-black text-[#ed1c24]' : 'font-bold text-[#171717]'
                        )}
                      >
                        {level.title} ({level.scoreRangeLabel})
                      </span>
                      {isCurrentLevel && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#ed1c24] px-2 py-0.5 text-[11px] font-black uppercase text-white">
                          ✓ Mức đạt được
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'mt-1 text-[13px] sm:text-[14px] leading-relaxed text-justify sm:text-left',
                        isCurrentLevel ? 'font-medium text-[#171717]' : 'text-[#404040]'
                      )}
                    >
                      {level.description}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Khung hiển thị điểm số trung bình (Format thống nhất 2 số thập phân: 4.00/5.00) */}
            <div className="mt-5 flex items-stretch border-2 border-[#171717] max-w-[850px] text-sm sm:text-base">
              <div className="bg-[#5a5a5a] text-white px-4 sm:px-6 py-2.5 sm:py-3 font-bold shrink-0 flex items-center justify-center text-center">
                Điểm số trung bình
              </div>
              <div className="flex-1 bg-white text-[#171717] px-4 sm:px-6 py-2.5 sm:py-3 text-center text-base sm:text-lg font-black flex items-center justify-center">
                {record.total_score != null && record.total_score !== ''
                  ? `${formatScore(record.total_score)}/5.00`
                  : '-'}
              </div>
            </div>

            {/* Mục 2: Nhận xét khác từ giáo viên */}
            <div className="mt-6 text-[14px] sm:text-[15px]">
              <h3 className="font-bold text-[#171717]">2. Nhận xét khác từ giáo viên</h3>
              <div className="mt-2 whitespace-pre-wrap leading-relaxed text-[#262626] pl-1">
                {textValue(record.general_comment)}
              </div>
            </div>
          </div>

          {/* D. KẾT QUẢ (Chỉ Pass / Fail + Định hướng thêm) */}
          <div className="mt-8 avoid-break" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <h2 className="mb-3 text-[16px] sm:text-[17px] font-black uppercase text-[#ed1c24]">
              D. KẾT QUẢ
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-[420px]">
              {['Pass', 'Fail'].map((option) => {
                const isSelected = caseResult === option
                return (
                  <div
                    key={option}
                    className={cn(
                      'border-2 px-4 py-2.5 sm:py-3 text-center text-sm sm:text-base font-black transition-colors',
                      isSelected
                        ? option === 'Pass'
                          ? 'border-[#16a34a] bg-[#f0fdf4] text-[#15803d]'
                          : 'border-[#dc2626] bg-[#fef2f2] text-[#b91c1c]'
                        : 'border-[#d4d4d4] bg-white text-[#a3a3a3]',
                    )}
                  >
                    {isSelected ? 'X ' : ''}
                    {option}
                  </div>
                )
              })}

              {/* Bảo lưu dữ liệu cũ nếu có */}
              {(caseResult === '4 tháng' || caseResult === '1:1') && (
                <div className="col-span-2 border-2 border-[#f97316] bg-[#fff7ed] px-4 py-2 text-center text-sm sm:text-base font-black text-[#c2410c]">
                  X {caseResult}
                </div>
              )}
            </div>

            {/* Hiển thị định hướng thêm nếu có */}
            {specialNote ? (
              <div className="mt-4 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-xs sm:text-sm text-[#171717]">
                <span className="font-bold text-[#78350f]">* Định hướng thêm: </span>
                <span className="whitespace-pre-wrap">{specialNote}</span>
              </div>
            ) : null}
          </div>

          <footer
            className="mt-10 pt-4 border-t border-[#e5e5e5] flex flex-col sm:flex-row items-center justify-between text-xs text-[#737373] gap-2 avoid-break"
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            <span>MindX Technology School · Phiếu đánh giá năng lực học viên</span>
            <span>Form #{record.raw_id} · {formatDate(record.timestamp_at)}</span>
          </footer>
        </section>
      </article>
    </main>
  )
}
