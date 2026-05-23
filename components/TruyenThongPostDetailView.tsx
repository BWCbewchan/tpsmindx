'use client'

import Comments from '@/components/Comments'
import CroppedImage from '@/components/CroppedImage'
import PostCard from '@/components/post-card'
import PostContentRenderer from '@/components/PostContentRenderer'
import { PostDetailSkeleton } from '@/components/skeletons'
import { Button } from '@/components/ui/button'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { Angry, ArrowLeft, Calendar, Check, Eye, FileText, Frown, Heart, Laugh, Share2, ThumbsUp } from 'lucide-react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from '@/lib/app-toast'
import { useAuth } from '@/lib/auth-context'

export type TruyenThongPostDetailMode = 'user' | 'admin'

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
    like_count: number
    isLiked?: boolean
    reaction_counts?: Record<string, number>
    relatedPosts?: Post[]
}

interface TruyenThongPostDetailViewProps {
    mode: TruyenThongPostDetailMode
}

export function TruyenThongPostDetailView({ mode }: TruyenThongPostDetailViewProps) {
    const params = useParams()
    const pathname = usePathname()
    const { user } = useAuth()
    const [post, setPost] = useState<Post | null>(null)
    const [loading, setLoading] = useState(true)
    const [liked, setLiked] = useState(false)
    const [isLiking, setIsLiking] = useState(false)
    const [showReactions, setShowReactions] = useState(false)
    const [currentReaction, setCurrentReaction] = useState<string | null>(null)
    const [showComments, setShowComments] = useState(false)
    const [reactionUsers, setReactionUsers] = useState<Array<{user_id: string, user_name: string | null, reaction: string}>>([])
    const [showReactionPopup, setShowReactionPopup] = useState(false)
    const [activeReactionFilter, setActiveReactionFilter] = useState<string | null>(null)
    const reactionPopupRef = useRef<HTMLDivElement | null>(null)
    const reactionsRef = useRef<HTMLDivElement | null>(null)

    const isAdmin = mode === 'admin' || !!user?.isAdmin
    const backHref = mode === 'admin' ? '/admin/truyenthong' : '/user/truyenthong'
    const relatedPostBase = mode === 'admin' ? '/admin/truyenthong/posts' : '/user/truyenthong'
    const [copied, setCopied] = useState(false)

    const copyShareLink = async () => {
        try {
            const url = `${window.location.origin}${pathname}`
            await navigator.clipboard.writeText(url)
            setCopied(true)
            toast.success('Đã copy link bài viết')
            window.setTimeout(() => setCopied(false), 1200)
        } catch {
            try {
                const url = `${window.location.origin}${pathname}`
                const textarea = document.createElement('textarea')
                textarea.value = url
                textarea.style.position = 'fixed'
                textarea.style.opacity = '0'
                document.body.appendChild(textarea)
                textarea.focus()
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
                setCopied(true)
                toast.success('Đã copy link bài viết')
                window.setTimeout(() => setCopied(false), 1200)
            } catch {
                toast.error('Không thể copy link')
            }
        }
    }

    useEffect(() => {
        const fetchPost = async () => {
            if (!params?.slug) return
            try {
                const userIdParam = user?.localId ? `?userId=${user.localId}` : ''
                const res = await fetch(`/api/truyenthong/posts/${params.slug}${userIdParam}`)
                if (!res.ok) throw new Error('Failed to fetch post')
                const data = await res.json()
                setPost(data)
                setLiked(!!data.isLiked)
                if (data.reaction) {
                    setCurrentReaction(data.reaction)
                }

                // Load reaction users ngay lập tức (không đợi polling 15s)
                try {
                    const rRes = await fetch(`/api/truyenthong/posts/${params.slug}/reactions`)
                    if (rRes.ok) {
                        const rData = await rRes.json()
                        if (rData.users) {
                            setReactionUsers(rData.users)
                        }
                        setPost(prev => prev ? { ...prev, reaction_counts: rData.reaction_counts } : null)
                    }
                } catch { /* silent */ }

                if (mode === 'user') {
                    fetch(`/api/truyenthong/posts/${params.slug}/view`, { method: 'POST' })
                }
            } catch (error) {
                console.error('Error fetching post:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchPost()
    }, [params?.slug, user?.localId, mode])

    // Realtime polling: cập nhật like_count + reaction_counts mỗi 15s
    useEffect(() => {
        if (!params?.slug) return
        const slug = params.slug as string

        const poll = async () => {
            try {
                const res = await fetch(`/api/truyenthong/posts/${slug}/reactions`)
                if (!res.ok) return
                const data = await res.json()
                setPost(prev => prev ? {
                    ...prev,
                    like_count: data.like_count,
                    reaction_counts: data.reaction_counts,
                } : null)
                if (data.users) setReactionUsers(data.users)
            } catch { /* silent fail */ }
        }

        const timer = setInterval(poll, 5000)
        return () => clearInterval(timer)
    }, [params?.slug])

    const handleLike = async () => {
        if (isLiking) return

        if (!post || !user?.localId) {
            if (!user) toast.error('Vui lòng đăng nhập để thích bài viết')
            return
        }

        setIsLiking(true)

        const previousLiked = liked
        const previousLikeCount = post.like_count

        const newLikedState = !previousLiked
        const newLikeCount = newLikedState ? previousLikeCount + 1 : previousLikeCount - 1

        setLiked(newLikedState)
        setPost(prev => prev ? { ...prev, like_count: newLikeCount } : null)

        try {
            const res = await fetch(`/api/truyenthong/posts/${post.slug}/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: user.localId })
            })

            if (res.ok) {
                const data = await res.json()
                setLiked(data.isLiked)
                setPost(prev => prev ? { ...prev, like_count: data.like_count } : null)
            } else {
                setLiked(previousLiked)
                setPost(prev => prev ? { ...prev, like_count: previousLikeCount } : null)
                throw new Error('Failed to like post')
            }
        } catch (error) {
            setLiked(previousLiked)
            setPost(prev => prev ? { ...prev, like_count: previousLikeCount } : null)
            console.error('Error liking post:', error)
        } finally {
            setIsLiking(false)
        }
    }

    const reactions = [
        { type: 'like', icon: ThumbsUp, label: 'Thích', color: 'text-blue-500' },
        { type: 'love', icon: Heart, label: 'Yêu thích', color: 'text-red-500' },
        { type: 'haha', icon: Laugh, label: 'Haha', color: 'text-yellow-500' },
        { type: 'sad', icon: Frown, label: 'Buồn', color: 'text-gray-500' },
        { type: 'angry', icon: Angry, label: 'Phẫn nộ', color: 'text-orange-500' },
    ]

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (reactionsRef.current && !reactionsRef.current.contains(event.target as Node)) {
                setShowReactions(false)
            }
            if (reactionPopupRef.current && !reactionPopupRef.current.contains(event.target as Node)) {
                setShowReactionPopup(false)
            }
        }

        if (showReactions || showReactionPopup) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showReactions, showReactionPopup])

    const handleReaction = async (reactionType: string, e: React.MouseEvent) => {
        e.stopPropagation()

        if (isLiking || !user?.localId) {
            if (!user) toast.error('Vui lòng đăng nhập để bày tỏ cảm xúc')
            return
        }

        setIsLiking(true)

        const previousReaction = currentReaction
        const previousLiked = liked
        const previousLikeCount = post?.like_count || 0

        if (currentReaction === reactionType) {
            setCurrentReaction(null)
            setLiked(false)
            setPost(prev => prev ? { ...prev, like_count: previousLikeCount - 1 } : null)
        } else {
            setCurrentReaction(reactionType)
            setLiked(true)
            if (!previousLiked) {
                setPost(prev => prev ? { ...prev, like_count: previousLikeCount + 1 } : null)
            }
        }

        setTimeout(() => {
            setShowReactions(false)
        }, 300)

        try {
            const res = await fetch(`/api/truyenthong/posts/${post?.slug}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.localId, reaction: reactionType, userName: user.displayName || user.email })
            })

            if (res.ok) {
                const data = await res.json()
                setLiked(data.isLiked)
                setPost(prev => prev ? {
                    ...prev,
                    like_count: data.like_count,
                    reaction_counts: data.reaction_counts ?? prev.reaction_counts,
                } : null)
                if (data.isLiked && data.reaction) {
                    setCurrentReaction(data.reaction)
                } else {
                    setCurrentReaction(null)
                }
            } else {
                throw new Error('Failed to react')
            }
        } catch (error) {
            setCurrentReaction(previousReaction)
            setLiked(previousLiked)
            setPost(prev => prev ? { ...prev, like_count: previousLikeCount } : null)
            console.error('Error reacting:', error)
        } finally {
            setIsLiking(false)
        }
    }

    if (loading) return <PostDetailSkeleton />
    if (!post) return (
        <PageLayout>
            <PageLayoutContent>
                <div className="flex items-center justify-center animate-in fade-in zoom-in duration-500 py-20">
                    <div className="text-center">
                        <div className="bg-muted p-6 rounded-full mb-6 inline-block">
                            <FileText className="w-12 h-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground mb-2">Không tìm thấy bài viết</h3>
                        <p className="text-muted-foreground mb-6">Bài viết này không tồn tại hoặc đã bị xóa.</p>
                        <Link href={backHref}>
                            <Button variant="default">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Quay lại
                            </Button>
                        </Link>
                    </div>
                </div>
            </PageLayoutContent>
        </PageLayout>
    )

    const publishDate = new Date(post.published_at).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

    const postTypeLabels: Record<string, string> = {
        'tin-tức': 'Tin tức',
        'chính-sách': 'Chính sách',
        'sự-kiện': 'Sự kiện',
        'đào-tạo': 'Đào tạo',
        'báo-cáo': 'Báo cáo',
        'thông-báo': 'Thông báo',
    }

    return (
        <PageLayout maxWidth="7xl" padding="md">
            <PageLayoutContent spacing="md">
                {/* Nút quay lại — hiển thị cho cả user và admin */}
                <div className="pb-2">
                    <Link href={backHref}>
                        <Button variant="ghost" size="sm" className="gap-2 hover:bg-gray-100 transition-all hover:-translate-x-0.5 text-gray-600">
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại
                        </Button>
                    </Link>
                </div>

                <div className="relative w-full rounded-xl overflow-hidden mb-5 shadow-lg" style={{ height: 'clamp(200px, 40vw, calc(var(--spacing) * 130))' }}>
                    <CroppedImage
                        src={post.featured_image || '/placeholder.svg'}
                        alt={post.title}
                        cropData={post.thumbnail_position}
                        style={{ position: 'absolute', inset: 0 }}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                        <span className="mb-3 inline-block rounded-full bg-[#a1001f] px-3 py-1 text-xs font-bold text-white">
                            {postTypeLabels[post.post_type] || post.post_type}
                        </span>
                        <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                            {post.title}
                        </h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                    <div className="lg:col-span-3">
                        <div className="rounded-xl border border-[#e6b8c2] bg-white shadow-sm overflow-visible">
                            <div className="border-b border-[#e6b8c2] bg-[#f9ebef] px-5 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-[#a1001f]" />
                                        <span className="font-semibold">{publishDate}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <Eye className="h-3.5 w-3.5 text-[#a1001f]" />
                                            <span className="font-semibold">{post.view_count.toLocaleString('vi-VN')} lượt xem</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Heart className="h-3.5 w-3.5 text-[#a1001f]" />
                                            <span className="font-semibold">{post.like_count?.toLocaleString('vi-VN') || 0} lượt thích</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={copyShareLink}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-[#d8a1ae] bg-white px-3 py-1 font-semibold text-[#a1001f] transition hover:bg-[#fdf2f5]"
                                            title="Copy link bài viết"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Share2 className="w-3.5 h-3.5" aria-hidden />}
                                            <span>Chia sẻ</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <article className="p-5">
                                <p className="mb-5 border-b border-[#efc9d1] pb-5 text-base italic text-gray-600">
                                    {post.description}
                                </p>

                                <PostContentRenderer html={post.content} />

                                <div className="mt-6 border-t border-[#efc9d1] pt-4">
                                    <div className="flex items-center justify-between gap-3">

                                        {/* Trái: 3 nút hành động */}
                                        <div className="flex items-center gap-2">
                                            {/* Nút Thích với popup */}
                                            <div ref={reactionsRef} className="relative">
                                                {showReactions && (
                                                    <div className="absolute bottom-full left-0 z-20 mb-3 flex gap-1.5 rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-150">
                                                        {reactions.map((reaction, index) => {
                                                            const Icon = reaction.icon
                                                            const isActive = currentReaction === reaction.type
                                                            return (
                                                                <button
                                                                    key={reaction.type}
                                                                    onClick={(e) => handleReaction(reaction.type, e)}
                                                                    className={`cursor-pointer flex items-center justify-center rounded-xl p-2 transition-all duration-150 hover:-translate-y-1.5 hover:scale-110 ${isActive ? 'bg-[#fdf2f5]' : 'hover:bg-gray-50'} animate-in fade-in-0 zoom-in-50`}
                                                                    style={{ animationDelay: `${index * 25}ms` }}
                                                                    title={reaction.label}
                                                                >
                                                                    <Icon className={`w-8 h-8 drop-shadow ${reaction.color}`} />
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                                <button
                                                    onMouseEnter={() => setShowReactions(true)}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (currentReaction) {
                                                            // Đã thả → click để bỏ
                                                            handleReaction(currentReaction, e)
                                                        } else {
                                                            setShowReactions(prev => !prev)
                                                        }
                                                    }}
                                                    disabled={isLiking}
                                                    className={`cursor-pointer flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 border ${
                                                        currentReaction
                                                            ? 'bg-[#fdf2f5] border-[#e6b8c2] text-[#a1001f] shadow-sm'
                                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-[#fdf2f5] hover:border-[#e6b8c2] hover:text-[#a1001f]'
                                                    } ${isLiking ? 'opacity-50 pointer-events-none' : ''}`}
                                                >
                                                    {(() => {
                                                        const reaction = reactions.find(r => r.type === currentReaction)
                                                        if (reaction) {
                                                            const Icon = reaction.icon
                                                            return <><Icon className={`w-4 h-4 ${reaction.color}`} /><span>{reaction.label}</span></>
                                                        }
                                                        return <><ThumbsUp className="w-4 h-4" /><span>Thích</span></>
                                                    })()}
                                                </button>
                                            </div>

                                            {/* Nút Chia sẻ */}
                                            <button
                                                onClick={copyShareLink}
                                                className="cursor-pointer flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 border bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-800"
                                            >
                                                {copied
                                                    ? <Check className="w-4 h-4 text-green-500" />
                                                    : <Share2 className="w-4 h-4" />
                                                }
                                                <span>{copied ? 'Đã copy!' : 'Chia sẻ'}</span>
                                            </button>
                                        </div>

                                        {/* Phải: top 3 reactions + tổng số */}
                                        {post.like_count > 0 && (
                                            <div ref={reactionPopupRef} className="relative flex items-center gap-1.5">
                                                {/* Top 3 icons — mỗi icon có tooltip riêng hiện tên người thả */}
                                                <div className="flex -space-x-2" onClick={() => setShowReactionPopup(prev => !prev)}>
                                                    {(() => {
                                                        const counts = post.reaction_counts || {}
                                                        const sorted = reactions
                                                            .filter(r => counts[r.type] > 0)
                                                            .sort((a, b) => (counts[b.type] || 0) - (counts[a.type] || 0))
                                                            .slice(0, 3)
                                                        const display = sorted.length > 0 ? sorted : [reactions[0]]
                                                        return display.map((r, i) => {
                                                            const Icon = r.icon
                                                            const usersOfType = reactionUsers.filter(u => u.reaction === r.type && u.user_name)
                                                            return (
                                                                <div key={r.type} className="relative group/icon cursor-pointer w-7 h-7 rounded-full bg-white border-2 border-white flex items-center justify-center shadow-md ring-1 ring-gray-100 hover:scale-125 hover:z-10 transition-transform duration-200" style={{ zIndex: 3 - i }}>
                                                                    <Icon className={`w-4 h-4 ${r.color}`} />
                                                                    {/* Tooltip: tên người thả cảm xúc này */}
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none z-[9999]
                                                                        opacity-0 group-hover/icon:opacity-100
                                                                        translate-y-1 group-hover/icon:translate-y-0
                                                                        transition-all duration-150 ease-out">
                                                                        <div className="bg-gray-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                                                                            {usersOfType.length > 0 ? (
                                                                                <div className="text-white/90">
                                                                                    {usersOfType.length <= 2
                                                                                        ? usersOfType.map(u => u.user_name).join(', ')
                                                                                        : `${usersOfType[0].user_name} +${usersOfType.length - 1}`
                                                                                    }
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-white/60">Chưa có ai</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    })()}
                                                </div>

                                                {/* Số tổng */}
                                                <span
                                                    className="text-sm text-gray-600 font-semibold hover:text-gray-900 transition-colors cursor-pointer"
                                                    onClick={() => { setShowReactionPopup(prev => !prev); setActiveReactionFilter(null) }}
                                                >
                                                    {post.like_count.toLocaleString('vi-VN')}
                                                </span>

                                                {/* Popup chi tiết — tab theo loại cảm xúc */}
                                                <div className={`absolute bottom-full right-0 mb-2 z-40 bg-white rounded-2xl shadow-2xl border border-gray-100 w-72
                                                    transition-all duration-200 ease-out origin-bottom-right
                                                    ${showReactionPopup
                                                        ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                                                        : 'opacity-0 scale-95 translate-y-1 pointer-events-none'
                                                    }`}>
                                                    {/* Header: tổng + breakdown theo loại — có thể click */}
                                                    <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-gray-100 overflow-x-auto">
                                                        <button
                                                            onClick={() => setActiveReactionFilter(null)}
                                                            className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
                                                                activeReactionFilter === null
                                                                    ? 'bg-gray-800 text-white'
                                                                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            Tất cả · {post.like_count}
                                                        </button>
                                                        {reactions
                                                            .filter(r => (post.reaction_counts || {})[r.type] > 0)
                                                            .sort((a, b) => ((post.reaction_counts || {})[b.type] || 0) - ((post.reaction_counts || {})[a.type] || 0))
                                                            .map(r => {
                                                                const Icon = r.icon
                                                                const isActive = activeReactionFilter === r.type
                                                                return (
                                                                    <button
                                                                        key={r.type}
                                                                        onClick={() => setActiveReactionFilter(isActive ? null : r.type)}
                                                                        className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                                                                            isActive
                                                                                ? 'bg-gray-800 text-white'
                                                                                : 'text-gray-500 hover:bg-gray-100'
                                                                        }`}
                                                                    >
                                                                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : r.color}`} />
                                                                        {(post.reaction_counts || {})[r.type]}
                                                                    </button>
                                                                )
                                                            })}
                                                    </div>
                                                    {/* Danh sách người — filter theo tab active */}
                                                    <div className="p-2 max-h-52 overflow-y-auto">
                                                        {(() => {
                                                            const filtered = reactionUsers
                                                                .filter(u => activeReactionFilter === null || u.reaction === activeReactionFilter)
                                                            const named = filtered.filter(u => u.user_name)
                                                            const anonymous = filtered.length - named.length
                                                            return (
                                                                <>
                                                                    {named.map((u, i) => {
                                                                        const r = reactions.find(rx => rx.type === u.reaction)
                                                                        const Icon = r?.icon
                                                                        return (
                                                                            <div key={i} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors duration-100">
                                                                                <div className="w-8 h-8 rounded-full bg-[#a1001f] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                                                                                    {u.user_name!.charAt(0).toUpperCase()}
                                                                                </div>
                                                                                <span className="text-sm text-gray-800 font-medium flex-1 truncate">{u.user_name}</span>
                                                                                {Icon && r && <Icon className={`w-4 h-4 shrink-0 ${r.color}`} />}
                                                                            </div>
                                                                        )
                                                                    })}
                                                                    {anonymous > 0 && (
                                                                        <div className="px-2 py-2 text-xs text-gray-400 text-center">
                                                                            và {anonymous} người khác
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>

                    <aside>
                        <div className="overflow-hidden rounded-xl border border-[#e6b8c2] bg-white shadow-sm">
                            <div className="border-b border-[#e6b8c2] bg-[#f9ebef] px-4 py-3">
                                <h3 className="text-sm font-bold text-gray-900">Thông tin bài viết</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-start gap-2">
                                        <span className="font-semibold text-gray-600 w-16 shrink-0">Loại:</span>
                                        <span className="text-gray-900">{postTypeLabels[post.post_type] || post.post_type}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-semibold text-gray-600 w-16 shrink-0">Đăng:</span>
                                        <span className="text-gray-900">{publishDate}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-semibold text-gray-600 w-16 shrink-0">Lượt xem:</span>
                                        <span className="text-gray-900">{post.view_count.toLocaleString('vi-VN')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                <div className="mt-5">
                    <Comments
                        postSlug={post.slug}
                        currentUserId={user?.localId}
                        currentUserName={user?.displayName || user?.email}
                        currentUserEmail={user?.email}
                        isAdmin={isAdmin}
                    />
                </div>

                <section className="mt-5">
                    <div className="overflow-hidden rounded-xl border border-[#e6b8c2] bg-white shadow-sm">
                        <div className="border-b border-[#e6b8c2] bg-[#f9ebef] px-5 py-3">
                            <h2 className="text-sm font-bold text-gray-900">Tin liên quan</h2>
                        </div>
                        <div className="p-5">
                            {post.relatedPosts && post.relatedPosts.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {post.relatedPosts.map((relatedPost: Post) => (
                                        <PostCard key={relatedPost.id} post={relatedPost} detailBasePath={relatedPostBase} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-100">
                                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">Hiện tại chưa có bài viết liên quan.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </PageLayoutContent>
        </PageLayout>
    )
}
