export type PushUnsupportedReason =
  | 'browser-unsupported'
  | 'insecure-context'
  | 'ios-install-required'
  | 'not-configured'

export interface PushPlatformCapabilities {
  notificationSupported: boolean
  serviceWorkerSupported: boolean
  pushManagerSupported: boolean
  secureContext: boolean
  ios: boolean
  standalone: boolean
  configured: boolean
}

export function isIosUserAgent(userAgent: string, maxTouchPoints = 0) {
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  )
}

export function getPushPlatformState(capabilities: PushPlatformCapabilities): {
  supported: boolean
  reason: PushUnsupportedReason | null
} {
  if (!capabilities.configured) {
    return { supported: false, reason: 'not-configured' }
  }
  if (!capabilities.secureContext) {
    return { supported: false, reason: 'insecure-context' }
  }
  if (capabilities.ios && !capabilities.standalone) {
    return { supported: false, reason: 'ios-install-required' }
  }
  if (
    !capabilities.notificationSupported ||
    !capabilities.serviceWorkerSupported ||
    !capabilities.pushManagerSupported
  ) {
    return { supported: false, reason: 'browser-unsupported' }
  }
  return { supported: true, reason: null }
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = globalThis.atob(base64)

  return Uint8Array.from(rawData, (character) => character.charCodeAt(0))
}
