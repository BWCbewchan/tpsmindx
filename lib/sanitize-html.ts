import DOMPurify from 'isomorphic-dompurify';

/** Sanitize HTML for safe use with dangerouslySetInnerHTML (XSS mitigation). */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
