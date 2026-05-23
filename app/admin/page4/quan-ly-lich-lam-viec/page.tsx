'use client'

import { useAuth } from '@/lib/auth-context'
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

type KhungGio = { label: string; from: string; to: string }
const KHUNG_GIO: KhungGio[] = [
  { label: '9:00 – 12:00', from: '09:00', to: '12:00' },
  { label: '14:00 – 18:00', from: '14:00', to: '18:00' },
  { label: '18:00 – 21:00', from: '18:00', to: '21:00' },
]

const KHOI_OPTIONS = ['Robotics', 'Coding', 'X-Art'] as const
type KhoiFilter = typeof KHOI_OPTIONS[number] | null

type Mentor = {
  ma_gv: string
  teacher_name: string
  gio_bat_dau: string
  gio_ket_thuc: string
  khoi_final: string | null
  main_centre_region: string | null
}

function getKhoiLabel(khoi: string | null): string | null {
  if (!khoi) return null
  const k = khoi.toLowerCase()
  if (k.includes('robot')) return 'Robotics'
  if (k.includes('cod')) return 'Coding'
  if (k.includes('art') || k.includes('x-art')) return 'X-Art'
  return null
}

function KhoiBadge({ khoi }: { khoi: string | null }) {
  const label = getKhoiLabel(khoi)
  if (!label) return null
  if (label === 'Robotics') return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-yellow-100 text-yellow-700">Robotics</span>
  if (label === 'Coding') return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700">Coding</span>
  return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600">X-Art</span>
}

type CenterData = {
  short_code: string
  full_name: string
  region: string
  uu_tien: Mentor[]
  linh_hoat: Mentor[]
  total: number
}

type CellKey = string
type CellData = CenterData[]

type FilterState = {
  khungGio: string | null
  coSo: string | null
  khoi: KhoiFilter
  linhHoat: boolean | null
}

const REGION_ORDER = ['HCM 4', 'HCM 1', 'HCM 3', 'HCM 2', 'HN 1', 'HN 2', 'TỈNH NAM', 'TỈNH BẮC', 'TỈNH TRUNG', 'ONLINE']

// Màu nhạt theo khu vực — button + text
const REGION_COLORS: Record<string, { btn: string; text: string; count: string }> = {
  'HCM 4': { btn: 'bg-rose-50 border-rose-200 hover:bg-rose-100',       text: 'text-rose-700',   count: 'text-rose-500' },
  'HCM 1': { btn: 'bg-sky-50 border-sky-200 hover:bg-sky-100',          text: 'text-sky-700',    count: 'text-sky-500' },
  'HCM 2': { btn: 'bg-violet-50 border-violet-200 hover:bg-violet-100', text: 'text-violet-700', count: 'text-violet-500' },
  'HCM 3': { btn: 'bg-teal-50 border-teal-200 hover:bg-teal-100',       text: 'text-teal-700',   count: 'text-teal-500' },
  'HN 1':  { btn: 'bg-amber-50 border-amber-200 hover:bg-amber-100',    text: 'text-amber-700',  count: 'text-amber-500' },
  'HN 2':  { btn: 'bg-orange-50 border-orange-200 hover:bg-orange-100', text: 'text-orange-700', count: 'text-orange-500' },
  'TỈNH NAM':  { btn: 'bg-lime-50 border-lime-200 hover:bg-lime-100',   text: 'text-lime-700',   count: 'text-lime-500' },
  'TỈNH BẮC':  { btn: 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100',   text: 'text-cyan-700',   count: 'text-cyan-500' },
  'TỈNH TRUNG': { btn: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', text: 'text-indigo-700', count: 'text-indigo-500' },
  'ONLINE': { btn: 'bg-gray-50 border-gray-200 hover:bg-gray-100',      text: 'text-gray-600',   count: 'text-gray-400' },
}
const DEFAULT_REGION_COLOR = { btn: 'bg-gray-50 border-gray-200 hover:bg-gray-100', text: 'text-gray-600', count: 'text-gray-400' }

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function getWeekStartMonday(date: Date) {
  const d = startOfDay(date); const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d
}
function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type DetailModalData = { date: Date; khung: KhungGio; center: CenterData; pairCenter?: CenterData }

function renderMentorItem(m: Mentor, i: number) {
  return (
    <li key={m.ma_gv} className="flex items-center gap-2 py-1 text-sm text-gray-700">
      <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">{i + 1}.</span>
      <span className="font-medium truncate">{m.teacher_name}</span>
      <span className="ml-auto text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{m.gio_bat_dau?.slice(0, 5)} – {m.gio_ket_thuc?.slice(0, 5)}</span>
    </li>
  )
}

function KhoiSubSection({ mentors }: { mentors: Mentor[] }) {
  const KHOI_LIST = ['Robotics', 'Coding', 'X-Art'] as const
  const khoiColors: Record<string, string> = {
    Robotics: 'text-yellow-700',
    Coding: 'text-blue-600',
    'X-Art': 'text-red-600',
  }

  const unknown = mentors.filter(m => !getKhoiLabel(m.khoi_final))

  return (
    <div className="space-y-2">
      {KHOI_LIST.map(khoi => {
        const group = mentors.filter(m => getKhoiLabel(m.khoi_final) === khoi)
        if (group.length === 0) return null
        return (
          <div key={khoi}>
            <p className={`text-[10px] font-semibold mb-0.5 ${khoiColors[khoi]}`}>{khoi}</p>
            <ul className="space-y-0.5">
              {group.map((m, i) => renderMentorItem(m, i))}
            </ul>
          </div>
        )
      })}
      {unknown.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 mb-0.5">Khác</p>
          <ul className="space-y-0.5">
            {unknown.map((m, i) => renderMentorItem(m, i))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ColumnSection({ title, uuTien, linhHoat }: { title: string; uuTien: Mentor[]; linhHoat: Mentor[] }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 border-b border-gray-100 pb-2 mb-3 flex-shrink-0">{title}</p>
      <div className="flex flex-col flex-1 min-h-0 gap-3">
        <div className="flex flex-col flex-1 min-h-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#a1001f] mb-1.5 flex-shrink-0">
            Ưu tiên {uuTien.length > 0 && <span className="font-normal text-gray-400">({uuTien.length})</span>}
          </p>
          <div className="flex-1 overflow-y-auto min-h-[60px]">
            {uuTien.length > 0
              ? <KhoiSubSection mentors={uuTien} />
              : <p className="text-xs text-gray-300 italic">Không có mentor rảnh khung này.</p>
            }
          </div>
        </div>
        <div className="border-t border-gray-100 flex-shrink-0" />
        <div className="flex flex-col flex-1 min-h-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5 flex-shrink-0">
            Linh hoạt {linhHoat.length > 0 && <span className="font-normal text-gray-400">({linhHoat.length})</span>}
          </p>
          <div className="flex-1 overflow-y-auto min-h-[60px]">
            {linhHoat.length > 0
              ? <KhoiSubSection mentors={linhHoat} />
              : <p className="text-xs text-gray-300 italic">Không có mentor rảnh khung này.</p>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Filter Dialog ─────────────────────────────────────────────────────────────
function FilterDialog({ filter, setFilter, allCenters, onClose }: {
  filter: FilterState
  setFilter: React.Dispatch<React.SetStateAction<FilterState>>
  allCenters: { short_code: string; full_name: string }[]
  onClose: () => void
}) {
  const resetFilter = () => setFilter({ khungGio: null, coSo: null, khoi: null, linhHoat: null })
  const isFiltering = filter.khungGio !== null || filter.coSo !== null || filter.khoi !== null || filter.linhHoat !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-white" />
            <h3 className="text-sm font-bold text-white">Bộ lọc</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/70 hover:text-white hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Khung giờ */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Khung giờ</label>
            <select
              value={filter.khungGio ?? ''}
              onChange={e => setFilter(f => ({ ...f, khungGio: e.target.value || null }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#a1001f]"
            >
              <option value="">Tất cả khung giờ</option>
              {KHUNG_GIO.map(k => <option key={k.from} value={k.from}>{k.label}</option>)}
            </select>
          </div>

          {/* Cơ sở */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Cơ sở</label>
            <select
              value={filter.coSo ?? ''}
              onChange={e => setFilter(f => ({ ...f, coSo: e.target.value || null }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#a1001f]"
            >
              <option value="">Tất cả cơ sở</option>
              {allCenters.map(c => <option key={c.short_code} value={c.short_code}>{c.full_name}</option>)}
            </select>
          </div>

          {/* Khối */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Khối</label>
            <div className="flex flex-wrap gap-2">
              {([null, 'Robotics', 'Coding', 'X-Art'] as (KhoiFilter | null)[]).map(k => {
                const label = k ?? 'Tất cả'
                const active = filter.khoi === k
                let cls = 'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors '
                if (!active) cls += 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                else if (k === 'Robotics') cls += 'border-yellow-400 bg-yellow-100 text-yellow-700'
                else if (k === 'Coding') cls += 'border-blue-400 bg-blue-100 text-blue-700'
                else if (k === 'X-Art') cls += 'border-red-400 bg-red-100 text-red-600'
                else cls += 'border-[#a1001f] bg-[#a1001f]/10 text-[#a1001f]'
                return <button key={label} onClick={() => setFilter(f => ({ ...f, khoi: k as KhoiFilter }))} className={cls}>{label}</button>
              })}
            </div>
          </div>

          {/* Loại */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Loại đăng ký</label>
            <div className="flex gap-2">
              {[{ label: 'Tất cả', value: null }, { label: 'Ưu tiên', value: false }, { label: 'Linh hoạt', value: true }].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setFilter(f => ({ ...f, linhHoat: opt.value }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${filter.linhHoat === opt.value ? 'border-[#a1001f] bg-[#a1001f]/10 text-[#a1001f]' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
          <button onClick={resetFilter} disabled={!isFiltering} className="text-xs font-semibold text-gray-400 hover:text-[#a1001f] disabled:opacity-30 disabled:cursor-not-allowed">
            Xóa tất cả
          </button>
          <button onClick={onClose} className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8a001a]">
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ detail, filter, areas, isSuperAdmin, onClose }: {
  detail: DetailModalData
  filter: FilterState
  areas: string[] | null
  isSuperAdmin: boolean
  onClose: () => void
}) {
  const hasKhoiFilter = filter.khoi !== null

  // Khu vực admin quản lý
  const managesHCM4 = isSuperAdmin || areas === null || (areas || []).includes('HCM 4')
  const managesHCM1 = isSuperAdmin || areas === null || (areas || []).includes('HCM 1')
  const twoColumns = managesHCM4 && managesHCM1
  const getMentorRegion = (m: Mentor) => m.main_centre_region || detail.center.region
  const hcm4UuTien = detail.center.uu_tien.filter(m => getMentorRegion(m) === 'HCM 4')
  const hcm4LinhHoat = detail.center.linh_hoat.filter(m => getMentorRegion(m) === 'HCM 4')
  const hcm1UuTien = detail.center.uu_tien.filter(m => getMentorRegion(m) === 'HCM 1')
  const hcm1LinhHoat = detail.center.linh_hoat.filter(m => getMentorRegion(m) === 'HCM 1')
  const otherUuTien = detail.center.uu_tien.filter(m => getMentorRegion(m) !== 'HCM 4' && getMentorRegion(m) !== 'HCM 1')
  const otherLinhHoat = detail.center.linh_hoat.filter(m => getMentorRegion(m) !== 'HCM 4' && getMentorRegion(m) !== 'HCM 1')
  const allMentors = [...detail.center.uu_tien, ...detail.center.linh_hoat]
  const cungKhoi = hasKhoiFilter ? allMentors.filter(m => getKhoiLabel(m.khoi_final) === filter.khoi) : []
  const khacKhoi = hasKhoiFilter ? allMentors.filter(m => getKhoiLabel(m.khoi_final) !== filter.khoi) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`w-full rounded-2xl bg-white shadow-2xl flex flex-col ${twoColumns ? 'max-w-5xl' : 'max-w-lg'}`}
        style={{ height: '884px', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">{detail.center.full_name}</h3>
            <p className="text-xs text-white/80 mt-0.5">
              {detail.khung.label} · {detail.date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {hasKhoiFilter ? (
            // Filter khối — 1 cột scroll
            <div className="h-full overflow-y-auto px-5 py-4 space-y-4">
              {cungKhoi.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#a1001f] mb-2">Giáo viên cùng khối — {filter.khoi} ({cungKhoi.length})</p>
                  <ul className="space-y-1.5">{cungKhoi.map((m, i) => renderMentorItem(m, i))}</ul>
                </div>
              )}
              {khacKhoi.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Giáo viên khác khối ({khacKhoi.length})</p>
                  <ul className="space-y-1.5">{khacKhoi.map((m, i) => renderMentorItem(m, i))}</ul>
                </div>
              )}
              {cungKhoi.length === 0 && khacKhoi.length === 0 && <p className="text-sm text-gray-400">Không có giáo viên nào.</p>}
            </div>
          ) : twoColumns ? (
            // 2 cột HCM 4 | HCM 1
            <div className="grid grid-cols-2 divide-x divide-gray-100 h-full">
              <div className="px-4 py-4 h-full overflow-hidden">
                <ColumnSection
                  title="Khu vực HCM 4"
                  uuTien={[...hcm4UuTien, ...(detail.center.region !== 'HCM 1' ? otherUuTien : [])]}
                  linhHoat={[...hcm4LinhHoat, ...(detail.center.region !== 'HCM 1' ? otherLinhHoat : [])]}
                />
              </div>
              <div className="px-4 py-4 h-full overflow-hidden">
                <ColumnSection
                  title="Khu vực HCM 1"
                  uuTien={[...hcm1UuTien, ...(detail.center.region === 'HCM 1' ? otherUuTien : [])]}
                  linhHoat={[...hcm1LinhHoat, ...(detail.center.region === 'HCM 1' ? otherLinhHoat : [])]}
                />
              </div>
            </div>
          ) : (
            // 1 cột thông thường
            <div className="h-full overflow-hidden px-5 py-4 flex flex-col">
              <ColumnSection
                title={detail.center.region || 'Khu vực'}
                uuTien={detail.center.uu_tien}
                linhHoat={detail.center.linh_hoat}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Đóng</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function QuanLyLichLamViecPage() {
  const { user } = useAuth()
  const [focusDate, setFocusDate] = useState(() => new Date())
  const [cache, setCache] = useState<Record<CellKey, CellData>>({})
  const [loading, setLoading] = useState<Record<CellKey, boolean>>({})
  const [detail, setDetail] = useState<DetailModalData | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [filter, setFilter] = useState<FilterState>({ khungGio: null, coSo: null, khoi: null, linhHoat: null })
  const [allCenters, setAllCenters] = useState<{ short_code: string; full_name: string }[]>([])
  const [myAreas, setMyAreas] = useState<string[] | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  const weekStart = useMemo(() => getWeekStartMonday(focusDate), [focusDate])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  }), [weekStart])

  const periodLabel = useMemo(() => {
    const end = new Date(weekStart); end.setDate(weekStart.getDate() + 6)
    return `${weekStart.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`
  }, [weekStart])

  const stepWeek = (delta: number) => {
    const next = new Date(focusDate); next.setDate(next.getDate() + delta * 7); setFocusDate(next)
    setCache({}) // xóa cache để force re-fetch tuần mới
  }

  const cellKey = (date: Date, khung: KhungGio) => `${formatDateKey(date)}_${khung.from}_${khung.to}`

  const fetchCell = useCallback(async (date: Date, khung: KhungGio) => {
    const key = cellKey(date, khung)
    setLoading(prev => {
      if (prev[key]) return prev
      return { ...prev, [key]: true }
    })
    try {
      const res = await fetch(`/api/admin/lich-lam-viec?date=${formatDateKey(date)}&from=${khung.from}&to=${khung.to}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setCache(prev => {
          if (prev[key] !== undefined) return prev
          return { ...prev, [key]: data.data || [] }
        })
      }
    } catch {}
    finally {
      setLoading(prev => ({ ...prev, [key]: false }))
    }
  }, [])

  useEffect(() => {
    weekDays.forEach(date => KHUNG_GIO.forEach(khung => fetchCell(date, khung)))
  }, [weekStart])

  useEffect(() => {
    fetch('/api/admin/lich-lam-viec/centers')
      .then(r => r.json())
      .then(d => { if (d.success) setAllCenters(d.centers) })
      .catch(() => {})
  }, [])

  // Lấy khu vực quản lý của admin hiện tại
  useEffect(() => {
    if (!user?.email) return
    fetch(`/api/admin/my-areas?email=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setIsSuperAdmin(d.isSuperAdmin || false)
          setMyAreas(d.isSuperAdmin ? null : (d.areas || []))
        }
      })
      .catch(() => {})
  }, [user?.email])

  const getCellData = (date: Date, khung: KhungGio): CellData => cache[cellKey(date, khung)] || []

  const groupByRegion = (centers: CenterData[]) => {
    const groups: Record<string, CenterData[]> = {}
    centers.forEach(c => {
      if (!groups[c.region]) groups[c.region] = []
      groups[c.region].push(c)
    })
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = REGION_ORDER.indexOf(a), bi = REGION_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1; if (bi === -1) return -1
      return ai - bi
    })
  }

  const isFiltering = filter.khungGio !== null || filter.coSo !== null || filter.khoi !== null || filter.linhHoat !== null
  const activeFilterCount = [filter.khungGio, filter.coSo, filter.khoi, filter.linhHoat].filter(v => v !== null).length

  function applyFilterToCenter(center: CenterData): CenterData | null {
    if (filter.coSo && center.short_code !== filter.coSo) return null
    const matchTime = (m: Mentor) => {
      if (!filter.khungGio) return true
      const k = KHUNG_GIO.find(x => x.from === filter.khungGio)
      if (!k) return true
      const f = m.gio_bat_dau?.slice(0, 5) || '', t = m.gio_ket_thuc?.slice(0, 5) || ''
      return f <= k.to && t >= k.from
    }
    const matchKhoi = (m: Mentor) => !filter.khoi || getKhoiLabel(m.khoi_final) === filter.khoi
    let uu = center.uu_tien.filter(m => matchTime(m) && matchKhoi(m))
    let lh = center.linh_hoat.filter(m => matchTime(m) && matchKhoi(m))
    if (filter.linhHoat === true) uu = []
    if (filter.linhHoat === false) lh = []
    if (uu.length === 0 && lh.length === 0) return null
    return { ...center, uu_tien: uu, linh_hoat: lh, total: uu.length + lh.length }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* PageHeader — tiêu đề riêng như các page khác */}
      <div className="flex-shrink-0 px-4 pt-4 pb-4 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Quản lý lịch làm việc</h1>
      </div>

      {/* Toolbar — ngày tháng + nút điều hướng */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-gray-700" />
          <span className="text-sm font-semibold text-gray-700">{periodLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => stepWeek(-1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
          <button
            onClick={() => setShowFilter(true)}
            className={`relative flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${isFiltering ? 'border-[#a1001f] bg-[#a1001f]/5 text-[#a1001f]' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            <Filter className="h-4 w-4" />
            Bộ lọc
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-[#a1001f] text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
          <button onClick={() => setFocusDate(new Date())} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Hôm nay</button>
          <button onClick={() => stepWeek(1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse table-fixed text-sm h-full">
          <colgroup>
            <col className="w-28" />
            {weekDays.map((_, i) => <col key={i} />)}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Khung giờ</th>
              {weekDays.map((date, i) => {
                const isToday = isSameDate(date, new Date())
                return (
                  <th key={i} className={`px-2 py-2 text-center text-xs font-semibold border-r border-gray-200 ${isToday ? 'bg-[#a1001f]/5 text-[#a1001f]' : 'text-gray-600'}`}>
                    <div>{WEEKDAY_LABELS[i]}</div>
                    <div className={`mt-0.5 text-sm font-bold ${isToday ? 'text-[#a1001f]' : 'text-gray-800'}`}>{date.getDate()}/{date.getMonth() + 1}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {KHUNG_GIO.map(khung => (
              <tr key={khung.label} className="border-b border-gray-200 h-1/3">
                <td className="px-3 py-3 border-r border-gray-200 bg-gray-50 align-top" style={{ height: '30vh' }}>
                  <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{khung.label}</span>
                </td>
                {weekDays.map((date, i) => {
                  const rawCenters = getCellData(date, khung)
                  const key = cellKey(date, khung)
                  const isLoading = loading[key]
                  const centers = isFiltering
                    ? rawCenters.map(c => applyFilterToCenter(c)).filter((c): c is CenterData => c !== null)
                    : rawCenters
                  const regionGroups = groupByRegion(centers)
                  return (
                    <td key={i} className="px-2 py-2 border-r border-gray-200 align-top">
                      {isLoading ? (
                        <span className="text-[10px] text-gray-300">...</span>
                      ) : centers.length === 0 ? (
                        <span className="text-[11px] text-gray-300">—</span>
                      ) : (
                        <div className="space-y-2">
                          {regionGroups.map(([region, regionCenters]) => (
                            <div key={region}>
                              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">{region}</p>
                              <div className="space-y-1">
                                {regionCenters.map(center => {
                                  const rc = REGION_COLORS[center.region] || DEFAULT_REGION_COLOR
                                  // Cột >= 5 (T7, CN) → tooltip hiện bên trái
                                  const tipSide = i >= 5 ? 'right-full mr-2' : 'left-full ml-2'
                                  return (
                                  <div key={center.short_code} className="relative group">
                                    <button
                                      onClick={() => {
                                        const pairRegion = center.region === 'HCM 4' ? 'HCM 1' : center.region === 'HCM 1' ? 'HCM 4' : null
                                        const pairCenter = pairRegion ? centers.find(c => c.region === pairRegion) : undefined
                                        setDetail({ date, khung, center, pairCenter })
                                      }}
                                      className={`w-full flex items-center justify-between gap-1 rounded-lg border px-2 py-1 text-left transition-colors ${rc.btn}`}
                                    >
                                      <span className={`text-[11px] font-semibold truncate ${rc.text}`}>{center.full_name}</span>
                                      <span className={`flex items-center gap-0.5 text-[10px] font-semibold flex-shrink-0 ${rc.count}`}>
                                        <Users className="h-3 w-3" />{center.uu_tien.length}
                                        {center.linh_hoat.length > 0 && <span className="opacity-60">+{center.linh_hoat.length}</span>}
                                      </span>
                                    </button>
                                    {center.uu_tien.length > 0 && (
                                      <div className={`absolute top-0 ${tipSide} z-30 hidden group-hover:block w-52 rounded-xl bg-white border border-gray-200 shadow-xl p-3`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${rc.text}`}>
                                          Ưu tiên ({center.uu_tien.length})
                                        </p>
                                        <ul className="space-y-1">
                                          {center.uu_tien.map((m, idx) => (
                                            <li key={m.ma_gv} className="flex items-center gap-1.5 text-[11px] text-gray-700">
                                              <span className={`h-4 w-4 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${rc.btn} ${rc.text}`}>{idx + 1}</span>
                                              <span className="truncate font-medium">{m.teacher_name}</span>
                                              <span className="ml-auto text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{m.gio_bat_dau}–{m.gio_ket_thuc}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showFilter && (
        <FilterDialog
          filter={filter}
          setFilter={setFilter}
          allCenters={allCenters}
          onClose={() => setShowFilter(false)}
        />
      )}

      {detail && <DetailModal detail={detail} filter={filter} areas={myAreas} isSuperAdmin={isSuperAdmin} onClose={() => setDetail(null)} />}
    </div>
  )
}
