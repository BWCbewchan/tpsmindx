import DOMPurify from 'isomorphic-dompurify';

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_MEDIA_PROTOCOLS = new Set(['http:', 'https:']);

function isSafeUrl(value: string, allowedProtocols: Set<string>): boolean {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return false;

  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('?')
  ) {
    return true;
  }

  try {
    return allowedProtocols.has(new URL(trimmed, 'https://mindx.local').protocol);
  } catch {
    return false;
  }
}

function isSafeImageDataUrl(value: string): boolean {
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value.trim());
}

function hardenSanitizedAttributes(node: Element): void {
  const tagName = node.tagName.toLowerCase();

  if (tagName === 'a') {
    const href = node.getAttribute('href');
    if (href && !isSafeUrl(href, SAFE_LINK_PROTOCOLS)) {
      node.removeAttribute('href');
    }

    const target = node.getAttribute('target');
    if (target === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    } else if (target && target !== '_self') {
      node.removeAttribute('target');
    }
  }

  if (tagName === 'img') {
    const src = node.getAttribute('src');
    if (src) {
      const safeSrc = src.trim().toLowerCase().startsWith('data:')
        ? isSafeImageDataUrl(src)
        : isSafeUrl(src, SAFE_MEDIA_PROTOCOLS);
      if (!safeSrc) node.removeAttribute('src');
    }
  }
}

/** Sanitize HTML for safe use with dangerouslySetInnerHTML (XSS mitigation). */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  DOMPurify.addHook('afterSanitizeAttributes', hardenSanitizedAttributes);
  try {
    return String(
      DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        FORBID_ATTR: ['style', 'srcdoc'],
        FORBID_TAGS: ['base', 'button', 'embed', 'form', 'iframe', 'input', 'link', 'math', 'meta', 'object', 'script', 'select', 'svg', 'textarea'],
      }),
    );
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', hardenSanitizedAttributes);
  }
}
