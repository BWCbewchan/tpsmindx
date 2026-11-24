'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { toast } from '@/lib/app-toast'
import { getPushPlatformState, isIosUserAgent, urlBase64ToUint8Array, type PushUnsupportedReason } from '@/lib/push-notifications'
import { pushApi, readyPushRegistration, savePushSubscription, subscriptionUsesKey } from '@/lib/device-push-client'
import { Modal } from '@/components/ui/modal'
import { InstallTpsApp } from './InstallTpsApp'
import useSWR from 'swr'
import { authHeaders } from '@/lib/auth-headers'

type State = {
  checking: boolean; busy: boolean; enabled: boolean
  permission: NotificationPermission | 'unsupported'
  reason: PushUnsupportedReason | null; publicKey: string; error: string | null
}
const initial: State = { checking: true, busy: false, enabled: false, permission: 'unsupported', reason: null, publicKey: '', error: null }
const Context = createContext<{ state: State; enable: () => Promise<void>; disable: () => Promise<void>; test: () => Promise<void>; refresh: () => Promise<void> } | null>(null)
const offKey = (email: string) => `tps:device-push:off:${email.toLowerCase()}`
function isOff(email: string) { try { return localStorage.getItem(offKey(email)) === '1' } catch { return false } }

export function DevicePushProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading } = useAuth()
  const email = user?.email || ''
  const [state, setState] = useState<State>(initial)
  const [prompt, setPrompt] = useState(false)
  const reminded = useRef(new Set<string>())
  const generation = useRef(0)
  const actionBusy = useRef(false)
  const identity = useRef({ email, token })
  identity.current = { email, token }
  const { data: unread } = useSWR(email && token && !isLoading ? '/api/notifications/unread-count' : null, async (url: string) => {
    const response = await fetch(url, { headers: authHeaders(token), signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error('Không thể cập nhật số thông báo')
    return response.json()
  }, { refreshInterval: 60000, refreshWhenHidden: false, refreshWhenOffline: false })
  useEffect(() => {
    const device = navigator as Navigator & { setAppBadge?: (count: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    if (!email || unread?.count === 0) void device.clearAppBadge?.().catch(() => {})
    else if (Number(unread?.count) > 0) void device.setAppBadge?.(Number(unread.count)).catch(() => {})
  }, [email, unread?.count])

  const refresh = useCallback(async () => {
    if (isLoading || !email || !token || actionBusy.current) return
    const version = ++generation.current
    setState(current => ({ ...current, checking: true, error: null }))
    try {
      const data = await pushApi(token)
      const platform = getPushPlatformState({
        configured: Boolean(data.configured && data.public_key), secureContext: window.isSecureContext,
        notificationSupported: 'Notification' in window, serviceWorkerSupported: 'serviceWorker' in navigator,
        pushManagerSupported: 'PushManager' in window,
        ios: isIosUserAgent(navigator.userAgent, navigator.maxTouchPoints),
        standalone: window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      })
      const permission = 'Notification' in window ? Notification.permission : 'unsupported'
      let enabled = false
      if (platform.supported && permission === 'granted') {
        const registration = await readyPushRegistration()
        const subscription = await registration.pushManager.getSubscription()
        if (subscription && subscriptionUsesKey(subscription, data.public_key) && !isOff(email)) {
          // Persist on every new visit: a local subscription alone is not proof
          // that the server still has a record for this signed-in account.
          if (identity.current.email !== email || identity.current.token !== token) return
          await savePushSubscription(token, subscription)
          enabled = true
        }
      }
      if (version !== generation.current) return
      setState({ checking: false, busy: false, enabled, permission, reason: platform.reason, publicKey: data.public_key || '', error: null })
      if (!enabled && !isOff(email) && !reminded.current.has(email) &&
        (platform.supported || platform.reason === 'ios-install-required')) {
        reminded.current.add(email)
        setPrompt(true)
      }
    } catch (error) {
      if (version !== generation.current) return
      setState(current => ({ ...current, checking: false, enabled: false, error: error instanceof Error ? error.message : 'Không thể kiểm tra thông báo thiết bị.' }))
    }
  }, [email, token, isLoading])

  useEffect(() => {
    setPrompt(false)
    setState(initial)
    void refresh()
    const check = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    return () => { generation.current++; window.removeEventListener('online', check); document.removeEventListener('visibilitychange', check) }
  }, [refresh])

  const enable = async () => {
    if (!token || !email || state.reason || !state.publicKey || actionBusy.current) return
    if (Notification.permission === 'denied') {
      toast.warning('Quyền thông báo đang bị chặn. Hãy cho phép thông báo trong cài đặt trình duyệt rồi tải lại TPS.')
      return
    }
    actionBusy.current = true
    generation.current++
    setState(current => ({ ...current, busy: true, error: null }))
    try {
      // Request permission immediately from the click handler, before any await.
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      setState(current => ({ ...current, permission }))
      if (permission !== 'granted') { setPrompt(false); return }
      const registration = await readyPushRegistration()
      let subscription = await registration.pushManager.getSubscription()
      if (subscription && !subscriptionUsesKey(subscription, state.publicKey)) {
        await pushApi(token, { endpoint: subscription.endpoint }, 'DELETE')
        if (!await subscription.unsubscribe()) throw new Error('Không thể thay đăng ký cũ. Hãy tải lại trang và thử lại.')
        subscription = null
      }
      subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(state.publicKey) as BufferSource })
      if (identity.current.email !== email || identity.current.token !== token) return
      await savePushSubscription(token, subscription)
      try { localStorage.removeItem(offKey(email)) } catch { /* Storage may be disabled. */ }
      setState(current => ({ ...current, enabled: true, permission: 'granted' }))
      setPrompt(false)
      toast.success('Đã bật thông báo trên thiết bị này')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể bật thông báo thiết bị.'
      setState(current => ({ ...current, error: message, enabled: false }))
      toast.error(message)
    } finally { actionBusy.current = false; setState(current => ({ ...current, busy: false })) }
  }

  const disable = async () => {
    if (!token || !email || actionBusy.current) return
    actionBusy.current = true
    generation.current++
    setState(current => ({ ...current, busy: true, error: null }))
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await pushApi(token, { endpoint: subscription.endpoint }, 'DELETE')
        if (!await subscription.unsubscribe()) throw new Error('Không thể hủy đăng ký trên trình duyệt. Vui lòng thử lại.')
      }
      try { localStorage.setItem(offKey(email), '1') } catch { /* Optional preference. */ }
      setState(current => ({ ...current, enabled: false }))
      setPrompt(false)
      toast.success('Đã tắt thông báo trên thiết bị này')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể tắt thông báo') }
    finally { actionBusy.current = false; setState(current => ({ ...current, busy: false })) }
  }

  const test = async () => {
    if (!token || actionBusy.current) return
    actionBusy.current = true
    setState(current => ({ ...current, busy: true }))
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) throw new Error('Thiết bị chưa được đăng ký')
      await pushApi(token, { action: 'test', endpoint: subscription.endpoint })
      toast.success('Dịch vụ push đã nhận thông báo thử. Kiểm tra thông báo của thiết bị.')
    } catch (error) {
      if (error && typeof error === 'object' && 'requiresResubscribe' in error && error.requiresResubscribe) {
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        await subscription?.unsubscribe().catch(() => {})
        setState(current => ({ ...current, enabled: false }))
      }
      toast.error(error instanceof Error ? error.message : 'Không thể gửi thông báo thử')
    }
    finally { actionBusy.current = false; setState(current => ({ ...current, busy: false })); void refresh() }
  }

  return <Context.Provider value={{ state, enable, disable, test, refresh }}>
    {children}
    <Modal open={prompt && Boolean(email) && !isLoading} onClose={() => { if (!state.busy) setPrompt(false) }} title="Bật thông báo TPS" size="sm">
      <div className="space-y-4 p-5 text-sm text-slate-700">
        <p>Nhận thông báo lịch dạy, yêu cầu và phản hồi mới trên thiết bị này, kể cả khi bạn không mở TPS.</p>
        {state.reason === 'ios-install-required' ? <><p>Trên iPhone/iPad, thêm TPS vào Màn hình chính rồi mở từ biểu tượng TPS để bật thông báo.</p><InstallTpsApp /></> :
          state.permission === 'denied' ? <p className="rounded-lg bg-amber-50 p-3">Bạn đã chặn thông báo. Mở cài đặt quyền của trang trong trình duyệt, cho phép Thông báo rồi quay lại TPS. Nếu hệ điều hành chặn thông báo, cần bật thêm trong cài đặt thiết bị.</p> : null}
        {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="min-h-11 rounded-lg border px-4" disabled={state.busy} onClick={() => setPrompt(false)}>Để sau</button>
          {!state.reason && state.permission !== 'denied' && <button type="button" className="min-h-11 rounded-lg bg-[#a1001f] px-4 font-semibold text-white disabled:opacity-50" disabled={state.busy || state.checking} onClick={() => void enable()}>{state.busy ? 'Đang thiết lập…' : 'Bật thông báo'}</button>}
        </div>
      </div>
    </Modal>
  </Context.Provider>
}

export function useDevicePush() {
  const context = useContext(Context)
  if (!context) throw new Error('DevicePushProvider is required')
  return context
}

