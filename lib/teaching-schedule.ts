export const TEACHING_SCHEDULE_ALLOWED_ROLE_CODES = [
  'TEGL+',
  'TEGL',
  'HO',
  'LEADER',
  'LEAD',
  'CL',
  'RL',
  'AL',
  'TE',
  'TC',
  'TF',
] as const

export const TEACHING_SCHEDULE_MANUAL_ROSTER = [
  { order: 1, code: 'I0227', name: 'Nguyễn Hồng Hà', roleCode: 'TEGL' },
  { order: 2, code: 'I0671', name: 'Trần Huy Vũ', roleCode: 'TEGL' },
  { order: 3, code: 'I0797', name: 'Cao Quang Sơn', roleCode: 'TEGL' },
  { order: 4, code: 'I0798', name: 'Hoàng Việt Hùng', roleCode: 'TEGL' },
  { order: 5, code: 'I0804', name: 'Trần Văn Nghĩa', roleCode: 'TEGL' },
  { order: 6, code: 'I1163', name: 'Nguyễn Hoàng Tuấn', roleCode: 'CL' },
  { order: 7, code: 'I1316', name: 'Phạm Tiến Thịnh', roleCode: 'TEGL' },
  { order: 8, code: 'I1503', name: 'Trần Anh Vũ', roleCode: 'TE' },
  { order: 9, code: 'I1833', name: 'Lê Hồng Quân', roleCode: 'RL' },
  { order: 10, code: 'I1871', name: 'Nguyễn Gia Thịnh', roleCode: 'CL' },
  { order: 11, code: 'I2133', name: 'Nguyễn Hoàng Khôi Nguyên', roleCode: 'CL' },
  { order: 12, code: 'I2202', name: 'Phan Ngọc Hoàng Anh', roleCode: 'TEGL' },
  { order: 13, code: 'I2224', name: 'Nguyễn Hà Thanh', roleCode: 'AL' },
  { order: 14, code: 'I2325', name: 'Nguyễn Cảnh An', roleCode: 'TEGL' },
  { order: 15, code: 'I2347', name: 'Giáp Hoàng Sơn', roleCode: 'TE' },
  { order: 16, code: 'I2434', name: 'Phạm Anh Tuấn', roleCode: 'TE' },
  { order: 17, code: 'I2591', name: 'Phạm Thanh Nhàn', roleCode: 'TE' },
  { order: 18, code: 'I2803', name: 'Trương Thị Thanh Bình', roleCode: 'TC' },
  { order: 19, code: 'I1169', name: 'Trần Ngọc Tân', roleCode: 'TEGL' },
  { order: 20, code: 'I1170', name: 'Trần Đăng Khoa', roleCode: 'TEGL' },
  { order: 21, code: 'I3224', name: 'Nguyễn Trung', roleCode: 'TE' },
  { order: 22, code: 'I3020', name: 'Lê Khánh Tùng', roleCode: 'TE' },
  { order: 23, code: 'I3470', name: 'Lê Thế Khiêm', roleCode: 'TE' },
  { order: 24, code: 'I1810', name: 'Cao Duy Quang', roleCode: 'TE' },
  { order: 25, code: 'I3817', name: 'Nguyễn Huy Hoàng', roleCode: 'CL' },
  { order: 26, code: 'I2643', name: 'Lê Quý Vương', roleCode: 'TE' },
  { order: 27, code: 'I3022', name: 'Đỗ Tuấn Minh', roleCode: 'TE' },
  { order: 28, code: 'I3021', name: 'Nguyễn Ngọc Khánh', roleCode: 'TE' },
  { order: 29, code: 'I3750', name: 'Nguyễn Tiến Đạt', roleCode: 'TE' },
  { order: 30, code: 'I1968', name: 'Đoàn Quỳnh Trang', roleCode: 'TEGL' },
  { order: 31, code: 'I0228', name: 'Nguyễn Văn Cường', roleCode: 'TEGL' },
  { order: 32, code: 'I4026', name: 'Trần Chí Bảo', roleCode: 'RL' },
  { order: 33, code: 'I1746', name: 'Đặng Trần Trà My', roleCode: 'AL' },
  { order: 34, code: 'I4127', name: 'Hà Vũ Thanh Huyền', roleCode: 'TC' },
  { order: 35, code: 'I2418', name: 'Đỗ Thành Trung', roleCode: 'TF' },
  { order: 36, code: 'I2257', name: 'Đàm Chí Công', roleCode: 'TF' },
  { order: 37, code: 'I3923', name: 'Nguyễn Thùy Linh', roleCode: 'TF' },
  { order: 38, code: 'I2453', name: 'Phạm Thị Thuỳ Dương', roleCode: 'TF' },
  { order: 39, code: 'I2522', name: 'Huỳnh Hải Bằng', roleCode: 'CL' },
  { order: 40, code: 'I1997', name: 'Nguyễn Phúc Hội', roleCode: 'TF' },
  { order: 41, code: 'I3583', name: 'Dương Anh Quang', roleCode: 'TF' },
  { order: 42, code: 'I3914', name: 'Kiều Viết Long', roleCode: 'TF' },
  { order: 43, code: 'I3923', name: 'Nguyễn Thùy Linh', roleCode: 'TF' },
  { order: 44, code: 'I3981', name: 'Vũ Thái Việt Dũng', roleCode: 'TF' },
  { order: 45, code: 'I4186', name: 'Thái Thị Hồng Đào', roleCode: 'AL' },
  { order: 46, code: 'I2414', name: 'Nguyễn Văn Huy', roleCode: 'TF' },
  { order: 47, code: 'I4295', name: 'Huỳnh Minh Nhựt', roleCode: 'RL' },
  { order: 48, code: 'I4246', name: 'Nguyễn Quốc Thành', roleCode: 'HO' },
  { order: 49, code: 'I4248', name: 'Lê Thanh Thảo', roleCode: 'HO' },
  { order: 50, code: 'I4247', name: 'Chung Thuỵ Mỹ', roleCode: 'TF' },
  { order: 51, code: 'I4249', name: 'Nguyễn Trọng Quý Mạnh', roleCode: 'TE' },
  { order: 52, code: 'I1727', name: 'Nguyễn Sỹ Thành Hưng', roleCode: 'CL' },
  { order: 53, code: 'I4360', name: 'Phùng Tiến Thưởng', roleCode: 'RL' },
  { order: 54, code: 'I4480', name: 'Vũ Trung Đức', roleCode: 'TF' },
  { order: 55, code: 'I4477', name: 'Hồ Anh Đức', roleCode: 'TC' },
  { order: 56, code: 'I4662', name: 'Lê Đình Long', roleCode: 'TF' },
  { order: 57, code: 'I4694', name: 'Trịnh Hưng Thịnh', roleCode: 'TF' },
  { order: 58, code: 'I4877', name: 'Lê Thị Thảo', roleCode: 'TF' },
  { order: 59, code: 'I4885', name: 'Vũ Nam Đàn', roleCode: 'TF' },
  { order: 60, code: 'I4916', name: 'Trần Kỳ Đại', roleCode: 'TF' },
  { order: 61, code: 'I4912', name: 'Huỳnh Nhật Anh', roleCode: 'TF' },
  { order: 62, code: 'I4884', name: 'Hồ Xuân Hoàn', roleCode: 'TF' },
  { order: 63, code: 'I4815', name: 'Nguyễn Vũ Ngọc Phương', roleCode: 'TF' },
  { order: 64, code: 'I4997', name: 'Trần Thị Minh Anh', roleCode: 'TF' },
  { order: 65, code: 'I5067', name: 'Nguyễn Tấn Dũng', roleCode: 'TF' },
  { order: 66, code: 'I5113', name: 'Phạm Nguyễn Đại Toàn', roleCode: 'TF' },
  { order: 67, code: 'I4998', name: 'Trần Thị Linh Trang', roleCode: 'TF' },
] as const

export const TEACHING_SCHEDULE_SESSIONS = {
  morning: { label: 'Sáng', from: '08:30', to: '12:30' },
  afternoon: { label: 'Chiều', from: '14:00', to: '18:00' },
  evening: { label: 'Tối', from: '18:00', to: '21:30' },
} as const

export const TEACHING_POSITION_WORK_RULES = [
  {
    position: 'TEGL',
    total: '8h/ngày, 5 ngày/tuần',
    hours: ['09:00 – 18:00', 'Sáng: 09:00 – 12:30', 'Nghỉ trưa: 12:30 – 13:30', 'Chiều: 13:30 – 18:00'],
    daysOff: ['Được nghỉ 01 ngày Thứ 7 hoặc Chủ nhật', 'Chọn 01 ngày nghỉ trong tuần', 'Riêng TEGL K18 nghỉ Thứ 7 và Chủ nhật'],
  },
  {
    position: 'TE, TC, AL, CL',
    total: '7h/ngày, 6 ngày/tuần',
    hours: ['Sắp xếp theo ca làm việc'],
    daysOff: ['Ngày nghỉ linh hoạt nhưng không được nghỉ vào Thứ 7, Chủ nhật'],
  },
  {
    position: 'Admin, HR, TD',
    total: '8h/ngày, 5 ngày/tuần',
    hours: ['09:00 – 18:00', 'Sáng: 09:00 – 12:30', 'Nghỉ trưa: 12:30 – 13:30', 'Chiều: 13:30 – 18:00'],
    daysOff: ['Nghỉ Thứ 7 và Chủ nhật'],
  },
  {
    position: 'TF',
    total: 'Theo từng thời điểm. Ngày có phát sinh giảng dạy trong tuần điền “TF” theo lịch tháng.',
    hours: ['Ca sáng: 09:00 – 18:00', 'Nghỉ trưa: 12:00 – 13:00', 'Ca chiều: 13:30 – 21:00', 'Nghỉ ăn ca: 17:30 – 18:00'],
    daysOff: [],
  },
] as const

export const TEACHING_SHIFT_RULES = [
  { shift: 'Ca 1', hours: ['09:00 – 18:00', 'Nghỉ trưa: 12:00 – 14:00'], note: 'Sáng + Chiều' },
  { shift: 'Ca 2', hours: ['13:30 – 21:00', 'Nghỉ ăn ca: 17:30 – 18:00'], note: 'Chiều + Tối' },
  { shift: 'Ca Sáng', hours: ['08:30 – 12:30'], note: 'Sáng' },
  { shift: 'Ca Chiều', hours: ['14:00 – 18:00'], note: 'Chiều' },
  { shift: 'Ca Tối', hours: ['18:00 – 21:30'], note: 'Tối' },
] as const

export type TeachingScheduleSession = keyof typeof TEACHING_SCHEDULE_SESSIONS

export const TEACHING_SCHEDULE_PATTERNS = [
  {
    value: 'morning_afternoon_evening',
    label: 'Sáng + Chiều + Tối',
    shortLabel: 'Cả ngày',
    description: 'Có mặt đủ ba ca',
    sessions: ['morning', 'afternoon', 'evening'],
    category: 'onsite',
  },
  {
    value: 'morning_afternoon',
    label: 'Sáng + Chiều',
    shortLabel: 'Sáng · Chiều',
    description: 'Có mặt hai ca ban ngày',
    sessions: ['morning', 'afternoon'],
    category: 'onsite',
  },
  {
    value: 'afternoon_evening',
    label: 'Chiều + Tối',
    shortLabel: 'Chiều · Tối',
    description: 'Có mặt hai ca cuối ngày',
    sessions: ['afternoon', 'evening'],
    category: 'onsite',
  },
  {
    value: 'morning_evening',
    label: 'Sáng + Tối',
    shortLabel: 'Sáng · Tối',
    description: 'Có mặt ca sáng và ca tối',
    sessions: ['morning', 'evening'],
    category: 'onsite',
  },
  {
    value: 'morning',
    label: 'Sáng',
    shortLabel: 'Sáng',
    description: '08:30 – 12:30',
    sessions: ['morning'],
    category: 'onsite',
  },
  {
    value: 'afternoon',
    label: 'Chiều',
    shortLabel: 'Chiều',
    description: '14:00 – 18:00',
    sessions: ['afternoon'],
    category: 'onsite',
  },
  {
    value: 'evening',
    label: 'Tối',
    shortLabel: 'Tối',
    description: '18:00 – 21:30',
    sessions: ['evening'],
    category: 'onsite',
  },
  {
    value: 'wfh',
    label: 'WFH',
    shortLabel: 'WFH',
    description: 'Làm việc từ xa',
    sessions: [],
    category: 'remote',
  },
  {
    value: 'day_off',
    label: 'Ngày nghỉ',
    shortLabel: 'Nghỉ',
    description: 'Ngày nghỉ theo lịch',
    sessions: [],
    category: 'off',
  },
  {
    value: 'leave',
    label: 'Phép',
    shortLabel: 'Phép',
    description: 'Nghỉ phép đã đăng ký',
    sessions: [],
    category: 'leave',
  },
  {
    value: 'holiday',
    label: 'Nghỉ lễ',
    shortLabel: 'Nghỉ lễ',
    description: 'Ngày nghỉ lễ',
    sessions: [],
    category: 'holiday',
  },
  {
    value: 'full_time',
    label: 'TF',
    shortLabel: 'Theo lịch TF',
    description: 'Theo lịch làm việc full-time riêng',
    sessions: [],
    category: 'fulltime',
  },
] as const satisfies ReadonlyArray<{
  value: string
  label: string
  shortLabel: string
  description: string
  sessions: readonly TeachingScheduleSession[]
  category: 'onsite' | 'remote' | 'off' | 'leave' | 'holiday' | 'fulltime'
}>

export type TeachingSchedulePattern =
  (typeof TEACHING_SCHEDULE_PATTERNS)[number]['value']

export type TeachingSchedulePatternMeta =
  (typeof TEACHING_SCHEDULE_PATTERNS)[number]

export const TEACHING_SCHEDULE_PATTERN_VALUES = new Set<string>(
  TEACHING_SCHEDULE_PATTERNS.map((item) => item.value),
)

export function getTeachingSchedulePattern(
  value: string | null | undefined,
): TeachingSchedulePatternMeta | undefined {
  return TEACHING_SCHEDULE_PATTERNS.find((item) => item.value === value)
}

export function isTeachingSchedulePattern(
  value: unknown,
): value is TeachingSchedulePattern {
  return (
    typeof value === 'string' &&
    TEACHING_SCHEDULE_PATTERN_VALUES.has(value)
  )
}

export function isOnsiteTeachingSchedulePattern(
  value: TeachingSchedulePattern,
): boolean {
  return getTeachingSchedulePattern(value)?.category === 'onsite'
}
