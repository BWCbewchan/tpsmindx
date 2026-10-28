'use client'
import { useQueryState } from '@/lib/use-query-state'


import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { toast } from '@/lib/app-toast'
import {
  FileSpreadsheet,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
  Plus,
  RefreshCw,
  BookOpen,
  Layers,
  ChevronRight,
  ShieldAlert,
  Download,
  X,
  Sparkles,
  Link2,
  Check,
  CheckSquare,
  Square,
  Globe,
  Settings2,
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface RubricCourse {
  id: string
  name: string
  code?: string
}

interface RubricItem {
  id: number
  name: string
  type: 'course' | 'common'
  description?: string
  applyToAllCourses: boolean
  criteriaCount: number
  groupCount: number
  totalMaxScore: number
  assignedCourses: RubricCourse[]
  updatedAt?: string
  createdAt?: string
  createdBy?: string
}

interface CourseOption {
  id: string
  name: string
  shortName: string
  code: string
  courseLineName?: string
}

interface CriterionItem {
  id?: number
  groupName: string
  content: string
  maxScore: number
  orderIndex?: number
}

interface CriterionGroup {
  groupName: string
  totalGroupScore: number
  items: CriterionItem[]
}

export default function GradingCriteriaAdminPage() {
  const { user, token, isLoading: authLoading } = useAuth()

  // Tab: 'course' (Tiêu chí theo khóa học) | 'common' (Tiêu chí chấm điểm chung)
  const [activeTab, setActiveTab] = useQueryState<'course' | 'common'>('tab', 'course', { values: ["course","common"], history: 'push' })

  // Danh sách rubrics từ DB
  const [rubrics, setRubrics] = useState<RubricItem[]>([])
  const [loadingRubrics, setLoadingRubrics] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Danh sách toàn bộ khóa học LMS MindX (để chọn / gán)
  const [lmsCourses, setLmsCourses] = useState<CourseOption[]>([])
  const [loadingLmsCourses, setLoadingLmsCourses] = useState(false)

  // Tìm kiếm trong danh sách rubrics
  const [searchTerm, setSearchTerm] = useQueryState<string>('search', '')

  // Modal Xem chi tiết
  const [selectedRubricForView, setSelectedRubricForView] = useState<RubricItem | null>(null)
  const [viewCriteriaGroups, setViewCriteriaGroups] = useState<CriterionGroup[]>([])
  const [loadingViewDetail, setLoadingViewDetail] = useState(false)

  // Modal Import Excel
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importRubricId, setImportRubricId] = useState<number | null>(null)
  const [importRubricName, setImportRubricName] = useState('')
  const [importRubricType, setImportRubricType] = useState<'course' | 'common'>('course')
  const [importApplyToAll, setImportApplyToAll] = useState(false)
  const [importSelectedCourses, setImportSelectedCourses] = useState<RubricCourse[]>([])
  const [importCourseSearch, setImportCourseSearch] = useState('')
  const [parsedCriteria, setParsedCriteria] = useState<CriterionItem[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [detectedCourseTitle, setDetectedCourseTitle] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [isSavingImport, setIsSavingImport] = useState(false)

  // Modal Gán khóa học (Assign Courses Modal)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignTargetRubric, setAssignTargetRubric] = useState<RubricItem | null>(null)
  const [assignSelectedCourses, setAssignSelectedCourses] = useState<RubricCourse[]>([])
  const [assignCourseSearch, setAssignCourseSearch] = useState('')
  const [isSavingAssign, setIsSavingAssign] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Kiểm tra quyền Super Admin / Admin
  const isSuperAdmin = useMemo(() => {
    const role = (user?.role || '').toLowerCase()
    return role === 'super_admin' || role === 'admin' || role === 'manager'
  }, [user?.role])

  // Tải danh sách các bộ rubric từ DB
  const fetchRubrics = useCallback(async () => {
    setLoadingRubrics(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/grading-criteria/rubrics', {
        headers: {
          ...authHeaders(token),
        },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRubrics(data.data || [])
      } else {
        setError(data.error || 'Không thể tải danh sách bộ tiêu chí')
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi mạng khi tải bộ tiêu chí')
    } finally {
      setLoadingRubrics(false)
    }
  }, [token])

  // Tải danh sách khóa học LMS MindX
  const fetchLmsCourses = useCallback(async () => {
    setLoadingLmsCourses(true)
    try {
      const res = await fetch('/api/admin/grading-criteria/courses', {
        headers: {
          ...authHeaders(token),
        },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setLmsCourses(data.data || [])
      }
    } catch (e: any) {
      console.error('Lỗi tải danh sách khóa học LMS:', e)
    } finally {
      setLoadingLmsCourses(false)
    }
  }, [token])

  useEffect(() => {
    if (!authLoading) {
      fetchRubrics()
      fetchLmsCourses()
    }
  }, [authLoading, fetchRubrics, fetchLmsCourses])

  // Lọc danh sách rubrics theo Tab và từ khóa tìm kiếm
  const filteredRubrics = useMemo(() => {
    return rubrics.filter((r) => {
      // 1. Lọc theo tab
      if (r.type !== activeTab) return false

      // 2. Tìm kiếm theo tên bộ rubric hoặc tên khóa học được gán
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchName = r.name.toLowerCase().includes(q)
        const matchCourse = (r.assignedCourses || []).some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.code && c.code.toLowerCase().includes(q)),
        )
        if (!matchName && !matchCourse) return false
      }

      return true
    })
  }, [rubrics, activeTab, searchTerm])

  // Danh sách khóa học được lọc trong Modal Import (Ưu tiên các khóa ĐÃ CHỌN lên đầu)
  const importFilteredCourses = useMemo(() => {
    let list = lmsCourses
    if (importCourseSearch.trim()) {
      const q = importCourseSearch.toLowerCase().trim()
      list = lmsCourses.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          (c.shortName && c.shortName.toLowerCase().includes(q)),
      )
    }
    return [...list].sort((a, b) => {
      const aChecked = importSelectedCourses.some((item) => item.id === a.id) ? 1 : 0
      const bChecked = importSelectedCourses.some((item) => item.id === b.id) ? 1 : 0
      if (aChecked !== bChecked) return bChecked - aChecked
      return a.name.localeCompare(b.name, 'vi')
    })
  }, [lmsCourses, importCourseSearch, importSelectedCourses])

  // Danh sách khóa học được lọc trong Modal Gán khóa học (Ưu tiên các khóa ĐANG ÁP DỤNG lên đầu)
  const assignFilteredCourses = useMemo(() => {
    let list = lmsCourses
    if (assignCourseSearch.trim()) {
      const q = assignCourseSearch.toLowerCase().trim()
      list = lmsCourses.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          (c.shortName && c.shortName.toLowerCase().includes(q)),
      )
    }
    return [...list].sort((a, b) => {
      const aChecked = assignSelectedCourses.some((item) => item.id === a.id) ? 1 : 0
      const bChecked = assignSelectedCourses.some((item) => item.id === b.id) ? 1 : 0
      if (aChecked !== bChecked) return bChecked - aChecked
      return a.name.localeCompare(b.name, 'vi')
    })
  }, [lmsCourses, assignCourseSearch, assignSelectedCourses])

  // Mở modal import tạo mới bộ rubric
  const handleOpenCreateModal = (type: 'course' | 'common' = activeTab) => {
    setImportRubricId(null)
    setImportRubricName('')
    setImportRubricType(type)
    setImportApplyToAll(type === 'common')
    setImportSelectedCourses([])
    setImportCourseSearch('')
    setParsedCriteria([])
    setImportFileName('')
    setDetectedCourseTitle('')
    setImportError(null)
    setIsImportModalOpen(true)
  }

  // Mở modal import cập nhật lại file Excel cho 1 rubric đã có
  const handleOpenEditExcelModal = (rubric: RubricItem) => {
    setImportRubricId(rubric.id)
    setImportRubricName(rubric.name)
    setImportRubricType(rubric.type)
    setImportApplyToAll(rubric.applyToAllCourses)
    setImportSelectedCourses(rubric.assignedCourses || [])
    setImportCourseSearch('')
    setParsedCriteria([])
    setImportFileName('')
    setDetectedCourseTitle('')
    setImportError(null)
    setIsImportModalOpen(true)
  }

  // Mở modal gán khóa học
  const handleOpenAssignModal = (rubric: RubricItem) => {
    setAssignTargetRubric(rubric)
    setAssignSelectedCourses(rubric.assignedCourses || [])
    setAssignCourseSearch('')
    setIsAssignModalOpen(true)
  }

  // Lưu phân bổ khóa học từ Modal Gán khóa học
  const handleSaveAssignCourses = async () => {
    if (!assignTargetRubric) return
    setIsSavingAssign(true)
    try {
      const res = await fetch(
        `/api/admin/grading-criteria/rubrics/${assignTargetRubric.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(token),
          },
          body: JSON.stringify({
            courses: assignSelectedCourses,
          }),
        },
      )
      const data = await res.json()
      if (res.ok && data.success) {
        setIsAssignModalOpen(false)
        fetchRubrics()
        toast.success('Phân bổ thành công', {
          message: `Đã cập nhật ${assignSelectedCourses.length} khóa học áp dụng bộ tiêu chí`,
        })
      } else {
        toast.error('Lỗi phân bổ khóa học', {
          message: data.error || 'Có lỗi xảy ra khi lưu phân bổ khóa học',
        })
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối', { message: e.message || 'Lỗi mạng khi lưu phân bổ' })
    } finally {
      setIsSavingAssign(false)
    }
  }

  // Xem chi tiết tiêu chí của bộ rubric
  const handleOpenViewRubric = async (rubric: RubricItem) => {
    setSelectedRubricForView(rubric)
    setLoadingViewDetail(true)
    try {
      const res = await fetch(
        `/api/admin/grading-criteria/rubrics/${rubric.id}`,
        {
          headers: { ...authHeaders(token) },
        },
      )
      const data = await res.json()
      if (res.ok && data.success) {
        setViewCriteriaGroups(data.data?.groups || [])
      } else {
        toast.error('Không thể tải chi tiết', {
          message: data.error || 'Lỗi khi tải chi tiết bộ tiêu chí',
        })
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối', { message: e.message || 'Lỗi mạng khi tải chi tiết' })
    } finally {
      setLoadingViewDetail(false)
    }
  }

  // Xóa bộ rubric
  const handleDeleteRubric = async (rubric: RubricItem) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa bộ tiêu chí "${rubric.name}"? Thao tác này sẽ xóa toàn bộ tiêu chí liên kết của các khóa học.`,
      )
    ) {
      return
    }

    try {
      const res = await fetch(
        `/api/admin/grading-criteria/rubrics?id=${rubric.id}`,
        {
          method: 'DELETE',
          headers: { ...authHeaders(token) },
        },
      )
      const data = await res.json()
      if (res.ok && data.success) {
        fetchRubrics()
        if (selectedRubricForView?.id === rubric.id) {
          setSelectedRubricForView(null)
        }
        toast.success('Đã xóa bộ tiêu chí', {
          message: `Bộ tiêu chí "${rubric.name}" đã được xóa khỏi hệ thống`,
        })
      } else {
        toast.error('Lỗi xóa bộ tiêu chí', {
          message: data.error || 'Không thể xóa bộ tiêu chí này',
        })
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối', { message: e.message || 'Lỗi mạng khi xóa bộ tiêu chí' })
    }
  }

  // Phân tích file Excel tải lên
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFileName(file.name)
    setImportError(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const workbook = XLSX.read(bstr, { type: 'binary' })

        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) {
          throw new Error('File Excel không có dữ liệu')
        }

        // Tự động kế thừa dữ liệu cho các ô bị gộp (Merged Cells) trong Excel
        if (worksheet['!merges'] && Array.isArray(worksheet['!merges'])) {
          worksheet['!merges'].forEach((range: any) => {
            const startKey = XLSX.utils.encode_cell(range.s)
            const startCell = worksheet[startKey]
            if (startCell && startCell.v !== undefined && startCell.v !== '') {
              for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                  const key = XLSX.utils.encode_cell({ r: R, c: C })
                  if (!worksheet[key] || worksheet[key].v === undefined || worksheet[key].v === '') {
                    worksheet[key] = { ...startCell }
                  }
                }
              }
            }
          })
        }

        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        })
        if (!rawRows || rawRows.length < 2) {
          throw new Error('File Excel không đủ dữ liệu bảng chấm điểm')
        }

        // 1. Quét tìm tiêu đề trong 6 dòng đầu (khử trùng lặp chuỗi do các ô merged cell gây ra)
        let detectedTitle = ''
        for (let i = 0; i < Math.min(6, rawRows.length); i++) {
          const uniqueCells = Array.from(
            new Set(rawRows[i].map((c) => String(c || '').trim()).filter(Boolean)),
          )
          const matched = uniqueCells.find((c) =>
            /bảng chấm điểm|buổi demo|tiêu chí|rubric/i.test(c),
          )
          if (matched) {
            detectedTitle = matched
            break
          }
          const rowText = uniqueCells.join(' ')
          if (/bảng chấm điểm|buổi demo|tiêu chí|rubric/i.test(rowText)) {
            detectedTitle = uniqueCells[0] || rowText
            break
          }
        }
        setDetectedCourseTitle(detectedTitle)

        // Nếu chưa nhập tên bộ tiêu chí, tự động điền từ tiêu đề hoặc tên file
        if (!importRubricName.trim()) {
          const defaultName =
            detectedTitle ||
            file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
          setImportRubricName(defaultName)
        }

        // Thử tìm khóa học gợi ý nếu chưa có khóa nào được chọn
        if (importSelectedCourses.length === 0 && detectedTitle) {
          const matched = lmsCourses.find((c) =>
            detectedTitle.toLowerCase().includes(c.name.toLowerCase()),
          )
          if (matched) {
            setImportSelectedCourses([
              { id: matched.id, name: matched.name, code: matched.code },
            ])
          }
        }

        // 2. Tìm dòng Header của bảng tiêu chí
        let headerRowIndex = -1
        let colGroupIdx = 0
        let colContentIdx = 1
        let colMaxScoreIdx = 2

        for (let r = 0; r < Math.min(25, rawRows.length); r++) {
          const row = rawRows[r]
          if (!row) continue
          let foundContent = -1
          let foundGroup = -1
          let foundScore = -1

          for (let c = 0; c < row.length; c++) {
            const cell = String(row[c] || '').toLowerCase().trim()
            if (
              /tiêu chí đầu ra|nhóm tiêu chí|tiêu chí chung|tiêu chí lớn|hạng mục|mục tiêu chí|tiêu chuẩn|lĩnh vực|kỹ năng/i.test(cell) ||
              (cell === 'tiêu chí' && foundGroup === -1)
            ) {
              foundGroup = c
            }
            if (/nội dung|mô tả|yêu cầu|tiêu chí chi tiết|nội dung chi tiết/i.test(cell)) {
              foundContent = c
            }
            if (/điểm tối đa|thang điểm|điểm max|điểm chuẩn|tối đa|max score/i.test(cell)) {
              foundScore = c
            }
          }

          if (foundContent !== -1 && (foundGroup !== -1 || foundScore !== -1)) {
            headerRowIndex = r
            colGroupIdx = foundGroup !== -1 ? foundGroup : (foundContent > 0 ? foundContent - 1 : 0)
            colContentIdx = foundContent
            colMaxScoreIdx = foundScore !== -1 ? foundScore : foundContent + 1
            break
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 5
          colGroupIdx = 0
          colContentIdx = 1
          colMaxScoreIdx = 2
        }

        // Hàm kiểm tra dòng chân bảng (Nhận xét / Ban giám khảo / Chữ ký / Footer)
        const isFooterRow = (row: any[], rawGroup: string, rawContent: string, maxScore: number): boolean => {
          // Nếu dòng có điểm số tối đa hợp lệ (> 0) và nội dung dài, đây là tiêu chí thật, không phải nhận xét
          if (maxScore > 0 && rawContent.length > 25) {
            return false
          }

          const g = rawGroup.toLowerCase().trim()
          const c = rawContent.toLowerCase().trim()

          // Ô tiêu đề nhóm hoặc nội dung bắt đầu bảng nhận xét / chữ ký
          const footerExact = /^(nhận xét|ý kiến nhận xét|đánh giá chung|góp ý|bgk\s*\d*|ban giám khảo|chữ ký|ký tên|người chấm|giám khảo\s*\d*)$/i
          if (footerExact.test(g) || footerExact.test(c)) {
            return true
          }

          // Dòng có chữ 'nhận xét' mà không có điểm số tối đa (> 0)
          if ((/^nhận xét/i.test(g) || /^nhận xét/i.test(c)) && maxScore <= 0) {
            return true
          }

          // Dòng không có điểm và toàn dòng chứa các từ khóa footer
          if (maxScore <= 0) {
            const rowStr = row.map((cell) => String(cell || '').trim().toLowerCase()).join(' ')
            if (/\b(nhận xét|ban giám khảo|chữ ký|ký tên|người chấm|bgk1|bgk2)\b/i.test(rowStr)) {
              return true
            }
          }

          return false
        }

        // 3. Trích xuất các dòng tiêu chí (hỗ trợ kế thừa merged cell cho nhóm)
        const criteriaList: CriterionItem[] = []
        let currentGroup = ''

        for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
          const row = rawRows[r]
          if (!row || row.length === 0) continue

          const rawGroup = String(row[colGroupIdx] || '').trim()
          const rawContent = String(row[colContentIdx] || '').trim()
          const rawScore = row[colMaxScoreIdx]

          // Điểm tối đa phải là số hợp lệ
          let maxScore = 0
          if (rawScore != null && rawScore !== '') {
            const parsed = parseFloat(String(rawScore).replace(/,/g, '.'))
            if (!isNaN(parsed) && parsed > 0) {
              maxScore = parsed
            }
          }

          // 1. Kiểm tra dòng chân trang (Nhận xét / BGK / Ban giám khảo)
          if (isFooterRow(row, rawGroup, rawContent, maxScore)) {
            break
          }

          // Dừng lại nếu gặp dòng chốt sổ có chữ "Tổng điểm", "Tổng cộng", "Total"
          if (/^(tổng\s*(điểm|cộng)?|total)$/i.test(rawGroup) || /^(tổng\s*(điểm|cộng)?|total)$/i.test(rawContent)) {
            break
          }

          // 2. CẬP NHẬT NHÓM TIÊU CHÍ (Cột 1):
          // Khi cột nhóm có giá trị và không phải tiêu đề cột, cập nhật currentGroup
          if (
            rawGroup &&
            !/^(tiêu chí đầu ra|nhóm tiêu chí|tiêu chí chung|tiêu chí|nội dung|stt|tt|hạng mục)$/i.test(rawGroup.trim())
          ) {
            currentGroup = rawGroup.replace(/\r?\n/g, ' ').trim()
          }

          // Bắt buộc maxScore > 0, nếu không thì bỏ qua (dòng trống, ghi chú...)
          if (maxScore <= 0) {
            continue
          }

          // 3. Nội dung tiêu chí phải có giá trị và không trùng với tên nhóm
          if (rawContent && rawContent !== currentGroup) {
            if (/^(nhận xét|bgk|bgk\s*\d+|ban giám khảo|giám khảo|chữ ký|người chấm|ký tên)$/i.test(rawContent.trim())) {
              continue
            }

            criteriaList.push({
              groupName: currentGroup || 'Tiêu chí chung',
              content: rawContent.replace(/\r?\n/g, ' ').trim(),
              maxScore: maxScore,
              orderIndex: criteriaList.length + 1,
            })
          }
        }

        if (criteriaList.length === 0) {
          throw new Error(
            'Không tìm thấy tiêu chí nào. Vui lòng kiểm tra định dạng cột của file Excel.',
          )
        }

        setParsedCriteria(criteriaList)
      } catch (err: any) {
        console.error('Lỗi đọc Excel:', err)
        setImportError(
          err.message || 'Không thể đọc file Excel. Vui lòng thử lại.',
        )
      }
    }
    reader.readAsBinaryString(file)
  }

  // Nhóm các tiêu chí đã parse từ Excel để hiển thị preview
  const parsedGroups = useMemo(() => {
    const map = new Map<string, { groupName: string; totalScore: number; items: CriterionItem[] }>()
    let total = 0
    parsedCriteria.forEach((item) => {
      total += item.maxScore
      if (!map.has(item.groupName)) {
        map.set(item.groupName, {
          groupName: item.groupName,
          totalScore: 0,
          items: [],
        })
      }
      const g = map.get(item.groupName)!
      g.items.push(item)
      g.totalScore = Math.round((g.totalScore + item.maxScore) * 1000) / 1000
    })
    return {
      groups: Array.from(map.values()),
      totalScore: Math.round(total * 1000) / 1000,
    }
  }, [parsedCriteria])

  // Lưu bộ tiêu chí từ Modal Import vào Database
  const handleSaveImport = async () => {
    if (parsedCriteria.length === 0 && !importRubricId) {
      toast.warning('Thiếu dữ liệu tiêu chí', {
        message: 'Vui lòng chọn file Excel bảng điểm để trích xuất tiêu chí',
      })
      return
    }

    if (
      importRubricType === 'course' &&
      importSelectedCourses.length === 0
    ) {
      toast.warning('Chưa chọn khóa học', {
        message: 'Vui lòng chọn ít nhất một khóa học LMS để áp dụng bộ tiêu chí này',
      })
      return
    }

    // Tự động đặt tên phía sau hậu trường (người dùng không cần nhập)
    let autoName = importRubricName.trim()
    if (!autoName) {
      if (importRubricType === 'common') {
        autoName = 'Tiêu chí chấm điểm chung'
      } else if (importSelectedCourses.length > 0) {
        autoName =
          importSelectedCourses.map((c) => c.name).slice(0, 3).join(', ') +
          (importSelectedCourses.length > 3 ? ` (+${importSelectedCourses.length - 3})` : '')
      } else {
        autoName = importFileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') || 'Bộ tiêu chí'
      }
    }

    setIsSavingImport(true)
    try {
      const res = await fetch('/api/admin/grading-criteria/rubrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          id: importRubricId || undefined,
          name: autoName,
          type: importRubricType,
          applyToAllCourses: importRubricType === 'common' && importApplyToAll,
          criteria: parsedCriteria,
          courses: importSelectedCourses,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setIsImportModalOpen(false)
        fetchRubrics()
        toast.success('Lưu bộ tiêu chí thành công!', {
          message: `Đã lưu bộ tiêu chí "${autoName}" (${parsedCriteria.length} tiêu chí / ${parsedGroups.groups.length} nhóm)`,
        })
      } else {
        toast.error('Lỗi khi lưu bộ tiêu chí', {
          message: data.error || 'Có lỗi xảy ra khi lưu vào database',
        })
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối khi lưu', {
        message: e.message || 'Lỗi mạng khi gửi yêu cầu lên máy chủ',
      })
    } finally {
      setIsSavingImport(false)
    }
  }

  // Toggle chọn khóa học trong Modal Import
  const handleToggleCourseInImport = (c: CourseOption) => {
    const exists = importSelectedCourses.some((item) => item.id === c.id)
    if (exists) {
      setImportSelectedCourses((prev) => prev.filter((item) => item.id !== c.id))
    } else {
      setImportSelectedCourses((prev) => [
        ...prev,
        { id: c.id, name: c.name, code: c.code },
      ])
    }
  }

  // Toggle chọn khóa học trong Modal Gán khóa học
  const handleToggleCourseInAssign = (c: CourseOption) => {
    const exists = assignSelectedCourses.some((item) => item.id === c.id)
    if (exists) {
      setAssignSelectedCourses((prev) => prev.filter((item) => item.id !== c.id))
    } else {
      setAssignSelectedCourses((prev) => [
        ...prev,
        { id: c.id, name: c.name, code: c.code },
      ])
    }
  }

  // Chặn người dùng không có quyền
  if (!authLoading && !isSuperAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800">
          <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold">Không có quyền truy cập</h2>
          <p className="text-sm mt-1 text-rose-600">
            Chức năng quản lý tiêu chí chấm điểm demo chỉ dành cho Quản trị viên (Super Admin).
          </p>
        </div>
      </div>
    )
  }

  const courseRubricsCount = rubrics.filter((r) => r.type === 'course').length
  const commonRubricsCount = rubrics.filter((r) => r.type === 'common').length

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-[#a1001f] border border-rose-200/80 mb-1.5">
            <Sparkles className="h-3 w-3" />
            Cấu hình Bảng điểm Demo
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-[#a1001f]" />
            Quản lý Tiêu chí Chấm điểm Demo
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Import và quản lý các bộ tiêu chí rubric. Một bộ tiêu chí có thể áp dụng linh hoạt cho nhiều khóa học LMS khác nhau.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchRubrics}
            disabled={loadingRubrics}
            className="inline-flex h-9 items-center justify-center gap-1.5 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            title="Làm mới danh sách"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingRubrics ? 'animate-spin' : ''}`}
            />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreateModal(activeTab)}
            className="inline-flex h-9 items-center justify-center gap-1.5 px-4 rounded-xl bg-[#a1001f] text-xs font-semibold text-white hover:bg-[#850019] transition shadow-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            Import Bộ Tiêu Chí Từ Excel
          </button>
        </div>
      </div>

      {/* ── 2. TABS CHUYỂN ĐỔI: THEO KHÓA HỌC / CHẤM ĐIỂM CHUNG ─────────────── */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('course')}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition ${
            activeTab === 'course'
              ? 'border-[#a1001f] text-[#a1001f] bg-rose-50/20'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Tiêu chí theo Khóa học (Chuyên môn)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
              activeTab === 'course'
                ? 'bg-[#a1001f] text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {courseRubricsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('common')}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition ${
            activeTab === 'common'
              ? 'border-[#a1001f] text-[#a1001f] bg-rose-50/20'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Tiêu chí Chấm điểm chung (Thuyết trình, Tác phong...)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
              activeTab === 'common'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {commonRubricsCount}
          </span>
        </button>
      </div>

      {/* ── 3. THANH TÌM KIẾM BỘ TIÊU CHÍ ──────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === 'course'
                ? 'Tìm theo tên bộ tiêu chí hoặc tên khóa học...'
                : 'Tìm kiếm bộ tiêu chí chung...'
            }
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]"
          />
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          {activeTab === 'course' ? (
            <span>
              Mỗi bộ tiêu chí chuyên môn có thể được gán cho <strong>1 hoặc nhiều</strong> khóa học LMS.
            </span>
          ) : (
            <span>
              Tiêu chí chung có thể áp dụng cho <strong>Tất cả</strong> hoặc <strong>Nhiều khóa học</strong> được chọn.
            </span>
          )}
        </div>
      </div>

      {/* ── 4. DANH SÁCH BỘ TIÊU CHÍ ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loadingRubrics ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#a1001f]" />
            Đang tải dữ liệu tiêu chí...
          </div>
        ) : filteredRubrics.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm space-y-3">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300" />
            <div className="font-semibold text-slate-700">
              {activeTab === 'course'
                ? 'Chưa có bộ tiêu chí nào theo khóa học'
                : 'Chưa có bộ tiêu chí chấm điểm chung nào'}
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {activeTab === 'course'
                ? 'Nhấn nút "Import Bộ Tiêu Chí Từ Excel" để tải lên file Excel bảng điểm demo và chọn các khóa học LMS áp dụng.'
                : 'Tạo tiêu chí chung (như Kỹ năng thuyết trình, Slide, Tác phong) có thể áp dụng tự động cho nhiều hoặc toàn bộ khóa học.'}
            </p>
            <button
              type="button"
              onClick={() => handleOpenCreateModal(activeTab)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#a1001f] text-white text-xs font-semibold hover:bg-[#850019] transition shadow-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              Import File Excel Ngay
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-4 min-w-[300px]">
                    {activeTab === 'course'
                      ? 'Khóa học LMS áp dụng'
                      : 'Phạm vi áp dụng'}
                  </th>
                  <th className="py-3 px-4 w-32 text-center">Số tiêu chí</th>
                  <th className="py-3 px-4 w-32 text-center">Điểm tối đa</th>
                  <th className="py-3 px-4 w-36 text-center">Cập nhật</th>
                  <th className="py-3 px-4 w-40 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRubrics.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>

                    {/* Khóa học LMS áp dụng / Phạm vi áp dụng */}
                    <td className="py-3 px-4">
                      {r.type === 'common' && r.applyToAllCourses ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold text-[11px]">
                          <Globe className="h-3.5 w-3.5" />
                          <span>Áp dụng cho TẤT CẢ khóa học LMS</span>
                        </div>
                      ) : r.assignedCourses && r.assignedCourses.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 max-w-lg">
                          {r.assignedCourses.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold"
                              title={c.name}
                            >
                              <BookOpen className="h-3 w-3 text-[#a1001f]" />
                              <span>{c.name}</span>
                              {c.code && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({c.code})
                                </span>
                              )}
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(r)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-[#a1001f] bg-rose-50 hover:bg-rose-100 border border-rose-200/60"
                            title="Gán thêm / Bỏ bớt khóa học"
                          >
                            <Link2 className="h-3 w-3" />
                            <span>Gán khóa học</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>Chưa gán khóa học nào</span>
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(r)}
                            className="ml-1 text-[11px] underline font-bold hover:text-amber-800"
                          >
                            + Gán ngay
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Số tiêu chí */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-semibold text-slate-800">
                        {r.criteriaCount} mục ({r.groupCount} nhóm)
                      </span>
                    </td>

                    {/* Điểm tối đa */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-slate-900 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                        {r.totalMaxScore} điểm
                      </span>
                    </td>

                    {/* Cập nhật lần cuối */}
                    <td className="py-3 px-4 text-center text-slate-500 text-[11px]">
                      {r.updatedAt
                        ? new Date(r.updatedAt).toLocaleDateString('vi-VN')
                        : '—'}
                    </td>

                    {/* Thao tác */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenViewRubric(r)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition"
                          title="Xem chi tiết bảng tiêu chí"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAssignModal(r)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition"
                          title="Quản lý các khóa học áp dụng"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditExcelModal(r)}
                          className="p-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 text-amber-700 transition"
                          title="Cập nhật lại từ file Excel"
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRubric(r)}
                          className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
                          title="Xóa bộ tiêu chí này"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 5. MODAL XEM CHI TIẾT BẢNG TIÊU CHÍ ──────────────────────────────── */}
      {selectedRubricForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Header modal */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-rose-50 text-[#a1001f] border border-rose-200 flex items-center justify-center">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedRubricForView.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>
                      Loại:{' '}
                      <strong className="text-slate-700">
                        {selectedRubricForView.type === 'common'
                          ? 'Tiêu chí chung'
                          : 'Theo khóa học'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Áp dụng:{' '}
                      <strong className="text-slate-700">
                        {selectedRubricForView.applyToAllCourses
                          ? 'Tất cả khóa học'
                          : `${selectedRubricForView.assignedCourses?.length || 0} khóa học`}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRubricForView(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nội dung bảng tiêu chí */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingViewDetail ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#a1001f]" />
                  Đang tải chi tiết bảng tiêu chí...
                </div>
              ) : viewCriteriaGroups.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Chưa có tiêu chí nào được lưu.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[55%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#a1001f] text-white font-semibold divide-x divide-red-800 text-[11px]">
                        <th className="py-2.5 px-4 text-left">Tiêu chí chung / Nhóm tiêu chí</th>
                        <th className="py-2.5 px-4 text-left">Nội dung</th>
                        <th className="py-2.5 px-3 text-center">Điểm tối đa</th>
                      </tr>
                    </thead>
                    {viewCriteriaGroups.map((group, gIdx) => (
                      <tbody key={group.groupName || gIdx} className="divide-y divide-slate-100 border-b border-slate-200">
                        {group.items.map((item, iIdx) => (
                          <tr
                            key={item.id || `${gIdx}-${iIdx}`}
                            className="hover:bg-slate-50/50 transition"
                          >
                            {iIdx === 0 && (
                              <td
                                rowSpan={group.items.length}
                                className="py-3 px-4 font-bold text-slate-900 bg-slate-50/70 border-r border-slate-200 align-top break-words"
                              >
                                <div className="leading-snug">{group.groupName}</div>
                                <div className="text-[10px] text-slate-500 font-mono mt-1 font-normal">
                                  ({group.totalGroupScore} điểm)
                                </div>
                              </td>
                            )}
                            <td className="py-2.5 px-4 text-slate-800 border-r border-slate-200 align-top break-words leading-relaxed">
                              {item.content}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 align-middle">
                              {item.maxScore.toFixed(3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td
                          colSpan={2}
                          className="py-3 px-4 text-right uppercase tracking-wider text-xs"
                        >
                          Tổng điểm tối đa:
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-base text-[#a1001f]">
                          {selectedRubricForView.totalMaxScore}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedRubricForView(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. MODAL GÁN KHÓA HỌC (ASSIGN COURSES MODAL) ────────────────────── */}
      {isAssignModalOpen && assignTargetRubric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Header modal */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
                  <Link2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Phân Bổ Khóa Học Áp Dụng
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bộ tiêu chí: <strong>{assignTargetRubric.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Thân modal: Chọn khóa học */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={assignCourseSearch}
                    onChange={(e) => setAssignCourseSearch(e.target.value)}
                    placeholder="Tìm nhanh khóa học theo tên hoặc mã..."
                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:bg-white focus:border-[#a1001f]"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const allMap = new Map<string, RubricCourse>()
                      assignSelectedCourses.forEach((c) => allMap.set(c.id, c))
                      assignFilteredCourses.forEach((c) =>
                        allMap.set(c.id, { id: c.id, name: c.name, code: c.code }),
                      )
                      setAssignSelectedCourses(Array.from(allMap.values()))
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Chọn tất cả ({assignFilteredCourses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignSelectedCourses([])}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Bỏ chọn hết
                  </button>
                </div>
              </div>

              {/* Thông tin số lượng đã chọn */}
              <div className="text-xs text-slate-600 flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span>
                  Đã chọn:{' '}
                  <strong className="text-[#a1001f]">
                    {assignSelectedCourses.length} khóa học
                  </strong>
                </span>
                <span className="text-slate-400 text-[11px]">
                  Tổng {lmsCourses.length} khóa học LMS
                </span>
              </div>

              {/* Danh sách checkbox khóa học */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {assignFilteredCourses.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Không tìm thấy khóa học nào phù hợp với từ khóa tìm kiếm.
                  </div>
                ) : (
                  assignFilteredCourses.map((c) => {
                    const isChecked = assignSelectedCourses.some(
                      (item) => item.id === c.id,
                    )
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleToggleCourseInAssign(c)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition ${
                          isChecked
                            ? 'bg-rose-50/50 hover:bg-rose-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by div
                            className="rounded text-[#a1001f] focus:ring-[#a1001f] h-4 w-4"
                          />
                          <div>
                            <div className="text-xs font-semibold text-slate-900">
                              {c.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {c.code || c.shortName || 'Chưa có mã'} • Khối:{' '}
                              {c.courseLineName || '—'}
                            </div>
                          </div>
                        </div>
                        {isChecked && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Đang áp dụng
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Footer modal */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingAssign}
                onClick={handleSaveAssignCourses}
                className="px-5 py-2 rounded-xl bg-[#a1001f] text-xs font-semibold text-white hover:bg-[#850019] transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingAssign ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Lưu phân bổ ({assignSelectedCourses.length} khóa)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. MODAL IMPORT EXCEL / TẠO BỘ TIÊU CHÍ ─────────────────────────── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Header modal */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-rose-50 text-[#a1001f] border border-rose-200 flex items-center justify-center">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {importRubricId
                      ? 'Cập Nhật Bộ Tiêu Chí Từ File Excel'
                      : 'Import Bộ Tiêu Chí Mới Từ Excel'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đọc file Excel bảng điểm demo và áp dụng cho một hoặc nhiều khóa học
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nội dung form */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* 1. Chọn loại tiêu chí */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  1. Loại tiêu chí áp dụng: <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => {
                      setImportRubricType('course')
                      setImportApplyToAll(false)
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      importRubricType === 'course'
                        ? 'border-[#a1001f] bg-rose-50/50 text-[#a1001f] font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rubricType"
                      checked={importRubricType === 'course'}
                      onChange={() => {}}
                      className="text-[#a1001f] focus:ring-[#a1001f] h-4 w-4"
                    />
                    <div>
                      <div className="text-xs">Theo Khóa học (Chuyên môn)</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        Áp dụng cho 1 hoặc nhiều khóa học cụ thể
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setImportRubricType('common')
                      setImportApplyToAll(true)
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      importRubricType === 'common'
                        ? 'border-[#a1001f] bg-rose-50/50 text-[#a1001f] font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rubricType"
                      checked={importRubricType === 'common'}
                      onChange={() => {}}
                      className="text-[#a1001f] focus:ring-[#a1001f] h-4 w-4"
                    />
                    <div>
                      <div className="text-xs">Tiêu chí Chấm điểm chung</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        Kỹ năng thuyết trình, thái độ, tác phong...
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Chọn Khóa học áp dụng */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Khóa học LMS áp dụng (có thể chọn nhiều khóa):{' '}
                    <span className="text-rose-500">*</span>
                  </label>

                  {importRubricType === 'common' && (
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importApplyToAll}
                        onChange={(e) => setImportApplyToAll(e.target.checked)}
                        className="rounded text-[#a1001f] focus:ring-[#a1001f] h-4 w-4"
                      />
                      <span>Áp dụng cho TẤT CẢ các khóa học</span>
                    </label>
                  )}
                </div>

                {importRubricType === 'common' && importApplyToAll ? (
                  <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 p-3 rounded-lg flex items-center gap-2">
                    <Globe className="h-4 w-4 shrink-0" />
                    <span>
                      Bộ tiêu chí này sẽ tự động hiển thị trong buổi demo của <strong>tất cả các khóa học</strong> trên hệ thống LMS.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={importCourseSearch}
                          onChange={(e) => setImportCourseSearch(e.target.value)}
                          placeholder="Tìm nhanh khóa học LMS..."
                          className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Đã chọn:{' '}
                        <strong className="text-[#a1001f]">
                          {importSelectedCourses.length} khóa
                        </strong>
                      </span>
                    </div>

                    {/* Chip danh sách khóa học đã chọn */}
                    {importSelectedCourses.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                        {importSelectedCourses.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-[#a1001f] text-[11px] font-medium border border-rose-200"
                          >
                            <span>{c.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setImportSelectedCourses((prev) =>
                                  prev.filter((item) => item.id !== c.id),
                                )
                              }
                              className="hover:text-red-800"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Danh sách chọn khóa học */}
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-44 overflow-y-auto bg-white">
                      {importFilteredCourses.slice(0, 50).map((c) => {
                        const isChecked = importSelectedCourses.some(
                          (item) => item.id === c.id,
                        )
                        return (
                          <div
                            key={c.id}
                            onClick={() => handleToggleCourseInImport(c)}
                            className={`px-3 py-1.5 flex items-center justify-between cursor-pointer text-xs ${
                              isChecked
                                ? 'bg-rose-50/60 font-semibold text-[#a1001f]'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded text-[#a1001f] focus:ring-[#a1001f] h-3.5 w-3.5"
                              />
                              <span className="truncate">{c.name}</span>
                              {c.code && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({c.code})
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {c.courseLineName}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* 3. Upload file Excel */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Chọn file Excel bảng điểm mẫu (.xlsx, .xls):{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-[#a1001f] rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-rose-50/10 transition"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <FileSpreadsheet className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-700">
                    {importFileName ? (
                      <span className="text-emerald-700 font-bold">
                        {importFileName}
                      </span>
                    ) : (
                      'Nhấn để tải lên file Excel bảng điểm demo'
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Cấu trúc gồm các cột: Tiêu chí chung / Nhóm tiêu chí | Nội dung chi tiết | Điểm tối đa (Tự động bỏ qua phần nhận xét & BGK ở cuối)
                  </div>
                </div>

                {importError && (
                  <div className="mt-2 text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}
              </div>

              {/* 4. Xem trước (Preview) dữ liệu tiêu chí */}
              {parsedCriteria.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span>
                      Xem trước tiêu chí đã trích xuất ({parsedCriteria.length} mục /{' '}
                      {parsedGroups.groups.length} nhóm)
                    </span>
                    <span className="text-[#a1001f] font-mono">
                      Tổng điểm tối đa: {parsedGroups.totalScore}
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse table-fixed">
                      <colgroup>
                        <col className="w-[32%]" />
                        <col className="w-[53%]" />
                        <col className="w-[15%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px]">
                          <th className="py-2.5 px-3.5 border-r border-slate-200">Tiêu chí chung / Nhóm tiêu chí</th>
                          <th className="py-2.5 px-3.5 border-r border-slate-200">Nội dung</th>
                          <th className="py-2.5 px-3 text-center">Điểm tối đa</th>
                        </tr>
                      </thead>
                      {parsedGroups.groups.map((group, gIdx) => (
                        <tbody key={group.groupName || gIdx} className="divide-y divide-slate-100 border-b border-slate-200">
                          {group.items.map((item, iIdx) => (
                            <tr key={`${gIdx}-${iIdx}`} className="hover:bg-slate-50 transition">
                              {iIdx === 0 && (
                                <td
                                  rowSpan={group.items.length}
                                  className="py-2.5 px-3.5 font-bold text-slate-900 bg-slate-50/70 border-r border-slate-200 align-top break-words"
                                >
                                  <div className="leading-snug">{group.groupName}</div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-1 font-normal">
                                    ({group.totalScore} điểm)
                                  </div>
                                </td>
                              )}
                              <td className="py-2 px-3.5 text-slate-700 border-r border-slate-200 align-top break-words leading-relaxed">
                                {item.content}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 align-middle">
                                {item.maxScore}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))}
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={
                  isSavingImport ||
                  (parsedCriteria.length === 0 && !importRubricId) ||
                  (importRubricType === 'course' && importSelectedCourses.length === 0)
                }
                onClick={handleSaveImport}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#a1001f] text-xs font-semibold text-white hover:bg-[#850019] transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingImport ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Đang lưu vào Database...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Xác nhận & Lưu vào Database
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
