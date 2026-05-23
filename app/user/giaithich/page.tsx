'use client'

import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Stepper } from '@/components/ui/stepper'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { useTeacher } from '@/lib/teacher-context'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/app-toast'

interface Explanation {
  id: number
  teacher_name: string
  lms_code: string
  email: string
  campus: string
  subject: string
  test_date: string
  reason: string
  status: 'pending' | 'accepted' | 'rejected'
  admin_note?: string
  created_at: string
  updated_at: string
}

interface CenterOption {
  id: number
  region: string
  short_code: string
  full_name: string
  display_name: string
}

interface SubjectOption {
  id: number
  exam_type: string
  block_code: string
  subject_code: string
  subject_name: string
  is_active: boolean
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')


export default function GiaiTrinhPage() {
  const { user, token } = useAuth()
  const { teacherProfile, isLoading: isTeacherLoading } = useTeacher()
  const [explanations, setExplanations] = useState<Explanation[]>([])
  const [centers, setCenters] = useState<CenterOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingReferenceData, setLoadingReferenceData] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [campusSearch, setCampusSearch] = useState('')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [showCampusList, setShowCampusList] = useState(false)
  const [showSubjectList, setShowSubjectList] = useState(false)
  const [selectedExplanation, setSelectedExplanation] =
    useState<Explanation | null>(null)

  const [formData, setFormData] = useState({
    teacher_name: '',
    lms_code: '',
    email: user?.email || '',
    campus: '',
    subject: '',
    test_date: '',
    reason: '',
  })

  const filteredCampusList = useMemo(() => {
    const normalizedSearch = normalizeText(campusSearch)

    return centers
      .map((center) => center.full_name || center.display_name)
      .filter(Boolean)
      .filter((campus) => normalizeText(campus).includes(normalizedSearch))
  }, [campusSearch, centers])

  const filteredSubjectList = useMemo(() => {
    const normalizedSearch = normalizeText(subjectSearch)

    return subjects
      .map((subject) => subject.subject_name)
      .filter(Boolean)
      .filter((subject) => normalizeText(subject).includes(normalizedSearch))
  }, [subjectSearch, subjects])

  // Close modal when clicking outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false)
        setSelectedExplanation(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  // Fetch danh sách giải thích của user
  const fetchExplanations = async () => {
    try {
      const response = await fetch(`/api/explanations?email=${user?.email}`)
      const data = await response.json()
      if (data.success) {
        setExplanations(data.data)
      }
    } catch (error) {
      console.error('Error fetching explanations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.email) {
      fetchExplanations()
    }
  }, [user])

  // Handle center auto-fill
  useEffect(() => {
    if (teacherProfile && centers.length > 0) {
      const branchToMatch =
        teacherProfile.branchCurrent || teacherProfile.branchIn || ''
      if (!branchToMatch) return

      const normalizedBranch = normalizeText(branchToMatch)
      const match = centers.find((c) => {
        const name = c.full_name || c.display_name || ''
        return normalizeText(name).includes(normalizedBranch)
      })

      const newData = {
        teacher_name: teacherProfile.name || user?.displayName || '',
        lms_code: teacherProfile.code || '',
        email: teacherProfile.emailMindx || user?.email || '',
        campus: match ? match.full_name || match.display_name : '',
      }

      setFormData((prev) => {
        // Create new state by merging
        const updated = {
          ...prev,
          teacher_name: newData.teacher_name || prev.teacher_name,
          lms_code: newData.lms_code || prev.lms_code,
          email: newData.email || prev.email,
          campus: newData.campus || prev.campus,
        }

        return updated
      })

      if (match) {
        setCampusSearch(match.full_name || match.display_name)
      }
    }
  }, [teacherProfile, centers, user])

  useEffect(() => {
    let isActive = true

    const loadReferenceData = async () => {
      try {
        const [centersResponse, subjectsResponse] = await Promise.all([
          fetch('/api/app-auth/data?table=centers&status=Active', {
            headers: authHeaders(token),
          }),
          fetch(
            '/api/database?action=preview&table=exam_subject_catalog&limit=200&sort=subject_name&order=asc',
          ),
        ])

        const centersData = await centersResponse.json()
        const subjectsData = await subjectsResponse.json()

        if (!isActive) return

        const centerRows = Array.isArray(centersData.rows)
          ? centersData.rows
          : []
        setCenters(
          centerRows.map((row: any) => ({
            id: Number(row.id),
            region: String(row.region || ''),
            short_code: String(row.short_code || ''),
            full_name: String(row.full_name || ''),
            display_name: String(row.display_name || ''),
          })),
        )

        const subjectRows = Array.isArray(subjectsData.rows)
          ? subjectsData.rows
          : []
        setSubjects(
          subjectRows
            .filter((row: any) => row.is_active !== false)
            .map((row: any) => ({
              id: Number(row.id),
              exam_type: String(row.exam_type || ''),
              block_code: String(row.block_code || ''),
              subject_code: String(row.subject_code || ''),
              subject_name: String(row.subject_name || ''),
              is_active: Boolean(row.is_active),
            })),
        )
      } catch (error) {
        console.error('Error loading reference data:', error)
        if (isActive) {
          setCenters([])
          setSubjects([])
        }
      } finally {
        if (isActive) {
          setLoadingReferenceData(false)
        }
      }
    }

    loadReferenceData()

    return () => {
      isActive = false
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/explanations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          'Gửi giải trình thành công! Email đã được gửi đến bộ phận học vụ.',
        )
        setShowModal(false)
        setCampusSearch('')
        setSubjectSearch('')
        setFormData((prev) => ({
          ...prev,
          campus: '',
          subject: '',
          test_date: '',
          reason: '',
        }))
        fetchExplanations()
      } else {
        toast.error('Lỗi: ' + data.error)
      }
    } catch (error) {
      console.error('Error submitting explanation:', error)
      toast.error('Có lỗi xảy ra khi gửi giải trình')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      accepted: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
    }
    const labels = {
      pending: 'Đang chờ',
      accepted: 'Đã chấp nhận',
      rejected: 'Đã từ chối',
    }
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badges[status as keyof typeof badges]}`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  if (loading || loadingReferenceData) {
    return <PageSkeleton variant="table" itemCount={8} showHeader={true} />
  }

  return (
    <PageLayout>
      <PageLayoutContent spacing="xl">
        {/* Header */}
        <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Giải Trình Không Tham Gia Kiểm Tra
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Quản lý và theo dõi các giải trình của bạn
            </p>
          </div>
          <Button
            onClick={() => setShowModal(true)}
            size="lg"
            className="whitespace-nowrap border-2 border-[#a1001f] bg-[#a1001f] text-white shadow-md hover:bg-[#8a001a]"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Tạo Giải Trình Mới
          </Button>
        </div>
      </div>

      {/* Modal Form - Responsive for mobile */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Tạo Giải Trình Mới"
        size="3xl"
        headerColor="bg-[#a1001f]"
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            {/* Row 1: Subject */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Bộ môn <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={subjectSearch || formData.subject}
                onChange={(e) => {
                  setSubjectSearch(e.target.value)
                  setFormData({ ...formData, subject: e.target.value })
                  setShowSubjectList(true)
                }}
                onFocus={() => setShowSubjectList(true)}
                onBlur={() => setTimeout(() => setShowSubjectList(false), 200)}
                className="w-full px-3 py-2.5 border border-[#e7c6cb] rounded-lg focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f] transition-all"
                placeholder={
                  loadingReferenceData
                    ? 'Đang tải danh sách bộ môn...'
                    : 'Nhập hoặc chọn bộ môn'
                }
                autoComplete="off"
              />
              {showSubjectList && loadingReferenceData && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-[#e7c6cb] rounded-lg shadow-lg p-3 text-sm text-gray-500">
                  Đang tải danh sách bộ môn...
                </div>
              )}
              {showSubjectList &&
                !loadingReferenceData &&
                filteredSubjectList.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-[#e7c6cb] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredSubjectList.map((subject, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setFormData({ ...formData, subject })
                          setSubjectSearch(subject)
                          setShowSubjectList(false)
                        }}
                        className="px-3 py-2 hover:bg-[#fff1f3] cursor-pointer text-sm transition-colors"
                      >
                        {subject}
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Row 2: Test Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ngày kiểm tra <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.test_date}
                onChange={(e) =>
                  setFormData({ ...formData, test_date: e.target.value })
                }
                className="w-full px-3 py-2.5 border border-[#e7c6cb] rounded-lg focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f] transition-all"
              />
            </div>

            {/* Row 5: Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Lý do không tham gia <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                className="w-full px-3 py-2.5 border border-[#e7c6cb] rounded-lg focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f] transition-all resize-none"
                placeholder="Nhập lý do chi tiết về việc không thể tham gia kiểm tra..."
              />
            </div>
          </div>
          <div className="mt-4 border-t border-[#f1d1d8] pt-3">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full font-medium shadow-sm bg-[#a1001f] text-white hover:bg-[#8a0019]"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <div className="-ml-1 mr-2 h-4 w-4 bg-white/50 rounded-full animate-pulse"></div>
                  <span className="ml-2">Đang gửi...</span>
                </span>
              ) : (
                'Gửi Giải Trình'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Danh sách giải trình - Responsive Cards */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-4 sm:px-6 py-5 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Danh Sách Giải Trình
              </h2>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  {explanations.length}
                </span>{' '}
                giải trình
              </p>
            </div>
          </div>

          {explanations.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Chưa có giải trình nào
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Bắt đầu bằng cách tạo giải trình mới
              </p>
              <Button onClick={() => setShowModal(true)} className="mt-6">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Tạo Giải Trình Mới
              </Button>
            </div>
          ) : (
            <div>
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="uppercase tracking-wider">
                        Created
                      </TableHead>
                      <TableHead className="uppercase tracking-wider">
                        Test Date
                      </TableHead>
                      <TableHead className="uppercase tracking-wider">
                        Campus
                      </TableHead>
                      <TableHead className="uppercase tracking-wider">
                        Subject
                      </TableHead>
                      <TableHead className="uppercase tracking-wider">
                        Status
                      </TableHead>
                      <TableHead className="uppercase tracking-wider">
                        Details
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {explanations &&
                      explanations.map((explanation) => (
                        <TableRow
                          key={explanation.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <TableCell className="whitespace-nowrap text-gray-900">
                            {new Date(
                              explanation.created_at,
                            ).toLocaleDateString('vi-VN')}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-gray-900">
                            {new Date(explanation.test_date).toLocaleDateString(
                              'vi-VN',
                            )}
                          </TableCell>
                          <TableCell className="text-gray-900">
                            <div className="max-w-xs truncate">
                              {explanation.campus}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-900">
                            <div className="max-w-xs truncate">
                              {explanation.subject}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {getStatusBadge(explanation.status)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Button
                              variant="link"
                              onClick={() =>
                                setSelectedExplanation(explanation)
                              }
                              className="p-0 h-auto font-medium"
                            >
                              Xem chi tiết →
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              <div className="lg:hidden divide-y divide-gray-200">
                {explanations.map((explanation) => (
                  <div
                    key={explanation.id}
                    onClick={() => setSelectedExplanation(explanation)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {explanation.campus}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {explanation.subject}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0">
                        {getStatusBadge(explanation.status)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Ngày tạo:</span>
                        <p className="text-gray-900 font-medium mt-0.5">
                          {new Date(explanation.created_at).toLocaleDateString(
                            'vi-VN',
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Ngày kiểm tra:</span>
                        <p className="text-gray-900 font-medium mt-0.5">
                          {new Date(explanation.test_date).toLocaleDateString(
                            'vi-VN',
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center text-xs text-blue-600 font-medium">
                      <span>Xem chi tiết</span>
                      <svg
                        className="w-4 h-4 ml-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal - Mobile Optimized */}
      <Modal
        open={!!selectedExplanation}
        onClose={() => setSelectedExplanation(null)}
        title="Chi Tiết Giải Trình"
        size="2xl"
        footer={
          <Button
            variant="secondary"
            onClick={() => setSelectedExplanation(null)}
            className="w-full sm:w-auto bg-gray-600 text-white hover:bg-gray-700 font-medium hover:text-white"
          >
            Đóng
          </Button>
        }
      >
        {selectedExplanation && (
          <div className="space-y-4">
            {/* Status Stepper */}
            <div className="pb-6 pt-2 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700 block mb-4">
                Tiến trình xử lý:
              </span>
              <div className="px-4">
                <Stepper
                  steps={[
                    {
                      id: 1,
                      label: 'Gửi yêu cầu',
                      description: 'Mới tạo',
                      status: 'completed',
                    },
                    {
                      id: 2,
                      label: 'Tiếp nhận',
                      description: 'Đang xử lý',
                      status:
                        selectedExplanation.status === 'pending'
                          ? 'current'
                          : 'completed',
                    },
                    {
                      id: 3,
                      label: 'Kết quả',
                      description:
                        selectedExplanation.status === 'accepted'
                          ? 'Đã duyệt'
                          : selectedExplanation.status === 'rejected'
                            ? 'Từ chối'
                            : 'Chờ duyệt',
                      status:
                        selectedExplanation.status === 'accepted'
                          ? 'completed'
                          : selectedExplanation.status === 'rejected'
                            ? 'error'
                            : 'upcoming',
                    },
                  ]}
                />
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Họ và tên</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedExplanation.teacher_name}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Mã LMS</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedExplanation.lms_code}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2">
                <p className="text-xs text-gray-600 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900 break-all">
                  {selectedExplanation.email}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Cơ sở</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedExplanation.campus}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Bộ môn</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedExplanation.subject}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Ngày kiểm tra</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedExplanation.test_date).toLocaleDateString(
                    'vi-VN',
                    {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    },
                  )}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Ngày tạo</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedExplanation.created_at).toLocaleDateString(
                    'vi-VN',
                  )}
                </p>
              </div>
            </div>

            {/* Reason Section */}
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Lý do không tham gia:
              </p>
              <div className="bg-[#fff5f7] border border-[#f1d1d8] rounded-lg p-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {selectedExplanation.reason}
                </p>
              </div>
            </div>

            {/* Admin Note */}
            {selectedExplanation.admin_note && (
              <div className="pt-2">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Ghi chú từ quản lý:
                </p>
                <div
                  className={`border rounded-lg p-4 ${
                    selectedExplanation.status === 'accepted'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {selectedExplanation.admin_note}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      </PageLayoutContent>
    </PageLayout>
  )
}
