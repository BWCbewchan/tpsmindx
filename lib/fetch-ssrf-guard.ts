/**
 * Basic SSRF guard for server-side fetch to user-controlled URLs.
 * Prefer allowlisted hostnames; block obvious private/link-local ranges.
 */
const PRIVATE_IPV4 = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

export function isHostnameAllowedForServerFetch(hostname: string, allowlist: string[]): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return false;
  if (allowlist.some((a) => a === h || (a.startsWith('*.') && h.endsWith(a.slice(1))))) {
    return true;
  }
  return false;
}

export function isLikelyPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    return PRIVATE_IPV4.test(h) || h.startsWith('0.') || h === '0.0.0.0';
  }
  return false;
}
