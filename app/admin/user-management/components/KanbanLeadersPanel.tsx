'use client'

import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { getLeaderAreas } from '@/lib/teaching-leaders'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { GripVertical, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/app-toast'

export interface KanbanLeader {
  code: string
  full_name: string
  role_code: string
  role_name: string
  center: string
  courses: string
  area: string
  areas?: string[]
  status: string
  joined_date: string
}

const DROP_ACTIVE = 'drop-status-Active'
const DROP_DEACTIVE = 'drop-status-Deactive'

function DraggableLeaderCard({ leader }: { leader: KanbanLeader }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useDraggable({
    id: `leader-${leader.code}`,
    data: { leader },
  })

  const areas = getLeaderAreas(leader)

  return (
    <div
      ref={setNodeRef}
      className={`group flex w-full min-w-0 shrink-0 select-none items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? 'invisible' : ''
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="mt-0.5 cursor-grab touch-none select-none rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
        aria-label={`Kéo ${leader.full_name}`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="pointer-events-none h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-900">
            {leader.full_name}
          </span>
          <span className="text-[11px] text-gray-400">({leader.code})</span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
          {leader.center || '—'}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
            {leader.role_code}
          </span>
          {areas.slice(0, 3).map((a) => (
            <span
              key={a}
              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
            >
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function KanbanColumn({
  id,
  title,
  subtitle,
  accentClass,
  children,
}: {
  id: string
  title: string
  subtitle: string
  accentClass: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[min(70vh,520px)] min-w-0 flex-1 select-none flex-col rounded-xl border border-gray-200 bg-gray-50/80 transition-colors ${
        isOver ? 'bg-[#a1001f]/5 ring-2 ring-[#a1001f]/30' : ''
      }`}
    >
      <div
        className={`shrink-0 border-b px-3 py-2.5 ${accentClass} rounded-t-xl`}
      >
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-[11px] text-gray-600">{subtitle}</p>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {children}
      </div>
    </div>
  )
}

export default function KanbanLeadersPanel() {
  const { token } = useAuth()
  const [leaders, setLeaders] = useState<KanbanLeader[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/app-auth/data?table=teaching_leaders', {
        headers: authHeaders(token),
      })
      const d = await r.json()
      if (d.rows) setLeaders(d.rows)
    } catch {
      toast.error('Không tải được danh sách leader')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!activeId) return
    const body = document.body
    const prevUserSelect = body.style.userSelect
    const prevWebkit = body.style.getPropertyValue('-webkit-user-select')
    body.style.userSelect = 'none'
    body.style.setProperty('-webkit-user-select', 'none')
    window.getSelection()?.removeAllRanges()
    return () => {
      body.style.userSelect = prevUserSelect
      if (prevWebkit) body.style.setProperty('-webkit-user-select', prevWebkit)
      else body.style.removeProperty('-webkit-user-select')
    }
  }, [activeId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return leaders
    return leaders.filter(
      (l) =>
        l.full_name.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.center?.toLowerCase().includes(q) ||
        getLeaderAreas(l).some((a) => a.toLowerCase().includes(q)),
    )
  }, [leaders, search])

  const activeLeaders = useMemo(
    () => filtered.filter((l) => l.status === 'Active'),
    [filtered],
  )
  const deactiveLeaders = useMemo(
    () => filtered.filter((l) => l.status !== 'Active'),
    [filtered],
  )

  const activeDragLeader = useMemo(() => {
    if (!activeId || !activeId.startsWith('leader-')) return null
    const code = activeId.replace('leader-', '')
    return leaders.find((l) => l.code === code) ?? null
  }, [activeId, leaders])

  const dragOverlayModifiers = useMemo(() => [snapCenterToCursor], [])

  const setStatus = async (code: string, newStatus: 'Active' | 'Deactive') => {
    setBusyCode(code)
    try {
      const r = await fetch('/api/app-auth/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          table: 'teaching_leaders_status',
          code,
          status: newStatus,
        }),
      })
      const d = await r.json()
      if (d.success) {
        setLeaders((prev) =>
          prev.map((l) =>
            l.code === code ? { ...l, status: newStatus } : l,
          ),
        )
        toast.success(`Đã chuyển sang ${newStatus}`)
      } else {
        toast.error(d.error || 'Không cập nhật được')
      }
    } catch {
      toast.error('Lỗi mạng')
    } finally {
      setBusyCode(null)
    }
  }

  const resolveDropStatus = (
    overId: string | undefined | null,
  ): 'Active' | 'Deactive' | null => {
    if (!overId) return null
    if (overId === DROP_ACTIVE) return 'Active'
    if (overId === DROP_DEACTIVE) return 'Deactive'
    if (String(overId).startsWith('leader-')) {
      const code = String(overId).replace('leader-', '')
      const t = leaders.find((l) => l.code === code)
      if (!t) return null
      return t.status === 'Active' ? 'Active' : 'Deactive'
    }
    return null
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const leaderCode = String(active.id).replace('leader-', '')
    const next = resolveDropStatus(over.id as string)
    if (!next) return
    const leader = leaders.find((l) => l.code === leaderCode)
    if (!leader) return
    const cur = leader.status === 'Active' ? 'Active' : 'Deactive'
    if (cur === next) return
    void setStatus(leaderCode, next)
  }

  const handleDragStart = (event: DragStartEvent) => {
    window.getSelection()?.removeAllRanges()
    setActiveId(String(event.active.id))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Kéo thả leader giữa <strong>Đang hoạt động</strong> và{' '}
          <strong>Tạm ngưng</strong> để đổi trạng thái (lưu ngay).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, mã, center, khu vực..."
            className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:max-w-xs"
          />
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Làm mới
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        autoScroll={false}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid select-none grid-cols-1 gap-4 lg:grid-cols-2">
          <KanbanColumn
            id={DROP_ACTIVE}
            title="Đang hoạt động"
            subtitle={`${activeLeaders.length} leader`}
            accentClass="bg-emerald-50 border-emerald-100"
          >
            {activeLeaders.map((l) => (
              <DraggableLeaderCard key={l.code} leader={l} />
            ))}
            {activeLeaders.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-400">
                Kéo leader vào đây để kích hoạt
              </p>
            )}
          </KanbanColumn>

          <KanbanColumn
            id={DROP_DEACTIVE}
            title="Tạm ngưng"
            subtitle={`${deactiveLeaders.length} leader`}
            accentClass="bg-rose-50 border-rose-100"
          >
            {deactiveLeaders.map((l) => (
              <DraggableLeaderCard key={l.code} leader={l} />
            ))}
            {deactiveLeaders.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-400">
                Kéo leader vào đây để tạm ngưng
              </p>
            )}
          </KanbanColumn>
        </div>

        <DragOverlay
          modifiers={dragOverlayModifiers}
          dropAnimation={null}
          zIndex={100_000}
          style={{ cursor: 'grabbing' }}
        >
          {activeDragLeader ? (
            <div className="box-border min-h-[5.5rem] min-w-[280px] w-[min(100vw-2rem,320px)] max-w-[min(100vw-2rem,320px)] cursor-grabbing select-none rounded-lg border-2 border-[#a1001f] bg-white p-3 shadow-2xl pointer-events-none">
              <p className="text-sm font-semibold text-gray-900 break-words">
                {activeDragLeader.full_name}
              </p>
              <p className="text-xs text-gray-500">{activeDragLeader.code}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {busyCode && (
        <p className="text-center text-xs text-gray-500">
          Đang cập nhật {busyCode}…
        </p>
      )}
    </div>
  )
}
