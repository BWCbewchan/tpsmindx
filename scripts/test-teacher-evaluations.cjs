const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText
  module._compile(output, filename)
}

const {
  classHasTeacherPointSessionInRange,
  detectSheetDateOrder,
  findBestClassMatch,
  extractSurveyScore,
  isTeacherPointExemptStudent,
  matchSheetRows,
  parseDateInputBoundary,
  parseSheetTimestamp,
  teacherPointScore,
} = require('../lib/teacher-evaluations/normalize.ts')
const {
  buildWeightedChartRows,
  deduplicateForAnalytics,
  getTeacherScoreFromAnswers,
  responseIdentity,
} = require('../lib/teacher-evaluations/analytics.ts')

const headers = {
  timestamp: 'Timestamp',
  studentName: 'Tên của em là?',
  classCode: 'Mã lớp của em là?',
  centreCode: 'Mã cơ sở của em là?',
  teacherUnderstandability: 'Giáo viên lớp em giảng bài dễ hiểu chứ?',
  teacherAffinity: 'Em yêu thích Giáo viên lớp mình chứ?',
}

function sheetRow(rowNumber, values) {
  return {
    rowNumber,
    values: {
      [headers.timestamp]: '14/10/2026 08:30:00',
      [headers.studentName]: 'Nguyễn Minh An',
      [headers.classCode]: '',
      [headers.centreCode]: '',
      [headers.teacherUnderstandability]: '5 - Rất dễ hiểu',
      [headers.teacherAffinity]: '4',
      ...values,
    },
  }
}

const classFixture = {
  id: 'class-1',
  name: 'TL-C4K-JSB01',
  status: 'RUNNING',
  centre: { id: 'centre-1', name: 'MindX Tên Lửa', shortName: 'TL' },
  students: [],
  slots: [],
}

const parsedDate = parseSheetTimestamp('14/10/2026 08:30:00', 'DMY')
assert.equal(parsedDate?.toISOString(), '2026-10-14T01:30:00.000Z')
assert.equal(detectSheetDateOrder(['10/14/2026 08:30:00']), 'MDY')
assert.equal(detectSheetDateOrder(['14/10/2026 08:30:00']), 'DMY')
assert.equal(detectSheetDateOrder(['10/11/2026 08:30:00']), 'MDY')
assert.equal(parseDateInputBoundary('2026-02-30'), null)
assert.equal(extractSurveyScore('4.5 / 5'), 4.5)
assert.equal(extractSurveyScore('0.5'), null)

const directMatch = findBestClassMatch(sheetRow(2, {
  [headers.classCode]: 'C4K-JSB01',
  [headers.centreCode]: 'Tên Lửa',
}), [classFixture])
assert.equal(directMatch.matchedClass?.id, 'class-1')
assert.equal(directMatch.matchMethod, 'direct')
assert.equal(directMatch.teacherScore, 4.5)

const swappedColumns = findBestClassMatch(sheetRow(3, {
  [headers.studentName]: 'TL-C4K-JSB01',
  [headers.classCode]: 'Nguyễn Minh An',
  [headers.centreCode]: 'TL',
}), [classFixture])
assert.equal(swappedColumns.studentName, 'Nguyễn Minh An')
assert.equal(swappedColumns.matchedClass?.id, 'class-1')

const oneNeighbor = matchSheetRows([
  sheetRow(4, { [headers.classCode]: 'TL-C4K-JSB01' }),
  sheetRow(5, { [headers.classCode]: 'JKB401' }),
], [classFixture])
assert.equal(oneNeighbor[1].matchMethod, 'inferred')
assert.equal(oneNeighbor[1].matchedClass?.id, 'class-1')

const twoNeighbors = matchSheetRows([
  sheetRow(6, { [headers.classCode]: 'TL-C4K-JSB01' }),
  sheetRow(7, { [headers.classCode]: 'JKB401' }),
  sheetRow(8, { [headers.classCode]: 'TL-C4K-JSB01' }),
], [classFixture])
assert.equal(twoNeighbors[1].matchMethod, 'inferred')
assert.equal(twoNeighbors[1].matchedClass?.id, 'class-1')

assert.equal(teacherPointScore(95), 5)
assert.equal(teacherPointScore(81), 4)
assert.equal(teacherPointScore(71), 3)
assert.equal(teacherPointScore(51), 2)
assert.equal(teacherPointScore(50.9), 1)
assert.equal(teacherPointScore(null), null)

assert.equal(isTeacherPointExemptStudent({
  activeInClass: false,
  student: { id: 'student-1' },
}, []), true)
assert.equal(isTeacherPointExemptStudent({
  activeInClass: false,
  student: { id: 'student-1' },
}, [{ studentAttendance: [{ student: { id: 'student-1' } }] }]), false)
assert.equal(isTeacherPointExemptStudent({
  activeInClass: true,
  completionInfo: { reason: 'On hold' },
  student: { id: 'student-2' },
}, []), true)

const unsortedSlots = [
  '2026-10-08T03:00:00.000Z',
  '2026-10-01T03:00:00.000Z',
  '2026-10-04T03:00:00.000Z',
  '2026-10-03T03:00:00.000Z',
  '2026-10-02T03:00:00.000Z',
  '2026-10-06T03:00:00.000Z',
  '2026-10-07T03:00:00.000Z',
  '2026-10-05T03:00:00.000Z',
].map((date, index) => ({ _id: `slot-${index}`, date }))
assert.equal(classHasTeacherPointSessionInRange(
  { ...classFixture, slots: unsortedSlots },
  new Date('2026-10-04T00:00:00.000Z'),
  new Date('2026-10-04T23:59:59.999Z'),
), true)

assert.equal(getTeacherScoreFromAnswers([
  { questionId: 'teacher-1', title: 'Câu hỏi tùy biến', group: 'GIÁO VIÊN', answer: '5 - Rất tốt' },
  { questionId: 'teacher-2', title: 'Một câu khác', group: 'TEACHER', answer: '4' },
  { questionId: 'course-1', title: 'Nội dung khóa học', group: 'COURSE', answer: '1' },
]), 4.5)
assert.equal(getTeacherScoreFromAnswers([
  { questionId: 'fallback-1', title: headers.teacherUnderstandability, answer: '3' },
  { questionId: 'fallback-2', title: headers.teacherAffinity, answer: '5' },
]), 4)

const lmsEntry = {
  source: 'lms',
  id: 'ticket-1',
  classId: 'class-1',
  className: 'TL-C4K-JSB01',
  studentId: 'student-1',
  studentName: 'Nguyễn Minh An',
  createdAt: '2026-10-14T02:00:00.000Z',
  teacherScore: null,
}
const googleEntry = {
  source: 'google_sheets',
  id: 'sheet-row-2',
  classId: 'class-1',
  className: 'TL-C4K-JSB01',
  studentId: 'student-1',
  studentName: 'Nguyễn Minh An',
  timestamp: '2026-10-14T03:00:00.000Z',
  teacherScore: 4.5,
}
assert.equal(responseIdentity(lmsEntry), responseIdentity(googleEntry))
const deduplicated = deduplicateForAnalytics([lmsEntry, googleEntry])
assert.equal(deduplicated.length, 1)
assert.equal(deduplicated[0].source, 'google_sheets')
assert.equal(deduplicated[0].teacherScore, 4.5)
assert.equal(deduplicateForAnalytics([
  { ...lmsEntry, teacherScore: 4 },
  googleEntry,
])[0].source, 'lms')
assert.equal(deduplicateForAnalytics([
  lmsEntry,
  { ...googleEntry, timestamp: '2026-10-15T03:00:00.000Z' },
]).length, 2)

const chartRows = buildWeightedChartRows([
  {
    courseLineName: 'Coding',
    eligibleStudents: 10,
    collectedResponses: 8,
    teacherScoreTotal: 5,
    scoredResponseCount: 1,
    analyticsResponseCount: 1,
  },
  {
    courseLineName: 'Coding',
    eligibleStudents: 20,
    collectedResponses: 16,
    teacherScoreTotal: 27,
    scoredResponseCount: 9,
    analyticsResponseCount: 9,
  },
], (summary) => summary.courseLineName)
assert.equal(chartRows.length, 1)
assert.equal(chartRows[0].averageTeacherScore, 3.2)
assert.equal(chartRows[0].responses, 10)
assert.equal(chartRows[0].collectionRate, 80)

console.log('Teacher evaluation tests passed.')
