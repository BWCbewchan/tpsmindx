// Shared types and helpers for leave request tab
export interface LeaveRequest {
  id: number; teacher_name: string; lms_code: string; email: string; campus: string
  center_id?: number | null
  campus_bu_email?: string | null
  leave_date: string; reason: string; class_code?: string; student_count?: string
  class_time?: string; leave_session?: string; has_substitute: boolean
  substitute_teacher?: string; substitute_email?: string; class_status?: string
  email_subject?: string; email_body?: string; admin_note?: string
  status: 'pending_admin'|'approved_unassigned'|'approved_assigned'|'rejected'|'substitute_confirmed'
  created_at: string; updated_at: string
}

export type StatusVariant = 'warning'|'info'|'success'|'destructive'
export type StatFilter = 'pending'|'done'|'rejected'

export const STORAGE_KEY = 'teacher_leave_request_auto_fill_data'
export const NORTH_CAMPUS_KEYWORDS = ['ha noi','hanoi','bac','hai phong','quang ninh','thai nguyen','nam dinh']
export const LEAVE_SESSION_OPTIONS = Array.from({length:14},(_,i)=>`Buổi ${i+1}`)
export const MIN_ADVANCE_HOURS = 72
export const MAX_REQUESTS_PER_CLASS = 2

export const SELECT_BASE_CLASS = 'w-full min-w-0 max-w-full min-h-11 appearance-none rounded-lg border border-gray-300 bg-white px-3 py-3 pr-10 text-[16px] text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:text-sm'
export const INPUT_BASE_CLASS = 'w-full min-w-0 max-w-full min-h-11 rounded-lg border border-gray-300 px-3 py-3 text-[16px] text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:text-sm'
export const TEXTAREA_BASE_CLASS = 'w-full min-w-0 max-w-full rounded-lg border border-gray-300 px-3 py-2.5 text-[16px] text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:text-sm'
export const TIME_INPUT_CLASS = `${INPUT_BASE_CLASS} tabular-nums`

export function getStatusMeta(status: LeaveRequest['status']): {label:string;variant:StatusVariant} {
  switch(status){
    case 'pending_admin': return {label:'Chờ TC/Leader duyệt',variant:'warning'}
    case 'approved_unassigned': return {label:'Đã duyệt - chờ phân GV thay',variant:'info'}
    case 'approved_assigned': return {label:'Đã gửi cho GV thay thế',variant:'info'}
    case 'substitute_confirmed': return {label:'GV thay đã xác nhận',variant:'success'}
    case 'rejected': return {label:'Từ chối',variant:'destructive'}
    default: return {label:status,variant:'info'}
  }
}

export function matchesStatFilter(status: LeaveRequest['status'], filter: StatFilter|null): boolean {
  if(!filter) return true
  if(filter==='pending') return status==='pending_admin'
  if(filter==='done') return status==='substitute_confirmed'
  return status==='rejected'
}

export function normalizeHhMm(iso:string):string {
  const parts=iso.split(':').map(p=>parseInt(p,10))
  return `${String(parts[0]??0).padStart(2,'0')}:${String(parts[1]??0).padStart(2,'0')}`
}

export function timeToVnSegment(iso:string):string {
  const[hs,ms]=normalizeHhMm(iso).split(':')
  const h=parseInt(hs??'0',10),m=parseInt(ms??'0',10)
  return `${h}h${String(m).padStart(2,'0')}`
}

export function formatClassTimeRange(start:string,end:string):string {
  return `${timeToVnSegment(start)} - ${timeToVnSegment(end)}`
}

export function timeToMinutes(iso:string):number {
  const[h,m]=normalizeHhMm(iso).split(':').map(x=>parseInt(x,10))
  return (h||0)*60+(m||0)
}

import type { StepItem } from '@/components/ui/stepper'

export function getWorkflowSteps(status: LeaveRequest['status']): StepItem[] {
  const s1:StepItem = {id:1,label:'Gửi mail xin nghỉ',status:'completed'}
  let s2:StepItem['status']='current',s3:StepItem['status']='upcoming',s4:StepItem['status']='upcoming'
  if(status==='rejected'){s2='error';s4='error'}
  else if(status==='approved_unassigned'||status==='approved_assigned'){s2='success';s3='current'}
  else if(status==='substitute_confirmed'){s2='success';s3='success';s4='success'}
  return [s1,{id:2,label:'TC/Leader duyệt',status:s2},{id:3,label:'GV thay thế xác nhận',status:s3},{id:4,label:'Hoàn tất quy trình',status:s4}]
}
