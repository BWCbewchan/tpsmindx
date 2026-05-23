'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { AlertTriangle, Save, Trash2 } from 'lucide-react'

interface Manager {
  id: number
  email: string
  full_name: string
  role: string
}

interface Center {
  id: number
  full_name: string
  short_code: string
}

interface AssignedCenter extends Center {
  assignedAt: string
}

export function ManagerCentersAssignment() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(
    null,
  )
  const [assignedCenters, setAssignedCenters] = useState<AssignedCenter[]>([])
  const [selectedCenterIds, setSelectedCenterIds] = useState<Set<number>>(
    new Set(),
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'error' | 'success'
    text: string
  } | null>(null)

  // Fetch managers and centers
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [managersRes, centersRes] = await Promise.all([
          fetch('/api/app-auth/managers', { method: 'GET' }),
          fetch('/api/app-auth/centers', { method: 'GET' }),
        ])

        if (managersRes.ok) {
          const data = await managersRes.json()
          setManagers(data.managers || [])
        }

        if (centersRes.ok) {
          const data = await centersRes.json()
          setCenters(data.centers || [])
        }
      } catch (err) {
        setMessage({
          type: 'error',
          text: `Lỗi tải dữ liệu: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Fetch assigned centers for selected manager
  useEffect(() => {
    if (!selectedManagerId) {
      setAssignedCenters([])
      setSelectedCenterIds(new Set())
      return
    }

    const fetchAssignedCenters = async () => {
      try {
        setLoading(true)
        const res = await fetch(
          `/api/app-auth/manager-centers?userId=${selectedManagerId}`,
        )

        if (res.ok) {
          const data = await res.json()
          setAssignedCenters(data.centers || [])
          setSelectedCenterIds(new Set(data.centers.map((c: Center) => c.id)))
        }
      } catch (err) {
        setMessage({
          type: 'error',
          text: `Lỗi tải centers: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAssignedCenters()
  }, [selectedManagerId])

  const handleCenterToggle = (centerId: number) => {
    const newSelected = new Set(selectedCenterIds)
    if (newSelected.has(centerId)) {
      newSelected.delete(centerId)
    } else {
      newSelected.add(centerId)
    }
    setSelectedCenterIds(newSelected)
  }

  const handleSave = async () => {
    if (!selectedManagerId) return

    try {
      setSaving(true)
      setMessage(null)

      const res = await fetch('/api/app-auth/manager-centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedManagerId,
          centerIds: Array.from(selectedCenterIds),
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Cập nhật thành công!' })
        // Refresh assigned centers
        const refreshRes = await fetch(
          `/api/app-auth/manager-centers?userId=${selectedManagerId}`,
        )
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setAssignedCenters(data.centers || [])
        }
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.message || 'Lỗi cập nhật' })
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: `Lỗi: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveCenter = async (centerId: number) => {
    if (!selectedManagerId) return

    try {
      const res = await fetch(
        `/api/app-auth/manager-centers?userId=${selectedManagerId}&centerId=${centerId}`,
        {
          method: 'DELETE',
        },
      )

      if (res.ok) {
        setMessage({ type: 'success', text: 'Xóa thành công!' })
        setSelectedCenterIds((prev) => {
          const updated = new Set(prev)
          updated.delete(centerId)
          return updated
        })
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.message || 'Lỗi xóa' })
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: `Lỗi: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    }
  }

  if (loading && managers.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded p-4 flex gap-2">
        <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <strong>Chỉ super_admin mới có thể gán centers cho managers.</strong>
          <p>Chọn một manager rồi chọn centers mà họ có thể quản lý.</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded ${
            message.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Manager Selection */}
        <div className="col-span-1">
          <h3 className="font-semibold text-sm mb-3">Chọn Manager</h3>
          <div className="border rounded bg-white">
            {managers.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Không có managers</p>
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {managers.map((manager) => (
                  <button
                    key={manager.id}
                    onClick={() => setSelectedManagerId(manager.id)}
                    className={`w-full text-left p-3 text-sm hover:bg-gray-50 transition ${
                      selectedManagerId === manager.id
                        ? 'bg-blue-50 border-l-2 border-blue-600'
                        : ''
                    }`}
                  >
                    <div className="font-medium">{manager.full_name}</div>
                    <div className="text-xs text-gray-500">{manager.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Middle: Center Selection */}
        <div className="col-span-1">
          <h3 className="font-semibold text-sm mb-3">Các Cơ sở Có sẵn</h3>
          <div className="border rounded bg-white p-3 max-h-96 overflow-y-auto">
            {centers.length === 0 ? (
              <p className="text-sm text-gray-500">Không có centers</p>
            ) : (
              <div className="space-y-2">
                {centers.map((center) => (
                  <label
                    key={center.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCenterIds.has(center.id)}
                      onChange={() => handleCenterToggle(center.id)}
                      className="h-4 w-4 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]"
                    />
                    <div className="text-sm">
                      <div className="font-medium">{center.full_name}</div>
                      <div className="text-xs text-gray-500">
                        {center.short_code}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Assigned Centers */}
        <div className="col-span-1">
          <h3 className="font-semibold text-sm mb-3">Centers Đã Gán</h3>
          <div className="border rounded bg-white max-h-96 overflow-y-auto">
            {assignedCenters.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Chưa gán centers</p>
            ) : (
              <div className="divide-y">
                {assignedCenters.map((center) => (
                  <div
                    key={center.id}
                    className="p-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="text-sm">
                      <div className="font-medium">{center.full_name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(center.assignedAt).toLocaleDateString('vi')}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveCenter(center.id)}
                      className="p-1 hover:bg-red-100 text-red-600 rounded transition"
                      disabled={saving}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {selectedManagerId && (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setSelectedManagerId(null)}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <LoadingSpinner /> : <Save className="w-4 h-4 mr-2" />}
            Lưu Thay Đổi
          </Button>
        </div>
      )}
    </div>
  )
}
