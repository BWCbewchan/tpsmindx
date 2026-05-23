'use client'

import CroppedImage from '@/components/CroppedImage'
import { cn } from '@/lib/utils'
import { ArrowUpRight, Clock, Eye } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface Post {
    id: string | number
    slug: string
    title: string
    description: string
    featured_image: string
    thumbnail_position?: string
    post_type: string
    published_at: string
    view_count: number
}

const typeMap: Record<string, { label: string, color: string }> = {
    'tin-tức': { label: 'Tin tức', color: 'text-blue-600 bg-blue-50' },
    'chính-sách': { label: 'Chính sách', color: 'text-purple-600 bg-purple-50' },
    'sự-kiện': { label: 'Sự kiện', color: 'text-green-600 bg-green-50' },
    'đào-tạo': { label: 'Đào tạo', color: 'text-orange-600 bg-orange-50' },
    'báo-cáo': { label: 'Báo cáo', color: 'text-red-600 bg-red-50' },
    'thông-báo': { label: 'Thông báo', color: 'text-gray-600 bg-gray-50' },
}

export default function PostCard({
    post,
    detailBasePath = '/user/truyenthong',
}: {
    post: Post
    /** Ví dụ `/admin/truyenthong/posts` để xem bài trong admin */
    detailBasePath?: string
}) {
    const [isHovered, setIsHovered] = useState(false)

    const publishDate = new Date(post.published_at).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    })

    const typeInfo = typeMap[post.post_type] || { label: post.post_type, color: 'text-gray-600 bg-gray-50' }

    return (
        <Link
            href={`${detailBasePath}/${post.slug}`}
            className="group block h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <article className="flex flex-col h-full bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl border border-gray-100/50">
                {/* Image Container with Zoom Effect */}
                <div className={cn(
                    "relative aspect-[16/9] overflow-hidden bg-gray-100 transition-transform duration-700 ease-out",
                    isHovered ? "scale-105" : "scale-100"
                )}>
                    <CroppedImage
                        src={post.featured_image || '/placeholder.svg'}
                        alt={post.title}
                        cropData={post.thumbnail_position}
                        style={{ position: 'absolute', inset: 0 }}
                    />

                    {/* Overlay on hover */}
                    <div className={cn(
                        "absolute inset-0 bg-black/10 transition-opacity duration-300",
                        isHovered ? "opacity-100" : "opacity-0"
                    )} />

                    {/* Category Tag - Floating */}
                    <div className="absolute top-4 left-4">
                        <span className={cn(
                            "px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full backdrop-blur-md shadow-sm transition-all duration-300",
                            "bg-white/90 text-gray-900 border border-white/20"
                        )}>
                            {typeInfo.label}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-5 md:p-6">
                    {/* Meta Top */}
                    <div className="flex items-center gap-3 text-xs font-medium text-gray-400 mb-3">
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{publishDate}</span>
                        </div>
                    </div>

                    {/* Title */}
                    <h3 className={cn(
                        "font-bold text-lg leading-snug text-gray-900 mb-3 line-clamp-2 transition-colors duration-300",
                        isHovered ? "text-blue-600" : ""
                    )}>
                        {post.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed font-light">
                        {post.description}
                    </p>

                    {/* Footer - "Read More" and Stats */}
                    <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                            Đọc tiếp
                            <ArrowUpRight className={cn(
                                "w-3 h-3 transition-transform duration-300",
                                isHovered ? "translate-x-0.5 -translate-y-0.5" : ""
                            )} />
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Eye className="w-3.5 h-3.5" />
                            <span>{post.view_count.toLocaleString('vi-VN')}</span>
                        </div>
                    </div>
                </div>
            </article>
        </Link>
    )
}
