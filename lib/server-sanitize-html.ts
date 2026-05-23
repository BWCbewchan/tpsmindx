const BLOCK_TAGS = ['script', 'style', 'iframe', 'object', 'embed'];
const VOID_TAGS = ['link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'option', 'svg', 'math'];

function stripDangerousTags(html: string): string {
  let sanitized = html;

  for (const tag of BLOCK_TAGS) {
    sanitized = sanitized.replace(
      new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\/${tag}>`, 'gi'),
      '',
    );
  }

  for (const tag of VOID_TAGS) {
    sanitized = sanitized.replace(
      new RegExp(`<${tag}\\b[^>]*?/?>`, 'gi'),
      '',
    );
  }

  return sanitized;
}

function stripDangerousAttributes(html: string): string {
  return html
    .replace(/\son[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\ssrcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s(href|src|xlink:href)\s*=\s*("|')\s*javascript:[^"']*(\2)/gi,
      ' $1="#"',
    )
    .replace(/\s(href|src|xlink:href)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"');
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return stripDangerousAttributes(stripDangerousTags(html));
}

export function sanitizeText(value: string): string {
  if (!value) return '';

  return value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
}
