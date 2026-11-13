const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

require('dotenv').config({ quiet: true })

const projectRoot = path.resolve(__dirname, '..')
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith('@/')
    ? path.join(projectRoot, request.slice(2))
    : request
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options)
}

require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  module._compile(output, filename)
}

const {
  getLectureReviewHcRecipient,
  resolveLectureReviewHcArea,
} = require('../lib/lecture-review-hc-routing.ts')
const { renderTemplate } = require('../app/api/emails/render.ts')

const cases = [
  [{ region: 'HN 1', name: 'HN - 176 Định Công' }, 'hn'],
  [{ region: 'HN 2', name: 'HN - 29T1 Hoàng Đạo Thúy' }, 'hn'],
  [{ region: 'HCM 4', name: 'HCM - Khu Tên Lửa' }, 'hcm'],
  [{ region: 'ONLINE', name: 'MindX - Online - HN' }, 'hn'],
  [{ region: 'ONLINE', name: 'MindX Digital Art' }, 'hcm'],
  [{ region: 'MiniBU', name: 'MindX Vinhomes Central Park' }, 'hcm'],
  [{ region: 'TỈNH NAM', name: 'Cần Thơ - 153Q Trần Hưng Đạo' }, 'province'],
  [{ region: 'TỈNH BẮC', name: 'Bắc Ninh - 09 Lê Thái Tổ' }, 'province'],
  [{ region: 'TỈNH TRUNG', name: 'Đà Nẵng - 255-257 Hùng Vương' }, 'province'],
]

for (const [center, expected] of cases) {
  assert.equal(resolveLectureReviewHcArea(center), expected, JSON.stringify(center))
}

assert.equal(getLectureReviewHcRecipient('hn').email, process.env.LECTURE_REVIEW_HC_HN_EMAIL?.trim() || 'kydai2507@gmail.com')
assert.equal(getLectureReviewHcRecipient('hcm').email, process.env.LECTURE_REVIEW_HC_HCM_EMAIL?.trim() || 'kydai2004@gmail.com')
assert.equal(getLectureReviewHcRecipient('province').email, process.env.LECTURE_REVIEW_HC_PROVINCE_EMAIL?.trim() || 'kydai2507mindx@gmail.com')

const renderedTemplate = renderTemplate('lecture-review-hc-invitation', {
  hc_area: 'Hồ Chí Minh',
  reviewer_name: 'Thầy Cao Quang Sơn',
  candidate_name: 'Trần Kỳ Đại',
  lms_code: 'daitk',
  review_time: '09:30',
  review_date: '20/11/2026',
  center_name: 'HCM - Khu Tên Lửa',
  room_name: 'Phòng 2',
  registered_by_name: 'Người đăng ký kiểm thử',
})
for (const expected of [
  'Hồ Chí Minh',
  'Thầy Cao Quang Sơn',
  'Trần Kỳ Đại',
  'daitk',
  '09:30 – 20/11/2026',
  'HCM - Khu Tên Lửa – Phòng 2',
  'Người đăng ký kiểm thử',
]) {
  assert.ok(renderedTemplate.includes(expected), `Thiếu nội dung email: ${expected}`)
}
assert.doesNotMatch(renderedTemplate, /\{\{[a-z_]+\}\}/i)

console.log('PASS: phân vùng HC, địa chỉ nhận và nội dung email đúng cấu hình.')

async function sendSamples() {
  const { sendLectureReviewHcInvitation } = require('../lib/lecture-review-hc-emails.ts')
  const timestamp = Date.now()
  const samples = [
    {
      area: 'HN',
      centerId: -101,
      centerName: 'HN - Cơ sở kiểm thử email',
      centerRegion: 'HN 1',
    },
    {
      area: 'HCM',
      centerId: -102,
      centerName: 'HCM - Cơ sở kiểm thử email',
      centerRegion: 'HCM 1',
    },
    {
      area: 'Tỉnh',
      centerId: -103,
      centerName: 'Tỉnh - Cơ sở kiểm thử email',
      centerRegion: 'TỈNH NAM',
    },
  ]

  for (const sample of samples) {
    const result = await sendLectureReviewHcInvitation(
      {
        applicationId: `TEST-${sample.area}-${timestamp}`,
        candidateName: `Ứng viên kiểm thử ${sample.area}`,
        lmsCode: `test-${sample.area.toLowerCase()}`,
        reviewDate: '2026-11-20',
        reviewTime: '09:30',
        teachingBlock: 'coding',
        centerId: sample.centerId,
        centerName: sample.centerName,
        roomName: 'Phòng kiểm thử 01',
        centerRegion: sample.centerRegion,
        leaderName: 'Leader kiểm thử TPS',
        reviewerName: 'Thầy Hoàng Việt Hùng',
        registeredByName: 'Hệ thống kiểm thử TPS',
        registeredByEmail: 'test@mindx.edu.vn',
      },
      { test: true, script: 'test-lecture-review-hc-emails' },
    )

    console.log(`${sample.area}:`, result.sent ? 'SENT' : 'FAILED', {
      recipient: result.recipient.email,
      messageId: result.messageId,
      warning: result.warning,
      error: result.error,
    })
    if (!result.sent) process.exitCode = 1
  }
}

if (process.argv.includes('--send')) {
  sendSamples().catch((error) => {
    console.error('FAIL:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
