'use client'

import { Calendar, Clock, ArrowRight, Users, Lock } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'

import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { BirthdayWishPopup } from '@/components/birthday-wish-popup'
import { BirthdaySendWishPopup } from '@/components/birthday-send-wish-popup'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'

interface Post {
    id: string | number
    slug: string
    title: string
    description: string
    post_type: string
    published_at: string
    created_at: string
}

interface EventSchedule {
    id: string
    title: string
    specialty?: string | null
    event_type: string
    start_at: string
    end_at: string
    note?: string | null
}

interface EventSchedulesResponse {
    success: boolean
    data: EventSchedule[]
    count: number
}

interface Birthday {
    id: number
    name: string
    date: string
    month: number
    day: number
    teachingLevel: string
    masked?: boolean
    isCurrentUser?: boolean
    avatar_url?: string | null
}

interface SenderCandidate {
    name: string
    email?: string
}

interface BirthdaysResponse {
    success: boolean
    data: Birthday[]
    month: number
    week: number
    weekRange: { start: number; end: number }
    userArea: string | null
    resolvedUsernameLms?: string | null
    usernameUsed?: string | null
    fromCache?: boolean
    count: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())
const BIRTHDAY_PRIVACY_SYNC_KEY = 'birthday-privacy-updated-at'
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh'
const BIRTHDAY_POPUP_SHOW_NEXT_LOGIN_KEY = 'birthday-popup-show-next-login'
const BIRTHDAY_POPUP_SESSION_SHOWN_PREFIX = 'birthday-popup-session-shown'

function getCurrentWeek(day: number): number {
    if (day <= 7) return 1
    if (day <= 14) return 2
    if (day <= 21) return 3
    return 4
}

function getWeekRange(week: number, year: number, month: number): { start: number; end: number } {
    const daysInMonth = new Date(year, month, 0).getDate()
    if (week === 1) return { start: 1, end: 7 }
    if (week === 2) return { start: 8, end: 14 }
    if (week === 3) return { start: 15, end: 21 }
    return { start: 22, end: daysInMonth }
}

function getTimeZoneDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date)

    const year = Number(parts.find((part) => part.type === 'year')?.value || 0)
    const month = Number(parts.find((part) => part.type === 'month')?.value || 0)
    const day = Number(parts.find((part) => part.type === 'day')?.value || 0)

    return { year, month, day }
}

function toYmdNumber(year: number, month: number, day: number): number {
    return year * 10000 + month * 100 + day
}

export function UpcomingEventsSidebar() {
    const { user, token } = useAuth()
    const [privacySyncToken, setPrivacySyncToken] = useState<string | null>(null)
    const [isWishPopupOpen, setIsWishPopupOpen] = useState(false)
    const [isSendWishPopupOpen, setIsSendWishPopupOpen] = useState(false)
    const [isPopupPreferenceDialogOpen, setIsPopupPreferenceDialogOpen] = useState(false)

    const birthdaysApiUrl = useMemo(() => {
        const params = new URLSearchParams()
        if (privacySyncToken) {
            params.set('refresh', privacySyncToken)
        }
        const queryString = params.toString()
        return queryString ? `/api/birthdays?${queryString}` : '/api/birthdays'
    }, [privacySyncToken])

    // Debounce URL để tránh refetch liên tục khi auth state thay đổi trong thời gian ngắn.
    const [debouncedBirthdaysApiUrl, setDebouncedBirthdaysApiUrl] = useState(birthdaysApiUrl)

    const birthdaysFetcher = useCallback(
        async (url: string) => {
            const res = await fetch(url, { headers: authHeaders(token) })
            return res.json()
        },
        [token],
    )

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedBirthdaysApiUrl(birthdaysApiUrl)
        }, 300)

        return () => window.clearTimeout(timer)
    }, [birthdaysApiUrl])

    const vietnamNow = useMemo(() => getTimeZoneDateParts(new Date(), VIETNAM_TIMEZONE), [])
    const currentWeekForEvents = getCurrentWeek(vietnamNow.day)
    const currentMonthForEvents = vietnamNow.month
    const currentYearForEvents = vietnamNow.year
    const eventsWeekRange = getWeekRange(currentWeekForEvents, currentYearForEvents, currentMonthForEvents)
    const weekStartKey = toYmdNumber(currentYearForEvents, currentMonthForEvents, eventsWeekRange.start)
    const weekEndKey = toYmdNumber(currentYearForEvents, currentMonthForEvents, eventsWeekRange.end)

    const eventsApiUrl = useMemo(() => {
        const monthString = `${currentYearForEvents}-${String(currentMonthForEvents).padStart(2, '0')}`
        return `/api/event-schedules?month=${monthString}`
    }, [currentMonthForEvents, currentYearForEvents])

    const { data: eventSchedulesResponse } = useSWR<EventSchedulesResponse>(eventsApiUrl, fetcher, {
        dedupingInterval: 60_000,
        revalidateOnFocus: false,
    })

    const {
        data: birthdaysResponse,
        mutate: mutateBirthdays,
        isLoading: isBirthdaysLoading,
        isValidating: isBirthdaysValidating
    } = useSWR<BirthdaysResponse>(
        user?.email ? debouncedBirthdaysApiUrl : null,
        birthdaysFetcher,
        {
        keepPreviousData: true,
        dedupingInterval: 10_000,
        revalidateOnFocus: false,
    })

    // Listen cho privacy setting changes và revalidate birthdays cache
    useEffect(() => {
        const syncBirthdayPrivacyChanges = () => {
            const updatedAt = window.localStorage.getItem(BIRTHDAY_PRIVACY_SYNC_KEY)
            if (!updatedAt) return

            console.log('[Birthday Sidebar] Detected persisted privacy change, scheduling fresh fetch...')
            setPrivacySyncToken(updatedAt)
        }

        const handlePrivacyChange = () => {
            console.log('[Birthday Sidebar] Privacy setting changed event received, revalidating...')
            mutateBirthdays()
        }

        const handleWindowFocus = () => {
            syncBirthdayPrivacyChanges()
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncBirthdayPrivacyChanges()
            }
        }

        window.addEventListener('privacy-setting-changed', handlePrivacyChange)
        window.addEventListener('focus', handleWindowFocus)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        
        // Defer initial sync to avoid synchronous setState during render/mount phase
        const timer = setTimeout(() => {
            syncBirthdayPrivacyChanges()
        }, 0)
        
        console.log('[Birthday Sidebar] Event listener registered')
        
        return () => {
            clearTimeout(timer)
            window.removeEventListener('privacy-setting-changed', handlePrivacyChange)
            window.removeEventListener('focus', handleWindowFocus)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            console.log('[Birthday Sidebar] Event listener removed')
        }
    }, [mutateBirthdays])

    useEffect(() => {
        if (!privacySyncToken || !birthdaysResponse) return

        window.localStorage.removeItem(BIRTHDAY_PRIVACY_SYNC_KEY)
        const timer = setTimeout(() => {
            setPrivacySyncToken(null)
        }, 0)
        return () => clearTimeout(timer)
    }, [privacySyncToken, birthdaysResponse])

    // Lấy lịch sự kiện thuộc tuần hiện tại trong tháng hiện tại (4 tuần/tháng)
    const upcomingEvents = useMemo(() => {
        const rows = eventSchedulesResponse?.data || []

        const filtered = rows.filter((event) => {
            const start = new Date(event.start_at)
            const end = new Date(event.end_at)

            const startParts = getTimeZoneDateParts(start, VIETNAM_TIMEZONE)
            const endParts = getTimeZoneDateParts(end, VIETNAM_TIMEZONE)
            const startKey = toYmdNumber(startParts.year, startParts.month, startParts.day)
            const endKey = toYmdNumber(endParts.year, endParts.month, endParts.day)

            // Event overlap tuần hiện tại theo ngày VN: start <= weekEnd && end >= weekStart
            return startKey <= weekEndKey && endKey >= weekStartKey
        })

        return filtered
            .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
            .slice(0, 3)
    }, [eventSchedulesResponse?.data, weekStartKey, weekEndKey])

    // Get birthdays from API
    const upcomingBirthdays = useMemo(() => {
        return birthdaysResponse?.data || []
    }, [birthdaysResponse])

    // Only show birthdays for users who have not masked their info
    const visibleBirthdays = useMemo(() => upcomingBirthdays.filter((p) => !p.masked), [upcomingBirthdays])

    const hasCurrentUserBirthday = useMemo(
        () => upcomingBirthdays.some((person) => person.isCurrentUser),
        [upcomingBirthdays]
    )

    const showBirthdaysLoading = (isBirthdaysLoading || isBirthdaysValidating) && upcomingBirthdays.length === 0

    const currentWeek = birthdaysResponse?.week ?? getCurrentWeek(vietnamNow.day)
    const currentMonth = birthdaysResponse?.month ?? vietnamNow.month
    const currentYear = vietnamNow.year
    const userArea = birthdaysResponse?.userArea ?? null

    const userLoginKey = useMemo(() => user?.email?.toLowerCase() || 'guest', [user?.email])
    const popupShownThisSessionKey = `${BIRTHDAY_POPUP_SESSION_SHOWN_PREFIX}:${userLoginKey}`

    useEffect(() => {
        if (showBirthdaysLoading || isWishPopupOpen || isSendWishPopupOpen) return
        if (!hasCurrentUserBirthday) return

        const showNextLogin = window.localStorage.getItem(BIRTHDAY_POPUP_SHOW_NEXT_LOGIN_KEY)
        if (showNextLogin === '0') return

        const hasShownThisSession = window.sessionStorage.getItem(popupShownThisSessionKey)
        if (hasShownThisSession === '1') return

        window.sessionStorage.setItem(popupShownThisSessionKey, '1')
        setIsWishPopupOpen(true)
    }, [
        hasCurrentUserBirthday,
        showBirthdaysLoading,
        isWishPopupOpen,
        isSendWishPopupOpen,
        popupShownThisSessionKey,
    ])

    const handleWishPopupClose = () => {
        setIsWishPopupOpen(false)
        setIsPopupPreferenceDialogOpen(true)
    }

    const handleEnablePopupNextLogin = () => {
        window.localStorage.setItem(BIRTHDAY_POPUP_SHOW_NEXT_LOGIN_KEY, '1')
        setIsPopupPreferenceDialogOpen(false)
    }

    const handleDisablePopupNextLogin = () => {
        window.localStorage.setItem(BIRTHDAY_POPUP_SHOW_NEXT_LOGIN_KEY, '0')
        setIsPopupPreferenceDialogOpen(false)
    }

    const shouldHideSidebarCards = isWishPopupOpen

    const senderCandidates = useMemo<SenderCandidate[]>(() => {
        const map = new Map<string, SenderCandidate>()

        if (user?.displayName?.trim()) {
            map.set(user.displayName.trim(), {
                name: user.displayName.trim(),
                email: user.email,
            })
        }

        upcomingBirthdays
            .filter((person) => !person.masked)
            .forEach((person) => {
                const name = person.name?.trim()
                if (!name || map.has(name)) return
                map.set(name, { name })
            })

        return Array.from(map.values())
    }, [upcomingBirthdays, user?.displayName, user?.email])

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const parts = getTimeZoneDateParts(date, VIETNAM_TIMEZONE)
        return { day: parts.day, month: parts.month }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleTimeString('vi-VN', { timeZone: VIETNAM_TIMEZONE, hour: '2-digit', minute: '2-digit' })
    }

    const getEventTypeLabel = (eventType: string) => {
        const labels: Record<string, string> = {
            registration: 'Đăng ký',
            exam: 'Kiểm tra',
            workshop_teaching: 'Workshop',
            meeting: 'Họp',
            advanced_training_release: 'Mở đào tạo',
            holiday: 'Nghỉ lễ'
        }

        return labels[eventType] || 'Sự kiện'
    }

    const getMonthName = (month: number) => {
        const months = ['', 'THÁNG 1', 'THÁNG 2', 'THÁNG 3', 'THÁNG 4', 'THÁNG 5', 'THÁNG 6',
            'THÁNG 7', 'THÁNG 8', 'THÁNG 9', 'THÁNG 10', 'THÁNG 11', 'THÁNG 12']
        return months[month]
    }

    return (
        <>
        <div className={shouldHideSidebarCards ? 'hidden' : 'space-y-6 animate-in fade-in slide-in-from-right duration-700'}>
            {/* Upcoming Events Section */}
            <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="p-5 border-b border-gray-100 bg-linear-to-r from-gray-50 to-white">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-600" />
                        <span>Sự kiện sắp tới</span>
                    </h3>
                </div>
                
                <div className="p-5 space-y-3">
                    {upcomingEvents.length > 0 ? (
                        <>
                            {upcomingEvents.map((event, index) => {
                                const { day, month } = formatDate(event.start_at)
                                return (
                                    <div
                                        key={`${event.id || event.title || 'event'}-${event.start_at || ''}-${index}`}
                                        className="flex gap-4 group hover:bg-linear-to-r hover:from-red-50 hover:to-orange-50 -mx-3 px-3 py-3 rounded-xl transition-all duration-200 border border-transparent hover:border-red-100 hover:shadow-md"
                                    >
                                        <div className="shrink-0">
                                            <div className="w-14 h-16 bg-linear-to-br from-red-600 to-red-700 rounded-xl flex flex-col items-center justify-center text-white shadow-lg shadow-red-200 group-hover:shadow-xl group-hover:shadow-red-300 group-hover:scale-105 transition-all duration-200">
                                                <div className="text-[10px] font-bold uppercase tracking-wide opacity-90">
                                                    Th {month}
                                                </div>
                                                <div className="text-2xl font-black leading-none mt-0.5">
                                                    {day}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-red-700 transition-colors leading-snug mb-1.5">
                                                {event.title}
                                            </h4>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500 group-hover:text-red-600 transition-colors">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span className="font-medium">{formatTime(event.start_at)} - {formatTime(event.end_at)}</span>
                                            </div>
                                            <div className="mt-1 text-[11px] text-gray-500 font-semibold uppercase tracking-wide">
                                                {getEventTypeLabel(event.event_type)}{event.specialty ? ` • ${event.specialty}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            
                            <Button variant="outline" size="default" className="w-full mt-4" asChild>
                                <Link href="/user/hoat-dong-hang-thang">
                                    Xem toàn bộ lịch
                                    <Icon icon={ArrowRight} size="sm" />
                                </Link>
                            </Button>
                        </>
                    ) : (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Calendar className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="text-sm font-medium text-gray-500">Chưa có sự kiện sắp tới</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Upcoming Birthdays Section */}
            <div className="bg-red-900 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="p-4 border-b border-white/10 bg-red-800">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                        <span className="text-xl">🎂</span>
                        <span>
                            Sinh nhật tuần {currentWeek} - Tháng {currentMonth}
                        </span>
                    </h3>
                    {userArea && <span className="text-white text-sm ml-1 font-normal normal-case opacity-80">Khu vực: {userArea}</span>}
                    {showBirthdaysLoading && (
                        <div className="text-white/75 text-xs mt-1 animate-pulse">Đang chuẩn bị bánh sinh nhật...</div>
                    )}
                </div>
                
                <div className="p-4 space-y-2">
                    {showBirthdaysLoading ? (
                        <>
                            {[1, 2, 3].map((item) => (
                                <div
                                    key={`birthday-skeleton-${item}`}
                                    className="flex items-center gap-3 -mx-2 px-2.5 py-2.5 rounded-xl bg-white/10 border border-white/10 animate-pulse"
                                >
                                    <div className="w-10 h-10 rounded-full bg-white/20 shrink-0" />
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="h-3.5 w-2/3 rounded bg-white/25" />
                                        <div className="h-3 w-1/2 rounded bg-white/20" />
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : visibleBirthdays.length > 0 ? visibleBirthdays.map((person: Birthday) => (
                        <div 
                            key={person.id} 
                            className={`flex items-center gap-3 text-white -mx-2 px-2.5 py-2.5 rounded-xl transition-all duration-200 border backdrop-blur-sm group ${
                                person.masked
                                    ? 'bg-white/5 border-white/5 opacity-60 cursor-default'
                                    : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
                            }`}
                        >
                            <div className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-200 overflow-hidden">
                                {person.masked ? (
                                    <Lock className="w-4 h-4 text-white/70" />
                                ) : person.avatar_url ? (
                                    <img 
                                        src={person.avatar_url} 
                                        alt={person.name} 
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-white font-bold text-sm">
                                        {person.name ? person.name.charAt(0).toUpperCase() : <Users className="w-4.5 h-4.5" />}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`font-bold text-sm tracking-wide ${
                                    person.masked ? 'italic text-white/70' : ''
                                }`}>{person.name}</div>
                                <div className="text-xs text-white/80 font-medium mt-0.5">
                                    {person.date}{person.masked ? ' • Đã ẩn thông tin' : person.teachingLevel ? ` • ${person.teachingLevel}` : ''}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-6">
                            <div className="text-3xl mb-2">🎉</div>
                            <p className="text-sm text-white/70 font-medium">Không có sinh nhật tuần này</p>
                        </div>
                    )}
                </div>

                <div className="px-4 pb-4">
                    <Button
                        variant="outline"
                        size="default"
                        className="w-full bg-white/15 hover:bg-white text-white hover:text-red-700 border-white/30 hover:border-white"
                        onClick={() => setIsSendWishPopupOpen(true)}
                    >
                        Gửi lời chúc ngay
                        <span className="group-hover:scale-125 transition-transform">💌</span>
                    </Button>
                  
                </div>
            </div>
        </div>

            <BirthdayWishPopup
                isOpen={isWishPopupOpen}
                onClose={handleWishPopupClose}
                currentWeek={currentWeek}
                currentMonth={currentMonth}
                currentYear={currentYear}
                userArea={userArea}
                birthdays={upcomingBirthdays}
            />

            <BirthdaySendWishPopup
                isOpen={isSendWishPopupOpen}
                onClose={() => setIsSendWishPopupOpen(false)}
                currentWeek={currentWeek}
                currentMonth={currentMonth}
                currentYear={currentYear}
                userArea={userArea}
                birthdays={upcomingBirthdays}
                senderCandidates={senderCandidates}
                fallbackSenderEmail={user?.email || null}
            />

            {isPopupPreferenceDialogOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-9999 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
                    onClick={() => setIsPopupPreferenceDialogOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-white/70 bg-white shadow-2xl overflow-hidden"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="h-1.5 bg-[#a1001f]" />
                        <div className="p-5">
                            <h3 className="text-lg font-bold text-gray-900">Hiển thị lại popup sinh nhật?</h3>
                            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                                Khi bạn đăng nhập lại web lần sau, bạn có muốn tiếp tục tự động hiển thị popup chúc mừng sinh nhật không?
                            </p>

                            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={handleDisablePopupNextLogin}
                                    className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                    Không, ẩn lần sau
                                </button>
                                <button
                                    type="button"
                                    onClick={handleEnablePopupNextLogin}
                                    className="rounded-xl bg-[#a1001f] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#8a001a]"
                                >
                                    Có, tiếp tục hiển thị
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
