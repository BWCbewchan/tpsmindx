'use client'

import { useAuth } from '@/lib/auth-context'
import { PageContainer } from '@/components/PageContainer'
import { 
    Mail, 
    Award,
    Shield,
    Upload,
    X,
    Image as ImageIcon,
    Camera,
    Calendar,
    Eye,
    EyeOff
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'

interface PrivacySettings {
    id: number
    teacher_email: string
    show_birthday: boolean
    show_on_public_list: boolean
    show_phone: boolean
    show_personal_email: boolean
    created_at: string
    updated_at: string
}

const BIRTHDAY_PRIVACY_SYNC_KEY = 'birthday-privacy-updated-at'

export default function AdminProfilePage() {
    const { user, token } = useAuth()
    
    // Setup for APIs
    const fetcher = useMemo(
        () => (url: string) =>
            fetch(url, { headers: authHeaders(token) }).then((r) => r.json()),
        [token],
    )

    // Avatar state
    const [showAvatarModal, setShowAvatarModal] = useState(false)
    const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const [avatarSource, setAvatarSource] = useState<'upload' | 'camera'>('upload')
    const [cameraError, setCameraError] = useState<string | null>(null)
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const cameraStreamRef = useRef<MediaStream | null>(null)

    // Fetch avatar
    const { data: avatarData, mutate: mutateAvatar } = useSWR(
        user?.email ? '/api/teacher-avatar' : null,
        fetcher,
    )
    const avatarUrl = avatarData?.data?.avatar_url || null

    // Fetch privacy settings
    const { data: privacyData, mutate: mutatePrivacy } = useSWR(
        user?.email ? `/api/teacher-privacy?email=${user.email}` : null,
        fetcher,
    )
    const privacySettings = privacyData?.data

    useEffect(() => {
        if (!showAvatarModal) {
            stopCamera()
            resetAvatarSelection()
            return
        }

        if (avatarSource === 'camera') {
            void startCamera()
        } else {
            stopCamera()
        }
    }, [showAvatarModal, avatarSource])

    useEffect(() => {
        return () => {
            stopCamera()
        }
    }, [])

    const stopCamera = () => {
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach((track) => track.stop())
            cameraStreamRef.current = null
        }
    }

    const startCamera = async () => {
        try {
            stopCamera()
            setCameraError(null)
            if (!navigator?.mediaDevices?.getUserMedia) {
                const message = 'Trình duyệt không hỗ trợ camera'
                setCameraError(message)
                toast.error(message)
                return
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
            })
            cameraStreamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }
        } catch (error) {
            console.error('Camera error:', error)
            const err = error as { name?: string; message?: string }
            const message =
                err?.name === 'NotAllowedError'
                    ? 'Bạn cần cấp quyền camera để chụp ảnh'
                    : err?.name === 'NotFoundError'
                        ? 'Không tìm thấy camera trên thiết bị'
                        : 'Không thể truy cập camera'
            setCameraError(message)
            toast.error(message)
        }
    }

    const validateAvatarFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            return 'File phải là hình ảnh'
        }

        if (file.size > 5 * 1024 * 1024) {
            return 'Kích thước ảnh tối đa 5MB'
        }

        return null
    }

    const resetAvatarSelection = () => {
        if (avatarPreviewUrl) {
            URL.revokeObjectURL(avatarPreviewUrl)
        }
        setAvatarPreviewUrl(null)
        setSelectedAvatarFile(null)
    }

    const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const validationError = validateAvatarFile(file)
        if (validationError) {
            toast.error(validationError)
            resetAvatarSelection()
            return
        }

        resetAvatarSelection()
        setSelectedAvatarFile(file)
        setAvatarPreviewUrl(URL.createObjectURL(file))
    }

    const handleCaptureFromCamera = async () => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480

        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
            if (!blob) return
            const file = new File([blob], `avatar-${Date.now()}.jpg`, {
                type: 'image/jpeg',
            })
            resetAvatarSelection()
            setSelectedAvatarFile(file)
            setAvatarPreviewUrl(URL.createObjectURL(file))
            stopCamera()
        }, 'image/jpeg', 0.92)
    }

    const handleUploadAvatar = async () => {
        if (!selectedAvatarFile) {
            toast.error('Vui lòng chọn ảnh đại diện')
            return
        }

        const validationError = validateAvatarFile(selectedAvatarFile)
        if (validationError) {
            toast.error(validationError)
            return
        }

        setIsUploadingAvatar(true)
        const toastId = toast.loading('Đang tải ảnh đại diện...')

        try {
            const formData = new FormData()
            formData.append('image', selectedAvatarFile)

            const response = await fetch('/api/teacher-avatar', {
                method: 'POST',
                headers: authHeaders(token),
                body: formData,
            })

            if (!response.ok) throw new Error('Failed to upload avatar')

            toast.success('Cập nhật ảnh đại diện thành công', { id: toastId })
            await mutateAvatar()
            setShowAvatarModal(false)
            resetAvatarSelection()
            stopCamera()
        } catch (error) {
            console.error('Upload avatar error:', error)
            toast.error('Lỗi khi tải ảnh đại diện', { id: toastId })
        } finally {
            setIsUploadingAvatar(false)
        }
    }

    // Privacy toggles
    const handlePrivacyToggle = async (
        setting: keyof Omit<
            PrivacySettings,
            'id' | 'teacher_email' | 'created_at' | 'updated_at'
        >,
    ) => {
        if (!user?.email || !privacySettings) return

        const newValue = !privacySettings[setting]
        const toastId = toast.loading('Đang cập nhật...')

        try {
            const response = await fetch('/api/teacher-privacy', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacher_email: user.email,
                    ...privacySettings,
                    [setting]: newValue,
                }),
            })

            if (!response.ok) throw new Error('Failed to update')

            toast.success('Đã cập nhật cài đặt', { id: toastId })
            mutatePrivacy()

            // Invalidate birthdays cache nếu thay đổi show_birthday
            if (setting === 'show_birthday') {
                console.log('[Privacy] show_birthday changed, invalidating cache...')
                window.localStorage.setItem(
                    BIRTHDAY_PRIVACY_SYNC_KEY,
                    String(Date.now()),
                )

                try {
                    await fetch('/api/birthdays/invalidate', { method: 'POST' })
                    console.log('[Privacy] Cache invalidated successfully')
                } catch (err) {
                    console.warn('[Privacy] Failed to invalidate cache:', err)
                }

                // Dispatch event để sidebar revalidate dữ liệu
                console.log('[Privacy] Dispatching privacy-setting-changed event')
                window.dispatchEvent(new CustomEvent('privacy-setting-changed'))
            }
        } catch (error) {
            console.error('Update privacy error:', error)
            toast.error('Lỗi khi cập nhật', { id: toastId })
        }
    }

    if (!user) return null

    // Using privacy data as readiness check, similar to user profile
    const isLoading = !privacyData

    if (isLoading) {
        return <PageSkeleton variant="form" itemCount={4} showHeader={true} />
    }

    return (
        <PageContainer padding="lg">
            <div className="w-full space-y-8">
                
                {/* Profile Header */}
                <div className="bg-[#a1001f] rounded-3xl p-8 text-white shadow-2xl">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="relative w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center shadow-2xl overflow-hidden">
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt="Avatar"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="text-4xl font-bold text-white">
                                        {user.displayName
                                            ? user.displayName.charAt(0).toUpperCase()
                                            : user.email?.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAvatarModal(true)}
                                className="absolute bottom-0 right-0 w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                            >
                                <Upload className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Info */}
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-black mb-2">{user.displayName || user.email?.split('@')[0]}</h1>
                            <div className="flex flex-col md:flex-row gap-4 text-white/90">
                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                    <Mail className="w-5 h-5" />
                                    <span className="font-medium">{user.email}</span>
                                </div>
                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                    <Shield className="w-5 h-5" />
                                    <span className="font-semibold capitalize text-yellow-300">
                                        {user.role?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
                                <Award className="w-5 h-5" />
                                <span className="text-sm font-medium">Quyền truy cập: {user.isAdmin ? 'Có (Admin Panel)' : 'Giới hạn'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Privacy Settings Section */}
                <div className="bg-white rounded-3xl shadow-xl border border-[#f1d1d8] overflow-hidden">
                    <div className="p-6 border-b border-[#f1d1d8] bg-[#fff5f7]">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 min-h-12 min-w-12 shrink-0 rounded-xl bg-[#a1001f] shadow-lg flex items-center justify-center">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black leading-tight text-gray-900">
                                Cài đặt quyền riêng tư
                            </h2>
                        </div>
                        <p className="mt-2 text-sm text-gray-500 font-medium">
                            Kiểm soát thông tin hiển thị trên trang truyền thông
                        </p>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Show Birthday Toggle */}
                        <div className="flex flex-col gap-3 p-4 bg-[#fff5f7] rounded-xl border border-[#f1d1d8] hover:border-[#d47a8b] transition-all sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4 sm:pr-4">
                                <div className="w-10 h-10 bg-[#f9e2e8] rounded-lg flex items-center justify-center shrink-0">
                                    <Calendar className="w-5 h-5 text-[#a1001f]" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 mb-1">
                                        Hiển thị sinh nhật
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Cho phép hiển thị sinh nhật của bạn trong sidebar
                                        &ldquo;Sinh nhật tháng&rdquo; trên trang truyền thông
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePrivacyToggle('show_birthday')}
                                disabled={!privacySettings}
                                aria-label="Bật/tắt hiển thị sinh nhật"
                                className={`relative inline-flex h-9 w-16 self-end items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a1001f] focus:ring-offset-2 disabled:opacity-50 sm:h-8 sm:w-14 sm:self-center ${
                                    privacySettings?.show_birthday
                                        ? 'bg-[#a1001f]'
                                        : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-transform sm:h-6 sm:w-6 ${
                                        privacySettings?.show_birthday
                                            ? 'translate-x-8 sm:translate-x-7'
                                            : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Show on Public List Toggle */}
                        <div className="flex flex-col gap-3 p-4 bg-[#fff5f7] rounded-xl border border-[#f1d1d8] hover:border-[#d47a8b] transition-all sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4 sm:pr-4">
                                <div className="w-10 h-10 bg-[#f9e2e8] rounded-lg flex items-center justify-center shrink-0">
                                    {privacySettings?.show_on_public_list ? (
                                        <Eye className="w-5 h-5 text-[#a1001f]" />
                                    ) : (
                                        <EyeOff className="w-5 h-5 text-[#a1001f]" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 mb-1">
                                        Hiển thị trong danh sách công khai
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Cho phép hiển thị thông tin của bạn trong danh sách giáo
                                        viên công khai
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePrivacyToggle('show_on_public_list')}
                                disabled={!privacySettings}
                                aria-label="Bật/tắt hiển thị trong danh sách công khai"
                                className={`relative inline-flex h-9 w-16 self-end items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a1001f] focus:ring-offset-2 disabled:opacity-50 sm:h-8 sm:w-14 sm:self-center ${
                                    privacySettings?.show_on_public_list
                                        ? 'bg-[#a1001f]'
                                        : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-transform sm:h-6 sm:w-6 ${
                                        privacySettings?.show_on_public_list
                                            ? 'translate-x-8 sm:translate-x-7'
                                            : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Show Phone Toggle */}
                        <div className="flex flex-col gap-3 p-4 bg-[#fff5f7] rounded-xl border border-[#f1d1d8] hover:border-[#d47a8b] transition-all sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4 sm:pr-4">
                                <div className="w-10 h-10 bg-[#f9e2e8] rounded-lg flex items-center justify-center shrink-0">
                                    <Mail className="w-5 h-5 text-[#a1001f]" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 mb-1">
                                        Hiển thị số điện thoại
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Cho phép hiển thị số điện thoại của bạn công khai (nếu có)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePrivacyToggle('show_phone')}
                                disabled={!privacySettings}
                                aria-label="Bật/tắt hiển thị số điện thoại"
                                className={`relative inline-flex h-9 w-16 self-end items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a1001f] focus:ring-offset-2 disabled:opacity-50 sm:h-8 sm:w-14 sm:self-center ${
                                    privacySettings?.show_phone ? 'bg-[#a1001f]' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-transform sm:h-6 sm:w-6 ${
                                        privacySettings?.show_phone
                                            ? 'translate-x-8 sm:translate-x-7'
                                            : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Show Personal Email Toggle */}
                        <div className="flex flex-col gap-3 p-4 bg-[#fff5f7] rounded-xl border border-[#f1d1d8] hover:border-[#d47a8b] transition-all sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4 sm:pr-4">
                                <div className="w-10 h-10 bg-[#f9e2e8] rounded-lg flex items-center justify-center shrink-0">
                                    <Mail className="w-5 h-5 text-[#a1001f]" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 mb-1">
                                        Hiển thị email cá nhân
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Cho phép hiển thị email cá nhân của bạn (khác với email công
                                        ty)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePrivacyToggle('show_personal_email')}
                                disabled={!privacySettings}
                                aria-label="Bật/tắt hiển thị email cá nhân"
                                className={`relative inline-flex h-9 w-16 self-end items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a1001f] focus:ring-offset-2 disabled:opacity-50 sm:h-8 sm:w-14 sm:self-center ${
                                    privacySettings?.show_personal_email
                                        ? 'bg-[#a1001f]'
                                        : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-transform sm:h-6 sm:w-6 ${
                                        privacySettings?.show_personal_email
                                            ? 'translate-x-8 sm:translate-x-7'
                                            : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        <div className="mt-6 p-4 bg-[#fff5f7] border border-[#f1d1d8] rounded-xl">
                            <div className="flex gap-3">
                                <Shield className="w-5 h-5 text-[#a1001f] shrink-0 mt-0.5" />
                                <div className="text-sm text-[#6b1223]">
                                    <p className="font-semibold mb-1">Lưu ý về quyền riêng tư</p>
                                    <p>
                                        Các cài đặt này chỉ ảnh hưởng đến thông tin hiển thị trên
                                        trang truyền thông công khai. Quản lý và ban lãnh đạo vẫn có
                                        thể truy cập thông tin đầy đủ của bạn.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Permissions Section */}
                <div className="bg-white rounded-3xl p-8 shadow-xl border border-[#f1d1d8]">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
                        <Shield className="w-6 h-6 text-[#a1001f]" />
                        Màn hình & Tính năng được cấp quyền
                    </h2>
                    <p className="text-gray-600 mb-6">Tài khoản này được cấu hình với vai trò <strong>{user.role}</strong>. Dưới đây là danh sách các màn hình hệ thống mà bạn được cấp quyền truy cập:</p>
                    
                    {user.permissions && user.permissions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {user.permissions.map((perm, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-[#fff5f7] rounded-xl border border-[#f6e3e7] hover:border-[#d47a8b] hover:shadow-sm transition-all duration-300">
                                    <div className="w-2 h-2 rounded-full bg-[#a1001f]" />
                                    <code className="text-sm font-semibold text-gray-800 break-all">{perm}</code>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 bg-[#fff5f7] text-[#6b1223] rounded-xl border border-[#f1d1d8]">
                            Không tìm thấy phân quyền cụ thể nào cho tài khoản của bạn.
                        </div>
                    )}
                    
                    <div className="mt-8 pt-6 border-t border-[#f1d1d8]">
                        <p className="text-sm text-gray-500 italic">Nếu cần thay đổi thông tin cá nhân hoặc vai trò, vui lòng liên hệ Super Admin hoặc bộ phận kỹ thuật.</p>
                    </div>
                </div>
            </div>

            {/* Avatar Upload Modal */}
            {showAvatarModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start pt-20 sm:items-center sm:justify-center sm:pt-0 justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 z-10 bg-[#a1001f] p-6 border-b border-[#870019] flex items-center justify-between">
                            <h2 className="text-2xl font-black text-white">
                                Cập nhật ảnh đại diện
                            </h2>
                            <button
                                onClick={() => {
                                    setShowAvatarModal(false)
                                    setAvatarSource('upload')
                                    stopCamera()
                                    resetAvatarSelection()
                                }}
                                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAvatarSource('upload')}
                                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                                        avatarSource === 'upload'
                                            ? 'border-[#a1001f] bg-[#fff5f7] text-[#a1001f]'
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <ImageIcon className="w-4 h-4" />
                                    Tải ảnh lên
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAvatarSource('camera')}
                                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                                        avatarSource === 'camera'
                                            ? 'border-[#a1001f] bg-[#fff5f7] text-[#a1001f]'
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <Camera className="w-4 h-4" />
                                    Chụp ảnh
                                </button>
                            </div>

                            <div className="rounded-2xl border border-dashed border-gray-300 p-4">
                                {avatarPreviewUrl ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="relative h-40 w-40 overflow-hidden rounded-full border border-gray-200">
                                            <img
                                                src={avatarPreviewUrl}
                                                alt="Preview"
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={resetAvatarSelection}
                                            className="text-sm font-semibold text-gray-600 hover:text-gray-800"
                                        >
                                            Chọn lại ảnh
                                        </button>
                                    </div>
                                ) : avatarSource === 'upload' ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <input
                                            ref={avatarInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarFileChange}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => avatarInputRef.current?.click()}
                                            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:border-[#a1001f] hover:bg-[#fff5f7]"
                                        >
                                            Chọn ảnh từ máy (tối đa 5MB)
                                        </button>
                                        <p className="text-xs text-gray-500">
                                            Hỗ trợ JPG, PNG, WEBP
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        {cameraError && (
                                            <div className="w-full rounded-xl border border-[#f1d1d8] bg-[#fff5f7] p-3 text-sm text-[#6b1223]">
                                                <p className="font-semibold">Không thể mở camera</p>
                                                <p className="mt-1">
                                                    {cameraError}. Hãy cấp quyền camera trong trình duyệt
                                                    và thử lại. Lưu ý: camera chỉ hoạt động trên HTTPS
                                                    hoặc localhost.
                                                </p>
                                            </div>
                                        )}
                                        <video
                                            ref={videoRef}
                                            className="w-full max-w-sm rounded-2xl bg-gray-100"
                                            playsInline
                                            muted
                                        />
                                        <canvas ref={canvasRef} className="hidden" />
                                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                                            <button
                                                type="button"
                                                onClick={() => void startCamera()}
                                                className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                            >
                                                Bật lại camera
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCaptureFromCamera}
                                                className="flex-1 rounded-xl bg-[#a1001f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#870019]"
                                            >
                                                Chụp ảnh
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-[#f1d1d8] pt-4">
                                <Button
                                    type="button"
                                    onClick={handleUploadAvatar}
                                    disabled={isUploadingAvatar || !selectedAvatarFile}
                                    className="w-full bg-[#a1001f] hover:bg-[#870019] text-white"
                                >
                                    {isUploadingAvatar ? 'Đang cập nhật...' : 'Lưu ảnh đại diện'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    )
}