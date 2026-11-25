export type LectureReviewCriterionLevel = {
  score: 1 | 2 | 3 | 4 | 5
  label: 'Chưa thể hiện' | 'Thấp' | 'Trung bình' | 'Cao' | 'Xuất sắc'
  detail: string
}

export type LectureReviewCriterion = {
  id: number
  section: string
  sectionTitle: string
  sectionNumber: number
  name: string
  guidance?: string[]
  levels: LectureReviewCriterionLevel[]
}

export type LectureReviewAnswer = {
  score: number
  note?: string
}

export type LectureReviewScoreDetails = {
  evaluationFormat: 'online' | 'offline'
  scores: Record<number, LectureReviewAnswer>
  generalFeedback: string
  evaluatedAt?: string
  evaluatedByName?: string
  totalScore: number
  isPass: boolean
  passThreshold: number
}

export const LECTURE_REVIEW_PASS_THRESHOLD = 60
export const LECTURE_REVIEW_PASS_THRESHOLD_COACHING = LECTURE_REVIEW_PASS_THRESHOLD
export const LECTURE_REVIEW_MAX_SCORE = 125 // 25 criteria * 5 points

export const LECTURE_REVIEW_SECTIONS = [
  {
    number: 1,
    title: 'Nội dung giáo viên cần giới thiệu trước buổi dạy thử',
    description:
      'Quá trình chuẩn bị dạy thử (học liệu, học cụ, dự thính, nhận góp ý từ Leader/Trainer) & Các tiêu chí ràng buộc (học phần, bài học, độ tuổi, nội dung, tiêu chí đo lường).',
  },
  {
    number: 2,
    title: 'Đánh giá sự chuẩn bị của giáo viên',
    description: 'Slide bài giảng, phương tiện hỗ trợ, dụng cụ, sản phẩm mẫu và kiến thức công cụ.',
  },
  {
    number: 3,
    title: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    description: 'Diễn giải kiến thức, mô phỏng trên công cụ, câu hỏi kiểm tra, tổ chức hoạt động lớp học, thực hành và game hóa.',
  },
  {
    number: 4,
    title: 'Đánh giá kỹ năng sư phạm của giáo viên',
    description: 'Diễn đạt, tác phong sư phạm, phân bổ thời lượng, hệ thống khen thưởng, kiểm soát, nhóm, chú ý, xử lý tình huống, quản lý lớp học và môi trường.',
  },
] as const

export const LECTURE_REVIEW_CRITERIA: LectureReviewCriterion[] = [
  // ==================== PHẦN 1 ====================
  {
    id: 1,
    sectionNumber: 1,
    section: 'PHẦN 1',
    sectionTitle: 'Nội dung giáo viên cần giới thiệu trước buổi dạy thử',
    name: 'Tiêu Chí Ràng Buộc',
    guidance: [
      'Quá trình chuẩn bị dạy thử: Đã chuẩn bị học liệu, học cụ gì? Đã tham gia dự thính lớp thực tế chưa? Đã trao đổi và nhận góp ý từ Leader / Fulltime / Trainer về nội dung dạy thử chưa?',
      'Các tiêu chí ràng buộc để tổ chức buổi học thử: Học phần, Bài học, Kiến thức học, Độ tuổi học sinh trong lớp, Nội dung chọn để dạy thử, Trật tự của nội dung dạy thử so với các nội dung khác trong bài, Tiêu chí đo lường sau khi dạy (kết quả HS thế nào thì Đạt).',
    ],
    levels: [
      { score: 1, label: 'Chưa thể hiện', detail: 'Chưa trình bày' },
      {
        score: 2,
        label: 'Thấp',
        detail:
          'Trình bày sai thông tin (sai lộ trình kiến thức, độ tuổi HS, công cụ học tập...)',
      },
      { score: 3, label: 'Trung bình', detail: 'Trình bày chưa đủ ý' },
      { score: 4, label: 'Cao', detail: 'Trình bày đủ ý nhưng chưa rõ ràng' },
      { score: 5, label: 'Xuất sắc', detail: 'Trình bày rõ ràng và đủ ý' },
    ],
  },
  {
    id: 2,
    sectionNumber: 1,
    section: 'PHẦN 1',
    sectionTitle: 'Nội dung giáo viên cần giới thiệu trước buổi dạy thử',
    name: 'Mục Tiêu Bài Giảng',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Xác định sai mục tiêu bài giảng hoặc không phù hợp với thời lượng',
      },
      {
        score: 2,
        label: 'Thấp',
        detail:
          'Mục tiêu được đặt phù hợp với thời lượng, cụ thể nhưng chưa phù hợp với năng lực của HS',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Mục tiêu được đặt phù hợp với thời lượng, phù hợp với năng lực của HS nhưng khó đo lường',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Mục tiêu được đặt phù hợp với thời lượng, cụ thể, phù hợp với năng lực của HS và có thể đo lường',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Mục tiêu được đặt phù hợp với thời lượng, cụ thể, phù hợp với năng lực của HS và có thể đo lường, HS đạt được mục tiêu sau buổi học',
      },
    ],
  },

  // ==================== PHẦN 2 ====================
  {
    id: 3,
    sectionNumber: 2,
    section: 'PHẦN 2',
    sectionTitle: 'Đánh giá sự chuẩn bị của giáo viên',
    name: 'Slide Bài Giảng',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Rối, không có tính thống nhất, liền mạch trong các hoạt động',
      },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Thông tin rõ ràng nhưng trật tự sắp xếp chưa hợp lý',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail: 'Thông tin rõ ràng, trật tự nội dung hợp lý',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Thông tin rõ ràng, trật tự nội dung hợp lý, thống nhất, có kết hợp hiệu ứng tốt để tăng hiệu quả bài giảng',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Thông tin rõ ràng, trật tự nội dung hợp lý, liên kết với nhau, slide bắt mắt, thu hút HS',
      },
    ],
  },
  {
    id: 4,
    sectionNumber: 2,
    section: 'PHẦN 2',
    sectionTitle: 'Đánh giá sự chuẩn bị của giáo viên',
    name: 'Sử Dụng Phương Tiện Hỗ Trợ, Dụng Cụ, Sản Phẩm Mẫu',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Không sử dụng bất kỳ phương tiện, dụng cụ, sản phẩm mẫu nào',
      },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Sử dụng phương tiện hỗ trợ, dụng cụ, sp mẫu nhưng chưa hiệu quả',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail: 'Sử dụng phương tiện hỗ trợ, dụng cụ, sp mẫu hợp lý',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Sử dụng phương tiện hỗ trợ, dụng cụ, sp mẫu hợp lý và gây thu hút, hào hứng nơi HS',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Sử dụng phương tiện hỗ trợ, dụng cụ, sp mẫu sáng tạo, hợp lý và gây thu hút, hào hứng nơi HS',
      },
    ],
  },
  {
    id: 5,
    sectionNumber: 2,
    section: 'PHẦN 2',
    sectionTitle: 'Đánh giá sự chuẩn bị của giáo viên',
    name: 'Kiến Thức Công Cụ',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Kiến thức công cụ còn sơ sài, chưa hiểu rõ',
      },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Một số kiến thức chưa chuẩn trong việc sử dụng công cụ',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Kiến thức tốt về công cụ nhưng chưa kết hợp hiệu quả với việc giảng dạy',
      },
      {
        score: 4,
        label: 'Cao',
        detail: 'Kiến thức tốt về công cụ và sử dụng hiệu quả trong việc giảng dạy',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Kiến thức tốt về công cụ, có sự liên kết, gợi mở với các kiến thức bài cũ và sử dụng hiệu quả trong việc giảng dạy',
      },
    ],
  },

  // ==================== PHẦN 3 ====================
  {
    id: 6,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Giáo Viên Diễn Giải Kiến Thức',
    levels: [
      { score: 1, label: 'Chưa thể hiện', detail: 'Diễn giải sai kiến thức' },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Diễn giải kiến thức còn phức tạp, chưa đầy đủ theo dạng 5W1H',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Diễn giải kiến thức đầy đủ theo dạng 5W1H nhưng còn chưa rõ ràng, mạch lạc',
      },
      {
        score: 4,
        label: 'Cao',
        detail: 'Diễn giải kiến thức rõ ràng, mạch lạc đủ dạng 5W1H',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Diễn giải kiến thức sinh động, dễ hiểu và gần gũi với HS đủ dạng 5W1H',
      },
    ],
  },
  {
    id: 7,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Giáo Viên Mô Phỏng Kiến Thức Trên Công Cụ',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Chưa mô phỏng kiến thức trên công cụ học tập',
      },
      {
        score: 2,
        label: 'Thấp',
        detail:
          'Mô phỏng kiến thức trên công cụ chưa chính xác hoặc còn phức tạp, khó hiểu',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail: 'Mô phỏng kiến thức trực quan, dễ hiểu trên công cụ học tập',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Mô phỏng kiến thức trực quan, dễ hiểu trên công cụ học tập kết hợp làm mẫu chi tiết',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Kết hợp linh hoạt làm mẫu, mô phỏng kiến thức trực quan trên công cụ học tập với diễn giải kiến thức',
      },
    ],
  },
  {
    id: 8,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Kỹ Thuật Đặt Câu Hỏi Kiểm Tra Kiến Thức',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Chưa có câu hỏi để kiểm tra kiến thức',
      },
      { score: 2, label: 'Thấp', detail: 'Đặt câu hỏi chưa đúng loại' },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Câu hỏi kiểm tra kiến thức đúng yêu cầu nhưng chưa được thực hiện thường xuyên trong lớp học',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Được thực hiện thường xuyên nhưng chưa có khả năng đánh giá diện rộng',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail: 'Có khả năng đánh giá nhanh, trên diện rộng',
      },
    ],
  },
  {
    id: 9,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Cách Thức Tổ Chức Hoạt Động Lớp Học',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Chưa được tổ chức hoặc tổ chức sai tính chất',
      },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Có tổ chức nhưng chưa bổ trợ rõ ràng cho mục tiêu bài học',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Hoạt động hỗ trợ HS học theo trải nghiệm (chủ yếu), bổ trợ rõ ràng, bao quát mục tiêu bài học. GV không theo dõi quá trình tham gia hoạt động của HS, không đảm bảo được tất cả HS đều tham gia',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Hoạt động hỗ trợ HS học theo trải nghiệm (chủ yếu), bổ trợ rõ ràng, bao quát mục tiêu bài học. GV ít theo dõi quá trình tham gia hoạt động của HS, không đảm bảo được tất cả HS đều tham gia',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Hoạt động hỗ trợ HS học theo trải nghiệm (chủ yếu), bổ trợ rõ ràng, bao quát mục tiêu bài học. GV theo dõi quá trình tham gia hoạt động của HS, đảm bảo tất cả HS đều tham gia',
      },
    ],
  },
  {
    id: 10,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Kết Quả Tổ Chức Hoạt Động Lớp Học',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Chưa được tổ chức hoặc tổ chức sai tính chất',
      },
      {
        score: 2,
        label: 'Thấp',
        detail:
          'HS không hào hứng tham gia, hoạt động không đạt được kết quả bổ trợ cho mục tiêu bài học',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'HS ít hào hứng tham gia, hoạt động đạt được 1 phần (>50%) kết quả bổ trợ cho mục tiêu bài học',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'HS ít hào hứng tham gia hoạt động, chưa đảm bảo được tất cả HS đạt được hiệu quả học tập qua trải nghiệm (50 - 80%)',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Tổ chức sinh động, sáng tạo, HS hào hứng tham gia hoạt động, đạt được hiệu quả học tập qua trải nghiệm (>80%)',
      },
    ],
  },
  {
    id: 11,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Hoạt Động Thực Hành',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail:
          'Chưa có các nhiệm vụ cụ thể hoặc các hoặc nhiệm vụ không hỗ trợ cho mục tiêu bài học',
      },
      {
        score: 2,
        label: 'Thấp',
        detail:
          'Các nhiệm vụ thực hành chưa hỗ trợ rõ ràng cho mục tiêu, chưa có độ khó tăng dần và chưa hỗ trợ cho sản phẩm cuối bài',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Các nhiệm vụ thực hành hỗ trợ rõ ràng cho mục tiêu và hỗ trợ cho sản phẩm cuối bài nhưng chưa có độ khó tăng dần',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Các nhiệm vụ thực hành hỗ trợ rõ ràng cho mục tiêu, có độ khó tăng dần nhưng chưa hỗ trợ cho sản phẩm cuối bài',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Các nhiệm vụ thực hành hỗ trợ rõ ràng cho mục tiêu, có độ khó tăng dần và hỗ trợ cho sản phẩm cuối bài',
      },
    ],
  },
  {
    id: 12,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Cách Thức Tổ Chức Hoạt Động Thực Hành',
    levels: [
      { score: 1, label: 'Chưa thể hiện', detail: 'Không có sự theo dõi HS' },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Có sự theo dõi HS nhưng còn hời hợt',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Có sự theo dõi và tương tác với HS nhưng không hỗ trợ kịp thời hoặc hỗ trợ HS không phù hợp (VD: làm hộ, làm mẫu, HS chép theo...)',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Có sự theo dõi, tương tác và hỗ trợ kịp thời cho HS, tạo điều kiện để HS được chủ động thực hành',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Tổ chức linh hoạt hoạt động cá nhân và hoạt động nhóm tùy theo tình hình cụ thể của lớp và nội dung nhiệm vụ. Có sự theo dõi, tương tác và hỗ trợ kịp thời cho HS, tạo điều kiện để HS được chủ động thực hành',
      },
    ],
  },
  {
    id: 13,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Kết Quả Thực Hành',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'GV không chữa kết quả thực hành',
      },
      {
        score: 2,
        label: 'Thấp',
        detail: 'GV trình chiếu kết quả thực hành, không kiểm tra kết quả thực hành HS',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'GV trình chiếu kết quả thực hành, 1 số HS hiểu tự sửa được theo hướng dẫn và hoàn thành nhiệm vụ',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'GV trình chiếu kết quả thực hành, tất cả HS đều hiểu, tự sửa được theo hướng dẫn và hoàn thành nhiệm vụ',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'GV chữa, phân tích cách tư duy, tất cả HS đều tự sửa được theo hướng dẫn và hoàn thành nhiệm vụ',
      },
    ],
  },
  {
    id: 14,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Hoạt Động Game Hoá',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Chưa được tổ chức hoặc tổ chức sai tính chất',
      },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Có tổ chức nhưng ít liên quan đến nội dung học',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Liên quan trực tiếp đến nội dung bài học, chỉ một vài HS tham gia hoặc do GV chỉ định',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Liên quan trực tiếp đến nội dung bài học, đảm bảo tất cả HS đều cùng tham gia',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Liên quan trực tiếp đến nội dung bài học và phân hóa về độ khó, đảm bảo tất cả HS đều cùng tham gia',
      },
    ],
  },
  {
    id: 15,
    sectionNumber: 3,
    section: 'PHẦN 3',
    sectionTitle: 'Đánh giá năng lực áp dụng phương pháp giảng dạy',
    name: 'Kết Quả Game Hoá',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Chưa được tổ chức hoặc tổ chức sai tính chất',
      },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Hoạt động không tạo được tính cạnh tranh, tính giải trí',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Hoạt động ít tạo được tính cạnh tranh, tính giải trí hoặc GV không tổng kết được kiến thức vừa học thông qua game hóa',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Hoạt động tạo được tính cạnh tranh, tính giải trí, HS hào hứng tham gia nhưng GV không tổng kết được kiến thức vừa học thông qua game hóa',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Hoạt động tạo được tính cạnh tranh, tính giải trí. GV tổng kết được kiến thức vừa học thông qua game hóa',
      },
    ],
  },

  // ==================== PHẦN 4 ====================
  {
    id: 16,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Diễn Đạt',
    levels: [
      { score: 1, label: 'Chưa thể hiện', detail: 'Ngập ngừng, khó hiểu, rối' },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Dễ hiểu nhưng còn ngập ngừng, vấp nhiều',
      },
      { score: 3, label: 'Trung bình', detail: 'Dễ hiểu, rõ ràng, không ngập ngừng' },
      {
        score: 4,
        label: 'Cao',
        detail: 'Dễ hiểu, lưu loát, tạo được tính liên kết và thống nhất của bài học',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Dễ hiểu, lưu loát, ngôn ngữ giàu màu sắc, truyền cảm, thu hút và tạo được hứng thú học tập cho HS Biểu hiện',
      },
    ],
  },
  {
    id: 17,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Tác Phong Sư Phạm',
    levels: [
      { score: 1, label: 'Chưa thể hiện', detail: 'Rụt rè, thiếu tự tin' },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Tác phong tạm ổn, nhưng vẫn còn thiếu tự tin',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Phong cách tự tin, nhưng đôi khi vẫn còn những tác phong chưa đúng chuẩn mực giáo viên',
      },
      {
        score: 4,
        label: 'Cao',
        detail: 'Phong cách tự tin, có sự kết hợp ngôn ngữ cơ thể nhưng chưa tốt lắm',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail: 'Phong cách tự tin, sử dụng ngôn ngữ cơ thể hợp lý, hiệu quả',
      },
    ],
  },
  {
    id: 18,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Phân Bổ Thời Lượng',
    levels: [
      { score: 1, label: 'Chưa thể hiện', detail: 'Quá giờ quy định' },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Thời gian bị lạm dụng, không dành đúng cho mục tiêu bài học',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Đúng thời gian quy định, dành đúng cho mục tiêu bài học, nhưng chưa phân bổ hợp lý thời gian cho các hoạt động',
      },
      {
        score: 4,
        label: 'Cao',
        detail: 'Phân bổ được thời gian hợp lý cho các hoạt động',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Phân bổ thời gian một cách hợp lý và linh hoạt và có sự kiểm soát tốt khi có các sự cố phát sinh',
      },
    ],
  },
  {
    id: 19,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Hệ Thống Khen Thưởng',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail: 'Không sử dụng bất kỳ hình thức khen thưởng nào',
      },
      { score: 2, label: 'Thấp', detail: 'Có khen thưởng nhưng chưa thường xuyên' },
      {
        score: 3,
        label: 'Trung bình',
        detail: 'Có khen thưởng thường xuyên nhưng chưa hợp lý khi tính điểm',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Có sự hợp lý khi tính điểm nhưng chưa thấy được hiệu quả trong việc tạo động lực, quản lý lớp học',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail: 'Đạt được hiệu quả trong việc tạo động lực, quản lý lớp học',
      },
    ],
  },
  {
    id: 20,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Hệ Thống Tham Gia Và Kiểm Soát',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail:
          'Chưa kiểm soát được nhóm HS không tham gia trực tiếp vào các hoạt động lớp học',
      },
      {
        score: 2,
        label: 'Thấp',
        detail: 'Giao được nhiệm vụ cho nhóm HS không tham gia trực tiếp hoạt động lớp học',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Giao được nhiệm vụ có tính bổ trợ cho nhóm không tham gia trực tiếp vào hoạt động trong lớp học',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Nhiệm vụ được giao có tính liên kết chặt chẽ giữa HS đang tham gia hoạt động lớp học và HS không tham gia trực tiếp',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'GV kiểm soát chặt chẽ được hoạt động giữa HS đang tham gia hoạt động và HS không tham gia trực tiếp Biểu hiện',
      },
    ],
  },
  {
    id: 21,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Hệ Thống Nhóm',
    levels: [
      { score: 1, label: 'Chưa thể hiện', detail: 'Chưa sử dụng hệ thống nhóm' },
      { score: 2, label: 'Thấp', detail: 'Chưa phù hợp với bối cảnh lớp học' },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Phù hợp với bối cảnh lớp học, nhưng chưa thấy được hiệu quả trong hoạt động làm việc nhóm',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Phù hợp với bối cảnh lớp học, tất cả HS đều tham gia một cách hiệu quả trong quá trình làm việc nhóm',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'HS đảm bảo làm việc nhóm một cách hiệu quả bằng cách chủ động phân công các vai trò công việc cho các thành viên',
      },
    ],
  },
  {
    id: 22,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Hệ Thống Chú Ý',
    levels: [
      { score: 1, label: 'Chưa thể hiện', detail: 'Chưa sử dụng hệ thống chú ý' },
      {
        score: 2,
        label: 'Thấp',
        detail:
          'Có sử dụng nhưng chưa đảm bảo được việc chú ý của HS hoặc không phù hợp với bối cảnh lớp học',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail: 'Phù hợp với bối cảnh lớp học, nhưng chưa thường xuyên và đồng nhất',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Phù hợp với bối cảnh lớp học, thực hiện thường xuyên, đồng nhất, thể hiện được phần nào tính hiệu quả',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Phù hợp với bối cảnh lớp học, thực hiện thường xuyên, đồng nhất, thể hiện rõ ràng tính hiệu quả sau khi thực hiện',
      },
    ],
  },
  {
    id: 23,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Xử Lý Tình Huống Sư Phạm',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail:
          'Không xử lý khi có tình huống phát sinh tình huống sư phạm trong lớp học',
      },
      {
        score: 2,
        label: 'Thấp',
        detail:
          'Phát sinh tình huống sư phạm, nhận biết được nhưng không xử lý hoặc không xử lý được',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail: 'Xử lý được tình huống chưa khéo léo, thuyết phục được HS',
      },
      {
        score: 4,
        label: 'Cao',
        detail: 'Xử lý được tình huống khéo léo, thuyết phục được HS nhưng chưa kịp thời',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Xử lý tình huống kịp thời, hiệu quả (khéo léo, thuyết phục được HS, tạo lập lại trật tự và không khí lớp học)',
      },
    ],
  },
  {
    id: 24,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Quản Lý Lớp Học',
    levels: [
      {
        score: 1,
        label: 'Chưa thể hiện',
        detail:
          'Bị động, chưa kiểm soát được lớp học, không giám sát hành vi HS dẫn đến phát sinh các hành vi sai trái nhưng cũng không có phương pháp giải quyết',
      },
      {
        score: 2,
        label: 'Thấp',
        detail:
          'Các tiêu chuẩn được xác lập, tuy nhiên sự cố gắng của GV để duy trì các tiêu chuẩn này chưa được đồng đều dẫn đến phát sinh các hành vi sai trái nhưng cũng không có phương án giải quyết hoặc giải quyết qua loa',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail:
          'Các tiêu chuẩn được xác lập, GV cố gắng để duy trì các tiêu chuẩn này (đạt hiệu quả > 50%) nhưng cách giải quyết của GV đối với vi phạm của HS chưa được thống nhất',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'GV thường giám sát hành vi của HS. Khi cần thiết, GV có cách xử lý hiệu quả với các hành vi sai trái của HS',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Bao quát được lớp học, GV liên tục giám sát các hành vi của HS, được thực hiện chủ yếu qua các phương tiện không lời; hành vi của HS hoàn toàn phù hợp',
      },
    ],
  },
  {
    id: 25,
    sectionNumber: 4,
    section: 'PHẦN 4',
    sectionTitle: 'Đánh giá kỹ năng sư phạm của giáo viên',
    name: 'Môi Trường Lớp Học',
    levels: [
      { score: 1, label: 'Chưa thể hiện', detail: 'Lớp học không có tổ chức và lộn xộn' },
      {
        score: 2,
        label: 'Thấp',
        detail:
          'Lớp học đôi khi chưa được tổ chức tốt hoặc không khí lớp học trầm, không tạo được động lực cho HS',
      },
      {
        score: 3,
        label: 'Trung bình',
        detail: 'Lớp học hoạt động trơn tru, không khí lớp học hài hòa',
      },
      {
        score: 4,
        label: 'Cao',
        detail:
          'Lớp học hoạt động trơn tru và hiệu quả, không khí lớp học vui vẻ, hào hứng',
      },
      {
        score: 5,
        label: 'Xuất sắc',
        detail:
          'Lớp học hoạt động một cách thống nhất và liên tục, HS chủ động tham gia các hoạt động trong lớp, không khí lớp học vui vẻ, hào hứng',
      },
    ],
  },
]

export function calculateLectureReviewTotalScore(
  scores: Record<number, LectureReviewAnswer>,
): number {
  return Object.values(scores).reduce((sum, item) => sum + (Number(item?.score) || 0), 0)
}

export function isLectureReviewPassed(totalScore: number): boolean {
  return totalScore >= LECTURE_REVIEW_PASS_THRESHOLD_COACHING
}
