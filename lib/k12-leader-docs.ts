import pool from "@/lib/db";
import { type PoolClient } from 'pg';
import * as path from "path";
import { unstable_cache } from "next/cache";

let k12LeaderSchemaEnsured = false;

export interface K12LeaderDocItem {
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

export interface K12LeaderDocNode {
	id: string;
	title: string;
	children?: K12LeaderDocNode[];
	slug?: string;
}

export interface K12LeaderDocsPayload {
	rootTitle: string;
	tree: K12LeaderDocNode[];
	documents: K12LeaderDocItem[];
	defaultSlug: string;
}

interface K12LeaderDocumentRow {
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

async function ensureK12LeaderSchema(client: PoolClient) {
	if (k12LeaderSchemaEnsured) return;

	await client.query(`
		CREATE TABLE IF NOT EXISTS k12_leader_documents (
			id SERIAL PRIMARY KEY,
			slug VARCHAR(400) NOT NULL UNIQUE,
			title VARCHAR(500) NOT NULL,
			relative_path VARCHAR(600) NOT NULL UNIQUE,
			content TEXT NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
			sort_order INTEGER NOT NULL DEFAULT 0,
			topic VARCHAR(255),
			excerpt TEXT,
			cover_image_url TEXT,
			type VARCHAR(20) NOT NULL DEFAULT 'article' CHECK (type IN ('section', 'article')),
			section_id INTEGER,
			parent_id INTEGER,
			content_format VARCHAR(20) NOT NULL DEFAULT 'html' CHECK (content_format IN ('html', 'json')),
			created_by_email VARCHAR(255),
			updated_by_email VARCHAR(255),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_status ON k12_leader_documents(status);
		CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_sort_order ON k12_leader_documents(sort_order);
		CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_type ON k12_leader_documents(type);
		CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_section_id ON k12_leader_documents(section_id);
		CREATE INDEX IF NOT EXISTS idx_k12_leader_documents_parent_id ON k12_leader_documents(parent_id);

		CREATE TABLE IF NOT EXISTS k12_leader_publish_snapshots (
			id SERIAL PRIMARY KEY,
			snapshot_data JSONB NOT NULL,
			document_count INTEGER NOT NULL DEFAULT 0,
			created_by_email VARCHAR(255),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_k12_leader_publish_snapshots_created_at 
			ON k12_leader_publish_snapshots(created_at DESC);
	`);

	k12LeaderSchemaEnsured = true;
}

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
};

function decodeHtmlEntities(input: string): string {
	if (!input) return '';
	let str = input;
	for (const [entity, char] of Object.entries(HTML_ENTITIES_MAP)) {
		str = str.replaceAll(entity, char);
	}
	str = str.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
		String.fromCodePoint(parseInt(hex, 16)),
	);
	str = str.replace(/&#([0-9]+);/g, (_, dec: string) =>
		String.fromCodePoint(parseInt(dec, 10)),
	);
	return str;
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

function extractHeadings(content: string) {
	const result: Array<{ id: string; text: string; level: number }> = [];
	const headingRegex = /^(#{1,6})\s+(.+)$/gm;
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

	const htmlHeadingRegex = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
	while ((match = htmlHeadingRegex.exec(content)) !== null) {
		const level = Number(match[1]);
		const attrs = match[2] || "";
		const idMatch = /\bid=["']([^"']+)["']/i.exec(attrs);
		const text = cleanHeadingText(match[3] || "");
		if (!text) continue;

		result.push({
			id: idMatch ? idMatch[1] : slugify(text),
			text,
			level,
		});
	}

	const idCounts = new Map<string, number>();
	return result.map((item) => {
		const baseId = item.id || "section";
		const count = idCounts.get(baseId) || 0;
		idCounts.set(baseId, count + 1);
		const uniqueId = count === 0 ? baseId : `${baseId}-${count}`;
		return {
			...item,
			id: uniqueId,
		};
	});
}

function buildTreeFromRelativePaths(documents: K12LeaderDocItem[]): K12LeaderDocNode[] {
	const root: K12LeaderDocNode[] = [];
	const folderMap = new Map<string, K12LeaderDocNode>();
	const docBySlug = new Map<string, K12LeaderDocItem>();
	const docByPathWithoutExt = new Map<string, K12LeaderDocItem>();
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

	const getNodeKey = (node: K12LeaderDocNode) => {
		if (node.slug) return `doc:${node.slug}`;
		return `folder:${node.id}`;
	};

	const getSegmentOrder = (node: K12LeaderDocNode): number | null => {
		const base = node.slug || node.id;
		const segment = base.split("/").pop() || base;
		return getOrderFromSegment(segment);
	};

	const sortNodes = (nodes: K12LeaderDocNode[]) => {
		nodes.sort((a, b) => {
			const sortA = a.slug ? docBySlug.get(a.slug)?.sortOrder : undefined;
			const sortB = b.slug ? docBySlug.get(b.slug)?.sortOrder : undefined;
			if (sortA != null && sortB != null && sortA !== sortB) {
				return sortA - sortB;
			}
			const orderA = getSegmentOrder(a);
			const orderB = getSegmentOrder(b);

			if (orderA != null && orderB != null && orderA !== orderB) {
				return orderA - orderB;
			}
			if (orderA != null && orderB == null) return -1;
			if (orderA == null && orderB != null) return 1;

			return a.title.localeCompare(b.title, "vi");
		});
	};

	const ensureFolder = (folderPath: string) => {
		const existing = folderMap.get(folderPath);
		if (existing) return existing;

		const segment = folderPath.split("/").pop() || folderPath;
		const node: K12LeaderDocNode = {
			id: folderPath,
			title: prettifyName(segment),
			children: [],
		};

		folderMap.set(folderPath, node);

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
		docByPathWithoutExt.set(normalizedPath.replace(/\.md$/i, "").replace(/\/index$/i, ""), doc);
	}

	for (const doc of documents) {
		const normalizedPath = normalizedPathBySlug.get(doc.slug) || normalizePath(doc.relativePath);
		const pathWithoutExt = normalizedPath.replace(/\.md$/i, "").replace(/\/index$/i, "");
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
		const pathWithoutExt = normalizedPath.replace(/\.md$/i, "").replace(/\/index$/i, "");
		const segments = pathWithoutExt.split("/").filter(Boolean);
		const parentPath = segments.length > 1 ? segments.slice(0, -1).join("/") : "";

		const node: K12LeaderDocNode = {
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

	const reorderNodes = (nodes: K12LeaderDocNode[]) => {
		sortNodes(nodes);
		nodes.forEach((node) => {
			if (node.children && node.children.length > 0) {
				reorderNodes(node.children);
			}
		});
	};

	const uniqueRoot: K12LeaderDocNode[] = [];
	const rootSeen = new Set<string>();
	for (const node of root) {
		const key = getNodeKey(node);
		if (rootSeen.has(key)) continue;
		rootSeen.add(key);
		uniqueRoot.push(node);
	}

	reorderNodes(uniqueRoot);
	return uniqueRoot;
}

async function loadK12LeaderDocsFromDatabase(includeDraft = false): Promise<K12LeaderDocsPayload | null> {
	const client = await pool.connect();
	try {
		await ensureK12LeaderSchema(client);

		const tableCheck = await client.query(
			"SELECT to_regclass('public.k12_leader_documents') AS table_name"
		);

		if (!tableCheck.rows[0]?.table_name) {
			return null;
		}

		const countResult = await client.query(
			"SELECT COUNT(*)::int AS count FROM k12_leader_documents"
		);

		if (countResult.rows[0]?.count === 0) {
			return null;
		}

		const result = await client.query(
			`SELECT id, slug, title, relative_path, content, type, section_id, parent_id, topic, excerpt, cover_image_url, status, sort_order
			 FROM k12_leader_documents
			 ${includeDraft ? "" : "WHERE status = 'published'"}
			 ORDER BY sort_order ASC, title ASC`
		);

		const documents: K12LeaderDocItem[] = (result.rows as K12LeaderDocumentRow[]).map((row) => {
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

		if (documents.length === 0) {
			return null;
		}

		const tree = buildTreeFromRelativePaths(documents);
		const defaultDoc =
			documents.find((doc) => doc.slug.includes("thong-tin-chung") || doc.slug === "i-thong-tin-chung") ||
			documents.find((doc) => doc.slug.endsWith("/index")) ||
			documents.find((doc) => doc.slug === "index") ||
			documents[0];

		return {
			rootTitle: "Quy Trình, Quy Định K12 Teaching - Leader/TE/TC",
			tree,
			documents,
			defaultSlug: defaultDoc?.slug || "",
		};
	} finally {
		client.release();
	}
}

export function clearK12LeaderDocsCache() {
	k12LeaderDocsMemCache.clear();
}

/** In-memory cache */
const k12LeaderDocsMemCache = new Map<
	string,
	{ payload: K12LeaderDocsPayload; expiresAt: number }
>();
const MEM_CACHE_TTL_MS = process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 1000;

/** Next.js cached */
const loadK12LeaderDocsCached = unstable_cache(
	async (includeDraft: boolean): Promise<K12LeaderDocsPayload> => {
		const dbDocs = await loadK12LeaderDocsFromDatabase(includeDraft);
		if (dbDocs) return dbDocs;

		return {
			rootTitle: 'Quy Trình, Quy Định K12 Teaching - Leader/TE/TC',
			tree: [],
			documents: [],
			defaultSlug: '',
		};
	},
	['k12-leader-docs-published'],
	{ revalidate: process.env.NODE_ENV === 'production' ? 300 : 1 },
);

const loadK12LeaderDocsDraftCached = unstable_cache(
	async (): Promise<K12LeaderDocsPayload> => {
		const dbDocs = await loadK12LeaderDocsFromDatabase(true);
		if (dbDocs) return dbDocs;

		return {
			rootTitle: 'Quy Trình, Quy Định K12 Teaching - Leader/TE/TC',
			tree: [],
			documents: [],
			defaultSlug: '',
		};
	},
	['k12-leader-docs-draft'],
	{ revalidate: process.env.NODE_ENV === 'production' ? 60 : 1 },
);

export async function loadK12LeaderDocs(options?: { includeDraft?: boolean }): Promise<K12LeaderDocsPayload> {
	const includeDraft = options?.includeDraft ?? false;
	const dbDocs = await loadK12LeaderDocsFromDatabase(includeDraft);
	if (dbDocs) return dbDocs;

	return {
		rootTitle: 'Quy Trình, Quy Định K12 Teaching - Leader/TE/TC',
		tree: [],
		documents: [],
		defaultSlug: '',
	};
}
