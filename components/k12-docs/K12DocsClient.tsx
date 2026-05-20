'use client'

import { PageContainer } from '@/components/PageContainer'
import ImageLightbox from '@/components/ImageLightbox'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
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
} from 'react'
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

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
      const title = style.toUpperCase()
      const lines = body
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
      return `> ${title}\n${lines}`
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

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
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
    // Not a GitBook URL, return as-is
    return href
  }

  // Remove common prefixes for relative paths
  const extractedPath = cleanHref
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
    const src = (match[2] || '').trim()
    if (!src || seen.has(src)) continue
    seen.add(src)
    images.push({ src, alt })
  }

  while ((match = htmlImageRegex.exec(content)) !== null) {
    const src = (match[1] || '').trim()
    if (!src || seen.has(src)) continue
    seen.add(src)
    images.push({ src, alt: 'image' })
  }

  return images
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

                <span className="min-w-0 flex-1">
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
          isMiniToc
            ? 'lg:grid-cols-[120px_minmax(0,1fr)_220px]'
            : 'lg:grid-cols-[300px_minmax(0,1fr)_220px]',
        )}
      >
        <aside
          className={cn(
            'overflow-x-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm',
            'lg:sticky lg:top-4',
            isMiniToc
              ? 'lg:h-auto lg:overflow-hidden'
              : 'lg:h-[calc(100vh-120px)] lg:overflow-y-auto',
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
              <div className="k12-markdown text-gray-800">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
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
                    h1: ({ children }) => {
                      const text = String(children)
                      const id = slugify(text)
                      return (
                        <h1
                          id={id}
                          className="mt-6 scroll-mt-24 text-3xl font-bold text-gray-900"
                        >
                          {children}
                        </h1>
                      )
                    },
                    h2: ({ children }) => {
                      const text = String(children)
                      const id = slugify(text)
                      return (
                        <h2
                          id={id}
                          className="mt-6 scroll-mt-24 text-2xl font-semibold text-gray-900"
                        >
                          {children}
                        </h2>
                      )
                    },
                    h3: ({ children }) => {
                      const text = String(children)
                      const id = slugify(text)
                      return (
                        <h3
                          id={id}
                          className="mt-5 scroll-mt-24 text-xl font-semibold text-gray-900"
                        >
                          {children}
                        </h3>
                      )
                    },
                    img: ({ src, alt }) => {
                      if (!src) return null
                      const imageIndex = galleryImages.findIndex(
                        (image) => image.src === src,
                      )
                      return (
                        <img
                          src={src}
                          alt={alt || 'image'}
                          loading="lazy"
                          className="my-3 max-h-130 w-auto max-w-full cursor-zoom-in rounded-lg border border-gray-200 object-contain"
                          onClick={() => {
                            if (galleryImages.length === 0) return
                            setLightboxIndex(imageIndex >= 0 ? imageIndex : 0)
                          }}
                        />
                      )
                    },
                    table: ({ children }) => (
                      <div className="my-4 overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full w-max border-collapse text-sm">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-800 whitespace-nowrap lg:whitespace-normal">
                        {children}
                      </th>
                    ),
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
                    td: ({ children }) => (
                      <td className="border border-gray-200 px-3 py-2 align-top whitespace-nowrap lg:whitespace-normal">
                        {children}
                      </td>
                    ),
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

        <aside className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-120px)] lg:overflow-y-auto">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Mục trong trang
          </h2>
          {!selectedDoc || selectedDoc.headings.length === 0 ? (
            <p className="text-xs text-gray-500">
              Trang này chưa có heading để điều hướng.
            </p>
          ) : (
            <div className="space-y-1">
              {selectedDoc.headings.map((heading) => (
                <a
                  key={`${heading.level}-${heading.id}-${heading.text}`}
                  href={`#${heading.id}`}
                  className="block rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  style={{ paddingLeft: `${8 + (heading.level - 1) * 10}px` }}
                >
                  {heading.text}
                </a>
              ))}
            </div>
          )}
        </aside>
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
