import { sendWebPush, type StoredPushSubscription, type WebPushPayload } from '@/lib/web-push'
import { reportPushIncident } from '@/lib/push-incident'

export async function sendMonitoredWebPush(subscription: StoredPushSubscription, payload: WebPushPayload) {
  try {
    const result = await sendWebPush(subscription, payload)
    // An expired subscription is expected cleanup, not a developer incident.
    if (!result.ok && result.status !== 404 && result.status !== 410) {
      await reportPushIncident(result.skipped ? 'configuration'
        : result.status === 401 || result.status === 403 ? 'authentication'
          : result.status === 429 ? 'quota' : 'provider', result.status)
    }
    return result
  } catch (error) {
    const kind = error instanceof Error && /Invalid Web Push|Invalid VAPID|payload must not exceed/i.test(error.message)
      ? 'configuration' : 'network'
    await reportPushIncident(kind)
    return { ok: false, status: 0, skipped: false }
  }
}
