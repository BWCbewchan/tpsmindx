'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertTriangle,
  Angry,
  ChevronDown,
  Clock,
  Edit,
  Eye,
  EyeOff,
  Frown,
  Heart,
  Image as ImageIcon,
  Laugh,
  MessageCircle,
  Shield,
  ThumbsUp,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/lib/app-toast'

interface Reaction {
  type: string
  user_id: string
}

interface Comment {
  id: number
  user_id: string
  user_name: string
  user_email?: string
  content: string
  created_at: string
  updated_at?: string
  hidden?: boolean
  reaction_count: number
  reactions: Reaction[]
  replies: Comment[]
  _replyToName?: string  // tên người được reply (dùng cho flatten)
}

interface CommentItemProps {
  comment: Comment
  currentUserId?: string
  currentUserEmail?: string
  isAdmin?: boolean
  onReply: (commentId: number, content: string) => void
  onReact: (commentId: number, reactionType: string) => void
  onEdit: (commentId: number, content: string) => void
  onDelete: (commentId: number) => void
  onToggleHide?: (commentId: number, hidden: boolean) => void
  depth?: number
  /** ID của comment depth=1 (root của thread replies) — dùng để flatten reply từ depth≥2 */
  threadRootId?: number
  /** Tên người được reply (để hiển thị @tag khi depth≥2) */
  replyToName?: string
}

interface ConfirmDialogState {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  variant: 'delete' | 'hide' | 'unhide'
}

const REACTIONS = [
  { type: 'like', icon: ThumbsUp, label: 'Thích', color: 'text-blue-500' },
  { type: 'love', icon: Heart, label: 'Yêu thích', color: 'text-red-500' },
  { type: 'haha', icon: Laugh, label: 'Haha', color: 'text-yellow-500' },
  { type: 'sad', icon: Frown, label: 'Buồn', color: 'text-gray-500' },
  { type: 'angry', icon: Angry, label: 'Phẫn nộ', color: 'text-orange-500' },
]

function CommentItem({
  comment,
  currentUserId,
  currentUserEmail,
  isAdmin,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onToggleHide,
  depth = 0,
  threadRootId,
  replyToName,
}: CommentItemProps) {
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [showReactions, setShowReactions] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [visibleRepliesCount, setVisibleRepliesCount] = useState(0)
  const [optimisticReactions, setOptimisticReactions] = useState<Reaction[]>(
    comment.reactions || [],
  )
  const reactionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reactionsRef = useRef<HTMLDivElement | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isHiding, setIsHiding] = useState(false)
  const [optimisticHidden, setOptimisticHidden] = useState(comment.hidden)

  useEffect(() => {
    setOptimisticHidden(!!comment.hidden)
  }, [comment.hidden])

  // Handle click outside to close reactions popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        reactionsRef.current &&
        !reactionsRef.current.contains(event.target as Node)
      ) {
        setShowReactions(false)
      }
    }

    if (showReactions) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showReactions])

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
    variant: 'delete',
  })

  const handleReply = () => {
    if (replyContent.trim()) {
      // Luôn reply vào comment.id hiện tại — giữ đúng parent_id
      onReply(comment.id, replyContent)
      setReplyContent('')
      setShowReplyBox(false)
    }
  }

  const handleReact = (reactionType: string) => {
    if (!currentUserId) return

    // Clear existing timeout
    if (reactionTimeoutRef.current) {
      clearTimeout(reactionTimeoutRef.current)
    }

    // Optimistic update
    setOptimisticReactions((prev) => {
      const existingReaction = prev.find((r) => r.user_id === currentUserId)

      if (existingReaction) {
        // If same reaction, remove it (toggle off)
        if (existingReaction.type === reactionType) {
          return prev.filter((r) => r.user_id !== currentUserId)
        }
        // If different reaction, update it
        return prev.map((r) =>
          r.user_id === currentUserId ? { ...r, type: reactionType } : r,
        )
      }

      // Add new reaction
      return [...prev, { type: reactionType, user_id: currentUserId }]
    })

    setShowReactions(false)

    // Debounced API call
    reactionTimeoutRef.current = setTimeout(() => {
      onReact(comment.id, reactionType)
    }, 300)
  }

  const handleEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit(comment.id, editContent)
      setIsEditing(false)
    }
  }

  const handleDelete = () => {
    setConfirmDialog({
      open: true,
      title: 'Xóa bình luận',
      description:
        'Bạn có chắc muốn xóa bình luận này? Hành động này không thể hoàn tác.',
      onConfirm: async () => {
        setIsDeleting(true)
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        await onDelete(comment.id)
        setIsDeleting(false)
      },
      variant: 'delete',
    })
  }

  const handleAdminDelete = () => {
    setConfirmDialog({
      open: true,
      title: '⚠️ ADMIN: Xóa bình luận',
      description:
        'Bạn có chắc muốn xóa bình luận này không? Hành động này sẽ xóa vĩnh viễn và không thể khôi phục!',
      onConfirm: async () => {
        setIsDeleting(true)
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        await onDelete(comment.id)
        setIsDeleting(false)
      },
      variant: 'delete',
    })
  }

  const handleAdminHide = () => {
    const isCurrentlyHidden = optimisticHidden

    setConfirmDialog({
      open: true,
      title: isCurrentlyHidden
        ? '👀 ADMIN: Hiện bình luận'
        : '🫣 ADMIN: Ẩn bình luận',
      description: isCurrentlyHidden
        ? 'Hiện lại bình luận này cho người dùng thường xem?'
        : 'Ẩn bình luận này khỏi người dùng thường? Chỉ admin mới nhìn thấy.',
      onConfirm: async () => {
        setIsHiding(true)
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        try {
          if (onToggleHide) {
            await onToggleHide(comment.id, !isCurrentlyHidden)
            setOptimisticHidden(!isCurrentlyHidden)
          }
        } finally {
          setIsHiding(false)
        }
      },
      variant: isCurrentlyHidden ? 'unhide' : 'hide',
    })
  }

  const isOwner = comment.user_id === currentUserId
  const isEdited =
    comment.updated_at && comment.updated_at !== comment.created_at
  const isHidden = optimisticHidden === true

  const userReaction = optimisticReactions?.find(
    (r) => r.user_id === currentUserId,
  )
  const reactionCounts = optimisticReactions?.reduce(
    (acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const timeAgo = (date: string) => {
    // Parse the date string and ensure it's treated as UTC if it doesn't have timezone info
    const commentDate = new Date(date)
    const now = new Date()

    // Calculate difference in seconds
    const seconds = Math.floor((now.getTime() - commentDate.getTime()) / 1000)

    if (seconds < 60) return 'Vừa xong'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} phút trước`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} giờ trước`
    const days = Math.floor(hours / 24)
    return `${days} ngày trước`
  }

  return (
    <div className={`${depth > 0 ? 'mt-2' : 'mt-3'} ${isHidden && !isAdmin ? 'hidden' : ''} ${isHidden && isAdmin ? 'opacity-50' : ''} ${isDeleting ? 'pointer-events-none opacity-30' : ''} ${isHiding ? 'opacity-70' : ''}`}>
      <div className="flex gap-2">
        {/* Cột trái: avatar + đường dọc */}
        <div className="shrink-0 flex flex-col items-center">
          <div className={`flex items-center justify-center rounded-full bg-[#a1001f] font-semibold text-white shrink-0 ${depth > 0 ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm'} ${isHidden ? 'opacity-50' : ''}`}>
            {comment.user_name.charAt(0).toUpperCase()}
          </div>
          {/* Đường dọc — chỉ hiện khi có replies đang mở */}
          {depth < 2 && comment.replies && comment.replies.filter(r => isAdmin || !r.hidden).length > 0 && visibleRepliesCount > 0 && (
            <div className="w-0.5 bg-gray-300 flex-1 mt-1" />
          )}
        </div>

        {/* Cột phải: content + actions + replies */}
        <div className="flex-1 min-w-0">
          {isHidden && isAdmin && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs font-bold rounded">
                <EyeOff className="w-3 h-3" />
                ĐÃ ẨN - Chỉ admin nhìn thấy
              </span>
            </div>
          )}
          <Card className={`border-none bg-muted/50 p-2 min-w-0 ${isHidden && isAdmin ? 'border border-dashed border-gray-400' : ''}`}>
            <div className="font-semibold text-sm text-foreground">{comment.user_name}</div>
            {isEditing ? (
              <div className="mt-1 space-y-2">
                <div className="relative">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-20 resize-none rounded-lg border-2 border-[#e6b8c2] p-2 text-sm transition-colors focus:border-[#a1001f]"
                    placeholder="Chỉnh sửa bình luận của bạn..."
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">{editContent.length} ký tự</div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#e6b8c2] bg-[#fdf2f5] p-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-[#a1001f]">
                    <Edit className="w-3 h-3" />
                    Đang chỉnh sửa bình luận
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditContent(comment.content) }} className="cursor-pointer h-8 hover:bg-gray-200 text-gray-700">Hủy</Button>
                    <Button size="sm" onClick={handleEdit} disabled={!editContent.trim() || editContent === comment.content} className="h-8 cursor-pointer bg-[#a1001f] text-white hover:bg-[#870019]">
                      <Edit className="w-3 h-3 mr-1" />Lưu thay đổi
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {(replyToName || comment._replyToName) && depth >= 1 && (
                    <span className="text-[#a1001f] font-semibold mr-1">{replyToName || comment._replyToName}</span>
                  )}
                  {comment.content}
                </p>
                {isEdited && <span className="text-xs text-muted-foreground italic mt-0.5 block">Đã chỉnh sửa</span>}
              </>
            )}
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 mt-1 px-1">
            {Object.keys(reactionCounts || {}).length > 0 && (
              <div className="flex items-center gap-1 text-xs">
                {Object.entries(reactionCounts || {}).map(([type, count]) => {
                  const reaction = REACTIONS.find((r) => r.type === type)
                  if (!reaction) return null
                  const Icon = reaction.icon
                  return (
                    <div key={type} className="flex items-center gap-0.5">
                      <Icon className={`w-3 h-3 ${reaction.color}`} />
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <div ref={reactionsRef} className="relative" onMouseEnter={() => setShowReactions(true)}>
              <button
                onClick={() => { if (userReaction) { handleReact(userReaction.type) } else { setShowReactions(prev => !prev) } }}
                className={`cursor-pointer text-xs font-semibold transition-all duration-200 ${userReaction ? 'text-[#a1001f]' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {userReaction ? REACTIONS.find((r) => r.type === userReaction.type)?.label : 'Thích'}
              </button>
              {showReactions && (
                <div className="absolute bottom-full left-0 z-10 mb-2 flex gap-1 rounded-full border border-[#e6b8c2] bg-white/95 p-1.5 shadow-2xl backdrop-blur-sm animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
                  {REACTIONS.map((reaction, index) => {
                    const Icon = reaction.icon
                    return (
                      <button key={reaction.type} onClick={() => handleReact(reaction.type)} className={`cursor-pointer rounded-full p-1.5 transition-all duration-200 hover:-translate-y-1 hover:scale-125 hover:bg-[#fdf2f5] transform ${reaction.color} animate-in fade-in-0 zoom-in-50`} style={{ animationDelay: `${index * 30}ms` }} title={reaction.label}>
                        <Icon className="w-6 h-6 drop-shadow-sm" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <button onClick={() => setShowReplyBox(!showReplyBox)} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Trả lời</button>
            {isOwner && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer">
                <Edit className="w-3 h-3" />Sửa
              </button>
            )}
            {isOwner && (
              <button onClick={handleDelete} className="text-xs font-semibold text-muted-foreground hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer">
                <Trash2 className="w-3 h-3" />Xóa
              </button>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>

          {isAdmin && (
            <div className="mt-2 flex gap-2 ml-1">
              <Button size="sm" variant="outline" onClick={handleAdminHide} disabled={isHiding || isDeleting} className={`h-7 px-2 transition-all shadow-sm cursor-pointer ${isHidden ? 'border-green-500 text-green-600 hover:bg-green-50' : 'border-orange-500 text-orange-600 hover:bg-orange-50'}`}>
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                <span className="text-xs font-semibold">{isHiding ? 'Đang xử lý...' : isHidden ? 'Hiện bình luận' : 'Ẩn bình luận'}</span>
                <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded ${isHidden ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>ADMIN</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleAdminDelete} disabled={isDeleting || isHiding} className="h-7 px-2 border-red-500 text-red-600 hover:bg-red-50 transition-all shadow-sm cursor-pointer">
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                <span className="text-xs font-semibold">{isDeleting ? 'Đang xóa...' : 'Xóa bình luận'}</span>
                <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">ADMIN</span>
              </Button>
            </div>
          )}

          {showReplyBox && (
            <div className="mt-2 ml-1">
              <Textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="Viết trả lời..." className="min-h-12 text-sm" />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={handleReply} className="cursor-pointer">Gửi</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReplyBox(false)} className="cursor-pointer">Hủy</Button>
              </div>
            </div>
          )}

          {/* Replies — render bên dưới content, không indent thêm */}
          {depth < 2 && comment.replies && comment.replies.length > 0 && (() => {
            const visibleReplies = isAdmin ? comment.replies : comment.replies.filter((r) => !r.hidden)
            if (visibleReplies.length === 0) return null
            const shownReplies = visibleReplies.slice(0, visibleRepliesCount)
            return (
              <div className="mt-2">
                {visibleRepliesCount === 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setVisibleRepliesCount(2)} className="-ml-2 cursor-pointer text-xs font-medium text-[#a1001f] hover:text-[#870019]">
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Xem {visibleReplies.length} câu trả lời
                  </Button>
                ) : (
                  <>
                    {/* Replies */}
                    <div className="relative">
                      {shownReplies.map((reply, idx) => {
                        return (
                          <div key={reply.id} className="relative mt-2">
                            {/* Đường cong mượt (└) nối từ nhánh dọc chính vào avatar của reply */}
                            <div
                              className="absolute rounded-bl-xl border-l-[2px] border-b-[2px] border-gray-300"
                              style={{
                                height: '24px', // Kéo dài lên trên 24px để đè chặt nét thẳng lên line dọc phía trên
                                width: depth === 0 ? '25px' : '23px', // Bù thêm 1px để mét trái khớp hoàn hảo (che đúng 2px line dọc)
                                left: depth === 0 ? '-25px' : '-23px', 
                                top: '-9px', // Trượt lên -9px -> Đáy của box = -9 + 24 = 15px. Border bottom 2px nằm từ 13px -> 15px, trung tâm là 14px (khớp y xì tâm avatar con h-7)
                              }}
                            />
                            {/* Cột phải: Content của reply */}
                            <div className="w-full min-w-0">
                              <CommentItem
                                comment={reply}
                                currentUserId={currentUserId}
                                currentUserEmail={currentUserEmail}
                                isAdmin={isAdmin}
                                onReply={onReply}
                                onReact={onReact}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onToggleHide={onToggleHide}
                                depth={1}
                                threadRootId={depth === 0 ? comment.id : (threadRootId ?? comment.id)}
                                replyToName={undefined}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {visibleRepliesCount < visibleReplies.length && (
                      <Button variant="ghost" size="sm" onClick={() => setVisibleRepliesCount(prev => Math.min(prev + 2, visibleReplies.length))} className="-ml-2 mt-1 cursor-pointer text-xs font-medium text-[#a1001f] hover:text-[#870019]">
                        <ChevronDown className="w-3 h-3 mr-1" />
                        Xem thêm {Math.min(2, visibleReplies.length - visibleRepliesCount)} câu trả lời
                      </Button>
                    )}
                    {visibleRepliesCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setVisibleRepliesCount(0)} className="text-xs text-muted-foreground hover:text-foreground font-medium mt-1 -ml-2 cursor-pointer">
                        Ẩn câu trả lời
                      </Button>
                    )}
                  </>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* ConfirmDialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-120 p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-0">
          <div className={`p-6 pb-5 relative overflow-hidden ${confirmDialog.variant === 'delete' ? 'bg-linear-to-br from-red-50 via-red-100 to-red-50' : confirmDialog.variant === 'hide' ? 'bg-linear-to-br from-orange-50 via-orange-100 to-orange-50' : 'bg-linear-to-br from-green-50 via-green-100 to-green-50'}`}>
            <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 ${confirmDialog.variant === 'delete' ? 'bg-red-400' : confirmDialog.variant === 'hide' ? 'bg-orange-400' : 'bg-green-300'}`} />
            <div className="flex items-start gap-4 relative z-10">
              <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse shadow-2xl ${confirmDialog.variant === 'delete' ? 'bg-linear-to-br from-red-500 to-red-700 shadow-red-500/50' : confirmDialog.variant === 'hide' ? 'bg-linear-to-br from-orange-500 to-orange-700 shadow-orange-500/50' : 'bg-linear-to-br from-green-500 to-green-700 shadow-green-500/50'}`}>
                {confirmDialog.variant === 'delete' && <AlertTriangle className="w-7 h-7 text-white drop-shadow-lg" />}
                {confirmDialog.variant === 'hide' && <EyeOff className="w-7 h-7 text-white drop-shadow-lg" />}
                {confirmDialog.variant === 'unhide' && <Eye className="w-7 h-7 text-white drop-shadow-lg" />}
              </div>
              <div className="flex-1 pt-1.5">
                <DialogTitle className="text-2xl font-extrabold bg-linear-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent leading-tight mb-2">
                  {confirmDialog.variant === 'delete' ? 'Xóa bình luận' : confirmDialog.variant === 'hide' ? 'Ẩn bình luận' : confirmDialog.variant === 'unhide' ? 'Hiện bình luận' : 'Xác nhận'}
                </DialogTitle>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${confirmDialog.variant === 'delete' ? 'bg-red-200/80 text-red-900' : confirmDialog.variant === 'hide' ? 'bg-orange-200/80 text-orange-900' : 'bg-green-200/80 text-green-900'}`}>
                  <Shield className="w-3 h-3" />
                  {isAdmin ? 'Admin Action' : 'Xác nhận'}
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 bg-white">
            <DialogDescription className="text-base text-gray-700 leading-relaxed font-normal">{confirmDialog.description}</DialogDescription>
          </div>
          <div className="px-6 pb-6 pt-2 bg-linear-to-b from-white to-gray-50">
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))} className="flex-1 h-12 font-bold text-base cursor-pointer bg-white hover:bg-gray-50 transition-all border-2 border-gray-300 hover:border-gray-400 rounded-xl shadow-sm hover:shadow-md">
                <span className="mr-2">✕</span> Hủy bỏ
              </Button>
              <Button onClick={confirmDialog.onConfirm} className={`flex-1 h-12 font-bold text-base cursor-pointer transition-all rounded-xl shadow-lg hover:shadow-xl text-white border-0 hover:scale-105 ${confirmDialog.variant === 'delete' ? 'bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' : confirmDialog.variant === 'hide' ? 'bg-linear-to-r from-orange-600 to-orange-700' : 'bg-linear-to-r from-green-600 to-green-700'}`}>
                {confirmDialog.variant === 'delete' && <><Trash2 className="w-5 h-5 mr-2" /> Xóa ngay</>}
                {confirmDialog.variant === 'hide' && <><EyeOff className="w-5 h-5 mr-2" /> Ẩn ngay</>}
                {confirmDialog.variant === 'unhide' && <><Eye className="w-5 h-5 mr-2" /> Hiện ngay</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CommentsProps {
  postSlug: string
  currentUserId?: string
  currentUserName?: string
  currentUserEmail?: string
  isAdmin?: boolean
}

export default function Comments({
  postSlug,
  currentUserId,
  currentUserName,
  currentUserEmail,
  isAdmin,
}: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingComments, setLoadingComments] = useState(true)
  const [displayCount, setDisplayCount] = useState(5)
  const [sortBy, setSortBy] = useState<'newest' | 'most_reactions'>('newest')
  const [commentImages, setCommentImages] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Debug log for admin status
  useEffect(() => {
    console.log('🔍 Comments Component Debug:', {
      currentUserId,
      currentUserEmail,
      isAdmin,
      isAdminType: typeof isAdmin,
    })
  }, [currentUserId, currentUserEmail, isAdmin])

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/truyenthong/posts/${postSlug}/comments`)
      if (res.ok) {
        const data: Comment[] = await res.json()

        // Flatten comment tree: tối đa 2 tầng (depth 0 và depth 1)
        // Replies sâu hơn được gắn vào tầng 1 với replyToName
        const flattenReplies = (comment: Comment): Comment => {
          if (!comment.replies || comment.replies.length === 0) return comment

          const allReplies: Comment[] = []
          const collectReplies = (replies: Comment[], parentName: string, currentDepth: number) => {
            replies.forEach(reply => {
              if (currentDepth <= 1) {
                // Tầng 1 và 2: giữ nguyên cấu trúc, chỉ flatten replies sâu hơn
                const enriched = {
                  ...reply,
                  _replyToName: currentDepth >= 1 ? parentName : undefined,
                  replies: reply.replies && reply.replies.length > 0
                    ? flattenDeep(reply.replies, reply.user_name)
                    : [],
                }
                allReplies.push(enriched)
              } else {
                // Tầng 3+: flatten về tầng 2
                const enriched = {
                  ...reply,
                  _replyToName: parentName,
                  replies: [],
                }
                allReplies.push(enriched)
                if (reply.replies && reply.replies.length > 0) {
                  collectReplies(reply.replies, reply.user_name, currentDepth)
                }
              }
            })
          }

          // Flatten tất cả replies sâu hơn tầng 2 về tầng 2
          const flattenDeep = (replies: Comment[], parentName: string): Comment[] => {
            const result: Comment[] = []
            replies.forEach(reply => {
              result.push({
                ...reply,
                _replyToName: parentName,
                replies: [],
              })
              if (reply.replies && reply.replies.length > 0) {
                result.push(...flattenDeep(reply.replies, reply.user_name))
              }
            })
            return result
          }

          collectReplies(comment.replies, comment.user_name, 0)
          return { ...comment, replies: allReplies }
        }

        setComments(data.map(flattenReplies))
      }
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }, [postSlug])

  // Load comments on mount
  useEffect(() => {
    loadComments()
  }, [postSlug, loadComments])

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/truyenthong/posts/${postSlug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          userName: currentUserName || 'Anonymous',
          userEmail: currentUserEmail,
          content: newComment,
          images: commentImages,
          parentId: null,
        }),
      })

      if (res.ok) {
        setNewComment('')
        setCommentImages([])
        await loadComments()
      }
    } catch (error) {
      console.error('Error posting comment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Ảnh không được vượt quá 5MB')
          return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            setCommentImages((prev) => [...prev, e.target!.result as string])
          }
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(file)
          handleImageUpload(dataTransfer.files)
        }
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleImageUpload(e.dataTransfer.files)
  }

  const removeImage = (index: number) => {
    setCommentImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleReply = async (parentId: number, content: string) => {
    if (!currentUserId) return

    try {
      const res = await fetch(`/api/truyenthong/posts/${postSlug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          userName: currentUserName || 'Anonymous',
          userEmail: currentUserEmail,
          content,
          parentId,
        }),
      })

      if (res.ok) {
        await loadComments()
      }
    } catch (error) {
      console.error('Error posting reply:', error)
    }
  }

  const handleReact = async (commentId: number, reactionType: string) => {
    if (!currentUserId) return

    try {
      const res = await fetch(`/api/truyenthong/comments/${commentId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          reactionType,
        }),
      })

      if (res.ok) {
        await loadComments()
      }
    } catch (error) {
      console.error('Error reacting to comment:', error)
    }
  }

  const handleEdit = async (commentId: number, content: string) => {
    if (!currentUserId) return

    try {
      const res = await fetch(`/api/truyenthong/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          content,
        }),
      })

      if (res.ok) {
        await loadComments()
      }
    } catch (error) {
      console.error('Error editing comment:', error)
    }
  }

  const handleDelete = async (commentId: number) => {
    if (!currentUserId) return

    try {
      const url = isAdmin
        ? `/api/truyenthong/comments/${commentId}?userId=${currentUserId}&userEmail=${encodeURIComponent(currentUserEmail || '')}`
        : `/api/truyenthong/comments/${commentId}?userId=${currentUserId}`

      const res = await fetch(url, {
        method: 'DELETE',
      })

      if (res.ok) {
        await loadComments()
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  const handleToggleHide = async (commentId: number, hidden: boolean) => {
    if (!isAdmin || !currentUserEmail) {
      throw new Error('Thiếu quyền hoặc email')
    }

    try {
      const res = await fetch(`/api/truyenthong/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: currentUserEmail,
          hidden,
        }),
      })

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string
          details?: string
        }
        const msg =
          errBody.details || errBody.error || 'Không thể ẩn/hiện bình luận'
        toast.error(msg)
        throw new Error(msg)
      }

      await loadComments()
    } catch (e) {
      if (e instanceof TypeError) {
        toast.error('Không kết nối được máy chủ')
      }
      throw e
    }
  }

  // Sort and paginate comments
  const sortedComments = useMemo(() => {
    const sorted = [...comments]
    if (sortBy === 'newest') {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    } else if (sortBy === 'most_reactions') {
      sorted.sort((a, b) => {
        const aCount = a.reactions?.length || 0
        const bCount = b.reactions?.length || 0
        return bCount - aCount
      })
    }
    return sorted
  }, [comments, sortBy])

  const displayedComments = sortedComments.slice(0, displayCount)
  const hasMoreComments = sortedComments.length > displayCount

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + 5)
  }

  return (
    <section className="mt-8 border-t border-[#e6b8c2] pt-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
        <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
        Bình luận ({comments.length})
        {isAdmin && (
          <span className="ml-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
            ADMIN MODE
          </span>
        )}
      </h2>

      {/* New Comment Box */}
      {currentUserId ? (
        <div className="mb-6">
          <div
            className={`relative rounded-lg border transition-all ${
              isDragging
                ? 'border-[#a1001f] bg-[#fdf2f5] ring-2 ring-[#a1001f]/15'
                : 'border-gray-300 bg-white focus-within:border-[#a1001f] focus-within:ring-2 focus-within:ring-[#a1001f]/15'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onPaste={handlePaste}
              placeholder="Viết bình luận... (Ctrl+V để dán ảnh)"
              className="min-h-24 resize-none border-0 bg-transparent focus-visible:ring-0"
            />

            {/* Image Previews */}
            {commentImages.length > 0 && (
              <div className="px-3 pb-3 flex gap-2 flex-wrap">
                {commentImages.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <Image
                      src={img}
                      alt={`Preview ${idx + 1}`}
                      width={100}
                      height={100}
                      className="rounded-lg border border-[#efc9d1] object-cover"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleImageUpload(e.target.files)}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 h-9 border-red-200 text-[#a1001f] hover:bg-red-50"
            >
              <ImageIcon className="w-4 h-4" />
              Thêm ảnh
            </Button>
            <Button
              onClick={handleSubmitComment}
              disabled={loading || !newComment.trim()}
              className="gap-2 h-9 bg-[#a1001f] hover:bg-[#870019] text-white"
            >
              {loading ? 'Đang gửi...' : 'Đăng bình luận'}
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            💡 Bạn có thể kéo thả hoặc Ctrl+V để dán ảnh vào bình luận
          </p>
        </div>
      ) : (
        <Card className="p-3 mb-6 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Vui lòng đăng nhập để bình luận
          </p>
        </Card>
      )}

      {/* Comments List */}
      {loadingComments ? (
        <div className="text-center py-8 text-muted-foreground">
          Đang tải bình luận...
        </div>
      ) : comments.length === 0 ? (
        <Card className="p-8 text-center bg-red-50/30 border border-red-200 rounded-xl">
          <p className="text-muted-foreground">
            Chưa có bình luận nào. Hãy là người đầu tiên!
          </p>
        </Card>
      ) : (
        <div>
          {/* Filter Buttons */}
          <div className="mb-6 border-b border-[#e6b8c2] pb-4">
            <span className="block text-sm font-medium text-muted-foreground">
              Sắp xếp theo:
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={sortBy === 'newest' ? 'default' : 'outline'}
                onClick={() => {
                  setSortBy('newest')
                  setDisplayCount(5)
                }}
                className={`flex cursor-pointer items-center gap-1.5 ${sortBy === 'newest' ? 'border-[#a1001f] bg-[#a1001f] text-white hover:bg-[#870019]' : 'border-[#d8a1ae] text-[#a1001f] hover:bg-[#fdf2f5]'}`}
              >
                <Clock className="w-4 h-4" />
                Mới nhất
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'most_reactions' ? 'default' : 'outline'}
                onClick={() => {
                  setSortBy('most_reactions')
                  setDisplayCount(5)
                }}
                className={`flex cursor-pointer items-center gap-1.5 ${sortBy === 'most_reactions' ? 'border-[#a1001f] bg-[#a1001f] text-white hover:bg-[#870019]' : 'border-[#d8a1ae] text-[#a1001f] hover:bg-[#fdf2f5]'}`}
              >
                <TrendingUp className="w-4 h-4" />
                Nhiều cảm xúc nhất
              </Button>
            </div>
          </div>

          {/* Comments */}
          <div>
            {displayedComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                currentUserEmail={currentUserEmail}
                isAdmin={isAdmin}
                onReply={handleReply}
                onReact={handleReact}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleHide={handleToggleHide}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMoreComments && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                className="flex cursor-pointer items-center gap-2 border-[#d8a1ae] text-[#a1001f] hover:bg-[#fdf2f5]"
              >
                <ChevronDown className="w-4 h-4" />
                Xem thêm bình luận ({sortedComments.length - displayCount} còn
                lại)
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
