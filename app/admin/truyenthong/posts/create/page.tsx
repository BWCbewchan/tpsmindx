'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ThumbnailCropper from '@/components/ThumbnailCropper'
import CroppedImage from '@/components/CroppedImage'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from "react"
import { toast } from '@/lib/app-toast'

// Dynamic import for RichTextEditor to avoid SSR issues
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
    ssr: false,
    loading: () => <div className="border rounded-xl p-4 min-h-75 animate-pulse bg-muted/20">Đang tải editor...</div>
})

export default function CreatePostPage() {
    const router = useRouter()
    
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        content: '',
        type: 'tin-tức',
        status: 'draft',
        audience: 'toàn-công-ty',
        publishDate: '',
    })

    const [errors, setErrors] = useState<Record<string, string>>({})
    // Dùng ref để lưu content editor — tránh re-render mỗi lần gõ
    const contentRef = React.useRef<string>('')

    const [files, setFiles] = useState<{
        thumbnail: File | null;
    }>({
        thumbnail: null
    })

    const [thumbnailPreview, setThumbnailPreview] = useState<string>('')
    const [previousThumbnail, setPreviousThumbnail] = useState<string>('')
    const [previousThumbnailFile, setPreviousThumbnailFile] = useState<File | null>(null)
    const [thumbnailPosition, setThumbnailPosition] = useState<string>('')
    const [showCropper, setShowCropper] = useState(false)

    // Handle Ctrl+Z for undo delete
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault()
                
                // Restore thumbnail if it was deleted
                if (!thumbnailPreview && previousThumbnail) {
                    setThumbnailPreview(previousThumbnail)
                    if (previousThumbnailFile) {
                        setFiles(prev => ({ ...prev, thumbnail: previousThumbnailFile }))
                    }
                    setPreviousThumbnail('')
                    setPreviousThumbnailFile(null)
                    toast.success('Đã khôi phục ảnh thumbnail')
                    return
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [thumbnailPreview, previousThumbnail, previousThumbnailFile])

    const handleImageFile = (file: File) => {
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Kích thước ảnh không được vượt quá 5MB')
            return
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn file ảnh')
            return
        }

        // Set file
        setFiles(prev => ({ ...prev, thumbnail: file }))

        // Show preview
        const reader = new FileReader()
        reader.onloadend = () => {
            setThumbnailPreview(reader.result as string)
        }
        reader.readAsDataURL(file)

        toast.success(`Đã chọn ảnh thumbnail. Ảnh sẽ được tải lên khi bạn lưu.`)
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                const file = item.getAsFile()
                if (!file) continue

                handleImageFile(file)
                break
            }
        }
    }

    const uploadImage = async (file: File) => {
        const formData = new FormData()
        formData.append('image', file)

        const res = await fetch('/api/upload-thumbnail', {
            method: 'POST',
            body: formData
        })

        if (!res.ok) throw new Error('Failed to upload image')

        const data = await res.json()
        return data.url
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrors({})

        // Validation
        const newErrors: Record<string, string> = {}
        if (!formData.title.trim()) newErrors.title = 'Tiêu đề không được để trống'
        if (!formData.description.trim()) newErrors.description = 'Mô tả ngắn không được để trống'
        if (!contentRef.current.trim()) newErrors.content = 'Nội dung không được để trống'

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            toast.error('Vui lòng kiểm tra lại các thông tin còn thiếu')
            return
        }

        setLoading(true)

        try {
            const defaultImage = '/images/default-post.png'
            let featured_image = defaultImage

            // Upload images if exist
            if (files.thumbnail) {
                featured_image = await uploadImage(files.thumbnail)
            }

            const payload = {
                title: formData.title,
                description: formData.description,
                content: contentRef.current,
                post_type: formData.type,
                status: formData.status,
                audience: formData.audience,
                published_at: formData.publishDate || new Date().toISOString(),
                featured_image,
                banner_image: featured_image, // Pass the same image to DB
                thumbnail_position: thumbnailPosition,
            }

            const res = await fetch('/api/truyenthong/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })

            if (res.status === 409) {
                const data = await res.json()
                toast.error(data.error || 'Tiêu đề bài viết đã tồn tại')
                return
            }

            if (!res.ok) throw new Error('Failed to create post')

            toast.success('Bài viết đã được tạo thành công!')
            router.push('/admin/truyenthong')
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra khi tạo bài viết')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full px-4 lg:px-6 py-5 space-y-5">
            {/* Crop Modal */}
            {showCropper && thumbnailPreview && (
                <ThumbnailCropper
                    src={thumbnailPreview}
                    initialCrop={thumbnailPosition}
                    onSave={(cropJson) => {
                        setThumbnailPosition(cropJson)
                        setShowCropper(false)
                    }}
                    onCancel={() => setShowCropper(false)}
                />
            )}
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                <Link href="/admin/truyenthong">
                    <Button variant="ghost" size="sm" className="gap-2 hover:bg-gray-100 transition-all hover:-translate-x-0.5">
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại
                    </Button>
                </Link>
                <div className="h-5 w-px bg-gray-300" />
                <h2 className="text-xl font-bold text-gray-900">Tạo bài viết mới</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Basic Info */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3">
                                <h3 className="text-sm font-bold text-gray-900">Thông tin cơ bản</h3>
                            </div>
                            <div className="space-y-4 p-5">
                                <div className="space-y-2">
                                    <Label htmlFor="title" className={`text-sm font-semibold ${errors.title ? 'text-red-500' : 'text-gray-700'}`}>Tiêu đề</Label>
                                    <Input
                                        id="title"
                                        placeholder="Nhập tiêu đề bài viết"
                                        value={formData.title}
                                        onChange={e => {
                                            setFormData({ ...formData, title: e.target.value })
                                            if (errors.title) setErrors({ ...errors, title: '' })
                                        }}
                                        className={`h-10 ${errors.title ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                                    />
                                    {errors.title && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1">
                                            <AlertCircle className="w-3 h-3" />
                                            <span className="text-xs">{errors.title}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description" className={`text-sm font-semibold ${errors.description ? 'text-red-500' : 'text-gray-700'}`}>Mô tả ngắn</Label>
                                    <Input
                                        id="description"
                                        placeholder="Nhập mô tả ngắn (1-2 dòng)"
                                        value={formData.description}
                                        onChange={e => {
                                            setFormData({ ...formData, description: e.target.value })
                                            if (errors.description) setErrors({ ...errors, description: '' })
                                        }}
                                        className={`h-10 ${errors.description ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                                    />
                                    {errors.description && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1">
                                            <AlertCircle className="w-3 h-3" />
                                            <span className="text-xs">{errors.description}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="content" className={`text-sm font-semibold ${errors.content ? 'text-red-500' : 'text-gray-700'}`}>Nội dung bài viết</Label>
                                    <RichTextEditor
                                        content={formData.content}
                                        onChange={(html) => {
                                            contentRef.current = html
                                            if (errors.content) setErrors({ ...errors, content: '' })
                                        }}
                                        error={errors.content}
                                    />
                                    {errors.content && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1">
                                            <AlertCircle className="w-3 h-3" />
                                            <span className="text-xs">{errors.content}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Media */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Hình ảnh
                                </h3>
                            </div>
                            <div className="space-y-5 p-5">
                                {/* Thumbnail Upload */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                                        Hình đại diện (Thumbnail)
                                    </Label>
                                    <div 
                                        tabIndex={0} 
                                        onPaste={handlePaste} 
                                        className="group focus:outline-none focus-within:ring-2 focus-within:ring-blue-500/50 rounded-xl transition-all"
                                    >
                                        {thumbnailPreview ? (
                                            <div className="space-y-3">
                                                <div className="relative">
                                                    {/* Preview thumbnail — click để mở crop modal */}
                                                    <div
                                                        className="rounded-xl border-2 border-gray-200 bg-gray-100 cursor-pointer group overflow-hidden"
                                                        style={{ aspectRatio: '16/9', position: 'relative' }}
                                                        onClick={() => setShowCropper(true)}
                                                        title="Nhấn để chỉnh vùng hiển thị"
                                                    >
                                                        <CroppedImage
                                                            src={thumbnailPreview}
                                                            alt="Thumbnail preview"
                                                            cropData={thumbnailPosition}
                                                            style={{ position: 'absolute', inset: 0 }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
                                                            <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm font-semibold">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" /></svg>
                                                                Chỉnh vùng hiển thị
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {/* Nút xóa */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPreviousThumbnail(thumbnailPreview)
                                                            setPreviousThumbnailFile(files.thumbnail)
                                                            setThumbnailPreview('')
                                                            setFiles(prev => ({ ...prev, thumbnail: null }))
                                                            setThumbnailPosition('50% 50%')
                                                            toast.success('Đã xóa ảnh thumbnail. Nhấn Ctrl+Z để khôi phục')
                                                        }}
                                                        className="absolute -top-2 -right-2 z-10 p-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 hover:from-blue-50 hover:to-indigo-50 transition-all">
                                                <div className="text-center">
                                                    <svg className="w-12 h-12 text-blue-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <p className="text-sm font-semibold text-gray-700 mb-1">Chọn hoặc dán ảnh gốc / cover</p>
                                                    <p className="text-xs text-gray-500 mb-3">
                                                        <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">Ctrl</kbd>
                                                        {' + '}
                                                        <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">V</kbd>
                                                        {' để dán ảnh'}
                                                    </p>
                                                    <p className="text-xs text-gray-400">JPG, PNG, GIF (tối đa 5MB)</p>
                                                </div>
                                            </div>
                                        )}
                                        <Input
                                            id="thumbnail"
                                            type="file"
                                            accept="image/*"
                                            onChange={e => {
                                                const file = e.target.files?.[0]
                                                if (file) handleImageFile(file)
                                            }}
                                            className="mt-2 h-10 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-5">
                        {/* Type & Status */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3">
                                <h3 className="text-sm font-bold text-gray-900">Cài đặt</h3>
                            </div>
                            <div className="space-y-4 p-5">
                                <div className="space-y-2">
                                    <Label htmlFor="type" className="text-sm font-semibold text-gray-700">Loại bài viết</Label>
                                    <select
                                        id="type"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-sm"
                                    >
                                        <option value="tin-tức">Tin tức</option>
                                        <option value="chính-sách">Chính sách</option>
                                        <option value="sự-kiện">Sự kiện</option>
                                        <option value="đào-tạo">Đào tạo</option>
                                        <option value="báo-cáo">Báo cáo</option>
                                        <option value="thông-báo">Thông báo</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="audience" className="text-sm font-semibold text-gray-700">Đối tượng xem</Label>
                                    <select
                                        id="audience"
                                        value={formData.audience}
                                        onChange={e =>
                                            setFormData({ ...formData, audience: e.target.value })
                                        }
                                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-sm"
                                    >
                                        <option value="toàn-công-ty">Toàn công ty</option>
                                        <option value="bộ-phận-hr">Bộ phận HR</option>
                                        <option value="quản-lý">Quản lý cấp cao</option>
                                        <option value="kỹ-thuật">Bộ phận kỹ thuật</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="status" className="text-sm font-semibold text-gray-700">Trạng thái</Label>
                                    <select
                                        id="status"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-sm"
                                    >
                                        <option value="draft">Nháp</option>
                                        <option value="published">Công bố</option>
                                        <option value="hidden">Ẩn</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="publishDate" className="text-sm font-semibold text-gray-700">
                                        Ngày đăng <span className="text-xs text-gray-400 font-normal">(để trống = hiện tại)</span>
                                    </Label>
                                    <Input
                                        id="publishDate"
                                        type="datetime-local"
                                        value={formData.publishDate}
                                        onChange={e => setFormData({ ...formData, publishDate: e.target.value })}
                                        className="h-10 border-gray-300"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2.5 p-4 bg-white border rounded-xl shadow-sm border-gray-200">
                            <Button type="submit" className="w-full h-11 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all hover:shadow-lg" disabled={loading}>
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Lưu bài viết
                            </Button>
                            <Link href="/admin/truyenthong" className="w-full">
                                <Button type="button" variant="outline" className="w-full h-11 text-sm hover:bg-gray-100 hover:border-gray-300 transition-all font-semibold">
                                    Hủy bỏ
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}
