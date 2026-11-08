'use client'

import { Plus, Save, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { authHeaders } from '@/lib/auth-headers'
import type {
  TeacherPortfolioDto,
  TeacherPortfolioUpdateInput,
} from '@/lib/teacher-portfolio/types'

type EditorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: TeacherPortfolioDto
  token?: string | null
  onSaved: (data: TeacherPortfolioDto) => void
}

const fieldClass = 'h-10 bg-white'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-bold text-gray-700">{children}</label>
}

function editorState(data: TeacherPortfolioDto): TeacherPortfolioUpdateInput {
  return {
    education: data.education.map((item) => ({
      institution: item.institution,
      qualification: item.qualification,
      fieldOfStudy: item.fieldOfStudy,
      startYear: item.startYear,
      endYear: item.endYear,
      description: item.description,
    })),
    experiences: data.experiences.map((item) => ({
      organization: item.organization,
      jobTitle: item.jobTitle,
      startDate: item.startDate,
      endDate: item.endDate,
      isCurrent: item.isCurrent,
      description: item.description,
    })),
    achievements: data.achievements.map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      organization: item.organization,
      level: item.level,
      achievedOn: item.achievedOn,
      description: item.description,
      evidenceUrl: item.evidenceUrl,
    })),
  }
}

export default function TeacherPortfolioEditor({
  open,
  onOpenChange,
  data,
  token,
  onSaved,
}: EditorProps) {
  const initial = useMemo(() => editorState(data), [data])
  const [form, setForm] = useState<TeacherPortfolioUpdateInput>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (!saving) onOpenChange(false)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/user/teacher-portfolio', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify(form),
      })
      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean
        data?: TeacherPortfolioDto
        error?: string
        fieldErrors?: Record<string, string>
      }
      if (!response.ok || !result.data) {
        const firstFieldError = result.fieldErrors
          ? Object.values(result.fieldErrors)[0]
          : null
        throw new Error(firstFieldError || result.error || 'Không thể lưu portfolio.')
      }
      onSaved(result.data)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu portfolio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="relative pr-14">
          <DialogTitle>Cập nhật thông tin trước khi vào MindX</DialogTitle>
          <DialogDescription>
            Chỉ Nhóm 1 được phép chỉnh sửa. Thông tin sẽ hiển thị với nhãn “GV tự cập nhật”; giải thưởng có minh chứng sẽ chờ Leader/TE xác thực.
          </DialogDescription>
          <button type="button" onClick={close} className="absolute right-5 top-5 rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <DialogBody className="flex-1 space-y-8 overflow-y-auto bg-[#fbfaf7] px-4 sm:px-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="font-black text-gray-950">Học vấn</h3><p className="text-xs text-gray-500">Trường, bằng cấp và chuyên ngành.</p></div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setForm((current) => ({ ...current, education: [...current.education, { institution: '', qualification: '', fieldOfStudy: '', startYear: null, endYear: null, description: '' }] }))}
              >
                <Plus /> Thêm học vấn
              </Button>
            </div>
            {form.education.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-sm text-gray-500">Chưa có mục học vấn.</p> : null}
            <div className="space-y-3">
              {form.education.map((item, index) => (
                <div key={`education-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Trường / cơ sở đào tạo *</Label><Input className={fieldClass} value={item.institution} maxLength={200} onChange={(event) => setForm((current) => ({ ...current, education: current.education.map((row, rowIndex) => rowIndex === index ? { ...row, institution: event.target.value } : row) }))} /></div>
                    <div><Label>Bằng cấp / trình độ *</Label><Input className={fieldClass} value={item.qualification} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, education: current.education.map((row, rowIndex) => rowIndex === index ? { ...row, qualification: event.target.value } : row) }))} /></div>
                    <div className="sm:col-span-2"><Label>Chuyên ngành</Label><Input className={fieldClass} value={item.fieldOfStudy ?? ''} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, education: current.education.map((row, rowIndex) => rowIndex === index ? { ...row, fieldOfStudy: event.target.value } : row) }))} /></div>
                    <div><Label>Năm bắt đầu</Label><Input className={fieldClass} type="number" min={1950} max={2100} value={item.startYear ?? ''} onChange={(event) => setForm((current) => ({ ...current, education: current.education.map((row, rowIndex) => rowIndex === index ? { ...row, startYear: event.target.value ? Number(event.target.value) : null } : row) }))} /></div>
                    <div><Label>Năm kết thúc</Label><Input className={fieldClass} type="number" min={1950} max={2100} value={item.endYear ?? ''} onChange={(event) => setForm((current) => ({ ...current, education: current.education.map((row, rowIndex) => rowIndex === index ? { ...row, endYear: event.target.value ? Number(event.target.value) : null } : row) }))} /></div>
                    <div className="sm:col-span-2"><Label>Mô tả</Label><Textarea value={item.description ?? ''} maxLength={1000} onChange={(event) => setForm((current) => ({ ...current, education: current.education.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row) }))} /></div>
                  </div>
                  <button type="button" onClick={() => setForm((current) => ({ ...current, education: current.education.filter((_, rowIndex) => rowIndex !== index) }))} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-800"><Trash2 className="h-3.5 w-3.5" /> Xóa mục</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="font-black text-gray-950">Kinh nghiệm làm việc</h3><p className="text-xs text-gray-500">Công ty, vai trò và thời gian làm việc.</p></div>
              <Button type="button" size="sm" variant="outline" onClick={() => setForm((current) => ({ ...current, experiences: [...current.experiences, { organization: '', jobTitle: '', startDate: '', endDate: '', isCurrent: false, description: '' }] }))}><Plus /> Thêm kinh nghiệm</Button>
            </div>
            {form.experiences.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-sm text-gray-500">Chưa có mục kinh nghiệm.</p> : null}
            <div className="space-y-3">
              {form.experiences.map((item, index) => (
                <div key={`experience-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Công ty / tổ chức *</Label><Input className={fieldClass} value={item.organization} maxLength={200} onChange={(event) => setForm((current) => ({ ...current, experiences: current.experiences.map((row, rowIndex) => rowIndex === index ? { ...row, organization: event.target.value } : row) }))} /></div>
                    <div><Label>Vị trí / vai trò *</Label><Input className={fieldClass} value={item.jobTitle} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, experiences: current.experiences.map((row, rowIndex) => rowIndex === index ? { ...row, jobTitle: event.target.value } : row) }))} /></div>
                    <div><Label>Từ ngày</Label><Input className={fieldClass} type="date" value={item.startDate ?? ''} onChange={(event) => setForm((current) => ({ ...current, experiences: current.experiences.map((row, rowIndex) => rowIndex === index ? { ...row, startDate: event.target.value } : row) }))} /></div>
                    <div><Label>Đến ngày</Label><Input className={fieldClass} type="date" disabled={item.isCurrent} value={item.isCurrent ? '' : item.endDate ?? ''} onChange={(event) => setForm((current) => ({ ...current, experiences: current.experiences.map((row, rowIndex) => rowIndex === index ? { ...row, endDate: event.target.value } : row) }))} /></div>
                    <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={item.isCurrent === true} onChange={(event) => setForm((current) => ({ ...current, experiences: current.experiences.map((row, rowIndex) => rowIndex === index ? { ...row, isCurrent: event.target.checked, endDate: event.target.checked ? null : row.endDate } : row) }))} /> Tôi đang làm việc tại đây</label>
                    <div className="sm:col-span-2"><Label>Mô tả công việc</Label><Textarea value={item.description ?? ''} maxLength={1500} onChange={(event) => setForm((current) => ({ ...current, experiences: current.experiences.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row) }))} /></div>
                  </div>
                  <button type="button" onClick={() => setForm((current) => ({ ...current, experiences: current.experiences.filter((_, rowIndex) => rowIndex !== index) }))} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-800"><Trash2 className="h-3.5 w-3.5" /> Xóa mục</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="font-black text-gray-950">Giải thưởng & cuộc thi</h3><p className="text-xs text-gray-500">Có thể gắn link minh chứng để Leader/TE xác thực.</p></div>
              <Button type="button" size="sm" variant="outline" onClick={() => setForm((current) => ({ ...current, achievements: [...current.achievements, { category: 'award', title: '', organization: '', level: '', achievedOn: '', description: '', evidenceUrl: '' }] }))}><Plus /> Thêm thành tích</Button>
            </div>
            {form.achievements.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-sm text-gray-500">Chưa có giải thưởng hoặc cuộc thi.</p> : null}
            <div className="space-y-3">
              {form.achievements.map((item, index) => (
                <div key={item.id ? `achievement-${item.id}` : `achievement-new-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Loại</Label><select className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={item.category} onChange={(event) => setForm((current) => ({ ...current, achievements: current.achievements.map((row, rowIndex) => rowIndex === index ? { ...row, category: event.target.value === 'competition' ? 'competition' : 'award' } : row) }))}><option value="award">Giải thưởng</option><option value="competition">Cuộc thi</option></select></div>
                    <div><Label>Tên giải thưởng / cuộc thi *</Label><Input className={fieldClass} value={item.title} maxLength={200} onChange={(event) => setForm((current) => ({ ...current, achievements: current.achievements.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row) }))} /></div>
                    <div><Label>Đơn vị tổ chức</Label><Input className={fieldClass} value={item.organization ?? ''} maxLength={200} onChange={(event) => setForm((current) => ({ ...current, achievements: current.achievements.map((row, rowIndex) => rowIndex === index ? { ...row, organization: event.target.value } : row) }))} /></div>
                    <div><Label>Cấp độ / hạng</Label><Input className={fieldClass} value={item.level ?? ''} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, achievements: current.achievements.map((row, rowIndex) => rowIndex === index ? { ...row, level: event.target.value } : row) }))} /></div>
                    <div><Label>Ngày đạt</Label><Input className={fieldClass} type="date" value={item.achievedOn ?? ''} onChange={(event) => setForm((current) => ({ ...current, achievements: current.achievements.map((row, rowIndex) => rowIndex === index ? { ...row, achievedOn: event.target.value } : row) }))} /></div>
                    <div><Label>Link minh chứng (http/https)</Label><Input className={fieldClass} type="url" value={item.evidenceUrl ?? ''} maxLength={1000} placeholder="https://..." onChange={(event) => setForm((current) => ({ ...current, achievements: current.achievements.map((row, rowIndex) => rowIndex === index ? { ...row, evidenceUrl: event.target.value } : row) }))} /></div>
                    <div className="sm:col-span-2"><Label>Mô tả</Label><Textarea value={item.description ?? ''} maxLength={1000} onChange={(event) => setForm((current) => ({ ...current, achievements: current.achievements.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row) }))} /></div>
                  </div>
                  <button type="button" onClick={() => setForm((current) => ({ ...current, achievements: current.achievements.filter((_, rowIndex) => rowIndex !== index) }))} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-800"><Trash2 className="h-3.5 w-3.5" /> Xóa mục</button>
                </div>
              ))}
            </div>
          </section>

          {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={saving}>Hủy</Button>
          <Button type="button" variant="mindx" onClick={save} loading={saving}><Save /> Lưu thông tin</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

