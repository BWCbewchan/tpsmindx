export type TrialTrack = 'Coding' | 'Robotics' | 'Art'

export type RubricType = 'common' | 'robotics4' | 'art'

export type ScoreColumn =
  | 'ht1'
  | 'ht2'
  | 'ht3'
  | 'st1'
  | 'st2'
  | 'lg1'
  | 'lg2'
  | 'gt1'
  | 'gt2'
  | 'rob4b_1'
  | 'rob4b_2'
  | 'rob4b_3'
  | 'rob4b_4'
  | 'art4p_1'
  | 'art4p_2'
  | 'art4p_3'
  | 'art4p_4'
  | 'art4p_5'

export type ScoreMap = Partial<Record<ScoreColumn, number>>

export type RubricCriterion = {
  key: ScoreColumn
  label: string
  levels?: string[]
}

export type RubricSection = {
  id: string
  title: string
  criteria: RubricCriterion[]
}

export type RubricConfig = {
  type: RubricType
  title: string
  note: string
  mode: 'matrix' | 'level-list'
  sections: RubricSection[]
}

export const SCORE_COLUMNS: ScoreColumn[] = [
  'ht1',
  'ht2',
  'ht3',
  'st1',
  'st2',
  'lg1',
  'lg2',
  'gt1',
  'gt2',
  'rob4b_1',
  'rob4b_2',
  'rob4b_3',
  'rob4b_4',
  'art4p_1',
  'art4p_2',
  'art4p_3',
  'art4p_4',
  'art4p_5',
]

export const TRACKS: Array<{
  value: TrialTrack
  label: string
  description: string
}> = [
  { value: 'Coding', label: 'Coding', description: 'SB, GB, Web, JSB, PTB' },
  { value: 'Robotics', label: 'Robotics', description: 'ROB4B, PreB, Lego 6+, ArmB, SemiB' },
  { value: 'Art', label: 'Art', description: 'Digital Art & Design' },
]

export const SUBJECT_OPTIONS: Record<TrialTrack, string[]> = {
  Coding: ['SB', 'GB', 'Web', 'JSB', 'PTB'],
  Robotics: ['ROB4B', 'PreB', 'Lego 6+', 'ArmB', 'SemiB'],
  Art: [
    'LITTLE ARTIST',
    'DIGITAL ART FOUNDATIONS',
    'VISUAL THINKING',
    'GAME ART',
    'Character & Mascot Design',
    'VISUAL COMMUNICATION',
  ],
}

export const ALL_SUBJECT_OPTIONS = Array.from(
  new Set(Object.values(SUBJECT_OPTIONS).flat()),
)

export const LEGACY_ART_SUBJECT_OPTIONS = ['VA', 'VC', 'KA', 'GD', 'ART4B', 'AI']

export const MANAGE_SUBJECT_OPTIONS: Record<TrialTrack, string[]> = {
  Coding: SUBJECT_OPTIONS.Coding,
  Robotics: SUBJECT_OPTIONS.Robotics,
  Art: Array.from(new Set([...SUBJECT_OPTIONS.Art, ...LEGACY_ART_SUBJECT_OPTIONS])),
}

export const ALL_MANAGE_SUBJECT_OPTIONS = Array.from(
  new Set(Object.values(MANAGE_SUBJECT_OPTIONS).flat()),
)

export const CASE_RESULT_OPTIONS = [
  {
    value: 'Pass',
    label: 'Pass',
    className: 'text-green-700',
    description: 'Học viên đáp ứng đầy đủ các tiêu chí đánh giá năng lực đầu vào.',
  },
  {
    value: 'Fail',
    label: 'Fail',
    className: 'text-red-700',
    description: 'Học viên không đáp ứng được các tiêu chí đánh giá năng lực đầu vào.',
  },
  {
    value: '4 tháng',
    label: '4 tháng',
    className: 'text-orange-600',
    description: 'Học viên đáp ứng được một vài tiêu chí, nhưng cần theo dõi thêm trong quá trình học.',
  },
  {
    value: '1:1',
    label: '1:1',
    className: 'text-amber-500',
    description: 'Trường hợp học viên đặc biệt, có yêu cầu từ phụ huynh.',
  },
] as const

export type CaseResult = (typeof CASE_RESULT_OPTIONS)[number]['value']

export const COMMON_RUBRIC: RubricConfig = {
  type: 'common',
  title: 'Tiêu chí đánh giá cho các bộ môn: PreB, ArmB, SemiB, SB, GB, Web, JSB, PTB',
  note: 'Chấm từng tiêu chí theo thang 1-5, 1 là thấp nhất và 5 là cao nhất.',
  mode: 'matrix',
  sections: [
    {
      id: 'self-learning',
      title: 'NĂNG LỰC TỰ CHỦ TRONG HỌC TẬP',
      criteria: [
        {
          key: 'ht1',
          label: 'Hoàn thành thử thách trong khoảng thời gian quy định',
        },
        {
          key: 'ht2',
          label: 'Biết cách ứng dụng công nghệ để hoàn thành thử thách',
        },
        {
          key: 'ht3',
          label: 'Có kiến thức nền tảng (về văn hoá, tự nhiên, xã hội...)',
        },
      ],
    },
    {
      id: 'creative',
      title: 'NĂNG LỰC SÁNG TẠO',
      criteria: [
        {
          key: 'st1',
          label:
            'Sản phẩm tạo ra trong quá trình trải nghiệm có tính sáng tạo (cốt truyện, xây dựng nhân vật, màu sắc, âm thanh, v.v.)',
        },
        {
          key: 'st2',
          label: 'Khả năng biến tấu từ mẫu có sẵn, tạo ra sản phẩm độc đáo',
        },
      ],
    },
    {
      id: 'logic',
      title: 'NĂNG LỰC TƯ DUY LOGIC',
      criteria: [
        {
          key: 'lg1',
          label:
            'Biết cách tổ chức suy nghĩ và hành động theo các bước logic và trình tự',
        },
        {
          key: 'lg2',
          label:
            'Khi gặp lỗi hoặc vấn đề khi lập trình, học viên biết cách xác định và sửa chữa các lỗi',
        },
      ],
    },
    {
      id: 'communication',
      title: 'NĂNG LỰC GIAO TIẾP',
      criteria: [
        {
          key: 'gt1',
          label: 'Thuyết trình chia sẻ ý tưởng, sản phẩm',
        },
        {
          key: 'gt2',
          label: 'Mạnh dạn, tự tin trong giao tiếp, đặt câu hỏi khi cần',
        },
      ],
    },
  ],
}

export const ROBOTICS4_RUBRIC: RubricConfig = {
  type: 'robotics4',
  title: 'Tiêu chí đánh giá cho Robotics 4+',
  note: 'Mỗi nhóm năng lực chọn một mức mô tả phù hợp nhất.',
  mode: 'level-list',
  sections: [
    {
      id: 'recognition',
      title: 'I. NĂNG LỰC NHẬN BIẾT VÀ KHÁM PHÁ',
      criteria: [
        {
          key: 'rob4b_1',
          label: 'Nhận biết và khám phá bộ học cụ',
          levels: [
            'Học viên cần giáo viên hỗ trợ phân biệt hình dạng và màu sắc chi tiết lắp ráp.',
            'Học viên nhận diện được màu sắc và hình dạng của các chi tiết lắp ráp, nhưng vẫn còn một số nhầm lẫn và cần giáo viên hỗ trợ.',
            'Học viên nhận diện đúng hình dạng và màu sắc của các chi tiết lắp ráp.',
            'Học viên nhận biết đúng màu sắc, hình dạng chi tiết lắp ráp. Có thể diễn đạt đơn giản chức năng của các bộ phận trong mô hình.',
            'Học viên nhận diện đúng hình dạng, màu sắc chi tiết lắp ráp, nhớ tên mô hình và thể hiện sự sáng tạo qua việc cải tiến mô hình.',
          ],
        },
      ],
    },
    {
      id: 'assembly',
      title: 'II. NĂNG LỰC LẮP RÁP VÀ TƯ DUY KHÔNG GIAN',
      criteria: [
        {
          key: 'rob4b_2',
          label: 'Lắp ráp và tư duy không gian',
          levels: [
            'Học viên gặp nhiều khó khăn trong việc chọn đúng chi tiết và lắp ráp. Sai sót nhiều, cần giáo viên hướng dẫn liên tục.',
            'Học viên chọn đúng chi tiết nhưng gặp khó khăn về hướng và vị trí lắp ráp. Cần giáo viên hỗ trợ thường xuyên.',
            'Học viên chọn đúng chi tiết, xác định đúng hướng và vị trí nhưng đôi khi mắc lỗi. Cần giáo viên nhắc nhở để sửa sai.',
            'Học viên lắp ráp chính xác, đôi khi sai nhưng có thể sửa lại khi được gợi ý.',
            'Học viên chọn đúng chi tiết, lắp ráp chính xác, có thể tự sửa sai mà không cần hỗ trợ.',
          ],
        },
      ],
    },
    {
      id: 'programming',
      title: 'III. NĂNG LỰC LẬP TRÌNH',
      criteria: [
        {
          key: 'rob4b_3',
          label: 'Lập trình Robotics',
          levels: [
            'Học viên chưa thể kéo thả khối lệnh, gặp nhiều khó khăn ngay cả khi có giáo viên hỗ trợ.',
            'Học viên có thể kéo thả nhưng chương trình chưa chạy đúng, cần giáo viên chỉnh sửa.',
            'Học viên kéo thả và lập trình để mô hình hoạt động đơn giản, nhưng vẫn cần gợi ý.',
            'Học viên lập trình đúng theo yêu cầu, không cần nhiều sự hỗ trợ.',
            'Học viên thao tác nhanh, chính xác, chủ động điều chỉnh thông số trong chương trình.',
          ],
        },
      ],
    },
    {
      id: 'collaboration',
      title: 'IV. NĂNG LỰC GIAO TIẾP VÀ HỢP TÁC',
      criteria: [
        {
          key: 'rob4b_4',
          label: 'Giao tiếp và hợp tác',
          levels: [
            'Học viên chưa phản hồi hoặc chưa hợp tác với giáo viên trong quá trình học.',
            'Học viên có phản hồi ngắn nhưng chưa thực sự hợp tác với giáo viên, chưa tham gia vào hoạt động lắp ráp mô hình.',
            'Học viên có phản hồi và hợp tác với giáo viên, tuy nhiên vẫn còn rụt rè, chưa thực sự tự tin khi tham gia trải nghiệm.',
            'Học viên chủ động giao tiếp, sẵn sàng trò chuyện và hợp tác với giáo viên trong các hoạt động.',
            'Học viên giao tiếp tự tin, hợp tác tốt với giáo viên và sẵn sàng chia sẻ về mô hình hoặc câu chuyện của mình.',
          ],
        },
      ],
    },
  ],
}

export const ART_RUBRIC: RubricConfig = {
  type: 'art',
  title: 'Tiêu chí đánh giá cho Art',
  note: 'Chọn một mức biểu hiện cho từng nhóm năng lực Art.',
  mode: 'level-list',
  sections: [
    {
      id: 'aesthetic',
      title: 'I. NĂNG LỰC THẨM MỸ',
      criteria: [
        {
          key: 'art4p_1',
          label: 'Năng lực thẩm mỹ',
          levels: [
            'Ý thức được 1 vài yếu tố thẩm mỹ',
            'Ý thức được nhiều yếu tố thẩm mỹ',
            'Ý thức được và vận dụng 1 vài yếu tố thẩm mỹ',
            'Ý thức được và vận dụng nhiều yếu tố thẩm mỹ',
            'Ý thức được và vận dụng hài hòa các yếu tố thẩm mỹ',
          ],
        },
      ],
    },
    {
      id: 'taste',
      title: 'II. GU THẨM MỸ',
      criteria: [
        {
          key: 'art4p_2',
          label: 'Gu thẩm mỹ',
          levels: [
            'Gu thẩm mỹ chưa rõ nét',
            'Có một số biểu hiện của gu thẩm mỹ riêng',
            'Có gu thẩm mỹ cá nhân',
            'Có ý thức về gu thẩm mỹ cá nhân',
            'Bài có ý thức rõ nét về gu thẩm mỹ cá nhân',
          ],
        },
      ],
    },
    {
      id: 'visual-logic',
      title: 'III. TƯ DUY LOGIC THỊ GIÁC VÀ ĐƯỜNG NÉT',
      criteria: [
        {
          key: 'art4p_3',
          label: 'Tư duy logic thị giác và đường nét',
          levels: [
            'Có sử dụng đường nét',
            'Có sử dụng đa dạng các loại đường nét',
            'Có kết hợp các loại đường nét',
            'Có kết hợp sáng tạo các loại đường nét',
            'Có kết hợp độc đáo các loại đường nét',
          ],
        },
      ],
    },
    {
      id: 'creative-application',
      title: 'IV. KHẢ NĂNG SÁNG TẠO VÀ ỨNG DỤNG THẨM MỸ',
      criteria: [
        {
          key: 'art4p_4',
          label: 'Sáng tạo và ứng dụng thẩm mỹ',
          levels: [
            'Sáng tạo không đáng kể',
            'Có tính sáng tạo',
            'Có ý thức sáng tạo có ứng dụng',
            'Có ý thức rõ nét về sáng tạo có tính ứng dụng',
            'Có ý thức về nghệ thuật sáng tạo trong ứng dụng',
          ],
        },
      ],
    },
    {
      id: 'visual-intelligence',
      title: 'V. TRÍ THÔNG MINH HÌNH ẢNH',
      criteria: [
        {
          key: 'art4p_5',
          label: 'Trí thông minh hình ảnh',
          levels: [
            'Trí thông minh hình ảnh chưa rõ nét',
            'Có biểu hiện trí thông minh hình ảnh',
            'Có trí thông minh hình ảnh rõ nét',
            'Có trí thông minh hình ảnh vượt trội',
            'Trí thông minh hình ảnh là trí thông minh chủ đạo',
          ],
        },
      ],
    },
  ],
}

export const RUBRICS: Record<RubricType, RubricConfig> = {
  common: COMMON_RUBRIC,
  robotics4: ROBOTICS4_RUBRIC,
  art: ART_RUBRIC,
}

const COMMON_SUBJECTS = new Set([
  'sb',
  'gb',
  'web',
  'jsb',
  'jbs',
  'ptb',
  'preb',
  'armb',
  'semib',
])

const ROBOTICS4_SUBJECTS = new Set(['rob4b', 'lego 6+'])

export function resolveRubricType(track: string, subject: string): RubricType {
  const normalizedTrack = track.trim().toLowerCase()
  const normalizedSubject = subject.trim().toLowerCase()

  if (normalizedTrack === 'art') return 'art'
  if (ROBOTICS4_SUBJECTS.has(normalizedSubject)) return 'robotics4'
  if (COMMON_SUBJECTS.has(normalizedSubject)) return 'common'
  if (normalizedTrack === 'coding') return 'common'
  if (normalizedTrack === 'robotics') return 'common'
  return 'art'
}

export function getRubricScoreKeys(rubric: RubricConfig): ScoreColumn[] {
  return rubric.sections.flatMap((section) =>
    section.criteria.map((criterion) => criterion.key),
  )
}

export function getRequiredScoreKeys(track: string, subject: string): ScoreColumn[] {
  return getRubricScoreKeys(RUBRICS[resolveRubricType(track, subject)])
}

export function calculateAverageScore(scores: ScoreMap, keys: ScoreColumn[]): number | null {
  const values = keys
    .map((key) => scores[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (values.length === 0) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}
