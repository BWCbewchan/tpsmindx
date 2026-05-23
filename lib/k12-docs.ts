import pool from "@/lib/db";
import { type PoolClient } from 'pg';
import path from "path";
import { unstable_cache } from "next/cache";



let k12SchemaEnsured = false;

export interface K12DocItem {
	id: number;
	slug: string;
	title: string;
	relativePath: string;
	content: string;
	sortOrder?: number;
	type?: "section" | "article";
	sectionId?: number | null;
	parentId?: number | null;
	topic?: string;
	excerpt?: string;
	coverImageUrl?: string;
	headings: Array<{ id: string; text: string; level: number }>;
}

export interface K12DocNode {
	id: string;
	title: string;
	children?: K12DocNode[];
	slug?: string;
}

export interface K12DocsPayload {
	rootTitle: string;
	tree: K12DocNode[];
	documents: K12DocItem[];
	defaultSlug: string;
}

interface K12DocumentRow {
	id: number;
	slug: string;
	title: string;
	relative_path: string;
	content: string;
	type: "section" | "article";
	section_id: number | null;
	parent_id: number | null;
	topic?: string | null;
	excerpt?: string | null;
	cover_image_url?: string | null;
	status: "draft" | "published";
	sort_order: number;
}

function normalizeRelativePath(input: string) {
	return input.replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

async function ensureK12Schema(client: PoolClient) {
	if (k12SchemaEnsured) return;

	await client.query(`
		ALTER TABLE IF EXISTS k12_documents
		ADD COLUMN IF NOT EXISTS topic VARCHAR(255),
		ADD COLUMN IF NOT EXISTS excerpt TEXT,
		ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
		ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'article',
		ADD COLUMN IF NOT EXISTS section_id INTEGER,
		ADD COLUMN IF NOT EXISTS parent_id INTEGER,
		ADD COLUMN IF NOT EXISTS content_format VARCHAR(20) NOT NULL DEFAULT 'html'
	`);

	k12SchemaEnsured = true;
}

// DOCS_ROOT không còn được sử dụng vì đã chuyển sang database
// const DOCS_ROOT = path.join(
// 	process.cwd(),
// 	"app",
// 	"api",
// 	"gitbook_markdown",
// 	"markdown_files",
// 	"quy-trinh-quy-dinh-danh-cho-giao-vien"
// );

function slugify(input: string) {
	return input
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

function addVietnameseAccents(input: string) {
	return input
		.replace(/\bQuy Trinh\b/gi, "Quy Trình")
		.replace(/\bQuy Dinh\b/gi, "Quy Định")
		.replace(/\bGiao Vien\b/gi, "Giáo Viên")
		.replace(/\bDao Tao\b/gi, "Đào Tạo")
		.replace(/\bDanh Gia\b/gi, "Đánh Giá")
		.replace(/\bKiem Tra\b/gi, "Kiểm Tra")
		.replace(/\bHuong Dan\b/gi, "Hướng Dẫn")
		.replace(/\bThong Tin\b/gi, "Thông Tin")
		.replace(/\bNghiep Vu\b/gi, "Nghiệp Vụ");
}

function prettifyName(filename: string) {
	const noExt = filename.replace(/\.md$/i, "");
	const cleaned = noExt
		.replace(/^[ivxlcdm]+\.-?/i, "")
		.replace(/^[0-9]+\.-?/i, "")
		.replace(/[._-]+/g, " ")
		.trim();

	const title = cleaned
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

	return addVietnameseAccents(title);
}

function decodeHtmlEntities(input: string) {
	return input
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

function cleanHeadingText(raw: string) {
	const withoutTags = raw.replace(/<[^>]+>/g, " ");
	const withoutLinks = withoutTags.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
	const withoutMarks = withoutLinks
		.replace(/[*_`~]/g, "")
		.replace(/\\/g, "")
		.trim();

	return decodeHtmlEntities(withoutMarks)
		.replace(/\s+/g, " ")
		.trim();
}

function extractTitle(content: string, fallback: string) {
	const firstHeading = content.match(/^#\s+(.+)$/m);
	const cleaned = cleanHeadingText(firstHeading?.[1] || fallback);
	return cleaned || fallback;
}

function extractHeadings(content: string) {
	const result: Array<{ id: string; text: string; level: number }> = [];
	const headingRegex = /^(#{1,3})\s+(.+)$/gm;
	let match: RegExpExecArray | null;

	while ((match = headingRegex.exec(content)) !== null) {
		const hashes = match[1];
		const rawText = match[2].trim();
		const text = cleanHeadingText(rawText);

		if (!text) continue;

		result.push({
			id: slugify(text),
			text,
			level: hashes.length,
		});
	}

	if (result.length > 0) {
		return result;
	}

	const htmlHeadingRegex = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
	while ((match = htmlHeadingRegex.exec(content)) !== null) {
		const level = Number(match[1]);
		const text = cleanHeadingText(match[2] || "");
		if (!text) continue;

		result.push({
			id: slugify(text),
			text,
			level,
		});
	}

	return result;
}

// walkDirectory không còn được sử dụng vì đã chuyển sang database
// async function walkDirectory(
// 	absoluteDir: string,
// 	relativeDir: string,
// 	docs: K12DocItem[]
// ): Promise<K12DocNode[]> {
// 	const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
// 	const sorted = entries.sort((a, b) => a.name.localeCompare(b.name, "vi"));
// 	const nodes: K12DocNode[] = [];
//
// 	for (const entry of sorted) {
// 		const absolutePath = path.join(absoluteDir, entry.name);
// 		const relativePath = path.join(relativeDir, entry.name);
//
// 		if (entry.isDirectory()) {
// 			const children = await walkDirectory(absolutePath, relativePath, docs);
// 			if (children.length > 0) {
// 				nodes.push({
// 					id: relativePath.replace(/\\/g, "/"),
// 					title: prettifyName(entry.name),
// 					children,
// 				});
// 			}
// 			continue;
// 		}
//
// 		if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
// 			continue;
// 		}
//
// 		const content = await fs.readFile(absolutePath, "utf8");
// 		const normalizedRelative = relativePath.replace(/\\/g, "/");
// 		const slug = normalizedRelative.replace(/\.md$/i, "");
// 		const fallbackTitle = prettifyName(entry.name) || entry.name;
// 		const title = extractTitle(content, fallbackTitle);
//
// 		docs.push({
// 			id: docs.length + 1,
// 			slug,
// 			title,
// 			relativePath: normalizedRelative,
// 			content,
// 			sortOrder: docs.length,
// 			headings: extractHeadings(content),
// 		});
//
// 		nodes.push({
// 			id: normalizedRelative,
// 			title,
// 			slug,
// 		});
// 	}
//
// 	return nodes;
// }

function buildTreeFromRelativePaths(documents: K12DocItem[]): K12DocNode[] {
	const root: K12DocNode[] = [];
	const folderMap = new Map<string, K12DocNode>();
	const folderChildren = new Map<string, K12DocNode[]>();
	const docBySlug = new Map<string, K12DocItem>();
	const docByPathWithoutExt = new Map<string, K12DocItem>();
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

	const getNodeKey = (node: K12DocNode) => {
		if (node.slug) return `doc:${node.slug}`;
		return `folder:${node.id}`;
	};

	const getSegmentOrder = (node: K12DocNode): number | null => {
		const base = node.slug || node.id;
		const segment = base.split("/").pop() || base;
		return getOrderFromSegment(segment);
	};

	const sortNodes = (nodes: K12DocNode[]) => {
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

	const ensureFolder = (folderPath: string) => {
		const existing = folderMap.get(folderPath);
		if (existing) return existing;

		const segment = folderPath.split("/").pop() || folderPath;
		const node: K12DocNode = {
			id: folderPath,
			title: prettifyName(segment),
			children: [],
		};

		folderMap.set(folderPath, node);
		folderChildren.set(folderPath, node.children || []);

		const parentPath = folderPath.includes("/") ? folderPath.slice(0, folderPath.lastIndexOf("/")) : "";
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
		const normalizedPath = normalizePath(doc.relativePath);
		normalizedPathBySlug.set(doc.slug, normalizedPath);
		docByPathWithoutExt.set(normalizedPath.replace(/\.md$/i, ""), doc);
	}

	for (const doc of documents) {
		const normalizedPath = normalizedPathBySlug.get(doc.slug) || normalizePath(doc.relativePath);
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

		folderNode.slug = landingDoc.slug;
		folderNode.title = landingDoc.title || folderNode.title;
		consumedAsFolderLanding.add(landingDoc.slug);
	}

	for (const doc of documents) {
		if (consumedAsFolderLanding.has(doc.slug)) continue;

		const normalizedPath = normalizedPathBySlug.get(doc.slug) || normalizePath(doc.relativePath);
		const pathWithoutExt = normalizedPath.replace(/\.md$/i, "");
		const segments = pathWithoutExt.split("/").filter(Boolean);
		const parentPath = segments.length > 1 ? segments.slice(0, -1).join("/") : "";

		const node: K12DocNode = {
			id: normalizedPath,
			title: doc.title || prettifyName(segments[segments.length - 1] || doc.slug),
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

	const reorderWithDocLinks = (nodes: K12DocNode[]) => {
		sortNodes(nodes);

		nodes.forEach((node) => {
			if (!node.children || node.children.length === 0) return;

			reorderWithDocLinks(node.children);

			if (!node.slug) return;
			const sourceDoc = docBySlug.get(node.slug);
			if (!sourceDoc) return;

			const links = extractInternalLinkOrder(sourceDoc.content);
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

	const uniqueRoot: K12DocNode[] = [];
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

// seedK12DocsFromFilesystem không còn được sử dụng vì đã chuyển sang database
// async function seedK12DocsFromFilesystem() {
// 	const docs: K12DocItem[] = [];
// 	await walkDirectory(DOCS_ROOT, "", docs);
//
// 	if (docs.length === 0) {
// 		return;
// 	}
//
// 	const client = await pool.connect();
// 	try {
// 		await client.query("BEGIN");
//
// 		for (let i = 0; i < docs.length; i++) {
// 			const doc = docs[i];
// 			await client.query(
// 				`INSERT INTO k12_documents (slug, title, relative_path, content, status, sort_order, created_by_email, updated_by_email)
// 				 VALUES ($1, $2, $3, $4, 'published', $5, 'system', 'system')
// 				 ON CONFLICT (slug) DO NOTHING`,
// 				[doc.slug, doc.title, doc.relativePath, doc.content, i]
// 			);
// 		}
//
// 		await client.query("COMMIT");
// 	} catch (error) {
// 		await client.query("ROLLBACK");
// 		throw error;
// 	} finally {
// 		client.release();
// 	}
// }

async function loadK12DocsFromDatabase(includeDraft = false): Promise<K12DocsPayload | null> {
	const client = await pool.connect();
	try {
		// Dùng client đang giữ — tránh lấy connection thứ 2 từ pool (gây timeout khi pool nhỏ)
		await ensureK12Schema(client);

		const tableCheck = await client.query(
			"SELECT to_regclass('public.k12_documents') AS table_name"
		);

		if (!tableCheck.rows[0]?.table_name) {
			return null;
		}

		const countResult = await client.query(
			"SELECT COUNT(*)::int AS count FROM k12_documents"
		);

		if (countResult.rows[0]?.count === 0) {
			// Không có dữ liệu trong database
			return null;
		}

		const result = await client.query<K12DocumentRow>(
			`SELECT id, slug, title, relative_path, content, type, section_id, parent_id, topic, excerpt, cover_image_url, status, sort_order
			 FROM k12_documents
			 ${includeDraft ? "" : "WHERE status = 'published'"}
			 ORDER BY sort_order ASC, title ASC`
		);

		// Chỉ sử dụng dữ liệu từ database, không đọc filesystem
		const documents: K12DocItem[] = result.rows.map((row) => {
			const normalizedPath = normalizeRelativePath(row.relative_path);
			const mergedContent = row.content || "";

			return {
				id: row.id,
				slug: row.slug,
				title: row.title || prettifyName(path.basename(normalizedPath)),
				relativePath: normalizedPath,
				content: mergedContent,
				sortOrder: row.sort_order,
				type: row.type,
				sectionId: row.section_id ?? null,
				parentId: row.parent_id ?? null,
				topic: row.topic ?? undefined,
				excerpt: row.excerpt ?? undefined,
				coverImageUrl: row.cover_image_url ?? undefined,
				headings: extractHeadings(mergedContent),
			};
		});

		// Database là nguồn dữ liệu duy nhất cho cấu trúc menu
		if (documents.length === 0) {
			return null;
		}

		const tree = buildTreeFromRelativePaths(documents);
		const defaultDoc =
			documents.find((doc) => doc.slug.endsWith("/index")) ||
			documents.find((doc) => doc.slug === "index") ||
			documents[0];

		return {
			rootTitle: "Quy Trình, Quy Định K12 Teaching",
			tree,
			documents,
			defaultSlug: defaultDoc?.slug || "",
		};
	} finally {
		client.release();
	}
}

/** In-memory cache — tránh gọi DB/filesystem lặp lại trong cùng 1 process/worker */
const k12DocsMemCache = new Map<
	string,
	{ payload: K12DocsPayload; expiresAt: number }
>();
const MEM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

/** Phiên bản được cache bởi Next.js (persist qua requests, revalidate 5 phút) */
const loadK12DocsCached = unstable_cache(
	async (includeDraft: boolean): Promise<K12DocsPayload> => {
		const dbDocs = await loadK12DocsFromDatabase(includeDraft);
		if (dbDocs) return dbDocs;

		// Nếu không có dữ liệu trong database, trả về payload rỗng
		return {
			rootTitle: 'Quy Trình, Quy Định K12 Teaching',
			tree: [],
			documents: [],
			defaultSlug: '',
		};
	},
	['k12-docs-published'],
	{ revalidate: 300 }, // 5 phút cho published
);

/** Cache riêng cho draft (admin) — revalidate 60s */
const loadK12DocsDraftCached = unstable_cache(
	async (): Promise<K12DocsPayload> => {
		const dbDocs = await loadK12DocsFromDatabase(true);
		if (dbDocs) return dbDocs;

		// Nếu không có dữ liệu trong database, trả về payload rỗng
		return {
			rootTitle: 'Quy Trình, Quy Định K12 Teaching',
			tree: [],
			documents: [],
			defaultSlug: '',
		};
	},
	['k12-docs-draft'],
	{ revalidate: 60 }, // 60 giây cho draft (admin page)
);

export async function loadK12Docs(options?: { includeDraft?: boolean }): Promise<K12DocsPayload> {
	const includeDraft = options?.includeDraft ?? false;
	const cacheKey = includeDraft ? 'draft' : 'published';

	// Lớp 1: in-memory (instant — cùng worker/process)
	const mem = k12DocsMemCache.get(cacheKey);
	if (mem && Date.now() < mem.expiresAt) {
		return mem.payload;
	}

	// Lớp 2: Next.js unstable_cache (persist qua requests, tự revalidate)
	let payload: K12DocsPayload;
	if (includeDraft) {
		payload = await loadK12DocsDraftCached();
	} else {
		payload = await loadK12DocsCached(false);
	}

	// Lưu vào in-memory cache
	k12DocsMemCache.set(cacheKey, { payload, expiresAt: Date.now() + MEM_CACHE_TTL_MS });
	return payload;
}
