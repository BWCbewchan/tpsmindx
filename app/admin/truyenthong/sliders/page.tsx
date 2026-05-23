'use client'

import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Clock, Edit2, Eye, EyeOff, GripVertical, Image as ImageIcon, List, Plus, Settings, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'
import { toast } from '@/lib/app-toast'

interface Slider {
    id: string
    title: string
    order: number
    status: 'active' | 'inactive'
    duration: number
    autoPlay: boolean
    slideCount: number
}

const mockSliders: Slider[] = [
    {
        id: '1',
        title: 'Slider chính trang chủ',
        order: 1,
        status: 'active',
        duration: 5000,
        autoPlay: true,
        slideCount: 5,
    },
    {
        id: '2',
        title: 'Slider khuyến mãi mùa hè',
        order: 2,
        status: 'active',
        duration: 7000,
        autoPlay: true,
        slideCount: 3,
    },
    {
        id: '3',
        title: 'Slider sự kiện công ty',
        order: 3,
        status: 'inactive',
        duration: 5000,
        autoPlay: false,
        slideCount: 4,
    },
]

export default function SlidersManagementPage() {
    const [sliders, setSliders] = useState<Slider[]>(mockSliders)
    const [autoPlayEnabled, setAutoPlayEnabled] = useState(true)
    const [globalDuration, setGlobalDuration] = useState(5000)
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [newSlider, setNewSlider] = useState({
        title: '',
        duration: 5000,
        autoPlay: true,
    })

    const handleCreateSlider = () => {
        if (!newSlider.title.trim()) {
            toast.error('Vui lòng nhập tiêu đề slider')
            return
        }

        const slider: Slider = {
            id: Date.now().toString(),
            title: newSlider.title,
            order: sliders.length + 1,
            status: 'active',
            duration: newSlider.duration,
            autoPlay: newSlider.autoPlay,
            slideCount: 0,
        }

        setSliders([...sliders, slider])
        setIsCreateModalOpen(false)
        setNewSlider({ title: '', duration: 5000, autoPlay: true })
    }

    const handleDelete = (id: string) => {
        if (confirm('Bạn có chắc chắn muốn xóa slider này?')) {
            setSliders(sliders.filter(s => s.id !== id))
        }
    }

    const handleToggleStatus = (id: string) => {
        setSliders(
            sliders.map(s =>
                s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s
            )
        )
    }

    const handleDragStart = (id: string) => {
        setDraggedId(id)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = (targetId: string) => {
        if (draggedId && draggedId !== targetId) {
            const draggedIndex = sliders.findIndex(s => s.id === draggedId)
            const targetIndex = sliders.findIndex(s => s.id === targetId)

            const newSliders = [...sliders]
                ;[newSliders[draggedIndex], newSliders[targetIndex]] = [
                    newSliders[targetIndex],
                    newSliders[draggedIndex],
                ]

            newSliders.forEach((slider, idx) => {
                slider.order = idx + 1
            })

            setSliders(newSliders)
            setDraggedId(null)
        }
    }

    return (
        <PageContainer
            title="Quản lý Slider"
            description={`Tổng cộng ${sliders.length} slider`}
        >
            <div className="flex items-center justify-between mb-6">
                <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link href="/admin/truyenthong">
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại
                    </Link>
                </Button>
                <Button variant="mindx" className="gap-2 shadow-sm font-semibold" onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Tạo slider mới
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Settings Panel */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-4">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-gray-600" />
                                Cài đặt chung
                            </h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoPlayEnabled}
                                        onChange={e => setAutoPlayEnabled(e.target.checked)}
                                        className="rounded w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="font-semibold text-gray-700">Tự động chạy slider</span>
                                </Label>
                                <p className="text-xs text-gray-500 ml-6">Áp dụng cho tất cả slider mới</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="duration" className="text-sm font-semibold text-gray-700">
                                    Thời gian chuyển slide
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="duration"
                                        type="number"
                                        value={globalDuration}
                                        onChange={e => setGlobalDuration(Number(e.target.value))}
                                        min="1000"
                                        step="500"
                                        className="h-10 pr-12"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">ms</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    = {(globalDuration / 1000).toFixed(1)} giây
                                </p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    💡 Cài đặt này sẽ áp dụng cho slider mới. Slider cũ giữ nguyên cấu hình.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sliders List */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <List className="w-5 h-5 text-gray-600" />
                                Danh sách Slider
                            </h3>
                        </div>
                        <div className="p-4">
                            {sliders.length === 0 ? (
                                <div className="text-center py-12">
                                    <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-600 font-semibold mb-1">Chưa có slider nào</p>
                                    <p className="text-sm text-gray-500">Tạo slider đầu tiên để bắt đầu</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {sliders.map(slider => (
                                        <div
                                            key={slider.id}
                                            draggable
                                            onDragStart={() => handleDragStart(slider.id)}
                                            onDragOver={handleDragOver}
                                            onDrop={() => handleDrop(slider.id)}
                                            className={`flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all cursor-move group ${draggedId === slider.id ? 'opacity-50 scale-95' : ''
                                                }`}
                                        >
                                            <GripVertical className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />

                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                                    {slider.title}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded font-semibold">#{slider.order}</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {slider.duration / 1000}s
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <ImageIcon className="w-3 h-3" />
                                                        {slider.slideCount} slides
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${slider.status === 'active'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {slider.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                                                </span>

                                                <div className="flex bg-gray-50 rounded-lg border border-gray-200 p-0.5">
                                                    <button
                                                        onClick={() => handleToggleStatus(slider.id)}
                                                        className="h-7 w-7 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                                        title={slider.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}
                                                    >
                                                        {slider.status === 'active' ? (
                                                            <Eye className="w-4 h-4" />
                                                        ) : (
                                                            <EyeOff className="w-4 h-4" />
                                                        )}
                                                    </button>

                                                    <button
                                                        className="h-7 w-7 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(slider.id)}
                                                        className="h-7 w-7 flex items-center justify-center hover:bg-red-50 hover:text-red-600 rounded transition-colors cursor-pointer"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-4 text-xs text-gray-500 bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                💡 <span className="font-semibold">Mẹo:</span> Kéo và thả để sắp xếp thứ tự hiển thị slider. Slider ở trên cùng sẽ được hiển thị trước.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Slider Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between sticky top-0">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                Tạo Slider Mới
                            </h3>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-white/80 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="slider-title" className="text-sm font-semibold text-gray-700">
                                    Tiêu đề Slider <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="slider-title"
                                    type="text"
                                    placeholder="VD: Slider khuyến mãi tháng 2"
                                    value={newSlider.title}
                                    onChange={e => setNewSlider({ ...newSlider, title: e.target.value })}
                                    className="h-10"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="slider-duration" className="text-sm font-semibold text-gray-700">
                                    Thời gian chuyển slide
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="slider-duration"
                                        type="number"
                                        value={newSlider.duration}
                                        onChange={e => setNewSlider({ ...newSlider, duration: Number(e.target.value) })}
                                        min="1000"
                                        step="500"
                                        className="h-10 pr-12"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">ms</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    = {(newSlider.duration / 1000).toFixed(1)} giây
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newSlider.autoPlay}
                                        onChange={e => setNewSlider({ ...newSlider, autoPlay: e.target.checked })}
                                        className="rounded w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="font-semibold text-gray-700">Tự động chạy slider</span>
                                </Label>
                                <p className="text-xs text-gray-500 ml-6">Slider sẽ tự động chuyển sau mỗi khoảng thời gian</p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    💡 Sau khi tạo slider, bạn có thể thêm các slide ảnh vào slider này từ trang chỉnh sửa.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 h-10"
                                >
                                    Hủy
                                </Button>
                                <Button
                                    onClick={handleCreateSlider}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-10 shadow-sm"
                                >
                                    Tạo Slider
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    )
}
