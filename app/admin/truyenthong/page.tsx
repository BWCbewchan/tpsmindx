'use client'

import { EmptyState } from '@/components/EmptyState'
import { PageContainer } from '@/components/PageContainer'
import { SearchBar } from '@/components/SearchBar'
import { TableSkeleton } from '@/components/skeletons'
import { Tabs } from '@/components/Tabs'
import TruyenThongStats from '@/components/truyenthong-stats'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeOff, FileText, ImageIcon, MessageCircle, Pencil, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'

interface Post {
    id: number
    slug: string
    title: string
    post_type: string
    status: 'draft' | 'published' | 'hidden'
    published_at: string
    audience: string
    view_count: number
    comment_count?: number
    hidden_comment_count?: number
}

async function fetchPostsArray<T>(url: string): Promise<T[]> {
    const res = await fetch(url)
    const data: unknown = await res.json().catch(() => null)
    return Array.isArray(data) ? (data as T[]) : []
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
    published: { label: '✓ Đã công bố', variant: 'success' },
    draft:     { label: '✎ Bản nháp',   variant: 'warning' },
    hidden:    { label: '✕ Đã ẩn',      variant: 'danger' },
}

const TYPE_LABELS: Record<string, string> = {
    'tin-tuc':    'Tin tức',
    'su-kien':    'Sự kiện',
    'thong-bao':  'Thông báo',
    'huong-dan':  'Hướng dẫn',
}

const AUDIENCE_LABELS: Record<string, string> = {
    'toan-cong-ty': 'Toàn công ty',
    'giao-vien':    'Giáo viên',
    'hoc-vien':     'Học viên',
    'quan-ly':      'Quản lý',
}

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status]
    if (!cfg) return null
    return (
        <Badge variant={cfg.variant} size="sm" shape="pill">
            {cfg.label}
        </Badge>
    )
}

export default function TruyenthongDashboardPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published' | 'hidden'>('all')

    const queryParams = new URLSearchParams()
    if (filterStatus !== 'all') queryParams.append('status', filterStatus)
    if (searchTerm) queryParams.append('search', searchTerm)

    const { data: rawPosts, isLoading } = useSWR<Post[]>(
        `/api/truyenthong/posts?${queryParams.toString()}`,
        fetchPostsArray<Post>,
        { revalidateOnFocus: false, dedupingInterval: 60000 }
    )
    const posts = Array.isArray(rawPosts) ? rawPosts : []

    const tabs = [
        { id: 'all',       label: 'Tất cả',   count: posts.length },
        { id: 'draft',     label: 'Bản nháp', count: posts.filter(p => p.status === 'draft').length },
        { id: 'published', label: 'Công bố',  count: posts.filter(p => p.status === 'published').length },
        { id: 'hidden',    label: 'Đã ẩn',    count: posts.filter(p => p.status === 'hidden').length },
    ]

    return (
        <PageContainer
            title="Trung tâm Truyền thông"
            description="Quản lý và theo dõi toàn bộ bài viết, sự kiện và thông báo nội bộ."
        >
            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
                <Button asChild variant="mindx" className="gap-2 shadow-sm font-semibold">
                    <Link href="/admin/truyenthong/posts/create">
                        <Plus className="h-3 w-4" />
                        Tạo bài viết mới
                    </Link>
                </Button>
                <Button asChild variant="outline" className="gap-2 shadow-sm font-semibold border-gray-300">
                    <Link href="/admin/truyenthong/sliders">
                        <ImageIcon className="h-3 w-4" />
                        Quản lý Slider
                    </Link>
                </Button>
            </div>

            {/* Stats Dashboard */}
            <div className="mb-8">
                <TruyenThongStats />
            </div>

            {/* Posts Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div>
                    <h3 className="text-lg font-extrabold text-gray-900">Danh sách bài viết</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {posts.length ? `${posts.length} bài viết` : 'Chưa có bài viết nào'}
                    </p>
                </div>
                <div className="w-full md:w-72">
                    <SearchBar
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Tìm theo tiêu đề..."
                    />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="mb-4">
                <Tabs
                    tabs={tabs}
                    activeTab={filterStatus}
                    onChange={(id) => setFilterStatus(id as 'all' | 'draft' | 'published' | 'hidden')}
                />
            </div>

            {/* Posts List */}
            <div className="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-4">
                        <TableSkeleton rows={5} columns={4} />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="py-4">
                        <EmptyState
                            icon={FileText}
                            title="Không tìm thấy bài viết nào"
                            description="Chưa có bài đăng nào phù hợp với bộ lọc hiện tại. Hãy thử tạo bài viết mới."
                            action={{
                                label: 'Tạo bài viết',
                                onClick: () => window.location.href = '/admin/truyenthong/posts/create'
                            }}
                        />
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {posts.map((post, index) => {
                            const typeLabel  = TYPE_LABELS[post.post_type]  ?? post.post_type
                            const audienceLabel = AUDIENCE_LABELS[post.audience] ?? post.audience
                            const date = post.published_at
                                ? new Date(post.published_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                : null

                            return (
                                <li key={`${post.id || post.slug || 'post'}-${index}`} className="group hover:bg-gray-50 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">

                                        {/* Left – title + meta */}
                                        <div className="flex-1 min-w-0">
                                            <Link
                                                href={`/admin/truyenthong/posts/${encodeURIComponent(post.slug)}`}
                                                title="Xem bài & quản lý bình luận"
                                                className="font-bold text-[15px] text-gray-900 hover:text-blue-600 hover:underline transition-colors line-clamp-1"
                                            >
                                                {post.title}
                                            </Link>

                                            {/* Meta row */}
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                {date && (
                                                    <span className="text-xs text-gray-400 font-medium">
                                                        {date}
                                                    </span>
                                                )}

                                                <StatusBadge status={post.status} />

                                                {typeLabel && (
                                                    <Badge variant="default" size="sm" shape="pill">
                                                        {typeLabel}
                                                    </Badge>
                                                )}

                                                {audienceLabel && (
                                                    <Badge variant="info" size="sm" shape="pill" className="max-w-[180px] truncate">
                                                        {audienceLabel}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right – stats + action */}
                                        <div className="flex items-center gap-4 sm:gap-5 shrink-0">
                                            {/* Lượt xem */}
                                            <div className="flex items-center gap-1.5 text-gray-500" title="Lượt xem">
                                                <Eye className="w-4 h-4" />
                                                <span className="text-sm font-semibold tabular-nums text-gray-700">
                                                    {post.view_count?.toLocaleString('vi-VN') || 0}
                                                </span>
                                            </div>

                                            {/* Bình luận hiển thị */}
                                            <div
                                                className="flex items-center gap-1.5 text-gray-500"
                                                title="Bình luận đang hiển thị"
                                            >
                                                <MessageCircle className="w-4 h-4 text-green-500" />
                                                <div className="flex flex-col items-center leading-none">
                                                    <span className="text-sm font-bold tabular-nums text-gray-800">
                                                        {Number(post.comment_count ?? 0).toLocaleString('vi-VN')}
                                                    </span>
                                                    <span className="text-[10px] text-green-600 font-semibold">hiển thị</span>
                                                </div>
                                            </div>

                                            {/* Bình luận đang ẩn */}
                                            <div
                                                className={`flex items-center gap-1.5 ${Number(post.hidden_comment_count) > 0 ? 'text-red-500' : 'text-gray-400'}`}
                                                title="Bình luận đang bị ẩn"
                                            >
                                                <EyeOff className="w-4 h-4" />
                                                <div className="flex flex-col items-center leading-none">
                                                    <span className={`text-sm font-bold tabular-nums ${Number(post.hidden_comment_count) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                        {Number(post.hidden_comment_count ?? 0).toLocaleString('vi-VN')}
                                                    </span>
                                                    <span className={`text-[10px] font-semibold ${Number(post.hidden_comment_count) > 0 ? 'text-red-500' : 'text-gray-400'}`}>đang ẩn</span>
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div className="hidden sm:block w-px h-8 bg-gray-200" />


                                            {/* Edit */}
                                            <Link href={`/admin/truyenthong/posts/${post.slug}/edit`}>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 gap-1.5 font-semibold text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50 border-blue-200"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                    Chỉnh sửa
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </PageContainer>
    )
}
