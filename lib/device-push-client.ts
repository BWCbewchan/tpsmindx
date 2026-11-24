'use client'

import { authHeaders } from '@/lib/auth-headers'
import { urlBase64ToUint8Array } from '@/lib/push-notifications'

export async function pushApi(token: string, body?: object, method = 'POST') {
  const response = await fetch('/api/push-subscriptions', {
    method: body ? method : 'GET', cache: 'no-store',
    headers: { ...authHeaders(token), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) throw Object.assign(new Error(data?.error || 'Không thể kết nối dịch vụ thông báo. Vui lòng thử lại.'), { requiresResubscribe: data?.requiresResubscribe === true })
  return data
}

export async function readyPushRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Không khởi động được dịch vụ thông báo. Hãy tải lại trang.')), 12000) }),
    ])
  } finally { clearTimeout(timer) }
}

export function subscriptionUsesKey(subscription: PushSubscription, publicKey: string) {
  const key = subscription.options.applicationServerKey
  if (!key) return false
  const actual = new Uint8Array(key), expected = urlBase64ToUint8Array(publicKey)
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

export async function savePushSubscription(token: string, subscription: PushSubscription) {
  const json = subscription.toJSON()
  if (!json.keys?.p256dh || !json.keys?.auth) throw new Error('Thiết bị không cung cấp đủ khóa đăng ký thông báo.')
  await pushApi(token, { endpoint: subscription.endpoint, keys: json.keys })
}
