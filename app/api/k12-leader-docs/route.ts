import * as path from "path";
import { requireBearerSession } from "@/lib/datasource-api-auth";
import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { clearK12LeaderDocsCache } from "@/lib/k12-leader-docs";
import { effectiveLeaderParent, planLeaderMove, planLeaderReorder, type LeaderTreeRow } from '@/lib/k12-leader-tree';

let k12LeaderSchemaEnsured = false;

interface K12LeaderDocPayload {
  action?: "publish_all" | "repair_hierarchy" | "reorder_siblings" | "history" | "restore_last_publish";
  type?: "section" | "article";
  slug?: string;
  title?: string;
  relativePath?: string;
  content?: string;
  topic?: string;
  excerpt?: string;
  coverImageUrl?: string;
  sectionSlug?: string;
  parentSlug?: string | null;
  status?: "draft" | "published";
  sortOrder?: number;
  originalSlug?: string;
  orderedSlugs?: string[];
}

async function ensureK12LeaderSchema() {
  if (k12LeaderSchemaEnsured) return;

  await pool.query(`
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

function normalizeSnapshotDocuments(snapshotData: any) {
  const rows = Array.isArray(snapshotData) ? snapshotData : [];
  return rows.map((row) => ({
    id: Number(row.id),
    slug: String(row.slug || ""),
    title: String(row.title || ""),
    relative_path: String(row.relative_path || ""),
    content: String(row.content || ""),
    topic: row.topic ?? null,
    excerpt: row.excerpt ?? null,
    cover_image_url: row.cover_image_url ?? null,
    type: row.type === "section" ? "section" : "article",
    section_id: row.section_id ?? null,
    parent_id: row.parent_id ?? null,
    status: row.status === "published" ? "published" : "draft",
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    content_format: row.content_format === "json" ? "json" : "html",
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }));
}

function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function normalizeSlugPath(input: string) {
  return (input || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => normalizeSlug(segment))
    .filter(Boolean)
    .join("/");
}

function getSlugLeaf(slugPath: string) {
  const parts = normalizeSlugPath(slugPath).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

async function getDocBySlug(slug: string) {
  await ensureK12LeaderSchema();

  const result = await pool.query(
    "SELECT id, slug, relative_path, type, section_id, parent_id FROM k12_leader_documents WHERE slug = $1 LIMIT 1",
    [slug]
  );

  return result.rows[0] || null;
}

function getDirname(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const dir = path.posix.dirname(normalized);
  return dir === "." ? "" : dir;
}

function buildRelativePathByHierarchy(
  type: "section" | "article",
  slug: string,
  sectionDoc?: { relative_path: string } | null,
  parentDoc?: { relative_path: string } | null
) {
  if (slug.includes("/")) {
    if (type === "section") {
      return `${slug}/index.md`;
    }
    return `${slug}.md`;
  }

  if (type === "section") {
    if (parentDoc?.relative_path) {
      return `${getDirname(parentDoc.relative_path)}/${slug}/index.md`;
    }
    return `${slug}/index.md`;
  }

  if (parentDoc?.relative_path) {
    return `${getDirname(parentDoc.relative_path)}/${slug}.md`;
  }

  if (sectionDoc?.relative_path) {
    return `${getDirname(sectionDoc.relative_path)}/${slug}.md`;
  }

  return `${slug}.md`;
}

type AdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; email: string; response: NextResponse };

async function ensureAdminOrSuperAdmin(request: NextRequest): Promise<AdminAuthResult> {
  const auth = await requireBearerSession(request);
  if (!auth.ok) {
    return {
      ok: false,
      email: "",
      response: (auth as { ok: false; response: NextResponse }).response,
    };
  }
  const email = auth.sessionEmail;

  const result = await pool.query(
    "SELECT role FROM app_users WHERE LOWER(email) = $1 AND is_active = true LIMIT 1",
    [email]
  );

  const role = result.rows[0]?.role;
  if (!role || !["super_admin", "admin", "manager"].includes(role)) {
    return {
      ok: false,
      email,
      response: NextResponse.json(
        { success: false, error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, email };
}

export async function GET(request: NextRequest) {
  try {
    await ensureK12LeaderSchema();

    const action = request.nextUrl.searchParams.get("action");

    if (action === "history") {
      const auth = await ensureAdminOrSuperAdmin(request);
      if (auth.ok === false) return auth.response;

      const latest = await pool.query(
        `SELECT id, document_count, created_by_email, created_at
         FROM k12_leader_publish_snapshots
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      );

      const latestRow = latest.rows[0] || null;
      return NextResponse.json({
        success: true,
        data: latestRow
          ? {
              id: latestRow.id,
              documentCount: latestRow.document_count,
              createdByEmail: latestRow.created_by_email || "",
              createdAt: latestRow.created_at,
            }
          : null,
      });
    }

    const includeDraft = request.nextUrl.searchParams.get("includeDraft") === "1";
    const slug = request.nextUrl.searchParams.get("slug");

    if (slug) {
      const result = await pool.query(
        `SELECT id, slug, title, relative_path, content, type, section_id, parent_id, topic, excerpt, cover_image_url, status, sort_order, updated_at
         FROM k12_leader_documents
         WHERE slug = $1 ${includeDraft ? "" : "AND status = 'published'"}
         LIMIT 1`,
        [slug]
      );

      if (!result.rows[0]) {
        return NextResponse.json({ success: false, error: "Không tìm thấy tài liệu" }, { status: 404 });
      }

      const row = result.rows[0];
      return NextResponse.json({
        success: true,
        data: {
          id: row.id,
          slug: row.slug,
          title: row.title,
          relativePath: row.relative_path,
          content: row.content,
          type: row.type,
          sectionId: row.section_id,
          parentId: row.parent_id,
          topic: row.topic,
          excerpt: row.excerpt,
          coverImageUrl: row.cover_image_url,
          status: row.status,
          sortOrder: row.sort_order,
          updatedAt: row.updated_at,
        },
      });
    }

    const result = await pool.query(
      `SELECT id, slug, title, relative_path, content, type, section_id, parent_id, topic, excerpt, cover_image_url, status, sort_order, updated_at
       FROM k12_leader_documents
       ${includeDraft ? "" : "WHERE status = 'published'"}
       ORDER BY sort_order ASC, title ASC`
    );

    const rows = result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      relativePath: row.relative_path,
      content: row.content,
      type: row.type,
      sectionId: row.section_id,
      parentId: row.parent_id,
      topic: row.topic,
      excerpt: row.excerpt,
      coverImageUrl: row.cover_image_url,
      status: row.status,
      sortOrder: row.sort_order,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Lỗi server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureK12LeaderSchema();

    const auth = await ensureAdminOrSuperAdmin(request);
    if (auth.ok === false) return auth.response;

    const payload = (await request.json()) as K12LeaderDocPayload;

    if (payload.action === "publish_all") {
      const allDrafts = await pool.query(
        `SELECT id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, content_format, created_at, updated_at
         FROM k12_leader_documents
         ORDER BY sort_order ASC, title ASC`
      );

      const snapshotRows = allDrafts.rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        relative_path: row.relative_path,
        content: row.content,
        topic: row.topic || null,
        excerpt: row.excerpt || null,
        cover_image_url: row.cover_image_url || null,
        type: row.type || "article",
        section_id: row.section_id,
        parent_id: row.parent_id,
        status: "published",
        sort_order: row.sort_order || 0,
        content_format: row.content_format || "html",
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      await pool.query(
        `INSERT INTO k12_leader_publish_snapshots (snapshot_data, document_count, created_by_email)
         VALUES ($1, $2, $3)`,
        [JSON.stringify(snapshotRows), snapshotRows.length, auth.email]
      );

      const updateResult = await pool.query(
        "UPDATE k12_leader_documents SET status = 'published', updated_by_email = $1 WHERE status <> 'published'",
        [auth.email]
      );

      clearK12LeaderDocsCache();

      return NextResponse.json({
        success: true,
        data: { affectedCount: updateResult.rowCount || 0 },
        message: `Đã xuất bản toàn bộ ${snapshotRows.length} tài liệu`,
      });
    }

    if (payload.action === "reorder_siblings") {
      const orderedSlugs = payload.orderedSlugs || [];
      if (orderedSlugs.length === 0) {
        return NextResponse.json({ success: false, error: "Danh sách sắp xếp trống" }, { status: 400 });
      }

      for (let i = 0; i < orderedSlugs.length; i++) {
        await pool.query(
          "UPDATE k12_leader_documents SET sort_order = $1, updated_by_email = $2 WHERE slug = $3",
          [i, auth.email, orderedSlugs[i]]
        );
      }

      clearK12LeaderDocsCache();

      return NextResponse.json({ success: true, message: "Đã cập nhật thứ tự tài liệu" });
    }

    const {
      title,
      slug: rawSlug,
      content = "",
      topic,
      excerpt,
      coverImageUrl,
      type = "article",
      sectionSlug,
      parentSlug,
      status = "draft",
      sortOrder = 0,
    } = payload;

    if (!title || !rawSlug) {
      return NextResponse.json({ success: false, error: "Tiêu đề và đường dẫn (slug) là bắt buộc" }, { status: 400 });
    }

    const slug = normalizeSlugPath(rawSlug);

    const existing = await pool.query("SELECT id FROM k12_leader_documents WHERE slug = $1 LIMIT 1", [slug]);
    if (existing.rows[0]) {
      return NextResponse.json({ success: false, error: `Slug "${slug}" đã tồn tại` }, { status: 400 });
    }

    let sectionId: number | null = null;
    let parentId: number | null = null;
    let sectionDoc: { relative_path: string } | null = null;
    let parentDoc: { relative_path: string } | null = null;

    if (sectionSlug) {
      const sDoc = await getDocBySlug(sectionSlug);
      if (sDoc) {
        sectionId = sDoc.id;
        sectionDoc = sDoc;
      }
    }

    if (parentSlug) {
      const pDoc = await getDocBySlug(parentSlug);
      if (pDoc) {
        parentId = pDoc.id;
        parentDoc = pDoc;
      }
    }

    const relativePath = payload.relativePath || buildRelativePathByHierarchy(type, slug, sectionDoc, parentDoc);

    const result = await pool.query(
      `INSERT INTO k12_leader_documents (
        slug, title, relative_path, content, topic, excerpt, cover_image_url,
        type, section_id, parent_id, status, sort_order, created_by_email, updated_by_email
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
      RETURNING id, slug, title, relative_path, content, type, section_id, parent_id, topic, excerpt, cover_image_url, status, sort_order, updated_at`,
      [
        slug,
        title,
        relativePath,
        content,
        topic || null,
        excerpt || null,
        coverImageUrl || null,
        type,
        sectionId,
        parentId,
        status,
        sortOrder,
        auth.email,
      ]
    );

    clearK12LeaderDocsCache();

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: "Tạo tài liệu thành công",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Lỗi server" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const payload = (await request.clone().json()) as K12LeaderDocPayload;
  if (payload.action === 'publish_all') return POST(request);
  const auth = await ensureAdminOrSuperAdmin(request);
  if (!auth.ok) return auth.response;
  await ensureK12LeaderSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize tree changes so a concurrent move cannot invalidate sibling/slug checks.
    await client.query('LOCK TABLE k12_leader_documents IN SHARE ROW EXCLUSIVE MODE');
    const result = await client.query('SELECT * FROM k12_leader_documents ORDER BY sort_order, id');
    const rows = result.rows as LeaderTreeRow[];
    let data;
    if (payload.action === 'reorder_siblings') {
      const updates = planLeaderReorder(rows, payload.parentSlug || null, payload.orderedSlugs || []);
      for (const row of updates) {
        await client.query('UPDATE k12_leader_documents SET sort_order = $1, updated_by_email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [row.sort_order, auth.email, row.id]);
      }
    } else {
      if (payload.action) throw new Error('Thao tác không được hỗ trợ');
      const originalSlug = payload.originalSlug || payload.slug || '';
      const current = rows.find(row => row.slug === originalSlug);
      if (!current) throw new Error('Không tìm thấy tài liệu');
      const nextSlug = payload.slug ? normalizeSlugPath(payload.slug) : originalSlug;
      const parentId = effectiveLeaderParent(rows, current);
      const parentSlug = payload.parentSlug !== undefined ? payload.parentSlug :
        nextSlug !== originalSlug ? (nextSlug.includes('/') ? nextSlug.slice(0, nextSlug.lastIndexOf('/')) : null) :
          rows.find(row => row.id === parentId)?.slug ?? null;
      const hierarchyChanged = nextSlug !== originalSlug || parentSlug !== (rows.find(row => row.id === parentId)?.slug ?? null);
      const updates = hierarchyChanged ? planLeaderMove(rows, originalSlug, nextSlug, parentSlug, payload.sortOrder) :
        [{ ...current, sort_order: payload.sortOrder ?? current.sort_order }];
      for (const row of updates) {
        await client.query(`UPDATE k12_leader_documents SET slug = $1, relative_path = $2, parent_id = $3,
          section_id = $4, sort_order = $5, updated_by_email = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7`,
        [row.slug, row.relative_path, row.parent_id, row.section_id, row.sort_order, auth.email, row.id]);
      }
      const fields = { title: payload.title, content: payload.content, topic: payload.topic,
        excerpt: payload.excerpt, cover_image_url: payload.coverImageUrl, status: payload.status, type: payload.type };
      for (const [column, value] of Object.entries(fields)) {
        if (value !== undefined) await client.query(`UPDATE k12_leader_documents SET ${column} = $1 WHERE id = $2`, [value, current.id]);
      }
      const saved = (await client.query('SELECT * FROM k12_leader_documents WHERE id = $1', [current.id])).rows[0];
      data = { ...saved, relativePath: saved.relative_path, parentId: saved.parent_id, sectionId: saved.section_id,
        sortOrder: saved.sort_order, coverImageUrl: saved.cover_image_url, updatedAt: saved.updated_at };
    }
    await client.query('COMMIT');
    clearK12LeaderDocsCache();
    return NextResponse.json({ success: true, message: 'Đã cập nhật tài liệu', data });
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Không thể cập nhật tài liệu' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureK12LeaderSchema();

    const auth = await ensureAdminOrSuperAdmin(request);
    if (auth.ok === false) return auth.response;

    const payload = (await request.json()) as K12LeaderDocPayload;
    const originalSlug = payload.originalSlug || payload.slug;

    if (!originalSlug) {
      return NextResponse.json({ success: false, error: "Original slug là bắt buộc" }, { status: 400 });
    }

    const currentDoc = await pool.query(
      "SELECT id, slug, relative_path, type, section_id, parent_id FROM k12_leader_documents WHERE slug = $1 LIMIT 1",
      [originalSlug]
    );

    if (!currentDoc.rows[0]) {
      return NextResponse.json({ success: false, error: "Không tìm thấy tài liệu cần cập nhật" }, { status: 404 });
    }

    const docId = currentDoc.rows[0].id;
    const title = payload.title;
    const newSlug = payload.slug ? normalizeSlugPath(payload.slug) : originalSlug;
    const content = payload.content !== undefined ? payload.content : undefined;
    const topic = payload.topic;
    const excerpt = payload.excerpt;
    const coverImageUrl = payload.coverImageUrl;
    const type = payload.type || currentDoc.rows[0].type;
    const status = payload.status;
    const sortOrder = payload.sortOrder;

    if (newSlug !== originalSlug) {
      const duplicate = await pool.query(
        "SELECT id FROM k12_leader_documents WHERE slug = $1 AND id <> $2 LIMIT 1",
        [newSlug, docId]
      );
      if (duplicate.rows[0]) {
        return NextResponse.json({ success: false, error: `Slug "${newSlug}" đã được sử dụng` }, { status: 400 });
      }
    }

    const result = await pool.query(
      `UPDATE k12_leader_documents
       SET
         title = COALESCE($1, title),
         slug = COALESCE($2, slug),
         content = COALESCE($3, content),
         topic = $4,
         excerpt = $5,
         cover_image_url = $6,
         type = COALESCE($7, type),
         status = COALESCE($8, status),
         sort_order = COALESCE($9, sort_order),
         updated_by_email = $10,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING id, slug, title, relative_path, content, type, section_id, parent_id, topic, excerpt, cover_image_url, status, sort_order, updated_at`,
      [
        title,
        newSlug,
        content,
        topic || null,
        excerpt || null,
        coverImageUrl || null,
        type,
        status,
        sortOrder,
        auth.email,
        docId,
      ]
    );

    clearK12LeaderDocsCache();

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: "Cập nhật tài liệu thành công",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Lỗi server" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureK12LeaderSchema();

    const auth = await ensureAdminOrSuperAdmin(request);
    if (auth.ok === false) return auth.response;

    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json({ success: false, error: "Slug là bắt buộc" }, { status: 400 });
    }

    const doc = await pool.query("SELECT id, title, type FROM k12_leader_documents WHERE slug = $1 LIMIT 1", [slug]);
    if (!doc.rows[0]) {
      return NextResponse.json({ success: false, error: "Không tìm thấy tài liệu" }, { status: 404 });
    }

    const docId = doc.rows[0].id;

    // Check if it has children
    const children = await pool.query(
      "SELECT id FROM k12_leader_documents WHERE parent_id = $1 OR section_id = $1 LIMIT 1",
      [docId]
    );

    if (children.rows[0]) {
      return NextResponse.json(
        { success: false, error: "Không thể xóa mục đang có tài liệu con. Vui lòng di chuyển hoặc xóa các tài liệu con trước." },
        { status: 400 }
      );
    }

    await pool.query("DELETE FROM k12_leader_documents WHERE id = $1", [docId]);

    clearK12LeaderDocsCache();

    return NextResponse.json({
      success: true,
      message: `Đã xóa tài liệu "${doc.rows[0].title}"`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Lỗi server" }, { status: 500 });
  }
}
