import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from 'node:crypto'

export interface StoredPushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface WebPushPayload {
  title: string
  body: string
  link?: string | null
  tag?: string
}

const TRUSTED_PUSH_HOSTS = new Set([
  'android.googleapis.com',
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
])

export function isAllowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const hostname = url.hostname.toLowerCase()
    return (
      url.protocol === 'https:' &&
      (TRUSTED_PUSH_HOSTS.has(hostname) ||
        hostname.endsWith('.notify.windows.com'))
    )
  } catch {
    return false
  }
}

interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

interface EncryptionOptions {
  salt?: Buffer
  senderPrivateKey?: Buffer
}

export function base64UrlEncode(value: Buffer | Uint8Array | string) {
  return Buffer.from(value).toString('base64url')
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url')
}

function hmac(key: Buffer, value: Buffer) {
  return createHmac('sha256', key).update(value).digest()
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  const chunks: Buffer[] = []
  let previous = Buffer.alloc(0)
  let counter = 1

  while (Buffer.concat(chunks).length < length) {
    previous = hmac(
      prk,
      Buffer.concat([previous, info, Buffer.from([counter])]),
    )
    chunks.push(previous)
    counter += 1
  }

  return Buffer.concat(chunks).subarray(0, length)
}

export function encryptWebPushPayload(
  subscription: StoredPushSubscription,
  payload: Buffer,
  options: EncryptionOptions = {},
) {
  if (payload.length > 3993) {
    throw new Error('Web Push payload must not exceed 3993 bytes')
  }

  const userPublicKey = decodeBase64Url(subscription.p256dh)
  const authSecret = decodeBase64Url(subscription.auth)
  if (userPublicKey.length !== 65 || userPublicKey[0] !== 4) {
    throw new Error('Invalid Web Push p256dh public key')
  }
  if (authSecret.length < 16) {
    throw new Error('Invalid Web Push authentication secret')
  }

  const sender = createECDH('prime256v1')
  if (options.senderPrivateKey) {
    sender.setPrivateKey(options.senderPrivateKey)
  } else {
    sender.generateKeys()
  }
  const senderPublicKey = sender.getPublicKey()
  const sharedSecret = sender.computeSecret(userPublicKey)

  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'ascii'),
    userPublicKey,
    senderPublicKey,
  ])
  const prkKey = hmac(authSecret, sharedSecret)
  const ikm = hkdfExpand(prkKey, keyInfo, 32)

  const salt = options.salt || randomBytes(16)
  const prk = hmac(salt, ikm)
  const contentEncryptionKey = hkdfExpand(
    prk,
    Buffer.from('Content-Encoding: aes128gcm\0', 'ascii'),
    16,
  )
  const nonce = hkdfExpand(
    prk,
    Buffer.from('Content-Encoding: nonce\0', 'ascii'),
    12,
  )

  const plaintext = Buffer.concat([payload, Buffer.from([2])])
  const cipher = createCipheriv('aes-128-gcm', contentEncryptionKey, nonce)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ])

  const recordSize = Buffer.alloc(4)
  recordSize.writeUInt32BE(4096)
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([senderPublicKey.length]),
    senderPublicKey,
    ciphertext,
  ])
}

export function getVapidConfig(): VapidConfig | null {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim()
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim()
  const subject = String(
    process.env.VAPID_SUBJECT || 'mailto:teaching@mindx.edu.vn',
  ).trim()

  if (!publicKey || !privateKey || !subject) return null
  try {
    const decodedPublic = decodeBase64Url(publicKey)
    const decodedPrivate = decodeBase64Url(privateKey)
    const key = createECDH('prime256v1')
    key.setPrivateKey(decodedPrivate)
    if (decodedPrivate.length !== 32 || !key.getPublicKey().equals(decodedPublic)) return null
    const subjectUrl = new URL(subject)
    if (!['https:', 'mailto:'].includes(subjectUrl.protocol)) return null
  } catch { return null }
  return { publicKey, privateKey, subject }
}

function createVapidAuthorization(endpoint: string, config: VapidConfig) {
  const publicKeyBytes = decodeBase64Url(config.publicKey)
  const privateKeyBytes = decodeBase64Url(config.privateKey)
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 4) {
    throw new Error('Invalid VAPID public key')
  }
  if (privateKeyBytes.length !== 32) {
    throw new Error('Invalid VAPID private key')
  }

  const header = base64UrlEncode(
    JSON.stringify({ typ: 'JWT', alg: 'ES256' }),
  )
  const claims = base64UrlEncode(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: config.subject,
    }),
  )
  const unsignedToken = `${header}.${claims}`

  const privateKey = createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: base64UrlEncode(publicKeyBytes.subarray(1, 33)),
      y: base64UrlEncode(publicKeyBytes.subarray(33, 65)),
      d: base64UrlEncode(privateKeyBytes),
    },
  })
  const signature = sign('sha256', Buffer.from(unsignedToken), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  })

  return `vapid t=${unsignedToken}.${base64UrlEncode(signature)}, k=${config.publicKey}`
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: WebPushPayload,
) {
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    return { ok: false, status: 0, skipped: false }
  }

  const config = getVapidConfig()
  if (!config) {
    return { ok: false, status: 0, skipped: true }
  }

  const message = Buffer.from(
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      link: payload.link || '/user/thong-bao',
      tag: payload.tag || 'tps-notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    }),
  )
  const body = encryptWebPushPayload(subscription, message)
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: createVapidAuthorization(subscription.endpoint, config),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  })

  return {
    ok: response.ok,
    status: response.status,
    skipped: false,
  }
}
