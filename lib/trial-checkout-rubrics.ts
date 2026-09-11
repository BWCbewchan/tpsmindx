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
  { value: 'Coding', label: 'Coding', description: 'SB, GB, PTB, Web' },
  { value: 'Robotics', label: 'Robotics', description: 'ROB4B, PreB, Lego 6+, ArmB, SemiB' },
  { value: 'Art', label: 'Art', description: 'Digital Art & Design' },
]

export const SUBJECT_OPTIONS: Record<TrialTrack, string[]> = {
  Coding: ['SB', 'GB', 'PTB', 'Web'],
  Robotics: ['ROB4B', 'PreB', 'Lego 6+', 'ArmB', 'SemiB'],
  Art: [
    'Little Artist',
    'Digital Art Foundations',
    'Visual Thinking',
    'Game Art',
    'Character & Mascot Design',
    'Visual Communication',
  ],
}

export const ALL_SUBJECT_OPTIONS = Array.from(
  new Set(Object.values(SUBJECT_OPTIONS).flat()),
)

export const LEGACY_CODING_SUBJECT_OPTIONS = ['JSB', 'JBS']
export const LEGACY_ART_SUBJECT_OPTIONS = [
  'VA',
  'VC',
  'KA',
  'GD',
  'ART4B',
  'AI',
  'LITTLE ARTIST',
  'DIGITAL ART FOUNDATIONS',
  'VISUAL THINKING',
  'GAME ART',
  'VISUAL COMMUNICATION',
]

export const MANAGE_SUBJECT_OPTIONS: Record<TrialTrack, string[]> = {
  Coding: SUBJECT_OPTIONS.Coding,
  Robotics: SUBJECT_OPTIONS.Robotics,
  Art: Array.from(new Set([...SUBJECT_OPTIONS.Art, ...LEGACY_ART_SUBJECT_OPTIONS])),
}

export const ALL_MANAGE_SUBJECT_OPTIONS = Array.from(
  new Set(Object.values(MANAGE_SUBJECT_OPTIONS).flat()),
)

export const ACTIVE_CASE_RESULT_OPTIONS = [
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
] as const

export const CASE_RESULT_OPTIONS = [
  ...ACTIVE_CASE_RESULT_OPTIONS,
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

export type ProficiencyLevel = {
  key: 'xuat_sac' | 'tiem_nang' | 'trung_binh' | 'co_ban' | 'han_che'
  title: string
  scoreRangeLabel: string
  minScore: number
  maxScore: number
  description: string
}

export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  {
    key: 'xuat_sac',
    title: 'Mức xuất sắc',
    scoreRangeLabel: 'Điểm trung bình từ 4 - 5 điểm',
    minScore: 4.0,
    maxScore: 5.0,
    description:
      'Ở mức độ cao nhất, học viên không những tự chủ trong học tập, ứng dụng công nghệ mà còn biết cách sáng tạo để tạo ra những sản phẩm độc đáo. Với khả năng giao tiếp tự tin, tư duy logic và sáng tạo cân bằng, Học viên có nhiều cơ hội để phát triển trong tương lai số, có thể đóng góp tích cực vào việc phát triển và áp dụng công nghệ trong cộng đồng hoặc môi trường học tập của mình.',
  },
  {
    key: 'tiem_nang',
    title: 'Mức tiềm năng',
    scoreRangeLabel: 'Điểm trung bình từ 3,5 - 4 điểm',
    minScore: 3.5,
    maxScore: 4.0,
    description:
      'Học viên có năng khiếu thẩm mỹ, sáng tạo và khả năng ứng dụng công nghệ tương đối linh hoạt. Tiếp thu kiến thức nhanh, tương đối chủ động và tự tin khi giao tiếp. Có tiềm năng để phát triển trong tương lai khi có người hướng dẫn và lộ trình phù hợp.',
  },
  {
    key: 'trung_binh',
    title: 'Mức trung bình',
    scoreRangeLabel: 'Điểm trung bình từ 2,5 - 3,5 điểm',
    minScore: 2.5,
    maxScore: 3.5,
    description:
      'Ở mức độ này, học viên bắt đầu khám phá và thử nghiệm với công nghệ một cách tự giác và có ý thức hơn. Có thể thực hiện các nhiệm vụ đơn giản như sử dụng phần mềm hoặc tìm kiếm thông tin trực tuyến, nhưng còn hạn chế trong việc áp dụng công nghệ để sáng tạo hoặc giải quyết vấn đề. Cần môi trường để kích thích phát triển.',
  },
  {
    key: 'co_ban',
    title: 'Mức cơ bản',
    scoreRangeLabel: 'Điểm trung bình từ 1,5 - 2,5 điểm',
    minScore: 1.5,
    maxScore: 2.5,
    description:
      'Học viên mới bắt đầu tiếp xúc với công nghệ. Tư duy thẩm mỹ và sáng tạo ở mức độ cơ bản. Biết cách ứng dụng công nghệ để tạo ra sản phẩm sáng tạo nhưng vẫn cần hướng dẫn và hỗ trợ sát sao. Cần tìm kiếm môi trường học tập phù hợp, lộ trình và người hướng dẫn để truyền cảm hứng, động lực cho trẻ.',
  },
  {
    key: 'han_che',
    title: 'Mức hạn chế',
    scoreRangeLabel: 'Điểm trung bình từ 1 - 1,5 điểm',
    minScore: 1.0,
    maxScore: 1.5,
    description:
      'Học viên chưa có nhiều trải nghiệm với công nghệ. Biết cách ứng dụng công nghệ để tạo ra sản phẩm sáng tạo, nhưng chưa tự tin và chủ động trong giao tiếp. Cần tìm kiếm môi trường học tập phù hợp, lộ trình và người hướng dẫn để truyền cảm hứng, động lực cho trẻ.',
  },
]

export function getProficiencyLevel(score: number | null | undefined): ProficiencyLevel | null {
  if (score == null || !Number.isFinite(score)) return null
  const rounded = Math.round(score * 100) / 100
  if (rounded >= 4.0) return PROFICIENCY_LEVELS[0]
  if (rounded >= 3.5) return PROFICIENCY_LEVELS[1]
  if (rounded >= 2.5) return PROFICIENCY_LEVELS[2]
  if (rounded >= 1.5) return PROFICIENCY_LEVELS[3]
  return PROFICIENCY_LEVELS[4]
}

export const COMMON_RUBRIC: RubricConfig = {
  type: 'common',
  title: 'Tiêu chí đánh giá cho các bộ môn Coding: SB, GB, PTB, Web',
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
  title: 'Tiêu chí đánh giá cho các bộ môn Robotics: ROB4B, PreB, Lego 6+, ArmB, SemiB',
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

const CODING_SUBJECTS = new Set([
  'sb',
  'gb',
  'web',
  'jsb',
  'jbs',
  'ptb',
])

const ROBOTICS_SUBJECTS = new Set([
  'rob4b',
  'lego 6+',
  'preb',
  'armb',
  'semib',
])

export function resolveRubricType(track: string, subject: string): RubricType {
  const normalizedTrack = track.trim().toLowerCase()
  const normalizedSubject = subject.trim().toLowerCase()

  if (normalizedTrack === 'art') return 'art'
  if (normalizedTrack === 'robotics' || ROBOTICS_SUBJECTS.has(normalizedSubject)) return 'robotics4'
  if (normalizedTrack === 'coding' || CODING_SUBJECTS.has(normalizedSubject)) return 'common'
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
