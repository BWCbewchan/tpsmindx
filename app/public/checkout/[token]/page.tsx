import pool from '@/lib/db'
import {
  CASE_RESULT_OPTIONS,
  RUBRICS,
  SCORE_COLUMNS,
  resolveRubricType,
  type RubricConfig,
  type ScoreColumn,
} from '@/lib/trial-checkout-rubrics'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Fragment } from 'react'

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
    return value.toLocaleDateString('vi-VN')
  }

  const raw = String(value).slice(0, 10)
  const [year, month, day] = raw.split('-')
  if (!year || !month || !day) return raw || '-'
  return `${day}/${month}/${year}`
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

function caseClass(value: string) {
  if (value === 'Pass') return 'text-green-700'
  if (value === 'Fail') return 'text-red-700'
  if (value === '4 tháng') return 'text-orange-600'
  return 'text-amber-500'
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 text-[15px] leading-6 text-neutral-950">
      <dt className="font-bold">{label}:</dt>
      <dd className="font-bold">{textValue(value)}</dd>
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
    <td className="h-10 border-l-2 border-neutral-950 text-center align-middle text-[15px]">
      {scoreFor(record, scoreKey) === value ? 'X' : ''}
    </td>
  )
}

function CommonRubricTable({
  record,
  rubric,
}: {
  record: CheckoutRecord
  rubric: RubricConfig
}) {
  return (
    <table className="w-full border-collapse text-[14px] text-neutral-950">
      <thead>
        <tr>
          <th className="w-[58%] px-3 pb-3 text-center text-base font-black uppercase text-[#ed1c24]">
            Năng lực
          </th>
          <th colSpan={5} className="px-3 pb-3 text-center text-base font-black uppercase text-[#ed1c24]">
            Mức độ thể hiện
          </th>
        </tr>
        <tr className="border-b-2 border-neutral-950">
          <th />
          {SCORE_VALUES.map((score) => (
            <th key={score} className="h-9 border-l-2 border-neutral-950 text-center font-medium">
              {score}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rubric.sections.map((section, sectionIndex) => (
          <Fragment key={section.id}>
            <tr>
              <td colSpan={6} className="px-1 pt-5 text-base font-black uppercase text-[#ed1c24]">
                {sectionIndex + 1}. {section.title}
              </td>
            </tr>
            {section.criteria.map((criterion) => (
              <tr key={criterion.key} className="border-b-2 border-neutral-950">
                <td className="h-12 px-4 text-center align-middle">{criterion.label}</td>
                {SCORE_VALUES.map((score) => (
                  <ScoreMark key={score} record={record} scoreKey={criterion.key} value={score} />
                ))}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
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
    <table className="w-full border-collapse text-[14px] text-neutral-950">
      <thead>
        <tr className="border-b-2 border-neutral-950 text-[#ed1c24]">
          <th className="w-[34%] px-3 py-3 text-left text-base font-black uppercase">Năng lực</th>
          <th className="w-[12%] border-l-2 border-neutral-950 px-3 py-3 text-center text-base font-black uppercase">
            Điểm
          </th>
          <th className="border-l-2 border-neutral-950 px-3 py-3 text-left text-base font-black uppercase">
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
            <tr key={section.id} className="border-b-2 border-neutral-950">
              <td className="px-3 py-4 align-top">
                <div className="font-black uppercase text-[#ed1c24]">
                  {index + 1}. {section.title}
                </div>
                <div className="mt-1 text-neutral-700">{criterion.label}</div>
              </td>
              <td className="border-l-2 border-neutral-950 px-3 py-4 text-center align-top text-lg font-black">
                {score || '-'}
              </td>
              <td className="border-l-2 border-neutral-950 px-3 py-4 align-top">
                {level || '-'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

async function getCheckoutRecord(token: string): Promise<CheckoutRecord | null> {
  const numericId = /^\d+$/.test(token) ? Number(token) : null
  const result = await pool.query<CheckoutRecord>(
    `SELECT
        raw_id::integer AS raw_id,
        COALESCE(timestamp_at, imported_at::timestamp) AS timestamp_at,
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

  return (
    <main className="min-h-screen bg-neutral-200 px-4 py-8 text-neutral-950 print:bg-white print:p-0">
      <article className="mx-auto min-h-[1120px] max-w-[1120px] bg-white px-14 py-16 shadow-xl print:min-h-0 print:max-w-none print:px-10 print:py-8 print:shadow-none">
        <header className="grid min-h-24 grid-cols-[330px_minmax(0,1fr)] items-center bg-[#ed1c24] px-5 text-white">
          <div className="flex items-center gap-3">
            <Image src="/x_white.svg" alt="" width={38} height={42} className="h-11 w-auto" priority />
            <div>
              <div className="text-[42px] font-black leading-none">mindX</div>
              <div className="mt-1 text-[15px] font-bold leading-none">Technology School</div>
            </div>
          </div>
          <h1 className="text-center text-[28px] font-black uppercase leading-tight tracking-normal">
            Đánh giá mức độ sẵn sàng
            <br />
            cho tương lai số
          </h1>
        </header>

        <section className="mt-3">
          <h2 className="mb-2 text-[17px] font-black uppercase text-[#ed1c24]">
            A. Thông tin học viên
          </h2>
          <dl className="grid grid-cols-2 gap-x-12 gap-y-1">
            <div>
              <InfoRow label="Họ và tên Học viên" value={record.student_name} />
              <InfoRow label="Môn trải nghiệm" value={record.trial_subject} />
              <InfoRow label="Giáo viên hướng dẫn" value={record.trial_teacher_name} />
              <InfoRow label="Cơ sở" value={record.center_name} />
            </div>
            <div>
              <InfoRow label="Tuổi" value={record.student_age_label} />
              <InfoRow label="Ngày trải nghiệm" value={formatDate(record.trial_date)} />
              <InfoRow label="Tỉnh/ Thành phố" value={city} />
              <InfoRow label="Sale phụ trách" value={record.sales_owner_name} />
            </div>
          </dl>
        </section>

        <section className="mt-9">
          <h2 className="mb-1 text-[17px] font-black uppercase text-[#ed1c24]">
            B. Đánh giá năng lực
          </h2>
          <p className="text-[15px] leading-6">
            Dưới đây là Kết quả chi tiết đánh giá mức độ sẵn sàng cho Tương lai số của Học viên sau buổi trải nghiệm tại MindX
            <br />
            (Mức độ đánh giá theo thang điểm 1 - 5 tương ứng với mức độ thể hiện từ thấp đến cao):
          </p>

          <div className="mt-6">
            {rubric.mode === 'matrix' ? (
              <CommonRubricTable record={record} rubric={rubric} />
            ) : (
              <LevelRubricTable record={record} rubric={rubric} />
            )}
          </div>
        </section>

        <section className="mt-9">
          <h2 className="mb-2 text-[17px] font-black uppercase text-[#ed1c24]">
            C. Nhận xét chung
          </h2>
          <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4 border-y-2 border-neutral-950 py-4">
            <div className="font-black text-[#ed1c24]">Tổng điểm</div>
            <div className="font-bold">{formatScore(record.total_score)}</div>
            <div className="font-black text-[#ed1c24]">Nhận xét</div>
            <p className="whitespace-pre-wrap leading-6">{textValue(record.general_comment)}</p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[17px] font-black uppercase text-[#ed1c24]">
            D. Thông tin chốt case
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            {CASE_RESULT_OPTIONS.map((option) => (
              <div
                key={option.value}
                className={cn(
                  'border-2 px-4 py-3 text-center text-base font-black',
                  caseResult === option.value
                    ? 'border-[#ed1c24] bg-[#fff1f1]'
                    : 'border-neutral-300 bg-white text-neutral-400',
                  caseClass(option.value),
                )}
              >
                {caseResult === option.value ? 'X ' : ''}
                {option.label}
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-10 text-right text-xs text-neutral-500">
          Form #{record.raw_id} · {formatDate(record.timestamp_at)}
        </footer>
      </article>
    </main>
  )
}
