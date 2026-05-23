"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageContainer } from "@/components/PageContainer";
import RichTextEditor from "@/components/RichTextEditor";
import { toast } from "@/lib/app-toast";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { cn } from "@/lib/utils";
import {
    AlertTriangle,
    BookOpenText,
    ChevronDown,
    ChevronRight,
    FilePlus2,
    FileText,
    GripVertical,
    History,
    Plus,
    Save,
    Search,
    Send,
    ShieldAlert,
    Trash2,
} from "lucide-react";
import { marked } from "marked";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

interface K12DocRow {
  id: number;
  slug: string;
  title: string;
  relativePath: string;
  content: string;
  type?: "section" | "article";
  sectionId?: number | null;
  parentId?: number | null;
  topic?: string;
  excerpt?: string;
  coverImageUrl?: string;
  status: "draft" | "published";
  sortOrder: number;
  updatedAt?: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  data?: K12DocRow | K12DocRow[] | { affectedCount: number } | PublishSnapshotInfo | null;
}

interface PublishSnapshotInfo {
  id: number;
  documentCount: number;
  createdByEmail: string;
  createdAt: string;
}

interface FormState {
  originalSlug: string;
  title: string;
  slug: string;
  content: string;
  topic: string;
  excerpt: string;
  coverImageUrl: string;
  status: "draft" | "published";
}

interface SidebarTreeNode {
  id: string;
  title: string;
  type: "folder" | "doc";
  slug?: string;
  children?: SidebarTreeNode[];
}

type EditorMode = "markdown" | "visual";

const EMPTY_FORM: FormState = {
  originalSlug: "",
  title: "",
  slug: "",
  content: "",
  topic: "",
  excerpt: "",
  coverImageUrl: "",
  status: "draft",
};

function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function normalizeRelativePath(input: string) {
  return (input || "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

function getSlugLeaf(slug: string) {
  const normalized = normalizeRelativePath(slug);
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || normalized;
}

function getPathWithoutExt(input: string) {
  return normalizeRelativePath(input).replace(/\.md$/i, "");
}

function normalizeGitBookMarkdown(input: string) {
  return input
    .replace(/\r\n?/g, "\n")
    // GitBook hint blocks are converted to blockquotes.
    .replace(/{%\s*hint[^%]*%}/gi, "\n> ")
    .replace(/{%\s*endhint\s*%}/gi, "\n")
    // Convert tab containers to simple headings so content stays editable.
    .replace(/{%\s*tabs[^%]*%}/gi, "\n")
    .replace(/{%\s*endtabs\s*%}/gi, "\n")
    .replace(/{%\s*tab\s+title="([^"]+)"\s*%}/gi, "\n### $1\n")
    .replace(/{%\s*endtab\s*%}/gi, "\n")
    // Keep links from embeds/content refs as regular markdown links.
    .replace(/{%\s*content-ref\s+url="([^"]+)"\s*%}/gi, "\n[$1]($1)\n")
    .replace(/{%\s*endcontent-ref\s*%}/gi, "\n")
    .replace(/{%\s*embed\s+url="([^"]+)"\s*%}/gi, "\n[$1]($1)\n")
    // Remove other unsupported GitBook directives instead of rendering raw tags.
    .replace(/^\s*{%\s*[^%]+%}\s*$/gim, "");
}

function convertMarkdownToEditorHtml(input: string) {
  const source = input || "";
  const unescaped =
    source.includes("\\n") && !source.includes("\n")
      ? source.replace(/\\n/g, "\n")
      : source;
  const normalized = normalizeGitBookMarkdown(unescaped);
  const raw = normalized.trim();
  if (!raw) return "";

  const hasHtmlTag = /<[a-z][\s\S]*>/i.test(raw);

  const looksLikeMarkdown =
    /(^|\n)#{1,6}\s+/.test(raw) ||
    /(^|\n)>{1,3}\s+/.test(raw) ||
    /(^|\n)```/.test(raw) ||
    /(^|\n)\|.+\|/.test(raw) ||
    /(^|\n)---+\s*$/.test(raw) ||
    /\*\*[^\n]+\*\*/.test(raw) ||
    /\*[^\n]+\*/.test(raw) ||
    /(^|\n)[\-*+]\s+/.test(raw) ||
    /(^|\n)\d+\.\s+/.test(raw) ||
    /\[[^\]]+\]\([^\)]+\)/.test(raw) ||
    /{%\s*[^%]+%}/.test(raw);

  // Keep pure HTML untouched, but still parse mixed markdown+HTML content.
  if (hasHtmlTag && !looksLikeMarkdown) {
    return normalized;
  }

  if (!looksLikeMarkdown && !hasHtmlTag) {
    return normalized;
  }

  try {
    const html = marked.parse(raw, { gfm: true, breaks: true });
    return typeof html === "string" ? html : normalized;
  } catch {
    return normalized;
  }
}

function convertEditorHtmlToMarkdown(input: string) {
  const source = (input || "").trim();
  if (!source) return "";

  // If this is already markdown/plain text, keep it unchanged.
  if (!/<[a-z][\s\S]*>/i.test(source)) {
    return source;
  }

  const browserParser =
    typeof window !== "undefined" && typeof window.DOMParser !== "undefined"
      ? new window.DOMParser()
      : null;

  if (!browserParser) {
    return source
      .replace(/<br\s*\/?>(\n)?/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const doc = browserParser.parseFromString(source, "text/html");

  const toMarkdown = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(/\s+/g, " ");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(toMarkdown).join("");

    if (tag === "strong" || tag === "b") return `**${children.trim()}**`;
    if (tag === "em" || tag === "i") return `*${children.trim()}*`;
    if (tag === "code") return `\`${children.trim()}\``;
    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      return href ? `[${children.trim() || href}](${href})` : children;
    }
    if (tag === "br") return "\n";
    if (tag === "p") return `${children.trim()}\n\n`;
    if (tag === "blockquote") {
      const text = children
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return `${text}\n\n`;
    }
    if (tag === "pre") {
      const code = el.textContent || "";
      return `\`\`\`\n${code.trim()}\n\`\`\`\n\n`;
    }
    if (tag === "ul") {
      const items = Array.from(el.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((li) => `- ${toMarkdown(li).trim()}`)
        .join("\n");
      return `${items}\n\n`;
    }
    if (tag === "ol") {
      const items = Array.from(el.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((li, index) => `${index + 1}. ${toMarkdown(li).trim()}`)
        .join("\n");
      return `${items}\n\n`;
    }
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.charAt(1));
      return `${"#".repeat(level)} ${children.trim()}\n\n`;
    }

    return children;
  };

  const markdown = Array.from(doc.body.childNodes)
    .map(toMarkdown)
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return markdown;
}

function normalizeDocRow(input: Partial<K12DocRow>): K12DocRow {
  return {
    id: Number(input.id) || 0,
    slug: input.slug || "",
    title: input.title || "",
    relativePath: normalizeRelativePath(input.relativePath || ""),
    content: input.content || "",
    type: input.type === "section" ? "section" : "article",
    sectionId: input.sectionId ?? null,
    parentId: input.parentId ?? null,
    topic: input.topic || "",
    excerpt: input.excerpt || "",
    coverImageUrl: input.coverImageUrl || "",
    status: input.status === "published" ? "published" : "draft",
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    updatedAt: input.updatedAt,
  };
}

function prettifySegment(segment: string) {
  const cleaned = segment
    .replace(/\.md$/i, "")
    .replace(/^[0-9]+[.-]?/, "")
    .replace(/[._-]+/g, " ")
    .trim();

  if (!cleaned) return segment;

  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildSidebarTreeByRelativePath(documents: K12DocRow[]): SidebarTreeNode[] {
  const root: SidebarTreeNode[] = [];
  const folderMap = new Map<string, SidebarTreeNode>();
  const docBySlug = new Map<string, K12DocRow>();
  const docByPathWithoutExt = new Map<string, K12DocRow>();
  const consumedAsFolderLanding = new Set<string>();
  const normalizedPathBySlug = new Map<string, string>();

  const normalizePath = (input: string) => input.replace(/\\/g, "/").replace(/\/+/g, "/").trim();

  const romanValues: Record<string, number> = {
    i: 1,
    v: 5,
    x: 10,
    l: 50,
    c: 100,
    d: 500,
    m: 1000,
  };

  const parseRoman = (roman: string): number | null => {
    const input = roman.toLowerCase().trim();
    if (!input || !/^[ivxlcdm]+$/.test(input)) return null;

    let total = 0;
    for (let i = 0; i < input.length; i += 1) {
      const current = romanValues[input[i]];
      const next = romanValues[input[i + 1]] || 0;
      if (!current) return null;
      total += current < next ? -current : current;
    }

    return total;
  };

  const getOrderFromSegment = (segment: string): number | null => {
    const normalized = segment.toLowerCase();
    const numericMatch = normalized.match(/^([0-9]+)[\.-]/);
    if (numericMatch) {
      return Number(numericMatch[1]);
    }

    const romanMatch = normalized.match(/^([ivxlcdm]+)[\.-]/);
    if (!romanMatch) return null;
    return parseRoman(romanMatch[1]);
  };

  const getSegmentOrder = (node: SidebarTreeNode): number | null => {
    const raw = node.id.startsWith("folder:")
      ? node.id.slice("folder:".length)
      : node.slug || "";
    const segment = raw.split("/").filter(Boolean).pop() || "";
    return getOrderFromSegment(segment);
  };

  const getNodeKey = (node: SidebarTreeNode) => {
    if (node.slug) return `doc:${node.slug}`;
    return `folder:${node.id}`;
  };

  const toAbsoluteDocSlug = (href: string): string | null => {
    const rootPrefix = "/quy-trinh-quy-dinh-danh-cho-giao-vien/";
    const directPrefix = "quy-trinh-quy-dinh-danh-cho-giao-vien/";
    const fullPrefix = "cxohok12.gitbook.io/quy-trinh-quy-dinh-danh-cho-giao-vien/";

    const sanitized = href.trim().split("#")[0].split("?")[0];
    if (!sanitized) return null;

    if (sanitized.startsWith(rootPrefix)) {
      return sanitized.slice(rootPrefix.length).replace(/\.md$/i, "");
    }

    if (sanitized.startsWith(directPrefix)) {
      return sanitized.slice(directPrefix.length).replace(/\.md$/i, "");
    }

    const markerIndex = sanitized.indexOf(fullPrefix);
    if (markerIndex >= 0) {
      return sanitized.slice(markerIndex + fullPrefix.length).replace(/\.md$/i, "");
    }

    if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
      return null;
    }

    return sanitized.replace(/^\/+/, "").replace(/\.md$/i, "");
  };

  const extractInternalLinkOrder = (content: string): string[] => {
    const orderedSlugs: string[] = [];
    const seen = new Set<string>();
    const linkRegex = /\[[^\]]+\]\(([^\)]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const href = match[1] || "";
      const slug = toAbsoluteDocSlug(href);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      orderedSlugs.push(slug);
    }

    return orderedSlugs;
  };

  const sortNodes = (nodes: SidebarTreeNode[]) => {
    nodes.sort((a, b) => {
      const orderA = getSegmentOrder(a);
      const orderB = getSegmentOrder(b);

      if (orderA != null && orderB != null && orderA !== orderB) {
        return orderA - orderB;
      }

      if (orderA != null && orderB == null) return -1;
      if (orderA == null && orderB != null) return 1;

      const sortA = a.slug ? docBySlug.get(a.slug)?.sortOrder : undefined;
      const sortB = b.slug ? docBySlug.get(b.slug)?.sortOrder : undefined;

      if (sortA != null && sortB != null && sortA !== sortB) {
        return sortA - sortB;
      }

      return a.title.localeCompare(b.title, "vi");
    });
  };

  const ensureFolder = (folderPath: string): SidebarTreeNode => {
    const normalizedFolderPath = normalizePath(folderPath);
    const existing = folderMap.get(normalizedFolderPath);
    if (existing) return existing;

    const segment = normalizedFolderPath.split("/").pop() || normalizedFolderPath;
    const node: SidebarTreeNode = {
      id: `folder:${normalizedFolderPath}`,
      title: prettifySegment(segment),
      type: "folder",
      children: [],
    };

    folderMap.set(normalizedFolderPath, node);

    const parentPath = normalizedFolderPath.includes("/")
      ? normalizedFolderPath.slice(0, normalizedFolderPath.lastIndexOf("/"))
      : "";
    if (!parentPath) {
      root.push(node);
    } else {
      const parent = ensureFolder(parentPath);
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    }

    return node;
  };

  for (const doc of documents) {
    docBySlug.set(doc.slug, doc);
    const normalizedPath = normalizePath(doc.relativePath || `${doc.slug}.md`);
    normalizedPathBySlug.set(doc.slug, normalizedPath);
    docByPathWithoutExt.set(normalizedPath.replace(/\.md$/i, ""), doc);
  }

  for (const doc of documents) {
    const normalizedPath = normalizedPathBySlug.get(doc.slug) || normalizePath(doc.relativePath || `${doc.slug}.md`);
    const pathWithoutExt = normalizedPath.replace(/\.md$/i, "");
    const segments = pathWithoutExt.split("/").filter(Boolean);
    if (segments.length <= 1) continue;

    for (let i = 1; i < segments.length; i += 1) {
      const folderPath = segments.slice(0, i).join("/");
      ensureFolder(folderPath);
    }
  }

  for (const [folderPath, folderNode] of folderMap.entries()) {
    const landingDoc = docByPathWithoutExt.get(folderPath);
    if (!landingDoc) continue;

    folderNode.title = landingDoc.title || folderNode.title;
    folderNode.slug = landingDoc.slug;
    consumedAsFolderLanding.add(landingDoc.slug);
  }

  for (const doc of documents) {
    if (consumedAsFolderLanding.has(doc.slug)) continue;

    const normalizedPath = normalizedPathBySlug.get(doc.slug) || normalizePath(doc.relativePath || `${doc.slug}.md`);
    const pathWithoutExt = normalizedPath.replace(/\.md$/i, "");
    const segments = pathWithoutExt.split("/").filter(Boolean);
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join("/") : "";

    const node: SidebarTreeNode = {
      id: `doc:${doc.slug}`,
      title: doc.title || prettifySegment(segments[segments.length - 1] || doc.slug),
      type: "doc",
      slug: doc.slug,
    };

    if (!parentPath) {
      root.push(node);
      continue;
    }

    const parent = ensureFolder(parentPath);
    if (!parent.children) parent.children = [];
    parent.children.push(node);
  }

  const reorderWithDocLinks = (nodes: SidebarTreeNode[]) => {
    sortNodes(nodes);

    nodes.forEach((node) => {
      if (!node.children || node.children.length === 0) return;

      reorderWithDocLinks(node.children);

      if (!node.slug) return;
      const sourceDoc = docBySlug.get(node.slug);
      if (!sourceDoc) return;

      const links = extractInternalLinkOrder(sourceDoc.content || "");
      if (links.length === 0) return;

      const indexMap = new Map<string, number>();
      links.forEach((slug, index) => indexMap.set(slug, index));

      node.children.sort((a, b) => {
        const orderA = getSegmentOrder(a);
        const orderB = getSegmentOrder(b);
        if (orderA != null && orderB != null && orderA !== orderB) {
          return orderA - orderB;
        }

        const sortA = a.slug ? docBySlug.get(a.slug)?.sortOrder : undefined;
        const sortB = b.slug ? docBySlug.get(b.slug)?.sortOrder : undefined;
        if (sortA != null && sortB != null && sortA !== sortB) {
          return sortA - sortB;
        }

        const keyA = a.slug || "";
        const keyB = b.slug || "";
        const idxA = keyA ? indexMap.get(keyA) : undefined;
        const idxB = keyB ? indexMap.get(keyB) : undefined;

        if (idxA != null && idxB != null) return idxA - idxB;
        if (idxA != null && idxB == null) return -1;
        if (idxA == null && idxB != null) return 1;

        if (orderA != null && orderB != null && orderA !== orderB) {
          return orderA - orderB;
        }

        return a.title.localeCompare(b.title, "vi");
      });
    });
  };

  const uniqueRoot: SidebarTreeNode[] = [];
  const rootSeen = new Set<string>();
  for (const node of root) {
    const key = getNodeKey(node);
    if (rootSeen.has(key)) continue;
    rootSeen.add(key);
    uniqueRoot.push(node);
  }

  reorderWithDocLinks(uniqueRoot);
  return uniqueRoot;
}

export default function ManageK12DocsPage() {
  const { user, token, isLoading } = useAuth();
  const [documents, setDocuments] = useState<K12DocRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [pendingParentSlug, setPendingParentSlug] = useState<string | null>(null);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [draggingSlug, setDraggingSlug] = useState("");
  const [dropTargetSlug, setDropTargetSlug] = useState<string | null>(null);
  const [isRootDropActive, setIsRootDropActive] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [draftPreviewParentSlug, setDraftPreviewParentSlug] = useState<string | null>(null);
  const [draftPreviewToken, setDraftPreviewToken] = useState(0);
  const [latestPublishSnapshot, setLatestPublishSnapshot] = useState<PublishSnapshotInfo | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("markdown");
  const [visualContent, setVisualContent] = useState("");
  const sidebarScrollRef = useRef<HTMLElement | null>(null);

  const notify = (type: "success" | "error", text: string) => {
    if (type === "success") {
      toast.success(text);
      return;
    }
    toast.error(text);
  };

  const replaceSlugPrefix = (value: string, oldPrefix: string, nextPrefix: string) => {
    if (value === oldPrefix) return nextPrefix;
    if (value.startsWith(`${oldPrefix}/`)) {
      return `${nextPrefix}${value.slice(oldPrefix.length)}`;
    }
    return value;
  };

  const isSuperAdmin = user?.role === "super_admin";

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title, "vi");
    });
  }, [documents]);

  const docsBySlug = useMemo(() => {
    return new Map(sortedDocuments.map((doc) => [doc.slug, doc]));
  }, [sortedDocuments]);

  const docsById = useMemo(() => {
    return new Map(sortedDocuments.map((doc) => [doc.id, doc]));
  }, [sortedDocuments]);

  const pathOwnerDocIdMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedDocuments.forEach((doc) => {
      const pathWithoutExt = getPathWithoutExt(doc.relativePath);
      if (!pathWithoutExt) return;
      map.set(pathWithoutExt, doc.id);
    });
    return map;
  }, [sortedDocuments]);

  const pathOwnerDocByPath = useMemo(() => {
    const map = new Map<string, K12DocRow>();
    sortedDocuments.forEach((doc) => {
      const pathWithoutExt = getPathWithoutExt(doc.relativePath);
      if (!pathWithoutExt) return;
      map.set(pathWithoutExt, doc);
    });
    return map;
  }, [sortedDocuments]);

  const inferredParentByDocId = useMemo(() => {
    const map = new Map<number, number | null>();

    sortedDocuments.forEach((doc) => {
      const pathWithoutExt = getPathWithoutExt(doc.relativePath);
      if (!pathWithoutExt.includes("/")) {
        map.set(doc.id, null);
        return;
      }

      const parentPath = pathWithoutExt.slice(0, pathWithoutExt.lastIndexOf("/"));
      const inferredParentId = pathOwnerDocIdMap.get(parentPath) ?? null;
      map.set(doc.id, inferredParentId);
    });

    return map;
  }, [pathOwnerDocIdMap, sortedDocuments]);

  const effectiveParentIdByDocId = useMemo(() => {
    const map = new Map<number, number | null>();

    sortedDocuments.forEach((doc) => {
      const inferredParentId = inferredParentByDocId.get(doc.id) ?? null;
      const currentParentId = doc.parentId ?? null;

      if (currentParentId != null && docsById.has(currentParentId)) {
        map.set(doc.id, currentParentId);
        return;
      }

      map.set(doc.id, inferredParentId);
    });

    return map;
  }, [docsById, inferredParentByDocId, sortedDocuments]);

  const hierarchyIssues = useMemo(() => {
    return sortedDocuments
      .map((doc) => {
        const inferredParentId = inferredParentByDocId.get(doc.id) ?? null;
        const effectiveParentId = effectiveParentIdByDocId.get(doc.id) ?? null;
        const pathWithoutExt = getPathWithoutExt(doc.relativePath);

        const hasMalformedSlug = doc.slug.includes("\\") || doc.slug !== normalizeRelativePath(doc.slug);
        const hasMalformedPath = doc.relativePath.includes("\\") || doc.relativePath !== normalizeRelativePath(doc.relativePath);
        const parentMismatch = inferredParentId !== null && (doc.parentId ?? null) !== inferredParentId;
        const brokenParentRef = doc.parentId != null && !docsById.has(doc.parentId);

        if (!hasMalformedSlug && !hasMalformedPath && !parentMismatch && !brokenParentRef) {
          return null;
        }

        const reason = [
          hasMalformedSlug ? "slug chưa chuẩn" : null,
          hasMalformedPath ? "đường dẫn chưa chuẩn" : null,
          parentMismatch ? "parent_id lệch so với đường dẫn" : null,
          brokenParentRef ? "parent_id trỏ tới page không tồn tại" : null,
        ]
          .filter(Boolean)
          .join(", ");

        const effectiveParent = effectiveParentId != null ? docsById.get(effectiveParentId) : null;

        return {
          id: doc.id,
          slug: doc.slug,
          title: doc.title,
          pathWithoutExt,
          reason,
          suggestedParentTitle: effectiveParent?.title || "Root",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [docsById, effectiveParentIdByDocId, inferredParentByDocId, sortedDocuments]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<number | null, K12DocRow[]>();

    for (const doc of sortedDocuments) {
      const key = effectiveParentIdByDocId.get(doc.id) ?? null;
      const list = map.get(key) || [];
      list.push(doc);
      map.set(key, list);
    }

    return map;
  }, [effectiveParentIdByDocId, sortedDocuments]);

  const rootDocs = useMemo(() => childrenByParentId.get(null) || [], [childrenByParentId]);

  const sidebarTree = useMemo(() => {
    return buildSidebarTreeByRelativePath(sortedDocuments);
  }, [sortedDocuments]);

  const searchedDocs = useMemo(() => {
    const keyword = sidebarQuery.trim().toLowerCase();
    if (!keyword) return [];

    return sortedDocuments.filter((doc) => {
      return doc.title.toLowerCase().includes(keyword) || doc.slug.toLowerCase().includes(keyword);
    });
  }, [sidebarQuery, sortedDocuments]);

  const selectedDocument = useMemo(
    () => sortedDocuments.find((doc) => doc.slug === selectedSlug),
    [sortedDocuments, selectedSlug]
  );

  const selectedParentSlug = useMemo(() => {
    if (!selectedDocument) return null;
    const parentId = effectiveParentIdByDocId.get(selectedDocument.id) ?? null;
    if (!parentId) return null;
    return docsById.get(parentId)?.slug || null;
  }, [docsById, effectiveParentIdByDocId, selectedDocument]);

  const callApi = async (
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: Record<string, unknown>,
    includeDraft = true
  ): Promise<ApiResponse> => {
    const query = new URLSearchParams();
    if (includeDraft) query.set("includeDraft", "1");

    const response = await fetch(`/api/k12-docs?${query.toString()}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return (await response.json()) as ApiResponse;
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setVisualContent("");
    setSelectedSlug("");
    setPendingParentSlug(null);
    setDraftPreviewParentSlug(null);
    setDraftPreviewToken(0);
  };

  const applyDocumentToForm = (doc: K12DocRow) => {
    setSelectedSlug(doc.slug);
    setDraftPreviewParentSlug(null);
    setDraftPreviewToken(0);
    const effectiveParentId = effectiveParentIdByDocId.get(doc.id) ?? null;
    setPendingParentSlug(effectiveParentId ? docsById.get(effectiveParentId)?.slug || null : null);
    const editorContent = convertMarkdownToEditorHtml(doc.content || "");
    setVisualContent(editorContent);
    setForm({
      originalSlug: doc.slug,
      title: doc.title,
      slug: doc.slug,
      content: doc.content || "",
      topic: doc.topic || "",
      excerpt: doc.excerpt || "",
      coverImageUrl: doc.coverImageUrl || "",
      status: doc.status,
    });
  };

  const loadDocuments = async () => {
    if (!user?.email || !isSuperAdmin) return;

    setIsLoadingDocs(true);
    const result = await callApi("GET", undefined, true);

    if (!result.success || !Array.isArray(result.data)) {
      notify("error", result.error || "Không thể tải danh sách tài liệu");
      setIsLoadingDocs(false);
      return;
    }

    const rows = result.data.map((row) => normalizeDocRow(row));
    setDocuments(rows);

    const nextExpanded: Record<string, boolean> = {};
    rows.forEach((doc) => {
      const hasChildren = rows.some((item) => item.parentId === doc.id);
      if (hasChildren) {
        nextExpanded[doc.slug] = true;
      }
    });
    setExpandedNodes((prev) => ({ ...nextExpanded, ...prev }));

    if (selectedSlug) {
      const selected = rows.find((doc) => doc.slug === selectedSlug);
      if (selected) {
        applyDocumentToForm(selected);
      } else {
        resetForm();
      }
    } else if (rows.length > 0) {
      applyDocumentToForm(rows[0]);
    } else {
      resetForm();
    }

    setIsLoadingDocs(false);
  };

  const loadPublishHistory = async () => {
    if (!user?.email || !isSuperAdmin) return;

    const query = new URLSearchParams();
    query.set("includeDraft", "1");
    query.set("action", "history");

    const response = await fetch(`/api/k12-docs?${query.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
    });

    const result = (await response.json()) as ApiResponse;
    if (!result.success) {
      return;
    }

    setLatestPublishSnapshot((result.data as PublishSnapshotInfo | null) || null);
  };

  const repairHierarchy = async () => {
    if (!user?.email) return;

    setIsBusy(true);
    const result = await callApi("PATCH", { action: "repair_hierarchy" }, true);
    setIsBusy(false);

    if (!result.success) {
      notify("error", result.error || "Không thể sửa phân cấp tài liệu");
      return;
    }

    notify("success", result.message || "Đã sửa phân cấp tài liệu theo đường dẫn");
  };

  const isDescendant = (candidateParentId: number | null, childId: number) => {
    let currentId = candidateParentId;
    const visited = new Set<number>();

    while (currentId != null) {
      if (currentId === childId) return true;
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const currentDoc = docsById.get(currentId);
      currentId = currentDoc?.parentId ?? null;
    }

    return false;
  };

  const moveDocumentToParent = async (sourceSlug: string, targetSlug: string | null) => {
    const sourceDoc = docsBySlug.get(sourceSlug);
    if (!sourceDoc) return;

    const previousDocuments = documents;
    const previousSelectedSlug = selectedSlug;
    const previousForm = form;

    const targetDoc = targetSlug ? docsBySlug.get(targetSlug) || null : null;
    const currentParentId = effectiveParentIdByDocId.get(sourceDoc.id) ?? null;
    const currentParentSlug = currentParentId ? docsById.get(currentParentId)?.slug || null : null;
    const targetParentId = targetDoc ? (effectiveParentIdByDocId.get(targetDoc.id) ?? null) : null;

    if (targetSlug === sourceSlug) return;
    if (currentParentSlug === targetSlug) return;

    if (targetDoc && targetParentId === currentParentId) {
      const siblingDocs = sortedDocuments.filter(
        (doc) => (effectiveParentIdByDocId.get(doc.id) ?? null) === currentParentId
      );

      const sourceIndex = siblingDocs.findIndex((doc) => doc.slug === sourceDoc.slug);
      const targetIndex = siblingDocs.findIndex((doc) => doc.slug === targetDoc.slug);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return;
      }

      const reordered = [...siblingDocs];
      const [movedDoc] = reordered.splice(sourceIndex, 1);
      const insertAt = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      if (insertAt === sourceIndex) {
        return;
      }
      reordered.splice(insertAt, 0, movedDoc);

      const orderBySlug = new Map(reordered.map((doc, index) => [doc.slug, index]));
      setDocuments((prev) =>
        prev.map((doc) => {
          const nextOrder = orderBySlug.get(doc.slug);
          if (nextOrder == null) return doc;
          const isMovedSubtree = doc.slug === sourceDoc.slug || doc.slug.startsWith(`${sourceDoc.slug}/`);
          return {
            ...doc,
            sortOrder: nextOrder,
            status: isMovedSubtree ? "draft" : doc.status,
          };
        })
      );

      setIsBusy(true);
      const reorderResult = await callApi("PATCH", {
        action: "reorder_siblings",
        parentSlug: currentParentSlug || undefined,
        orderedSlugs: reordered.map((doc) => doc.slug),
      }, true);
      setIsBusy(false);

      if (!reorderResult.success) {
        setDocuments(previousDocuments);
        notify("error", reorderResult.error || "Không thể cập nhật thứ tự mục cùng cấp");
        return;
      }

      notify("success", reorderResult.message || "Đã cập nhật thứ tự các mục cùng cấp");
      return;
    }

    if (targetDoc && isDescendant(targetDoc.id, sourceDoc.id)) {
      notify("error", "Không thể kéo thả vào chính bài con của nó.");
      return;
    }

    const siblingDocs = sortedDocuments.filter((doc) => {
      if (doc.slug === sourceDoc.slug) return false;
      const docEffectiveParentId = effectiveParentIdByDocId.get(doc.id) ?? null;
      if (!targetDoc) return docEffectiveParentId == null;
      return docEffectiveParentId === targetDoc.id;
    });

    const nextSortOrder = siblingDocs.length > 0
      ? Math.max(...siblingDocs.map((doc) => doc.sortOrder)) + 1
      : 0;

    const sourceLeafSlug = getSlugLeaf(sourceDoc.slug);
    const nextSlug = targetDoc
      ? normalizeRelativePath(`${targetDoc.slug}/${sourceLeafSlug}`)
      : sourceLeafSlug;

    setDocuments((prev) =>
      prev.map((doc) => {
        const nextSlugValue = replaceSlugPrefix(doc.slug, sourceDoc.slug, nextSlug);
        if (nextSlugValue !== doc.slug) {
          return {
            ...doc,
            slug: nextSlugValue,
            relativePath: replaceSlugPrefix(doc.relativePath, sourceDoc.slug, nextSlug),
            parentId: doc.slug === sourceDoc.slug ? (targetDoc?.id || null) : doc.parentId,
            sortOrder: doc.slug === sourceDoc.slug ? nextSortOrder : doc.sortOrder,
            status: "draft",
          };
        }
        return doc;
      })
    );

    if (selectedSlug === sourceDoc.slug || selectedSlug.startsWith(`${sourceDoc.slug}/`)) {
      const nextSelected = replaceSlugPrefix(selectedSlug, sourceDoc.slug, nextSlug);
      setSelectedSlug(nextSelected);
      setForm((prev) => ({
        ...prev,
        originalSlug: prev.originalSlug ? replaceSlugPrefix(prev.originalSlug, sourceDoc.slug, nextSlug) : prev.originalSlug,
        slug: prev.slug ? replaceSlugPrefix(prev.slug, sourceDoc.slug, nextSlug) : prev.slug,
        status: "draft",
      }));
    }

    setIsBusy(true);
    const result = await callApi("PATCH", {
      originalSlug: sourceDoc.slug,
      slug: nextSlug,
      parentSlug: targetDoc?.slug,
      sortOrder: nextSortOrder,
    }, true);
    setIsBusy(false);

    if (!result.success) {
      setDocuments(previousDocuments);
      setSelectedSlug(previousSelectedSlug);
      setForm(previousForm);
      notify("error", result.error || "Không thể cập nhật vị trí tài liệu");
      return;
    }

    notify("success", "Đã cập nhật cấu trúc mục lục và slug theo vị trí mới");
  };

  const getNextSortOrderByParentSlug = (parentSlug: string | null) => {
    const parentDoc = parentSlug ? docsBySlug.get(parentSlug) || null : null;

    const siblingDocs = sortedDocuments.filter((doc) => {
      const docEffectiveParentId = effectiveParentIdByDocId.get(doc.id) ?? null;
      if (!parentDoc) return docEffectiveParentId == null;
      return docEffectiveParentId === parentDoc.id;
    });

    return siblingDocs.length > 0
      ? Math.max(...siblingDocs.map((doc) => doc.sortOrder)) + 1
      : 0;
  };

  const startCreatePage = (parentSlug: string | null) => {
    if (draftPreviewToken && !form.originalSlug) {
      notify("error", "Bạn đang tạo một page mới chưa lưu. Vui lòng lưu nháp trước khi tạo page khác.");
      return;
    }

    setPendingParentSlug(parentSlug);
    setDraftPreviewParentSlug(parentSlug);
    setDraftPreviewToken((current) => current + 1);
    setSelectedSlug("");
    setForm(EMPTY_FORM);
    if (parentSlug) {
      setExpandedNodes((prev) => ({ ...prev, [parentSlug]: true }));
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!isSuperAdmin || !user?.email) {
      setIsLoadingDocs(false);
      return;
    }

    loadDocuments();

  }, [isLoading, isSuperAdmin, user?.email]);

  useEffect(() => {
    if (isLoading) return;
    if (!isSuperAdmin || !user?.email) return;

    loadPublishHistory();

  }, [isLoading, isSuperAdmin, user?.email]);

  useEffect(() => {
    if (form.originalSlug) return;

    const generatedSlug = normalizeSlug(form.title);
    if (generatedSlug === form.slug) return;

    setForm((prev) => ({ ...prev, slug: generatedSlug }));
  }, [form.title, form.slug, form.originalSlug]);

  const saveDocument = async (nextStatus: "draft" | "keep", options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!user?.email) return;

    const title = form.title.trim();
    const generatedSlug = form.originalSlug || normalizeSlug(form.slug || title);

    if (!title || !generatedSlug) {
      if (!silent) {
        notify("error", "Vui lòng nhập tiêu đề bài viết");
      }
      return false;
    }

    const resolvedStatus = "draft";
    const resolvedContent =
      editorMode === "visual" ? visualContent : form.content;

    const effectiveParentSlug = form.originalSlug ? selectedParentSlug : pendingParentSlug;
    const leafSlug = getSlugLeaf(generatedSlug);
    const nextSlug = !form.originalSlug && effectiveParentSlug
      ? normalizeRelativePath(`${effectiveParentSlug}/${leafSlug}`)
      : generatedSlug;

    const payload = {
      originalSlug: form.originalSlug || undefined,
      slug: nextSlug,
      title,
      content: resolvedContent,
      topic: form.topic.trim(),
      excerpt: form.excerpt.trim(),
      coverImageUrl: form.coverImageUrl.trim(),
      type: "article",
      parentSlug: effectiveParentSlug || undefined,
      sortOrder: form.originalSlug
        ? selectedDocument?.sortOrder ?? 0
        : getNextSortOrderByParentSlug(effectiveParentSlug),
      status: resolvedStatus,
    };

    setIsBusy(true);
    const method = form.originalSlug ? "PATCH" : "POST";
    const result = await callApi(method, payload, true);
    setIsBusy(false);

    if (
      !result.success ||
      !result.data ||
      Array.isArray(result.data) ||
      "affectedCount" in result.data
    ) {
      if (!silent) {
        notify("error", result.error || "Không thể lưu tài liệu");
      }
      return false;
    }

    const saved = result.data as K12DocRow;
    setVisualContent(convertMarkdownToEditorHtml(saved.content || ""));
    setSelectedSlug(saved.slug);
    setDraftPreviewParentSlug(null);
    setDraftPreviewToken(0);
    setForm({
      originalSlug: saved.slug,
      title: saved.title,
      slug: saved.slug,
      content: saved.content,
      topic: saved.topic || "",
      excerpt: saved.excerpt || "",
      coverImageUrl: saved.coverImageUrl || "",
      status: saved.status,
    });

    if (form.originalSlug) {
      const previousSlug = form.originalSlug;
      setDocuments((prev) =>
        prev.map((doc) => {
          const nextSlugValue = replaceSlugPrefix(doc.slug, previousSlug, saved.slug);
          if (nextSlugValue !== doc.slug) {
            return {
              ...doc,
              slug: nextSlugValue,
              relativePath: replaceSlugPrefix(doc.relativePath, previousSlug, saved.slug),
              title: doc.slug === previousSlug ? saved.title : doc.title,
              content: doc.slug === previousSlug ? saved.content : doc.content,
              topic: doc.slug === previousSlug ? saved.topic || "" : doc.topic,
              excerpt: doc.slug === previousSlug ? saved.excerpt || "" : doc.excerpt,
              coverImageUrl: doc.slug === previousSlug ? saved.coverImageUrl || "" : doc.coverImageUrl,
              status: doc.slug === previousSlug ? saved.status : doc.status,
              sortOrder: doc.slug === previousSlug ? saved.sortOrder : doc.sortOrder,
              parentId: doc.slug === previousSlug ? saved.parentId ?? doc.parentId : doc.parentId,
            };
          }
          return doc;
        })
      );
    } else {
      const parentDoc = effectiveParentSlug ? docsBySlug.get(effectiveParentSlug) || null : null;
      const tempId = -Date.now();
      const tempRow = normalizeDocRow({
        id: tempId,
        slug: saved.slug,
        title: saved.title,
        relativePath: saved.relativePath || `${saved.slug}.md`,
        content: saved.content,
        topic: saved.topic || "",
        excerpt: saved.excerpt || "",
        coverImageUrl: saved.coverImageUrl || "",
        type: saved.type || "article",
        sectionId: saved.sectionId ?? null,
        parentId: saved.parentId ?? parentDoc?.id ?? null,
        status: saved.status,
        sortOrder: saved.sortOrder,
      });
      setDocuments((prev) => [...prev, tempRow]);
    }

    if (!silent) {
      notify("success", result.message || "Đã lưu nháp thành công");
    }

    return true;
  };

  const publishAllDocuments = async () => {
    if (!user?.email) return;

    const hasPendingFormData = Boolean(
      form.originalSlug ||
      form.title.trim() ||
      form.content.trim() ||
      form.topic.trim() ||
      form.excerpt.trim() ||
      form.coverImageUrl.trim()
    );

    if (hasPendingFormData) {
      const saveOk = await saveDocument("keep", { silent: true });
      if (!saveOk) {
        notify("error", "Không thể lưu page hiện tại trước khi phát hành");
        return;
      }
    }

    setIsBusy(true);
    const publishSetResult = await callApi("PATCH", { action: "publish_all" }, true);
    setIsBusy(false);

    if (!publishSetResult.success) {
      notify("error", publishSetResult.error || "Không thể phát hành toàn bộ tài liệu");
      return;
    }

    notify("success", publishSetResult.message || "Đã phát hành toàn bộ bộ tài liệu");
    await loadDocuments();
    await loadPublishHistory();
  };

  const openHistoryDialog = () => {
    if (!latestPublishSnapshot) {
      notify("error", "Chưa có lần phát hành nào để xem lịch sử");
      return;
    }

    setIsHistoryDialogOpen(true);
  };

  const restoreLatestPublishSnapshot = async () => {
    if (!user?.email || !latestPublishSnapshot) return;

    setIsHistoryDialogOpen(false);
    setIsBusy(true);

    const result = await callApi("PATCH", { action: "restore_last_publish" }, true);
    setIsBusy(false);

    if (!result.success) {
      notify("error", result.error || "Không thể khôi phục lịch sử phát hành");
      return;
    }

    notify("success", result.message || "Đã khôi phục bản phát hành gần nhất");
    await loadDocuments();
    await loadPublishHistory();
  };

  const historyDialogMessage = useMemo(() => {
    if (!latestPublishSnapshot) {
      return "Chưa có lịch sử phát hành nào. Hãy bấm Phát hành bộ tài liệu trước.";
    }

    const publishedAt = new Date(latestPublishSnapshot.createdAt);
    const publishedAtText = Number.isNaN(publishedAt.getTime())
      ? latestPublishSnapshot.createdAt
      : publishedAt.toLocaleString("vi-VN");

    return [
      `Lần phát hành gần nhất: ${publishedAtText}`,
      `Người phát hành: ${latestPublishSnapshot.createdByEmail || "system"}`,
      `Số tài liệu trong bản phát hành: ${latestPublishSnapshot.documentCount}`,
      "",
      "Khôi phục sẽ ghi đè dữ liệu hiện tại bằng đúng bản phát hành gần nhất. Các chỉnh sửa chưa phát hành sẽ bị mất.",
      "Nhập KHOI PHUC để xác nhận.",
    ].join("\n");
  }, [latestPublishSnapshot]);

  const topHeaderActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => saveDocument("draft")}
        disabled={isBusy}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        Lưu nháp
      </button>

      <button
        onClick={publishAllDocuments}
        disabled={isBusy}
        className="inline-flex items-center gap-2 rounded-md bg-[#a1001f] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#870018] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        Phát hành bộ tài liệu
      </button>

      <button
        onClick={openHistoryDialog}
        disabled={isBusy || !latestPublishSnapshot}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        title="Xem lịch sử phát hành gần nhất"
      >
        <History className="h-4 w-4" />
        Lịch sử
      </button>

      <Link href="/admin/page2" className="text-sm font-medium text-[#a1001f] hover:underline">
        Xem Trang K12
      </Link>
    </div>
  );

  const deleteDocument = async () => {
    if (!form.originalSlug || !user?.email) return;

    const descendants = sortedDocuments.filter((doc) => doc.slug.startsWith(`${form.originalSlug}/`));
    const cascade = descendants.length > 0;

    setIsDeleteDialogOpen(false);

    setIsBusy(true);
    const result = await callApi("DELETE", { slug: form.originalSlug, cascade }, true);
    setIsBusy(false);

    if (!result.success) {
      notify("error", result.error || "Xóa tài liệu thất bại");
      return;
    }

    notify("success", result.message || "Đã xóa tài liệu");
    setDocuments((prev) => prev.filter((doc) => doc.slug !== form.originalSlug && !doc.slug.startsWith(`${form.originalSlug}/`)));
    resetForm();
  };

  const openDeleteDialog = () => {
    if (!form.originalSlug || !user?.email) return;
    setIsDeleteDialogOpen(true);
  };

  const resolveDraggingSlug = (event?: React.DragEvent) => {
    if (draggingSlug) return draggingSlug;
    const fromTransfer = event?.dataTransfer?.getData("text/plain")?.trim();
    return fromTransfer || "";
  };

  const autoScrollSidebar = (clientY: number) => {
    const container = sidebarScrollRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const edgeThreshold = 72;
    const maxStep = 18;

    if (clientY < rect.top + edgeThreshold) {
      const distance = Math.max(0, clientY - rect.top);
      const ratio = (edgeThreshold - distance) / edgeThreshold;
      container.scrollTop -= Math.ceil(maxStep * ratio);
      return;
    }

    if (clientY > rect.bottom - edgeThreshold) {
      const distance = Math.max(0, rect.bottom - clientY);
      const ratio = (edgeThreshold - distance) / edgeThreshold;
      container.scrollTop += Math.ceil(maxStep * ratio);
    }
  };

  const handleDropToNode = async (targetSlug: string, event?: React.DragEvent) => {
    const sourceSlug = resolveDraggingSlug(event);
    if (!sourceSlug) return;

    setDropTargetSlug(null);
    setIsRootDropActive(false);
    await moveDocumentToParent(sourceSlug, targetSlug);
    setDraggingSlug("");
  };

  const handleDropToRoot = async (event?: React.DragEvent) => {
    const sourceSlug = resolveDraggingSlug(event);
    if (!sourceSlug) return;

    setDropTargetSlug(null);
    setIsRootDropActive(false);
    await moveDocumentToParent(sourceSlug, null);
    setDraggingSlug("");
  };

  const getEffectiveParentIdBySlug = (slug: string) => {
    const doc = docsBySlug.get(slug);
    if (!doc) return null;
    return effectiveParentIdByDocId.get(doc.id) ?? null;
  };

  const isCrossParentMoveTarget = (targetSlug: string) => {
    if (!draggingSlug || draggingSlug === targetSlug) return false;
    const sourceParentId = getEffectiveParentIdBySlug(draggingSlug);
    const targetParentId = getEffectiveParentIdBySlug(targetSlug);
    return sourceParentId !== targetParentId;
  };

  const previewLeafSlug = useMemo(() => {
    const normalized = normalizeSlug((form.slug || form.title || "new-page").trim());
    return getSlugLeaf(normalized || "new-page");
  }, [form.slug, form.title]);

  const previewFullSlug = useMemo(() => {
    if (!draftPreviewToken || form.originalSlug) return "";
    if (!draftPreviewParentSlug) return previewLeafSlug;
    return normalizeRelativePath(`${draftPreviewParentSlug}/${previewLeafSlug}`);
  }, [draftPreviewParentSlug, draftPreviewToken, form.originalSlug, previewLeafSlug]);

  const previewTitle = useMemo(() => {
    return form.title.trim() || "Page mới (chưa lưu)";
  }, [form.title]);

  const indentStep = 10;
  const getTreeIndent = (depth: number) => depth * indentStep;

  const renderDraftPreviewRow = (depth: number) => {
    if (!previewFullSlug || form.originalSlug) return null;

    return (
      <div
        className="group flex items-center gap-1.5 rounded-md border border-dashed border-[#a1001f]/40 bg-[#a1001f]/5 px-2 py-1.5"
        style={{ marginLeft: `${getTreeIndent(depth)}px` }}
      >
        <span className="w-4" />
        <FileText className="h-3.5 w-3.5 shrink-0 text-[#a1001f]/70" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium text-[#7f0018]">{previewTitle}</p>
          <p className="line-clamp-1 text-[11px] text-[#a1001f]/75">/{previewFullSlug}</p>
        </div>
        <span className="hidden rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#a1001f] sm:inline">
          preview
        </span>
      </div>
    );
  };

  const renderDocTree = (nodes: K12DocRow[], depth = 0): React.ReactNode => {
    return nodes.map((doc) => {
      const children = childrenByParentId.get(doc.id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedNodes[doc.slug] ?? true;
      const isActive = selectedDocument?.slug === doc.slug;
      const isDragging = draggingSlug === doc.slug;
      const isDropTarget = dropTargetSlug === doc.slug;
      const isDropTargetCrossParent = isDropTarget && isCrossParentMoveTarget(doc.slug);

      return (
        <div key={doc.slug} className="space-y-1">
          {isDropTarget && !isDropTargetCrossParent ? (
            <div
              className="h-0.5 rounded bg-[#a1001f]"
              style={{ marginLeft: `${getTreeIndent(depth) + 8}px` }}
            />
          ) : null}
          <div
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", doc.slug);
              setDraggingSlug(doc.slug);
            }}
            onDragEnd={() => {
              setDraggingSlug("");
              setDropTargetSlug(null);
              setIsRootDropActive(false);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingSlug && draggingSlug !== doc.slug) {
                setDropTargetSlug(doc.slug);
              }
            }}
            onDrop={async (event) => {
              event.preventDefault();
              await handleDropToNode(doc.slug);
            }}
            className={cn(
              "group flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors",
              isActive
                ? "border-[#a1001f]/35 bg-[#a1001f]/8"
                : "border-transparent bg-transparent hover:border-gray-200 hover:bg-gray-50",
              isDragging ? "opacity-40" : "opacity-100",
              isDropTargetCrossParent ? "border-[#a1001f]/45 bg-[#a1001f]/10 ring-1 ring-[#a1001f]/45" : "ring-0"
            )}
            style={{ marginLeft: `${getTreeIndent(depth)}px` }}
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />

            {hasChildren ? (
              <button
                type="button"
                onClick={(event) => {
                  setExpandedNodes((prev) => ({
                    ...prev,
                    [doc.slug]: !(prev[doc.slug] ?? true),
                  }));
                }}
                className="rounded p-0.5 text-gray-500 hover:bg-gray-200"
                aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            <button
              onClick={() => applyDocumentToForm(doc)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-medium text-gray-800">{doc.title || "Untitled"}</p>
                <p className="line-clamp-1 text-[11px] text-gray-500">/{doc.slug}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => startCreatePage(doc.slug)}
              className="opacity-0 rounded p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100"
              title="Thêm page con"
              aria-label="Thêm page con"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <span
              className={cn(
                "hidden rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase sm:inline",
                doc.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}
            >
              {doc.status === "published" ? "public" : "draft"}
            </span>
          </div>

          {hasChildren && isExpanded && (
            <div className="space-y-1">
              {renderDocTree(children, depth + 1)}
              {draftPreviewParentSlug === doc.slug ? renderDraftPreviewRow(depth + 1) : null}
            </div>
          )}
        </div>
      );
    });
  };

  const parentDocTitle = useMemo(() => {
    if (!pendingParentSlug) return "Root";
    return docsBySlug.get(pendingParentSlug)?.title || pendingParentSlug;
  }, [docsBySlug, pendingParentSlug]);

  const isCreatingUnsavedPage = draftPreviewToken > 0 && !form.originalSlug;

  useEffect(() => {
    const next: Record<string, boolean> = {};

    const walk = (nodes: SidebarTreeNode[]) => {
      nodes.forEach((node) => {
        if (node.type === "folder") {
          next[node.id] = true;
          if (node.children?.length) {
            walk(node.children);
          }
        }
      });
    };

    walk(sidebarTree);
    setExpandedFolders((prev) => ({ ...next, ...prev }));
  }, [sidebarTree]);

  const renderSidebarTree = (nodes: SidebarTreeNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      if (node.type === "folder") {
        const isExpanded = expandedFolders[node.id] ?? true;
        const folderPath = node.id.startsWith("folder:") ? node.id.slice("folder:".length) : "";
        const ownerDoc = folderPath ? pathOwnerDocByPath.get(folderPath) : null;
        const ownerIsActive = ownerDoc ? selectedDocument?.slug === ownerDoc.slug : false;
        const isOwnerDropTarget = ownerDoc ? dropTargetSlug === ownerDoc.slug : false;
        const isOwnerDropTargetCrossParent = ownerDoc ? isOwnerDropTarget && isCrossParentMoveTarget(ownerDoc.slug) : false;

        return (
          <div key={node.id} className="space-y-1">
            {isOwnerDropTarget && !isOwnerDropTargetCrossParent ? (
              <div
                className="h-0.5 rounded bg-[#a1001f]"
                style={{ marginLeft: `${getTreeIndent(depth) + 8}px` }}
              />
            ) : null}
            <div
              onDragOver={(event) => {
                if (!ownerDoc || !draggingSlug || draggingSlug === ownerDoc.slug) return;
                event.preventDefault();
                autoScrollSidebar(event.clientY);
                setIsRootDropActive(false);
                setDropTargetSlug(ownerDoc.slug);
              }}
              onDragLeave={() => {
                if (!ownerDoc) return;
                if (dropTargetSlug === ownerDoc.slug) {
                  setDropTargetSlug(null);
                }
              }}
              onDrop={async (event) => {
                if (!ownerDoc) return;
                event.preventDefault();
                await handleDropToNode(ownerDoc.slug, event);
              }}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5",
                ownerIsActive ? "bg-[#a1001f]/8" : "",
                isOwnerDropTargetCrossParent ? "border border-[#a1001f]/45 bg-[#a1001f]/10 ring-1 ring-[#a1001f]/45" : ""
              )}
              style={{ marginLeft: `${getTreeIndent(depth)}px` }}
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedFolders((prev) => ({
                    ...prev,
                    [node.id]: !(prev[node.id] ?? true),
                  }))
                }
                className="rounded p-0.5 text-gray-500 hover:bg-gray-200"
                aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>

              {ownerDoc ? (
                <button
                  type="button"
                  onClick={() => applyDocumentToForm(ownerDoc)}
                  className={cn(
                    "min-w-0 flex-1 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors",
                    ownerIsActive ? "text-[#a1001f]" : "text-gray-600 hover:text-gray-800"
                  )}
                >
                  <span className="line-clamp-1">{ownerDoc.title || node.title}</span>
                </button>
              ) : (
                <span className="min-w-0 flex-1 line-clamp-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                  {node.title}
                </span>
              )}

              {ownerDoc ? (
                <button
                  type="button"
                  onClick={() => startCreatePage(ownerDoc.slug)}
                  className="opacity-0 rounded p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100"
                  title="Thêm page con"
                  aria-label="Thêm page con"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {isExpanded && node.children?.length ? (
              <div className="space-y-1">{renderSidebarTree(node.children, depth + 1)}</div>
            ) : null}
          </div>
        );
      }

      const doc = node.slug ? docsBySlug.get(node.slug) : undefined;
      if (!doc || !node.slug) return null;

      const hasChildren = (childrenByParentId.get(doc.id) || []).length > 0;
      const isExpanded = expandedNodes[doc.slug] ?? true;
      const isActive = selectedDocument?.slug === doc.slug;
      const isDragging = draggingSlug === doc.slug;
      const isDropTarget = dropTargetSlug === doc.slug;
      const isRomanDoc = /^([ivxlcdm]+)[\.-]/i.test(doc.slug);
      const visualDepth = isRomanDoc && depth > 0 ? depth - 1 : depth;
      const isRootRomanDoc = isRomanDoc && visualDepth === 0;

      return (
        <div key={doc.slug} className="space-y-1">
          {isDropTarget ? (
            <div
              className="h-0.5 rounded bg-[#a1001f]"
              style={{ marginLeft: `${getTreeIndent(visualDepth) + 8}px` }}
            />
          ) : null}
          <div
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", doc.slug);
              setDraggingSlug(doc.slug);
            }}
            onDragEnd={() => {
              setDraggingSlug("");
              setDropTargetSlug(null);
              setIsRootDropActive(false);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              autoScrollSidebar(event.clientY);
              if (draggingSlug && draggingSlug !== doc.slug) {
                setDropTargetSlug(doc.slug);
              }
            }}
            onDrop={async (event) => {
              event.preventDefault();
              await handleDropToNode(doc.slug, event);
            }}
            className={cn(
              "group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors",
              isRootRomanDoc
                ? isActive
                  ? "bg-[#a1001f]/8"
                  : "hover:bg-gray-50"
                : isActive
                  ? "border border-[#a1001f]/35 bg-[#a1001f]/8"
                  : "border border-transparent bg-transparent hover:border-gray-200 hover:bg-gray-50",
              isDragging ? "opacity-40" : "opacity-100"
            )}
            style={{ marginLeft: `${getTreeIndent(visualDepth)}px` }}
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />

            {hasChildren ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setExpandedNodes((prev) => ({
                    ...prev,
                    [doc.slug]: !(prev[doc.slug] ?? true),
                  }));
                }}
                className="rounded p-0.5 text-gray-500 hover:bg-gray-200"
                aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {isRootRomanDoc ? (
              <button
                type="button"
                onClick={() => applyDocumentToForm(doc)}
                className={cn(
                  "min-w-0 flex-1 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors",
                  isActive ? "text-[#a1001f]" : "text-gray-600 hover:text-gray-800"
                )}
              >
                <span className="line-clamp-1">{doc.title || "Untitled"}</span>
              </button>
            ) : (
              <button
                onClick={() => applyDocumentToForm(doc)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-medium text-gray-800">{doc.title || "Untitled"}</p>
                  <p className="line-clamp-1 text-[11px] text-gray-500">/{doc.slug}</p>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => startCreatePage(doc.slug)}
              disabled={isBusy || isCreatingUnsavedPage}
              className="opacity-0 rounded p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100"
              title="Thêm page con"
              aria-label="Thêm page con"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            {!isRootRomanDoc ? (
              <span
                className={cn(
                  "hidden rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase sm:inline",
                  doc.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                )}
              >
                {doc.status === "published" ? "public" : "draft"}
              </span>
            ) : null}
          </div>

          {(hasChildren && isExpanded) || draftPreviewParentSlug === doc.slug ? (
            <div className="space-y-1">
              {draftPreviewParentSlug === doc.slug ? renderDraftPreviewRow(depth + 1) : null}
            </div>
          ) : null}
        </div>
      );
    });
  };

  const renderSidebarBody = () => {
    if (isLoadingDocs) {
      return <p className="text-sm text-gray-500">Đang tải danh sách page...</p>;
    }

    if (sidebarQuery.trim()) {
      if (searchedDocs.length === 0) {
        return <p className="text-sm text-gray-500">Không tìm thấy page phù hợp.</p>;
      }

      return (
        <div className="space-y-1">
          {searchedDocs.map((doc) => {
            const isActive = selectedDocument?.slug === doc.slug;
            return (
              <button
                key={doc.slug}
                onClick={() => applyDocumentToForm(doc)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left",
                  isActive ? "border-[#a1001f]/35 bg-[#a1001f]/8" : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                )}
              >
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-medium text-gray-800">{doc.title}</p>
                  <p className="line-clamp-1 text-[11px] text-gray-500">/{doc.slug}</p>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (sidebarTree.length === 0) {
      if (draftPreviewParentSlug == null && previewFullSlug && !form.originalSlug) {
        return <div className="space-y-1">{renderDraftPreviewRow(0)}</div>;
      }
      return <p className="text-sm text-gray-500">Chưa có page nào. Bấm dấu + để tạo page đầu tiên.</p>;
    }

    return (
      <div className="space-y-1">
        {draftPreviewParentSlug == null ? renderDraftPreviewRow(0) : null}
        {renderSidebarTree(sidebarTree)}
      </div>
    );
  };

  const selectedDescendants = useMemo(() => {
    if (!form.originalSlug) return [] as K12DocRow[];
    return sortedDocuments.filter((doc) => doc.slug.startsWith(`${form.originalSlug}/`));
  }, [form.originalSlug, sortedDocuments]);

  const deleteDialogMessage = useMemo(() => {
    const base = `Bạn có chắc muốn xóa tài liệu "${form.title || "(không có tiêu đề)"}"?`;
    if (selectedDescendants.length === 0) {
      return `${base} Hành động này không thể hoàn tác.`;
    }

    const firstTitles = selectedDescendants
      .slice(0, 5)
      .map((item) => `- ${item.title || item.slug}`)
      .join("\n");
    const moreText = selectedDescendants.length > 5
      ? `\n- ... và ${selectedDescendants.length - 5} mục con khác`
      : "";

    return `${base}\n\nMục này đang có ${selectedDescendants.length} mục con. Nếu tiếp tục, toàn bộ mục con bên trong cũng sẽ bị xóa vĩnh viễn:\n${firstTitles}${moreText}\n\nNhập từ khóa xác nhận để xóa toàn bộ.`;
  }, [form.title, selectedDescendants]);

  if (!isLoading && !isSuperAdmin) {
    return (
      <PageContainer title="Quản Lý Nội Dung K12 Teaching">
        <div className="flex min-h-80 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <div className="text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-gray-400" />
            <h2 className="mt-3 text-lg font-semibold text-gray-800">Không có quyền truy cập</h2>
            <p className="mt-1 text-sm text-gray-500">Chỉ Super Admin mới có thể quản lý tài liệu K12.</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Quản Lý Bài Viết Quy Trình, Quy Định K12 Teaching"
      headerActions={topHeaderActions}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          ref={sidebarScrollRef}
          onDragOver={(event) => {
            if (!resolveDraggingSlug(event)) return;
            event.preventDefault();
            autoScrollSidebar(event.clientY);
          }}
          className="rounded-xl border border-gray-200 bg-[#fcfcfc] p-3 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-150px)] lg:overflow-y-auto"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Trang</h3>
            <button
              onClick={() => startCreatePage(null)}
              disabled={isBusy || isCreatingUnsavedPage}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Thêm trang mới"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm mới
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              value={sidebarQuery}
              onChange={(event) => setSidebarQuery(event.target.value)}
              placeholder="Tìm trang..."
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-2 text-sm outline-none focus:border-[#a1001f]"
            />
          </div>

          {hierarchyIssues.length > 0 && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Phát hiện {hierarchyIssues.length} tài liệu có cấu trúc bất thường
                </div>
                <button
                  type="button"
                  onClick={repairHierarchy}
                  disabled={isBusy}
                  className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Sửa tự động
                </button>
              </div>
              <div className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1">
                {hierarchyIssues.slice(0, 8).map((issue) => (
                  <div key={issue.id} className="rounded border border-amber-200 bg-white/75 px-2 py-1">
                    <p className="line-clamp-1 font-medium text-amber-900">{issue.title || issue.slug}</p>
                    <p className="line-clamp-1 text-[11px] text-amber-700">{issue.reason}</p>
                    <p className="line-clamp-1 text-[11px] text-amber-700">Gợi ý parent: {issue.suggestedParentTitle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            onDragOver={(event) => {
              event.preventDefault();
              autoScrollSidebar(event.clientY);
              if (draggingSlug) {
                setIsRootDropActive(true);
                setDropTargetSlug(null);
              }
            }}
            onDragLeave={() => setIsRootDropActive(false)}
            onDrop={async (event) => {
              event.preventDefault();
              await handleDropToRoot(event);
            }}
            className={cn(
              "mb-3 rounded-md border border-dashed px-3 py-2 text-xs",
              isRootDropActive ? "border-[#a1001f] bg-[#a1001f]/5 text-[#a1001f]" : "border-gray-300 text-gray-500"
            )}
          >
            Kéo thả vào đây để đưa page ra cấp gốc
          </div>

          {renderSidebarBody()}
        </aside>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-1">
            <h3 className="inline-flex items-center gap-2 text-base font-semibold text-gray-800">
              <BookOpenText className="h-4 w-4 text-[#a1001f]" />
              {form.originalSlug ? "Chỉnh sửa trang" : "Tạo trang"}
            </h3>
            <p className="text-xs text-gray-500">Lưu/Phát hành đã chuyển lên thanh tiêu đề trang để thao tác theo bộ tài liệu.</p>
          </div>

          {!form.originalSlug && (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Trang mới sẽ được tạo trong: <span className="font-semibold">{parentDocTitle}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Tiêu đề trang</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-[#a1001f]"
                placeholder="Nhập tiêu đề trang"
              />
            </label>
          </div>

          {form.originalSlug && selectedDocument && (
            <p className="mt-2 text-xs text-gray-500">Vị trí hiện tại: {selectedDocument.relativePath}</p>
          )}

          <div className="mt-3 block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Nội dung trang</span>
            <div className="mb-2 inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => {
                  const markdown = convertEditorHtmlToMarkdown(visualContent);
                  setForm((prev) => ({ ...prev, content: markdown }));
                  setEditorMode("markdown");
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  editorMode === "markdown"
                    ? "bg-white text-[#a1001f] shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                )}
              >
                Markdown
              </button>
              <button
                type="button"
                onClick={() => {
                  setVisualContent(convertMarkdownToEditorHtml(form.content));
                  setEditorMode("visual");
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  editorMode === "visual"
                    ? "bg-white text-[#a1001f] shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                )}
              >
                Giao diện
              </button>
            </div>

            {editorMode === "markdown" ? (
              <textarea
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                className="min-h-105 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-[#a1001f]"
                placeholder="Nhập nội dung Markdown..."
              />
            ) : (
              <RichTextEditor
                content={visualContent}
                onChange={(html) => setVisualContent(html)}
                showToolbar={false}
                minHeight="min-h-[420px]"
              />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
            {form.originalSlug && (
              <button
                onClick={() => saveDocument("keep")}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-md border border-[#a1001f]/30 bg-[#a1001f]/5 px-3 py-2 text-sm font-medium text-[#a1001f] hover:bg-[#a1001f]/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Lưu nháp
              </button>
            )}

            {form.originalSlug && (
              <button
                onClick={openDeleteDialog}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </button>
            )}

            {!form.originalSlug && (
              <button
                onClick={() => saveDocument("draft")}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-md border border-[#a1001f]/30 bg-[#a1001f]/5 px-3 py-2 text-sm font-medium text-[#a1001f] hover:bg-[#a1001f]/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
               Lưu
              </button>
            )}

            {!form.originalSlug && (
              <button
                onClick={() => startCreatePage(null)}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FilePlus2 className="h-4 w-4" />
                Đặt lại form
              </button>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={deleteDocument}
        title={selectedDescendants.length > 0 ? "Xác nhận xóa tài liệu và mục con" : "Xác nhận xóa tài liệu"}
        message={deleteDialogMessage}
        confirmText={isBusy ? "Đang xóa..." : selectedDescendants.length > 0 ? "Xóa tất cả" : "Xóa tài liệu"}
        cancelText="Hủy"
        type="danger"
        icon="delete"
        requireTextConfirm={selectedDescendants.length > 0}
        confirmKeyword="XOA TAT CA"
      />

      <ConfirmDialog
        isOpen={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
        onConfirm={restoreLatestPublishSnapshot}
        title="Lịch sử phát hành gần nhất"
        message={historyDialogMessage}
        confirmText={isBusy ? "Đang khôi phục..." : "Khôi phục"}
        cancelText="Đóng"
        type="warning"
        icon="warning"
        requireTextConfirm={Boolean(latestPublishSnapshot)}
        confirmKeyword="KHOI PHUC"
      />
    </PageContainer>
  );
}
