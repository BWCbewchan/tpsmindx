'use client'

import { lockBodyScroll, unlockBodyScroll } from '@/lib/body-scroll-lock'
import { Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface BirthdayPerson {
  id: number
  name: string
  date: string
  masked?: boolean
  avatar_url?: string | null
}

interface SenderCandidate {
  name: string
  email?: string
}

interface BirthdaySendWishPopupProps {
  isOpen: boolean
  onClose: () => void
  currentWeek: number
  currentMonth: number
  currentYear: number
  userArea: string | null
  birthdays: BirthdayPerson[]
  senderCandidates: SenderCandidate[]
  fallbackSenderEmail?: string | null
}

function normalizeNameToEmail(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')

  return `${normalized || 'teacher'}@mindx.local`
}

export function BirthdaySendWishPopup({
  isOpen,
  onClose,
  currentWeek,
  currentMonth,
  currentYear,
  userArea,
  birthdays,
  senderCandidates,
  fallbackSenderEmail,
}: BirthdaySendWishPopupProps) {
  const [senderName, setSenderName] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)

  const visibleBirthdays = useMemo(
    () => birthdays.filter((b) => !b.masked),
    [birthdays],
  )

  const senderOptions = useMemo(() => {
    const map = new Map<string, SenderCandidate>()

    senderCandidates.forEach((candidate) => {
      const name = candidate.name?.trim()
      if (!name) return
      map.set(name, { name, email: candidate.email || undefined })
    })

    return Array.from(map.values())
  }, [senderCandidates])

  const receiverOptions = useMemo(() => {
    return visibleBirthdays.filter((person) => person.name !== senderName)
  }, [visibleBirthdays, senderName])

  useEffect(() => {
    if (!isOpen) return

    if (!senderName && senderOptions.length > 0) {
      setSenderName(senderOptions[0].name)
    }
  }, [isOpen, senderName, senderOptions])

  useEffect(() => {
    if (!isOpen) return

    if (receiverOptions.length === 0) {
      setReceiverName('')
      return
    }

    const exists = receiverOptions.some((item) => item.name === receiverName)
    if (!receiverName || !exists) {
      setReceiverName(receiverOptions[0].name)
    }
  }, [isOpen, receiverName, receiverOptions])

  const handleClosePopup = () => {
    setError(null)
    setSuccessMessage(null)
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    onClose()
  }

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClosePopup()
    }

    window.addEventListener('keydown', handleEscape)
    lockBodyScroll()
    return () => {
      window.removeEventListener('keydown', handleEscape)
      unlockBodyScroll()
    }
  }, [isOpen, onClose])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  if (!isOpen || !isMounted) return null

  const handleSubmitWish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedMessage = message.trim()
    if (!senderName) {
      setError('Vui lòng chọn người gửi lời chúc')
      return
    }

    if (!receiverName) {
      setError('Vui lòng chọn người nhận lời chúc')
      return
    }

    if (senderName === receiverName) {
      setError('Không cần gửi lời chúc cho bản thân giáo viên')
      return
    }

    if (!trimmedMessage) {
      setError('Vui lòng nhập nội dung lời chúc')
      return
    }

    if (trimmedMessage.length > 500) {
      setError('Lời chúc tối đa 500 ký tự')
      return
    }

    const selectedSender = senderOptions.find(
      (option) => option.name === senderName,
    )
    const senderEmail =
      selectedSender?.email ||
      fallbackSenderEmail ||
      normalizeNameToEmail(senderName)

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/birthday-wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          week: currentWeek,
          year: currentYear,
          area: userArea,
          birthdayNames: [receiverName],
          senderName,
          senderEmail,
          message: trimmedMessage,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không gửi được lời chúc')
      }

      setError(null)
      setSuccessMessage('Lời chúc của bạn đã được gửi đi')
      closeTimeoutRef.current = window.setTimeout(() => {
        setMessage('')
        setSuccessMessage(null)
        handleClosePopup()
      }, 1000)
    } catch (submitError: any) {
      setError(submitError?.message || 'Không gửi được lời chúc')
    } finally {
      setIsSubmitting(false)
    }
  }

  const messageLength = message.length
  const counterTone = messageLength > 450 ? 'text-amber-200' : 'text-white/75'

  const popupContent = (
    <div className="fixed inset-0 z-9999">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClosePopup}
      />
      <div className="relative z-10 flex h-full w-full items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
        <div className="relative w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-3xl border border-white/20 bg-[#a1001f] shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
          <div className="relative flex items-start justify-between border-b border-white/15 px-5 py-4">
            <div>
              <h3 className="text-lg font-extrabold tracking-tight text-white">
                Gửi lời chúc sinh nhật
              </h3>
              <p className="mt-1 text-xs text-rose-100/90">
                Một lời chúc ngắn gọn, ấm áp sẽ được gửi tới giáo viên bạn chọn.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl p-1.5 text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              onClick={handleClosePopup}
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            onSubmit={handleSubmitWish}
            className="relative space-y-4 px-5 py-5 sm:px-6 sm:py-6"
          >
            <div className="grid grid-cols-1 gap-3">
              <label className="text-xs font-semibold text-white">
                Gửi tới
                <select
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-white/35 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-rose-200 focus:ring-2 focus:ring-rose-200"
                >
                  {receiverOptions.length === 0 && (
                    <option value="">Không có giáo viên phù hợp</option>
                  )}
                  {receiverOptions.map((person) => (
                    <option
                      key={person.id}
                      value={person.name}
                      className="text-gray-900"
                    >
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-xs font-semibold text-white">
              Nội dung lời chúc
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={5}
                placeholder="Nhập lời chúc sinh nhật"
                className="mt-1 w-full resize-none rounded-2xl border border-white/35 bg-white px-3 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-rose-200 focus:ring-2 focus:ring-rose-200"
              />
            </label>

            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/20"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-white/80 transition-all"
                style={{
                  width: `${Math.min((messageLength / 500) * 100, 100)}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className={`text-[11px] font-semibold ${counterTone}`}>
                {messageLength}/500 ký tự
              </p>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !senderName ||
                  !receiverName ||
                  !!successMessage
                }
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#8d1425] shadow-md transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Đang gửi...' : 'Gửi lời chúc'}
                </span>
              </button>
            </div>

            {error && (
              <p className="rounded-xl border border-red-200/40 bg-red-400/30 px-3 py-2 text-sm text-red-50">
                {error}
              </p>
            )}

            {successMessage && (
              <p className="rounded-xl border border-emerald-200/50 bg-emerald-400/25 px-3 py-2 text-sm text-emerald-50">
                {successMessage}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )

  return createPortal(popupContent, document.body)
}
