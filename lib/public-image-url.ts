import converted from './public-webp-images.json'

/** Only rewrite assets which were actually generated; preserve query and hash. */
export function normalizePublicImageUrl(url: string): string {
  const match = /^(\/[^?#]*)(.*)$/.exec(url)
  if (!match) return url
  const paths = converted as Record<string, string>
  const target = paths[match[1]] || paths[match[1].normalize('NFC')]
  return target ? target + match[2] : url
}
