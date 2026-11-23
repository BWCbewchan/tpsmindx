'use client'

import { Camera, ImageUp, Plus, Save, Trash2, X } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'

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
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024
const PORTRAIT_WIDTH = 1200
const PORTRAIT_ASPECT = 4 / 5

async function preparePortfolioPortrait(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Vui lòng chọn ảnh JPG, PNG hoặc WebP.')
  }
  if (file.size <= 0 || file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('Ảnh gốc tối đa 12MB.')
  }

  const sourceUrl = URL.createObjectURL(file)
  try {
    const source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Không thể đọc file ảnh này.'))
      image.src = sourceUrl
    })
    const sourceWidth = source.naturalWidth
    const sourceHeight = source.naturalHeight
    if (!sourceWidth || !sourceHeight) throw new Error('Kích thước ảnh không hợp lệ.')

    const sourceAspect = sourceWidth / sourceHeight
    let cropWidth = sourceWidth
    let cropHeight = sourceHeight
    let cropX = 0
    let cropY = 0
    if (sourceAspect > PORTRAIT_ASPECT) {
      cropWidth = sourceHeight * PORTRAIT_ASPECT
      cropX = (sourceWidth - cropWidth) / 2
    } else if (sourceAspect < PORTRAIT_ASPECT) {
      cropHeight = sourceWidth / PORTRAIT_ASPECT
      cropY = (sourceHeight - cropHeight) * 0.22
    }

    const outputWidth = Math.max(1, Math.min(PORTRAIT_WIDTH, Math.floor(cropWidth)))
    const outputHeight = Math.max(1, Math.round(outputWidth / PORTRAIT_ASPECT))
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Trình duyệt không thể xử lý ảnh.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      source,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    )

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.92)
    })
    if (!blob) throw new Error('Không thể tối ưu ảnh. Vui lòng thử ảnh khác.')
    return new File([blob], 'teacher-portfolio-portrait.webp', {
      type: blob.type || 'image/webp',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

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
  const [processingImage, setProcessingImage] = useState(false)
  const [error, setError] = useState('')
  const [portraitFile, setPortraitFile] = useState<File | null>(null)
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null)
  const [removePortrait, setRemovePortrait] = useState(false)
  const portraitInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (portraitPreview) URL.revokeObjectURL(portraitPreview)
    }
  }, [portraitPreview])

  const close = () => {
    if (!saving) onOpenChange(false)
  }

  const choosePortrait = async (file: File | null) => {
    if (!file) return
    setProcessingImage(true)
    setError('')
    try {
      const prepared = await preparePortfolioPortrait(file)
      const nextPreview = URL.createObjectURL(prepared)
      setPortraitPreview((current) => {
        if (current) URL.revokeObjectURL(current)
        return nextPreview
      })
      setPortraitFile(prepared)
      setRemovePortrait(false)
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'Không thể xử lý ảnh.')
    } finally {
      setProcessingImage(false)
      if (portraitInputRef.current) portraitInputRef.current.value = ''
    }
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
      let savedData = result.data
      if (portraitFile) {
        const imageForm = new FormData()
        imageForm.set('image', portraitFile)
        const imageResponse = await fetch('/api/user/teacher-portfolio/image', {
          method: 'POST',
          headers: authHeaders(token),
          body: imageForm,
        })
        const imageResult = (await imageResponse.json().catch(() => ({}))) as {
          data?: TeacherPortfolioDto
          error?: string
        }
        if (!imageResponse.ok || !imageResult.data) {
          throw new Error(imageResult.error || 'Đã lưu thông tin nhưng chưa thể tải ảnh lên.')
        }
        savedData = imageResult.data
      } else if (removePortrait && data.profile.imageSource === 'portfolio') {
        const imageResponse = await fetch('/api/user/teacher-portfolio/image', {
          method: 'DELETE',
          headers: authHeaders(token),
        })
        const imageResult = (await imageResponse.json().catch(() => ({}))) as {
          data?: TeacherPortfolioDto
          error?: string
        }
        if (!imageResponse.ok || !imageResult.data) {
          throw new Error(imageResult.error || 'Đã lưu thông tin nhưng chưa thể xóa ảnh portfolio.')
        }
        savedData = imageResult.data
      }
      onSaved(savedData)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu portfolio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving && !processingImage) onOpenChange(nextOpen)
      }}
    >
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
          <section className="overflow-hidden rounded-2xl border border-[#ead8dc] bg-white shadow-sm">
            <div className="border-b border-[#f0e2e5] bg-[#fff8f1] px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#bd0026] text-white"><Camera className="h-5 w-5" /></span>
                <div><h3 className="font-black text-[#2c1518]">Ảnh đại diện portfolio</h3><p className="mt-1 text-xs leading-5 text-[#755e62]">Ảnh riêng được ưu tiên hiển thị. Nếu không tải ảnh, portfolio tự dùng avatar TPS hiện tại.</p></div>
              </div>
            </div>
            <div className="grid gap-5 p-4 sm:grid-cols-[150px_1fr] sm:p-5">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[150px] overflow-hidden rounded-xl border-2 border-[#bd0026]/15 bg-[#fff4e6]">
                {portraitPreview || (!removePortrait && data.profile.avatarUrl) ? (
                  <Image
                    src={portraitPreview || data.profile.avatarUrl || ''}
                    alt={`Ảnh portfolio ${data.profile.displayName}`}
                    fill
                    sizes="150px"
                    className="object-cover object-top"
                    unoptimized
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-[#bd0026] px-3 text-center text-xs font-black text-white">Sẽ dùng avatar TPS sau khi lưu</div>
                )}
              </div>
              <div className="flex flex-col justify-center">
                <input
                  ref={portraitInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => void choosePortrait(event.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={saving || processingImage} onClick={() => portraitInputRef.current?.click()}>
                    <ImageUp /> {processingImage ? 'Đang tối ưu ảnh...' : portraitFile || data.profile.imageSource === 'portfolio' ? 'Đổi ảnh' : 'Tải ảnh lên'}
                  </Button>
                  {(portraitFile || data.profile.imageSource === 'portfolio') && !removePortrait ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving || processingImage}
                      className="text-rose-700 hover:text-rose-800"
                      onClick={() => {
                        setPortraitFile(null)
                        setPortraitPreview((current) => {
                          if (current) URL.revokeObjectURL(current)
                          return null
                        })
                        setRemovePortrait(data.profile.imageSource === 'portfolio')
                      }}
                    >
                      <Trash2 /> Dùng avatar TPS
                    </Button>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-2 text-xs leading-5 text-[#766368] sm:grid-cols-2">
                  <p className="rounded-lg bg-[#fff8f1] px-3 py-2"><strong className="text-[#bd0026]">Tỷ lệ 4:5</strong><br />Tự động căn và cắt ảnh phù hợp khung.</p>
                  <p className="rounded-lg bg-[#f2f9f4] px-3 py-2"><strong className="text-[#08783e]">Chất lượng cao</strong><br />Tối đa 1200×1500, WebP 92%.</p>
                </div>
                <p className="mt-3 text-[11px] font-semibold text-[#8b777b]">Nguồn hiện tại: {portraitFile ? 'Ảnh mới chưa lưu' : removePortrait ? 'Avatar TPS (sau khi lưu)' : data.profile.imageSource === 'portfolio' ? 'Ảnh portfolio riêng' : data.profile.imageSource === 'avatar' ? 'Avatar TPS' : 'Chưa có ảnh'}.</p>
              </div>
            </div>
          </section>

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
          <Button type="button" variant="mindx" onClick={save} loading={saving} disabled={processingImage}><Save /> Lưu thông tin</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

