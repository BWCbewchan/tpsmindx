'use client'

import { Modal } from '@/components/ui/modal'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { Button } from '@/components/ui/button'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { Stepper } from '@/components/ui/stepper'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth-context'
import { useTeacher } from '@/lib/teacher-context'
import { CAMPUS_LIST, findMatchingCampus } from '@/lib/campus-data'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

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

interface ExplanationSectionProps {
  compact?: boolean
}

const SUBJECT_LIST = [
  '[COD] Scratch',
  '[COD] Web',
  '[COD] ComputerScience',
  '[COD] GameMaker',
  '[COD] AppProducer',
  '[ART] Test chuyên sâu',
  '[ROB] VexIQ',
  '[ROB] VexGo',
  '[Trial] Quy Trình Trai nghiệm',
]

const STORAGE_KEY = 'teacher_auto_fill_data'

export function ExplanationSection({
  compact = false,
}: ExplanationSectionProps) {
  const { user } = useAuth()
  const { teacherProfile, isLoading: isTeacherLoading } = useTeacher()
  const searchParams = useSearchParams()
  const [explanations, setExplanations] = useState<Explanation[]>([])
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setFormData((prev) => ({ ...prev, ...parsed }))
        if (parsed.campus) setCampusSearch(parsed.campus)
      } catch (e) {
        console.error('Error loading saved data', e)
      }
    }
  }, [])

  useEffect(() => {
    if (teacherProfile) {
      const teacherBranch =
        teacherProfile.branchIn || teacherProfile.branchCurrent || ''
      const matchedCampus = findMatchingCampus(teacherBranch)

      setFormData((prev) => {
        const updated = {
          ...prev,
          teacher_name: teacherProfile.name || prev.teacher_name || '',
          lms_code: teacherProfile.code || prev.lms_code || '',
          campus: matchedCampus || prev.campus || '',
          email:
            teacherProfile.emailMindx ||
            teacherProfile.emailPersonal ||
            prev.email ||
            user?.email ||
            '',
        }

        const dataToSave = {
          teacher_name: updated.teacher_name,
          lms_code: updated.lms_code,
          email: updated.email,
          campus: updated.campus,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))

        return updated
      })

      if (matchedCampus && !campusSearch) {
        setCampusSearch(matchedCampus)
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        email: prev.email || user?.email || '',
      }))
    }
  }, [teacherProfile, user?.email])

  const prefillAssignmentId = searchParams.get('assignment_id')
  const prefillSubject = searchParams.get('subject')
  const prefillCampus = searchParams.get('campus')
  const prefillTestDate = searchParams.get('test_date')

  const filteredCampusList = CAMPUS_LIST.filter((campus) =>
    campus.toLowerCase().includes(campusSearch.toLowerCase()),
  )

  const filteredSubjectList = SUBJECT_LIST.filter((subject) =>
    subject.toLowerCase().includes(subjectSearch.toLowerCase()),
  )

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

  useEffect(() => {
    if (!user?.email || !prefillAssignmentId) return

    const normalizedDate = prefillTestDate
      ? new Date(prefillTestDate).toISOString().slice(0, 10)
      : ''

    setFormData((prev) => ({
      ...prev,
      campus: prefillCampus || prev.campus,
      subject: prefillSubject || prev.subject,
      test_date: normalizedDate || prev.test_date,
      reason:
        prev.reason ||
        `Giải trình cho bài thi quá hạn (Assignment #${prefillAssignmentId}).`,
    }))
    setCampusSearch(prefillCampus || '')
    setSubjectSearch(prefillSubject || '')
    setShowModal(true)
  }, [
    user,
    prefillAssignmentId,
    prefillSubject,
    prefillCampus,
    prefillTestDate,
  ])

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
        setSubjectSearch('')
        setFormData((prev) => ({
          ...prev,
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
    return (
      <div className="min-w-60 px-2 py-1 mx-auto">
        <Stepper
          compact
          steps={[
            {
              id: 1,
              label: 'Gửi yêu cầu',
              status: 'completed',
            },
            {
              id: 2,
              label: 'Tiếp nhận',
              status: status === 'pending' ? 'current' : 'completed',
            },
            {
              id: 3,
              label: 'Kết quả',
              status:
                status === 'accepted'
                  ? 'success'
                  : status === 'rejected'
                    ? 'error'
                    : 'upcoming',
            },
          ]}
        />
      </div>
    )
  }

  if (loading) {
    return <PageSkeleton variant="default" itemCount={8} showHeader={true} maxWidth="7xl" padding={compact ? 'none' : 'md'} />
  }

  return (
    <PageLayout maxWidth="7xl" padding={compact ? 'none' : 'md'}>
      <PageLayoutContent spacing="lg">
        <div className="w-full">
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

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Tạo Giải Trình Mới"
        maxWidth="3xl"
        headerColor="from-blue-600 to-blue-700"
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.teacher_name}
                  onChange={(e) =>
                    setFormData({ ...formData, teacher_name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-all"
                  placeholder={
                    isTeacherLoading ? 'Đang tải...' : 'Tên giáo viên'
                  }
                  readOnly={isTeacherLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mã LMS <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.lms_code}
                  onChange={(e) =>
                    setFormData({ ...formData, lms_code: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-all"
                  placeholder={isTeacherLoading ? 'Đang tải...' : 'Mã LMS'}
                  readOnly={isTeacherLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="email@mindx.edu.vn"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Cơ sở <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={campusSearch || formData.campus}
                  onChange={(e) => {
                    setCampusSearch(e.target.value)
                    setFormData({ ...formData, campus: e.target.value })
                    setShowCampusList(true)
                  }}
                  onFocus={() => setShowCampusList(true)}
                  onBlur={() => setTimeout(() => setShowCampusList(false), 200)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Nhập hoặc chọn cơ sở"
                  autoComplete="off"
                />
                {showCampusList && filteredCampusList.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredCampusList.map((campus, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setFormData({ ...formData, campus })
                          setCampusSearch(campus)
                          setShowCampusList(false)
                        }}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm transition-colors"
                      >
                        {campus}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bộ môn <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.subject}
                  onChange={(e) => {
                    const subject = e.target.value
                    setFormData({ ...formData, subject })
                    setSubjectSearch(subject)
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-[16px] text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:hidden"
                >
                  <option value="">Chọn bộ môn</option>
                  {SUBJECT_LIST.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>

                <div className="relative hidden sm:block">
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
                    onBlur={() =>
                      setTimeout(() => setShowSubjectList(false), 200)
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Nhập hoặc chọn bộ môn"
                    autoComplete="off"
                  />
                  {showSubjectList && filteredSubjectList.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredSubjectList.map((subject, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            setFormData({ ...formData, subject })
                            setSubjectSearch(subject)
                            setShowSubjectList(false)
                          }}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm transition-colors"
                        >
                          {subject}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                placeholder="Nhập lý do chi tiết về việc không thể tham gia kiểm tra..."
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
              className="w-full sm:w-auto font-medium"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto font-medium shadow-sm"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <div className="w-4 h-4 bg-white/30 rounded mr-2"></div>
                  Đang gửi...
                </span>
              ) : (
                'Gửi Giải Trình'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-4 sm:px-6 py-5 border-b border-gray-200 bg-linear-to-r from-gray-50 to-white">
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
                        Created Date
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {explanations.map((explanation) => (
                      <TableRow
                        key={explanation.id}
                        className="group cursor-pointer transition-all duration-200 hover:bg-blue-50/80 hover:shadow-md relative z-0 hover:z-10"
                        onClick={() => setSelectedExplanation(explanation)}
                      >
                        <TableCell className="whitespace-nowrap text-gray-900">
                          {new Date(explanation.created_at).toLocaleDateString(
                            'vi-VN',
                          )}
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

      <Modal
        isOpen={!!selectedExplanation}
        onClose={() => setSelectedExplanation(null)}
        title="Chi Tiết Giải Trình"
        maxWidth="2xl"
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
                          ? 'success'
                          : selectedExplanation.status === 'rejected'
                            ? 'error'
                            : 'upcoming',
                    },
                  ]}
                />
              </div>
            </div>

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

            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Lý do không tham gia:
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {selectedExplanation.reason}
                </p>
              </div>
            </div>

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
