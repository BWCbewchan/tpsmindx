/**
 * Vietnamese UI Glossary
 * 
 * Comprehensive Vietnamese translations for common UI terms.
 * All translations follow sentence case and include proper diacritics.
 * 
 * Requirements: 26.1, 26.2, 26.3, 26.11
 * 
 * @example
 * ```tsx
 * import { vietnameseGlossary } from '@/lib/i18n/vietnamese-ui-glossary'
 * 
 * <Button>{vietnameseGlossary.buttons.submit}</Button> // "Gửi"
 * ```
 */

export interface VietnameseUIGlossary {
  buttons: Record<string, string>
  formFields: Record<string, string>
  validation: Record<string, string>
  status: Record<string, string>
  navigation: Record<string, string>
  time: Record<string, string>
  emptyStates: Record<string, string>
  commonPhrases: Record<string, string>
  actions: Record<string, string>
  dataDisplay: Record<string, string>
}

/**
 * Vietnamese UI Glossary
 * 
 * Contains 200+ Vietnamese translations for common UI terms.
 * All text uses sentence case (first letter capitalized) and proper diacritics.
 */
export const vietnameseGlossary: VietnameseUIGlossary = {
  // Button Actions (50+ terms)
  buttons: {
    submit: 'Gửi',
    save: 'Lưu',
    delete: 'Xóa',
    cancel: 'Hủy',
    edit: 'Chỉnh sửa',
    add: 'Thêm',
    remove: 'Xóa bỏ',
    update: 'Cập nhật',
    create: 'Tạo',
    close: 'Đóng',
    open: 'Mở',
    download: 'Tải xuống',
    upload: 'Tải lên',
    search: 'Tìm kiếm',
    filter: 'Lọc',
    sort: 'Sắp xếp',
    view: 'Xem',
    preview: 'Xem trước',
    print: 'In',
    share: 'Chia sẻ',
    copy: 'Sao chép',
    paste: 'Dán',
    cut: 'Cắt',
    undo: 'Hoàn tác',
    redo: 'Làm lại',
    refresh: 'Làm mới',
    back: 'Quay lại',
    next: 'Tiếp theo',
    previous: 'Trước đó',
    continue: 'Tiếp tục',
    finish: 'Hoàn thành',
    skip: 'Bỏ qua',
    confirm: 'Xác nhận',
    apply: 'Áp dụng',
    reset: 'Đặt lại',
    clear: 'Xóa',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    selectAll: 'Chọn tất cả',
    expand: 'Mở rộng',
    collapse: 'Thu gọn',
    showMore: 'Xem thêm',
    showLess: 'Ẩn bớt',
    loadMore: 'Tải thêm',
    retry: 'Thử lại',
    send: 'Gửi',
    export: 'Xuất',
    import: 'Nhập',
    duplicate: 'Nhân bản',
    archive: 'Lưu trữ',
    restore: 'Khôi phục',
  },

  // Form Fields (40+ terms)
  formFields: {
    email: 'Địa chỉ email',
    password: 'Mật khẩu',
    username: 'Tên đăng nhập',
    fullName: 'Họ và tên',
    firstName: 'Tên',
    lastName: 'Họ',
    phoneNumber: 'Số điện thoại',
    address: 'Địa chỉ',
    city: 'Thành phố',
    country: 'Quốc gia',
    postalCode: 'Mã bưu điện',
    dateOfBirth: 'Ngày sinh',
    gender: 'Giới tính',
    message: 'Tin nhắn',
    comment: 'Bình luận',
    description: 'Mô tả',
    title: 'Tiêu đề',
    subject: 'Chủ đề',
    category: 'Danh mục',
    tags: 'Thẻ',
    status: 'Trạng thái',
    type: 'Loại',
    amount: 'Số tiền',
    quantity: 'Số lượng',
    price: 'Giá',
    total: 'Tổng cộng',
    subtotal: 'Tạm tính',
    discount: 'Giảm giá',
    tax: 'Thuế',
    shipping: 'Phí vận chuyển',
    notes: 'Ghi chú',
    website: 'Trang web',
    company: 'Công ty',
    position: 'Vị trí',
    department: 'Phòng ban',
    startDate: 'Ngày bắt đầu',
    endDate: 'Ngày kết thúc',
    duration: 'Thời lượng',
    location: 'Vị trí',
    language: 'Ngôn ngữ',
  },

  // Validation Messages (30+ terms)
  validation: {
    required: 'Bắt buộc',
    optional: 'Tùy chọn',
    invalid: 'Không hợp lệ',
    tooShort: 'Quá ngắn',
    tooLong: 'Quá dài',
    mustMatch: 'Phải khớp',
    alreadyExists: 'Đã tồn tại',
    notFound: 'Không tìm thấy',
    incorrect: 'Không chính xác',
    expired: 'Đã hết hạn',
    unavailable: 'Không khả dụng',
    invalidEmail: 'Email không hợp lệ',
    invalidPhone: 'Số điện thoại không hợp lệ',
    invalidUrl: 'URL không hợp lệ',
    invalidDate: 'Ngày không hợp lệ',
    invalidFormat: 'Định dạng không hợp lệ',
    minLength: 'Độ dài tối thiểu',
    maxLength: 'Độ dài tối đa',
    minValue: 'Giá trị tối thiểu',
    maxValue: 'Giá trị tối đa',
    mustBeNumber: 'Phải là số',
    mustBePositive: 'Phải là số dương',
    mustBeInteger: 'Phải là số nguyên',
    passwordTooWeak: 'Mật khẩu quá yếu',
    passwordMismatch: 'Mật khẩu không khớp',
    fileTooBig: 'Tệp quá lớn',
    invalidFileType: 'Loại tệp không hợp lệ',
    uploadFailed: 'Tải lên thất bại',
    networkError: 'Lỗi kết nối mạng',
    serverError: 'Lỗi máy chủ',
  },

  // Status Messages (25+ terms)
  status: {
    success: 'Thành công',
    error: 'Lỗi',
    warning: 'Cảnh báo',
    info: 'Thông tin',
    loading: 'Đang tải',
    saving: 'Đang lưu',
    processing: 'Đang xử lý',
    completed: 'Hoàn thành',
    failed: 'Thất bại',
    pending: 'Đang chờ',
    active: 'Đang hoạt động',
    inactive: 'Không hoạt động',
    enabled: 'Đã bật',
    disabled: 'Đã tắt',
    online: 'Trực tuyến',
    offline: 'Ngoại tuyến',
    available: 'Có sẵn',
    unavailable: 'Không có sẵn',
    inStock: 'Còn hàng',
    outOfStock: 'Hết hàng',
    draft: 'Bản nháp',
    published: 'Đã xuất bản',
    archived: 'Đã lưu trữ',
    deleted: 'Đã xóa',
    approved: 'Đã phê duyệt',
    rejected: 'Đã từ chối',
  },

  // Navigation (25+ terms)
  navigation: {
    home: 'Trang chủ',
    about: 'Giới thiệu',
    contact: 'Liên hệ',
    services: 'Dịch vụ',
    products: 'Sản phẩm',
    blog: 'Blog',
    faq: 'Câu hỏi thường gặp',
    help: 'Trợ giúp',
    support: 'Hỗ trợ',
    settings: 'Cài đặt',
    profile: 'Hồ sơ',
    account: 'Tài khoản',
    dashboard: 'Bảng điều khiển',
    login: 'Đăng nhập',
    logout: 'Đăng xuất',
    register: 'Đăng ký',
    signUp: 'Đăng ký',
    signIn: 'Đăng nhập',
    forgotPassword: 'Quên mật khẩu',
    privacyPolicy: 'Chính sách bảo mật',
    termsOfService: 'Điều khoản dịch vụ',
    menu: 'Menu',
    notifications: 'Thông báo',
    messages: 'Tin nhắn',
    inbox: 'Hộp thư đến',
  },

  // Time and Date (30+ terms)
  time: {
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    tomorrow: 'Ngày mai',
    thisWeek: 'Tuần này',
    lastWeek: 'Tuần trước',
    nextWeek: 'Tuần sau',
    thisMonth: 'Tháng này',
    lastMonth: 'Tháng trước',
    nextMonth: 'Tháng sau',
    thisYear: 'Năm nay',
    lastYear: 'Năm ngoái',
    now: 'Bây giờ',
    justNow: 'Vừa xong',
    minutesAgo: 'phút trước',
    hoursAgo: 'giờ trước',
    daysAgo: 'ngày trước',
    weeksAgo: 'tuần trước',
    monthsAgo: 'tháng trước',
    yearsAgo: 'năm trước',
    minute: 'phút',
    hour: 'giờ',
    day: 'ngày',
    week: 'tuần',
    month: 'tháng',
    year: 'năm',
    monday: 'Thứ hai',
    tuesday: 'Thứ ba',
    wednesday: 'Thứ tư',
    thursday: 'Thứ năm',
    friday: 'Thứ sáu',
    saturday: 'Thứ bảy',
    sunday: 'Chủ nhật',
  },

  // Empty States (15+ terms)
  emptyStates: {
    noItemsFound: 'Không tìm thấy mục nào',
    noResults: 'Không có kết quả',
    empty: 'Trống',
    nothingHere: 'Không có gì ở đây',
    noData: 'Không có dữ liệu',
    noContent: 'Không có nội dung',
    cartEmpty: 'Giỏ hàng của bạn đang trống',
    noNotifications: 'Không có thông báo',
    noMessages: 'Không có tin nhắn',
    noFiles: 'Không có tệp',
    noImages: 'Không có hình ảnh',
    noComments: 'Không có bình luận',
    noReviews: 'Không có đánh giá',
    noActivity: 'Không có hoạt động',
    noHistory: 'Không có lịch sử',
  },

  // Common Phrases (30+ terms)
  commonPhrases: {
    pleaseWait: 'Vui lòng đợi',
    tryAgain: 'Thử lại',
    learnMore: 'Tìm hiểu thêm',
    readMore: 'Đọc thêm',
    seeAll: 'Xem tất cả',
    viewAll: 'Xem tất cả',
    showAll: 'Hiển thị tất cả',
    hide: 'Ẩn',
    show: 'Hiển thị',
    yes: 'Có',
    no: 'Không',
    ok: 'OK',
    gotIt: 'Đã hiểu',
    understood: 'Đã hiểu',
    areYouSure: 'Bạn có chắc chắn',
    cannotUndo: 'Hành động này không thể hoàn tác',
    welcome: 'Chào mừng',
    thankYou: 'Cảm ơn',
    sorry: 'Xin lỗi',
    congratulations: 'Chúc mừng',
    oops: 'Ối',
    attention: 'Chú ý',
    note: 'Lưu ý',
    tip: 'Mẹo',
    example: 'Ví dụ',
    details: 'Chi tiết',
    more: 'Thêm',
    less: 'Ít hơn',
    all: 'Tất cả',
    none: 'Không có',
  },

  // Actions (20+ terms)
  actions: {
    createNew: 'Tạo mới',
    addNew: 'Thêm mới',
    editItem: 'Chỉnh sửa mục',
    deleteItem: 'Xóa mục',
    viewDetails: 'Xem chi tiết',
    saveChanges: 'Lưu thay đổi',
    discardChanges: 'Hủy thay đổi',
    uploadFile: 'Tải lên tệp',
    downloadFile: 'Tải xuống tệp',
    shareLink: 'Chia sẻ liên kết',
    copyLink: 'Sao chép liên kết',
    sendMessage: 'Gửi tin nhắn',
    replyMessage: 'Trả lời tin nhắn',
    forwardMessage: 'Chuyển tiếp tin nhắn',
    markAsRead: 'Đánh dấu đã đọc',
    markAsUnread: 'Đánh dấu chưa đọc',
    addToFavorites: 'Thêm vào yêu thích',
    removeFromFavorites: 'Xóa khỏi yêu thích',
    reportIssue: 'Báo cáo vấn đề',
    giveFeedback: 'Gửi phản hồi',
  },

  // Data Display (15+ terms)
  dataDisplay: {
    total: 'Tổng',
    count: 'Số lượng',
    average: 'Trung bình',
    minimum: 'Tối thiểu',
    maximum: 'Tối đa',
    percentage: 'Phần trăm',
    ratio: 'Tỷ lệ',
    growth: 'Tăng trưởng',
    decline: 'Giảm',
    change: 'Thay đổi',
    comparison: 'So sánh',
    trend: 'Xu hướng',
    summary: 'Tóm tắt',
    overview: 'Tổng quan',
    statistics: 'Thống kê',
  },
}

/**
 * Get a translated term from the glossary
 * 
 * @example
 * ```tsx
 * getTranslation('buttons', 'submit') // "Gửi"
 * getTranslation('formFields', 'email') // "Địa chỉ email"
 * ```
 */
export function getTranslation(
  category: keyof VietnameseUIGlossary,
  key: string
): string {
  return vietnameseGlossary[category][key] || key
}

/**
 * Check if a term exists in the glossary
 */
export function hasTranslation(
  category: keyof VietnameseUIGlossary,
  key: string
): boolean {
  return key in vietnameseGlossary[category]
}

/**
 * Get all translations for a category
 */
export function getCategoryTranslations(
  category: keyof VietnameseUIGlossary
): Record<string, string> {
  return vietnameseGlossary[category]
}
