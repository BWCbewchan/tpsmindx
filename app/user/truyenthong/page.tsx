'use client'

import { Filter, Search } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'

import { PageContainer } from '@/components/PageContainer'
import { PageHeader } from '@/components/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import PostCard from '@/components/post-card'
import HeroSection from '@/components/hero-section'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UpcomingEventsSidebar } from '@/components/upcoming-events-sidebar'
import { useSidebar } from '@/lib/sidebar-context'

// Skeleton Imports (Inline for simplicity or import if available)
import { PostCardSkeleton } from '@/components/skeletons'

interface Post {
  id: string | number
  slug: string
  title: string
  description: string
  content: string
  featured_image: string
  banner_image: string
  thumbnail_position?: string
  post_type: string
  published_at: string
  view_count: number
  created_at: string
}

async function fetchPostsArray(url: string): Promise<Post[]> {
    const res = await fetch(url)
    const data: unknown = await res.json().catch(() => null)
    return Array.isArray(data) ? (data as Post[]) : []
}

export default function CommunicationsPage() {
    const searchParams = useSearchParams()
    const { isOpen: isSidebarOpen } = useSidebar()
    const { data: rawPosts, isLoading } = useSWR<Post[]>('/api/truyenthong/posts?status=published', fetchPostsArray, { revalidateOnFocus: false, dedupingInterval: 120000 })
    const posts = Array.isArray(rawPosts) ? rawPosts : []
    const [selectedFilter, setSelectedFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
  // Handle URL filter parameter
  useEffect(() => {
    const filterParam = searchParams.get('filter')
    if (filterParam) {
      setSelectedFilter(filterParam)
    }
  }, [searchParams])

  const filteredPosts = useMemo(() => {
    let result = posts

    // Filter by Type
    if (selectedFilter !== 'all') {
      result = result.filter((post) => post.post_type === selectedFilter)
    }

    // Filter by Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.description.toLowerCase().includes(query),
      )
    }

    return result
  }, [selectedFilter, searchQuery, posts])

  // Derived Data
  const featuredPosts = posts.slice(0, 10) // Top 10 for Slider

  const postTypes = [
    { value: 'all', label: 'Tất cả' },
    { value: 'tin-tức', label: 'Tin tức' },
    { value: 'chính-sách', label: 'Chính sách' },
    { value: 'sự-kiện', label: 'Sự kiện' },
    { value: 'đào-tạo', label: 'Đào tạo' },
    { value: 'báo-cáo', label: 'Báo cáo' },
    { value: 'thông-báo', label: 'Thông báo' },
  ]

  // Show full page skeleton while loading
  if (isLoading) {
    return <PageSkeleton variant="grid" itemCount={6} showHeader={true} />
  }

  return (
    <PageContainer>
      <div className="bg-white pb-20">
        {/* Hero Section - Slider + Sidebar */}
        {posts.length > 0 && (
          <HeroSection posts={featuredPosts} />
        )}

        {/* Header Section - Now after slider */}
        <div className="bg-white">
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 py-5 md:py-10">
            <PageHeader
              title="Truyền Thông Nội Bộ"
              description="Cập nhật tin tức, sự kiện và thông báo mới nhất"
              className="mb-0"
              actions={
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Tìm kiếm bài viết..."
                    className="pl-10 w-full bg-white border-gray-200 focus:bg-white focus:border-[#a1001f] focus:ring-1 focus:ring-[#a1001f]/25 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              }
            />
          </div>
        </div>

        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 md:py-4 space-y-6">
          {/* Two Column Layout: Main Content + Sidebar */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content - Left Side */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-6 md:gap-8">
                {/* Sticky Filter Bar — ẩn trên mobile khi sidebar đang mở */}
                <div className={cn(
                  "top-20 overflow-hidden rounded-2xl border border-gray-200/50 bg-white/95 shadow-sm backdrop-blur-sm",
                  isSidebarOpen && "hidden lg:block"
                )}>
                  <div className="flex items-center justify-between gap-4 overflow-x-auto p-2 no-scrollbar">
                    <div className="flex p-1 gap-1">
                      {postTypes.map((type) => (
                        <Button
                          key={type.value}
                          variant={selectedFilter === type.value ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setSelectedFilter(type.value)}
                          className={cn(
                            'whitespace-nowrap',
                            selectedFilter === type.value && 'bg-gray-900 hover:bg-gray-800'
                          )}
                        >
                          {type.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Posts Grid */}
                {filteredPosts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                    {filteredPosts.map((post, index) => (
                      <div key={`${post.id || post.slug || 'post'}-${index}`}>
                        <PostCard post={post} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-gray-100">
                      <Filter className="w-6 h-6 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Không tìm thấy bài viết
                    </h3>
                    <p className="text-gray-500">
                      Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Right Side */}
            <aside className="w-full lg:w-80 shrink-0">
              <div>
                <UpcomingEventsSidebar />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
