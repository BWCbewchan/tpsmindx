'use client'
import { useQueryState } from '@/lib/use-query-state'


import { Filter, Search } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'

import { PageContainer } from '@/components/PageContainer'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import PostCard from '@/components/post-card'
import HeroSection from '@/components/hero-section'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UpcomingEventsSidebar } from '@/components/upcoming-events-sidebar'
import { useSidebar } from '@/lib/sidebar-context'
import TeacherHonorsPopup from '@/components/teacher-honors-popup'

// Skeleton Imports (Inline for simplicity or import if available)
import { PostCardSkeleton } from '@/components/skeletons'

interface Post {
  id: string | number
  slug: string
  title: string
  description: string
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

function selectTopViewedPosts(posts: Post[], limit: number): Post[] {
  const top: Post[] = []

  for (const post of posts) {
    const insertAt = top.findIndex((candidate) => post.view_count > candidate.view_count)
    if (insertAt === -1) {
      if (top.length < limit) top.push(post)
      continue
    }

    top.splice(insertAt, 0, post)
    if (top.length > limit) top.pop()
  }

  return top
}

export default function CommunicationsPage() {
    const searchParams = useSearchParams()
    const { isOpen: isSidebarOpen } = useSidebar()
    const { data: rawPosts, isLoading } = useSWR<Post[]>(
      '/api/truyenthong/posts?status=published',
      fetchPostsArray,
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        dedupingInterval: 300_000,
      },
    )
    const posts = Array.isArray(rawPosts) ? rawPosts : []
    const [selectedFilter, setSelectedFilter] = useQueryState<string>('filter', 'all')
    const [searchQuery, setSearchQuery] = useQueryState<string>('search', '')
    const [isPopupOpen, setIsPopupOpen] = useState(false)

  // Auto-open popup on first visit, re-open every week
  useEffect(() => {
    const KEY = 'tms_honors_popup_seen_at'
    try {
      const seenAt = localStorage.getItem(KEY)

      const getWeeklyCycleId = (ts: number) => {
        const d = new Date(ts)
        // Tính toán ID dựa trên số tuần kể từ epoch (Unix time)
        // 604800000 ms = 7 ngày
        return Math.floor(ts / 604800000)
      }

      const currentCycle = getWeeklyCycleId(Date.now())
      const seenCycle = seenAt ? getWeeklyCycleId(Number(seenAt)) : null
      const shouldShow = seenCycle === null || seenCycle < currentCycle

      if (shouldShow) {
        const timer = setTimeout(() => setIsPopupOpen(true), 1200)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage unavailable — skip auto-open
    }
  }, [])
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
  const featuredPosts = posts.slice(0, 5)
  const trendingPosts = useMemo(() => selectTopViewedPosts(posts, 5), [posts])

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
          <HeroSection 
            posts={featuredPosts} 
            trendingPosts={trendingPosts}
            onOpenPopup={() => setIsPopupOpen(true)}
          />
        )}

        {/* Teacher Honors Popup */}
        <TeacherHonorsPopup
          isOpen={isPopupOpen}
          onOpen={() => setIsPopupOpen(true)}
          onClose={() => {
            setIsPopupOpen(false)
            try {
              localStorage.setItem('tms_honors_popup_seen_at', String(Date.now()))
            } catch { /* ignore */ }
          }}
        />

        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 pt-5 md:pt-8 space-y-6">
          {/* Two Column Layout: Main Content + Sidebar */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content - Left Side */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-6 md:gap-8">
                {/* Sticky Filter Bar — ẩn trên mobile khi sidebar đang mở */}
                <div className={cn(
                  "top-20 overflow-hidden rounded-[1.15rem] border border-gray-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.055)]",
                  isSidebarOpen && "hidden lg:block"
                )}>
                  <div className="flex h-[64px] items-center p-2.5">
                    <div className="relative -mx-1 xl:mx-0">
                      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-white via-white/85 to-transparent xl:hidden" />
                      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-white via-white/85 to-transparent xl:hidden" />
                      <div className="overflow-x-auto no-scrollbar px-1 scroll-smooth">
                        <div className="flex min-w-max gap-1 rounded-[0.85rem] bg-gray-50 p-1 shadow-inner shadow-gray-200/40 xl:w-fit">
                        {postTypes.map((type) => (
                          <Button
                            key={type.value}
                            variant={selectedFilter === type.value ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setSelectedFilter(type.value)}
                            aria-pressed={selectedFilter === type.value}
                            className={cn(
                              'h-10 rounded-[0.65rem] px-3 text-[13px] font-semibold whitespace-nowrap transition-all lg:px-3.5',
                              selectedFilter === type.value
                                ? 'bg-gray-900 text-white shadow-sm shadow-gray-900/15 hover:bg-gray-800'
                                : 'text-gray-700 hover:bg-white hover:text-gray-950 hover:shadow-sm'
                            )}
                          >
                            {type.label}
                          </Button>
                        ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Posts Grid */}
                {filteredPosts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                    {filteredPosts.map((post, index) => (
                      <div
                        key={`${post.id || post.slug || 'post'}-${index}`}
                        className="lg:h-[460px] xl:h-[480px]"
                      >
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
              <div className="space-y-6">
                <div className="flex h-[64px] items-center rounded-[1.15rem] border border-gray-200/80 bg-white p-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.055)]">
                  <div className="group/search relative w-full">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within/search:text-[#a1001f]" />
                    <Input
                      placeholder="Tìm kiếm bài viết..."
                      aria-label="Tìm kiếm bài viết"
                      className="h-10 w-full rounded-[0.8rem] border-gray-200 bg-gray-50 pl-10 pr-3 text-sm font-medium shadow-inner shadow-gray-200/40 transition-all placeholder:text-gray-400 hover:border-gray-300 hover:bg-white focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/15"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <UpcomingEventsSidebar upcomingCardClassName="lg:h-[460px] xl:h-[480px]" />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
