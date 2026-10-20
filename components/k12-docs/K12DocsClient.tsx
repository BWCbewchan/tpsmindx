'use client'

import { PageContainer } from '@/components/PageContainer'
import ImageLightbox from '@/components/ImageLightbox'
import { normalizeStorageUrl } from '@/lib/storage-url'
import { cn } from '@/lib/utils'
import {
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Hash,
  ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Children,
  isValidElement,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

function customUrlTransform(url: string) {
  if (url.startsWith('data:image/')) return url
  return defaultUrlTransform(url)
}

export interface K12ClientDocItem {
  id: number
  slug: string
  title: string
  relativePath: string
  content: string
  type?: 'section' | 'article'
  sectionId?: number | null
  parentId?: number | null
  topic?: string
  excerpt?: string
  coverImageUrl?: string
  headings: Array<{ id: string; text: string; level: number }>
}

export interface K12ClientDocNode {
  id: string
  title: string
  children?: K12ClientDocNode[]
  slug?: string
}

interface Props {
  basePath: string
  pageTitle: string
  tree: K12ClientDocNode[]
  documents: K12ClientDocItem[]
  selectedSlug: string
  defaultSlug: string
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function normalizeEmbedUrl(rawUrl: string) {
  const cleaned = rawUrl.replace(/^<|>$/g, '').trim()
  if (!cleaned) return ''

  try {
    const url = new URL(cleaned)

    const applyYoutubeParams = (embedUrl: URL) => {
      embedUrl.searchParams.set('playsinline', '1')
      embedUrl.searchParams.set('rel', '0')
      embedUrl.searchParams.set('modestbranding', '1')
      embedUrl.searchParams.set('controls', '1')
      return embedUrl.toString()
    }

    if (url.hostname.includes('youtu.be')) {
      const videoId = url.pathname.replace('/', '').trim()
      if (!videoId) return cleaned
      const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`)
      const si = url.searchParams.get('si')
      if (si) embedUrl.searchParams.set('si', si)
      return applyYoutubeParams(embedUrl)
    }

    if (url.hostname.includes('youtube.com') && url.pathname === '/watch') {
      const videoId = url.searchParams.get('v')
      if (!videoId) return cleaned
      const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`)
      const si = url.searchParams.get('si')
      if (si) embedUrl.searchParams.set('si', si)
      return applyYoutubeParams(embedUrl)
    }

    if (
      url.hostname.includes('youtube.com') &&
      url.pathname.startsWith('/embed/')
    ) {
      return applyYoutubeParams(url)
    }

    return cleaned
  } catch {
    return cleaned
  }
}

function normalizeGitbookMarkdown(raw: string) {
  let content = raw

  // Remove decorative hero/banner image at the top of GitBook pages.
  // Support CRLF/LF and both raw HTML <figure> and markdown image syntaxes.
  content = content.replace(/^<figure>[\s\S]*?<\/figure>(?:\r?\n)*/i, '')
  content = content.replace(
    /^(#\s+.+\r?\n)(?:\r?\n)?<figure>[\s\S]*?<\/figure>(?:\r?\n)*/i,
    '$1\n',
  )
  content = content.replace(
    /^(#\s+.+\r?\n)(?:\r?\n)?!\[[^\]]*\]\([^\)]+\)(?:\r?\n)*/i,
    '$1\n',
  )

  // Convert GitBook hint blocks to quote blocks so they remain readable in markdown.
  content = content.replace(
    /\{\%\s*hint\s+style="([^"]+)"\s*\%\}([\s\S]*?)\{\%\s*endhint\s*\%\}/g,
    (_all, style: string, body: string) => {
      const trimmed = body.trim()
      const lines = trimmed
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
      if (/^\*\*(Lưu ý|Note|Chú ý|Cảnh báo|Quan trọng|Warning|Info|Success)/i.test(trimmed)) {
        return `\n${lines}\n`
      }
      const title = style.toUpperCase()
      return `\n> **${title}:**\n${lines}\n`
    },
  )

  // Keep only the markdown link content from content-ref blocks.
  content = content.replace(/\{\%\s*content-ref[\s\S]*?\%\}/g, '')
  content = content.replace(/\{\%\s*endcontent-ref\s*\%\}/g, '')

  // Convert GitBook embed tags to responsive iframe wrappers.
  content = content.replace(
    /\{\%\s*embed\s+url="([^"]+)"\s*\%\}/g,
    (_all, rawUrl: string) => {
      const normalizedUrl = normalizeEmbedUrl(rawUrl)
      if (!normalizedUrl) return ''

      return `<iframe src="${normalizedUrl}" title="Embedded video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
    },
  )

  return content
}

const HTML_ENTITIES_MAP: Record<string, string> = {
  '&aacute;': 'á', '&Aacute;': 'Á',
  '&agrave;': 'à', '&Agrave;': 'À',
  '&acirc;': 'â', '&Acirc;': 'Â',
  '&atilde;': 'ã', '&Atilde;': 'Ã',
  '&eacute;': 'é', '&Eacute;': 'É',
  '&egrave;': 'è', '&Egrave;': 'È',
  '&ecirc;': 'ê', '&Ecirc;': 'Ê',
  '&iacute;': 'í', '&Iacute;': 'Í',
  '&igrave;': 'ì', '&Igrave;': 'Ì',
  '&oacute;': 'ó', '&Oacute;': 'Ó',
  '&ograve;': 'ò', '&Ograve;': 'Ò',
  '&ocirc;': 'ô', '&Ocirc;': 'Ô',
  '&otilde;': 'õ', '&Otilde;': 'Õ',
  '&uacute;': 'ú', '&Uacute;': 'Ú',
  '&ugrave;': 'ù', '&Ugrave;': 'Ù',
  '&yacute;': 'ý', '&Yacute;': 'Ý',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
}

function decodeHtmlEntities(input: string): string {
  if (!input) return ''
  let str = input
  for (const [entity, char] of Object.entries(HTML_ENTITIES_MAP)) {
    str = str.replaceAll(entity, char)
  }
  str = str.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
    String.fromCodePoint(parseInt(hex, 16)),
  )
  str = str.replace(/&#([0-9]+);/g, (_, dec: string) =>
    String.fromCodePoint(parseInt(dec, 10)),
  )
  return str
}

function buildSearchPreview(content: string, maxLength = 120) {
  const decoded = decodeHtmlEntities(content || '')
  const noHtml = decoded
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[\|_*~`>#-]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!noHtml) return 'Không có nội dung xem trước'
  if (noHtml.length <= maxLength) return noHtml
  return `${noHtml.slice(0, maxLength).trim()}...`
}

function mapGitbookHref(href: string, basePath: string, documents: K12ClientDocItem[]) {
  // Preserve hash and query params
  const hashIndex = href.indexOf('#')
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : ''
  const cleanHref = href.split('#')[0].split('?')[0].trim()
  
  // If it's an external URL
  if (cleanHref.startsWith('http://') || cleanHref.startsWith('https://')) {
    // Check if it's a PD MindX URL (e.g. pd.mindx.edu.vn or pdmindx.com)
    if (cleanHref.includes('pd.mindx.edu.vn') || cleanHref.includes('pdmindx.com')) {
      const urlObj = new URL(cleanHref, 'http://localhost')
      const subPageId = urlObj.searchParams.get('sub_page_id') || urlObj.searchParams.get('id')
      if (subPageId) {
        const idMatch = documents.find(doc => String(doc.id) === String(subPageId))
        if (idMatch) {
          return `${basePath}?doc=${encodeURIComponent(idMatch.slug)}${hash}`
        }
      }
    }

    // Check if it's a GitBook URL that should be converted
    const gitbookMarker = 'cxohok12.gitbook.io/quy-trinh-quy-dinh-danh-cho-giao-vien/'
    const markerIndex = cleanHref.indexOf(gitbookMarker)
    if (markerIndex >= 0) {
      const extractedPath = cleanHref.slice(markerIndex + gitbookMarker.length).replace(/\.md$/i, '')
      
      // If the path is empty (root GitBook URL), return to default doc
      if (!extractedPath) {
        return basePath
      }
      
      // Try to find exact match
      const exactMatch = documents.find(doc => doc.slug === extractedPath)
      if (exactMatch) {
        return `${basePath}?doc=${encodeURIComponent(extractedPath)}${hash}`
      }
      
      // Try to find by matching the last segment
      const segments = extractedPath.split('/').filter(Boolean)
      const lastSegment = segments[segments.length - 1]
      
      if (lastSegment) {
        const partialMatch = documents.find(doc => 
          doc.slug.endsWith('/' + lastSegment) || doc.slug === lastSegment
        )
        if (partialMatch) {
          return `${basePath}?doc=${encodeURIComponent(partialMatch.slug)}${hash}`
        }
      }
      
      // Return with extracted path even if not found (might be valid)
      return `${basePath}?doc=${encodeURIComponent(extractedPath)}${hash}`
    }
    // Other external URLs return as-is
    return href
  }

  // Remove common prefixes for relative paths and normalize ../ or ./
  const extractedPath = cleanHref
    .replace(/^(\.\.\/|\.\/)+/g, '')
    .replace(/^\/quy-trinh-quy-dinh-danh-cho-giao-vien\//, '')
    .replace(/^quy-trinh-quy-dinh-danh-cho-giao-vien\//, '')
    .replace(/^\//, '')
    .replace(/\.md$/i, '')

  // If empty after cleanup, return to base path
  if (!extractedPath) return basePath

  // Check if this exact slug exists in documents
  const exactMatch = documents.find(doc => doc.slug === extractedPath)
  if (exactMatch) {
    return `${basePath}?doc=${encodeURIComponent(extractedPath)}${hash}`
  }

  // If no exact match, try case-insensitive match
  const caseInsensitiveMatch = documents.find(
    doc => doc.slug.toLowerCase() === extractedPath.toLowerCase()
  )
  if (caseInsensitiveMatch) {
    return `${basePath}?doc=${encodeURIComponent(caseInsensitiveMatch.slug)}${hash}`
  }

  // If the link starts with '/' and does not match any document slug,
  // treat it as an internal application route (e.g., /user/checkout/create, /public/checkout)
  if (cleanHref.startsWith('/') && !cleanHref.startsWith('/quy-trinh-quy-dinh-danh-cho-giao-vien/')) {
    return href
  }

  // If still no match, use the extracted path as-is
  return `${basePath}?doc=${encodeURIComponent(extractedPath)}${hash}`
}

function getPlainText(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node))
    return node
      .map((item) => getPlainText(item))
      .join('')
      .trim()
  if (isValidElement(node)) {
    const props = (node.props as { children?: unknown }) || {}
    return getPlainText(props.children)
  }
  return ''
}

function findHeadingElement(id: string, text?: string): HTMLElement | null {
  if (typeof document === 'undefined') return null

  // 1. Khớp ID trực tiếp
  let el = document.getElementById(id)
  if (el) return el

  // 2. Khớp URI component đã giải mã
  try {
    const decoded = decodeURIComponent(id)
    el = document.getElementById(decoded)
    if (el) return el
  } catch {}

  // 3. Fallback: Quét tất cả thẻ heading trong container bài viết
  const container = document.querySelector('.k12-markdown')
  if (container) {
    const headings = Array.from(
      container.querySelectorAll('h1, h2, h3, h4, h5, h6'),
    ) as HTMLElement[]

    // 3a. Khớp theo id attribute
    for (const h of headings) {
      if (h.id === id || h.id.startsWith(`${id}-`)) {
        return h
      }
    }

    // 3b. Khớp theo slugify của nội dung heading
    for (const h of headings) {
      const hText = (h.textContent || '').replace(/#\s*$/, '').trim()
      if (slugify(hText) === id || (text && slugify(hText) === slugify(text))) {
        return h
      }
    }

    // 3c. Khớp theo text thô
    if (text) {
      const cleanTarget = text.toLowerCase().trim()
      for (const h of headings) {
        const hText = (h.textContent || '')
          .replace(/#\s*$/, '')
          .toLowerCase()
          .trim()
        if (
          hText === cleanTarget ||
          hText.includes(cleanTarget) ||
          cleanTarget.includes(hText)
        ) {
          return h
        }
      }
    }
  }

  return null
}

function getScrollParent(node: HTMLElement | null): HTMLElement | Window {
  if (typeof window === 'undefined' || !node) return window
  let parent: HTMLElement | null = node.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent)
    const overflowY = style.overflowY
    const isScrollable =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      parent.scrollHeight > parent.clientHeight
    if (isScrollable) {
      return parent
    }
    parent = parent.parentElement
  }
  return window
}

function findFirstAnchor(
  node: unknown,
): { href: string; label: string } | null {
  if (!isValidElement(node)) return null

  if (node.type === 'a') {
    const anchorProps = node.props as { href?: string; children?: unknown }
    const href = (anchorProps.href || '').trim()
    if (!href) return null

    const label = getPlainText(anchorProps.children).trim()
    if (!label) return null

    return { href, label }
  }

  const props = node.props as { children?: unknown }
  const children = Children.toArray(props.children as any)
  for (const child of children) {
    const found = findFirstAnchor(child)
    if (found) return found
  }

  return null
}

function extractListItemLink(
  liNode: unknown,
): { href: string; label: string } | null {
  if (!isValidElement(liNode) || liNode.type !== 'li') return null

  const anchor = findFirstAnchor(liNode)
  return anchor
}

function extractImagesFromMarkdown(
  content: string,
): Array<{ src: string; alt: string }> {
  const images: Array<{ src: string; alt: string }> = []
  const seen = new Set<string>()

  const markdownImageRegex = /!\[([^\]]*)\]\(([^\)\s]+)(?:\s+"[^"]*")?\)/g
  const htmlImageRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi

  let match: RegExpExecArray | null
  while ((match = markdownImageRegex.exec(content)) !== null) {
    const alt = (match[1] || '').trim() || 'image'
    const rawSrc = (match[2] || '').trim()
    if (!rawSrc) continue
    const cleanSrc = decodeHtmlEntities(rawSrc)
    const src = normalizeStorageUrl(cleanSrc)
    if (seen.has(src)) continue
    seen.add(src)
    images.push({ src, alt })
  }

  while ((match = htmlImageRegex.exec(content)) !== null) {
    const rawSrc = (match[1] || '').trim()
    if (!rawSrc) continue
    const cleanSrc = decodeHtmlEntities(rawSrc)
    const src = normalizeStorageUrl(cleanSrc)
    if (seen.has(src)) continue
    seen.add(src)
    images.push({ src, alt: 'image' })
  }

  return images
}

function DocImage({
  src,
  alt,
  title,
  onZoom,
}: {
  src: string
  alt: string
  title?: string
  onZoom: () => void
}) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  if (hasError) {
    return (
      <span className="my-4 block rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <ImageIcon className="h-5 w-5" />
        </span>
        <span className="mt-2 block text-xs font-semibold text-gray-700">
          {alt || title || 'Hình ảnh minh họa'}
        </span>
        <span className="mt-0.5 block text-[11px] text-gray-400">
          (Hình ảnh từ tài liệu nguồn hiện đang được đồng bộ)
        </span>
      </span>
    )
  }

  return (
    <span className="my-5 block w-full text-center">
      <span className="relative inline-block w-full max-w-4xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        <img
          src={src}
          alt={alt}
          title={title}
          loading="lazy"
          onError={() => setHasError(true)}
          className="h-auto w-full max-h-[640px] cursor-zoom-in object-contain block mx-auto rounded-lg"
          onClick={onZoom}
        />
      </span>
      {(title ||
        (alt &&
          alt !== 'image' &&
          alt !== 'Hình ảnh minh họa' &&
          alt !== 'Hình ảnh minh họa quy trình')) && (
        <span className="mt-1.5 block text-center text-xs text-gray-500 italic">
          {title || alt}
        </span>
      )}
    </span>
  )
}

export default function K12DocsClient({
  basePath,
  pageTitle,
  tree,
  documents,
  selectedSlug,
  defaultSlug,
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [expandedLevelOne, setExpandedLevelOne] = useState<
    Record<string, boolean>
  >({})
  const [isMiniToc, setIsMiniToc] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [pendingDocSlug, setPendingDocSlug] = useState<string | null>(null)
  const [activeHeadingId, setActiveHeadingId] = useState<string>('')
  const [bookmarkedSlugs, setBookmarkedSlugs] = useState<string[]>([])
  const isManualScrollRef = useRef(false)
  const scrollLockTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('k12_bookmarked_docs')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setBookmarkedSlugs(parsed)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const toggleBookmark = (slug: string) => {
    setBookmarkedSlugs((prev) => {
      const next = prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug]
      try {
        localStorage.setItem('k12_bookmarked_docs', JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')

    const updateViewport = (event?: MediaQueryListEvent) => {
      const matches = event ? event.matches : mediaQuery.matches
      setIsMobileViewport(matches)
    }

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  const handleTocSelect = () => {
    if (!isMobileViewport) return
    setIsMiniToc(true)
  }

  const selectedDoc = useMemo(() => {
    const effective = selectedSlug || defaultSlug
    return documents.find((doc) => doc.slug === effective) || documents[0]
  }, [documents, selectedSlug, defaultSlug])

  // Trích xuất headings trong trang hiện tại (kèm fallback client-side)
  const activeDocHeadings = useMemo(() => {
    if (selectedDoc?.headings && selectedDoc.headings.length > 0) {
      return selectedDoc.headings
    }
    if (!selectedDoc?.content) return []
    const result: Array<{ id: string; text: string; level: number }> = []
    const headingRegex = /^(#{1,6})\s+(.+)$/gm
    let match: RegExpExecArray | null
    const idCounts = new Map<string, number>()

    while ((match = headingRegex.exec(selectedDoc.content)) !== null) {
      const hashes = match[1]
      const rawText = match[2].trim()
      const text = rawText
        .replace(/<[^>]+>/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/[*_`~]/g, '')
        .replace(/\\/g, '')
        .trim()
      if (!text) continue
      const baseId = slugify(text) || 'section'
      const count = idCounts.get(baseId) || 0
      idCounts.set(baseId, count + 1)
      const uniqueId = count === 0 ? baseId : `${baseId}-${count}`
      result.push({ id: uniqueId, text, level: hashes.length })
    }

    const htmlHeadingRegex = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi
    while ((match = htmlHeadingRegex.exec(selectedDoc.content)) !== null) {
      const level = Number(match[1])
      const attrs = match[2] || ''
      const idMatch = /\bid=["']([^"']+)["']/i.exec(attrs)
      const rawText = match[3] || ''
      const text = rawText
        .replace(/<[^>]+>/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/[*_`~]/g, '')
        .replace(/\\/g, '')
        .trim()
      if (!text) continue
      const baseId = idMatch ? idMatch[1] : slugify(text) || 'section'
      const count = idCounts.get(baseId) || 0
      idCounts.set(baseId, count + 1)
      const uniqueId = count === 0 ? baseId : `${baseId}-${count}`
      result.push({ id: uniqueId, text, level })
    }

    return result
  }, [selectedDoc?.content, selectedDoc?.headings])

  // ScrollSpy: Tự động đánh dấu heading đang đọc khi cuộn trang
  useEffect(() => {
    if (!activeDocHeadings?.length) {
      setActiveHeadingId('')
      return
    }

    let ticking = false
    const onScroll = () => {
      // Bỏ qua scrollspy nếu vừa click mục lục
      if (isManualScrollRef.current) return
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        if (isManualScrollRef.current) return

        const headingEls = activeDocHeadings
          .map((h) => findHeadingElement(h.id, h.text))
          .filter(Boolean) as HTMLElement[]

        if (headingEls.length === 0) return

        const scrollParent = getScrollParent(headingEls[0])
        const isWin = scrollParent === window

        // Kiểm tra cuộn gần cuối trang
        if (isWin) {
          if (
            window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 70
          ) {
            setActiveHeadingId(activeDocHeadings[activeDocHeadings.length - 1].id)
            return
          }
        } else {
          const container = scrollParent as HTMLElement
          if (
            container.clientHeight + container.scrollTop >=
            container.scrollHeight - 70
          ) {
            setActiveHeadingId(activeDocHeadings[activeDocHeadings.length - 1].id)
            return
          }
        }

        const scrollThreshold = isWin
          ? window.scrollY + 110
          : (scrollParent as HTMLElement).scrollTop + 110
        let currentId = activeDocHeadings[0]?.id || ''

        for (let i = 0; i < headingEls.length; i++) {
          const el = headingEls[i]
          let elTop = 0
          if (isWin) {
            elTop = el.getBoundingClientRect().top + window.scrollY
          } else {
            const container = scrollParent as HTMLElement
            elTop =
              el.getBoundingClientRect().top -
              container.getBoundingClientRect().top +
              container.scrollTop
          }
          if (elTop <= scrollThreshold) {
            currentId = activeDocHeadings[i]?.id || el.id
          } else {
            break
          }
        }
        setActiveHeadingId(currentId)
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    const firstEl = findHeadingElement(
      activeDocHeadings[0]?.id,
      activeDocHeadings[0]?.text,
    )
    const scrollParent = getScrollParent(
      firstEl || (document.querySelector('.k12-markdown') as HTMLElement),
    )
    if (scrollParent !== window) {
      scrollParent.addEventListener('scroll', onScroll, { passive: true })
    }

    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollParent !== window) {
        scrollParent.removeEventListener('scroll', onScroll)
      }
    }
  }, [activeDocHeadings, selectedDoc?.slug])

  const scrollToAndFocusHeading = useCallback(
    (id: string, text?: string, smooth = true) => {
      setActiveHeadingId(id)

      // Khóa ScrollSpy tạm thời trong lúc cuộn mượt
      isManualScrollRef.current = true
      if (scrollLockTimerRef.current) {
        clearTimeout(scrollLockTimerRef.current)
      }
      scrollLockTimerRef.current = setTimeout(() => {
        isManualScrollRef.current = false
      }, 1000)

      const el = findHeadingElement(id, text)
      if (el) {
        const scrollParent = getScrollParent(el)

        if (scrollParent === window) {
          const yOffset = -85
          const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
          window.scrollTo({
            top: Math.max(0, y),
            behavior: smooth ? 'smooth' : 'auto',
          })
        } else {
          const container = scrollParent as HTMLElement
          const containerRect = container.getBoundingClientRect()
          const elRect = el.getBoundingClientRect()
          const targetScrollTop =
            container.scrollTop + (elRect.top - containerRect.top) - 85
          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: smooth ? 'smooth' : 'auto',
          })
        }

        // Gọi scrollIntoView làm lớp bổ sung
        try {
          el.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            block: 'start',
          })
        } catch {}

        // Apply visual focus & flash highlight
        el.tabIndex = -1
        try {
          el.focus({ preventScroll: true })
        } catch {}

        el.classList.remove('k12-heading-focused')
        void el.offsetWidth // force reflow
        el.classList.add('k12-heading-focused')
        setTimeout(() => {
          el.classList.remove('k12-heading-focused')
        }, 2400)
      }
    },
    [],
  )

  const handleHeadingClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
    text?: string,
  ) => {
    e.preventDefault()
    scrollToAndFocusHeading(id, text, true)
    window.history.replaceState(null, '', `#${id}`)
  }

  // Tự động focus & cuộn tới heading nếu URL có hash (#heading-id)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace(/^#/, '')
    if (hash && activeDocHeadings?.length) {
      const match = activeDocHeadings.find((h) => h.id === hash)
      const timer = setTimeout(() => {
        scrollToAndFocusHeading(hash, match?.text, false)
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [selectedDoc?.slug, activeDocHeadings, scrollToAndFocusHeading])

  // Tìm các trang con của trang hiện tại
  const childPages = useMemo(() => {
    if (!selectedDoc?.slug) return []
    
    const findNodeBySlug = (nodes: K12ClientDocNode[]): K12ClientDocNode | null => {
      for (const node of nodes) {
        if (node.slug === selectedDoc.slug) return node
        if (node.children) {
          const found = findNodeBySlug(node.children)
          if (found) return found
        }
      }
      return null
    }
    
    const currentNode = findNodeBySlug(tree)
    if (!currentNode?.children) return []
    
    // Chỉ lấy các node có slug (là trang thực sự, không phải folder rỗng)
    return currentNode.children.filter(child => child.slug)
  }, [selectedDoc?.slug, tree])

  useEffect(() => {
    if (!pendingDocSlug) return

    const activeSlug = selectedSlug || selectedDoc?.slug || ''
    if (activeSlug === pendingDocSlug) {
      setPendingDocSlug(null)
    }
  }, [pendingDocSlug, selectedDoc?.slug, selectedSlug])

  const navigateToDoc = (slug: string) => {
    const activeSlug = selectedSlug || selectedDoc?.slug || ''
    if (!slug || slug === activeSlug) {
      handleTocSelect()
      return
    }

    handleTocSelect()
    setPendingDocSlug(slug)
    router.push(`${basePath}?doc=${encodeURIComponent(slug)}`)
  }

  const selectedRootNodeId = useMemo(() => {
    const targetSlug = selectedDoc?.slug
    if (!targetSlug) return null

    const findRootBySlug = (
      nodes: K12ClientDocNode[],
      rootId: string | null,
      depth = 0,
    ): string | null => {
      for (const node of nodes) {
        const nextRootId =
          rootId ?? (depth === 0 && node.children?.length ? node.id : null)

        if (node.slug === targetSlug) {
          return nextRootId
        }

        if (node.children?.length) {
          const found = findRootBySlug(node.children, nextRootId, depth + 1)
          if (found) return found
        }
      }

      return null
    }

    return findRootBySlug(tree, null)
  }, [selectedDoc?.slug, tree])

  useEffect(() => {
    const initial: Record<string, boolean> = {}

    tree.forEach((node) => {
      if (node.children && node.children.length > 0) {
        initial[node.id] = true
      }
    })

    setExpandedLevelOne((prev) => ({ ...initial, ...prev }))
  }, [tree])

  useEffect(() => {
    if (!selectedRootNodeId) return
    setExpandedLevelOne((prev) => ({ ...prev, [selectedRootNodeId]: true }))
  }, [selectedRootNodeId])

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    const normalizedQuery = query.trim().toLowerCase()
    return documents
      .filter((doc) => {
        return (
          doc.title.toLowerCase().includes(normalizedQuery) ||
          doc.content.toLowerCase().includes(normalizedQuery)
        )
      })
      .slice(0, 10)
  }, [documents, query])

  const searchInputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false)
      }
    }

    if (showSearchResults) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSearchResults])

  const normalizedContent = useMemo(() => {
    if (!selectedDoc) return ''
    return normalizeGitbookMarkdown(selectedDoc.content)
  }, [selectedDoc])

  const galleryImages = useMemo(() => {
    if (!normalizedContent) return []
    return extractImagesFromMarkdown(normalizedContent)
  }, [normalizedContent])

  const isSearchRendering = pendingDocSlug !== null

  // Tìm tài liệu trước và sau
  const getPreviousNextDocs = useMemo(() => {
    if (!selectedDoc?.slug) return { prev: null, next: null }

    // Tạo danh sách phẳng tất cả các tài liệu có slug (duyệt theo thứ tự cây)
    const flatList: Array<{ slug: string; title: string }> = []
    const traverse = (nodes: K12ClientDocNode[]) => {
      for (const node of nodes) {
        if (node.slug) {
          flatList.push({ slug: node.slug, title: node.title })
        }
        if (node.children) {
          traverse(node.children)
        }
      }
    }
    traverse(tree)

    const currentIndex = flatList.findIndex(doc => doc.slug === selectedDoc.slug)
    if (currentIndex === -1) return { prev: null, next: null }

    return {
      prev: currentIndex > 0 ? flatList[currentIndex - 1] : null,
      next: currentIndex < flatList.length - 1 ? flatList[currentIndex + 1] : null,
    }
  }, [selectedDoc?.slug, tree])

  const renderTree = (nodes: K12ClientDocNode[], depth = 0) => {
    return nodes
      .map((node) => {
        const hasChildren = Boolean(node.children && node.children.length > 0)
        const renderedChildren = hasChildren
          ? renderTree(node.children as K12ClientDocNode[], depth + 1)
          : []

        const isActive = node.slug && selectedDoc?.slug === node.slug
        const isExpanded = expandedLevelOne[node.id] ?? true
        return (
          <div key={node.id} className="space-y-1">
            {node.slug ? (
              <div
                className={cn(
                  'group flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-[#a1001f] text-white'
                    : 'text-gray-700 hover:bg-gray-100',
                )}
                style={{ paddingLeft: `${8 + depth * 14}px` }}
                onClick={() => navigateToDoc(node.slug!)}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setExpandedLevelOne((prev) => ({
                        ...prev,
                        [node.id]: !isExpanded,
                      }))
                    }}
                    className={cn(
                      'mr-1 rounded p-0.5',
                      isActive
                        ? 'text-white hover:bg-white/20'
                        : 'text-gray-500 hover:bg-gray-200',
                    )}
                    aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                  >
                    <ChevronRight
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-transform',
                        isExpanded ? 'rotate-90' : 'rotate-0',
                      )}
                    />
                  </button>
                ) : (
                  <span
                    className="mr-1 inline-block h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                )}

                <span className="min-w-0 flex-1 flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      isMiniToc
                        ? 'line-clamp-1 text-[11px] font-medium'
                        : 'line-clamp-2',
                    )}
                    title={node.title}
                  >
                    {node.title}
                  </span>
                  {bookmarkedSlugs.includes(node.slug!) && (
                    <BookmarkCheck
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isActive ? 'text-amber-300' : 'text-amber-500',
                      )}
                      aria-label="Đã đánh dấu"
                    />
                  )}
                </span>
              </div>
            ) : hasChildren ? (
              <button
                type="button"
                onClick={() =>
                  setExpandedLevelOne((prev) => ({
                    ...prev,
                    [node.id]: !prev[node.id],
                  }))
                }
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-100"
                style={{ paddingLeft: `${8 + depth * 14}px` }}
              >
                <ChevronRight
                  className={cn(
                    'mr-1 h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform',
                    isExpanded ? 'rotate-90' : 'rotate-0',
                  )}
                />
                <span className="line-clamp-1" title={node.title}>
                  {node.title}
                </span>
              </button>
            ) : (
              <div
                className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
                style={{ paddingLeft: `${8 + depth * 14}px` }}
                title={node.title}
              >
                <span
                  className={cn(
                    isMiniToc ? 'line-clamp-1 text-[11px]' : 'line-clamp-2',
                  )}
                >
                  {node.title}
                </span>
              </div>
            )}
            {hasChildren && !isExpanded ? null : renderedChildren}
          </div>
        )
      })
      .filter(Boolean)
  }

  return (
    <PageContainer>
      {/* Custom Header with Title and Search */}
      <div className="mb-6 border-b border-gray-200 pb-4 sm:pb-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {pageTitle}
            </h1>
          </div>
          <div className="shrink-0 lg:w-80">
            <label className="sr-only" htmlFor="k12-doc-search">
              Tìm tài liệu
            </label>
            <div className="relative" ref={searchInputRef}>
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                id="k12-doc-search"
                value={query}
                onChange={(e) => {
                  const value = e.target.value
                  setQuery(value)
                  setShowSearchResults(value.length > 0)
                }}
                onFocus={() => query.length > 0 && setShowSearchResults(true)}
                placeholder="Tìm theo tiêu đề hoặc nội dung"
                className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-2 text-sm focus:border-[#a1001f] focus:ring-1 focus:ring-[#a1001f]/25 focus:outline-none transition-all"
              />

              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="flex flex-col gap-y-1 p-2">
                    {searchResults.map((doc) => (
                      <Link
                        key={doc.slug}
                        href={`${basePath}?doc=${encodeURIComponent(doc.slug)}`}
                        onClick={(event) => {
                          event.preventDefault()
                          setShowSearchResults(false)
                          navigateToDoc(doc.slug)
                        }}
                        className="flex items-start gap-3 rounded-lg border border-[#f1d1d8] bg-white px-3 py-2 text-sm transition-colors hover:border-[#e7c6cb] hover:bg-[#fff7f8]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 line-clamp-2">
                            {doc.title}
                          </p>
                          <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                            {buildSearchPreview(doc.content)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'grid grid-cols-1 gap-4 lg:[transition:grid-template-columns_320ms_ease]',
          activeDocHeadings.length === 0
            ? isMiniToc
              ? 'lg:grid-cols-[120px_minmax(0,1fr)]'
              : 'lg:grid-cols-[300px_minmax(0,1fr)]'
            : isMiniToc
              ? 'lg:grid-cols-[120px_minmax(0,1fr)_240px]'
              : 'lg:grid-cols-[300px_minmax(0,1fr)_240px]',
        )}
      >
        <aside
          className={cn(
            'overflow-x-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm',
            'lg:sticky lg:top-4',
            isMiniToc
              ? 'lg:h-auto lg:overflow-hidden'
              : 'lg:h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar',
          )}
        >
          <div className="mb-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Mục lục</h2>
              <button
                type="button"
                onClick={() => setIsMiniToc((prev) => !prev)}
                className="inline-flex items-center rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 transition-all duration-300 hover:bg-gray-50"
                title={isMiniToc ? 'Mở rộng mục lục' : 'Thu gọn mục lục'}
              >
                <span className="inline-flex transition-transform duration-300">
                  {isMiniToc ? (
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  ) : (
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>
            </div>
          </div>
          <div
            className={cn(
              'transition-all duration-300 ease-out',
              isMiniToc
                ? 'max-h-0 overflow-hidden opacity-0 -translate-y-1 pointer-events-none'
                : 'max-h-none overflow-visible opacity-100 translate-y-0',
            )}
          >
            <div className="space-y-1">{renderTree(tree)}</div>
          </div>
        </aside>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {isSearchRendering ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-2/3 rounded bg-gray-200" />
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-11/12 rounded bg-gray-100" />
              <div className="h-4 w-10/12 rounded bg-gray-100" />
              <div className="h-60 w-full rounded-xl bg-gray-200" />
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-9/12 rounded bg-gray-100" />
            </div>
          ) : selectedDoc ? (
            <>
              {/* Header Action Bar: Doc Category & Bookmark Button */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {selectedDoc.type === 'section' ? 'Thư mục / Chuyên mục' : 'Tài liệu / Quy định'}
                  </span>
                  {selectedDoc.topic && (
                    <span className="text-gray-400">· {selectedDoc.topic}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleBookmark(selectedDoc.slug)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                    bookmarkedSlugs.includes(selectedDoc.slug)
                      ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-xs'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                  title={
                    bookmarkedSlugs.includes(selectedDoc.slug)
                      ? 'Bỏ đánh dấu tài liệu'
                      : 'Đánh dấu tài liệu này'
                  }
                >
                  {bookmarkedSlugs.includes(selectedDoc.slug) ? (
                    <>
                      <BookmarkCheck className="h-3.5 w-3.5 text-amber-600" />
                      <span>Đã đánh dấu</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-3.5 w-3.5 text-gray-400" />
                      <span>Đánh dấu mục này</span>
                    </>
                  )}
                </button>
              </div>

              {/* Mobile Quick In-Page TOC (Hiện trên mobile khi tài liệu có headings) */}
              {activeDocHeadings.length > 0 && (
                <div className="lg:hidden mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-xs">
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-xs text-slate-800 uppercase tracking-wider select-none">
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#a1001f]" />
                        Mục trong trang ({activeDocHeadings.length})
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-90" />
                    </summary>
                    <nav className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-1" aria-label="Mục trong trang (mobile)">
                      {activeDocHeadings.map((heading) => {
                        const isActive = activeHeadingId === heading.id
                        return (
                          <a
                            key={`mobile-${heading.level}-${heading.id}-${heading.text}`}
                            href={`#${heading.id}`}
                            onClick={(e) => handleHeadingClick(e, heading.id, heading.text)}
                            className={cn(
                              'flex items-center justify-between py-1.5 px-2 rounded-md text-xs transition-colors',
                              isActive
                                ? 'bg-red-50 text-[#a1001f] font-semibold border-l-2 border-[#a1001f]'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-l-2 border-transparent',
                            )}
                            style={{ paddingLeft: `${8 + Math.max(0, heading.level - 1) * 8}px` }}
                          >
                            <span className="line-clamp-1">{heading.text}</span>
                            {isActive && (
                              <span className="ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#a1001f]" />
                            )}
                          </a>
                        )
                      })}
                    </nav>
                  </details>
                </div>
              )}

              <div className="k12-markdown text-gray-800">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  urlTransform={customUrlTransform}
                  components={{
                    a: ({ href, children, ...props }) => {
                      if (!href) {
                        return <a {...props}>{children}</a>
                      }

                      const mappedHref = mapGitbookHref(href, basePath, documents)
                      const isExternal = /^https?:\/\//.test(mappedHref)
                      const classNameFromProps = (
                        props as { className?: string }
                      ).className
                      const mergedClassName = [
                        'k12-inline-link',
                        classNameFromProps,
                      ]
                        .filter(Boolean)
                        .join(' ')

                      if (isExternal) {
                        return (
                          <a
                            href={mappedHref}
                            target="_blank"
                            rel="noreferrer"
                            {...props}
                            className={mergedClassName}
                          >
                            {children}
                          </a>
                        )
                      }

                      const title = (props as { title?: string }).title

                      return (
                        <Link
                          href={mappedHref}
                          className={mergedClassName}
                          title={title}
                        >
                          {children}
                        </Link>
                      )
                    },
                    iframe: ({ src, title }) => {
                      if (!src) return null
                      return (
                        <div className="k12-video-embed">
                          <iframe
                            src={src}
                            title={title || 'Embedded video'}
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                            allowFullScreen
                          />
                        </div>
                      )
                    },
                    h1: ({ node, children, ...props }: any) => {
                      const text = getPlainText(children)
                      const id = props.id || slugify(text)
                      return (
                        <h1
                          id={id}
                          className="group relative mt-7 mb-3.5 scroll-mt-24 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2"
                        >
                          <span>{children}</span>
                          <a
                            href={`#${id}`}
                            onClick={(e) => handleHeadingClick(e, id, text)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#a1001f] transition-opacity text-xl font-normal select-none"
                            title="Liên kết mục này"
                          >
                            #
                          </a>
                        </h1>
                      )
                    },
                    h2: ({ node, children, ...props }: any) => {
                      const text = getPlainText(children)
                      const id = props.id || slugify(text)
                      return (
                        <h2
                          id={id}
                          className="group relative mt-6 mb-2.5 scroll-mt-24 text-xl sm:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-1.5"
                        >
                          <span>{children}</span>
                          <a
                            href={`#${id}`}
                            onClick={(e) => handleHeadingClick(e, id, text)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#a1001f] transition-opacity text-lg font-normal select-none"
                            title="Liên kết mục này"
                          >
                            #
                          </a>
                        </h2>
                      )
                    },
                    h3: ({ node, children, ...props }: any) => {
                      const text = getPlainText(children)
                      const id = props.id || slugify(text)
                      return (
                        <h3
                          id={id}
                          className="group relative mt-5 mb-2 scroll-mt-24 text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2"
                        >
                          <span>{children}</span>
                          <a
                            href={`#${id}`}
                            onClick={(e) => handleHeadingClick(e, id, text)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#a1001f] transition-opacity text-base font-normal select-none"
                            title="Liên kết mục này"
                          >
                            #
                          </a>
                        </h3>
                      )
                    },
                    h4: ({ node, children, ...props }: any) => {
                      const text = getPlainText(children)
                      const id = props.id || slugify(text)
                      return (
                        <h4
                          id={id}
                          className="group relative mt-4 mb-1.5 scroll-mt-24 text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2"
                        >
                          <span>{children}</span>
                          <a
                            href={`#${id}`}
                            onClick={(e) => handleHeadingClick(e, id, text)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#a1001f] transition-opacity text-sm font-normal select-none"
                            title="Liên kết mục này"
                          >
                            #
                          </a>
                        </h4>
                      )
                    },
                    h5: ({ node, children, ...props }: any) => {
                      const text = getPlainText(children)
                      const id = props.id || slugify(text)
                      return (
                        <h5
                          id={id}
                          className="group relative mt-3.5 mb-1 scroll-mt-24 text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2"
                        >
                          <span>{children}</span>
                          <a
                            href={`#${id}`}
                            onClick={(e) => handleHeadingClick(e, id, text)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#a1001f] transition-opacity text-xs font-normal select-none"
                            title="Liên kết mục này"
                          >
                            #
                          </a>
                        </h5>
                      )
                    },
                    h6: ({ node, children, ...props }: any) => {
                      const text = getPlainText(children)
                      const id = props.id || slugify(text)
                      return (
                        <h6
                          id={id}
                          className="group relative mt-3 mb-1 scroll-mt-24 text-xs sm:text-sm font-semibold uppercase tracking-wider text-gray-600 flex items-center gap-2"
                        >
                          <span>{children}</span>
                          <a
                            href={`#${id}`}
                            onClick={(e) => handleHeadingClick(e, id, text)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#a1001f] transition-opacity text-xs font-normal select-none"
                            title="Liên kết mục này"
                          >
                            #
                          </a>
                        </h6>
                      )
                    },
                    img: ({ src, alt, title }: any) => {
                      if (!src) return null
                      const rawSrc = typeof src === 'string' ? src : undefined
                      const cleanSrc = rawSrc ? decodeHtmlEntities(rawSrc).trim() : ''
                      const normalizedSrc = normalizeStorageUrl(cleanSrc)
                      const altText =
                        typeof alt === 'string' && alt.trim()
                          ? alt.trim()
                          : typeof title === 'string' && title.trim()
                            ? title.trim()
                            : 'Hình ảnh minh họa'
                      const imageIndex = galleryImages.findIndex(
                        (image) =>
                          image.src === normalizedSrc || image.src === cleanSrc,
                      )
                      return (
                        <DocImage
                          src={normalizedSrc}
                          alt={altText}
                          title={typeof title === 'string' ? title : undefined}
                          onZoom={() => {
                            if (galleryImages.length === 0) return
                            setLightboxIndex(imageIndex >= 0 ? imageIndex : 0)
                          }}
                        />
                      )
                    },
                    p: ({ node, children, className, ...props }: any) => (
                      <div className={cn('my-3 leading-relaxed text-gray-800', className)} {...props}>
                        {children}
                      </div>
                    ),
                    figure: ({ node, children, className, ...props }: any) => (
                      <div className={cn('my-5 block text-center', className)} {...props}>
                        {children}
                      </div>
                    ),
                    figcaption: ({ node, children, className, ...props }: any) => (
                      <div className={cn('mt-1.5 block text-center text-xs text-gray-500 italic', className)} {...props}>
                        {children}
                      </div>
                    ),
                    table: ({ node, children, className, ...props }: any) => (
                      <div className="relative my-5 w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
                        <table className={cn('w-full border-collapse caption-bottom text-sm text-gray-900', className)} {...props}>
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ node, children, className, ...props }: any) => (
                      <thead className={cn('bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold', className)} {...props}>
                        {children}
                      </thead>
                    ),
                    tbody: ({ node, children, className, ...props }: any) => (
                      <tbody className={cn('bg-white divide-y divide-gray-200 text-gray-900', className)} {...props}>
                        {children}
                      </tbody>
                    ),
                    tr: ({ node, children, className, ...props }: any) => (
                      <tr className={cn('border-b border-gray-200 transition-colors hover:bg-gray-50', className)} {...props}>
                        {children}
                      </tr>
                    ),
                    th: ({ node, children, style, className, ...props }: any) => {
                      const rSpan = props.rowSpan ?? props.rowspan
                      const cSpan = props.colSpan ?? props.colspan
                      const rowSpan = rSpan && Number(rSpan) > 0 ? Number(rSpan) : undefined
                      const colSpan = cSpan && Number(cSpan) > 0 ? Number(cSpan) : undefined
                      return (
                        <th
                          rowSpan={rowSpan}
                          colSpan={colSpan}
                          style={style}
                          className={cn(
                            'h-10 border border-gray-200 bg-gray-50 px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-700',
                            className
                          )}
                        >
                          {children}
                        </th>
                      )
                    },
                    td: ({ node, children, style, className, ...props }: any) => {
                      const rSpan = props.rowSpan ?? props.rowspan
                      const cSpan = props.colSpan ?? props.colspan
                      const rowSpan = rSpan && Number(rSpan) > 0 ? Number(rSpan) : undefined
                      const colSpan = cSpan && Number(cSpan) > 0 ? Number(cSpan) : undefined
                      return (
                        <td
                          rowSpan={rowSpan}
                          colSpan={colSpan}
                          style={style}
                          className={cn(
                            'border border-gray-200 px-4 py-3 align-top text-sm text-gray-900 leading-relaxed break-words',
                            className
                          )}
                        >
                          {children}
                        </td>
                      )
                    },
                    mark: ({ children, style, ...props }: any) => {
                      const color = (style?.color || '').toLowerCase().trim()
                      let bgClass = 'bg-amber-100 text-amber-950 border-amber-300'
                      if (color === 'green') {
                        bgClass = 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      } else if (color === 'blue') {
                        bgClass = 'bg-blue-100 text-blue-900 border-blue-300'
                      } else if (color === 'orange') {
                        bgClass = 'bg-orange-100 text-orange-950 border-orange-300'
                      } else if (color === 'yellow') {
                        bgClass = 'bg-yellow-100 text-amber-950 border-yellow-300'
                      } else if (color === 'red') {
                        bgClass = 'bg-rose-100 text-rose-950 border-rose-300'
                      } else if (color === 'purple') {
                        bgClass = 'bg-purple-100 text-purple-950 border-purple-300'
                      }
                      return (
                        <mark
                          {...props}
                          style={style}
                          className={cn('inline px-1.5 py-0.5 rounded font-medium border text-[0.93em] mx-0.5', bgClass)}
                        >
                          {children}
                        </mark>
                      )
                    },
                    li: ({ children }) => {
                      const childNodes = Children.toArray(children as any)
                      let firstAnchor: { href: string; label: string } | null =
                        null

                      for (const child of childNodes) {
                        const found = findFirstAnchor(child)
                        if (found) {
                          firstAnchor = found
                          break
                        }
                      }

                      const plainText = getPlainText(children).trim()
                      const normalizedPlainText = plainText
                        .replace(/\s+/g, ' ')
                        .trim()
                      const normalizedAnchorLabel = (firstAnchor?.label || '')
                        .replace(/\s+/g, ' ')
                        .trim()
                      const residue = normalizedPlainText
                        .replace(normalizedAnchorLabel, '')
                        .replace(/[\s.\-:()\[\]{}]+/g, '')
                        .trim()

                      const isLinkOnlyItem =
                        Boolean(firstAnchor) && residue.length === 0

                      if (isLinkOnlyItem && firstAnchor) {
                        const mappedHref = mapGitbookHref(
                          firstAnchor.href,
                          basePath,
                          documents
                        )
                        const isExternal = /^https?:\/\//.test(mappedHref)
                        const inlineLinkClassName = 'k12-inline-link'

                        return (
                          <li className="my-1">
                            {isExternal ? (
                              <a
                                href={mappedHref}
                                target="_blank"
                                rel="noreferrer"
                                className={inlineLinkClassName}
                              >
                                {firstAnchor.label}
                              </a>
                            ) : (
                              <Link
                                href={mappedHref}
                                className={inlineLinkClassName}
                              >
                                {firstAnchor.label}
                              </Link>
                            )}
                          </li>
                        )
                      }

                      return <li>{children}</li>
                    },
                    details: ({ children }) => (
                      <details className="my-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        {children}
                      </details>
                    ),
                    ul: ({ children }) => {
                      const items = Children.toArray(children as any).filter(
                        (child) =>
                          !(typeof child === 'string' && child.trim() === ''),
                      )
                      const linkItems = items.map((item) =>
                        extractListItemLink(item),
                      )
                      const validLinkItems = linkItems.filter(
                        (item): item is { href: string; label: string } =>
                          Boolean(item),
                      )
                      const canUseLinkCards =
                        validLinkItems.length >= 1 &&
                        validLinkItems.length === items.length

                      if (canUseLinkCards) {
                        return (
                          <ul className="my-3 list-disc space-y-1 pl-5">
                            {validLinkItems.map((safeItem) => {
                              const mappedHref = mapGitbookHref(
                                safeItem.href,
                                basePath,
                                documents
                              )
                              const isExternal = /^https?:\/\//.test(mappedHref)

                              return isExternal ? (
                                <li key={`${safeItem.href}-${safeItem.label}`}>
                                  <a
                                    href={mappedHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="k12-inline-link"
                                  >
                                    {safeItem.label}
                                  </a>
                                </li>
                              ) : (
                                <li key={`${safeItem.href}-${safeItem.label}`}>
                                  <Link
                                    href={mappedHref}
                                    className="k12-inline-link"
                                  >
                                    {safeItem.label}
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        )
                      }

                      return <ul>{children}</ul>
                    },
                    summary: ({ children }) => (
                      <summary className="cursor-pointer font-semibold text-gray-900">
                        {children}
                      </summary>
                    ),
                  }}
                >
                  {normalizedContent}
                </Markdown>
                
                {/* Hiển thị danh sách trang con nếu có */}
                {childPages.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                      Nội dung trong mục này
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {childPages.map((child) => {
                        const childDoc = documents.find(doc => doc.slug === child.slug)
                        return (
                          <Link
                            key={child.slug}
                            href={`${basePath}?doc=${encodeURIComponent(child.slug!)}`}
                            onClick={(e) => {
                              e.preventDefault()
                              navigateToDoc(child.slug!)
                            }}
                            className="group flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-[#a1001f] hover:bg-red-50/50 transition-all duration-200"
                          >
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 group-hover:text-[#a1001f] transition-colors line-clamp-2 mb-1 flex items-center gap-2">
                                <span className="text-base">{child.title}</span>
                              </h3>
                              {childDoc?.excerpt && (
                                <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                                  {childDoc.excerpt}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="flex-shrink-0 w-5 h-5 text-gray-400 group-hover:text-[#a1001f] group-hover:translate-x-1 transition-all" />
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Không tìm thấy tài liệu.</p>
          )}

          {/* Navigation buttons */}
          {selectedDoc && (getPreviousNextDocs.prev || getPreviousNextDocs.next) && (
            <div className="mt-8 pt-6 border-t border-gray-200 flex gap-3 justify-between">
              {getPreviousNextDocs.prev ? (
                <button
                  type="button"
                  onClick={() => navigateToDoc(getPreviousNextDocs.prev!.slug)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Trang trước
                </button>
              ) : (
                <div />
              )}
              
              {getPreviousNextDocs.next ? (
                <button
                  type="button"
                  onClick={() => navigateToDoc(getPreviousNextDocs.next!.slug)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Trang sau
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <div />
              )}
            </div>
          )}
        </article>

        {activeDocHeadings.length > 0 && (
          <aside className="hidden lg:block rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#a1001f]" />
                Mục trong trang
              </h2>
              <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {activeDocHeadings.length}
              </span>
            </div>
            <nav className="space-y-0.5" aria-label="Mục trong trang">
              {activeDocHeadings.map((heading) => {
                const isActive = activeHeadingId === heading.id
                const indentPadding = `${8 + Math.max(0, heading.level - 1) * 10}px`
                const isTopLevel = heading.level <= 1

                return (
                  <a
                    key={`${heading.level}-${heading.id}-${heading.text}`}
                    href={`#${heading.id}`}
                    onClick={(e) => handleHeadingClick(e, heading.id, heading.text)}
                    className={cn(
                      'group flex items-center justify-between rounded-lg py-1.5 pr-2.5 text-xs transition-all duration-150 leading-snug',
                      isTopLevel ? 'font-semibold text-slate-800' : 'text-slate-600 font-normal',
                      isActive
                        ? 'bg-red-50 text-[#a1001f] font-semibold border-l-[3px] border-[#a1001f] shadow-xs'
                        : 'hover:bg-slate-100/80 hover:text-slate-900 border-l-[3px] border-transparent',
                    )}
                    style={{ paddingLeft: indentPadding }}
                  >
                    <span className="line-clamp-2 min-w-0 flex-1">{heading.text}</span>
                    {isActive && (
                      <span className="ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#a1001f]" />
                    )}
                  </a>
                )
              })}
            </nav>
          </aside>
        )}
      </div>

      {lightboxIndex !== null && galleryImages.length > 0 && (
        <ImageLightbox
          images={galleryImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </PageContainer>
  )
}
