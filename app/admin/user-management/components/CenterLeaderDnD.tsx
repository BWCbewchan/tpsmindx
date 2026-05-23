'use client'

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
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Edit2,
  GripVertical,
  Trash2,
  Users2,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  computeAreasAfterRegionMove,
  getLeaderAreas,
} from '@/lib/teaching-leaders'

export const DRAG_LEADER_MOVE_PREFIX = 'leader-move-'
export const DRAG_CENTER_MOVE_PREFIX = 'center-move-'

export function regionDropId(region: string) {
  return `region-${encodeURIComponent(region)}`
}

export function regionManagersDropId(region: string) {
  return `region-managers-${encodeURIComponent(region)}`
}

function parseRegionDropId(overId: string): string | null {
  const p = 'region-'
  if (!overId.startsWith(p)) return null
  return decodeURIComponent(overId.slice(p.length))
}

function parseRegionManagersDropId(overId: string): string | null {
  const p = 'region-managers-'
  if (!overId.startsWith(p)) return null
  return decodeURIComponent(overId.slice(p.length))
}

function parseLeaderRegionDropId(overId: string): string | null {
  return parseRegionManagersDropId(overId) ?? parseRegionDropId(overId)
}

export interface CenterDragLeader {
  code: string
  full_name: string
  status: string
  center: string
  role_code?: string
  courses?: string | null
  area?: string | null
  areas?: unknown
}

/** Đủ field để preview kéo cơ sở giống hàng trên UI */
export interface CenterDragCenter {
  id: number
  full_name: string
  display_name: string
  region: string
  short_code: string
  email?: string
  status: string
}

export type CenterDragOverlayMeta = {
  grouped: boolean
  showLeaderCount: boolean
  activeL: number
  centerLeadersCount: number
}

export function DroppableRegion({
  regionKey,
  className,
  children,
}: {
  regionKey: string
  className?: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: regionDropId(regionKey) })

  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} ${
        isOver ? 'rounded-xl ring-2 ring-[#a1001f]/30' : ''
      }`}
    >
      {children}
    </div>
  )
}

export function DroppableRegionManagers({
  regionKey,
  className,
  children,
}: {
  regionKey: string
  className?: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: regionManagersDropId(regionKey),
  })

  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} ${
        isOver ? 'rounded-xl ring-2 ring-[#a1001f]/35 ring-inset' : ''
      }`}
    >
      {children}
    </div>
  )
}

export function DroppableCenterCard({
  centerId,
  className,
  children,
}: {
  centerId: number
  className?: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `center-${centerId}` })

  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} transition-shadow ${
        isOver ? 'ring-2 ring-[#a1001f]/35 ring-inset' : ''
      }`}
    >
      {children}
    </div>
  )
}

/** Preview overlay: cùng layout với hàng cơ sở trên UI */
export function CenterCardDragPreview({
  center,
  grouped,
  showLeaderCount,
  activeL,
  centerLeadersCount,
  style,
}: {
  center: CenterDragCenter
  grouped: boolean
  showLeaderCount: boolean
  activeL: number
  centerLeadersCount: number
  style?: CSSProperties
}) {
  return (
    <div
      style={style}
      className="box-border flex min-w-0 cursor-grabbing select-none items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5 shadow-2xl ring-2 ring-[#a1001f]/35 pointer-events-none"
    >
      <span className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400">
        <GripVertical className="h-4 w-4" aria-hidden />
      </span>
      {!grouped && (
        <span className="shrink-0 text-gray-400" aria-hidden>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
      <Building2
        className={`h-4 w-4 shrink-0 ${grouped ? 'text-gray-400' : 'text-[#a1001f]'}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-gray-900">
            {center.display_name}
          </span>
          <span className="text-xs text-gray-400">{center.short_code}</span>
          {showLeaderCount && centerLeadersCount > 0 && (
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
              <Users2 className="mr-0.5 inline h-3 w-3" aria-hidden />
              {activeL}/{centerLeadersCount}
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 rounded p-1.5 text-gray-500" aria-hidden>
        <Edit2 className="h-3.5 w-3.5" />
      </span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
          center.status === 'Active'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}
      >
        {center.status || 'Active'}
      </span>
    </div>
  )
}

/** Hàng header cơ sở: ref đo cả hàng → overlay đúng kích thước */
export function CenterCardDragHeader({
  center,
  grouped,
  isExpanded,
  showLeaderCount,
  activeL,
  centerLeadersCount,
  onRowClick,
  onEdit,
  onToggleStatus,
}: {
  center: CenterDragCenter
  grouped: boolean
  isExpanded: boolean
  showLeaderCount: boolean
  activeL: number
  centerLeadersCount: number
  onRowClick: () => void
  onEdit: (e: React.MouseEvent) => void
  onToggleStatus: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({
      id: `${DRAG_CENTER_MOVE_PREFIX}${center.id}`,
      data: {
        kind: 'center' as const,
        center,
        grouped,
        showLeaderCount,
        activeL,
        centerLeadersCount,
      },
    })

  return (
    <div
      ref={setNodeRef}
      className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-gray-50 ${
        isDragging ? 'invisible' : ''
      }`}
      onClick={onRowClick}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="mt-0.5 shrink-0 cursor-grab touch-none select-none rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
        aria-label={`Kéo cơ sở ${center.display_name} sang khu vực khác`}
        onClick={(e) => e.stopPropagation()}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="pointer-events-none h-4 w-4" />
      </button>
      {!grouped && (
        <button type="button" className="shrink-0 text-gray-400">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      )}
      <Building2
        className={`h-4 w-4 shrink-0 ${grouped ? 'text-gray-400' : 'text-[#a1001f]'}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-gray-900">
            {center.display_name}
          </span>
          <span className="text-xs text-gray-400">{center.short_code}</span>
          {showLeaderCount && centerLeadersCount > 0 && (
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
              <Users2 className="mr-0.5 inline h-3 w-3" />
              {activeL}/{centerLeadersCount}
            </span>
          )}
        </div>
        {center.email && (
          <p className="truncate text-xs text-gray-500">{center.email}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200"
        title="Đổi khu vực"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onToggleStatus}
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold transition-all ${
          center.status === 'Active'
            ? 'cursor-pointer bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
            : 'cursor-pointer bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'
        }`}
      >
        {center.status || 'Active'}
      </button>
    </div>
  )
}

/** Preview kéo leader: cùng layout với hàng trong DataTab (renderLeaderItem) */
export function LeaderRowDragPreview({
  leader,
  style,
}: {
  leader: CenterDragLeader
  style?: CSSProperties
}) {
  const areas = getLeaderAreas(leader)
  const active = leader.status === 'Active'

  return (
    <div
      style={style}
      className="box-border flex w-full min-w-0 cursor-grabbing select-none items-center gap-2 border-b border-gray-100 bg-white px-4 py-2 shadow-2xl ring-2 ring-[#a1001f]/35 pointer-events-none"
    >
      <span className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400" aria-hidden>
        <GripVertical className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
            active
              ? 'bg-linear-to-br from-indigo-500 to-purple-600'
              : 'bg-gray-400'
          }`}
        >
          {leader.full_name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-gray-900">
              {leader.full_name}
            </span>
            <span className="text-xs text-gray-400">({leader.code})</span>
            {leader.role_code ? (
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                {leader.role_code}
              </span>
            ) : null}
            {leader.courses ? (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                {leader.courses}
              </span>
            ) : null}
            {areas.map((ar) => (
              <span
                key={ar}
                className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800"
              >
                {ar}
              </span>
            ))}
          </div>
          {leader.center ? (
            <p className="mt-0.5 text-xs text-gray-500">{leader.center}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1" aria-hidden>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {leader.status}
          </span>
          <span className="rounded p-1 text-gray-400">
            <Edit2 className="h-3.5 w-3.5" />
          </span>
          <span className="rounded p-1 text-gray-400">
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  )
}

export function DraggableLeaderRow({
  leader,
  indentClass,
  sourceRegion,
  children,
}: {
  leader: CenterDragLeader
  indentClass: string
  sourceRegion: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({
      id: `${DRAG_LEADER_MOVE_PREFIX}${leader.code}`,
      data: { kind: 'leader' as const, leader, sourceRegion },
    })

  return (
    <div
      ref={setNodeRef}
      className={`flex w-full min-w-0 shrink-0 select-none items-center gap-2 border-b border-gray-100 px-4 py-2 transition-colors last:border-b-0 hover:bg-white ${
        leader.status !== 'Active' ? 'opacity-50' : ''
      } ${isDragging ? 'invisible' : ''} ${indentClass}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="mt-0.5 shrink-0 cursor-grab touch-none select-none rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
        aria-label={`Kéo ${leader.full_name} (cơ sở / khu vực)`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="pointer-events-none h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
    </div>
  )
}

function areasEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort().join('\u0000')
  const sb = [...b].sort().join('\u0000')
  return sa === sb
}

function resolveTargetCenterFullName(
  overId: unknown,
  centers: { id: number; full_name: string }[],
  leaders: CenterDragLeader[],
): string | null {
  if (overId == null) return null
  const s = String(overId)
  if (s.startsWith('center-')) {
    const id = Number(s.slice('center-'.length))
    if (Number.isNaN(id)) return null
    const c = centers.find((x) => x.id === id)
    return c?.full_name ?? null
  }
  if (s.startsWith(DRAG_LEADER_MOVE_PREFIX)) {
    const code = s.slice(DRAG_LEADER_MOVE_PREFIX.length)
    const l = leaders.find((x) => x.code === code)
    return l?.center?.trim() ? l.center : null
  }
  return null
}

export function LeaderCenterDndProvider({
  leaders,
  centers,
  onAssignCenter,
  onAssignLeaderAreas,
  onAssignCenterRegion,
  children,
}: {
  leaders: CenterDragLeader[]
  centers: CenterDragCenter[]
  onAssignCenter: (code: string, centerFullName: string) => Promise<void>
  onAssignLeaderAreas: (code: string, areas: string[]) => Promise<void>
  onAssignCenterRegion: (centerId: number, region: string) => Promise<void>
  children: React.ReactNode
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [centerDragWidth, setCenterDragWidth] = useState<number | undefined>()
  const [leaderDragWidth, setLeaderDragWidth] = useState<number | undefined>()
  const [centerDragMeta, setCenterDragMeta] =
    useState<CenterDragOverlayMeta | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  useEffect(() => {
    if (!activeId) return
    const body = document.body
    const prevUserSelect = body.style.userSelect
    body.style.userSelect = 'none'
    body.style.setProperty('-webkit-user-select', 'none')
    window.getSelection()?.removeAllRanges()
    return () => {
      body.style.userSelect = prevUserSelect
      body.style.removeProperty('-webkit-user-select')
    }
  }, [activeId])

  const activeLeader = useMemo(() => {
    if (!activeId?.startsWith(DRAG_LEADER_MOVE_PREFIX)) return null
    const code = activeId.slice(DRAG_LEADER_MOVE_PREFIX.length)
    return leaders.find((l) => l.code === code) ?? null
  }, [activeId, leaders])

  const activeCenterDrag = useMemo(() => {
    if (!activeId?.startsWith(DRAG_CENTER_MOVE_PREFIX)) return null
    const id = Number(activeId.slice(DRAG_CENTER_MOVE_PREFIX.length))
    if (Number.isNaN(id)) return null
    return centers.find((c) => c.id === id) ?? null
  }, [activeId, centers])

  const clearDragUi = () => {
    setActiveId(null)
    setCenterDragWidth(undefined)
    setLeaderDragWidth(undefined)
    setCenterDragMeta(null)
  }

  const handleDragStart = (e: DragStartEvent) => {
    window.getSelection()?.removeAllRanges()
    const id = String(e.active.id)
    setActiveId(id)

    setCenterDragWidth(undefined)
    setLeaderDragWidth(undefined)
    setCenterDragMeta(null)

    const rectMap = e.active.rect?.current
    const r = rectMap?.initial ?? rectMap?.translated
    const w =
      r && typeof r.width === 'number' && r.width > 0
        ? Math.round(r.width)
        : undefined

    if (id.startsWith(DRAG_CENTER_MOVE_PREFIX)) {
      if (w) setCenterDragWidth(w)
      const d = e.active.data.current as
        | (CenterDragOverlayMeta & { center?: CenterDragCenter })
        | undefined
      if (d && typeof d.grouped === 'boolean') {
        setCenterDragMeta({
          grouped: d.grouped,
          showLeaderCount: Boolean(d.showLeaderCount),
          activeL: Number(d.activeL) || 0,
          centerLeadersCount: Number(d.centerLeadersCount) || 0,
        })
      }
    } else if (id.startsWith(DRAG_LEADER_MOVE_PREFIX)) {
      if (w) setLeaderDragWidth(w)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    clearDragUi()
    const { active, over } = event
    if (!over) return
    const aid = String(active.id)
    const oid = String(over.id)

    if (aid.startsWith(DRAG_CENTER_MOVE_PREFIX)) {
      const centerId = Number(aid.slice(DRAG_CENTER_MOVE_PREFIX.length))
      if (Number.isNaN(centerId)) return
      const toRegion = parseRegionDropId(oid)
      if (toRegion == null) return
      const c = centers.find((x) => x.id === centerId)
      if (!c) return
      if ((c.region || '').trim() === toRegion.trim()) return
      await onAssignCenterRegion(centerId, toRegion)
      return
    }

    if (!aid.startsWith(DRAG_LEADER_MOVE_PREFIX)) return
    const code = aid.slice(DRAG_LEADER_MOVE_PREFIX.length)
    const leader = leaders.find((l) => l.code === code)
    if (!leader) return

    const toRegion = parseLeaderRegionDropId(oid)
    if (toRegion != null) {
      const src =
        (active.data.current as { sourceRegion?: string } | undefined)
          ?.sourceRegion ?? ''
      if (src.trim() === toRegion.trim()) {
        if ((leader.center || '').trim()) {
          await onAssignCenter(code, '')
        }
        return
      }
      const next = computeAreasAfterRegionMove(leader, src, toRegion)
      if (areasEqual(getLeaderAreas(leader), next)) return
      await onAssignLeaderAreas(code, next)
      return
    }

    const targetCenter = resolveTargetCenterFullName(oid, centers, leaders)
    if (targetCenter == null) return
    const cur = (leader.center || '').trim()
    const next = targetCenter.trim()
    if (cur === next) return
    await onAssignCenter(code, targetCenter)
  }

  const meta = centerDragMeta ?? {
    grouped: false,
    showLeaderCount: false,
    activeL: 0,
    centerLeadersCount: 0,
  }

  const dragOverlayModifiers = useMemo(() => [snapCenterToCursor], [])

  return (
    <DndContext
      sensors={sensors}
      autoScroll={false}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={clearDragUi}
    >
      {children}
      <DragOverlay
        modifiers={dragOverlayModifiers}
        dropAnimation={null}
        zIndex={100_000}
        style={{ cursor: 'grabbing' }}
      >
        {activeCenterDrag ? (
          <CenterCardDragPreview
            center={activeCenterDrag}
            grouped={meta.grouped}
            showLeaderCount={meta.showLeaderCount}
            activeL={meta.activeL}
            centerLeadersCount={meta.centerLeadersCount}
            style={
              centerDragWidth
                ? {
                    width: centerDragWidth,
                    maxWidth: 'min(100vw - 1rem, 100%)',
                  }
                : { minWidth: 280, maxWidth: 'min(100vw - 1rem, 720px)' }
            }
          />
        ) : activeLeader ? (
          <LeaderRowDragPreview
            leader={activeLeader}
            style={
              leaderDragWidth
                ? {
                    width: leaderDragWidth,
                    maxWidth: 'min(100vw - 1rem, 100%)',
                  }
                : { minWidth: 280, maxWidth: 'min(100vw - 1rem, 960px)' }
            }
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
