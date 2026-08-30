import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
];

const ALLOWED_ATTR = [
  'alt',
  'class',
  'colspan',
  'data-float',
  'data-vertical-align',
  'data-width',
  'href',
  'rel',
  'rowspan',
  'src',
  'target',
  'title',
  'width',
];

const ALLOWED_CLASSES = new Set([
  'image-wrapper',
  'img-float-left',
  'img-float-right',
  'tiptap-image',
  'tiptap-table',
]);

const SAFE_VERTICAL_ALIGN_VALUES = new Set([
  'baseline',
  'sub',
  'super',
  'top',
  'text-top',
  'middle',
  'bottom',
  'text-bottom',
]);

const MAX_SAFE_IMAGE_WIDTH = 1400;
const MIN_SAFE_IMAGE_WIDTH = 60;
const MAX_SAFE_TABLE_SPAN = 50;
const MAX_INLINE_IMAGE_DATA_CHARS = 14 * 1024 * 1024;

function normalizeIntegerAttribute(
  value: string | null,
  min: number,
  max: number,
): string | null {
  if (!value || !/^\d{1,4}$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return String(parsed);
}

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function hasAllowedInlineImageSignature(buffer: Buffer, contentType: string): boolean {
  if (buffer.length === 0) return false;
  switch (contentType) {
    case 'image/jpeg':
    case 'image/jpg':
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case 'image/gif':
      return (
        buffer.length >= 6 &&
        ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
      );
    default:
      return false;
  }
}

function isAllowedDataImageUrl(value: string): boolean {
  if (value.length > MAX_INLINE_IMAGE_DATA_CHARS) return false;

  const match = value.match(/^data:(image\/(?:png|jpe?g|gif|webp));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return false;

  const contentType = match[1].toLowerCase() === 'image/jpg'
    ? 'image/jpeg'
    : match[1].toLowerCase();
  const payload = match[2].replace(/\s/g, '');
  if (!payload) return false;

  try {
    const buffer = Buffer.from(payload, 'base64');
    return hasAllowedInlineImageSignature(buffer, contentType);
  } catch {
    return false;
  }
}

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

function hardenSanitizedAttributes(node: Element): void {
  const tagName = node.tagName.toLowerCase();

  const classValue = node.getAttribute('class');
  if (classValue) {
    const safeClasses = classValue
      .split(/\s+/)
      .filter((className) => ALLOWED_CLASSES.has(className));

    if (safeClasses.length > 0) {
      node.setAttribute('class', safeClasses.join(' '));
    } else {
      node.removeAttribute('class');
    }
  }

  if (tagName === 'a') {
    const href = node.getAttribute('href');
    if (href && !isSafeUrl(href, new Set(['http:', 'https:', 'mailto:', 'tel:']))) {
      node.removeAttribute('href');
    }

    const target = node.getAttribute('target');
    if (target === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    } else if (target && target !== '_self') {
      node.removeAttribute('target');
    }
  } else {
    node.removeAttribute('target');
    node.removeAttribute('rel');
  }

  if (tagName === 'img') {
    const src = node.getAttribute('src');
    if (src) {
      const safeSrc = src.trim().toLowerCase().startsWith('data:')
        ? isAllowedDataImageUrl(src)
        : isSafeUrl(src, new Set(['http:', 'https:']));
      if (!safeSrc) node.removeAttribute('src');
    }

    const safeWidth = normalizeIntegerAttribute(
      node.getAttribute('data-width') || node.getAttribute('width'),
      MIN_SAFE_IMAGE_WIDTH,
      MAX_SAFE_IMAGE_WIDTH,
    );
    if (safeWidth) {
      node.setAttribute('data-width', safeWidth);
      node.setAttribute('width', safeWidth);
    } else {
      node.removeAttribute('data-width');
      node.removeAttribute('width');
    }

    const floatValue = node.getAttribute('data-float');
    if (floatValue !== 'left' && floatValue !== 'right') {
      node.removeAttribute('data-float');
    }

    const verticalAlign = node.getAttribute('data-vertical-align');
    if (verticalAlign && !SAFE_VERTICAL_ALIGN_VALUES.has(verticalAlign)) {
      node.removeAttribute('data-vertical-align');
    }
  } else {
    node.removeAttribute('data-float');
    node.removeAttribute('data-vertical-align');
    node.removeAttribute('data-width');
    node.removeAttribute('width');
  }

  if (tagName === 'td' || tagName === 'th') {
    const colspan = normalizeIntegerAttribute(node.getAttribute('colspan'), 1, MAX_SAFE_TABLE_SPAN);
    const rowspan = normalizeIntegerAttribute(node.getAttribute('rowspan'), 1, MAX_SAFE_TABLE_SPAN);
    if (colspan) node.setAttribute('colspan', colspan);
    else node.removeAttribute('colspan');
    if (rowspan) node.setAttribute('rowspan', rowspan);
    else node.removeAttribute('rowspan');
  } else {
    node.removeAttribute('colspan');
    node.removeAttribute('rowspan');
  }
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  DOMPurify.addHook('afterSanitizeAttributes', hardenSanitizedAttributes);
  try {
    return String(
      DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
        FORBID_ATTR: ['style', 'srcdoc'],
        FORBID_TAGS: ['base', 'button', 'embed', 'form', 'iframe', 'input', 'link', 'math', 'meta', 'object', 'script', 'select', 'svg', 'textarea'],
        ALLOWED_URI_REGEXP:
          /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpeg|jpg|gif|webp);base64,|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      }),
    );
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', hardenSanitizedAttributes);
  }
}

export function sanitizeText(value: string): string {
  if (!value) return '';

  return String(
    DOMPurify.sanitize(value, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    }),
  )
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}
