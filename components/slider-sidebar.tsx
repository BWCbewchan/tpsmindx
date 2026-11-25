'use client'

import { Eye } from 'lucide-react'
import Link from 'next/link'
import { normalizeStorageUrl } from '@/lib/storage-url'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { HonorsSummary as HonorsTab } from './honors-summary'

interface Post {
    id: string | number
    slug: string
    title: string
    featured_image?: string
    banner_image?: string
    post_type: string
    view_count: number
    published_at: string
}

const POST_TYPE_LABELS: Record<string, string> = {
    'tin-tức': 'Tin tức',
    'chính-sách': 'Chính sách',
    'sự-kiện': 'Sự kiện',
    'đào-tạo': 'Đào tạo',
    'báo-cáo': 'Báo cáo',
    'thông-báo': 'Thông báo',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SliderSidebar({ posts, onOpenPopup }: { posts: Post[]; onOpenPopup?: () => void }) {
    const [activeTab, setActiveTab] = useState<'hot' | 'honors'>('hot')

    return (
        <div className="h-full max-h-full bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
            <div className="flex shrink-0 gap-6 border-b border-border bg-card px-4">
                <button type="button" aria-pressed={activeTab === 'hot'} onClick={() => setActiveTab('hot')}
                    className={cn('min-h-11 border-b-2 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', activeTab === 'hot' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
                    Đang hot
                </button>
                <button type="button" id="tab-vinh-danh" aria-pressed={activeTab === 'honors'} onClick={() => setActiveTab('honors')}
                    className={cn('min-h-11 border-b-2 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', activeTab === 'honors' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
                    Vinh danh
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden relative grid grid-cols-1 grid-rows-1">
                {/* Existing article list; inactive panels do not reserve height. */}
                <div style={activeTab === 'hot' ? undefined : { display: 'none' }} className={cn(
                    "col-start-1 row-start-1 p-4 space-y-2.5 transition-all duration-300 overflow-y-auto",
                    activeTab === 'hot' ? "opacity-100 translate-x-0 z-10" : "opacity-0 -translate-x-full pointer-events-none z-0"
                )}>
                    {posts.map((post, index) => (
                        <Link
                            key={post.id}
                            href={`/user/truyenthong/${post.slug || post.id}`}
                            prefetch={false}
                            className="flex gap-3 group hover:bg-gradient-to-r hover:from-red-50 hover:to-orange-50 -mx-2 px-2 py-2.5 rounded-xl transition-all duration-200 border border-transparent hover:border-red-100 hover:shadow-md"
                        >
                            <div className="relative rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 shadow-md ring-1 ring-black/5 w-14 h-14">
                                <img
                                    src={normalizeStorageUrl(post.banner_image || post.featured_image) || '/placeholder-banner.jpg'}
                                    alt={post.title}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                                <div className="absolute top-1 left-1 w-4.5 h-4.5 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-lg shadow-red-200">
                                    {index + 1}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="text-xs font-bold text-gray-900 line-clamp-2 group-hover:text-red-700 transition-colors leading-snug mb-1">
                                    {post.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[11px] text-gray-500 group-hover:text-red-600 transition-colors">
                                    <span className="font-semibold uppercase tracking-wide text-[10px]">
                                        {POST_TYPE_LABELS[post.post_type] || post.post_type}
                                    </span>
                                    <span className="text-gray-300">•</span>
                                    <span className="flex items-center gap-1 font-medium">
                                        <Eye className="w-2.5 h-2.5" />
                                        {post.view_count.toLocaleString('vi-VN')}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Vinh danh */}
                <div style={activeTab === 'honors' ? undefined : { display: 'none' }} className={cn(
                    "col-start-1 row-start-1 flex flex-col transition-all duration-300",
                    activeTab === 'honors' ? "opacity-100 translate-x-0 z-10" : "opacity-0 translate-x-full pointer-events-none z-0"
                )}>
                    <HonorsTab onOpenPopup={onOpenPopup} />
                </div>
            </div>
        </div>
    )
}
