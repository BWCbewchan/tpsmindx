'use client'

import { Eye, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import useSWR from 'swr'
import { normalizeStorageUrl } from '@/lib/storage-url'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

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

export default function SliderSidebar() {
    const { data: posts = [] } = useSWR<Post[]>(
        '/api/truyenthong/posts?status=published&limit=5&sort=view_count',
        fetcher,
        { refreshInterval: 60000 }
    )

    const trendingPosts = Array.isArray(posts) ? posts.slice(0, 5) : []

    return (
        <div className="h-full max-h-full bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-600" />
                    <span>Đang hot</span>
                </h3>
            </div>

            {/* Trending Posts List */}
            <div className="flex-1 min-h-0 p-5 space-y-3 overflow-y-auto">
                {trendingPosts.map((post, index) => (
                    <Link
                        key={post.id}
                        href={`/user/truyenthong/${post.slug || post.id}`}
                        className="flex gap-4 group hover:bg-gradient-to-r hover:from-red-50 hover:to-orange-50 -mx-3 px-3 py-3 rounded-xl transition-all duration-200 border border-transparent hover:border-red-100 hover:shadow-md"
                    >
                        <div className="relative rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 shadow-md ring-1 ring-black/5 w-16 h-16">
                            <img
                                src={normalizeStorageUrl(post.banner_image || post.featured_image) || '/placeholder-banner.jpg'}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute top-1 left-1 w-5 h-5 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-red-200">
                                {index + 1}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-red-700 transition-colors leading-snug mb-1.5">
                                {post.title}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-gray-500 group-hover:text-red-600 transition-colors">
                                <span className="font-semibold uppercase tracking-wide text-[11px]">
                                    {POST_TYPE_LABELS[post.post_type] || post.post_type}
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="flex items-center gap-1 font-medium">
                                    <Eye className="w-3 h-3" />
                                    {post.view_count.toLocaleString('vi-VN')}
                                </span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
