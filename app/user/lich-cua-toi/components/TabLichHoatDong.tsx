'use client'

import { Card } from '@/components/Card'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { formatDate, parseVietnameseDate } from '@/lib/format-date'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Trash2, X, CalendarPlus, FileText, Clock, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useCallback, useEffect, useMemo, useState } from 'react'

const WEEKDAY_LABELS = ['T2','T3','T4','T5','T6','T7','CN']
const HOUR_OPTIONS = Array.from({length:15},(_,i)=>`${String(i+7).padStart(2,'0')}:00`)
type CalendarView = 'day' | 'week' | 'month'

type CenterOption = { id:number; region:string; short_code:string; full_name:string }
type LichRanhSlot = { id:number; date:string; batDau:string; ketThuc:string; coSo:string[]; linhHoat:boolean }
type LichRanhByDate = Record<string, LichRanhSlot[]>
type LeaveInfo = { id:number; leave_date:string; status:string; class_code?:string; campus?:string; reason?:string }
type LeaveByDate = Record<string, LeaveInfo[]>

type EventSchedule = {
  id: string
  title: string
  event_type: string
  start_at: string
  end_at: string
  center_name?: string | null
  center_address?: string | null
  center_full_address?: string | null
  center_map_url?: string | null
  room?: string | null
  lecture_reviewer?: string | null
  teacher_name?: string | null
  teacher_email?: string | null
  teacher_center?: string | null
  review_lesson?: string | null
}
type ParticipantRow = { event_id: string; response_status: string }

function startOfDay(d:Date){const x=new Date(d);x.setHours(0,0,0,0);return x}
function isSameDate(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function formatDateKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseDateKey(k:string){const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)}
function toInputDate(d:Date){return formatDateKey(d)}
function parseDisplayDate(value:string){return parseVietnameseDate(value)}
function formatDateInputValue(value:string){
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
    const [year,month,day]=value.split('-')
    return `${day}/${month}/${year}`
  }
  return value
}
function parseFlexibleDateInput(value:string){
  return parseVietnameseDate(value) || (/^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value) : null)
}
function toDateInputValue(value:string){
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(value)){
    const [day,month,year]=value.split('/')
    return `${year}-${month}-${day}`
  }
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
    return value
  }
  return ''
}
function toDateInputValueFromDate(date: Date | null){
  if (!date) return ''
  return formatDateKey(date)
}
function getWeekStartMonday(d:Date){const x=startOfDay(d);const day=x.getDay();const diff=x.getDate()-day+(day===0?-6:1);x.setDate(diff);return x}

function buildMonthCells(f:Date){
  const ms=new Date(f.getFullYear(),f.getMonth(),1)
  const gs=new Date(ms);const day=ms.getDay();gs.setDate(ms.getDate()+(day===0?-6:1-day))
  return Array.from({length:42},(_,i)=>{const d=new Date(gs);d.setDate(gs.getDate()+i);return{date:d,inCurrentMonth:d.getMonth()===f.getMonth()}})
}

const TIME_SLOT_HEIGHT=48
const TIMELINE_START_HOUR=7

function timeToMinutes(time:string):number{
  const [h,m]=time.split(':').map(Number)
  return h*60+m
}

function getSlotPosition(batDau:string,ketThuc:string){
  const startMin=timeToMinutes(batDau)
  const endMin=timeToMinutes(ketThuc)
  const timelineStartMin=TIMELINE_START_HOUR*60
  const topPx=Math.max(0,(startMin-timelineStartMin)/60*TIME_SLOT_HEIGHT)
  const heightPx=(endMin-startMin)/60*TIME_SLOT_HEIGHT
  return {topPx,heightPx}
}

interface Props { onRefreshBadge?:()=>void; onOpenLeaveRequest?:(date:string)=>void }

export default function TabLichHoatDong({ onRefreshBadge, onOpenLeaveRequest }:Props) {
  const { user } = useAuth()
  const [focusDate,setFocusDate]=useState(()=>new Date())
  const [view,setView]=useState<CalendarView>('month')
  const [lichRanhByDate,setLichRanhByDate]=useState<LichRanhByDate>({})
  const [selectedDate,setSelectedDate]=useState<Date|null>(null)
  const [dayDetailDate,setDayDetailDate]=useState<Date|null>(null)
  const [selectedWeekDateKeys,setSelectedWeekDateKeys]=useState<string[]>([])
  const [leaveByDate,setLeaveByDate]=useState<LeaveByDate>({})
  const [centers,setCenters]=useState<CenterOption[]>([])
  const [centersLoading,setCentersLoading]=useState(true)
  const [userRegion,setUserRegion]=useState<string|null>(null)
  const [maGv,setMaGv]=useState('')
  const [saving,setSaving]=useState(false)
  const [editingSlotId,setEditingSlotId]=useState<number|null>(null)
  const [eventSchedules,setEventSchedules]=useState<EventSchedule[]>([])
  const [registeredExamScheduleIds,setRegisteredExamScheduleIds]=useState<Set<string>>(new Set())
  const [lectureReviewByDate,setLectureReviewByDate]=useState<Record<string,EventSchedule[]>>({})
  const [batDau,setBatDau]=useState('08:00')
  const [ketThuc,setKetThuc]=useState('12:00')
  const [coSoChon,setCoSoChon]=useState<string[]>([])
  const [linhHoat,setLinhHoat]=useState(false)
  const [lapLich,setLapLich]=useState(false)
  const [lapTu,setLapTu]=useState('')
  const [lapDen,setLapDen]=useState('')
  const [lapSoTuan,setLapSoTuan]=useState('1')
  const [kieuLap,setKieuLap]=useState<'ngay'|'tuan'>('tuan')
  const [formError,setFormError]=useState('')

  useEffect(()=>{if(!user?.email)return;(async()=>{try{const r=await fetch(`/api/teachers/info?email=${encodeURIComponent(user.email)}`);const d=await r.json();if(d?.teacher?.code)setMaGv(d.teacher.code);else setMaGv(user.email.split('@')[0]||'')}catch{setMaGv(user.email.split('@')[0]||'')}})()},[user?.email])
  useEffect(()=>{if(!user?.email)return;(async()=>{setCentersLoading(true);try{const r=await fetch(`/api/centers-by-user?email=${encodeURIComponent(user.email)}`);const d=await r.json();if(r.ok&&d.success){setCenters(d.centers||[]);setUserRegion(d.region||null)}else{setCenters([])} }catch{setCenters([])}finally{setCentersLoading(false)}})()},[user?.email])

  const fetchLeaveRequests=useCallback(async()=>{
    if(!user?.email)return
    try{
      const r=await fetch(`/api/leave-requests?email=${encodeURIComponent(user.email)}`,{headers:authHeaders(undefined)})
      const d=await r.json()
      if(r.ok&&d.success){
        const byDate:LeaveByDate={};(d.data||[]).forEach((row:any)=>{const ngay=typeof row.leave_date==='string'?row.leave_date.slice(0,10):'';if(!byDate[ngay])byDate[ngay]=[];byDate[ngay].push({id:row.id,leave_date:ngay,status:row.status,class_code:row.class_code,campus:row.campus,reason:row.reason})})
        setLeaveByDate(byDate)
      }
    }catch{}
  },[user?.email])
  useEffect(()=>{fetchLeaveRequests()},[fetchLeaveRequests])

  const fetchLichRanh=async(date:Date)=>{
    if(!maGv)return
    const thang=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
    try{const r=await fetch(`/api/dangky-lich-lam?ma_gv=${encodeURIComponent(maGv)}&thang=${thang}`);const d=await r.json()
    if(r.ok&&d.success){const byDate:LichRanhByDate={};(d.data||[]).forEach((row:any)=>{const ngay=typeof row.ngay==='string'?row.ngay.slice(0,10):'';if(!byDate[ngay])byDate[ngay]=[];byDate[ngay].push({id:row.id,date:ngay,batDau:row.gio_bat_dau?.slice(0,5),ketThuc:row.gio_ket_thuc?.slice(0,5),coSo:row.co_so_uu_tien||[],linhHoat:row.linh_hoat||false})});setLichRanhByDate(byDate)}}catch{}
  }
  useEffect(()=>{if(maGv)fetchLichRanh(focusDate)},[maGv,focusDate])

  useEffect(()=>{
    if(!maGv) return
    const month = `${focusDate.getFullYear()}-${String(focusDate.getMonth()+1).padStart(2,'0')}`
    let aborted = false
    ;(async()=>{
      try{
        const r = await fetch(`/api/event-schedules?month=${month}`, { headers: authHeaders(undefined) })
        const d = await r.json()
        if(aborted) return
        if(r.ok && d.success){
          const rows: EventSchedule[] = d.data || []
          setEventSchedules(rows)
          // Fetch exam / registration records for this teacher in the same month.
          const regRes = await fetch(`/api/exam-registrations?teacher_code=${encodeURIComponent(maGv)}&month=${month}`, { headers: authHeaders(undefined) })
          const regData = await regRes.json()
          if(regRes.ok && regData.success){
            const allowedTypes = new Set(['official', 'additional'])
            const registeredIds = new Set<string>()
            ;(regData.data || []).forEach((row: any) => {
              if (!allowedTypes.has(String(row.registration_type || '').trim().toLowerCase())) return
              if (!row.schedule_id) return
              registeredIds.add(String(row.schedule_id))
            })
            setRegisteredExamScheduleIds(registeredIds)
          } else {
            setRegisteredExamScheduleIds(new Set())
          }
        }
      }catch(e){
        // ignore
      }
    })()
    return ()=>{aborted=true}
  },[maGv, focusDate])

  useEffect(()=>{
    if(!user?.email || user.role !== 'teacher') {
      setLectureReviewByDate({})
      return
    }
    const monthPrefix = `${focusDate.getFullYear()}-${String(focusDate.getMonth()+1).padStart(2,'0')}`
    let aborted = false
    ;(async()=>{
      try{
        const r = await fetch(`/api/lecture-review-registrations?teacher_email=${encodeURIComponent(user.email)}`, { headers: authHeaders(undefined) })
        const d = await r.json()
        if(aborted) return
        if(r.ok && d?.success){
          const byDate: Record<string, EventSchedule[]> = {}
          ;(d.data || []).forEach((row:any)=>{
            const startAt = row?.bat_dau_luc || row?.start_at
            if(!startAt || String(startAt).slice(0,7) !== monthPrefix) return
            const endAt = row?.ket_thuc_luc || row?.end_at || startAt
            const title = `Duyệt giảng: ${row?.event_title || row?.ten || 'Duyệt giảng'}${row?.review_lesson ? ` · Slide: ${row.review_lesson}` : ''}`
            const key = formatDateKey(new Date(startAt))
            if(!byDate[key]) byDate[key] = []
            byDate[key].push({
              id: `lrr-${row.id}`,
              title,
              event_type: 'teaching_review',
              start_at: startAt,
              end_at: endAt,
              center_name: row?.center_name || null,
              center_address: row?.center_address || null,
              center_full_address: row?.center_full_address || null,
              center_map_url: row?.center_map_url || null,
              room: row?.room || null,
              lecture_reviewer: row?.lecture_reviewer || null,
              teacher_name: row?.teacher_name || null,
              teacher_email: row?.teacher_email || null,
              teacher_center: row?.teacher_center || null,
              review_lesson: row?.review_lesson || null,
            })
          })
          setLectureReviewByDate(byDate)
        } else {
          setLectureReviewByDate({})
        }
      }catch{
        if(!aborted) setLectureReviewByDate({})
      }
    })()
    return ()=>{aborted=true}
  },[user?.email, focusDate])

  const allEventsByDate = useMemo(() => {
    const merged: Record<string, EventSchedule[]> = {}

    eventSchedules.forEach((ev) => {
      const eventType = String(ev.event_type || '').trim().toLowerCase()
      if ((eventType === 'exam' || eventType === 'registration') && !registeredExamScheduleIds.has(String(ev.id))) {
        return
      }
      const key = formatDateKey(new Date(ev.start_at))
      if (!merged[key]) merged[key] = []
      merged[key].push(ev)
    })

    Object.entries(lectureReviewByDate).forEach(([dateKey, events]) => {
      if (!merged[dateKey]) merged[dateKey] = []
      const existingIds = new Set(merged[dateKey].map((ev) => String(ev.id)))
      events.forEach((ev) => {
        if (!existingIds.has(String(ev.id))) {
          merged[dateKey].push(ev)
        }
      })
    })

    Object.keys(merged).forEach((dateKey) => {
      merged[dateKey] = merged[dateKey].sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      )
    })

    return merged
  }, [eventSchedules, lectureReviewByDate, registeredExamScheduleIds])

  const monthCells=useMemo(()=>buildMonthCells(focusDate),[focusDate])
  const weekDates=useMemo(()=>{
    const start=getWeekStartMonday(focusDate)
    return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})
  },[focusDate])
  
  useEffect(()=>{
    if(view!=='week') return
    const weekKeys=weekDates.map(d=>formatDateKey(d))
    const focusKey=formatDateKey(focusDate)
    const firstIndex=weekKeys.includes(focusKey)?weekKeys.indexOf(focusKey):0
    const firstKey=weekKeys[firstIndex]
    const secondIndex=firstIndex<weekKeys.length-1?firstIndex+1:firstIndex>0?firstIndex-1:-1
    if(secondIndex>=0){
      const minIndex=Math.min(firstIndex,secondIndex)
      const maxIndex=Math.max(firstIndex,secondIndex)
      setSelectedWeekDateKeys([weekKeys[minIndex],weekKeys[maxIndex]])
      return
    }
    setSelectedWeekDateKeys([firstKey])
  },[focusDate,view,weekDates])
  
  const periodLabel=useMemo(()=>{
    if(view==='day') return focusDate.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})
    if(view==='week'){
      const start=getWeekStartMonday(focusDate)
      const end=new Date(start);end.setDate(start.getDate()+6)
      return `${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')}`
    }
    return focusDate.toLocaleDateString('vi-VN',{month:'long',year:'numeric'})
  },[focusDate,view])

  const stepWeek=(d:number)=>{
    setFocusDate(p=>{
      const next=new Date(p)
      next.setDate(next.getDate()+d*7)
      return next
    })
  }

  const stepDay=(d:number)=>{
    setFocusDate(p=>{
      const next=new Date(p)
      next.setDate(next.getDate()+d)
      return next
    })
  }

  const stepMonth=(d:number)=>{
    setFocusDate(p=>{
      const next=new Date(p)
      next.setMonth(next.getMonth()+d,1)
      return next
    })
  }

  const openForm=(date:Date)=>{
    setSelectedDate(date);setBatDau('08:00');setKetThuc('12:00');setCoSoChon([]);setLinhHoat(false)
    setLapLich(false);setLapTu(formatDateKey(date));setLapDen(formatDateKey(date));setLapSoTuan('1');setKieuLap('tuan');setFormError('');setEditingSlotId(null)
  }
  const openEditForm=(slot:LichRanhSlot)=>{
    const d=parseDateKey(slot.date);setSelectedDate(d);setBatDau(slot.batDau);setKetThuc(slot.ketThuc)
    setCoSoChon(slot.coSo);setLinhHoat(slot.linhHoat);setLapLich(false);setLapTu(formatDateKey(d));setLapDen(formatDateKey(d));setLapSoTuan('1');setKieuLap('tuan');setFormError('');setEditingSlotId(slot.id)
  }
  const toggleCoSo=(cs:string)=>setCoSoChon(p=>p.includes(cs)?p.filter(x=>x!==cs):[...p,cs])
  
  const toggleWeekDateSelection=(date:Date)=>{
    const weekKeys=weekDates.map(d=>formatDateKey(d))
    const dateKey=formatDateKey(date)
    const getIndex=(key:string)=>weekKeys.indexOf(key)
    const sortByWeekOrder=(keys:string[])=>[...keys].sort((first,second)=>getIndex(first)-getIndex(second))
    
    if(selectedWeekDateKeys.includes(dateKey)){
      if(selectedWeekDateKeys.length<=1){
        return
      }
      setSelectedWeekDateKeys(selectedWeekDateKeys.filter(k=>k!==dateKey))
      return
    }
    
    if(selectedWeekDateKeys.length===0){
      setSelectedWeekDateKeys([dateKey])
      return
    }
    
    if(selectedWeekDateKeys.length===1){
      const previousIndex=getIndex(selectedWeekDateKeys[0])
      const nextIndex=getIndex(dateKey)
      const isAdjacent=Math.abs(previousIndex-nextIndex)===1
      setSelectedWeekDateKeys(isAdjacent?sortByWeekOrder([selectedWeekDateKeys[0],dateKey]):[dateKey])
      return
    }
    
    const adjacentCurrent=selectedWeekDateKeys.find(key=>{
      const idx=getIndex(key)
      return Math.abs(idx-getIndex(dateKey))===1
    })
    
    if(adjacentCurrent){
      setSelectedWeekDateKeys([adjacentCurrent,dateKey].sort((a,b)=>getIndex(a)-getIndex(b)))
    }
  }

  const buildDates=():string[]=>{
    if(!lapLich||!lapTu||!lapDen||!selectedDate)return selectedDate?[formatDateKey(selectedDate)]:[]
    const startDate=parseFlexibleDateInput(lapTu)
    const endDate=parseFlexibleDateInput(lapDen)
    if(!startDate||!endDate)return []
    const dates:string[]=[];const cur=new Date(startDate);const end=new Date(endDate)
    if(kieuLap==='ngay'){while(cur<=end){dates.push(formatDateKey(cur));cur.setDate(cur.getDate()+1)}}
    else{
      const totalWeeks = Math.max(1, Number.parseInt(lapSoTuan, 10) || 1)
      for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
        const next = new Date(startDate)
        next.setDate(next.getDate() + weekIndex * 7)
        dates.push(formatDateKey(next))
      }
    }
    return dates
  }

  const handleSave=async()=>{
    if(!batDau||!ketThuc){setFormError('Vui lòng chọn giờ bắt đầu và kết thúc.');return}
    if(batDau>=ketThuc){setFormError('Giờ kết thúc phải sau giờ bắt đầu.');return}
    if(coSoChon.length===0){setFormError('Vui lòng chọn ít nhất một cơ sở.');return}
    const lapTuDate=lapLich?parseFlexibleDateInput(lapTu):null
    const lapDenDate=lapLich&&kieuLap==='ngay'?parseFlexibleDateInput(lapDen):null
    if(lapLich&&kieuLap==='ngay'&&(!lapTu||!lapDen)){setFormError('Vui lòng chọn ngày bắt đầu và kết thúc.');return}
    if(lapLich&&kieuLap==='ngay'&&(!lapTuDate||!lapDenDate)){setFormError('Vui lòng chọn ngày hợp lệ.');return}
    if(lapLich&&kieuLap==='ngay'&&lapTuDate&&lapDenDate&&lapTuDate>lapDenDate){setFormError('Ngày kết thúc phải sau ngày bắt đầu.');return}
    if(lapLich&&kieuLap==='tuan'&&(!lapTu||!lapTuDate)){setFormError('Vui lòng chọn ngày bắt đầu hợp lệ.');return}
    if(lapLich&&kieuLap==='tuan'&&(!lapSoTuan||Number.isNaN(Number.parseInt(lapSoTuan, 10))||Number.parseInt(lapSoTuan, 10) < 1)){setFormError('Vui lòng nhập số tuần lặp hợp lệ.');return}
    if(!maGv){setFormError('Chưa xác định được mã giáo viên.');return}
    const dates=buildDates();if(dates.length===0){setFormError('Không có ngày hợp lệ.');return}
    setSaving(true)
    try{
      if(editingSlotId!==null)await fetch(`/api/dangky-lich-lam?id=${editingSlotId}`,{method:'DELETE'})
      for(const ngay of dates){
        const r=await fetch('/api/dangky-lich-lam',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ma_gv:maGv,ngay,gio_bat_dau:batDau,gio_ket_thuc:ketThuc,co_so_uu_tien:coSoChon,linh_hoat:linhHoat,lap_lai_tu_ngay:lapLich?lapTu:null,lap_lai_den_ngay:lapLich&&kieuLap==='ngay'?lapDen:null,so_tuan_lap:lapLich&&kieuLap==='tuan'?Number.parseInt(lapSoTuan,10):null,kieu_lap:lapLich?kieuLap:null})})
        const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||'Lỗi khi lưu')
      }
      await fetchLichRanh(focusDate);setSelectedDate(null);setEditingSlotId(null)
    }catch(e:any){setFormError(e.message||'Lỗi khi lưu, vui lòng thử lại.')}finally{setSaving(false)}
  }

  const handleDeleteSlot=async(id:number,date:string)=>{
    try{await fetch(`/api/dangky-lich-lam?id=${id}`,{method:'DELETE'});setLichRanhByDate(p=>{const s=(p[date]||[]).filter(s=>s.id!==id);if(s.length===0){const n={...p};delete n[date];return n}return{...p,[date]:s}})}catch{}
  }

  const handleDayClick=(date:Date,inCurrentMonth:boolean)=>{
    if(!inCurrentMonth)return
    setDayDetailDate(date)
  }

  const activeDate=dayDetailDate||focusDate
  const activeDateKey=formatDateKey(activeDate)
  const activeSlots=lichRanhByDate[activeDateKey]||[]
  const activeLeaves=leaveByDate[activeDateKey]||[]
  const activeAllEvents = useMemo(() => {
    return allEventsByDate[activeDateKey] || []
  }, [activeDateKey, allEventsByDate])
  const lapTuDate=lapTu?parseFlexibleDateInput(lapTu):null
  const lapDenDate=lapDen?parseFlexibleDateInput(lapDen):null
  const weeklyEndDate = useMemo(() => {
    if (!lapTuDate || kieuLap !== 'tuan') return null
    const weeks = Math.max(1, Number.parseInt(lapSoTuan, 10) || 1)
    const end = new Date(lapTuDate)
    end.setDate(end.getDate() + (weeks - 1) * 7)
    return end
  }, [lapSoTuan, lapTuDate, kieuLap])

  return (
    <>
      <Card className="overflow-hidden" padding="sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 px-4 py-3">
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-center gap-3 text-gray-700">
              <CalendarDays className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-2xl text-center align-center font-bold  text-gray-500">Lịch Cá Nhân</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
              <button
                type="button"
                onClick={()=>{setDayDetailDate(null);openForm(dayDetailDate||focusDate)}}
                className="inline-flex items-center gap-2 rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#870019]"
              >
                <CalendarPlus className="h-4 w-4" />
                Tạo lịch
              </button>
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                {([
                  ['day','Ngày'],
                  ['week','Tuần'],
                  ['month','Tháng'],
                ] as const).map(([value,label])=> (
                  <button
                    key={value}
                    onClick={()=>setView(value)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition ${view===value?'bg-[#a1001f] text-white':'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {view==='day' ? (
          <div className="border-t border-gray-200 bg-white">
            <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={()=>stepDay(-1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50" aria-label="Hôm trước"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-sm font-semibold text-gray-700 min-w-56 text-center">{periodLabel}</span>
                <button onClick={()=>stepDay(1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50" aria-label="Hôm sau"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid grid-cols-[64px_1fr] bg-white">
              <div className="border-r border-gray-200 bg-gray-50/80">
                {HOUR_OPTIONS.map((hour)=> (
                  <div key={hour} className="relative border-b border-gray-200 last:border-b-0" style={{height:'48px'}}>
                    <span className="absolute top-1 right-2 text-[11px] font-medium text-gray-500">{hour}</span>
                  </div>
                ))}
              </div>
              <div className="border-l border-gray-200 relative" style={{minHeight:`${HOUR_OPTIONS.length*TIME_SLOT_HEIGHT}px`}}>
                {HOUR_OPTIONS.map((hour)=> (
                  <div key={hour} className="border-b border-gray-200" style={{height:`${TIME_SLOT_HEIGHT}px`}}/>
                ))}
                <div className="absolute inset-0 pointer-events-none">
                  {activeSlots.map((slot)=>{
                    const {topPx,heightPx}=getSlotPosition(slot.batDau,slot.ketThuc)
                    return (
                      <div key={slot.id} className="absolute left-0 right-0 pointer-events-auto mx-2 rounded overflow-hidden cursor-pointer" style={{top:`${topPx}px`,height:`${heightPx}px`,minHeight:'24px'}}>
                        <Badge variant="emerald" size="sm" className="flex h-full w-full items-center px-2 py-1" title={`${slot.batDau}–${slot.ketThuc}`}>
                          {slot.batDau}–{slot.ketThuc}
                        </Badge>
                      </div>
                    )
                  })}
                  {activeAllEvents.map((ev)=>{
                    const start = new Date(ev.start_at)
                    const end = new Date(ev.end_at)
                    const startStr = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`
                    const endStr = `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`
                    const {topPx,heightPx}=getSlotPosition(startStr,endStr)
                    const now=new Date()
                    const isOngoing = now>=start && now<end
                    const isUpcoming = start>now
                    const variant = isOngoing ? 'danger' : isUpcoming ? 'slate' : 'danger'
                    return (
                      <div key={`ev-${ev.id}`} className="absolute left-0 right-0 pointer-events-auto mx-2 rounded overflow-hidden cursor-pointer" style={{top:`${topPx}px`,height:`${heightPx}px`,minHeight:'24px'}}>
                        <Badge variant={variant} size="sm" className="flex h-full w-full items-center px-2 py-1 font-semibold truncate" title={ev.title}>
                          {ev.title}
                        </Badge>
                      </div>
                    )
                  })}
                  {activeLeaves.map((lv)=>(
                    <div key={lv.id} className="absolute left-0 right-0 pointer-events-auto mx-2 rounded overflow-hidden cursor-pointer" style={{top:'8px',height:'32px'}}>
                      <Badge variant="warning" size="sm" className="flex h-full w-full items-center px-2 py-1" title={`Nghỉ: ${lv.class_code||'—'}`}>
                        Nghỉ: {lv.class_code||'—'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-4 lg:border-t-0 lg:border-l">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Chi tiết ngày</p>
                <h4 className="mt-1 text-lg font-bold text-gray-900">{activeDate.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</h4>
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-500">Lịch rảnh</p>
                    <p className="mt-1 text-sm text-gray-700">{activeSlots.length === 0 ? 'Chưa có lịch rảnh.' : `${activeSlots.length} lịch rảnh`}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-500">Đơn xin nghỉ</p>
                    <p className="mt-1 text-sm text-gray-700">{activeLeaves.length === 0 ? 'Không có đơn xin nghỉ.' : `${activeLeaves.length} đơn xin nghỉ`}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        ) : view==='week' ? (
          <div className="border-t border-gray-200 bg-white">
            <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={()=>stepWeek(-1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50" aria-label="Tuần trước"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-sm font-semibold text-gray-700 min-w-40 text-center">{periodLabel}</span>
                <button onClick={()=>stepWeek(1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50" aria-label="Tuần sau"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="lg:hidden">
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                {weekDates.map((date)=>{
                  const key=formatDateKey(date)
                  const isSelected=selectedWeekDateKeys.includes(key)
                  const isToday=isSameDate(startOfDay(date),startOfDay(new Date()))
                  return (
                    <button key={key} type="button" onClick={()=>toggleWeekDateSelection(date)} className={`border-r border-gray-200 px-1 py-2 text-center transition-colors ${isSelected?'bg-red-50':'bg-white hover:bg-gray-50'}`}>
                      <p className="text-[11px] font-semibold text-gray-500">{WEEKDAY_LABELS[date.getDay()===0?6:date.getDay()-1]}</p>
                      <p className={`mt-1 text-sm font-bold ${isToday?'text-[#a1001f]':isSelected?'text-gray-800':'text-gray-700'}`}>{String(date.getDate()).padStart(2,'0')}</p>
                    </button>
                  )
                })}
              </div>
              <div className="grid gap-0" style={{gridTemplateColumns:`52px repeat(${selectedWeekDateKeys.length}, minmax(0, 1fr))`}}>
                <div className="border-r border-gray-200 bg-gray-50/80">
                  {HOUR_OPTIONS.map((hour)=>(
                    <div key={hour} className="relative border-b border-gray-200 last:border-b-0" style={{height:`${TIME_SLOT_HEIGHT}px`}}>
                      <span className="absolute top-1 right-2 text-[11px] font-medium text-gray-500">{hour}</span>
                    </div>
                  ))}
                </div>
                {selectedWeekDateKeys.map((dateKey)=>{
                  const date=weekDates.find(d=>formatDateKey(d)===dateKey)
                  if(!date) return null
                  const daySlots=lichRanhByDate[dateKey]||[]
                  const dayLeaves=leaveByDate[dateKey]||[]
                  return (
                    <div key={dateKey} className="border-r border-gray-200 relative bg-white" style={{minHeight:`${HOUR_OPTIONS.length*TIME_SLOT_HEIGHT}px`}}>
                      {HOUR_OPTIONS.map((hour)=>(
                        <div key={`${dateKey}-${hour}`} className="border-b border-gray-200" style={{height:`${TIME_SLOT_HEIGHT}px`}}/>
                      ))}
                      <div className="absolute inset-0 pointer-events-none">
                        {daySlots.map(slot=>{
                          const {topPx,heightPx}=getSlotPosition(slot.batDau,slot.ketThuc)
                          return (
                            <div key={slot.id} className="absolute left-0 right-0 pointer-events-auto mx-1 rounded overflow-hidden cursor-pointer" style={{top:`${topPx}px`,height:`${heightPx}px`,minHeight:'20px'}}>
                              <Badge variant="emerald" size="sm" className="flex h-full w-full items-center px-1.5 py-0.5" title={`${slot.batDau}–${slot.ketThuc}`}>{slot.batDau}–{slot.ketThuc}</Badge>
                            </div>
                          )
                        })}
                        {(allEventsByDate[dateKey]||[]).map(ev=>{
                          const start=new Date(ev.start_at)
                          const end=new Date(ev.end_at)
                          const startStr = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`
                          const endStr = `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`
                          const {topPx,heightPx}=getSlotPosition(startStr,endStr)
                          const now=new Date()
                          const isOngoing = now>=start && now<end
                          const isUpcoming = start>now
                          return (
                            <div key={`ev-${ev.id}`} className="absolute left-0 right-0 pointer-events-auto mx-1 rounded overflow-hidden cursor-pointer" style={{top:`${topPx}px`,height:`${heightPx}px`,minHeight:'20px'}}>
                              <Badge variant={isOngoing? 'danger':'slate'} size="sm" className="flex h-full w-full items-center px-1.5 py-0.5 truncate" title={ev.title}>{ev.title}</Badge>
                            </div>
                          )
                        })}
                        {dayLeaves.map(lv=>(
                          <div key={lv.id} className="absolute left-0 right-0 pointer-events-auto mx-1 rounded overflow-hidden cursor-pointer" style={{top:'4px',height:'24px'}}>
                          <Badge variant="warning" size="sm" className="flex h-full w-full items-center px-1.5 py-0.5" title="Nghỉ">Nghỉ</Badge>
                        </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="hidden lg:block">
            <div className="grid border-b border-gray-200 bg-gray-50" style={{gridTemplateColumns:`64px repeat(7, minmax(0, 1fr))`}}>
              <div className="border-r border-gray-200 bg-gray-50"></div>
              {weekDates.map((date)=> {
                const isToday=isSameDate(date,new Date())
                const key=formatDateKey(date)
                return (
                  <button key={key} type="button" onClick={()=>setDayDetailDate(date)} className={`border-r border-gray-200 px-2 py-2 text-center transition-colors ${isToday?'bg-red-50':'bg-white hover:bg-gray-50'}`}>
                    <p className="text-[11px] font-semibold text-gray-500">{WEEKDAY_LABELS[date.getDay()===0?6:date.getDay()-1]}</p>
                    <p className={`mt-1 text-sm font-bold ${isToday?'text-[#a1001f]':'text-gray-700'}`}>{String(date.getDate()).padStart(2,'0')}</p>
                  </button>
                )
              })}
            </div>
            <div className="grid" style={{gridTemplateColumns:`64px repeat(7, minmax(0, 1fr))`}}>
              <div className="border-r border-gray-200 bg-gray-50/80">
                {HOUR_OPTIONS.map((hour)=> (
                  <div key={hour} className="relative border-b border-gray-200 last:border-b-0" style={{height:`${TIME_SLOT_HEIGHT}px`}}>
                    <span className="absolute top-1 right-2 text-[11px] font-medium text-gray-500">{hour}</span>
                  </div>
                ))}
              </div>
              {weekDates.map((date)=> {
                const key=formatDateKey(date)
                const daySlots=lichRanhByDate[key]||[]
                const dayLeaves=leaveByDate[key]||[]
                return (
                  <div key={key} className="border-r border-gray-200 relative bg-white" style={{minHeight:`${HOUR_OPTIONS.length*TIME_SLOT_HEIGHT}px`}}>
                    {HOUR_OPTIONS.map((hour)=>(
                      <div key={`${key}-${hour}`} className="border-b border-gray-200" style={{height:`${TIME_SLOT_HEIGHT}px`}}/>
                    ))}
                    <div className="absolute inset-0 pointer-events-none">
                      {daySlots.map(slot=>{
                        const {topPx,heightPx}=getSlotPosition(slot.batDau,slot.ketThuc)
                        return (
                          <div key={slot.id} className="absolute left-0 right-0 pointer-events-auto mx-1 rounded overflow-hidden cursor-pointer" style={{top:`${topPx}px`,height:`${heightPx}px`,minHeight:'20px'}}>
                            <Badge variant="emerald" size="sm" className="flex h-full w-full items-center px-1.5 py-0.5" title={`${slot.batDau}–${slot.ketThuc}`}>{slot.batDau}–{slot.ketThuc}</Badge>
                          </div>
                        )
                      })}
                      {(allEventsByDate[key]||[]).map(ev=>{
                        const start=new Date(ev.start_at)
                        const end=new Date(ev.end_at)
                        const startStr = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`
                        const endStr = `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`
                        const {topPx,heightPx}=getSlotPosition(startStr,endStr)
                        const now=new Date()
                        const isOngoing = now>=start && now<end
                        const isUpcoming = start>now
                        return (
                          <div key={`ev-${ev.id}`} className="absolute left-0 right-0 pointer-events-auto mx-1 rounded overflow-hidden cursor-pointer" style={{top:`${topPx}px`,height:`${heightPx}px`,minHeight:'20px'}}>
                            <Badge variant={isOngoing? 'danger':'slate'} size="sm" className="flex h-full w-full items-center px-1.5 py-0.5 truncate" title={ev.title}>{ev.title}</Badge>
                          </div>
                        )
                      })}
                      {dayLeaves.map(lv=>(
                        <div key={lv.id} className="absolute left-0 right-0 pointer-events-auto mx-1 overflow-hidden cursor-pointer" style={{top:'4px',height:'24px'}}>
                        <Badge variant="warning" size="sm" className="flex h-full w-full items-center px-1.5 py-0.5" title="Nghỉ">Nghỉ</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            </div>
          </div>
        ) : (
        <div className="border-t border-gray-200 bg-white">
          <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={()=>stepMonth(-1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50" aria-label="Tháng trước"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-semibold text-gray-700 min-w-40 text-center">{periodLabel}</span>
              <button onClick={()=>stepMonth(1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50" aria-label="Tháng sau"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-l border-t border-gray-200 bg-white" style={{height:'calc(100vh - 108px)'}}>
          {WEEKDAY_LABELS.map(l=><div key={l} className="h-9 border-r border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 flex items-center justify-center">{l}</div>)}
          {monthCells.map(({date,inCurrentMonth})=>{
            const isToday=isSameDate(date,new Date()),key=formatDateKey(date),slots=lichRanhByDate[key]||[],leaves=leaveByDate[key]||[],hasSlots=slots.length>0,hasLeaves=leaves.length>0,isPast=startOfDay(date)<startOfDay(new Date())
            return(
              <div key={key} onClick={()=>handleDayClick(date,inCurrentMonth)}
                className={`flex flex-col border-r border-b border-gray-200 p-1 overflow-hidden ${!inCurrentMonth?'bg-gray-50 opacity-30 cursor-default':'cursor-pointer hover:bg-gray-50/60'}${isPast&&inCurrentMonth?' opacity-60':''}${isToday?' !bg-yellow-50':''}`}
                style={{height:'calc((100vh - 108px - 36px) / 6)'}}>
                <div className="mb-1">
                  {isToday?<span className="rounded-full bg-[#a1001f] w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white">{date.getDate()}</span>
                  :<span className={`text-[11px] font-semibold ${inCurrentMonth?'text-gray-700':'text-gray-400'}`}>{date.getDate()}</span>}
                </div>
                {inCurrentMonth && (()=>{
                  const evs: Array<{type:'slot'|'event'|'leave'; id:string; label:string}> = []
                  slots.forEach(s=>evs.push({type:'slot', id:`slot-${s.id}`, label:`${s.batDau}–${s.ketThuc}`}))
                  ;(allEventsByDate[key]||[]).forEach(e=>{
                    const start=new Date(e.start_at)
                    const end=new Date(e.end_at)
                    const now=new Date()
                    const isOngoing = now>=start && now<end
                    const isUpcoming = start>now
                    evs.push({type:'event', id:`ev-${e.id}`, label:e.title})
                  })
                  leaves.forEach(l=>evs.push({type:'leave', id:`leave-${l.id}`, label:'Nghỉ'}))

                  if(evs.length===0) return null
                  const visible = evs.slice(0,3)
                  const more = evs.length-visible.length
                  return (
                    <div className="flex flex-col gap-1 overflow-hidden mt-0.5">
                      {visible.map(item=> (
                          <Badge key={item.id} variant={item.type==='slot'?'emerald':item.type==='leave'?'warning':'slate'} size="sm" className="rounded px-1.5 py-1" title={item.label}>
                            <span className="text-[11px] font-semibold leading-none truncate">{item.label}</span>
                          </Badge>
                        ))}
                      {more>0 && (
                        <div className="rounded px-1.5 py-1 bg-gray-100 text-gray-600">
                          <span className="text-[11px] font-semibold leading-none">+{more} thêm</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
        </div>
        )}
      </Card>

      {/* Day Detail Modal */}
      {dayDetailDate&&(()=>{
        const key=formatDateKey(dayDetailDate)
        const daySlots=lichRanhByDate[key]||[]
        const dayLeaves=leaveByDate[key]||[]
        const dayEvents=allEventsByDate[key]||[]
        const isPast=startOfDay(dayDetailDate)<startOfDay(new Date())
        const statusLabel=(s:string)=>{switch(s){case 'pending_admin':return{text:'Chờ duyệt',cls:'bg-amber-100 text-amber-700'};case 'approved_unassigned':case 'approved_assigned':return{text:'Đã duyệt',cls:'bg-blue-100 text-blue-700'};case 'substitute_confirmed':return{text:'Hoàn tất',cls:'bg-emerald-100 text-emerald-700'};case 'rejected':return{text:'Từ chối',cls:'bg-red-100 text-red-700'};default:return{text:s,cls:'bg-gray-100 text-gray-700'}}}
        return(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setDayDetailDate(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">Hoạt động ngày</h3>
                <p className="text-xs text-white/80 mt-0.5">{dayDetailDate.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</p>
              </div>
              <button onClick={()=>setDayDetailDate(null)} className="rounded-md p-1 text-white/80 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Lịch rảnh đã đăng ký */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Lịch rảnh đã đăng ký</p>
                {daySlots.length===0?(
                  <p className="text-sm text-gray-400 italic">Chưa đăng ký lịch rảnh ngày này.</p>
                ):(
                  <div className="space-y-2">
                    {daySlots.map(slot=>(
                      <div key={slot.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="rounded-lg bg-[#a1001f]/10 p-2"><Clock className="h-4 w-4 text-[#a1001f]" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900">{slot.batDau} – {slot.ketThuc}</p>
                          {slot.coSo.length>0&&<p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.coSo.join(', ')}</p>}
                          {slot.linhHoat&&<span className="inline-block mt-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Linh hoạt</span>}
                        </div>
                        {!isPast&&(
                          <div className="flex gap-1">
                            <button onClick={()=>{setDayDetailDate(null);openEditForm(slot)}} className="rounded-lg p-2 text-gray-500 hover:bg-[#a1001f]/10 hover:text-[#a1001f] transition-colors" title="Chỉnh sửa"><Pencil className="h-4 w-4" /></button>
                            <button onClick={()=>{handleDeleteSlot(slot.id,slot.date)}} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Xóa"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Đơn xin nghỉ */}
              {dayLeaves.length>0&&(
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Đơn xin nghỉ</p>
                  <div className="space-y-2">
                    {dayLeaves.map(lv=>{
                      const st=statusLabel(lv.status)
                      return(
                        <div key={lv.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">Mã lớp: {lv.class_code||'—'}</p>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                          </div>
                          {lv.campus&&<p className="text-xs text-gray-500 mt-1">Cơ sở: {lv.campus}</p>}
                          {lv.reason&&<p className="text-xs text-gray-500 mt-0.5 line-clamp-2">Lý do: {lv.reason}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Sự kiện trong ngày */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Sự kiện trong ngày</p>
                {dayEvents.length===0?(
                  <p className="text-sm text-gray-400 italic">Không có sự kiện nào trong ngày này.</p>
                ):(
                  <div className="space-y-2">
                    {dayEvents.map(ev=>{
                      const start = new Date(ev.start_at)
                      const end = new Date(ev.end_at)
                      const timeLabel = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')} - ${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`
                      return(
                        <div key={ev.id} className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                          <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-blue-100 p-2"><CalendarDays className="h-4 w-4 text-blue-700" /></div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 line-clamp-2">{ev.title}</p>
                              <p className="text-xs text-gray-600 mt-0.5">{timeLabel}</p>
                              {String(ev.event_type || '').toLowerCase() === 'teaching_review' && (
                                <div className="mt-2 space-y-1.5 text-xs text-gray-700">
                                  <p>
                                    <span className="font-semibold text-gray-500">Cơ sở: </span>
                                    {ev.center_name || ev.teacher_center || '—'}
                                    {ev.center_map_url && (
                                      <a
                                        href={ev.center_map_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ml-2 inline-flex items-center gap-1 rounded-full border border-[#a1001f]/20 bg-[#a1001f]/5 px-2 py-0.5 font-semibold text-[#a1001f] hover:border-[#a1001f]/30 hover:bg-[#a1001f]/10 hover:text-[#870019]"
                                        title="Xem map"
                                      >
                                        <MapPin className="h-3 w-3" />
                                        <span>Xem map</span>
                                      </a>
                                    )}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-gray-500">Phòng duyệt giảng: </span>
                                    {ev.room || '—'}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-gray-500">Người duyệt giảng: </span>
                                    {ev.lecture_reviewer || '—'}
                                  </p>
                                  {(ev.center_full_address || ev.center_address) && (
                                    <p className="text-gray-500">
                                      <span className="font-semibold text-gray-500">Địa chỉ: </span>
                                      {ev.center_full_address || ev.center_address}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {/* Actions */}
              {!isPast&&(
                <div className="border-t border-gray-200 pt-4 space-y-2">
                  <button onClick={()=>{setDayDetailDate(null);openForm(dayDetailDate)}} className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:bg-[#a1001f]/5 hover:border-[#a1001f]/30 transition-colors group">
                    <div className="rounded-lg bg-[#a1001f]/10 p-2"><CalendarPlus className="h-4 w-4 text-[#a1001f]" /></div>
                    <div><p className="text-sm font-semibold text-gray-900 group-hover:text-[#a1001f]">Đăng ký lịch rảnh</p></div>
                  </button>
                  <button onClick={()=>{const dateStr=key;setDayDetailDate(null);onOpenLeaveRequest?.(dateStr)}} className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:bg-amber-50 hover:border-amber-300 transition-colors group">
                    <div className="rounded-lg bg-amber-100 p-2"><FileText className="h-4 w-4 text-amber-600" /></div>
                    <div><p className="text-sm font-semibold text-gray-900 group-hover:text-amber-700">Tạo đơn xin nghỉ</p></div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Slot Form Modal */}
      {selectedDate&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setSelectedDate(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">{editingSlotId?'Chỉnh sửa lịch rảnh':'Đăng ký lịch rảnh'}</h3>
                <p className="text-xs text-white/80 mt-0.5">{selectedDate.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</p>
              </div>
              <button onClick={()=>setSelectedDate(null)} className="rounded-md p-1 text-white/80 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Bắt đầu giờ rảnh</label><select value={batDau} onChange={e=>setBatDau(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 outline-none">{HOUR_OPTIONS.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Kết thúc giờ rảnh</label><select value={ketThuc} onChange={e=>setKetThuc(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 outline-none">{HOUR_OPTIONS.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Cơ sở ưu tiên</label>
                <p className="text-[11px] text-gray-400 mb-3">Ưu tiên chọn cơ sở thuận tiện để đảm bảo di chuyển kịp thời giữa các ca dạy liền kề.</p>
                {centersLoading ? (
                  <p className="text-xs text-gray-400">Đang tải danh sách cơ sở...</p>
                ) : centers.length === 0 ? (
                  <p className="text-xs text-gray-400">Không có cơ sở khả dụng.</p>
                ) : (()=>{
                  const regions=Array.from(new Set(centers.map(c=>c.region)))
                  const leftRegion=userRegion&&regions.includes(userRegion)?userRegion:regions[0]
                  const rightRegions=regions.filter(r=>r!==leftRegion)
                  const leftCenters=centers.filter(c=>c.region===leftRegion)
                  const rightCenters=centers.filter(c=>rightRegions.includes(c.region))
                  const renderCb=(c:CenterOption)=>(
                    <label key={c.short_code} className="flex items-center gap-2 select-none cursor-pointer">
                      <input type="checkbox" checked={coSoChon.includes(c.short_code)} onChange={()=>toggleCoSo(c.short_code)} className="h-4 w-4 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f] cursor-pointer flex-shrink-0" />
                      <span className="text-sm text-gray-800">{c.full_name}</span>
                    </label>
                  )
                  return(
                    <div className="grid grid-cols-2 gap-x-6">
                      <div className="flex flex-col gap-y-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{leftRegion}</p>{leftCenters.map(renderCb)}</div>
                      <div className="flex flex-col gap-y-3">{rightRegions.map((region,ri)=><div key={region} className={`flex flex-col gap-y-3 ${ri>0?'mt-2':''}`}><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{region}</p>{centers.filter(c=>c.region===region).map(renderCb)}</div>)}</div>
                    </div>
                  )
                })()}
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={linhHoat} onChange={e=>setLinhHoat(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-700">Linh hoạt</span><span className="text-xs text-gray-400">(Có thể hỗ trợ cơ sở khác nếu cần)</span>
              </label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={lapLich} onChange={e=>setLapLich(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]" /><span className="text-xs font-semibold text-gray-700">Lặp lịch theo khoảng ngày</span></label>
                {lapLich&&(
                  <div className="mt-3 space-y-2">
                    <div><label className="block text-xs text-gray-600 mb-1">Từ ngày</label><input type="date" value={toDateInputValue(lapTu)} onChange={e=>setLapTu(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 outline-none" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Đến ngày</label><input type="date" value={kieuLap==='tuan' ? toDateInputValueFromDate(weeklyEndDate) : toDateInputValue(lapDen)} onChange={e=>setLapDen(e.target.value)} readOnly={kieuLap==='tuan'} disabled={kieuLap==='tuan'} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 outline-none disabled:bg-gray-100 disabled:text-gray-500" /></div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Kiểu lặp</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="kieu_lap" value="ngay" checked={kieuLap==='ngay'} onChange={()=>setKieuLap('ngay')} className="h-4 w-4 text-[#a1001f] focus:ring-[#a1001f]" /><span className="text-sm text-gray-700">Theo ngày</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="kieu_lap" value="tuan" checked={kieuLap==='tuan'} onChange={()=>setKieuLap('tuan')} className="h-4 w-4 text-[#a1001f] focus:ring-[#a1001f]" /><span className="text-sm text-gray-700">Theo tuần</span></label>
                      </div>
                    </div>
                    {kieuLap==='tuan' ? (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Số tuần lặp</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={lapSoTuan}
                          onChange={e=>setLapSoTuan(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 outline-none"
                        />
                        {lapTuDate&&Number.parseInt(lapSoTuan,10)>=1&&(
                          <p className="text-[11px] text-[#a1001f] font-medium mt-1">
                            Sẽ set {Number.parseInt(lapSoTuan,10)} tuần lặp từ {lapTu} đến {toDateInputValueFromDate(weeklyEndDate)}
                          </p>
                        )}
                      </div>
                    ) : (
                      lapTuDate&&lapDenDate&&lapTuDate<=lapDenDate&&(()=>{
                        const dates=buildDates();
                        return <p className="text-[11px] text-[#a1001f] font-medium">Sẽ set lịch cho {dates.length} ngày (từ {lapTu} đến {lapDen})</p>
                      })()
                    )}
                  </div>
                )}
              </div>
              {formError&&<p className="text-xs text-red-600">{formError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button onClick={()=>setSelectedDate(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#870019] disabled:opacity-60">{saving?'Đang lưu...':'Lưu'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
