import path from "path";
import { requireBearerSession } from "@/lib/datasource-api-auth";
import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

let k12SchemaEnsured = false;

interface K12DocPayload {
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
  parentSlug?: string;
  status?: "draft" | "published";
  sortOrder?: number;
  originalSlug?: string;
  orderedSlugs?: string[];
}

async function ensureK12Schema() {
  if (k12SchemaEnsured) return;

  await pool.query(`
    ALTER TABLE IF EXISTS k12_documents
    ADD COLUMN IF NOT EXISTS topic VARCHAR(255),
    ADD COLUMN IF NOT EXISTS excerpt TEXT,
    ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'article',
    ADD COLUMN IF NOT EXISTS section_id INTEGER,
    ADD COLUMN IF NOT EXISTS parent_id INTEGER,
    ADD COLUMN IF NOT EXISTS content_format VARCHAR(20) NOT NULL DEFAULT 'html'
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'k12_documents_type_check'
      ) THEN
        ALTER TABLE k12_documents
        ADD CONSTRAINT k12_documents_type_check CHECK (type IN ('section', 'article'));
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'k12_documents_content_format_check'
      ) THEN
        ALTER TABLE k12_documents
        ADD CONSTRAINT k12_documents_content_format_check CHECK (content_format IN ('html', 'json'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS k12_publish_snapshots (
      id SERIAL PRIMARY KEY,
      snapshot_data JSONB NOT NULL,
      document_count INTEGER NOT NULL DEFAULT 0,
      created_by_email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_k12_publish_snapshots_created_at ON k12_publish_snapshots(created_at DESC)"
  );

  k12SchemaEnsured = true;
}

function mapDocumentRowToSnapshot(row: any) {
  return {
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
    status: row.status || "draft",
    sort_order: row.sort_order || 0,
    content_format: row.content_format || "html",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
    // Keep dots to support legacy Roman-prefix slugs like "vi.-...".
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
  await ensureK12Schema();

  const result = await pool.query(
    "SELECT id, slug, relative_path, type, section_id, parent_id FROM k12_documents WHERE slug = $1 LIMIT 1",
    [slug]
  );

  return result.rows[0] || null;
}

function getDirname(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const dir = path.posix.dirname(normalized);
  return dir === "." ? "" : dir;
}

function buildRelativePathByHierarchy(type: "section" | "article", slug: string, sectionDoc?: { relative_path: string } | null, parentDoc?: { relative_path: string } | null) {
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

async function ensureSuperAdmin(request: NextRequest) {
  const auth = await requireBearerSession(request);
  if (!auth.ok) {
    return {
      ok: false,
      email: "",
      response: auth.response,
    };
  }
  const email = auth.sessionEmail;

  const result = await pool.query(
    "SELECT role FROM app_users WHERE LOWER(email) = $1 AND is_active = true LIMIT 1",
    [email]
  );

  if (!result.rows[0] || result.rows[0].role !== "super_admin") {
    return {
      ok: false,
      email,
      response: NextResponse.json({ success: false, error: "Chỉ Super Admin được phép thao tác" }, { status: 403 }),
    };
  }

  return { ok: true, email };
}

export async function GET(request: NextRequest) {
  try {
    await ensureK12Schema();

    const action = request.nextUrl.searchParams.get("action");

    if (action === "history") {
      const auth = await ensureSuperAdmin(request);
      if (!auth.ok) return auth.response;

      const latest = await pool.query(
        `SELECT id, document_count, created_by_email, created_at
         FROM k12_publish_snapshots
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

    if (includeDraft) {
      const auth = await ensureSuperAdmin(request);
      if (!auth.ok) return auth.response;
    }

    const query = includeDraft
      ? `SELECT id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, updated_at
         FROM k12_documents
         ORDER BY sort_order ASC, title ASC`
      : `SELECT id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, updated_at
         FROM k12_documents
         WHERE status = 'published'
         ORDER BY sort_order ASC, title ASC`;

    const result = await pool.query(query);

    return NextResponse.json({
      success: true,
      data: result.rows.map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        relativePath: row.relative_path,
        content: row.content,
        topic: row.topic || "",
        excerpt: row.excerpt || "",
        coverImageUrl: row.cover_image_url || "",
        type: row.type || "article",
        sectionId: row.section_id,
        parentId: row.parent_id,
        status: row.status,
        sortOrder: row.sort_order,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error: any) {
    console.error("k12-docs GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureK12Schema();

    const auth = await ensureSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as K12DocPayload;
    const type = body.type === "section" || body.sectionSlug === "__new__" ? "section" : "article";
    const title = (body.title || "").trim();
    const content = body.content || "";
    const topic = (body.topic || "").trim();
    const excerpt = (body.excerpt || "").trim();
    const coverImageUrl = (body.coverImageUrl || "").trim();
    const status = body.status === "published" ? "published" : "draft";
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0;

    if (!title) {
      return NextResponse.json({ success: false, error: "Tiêu đề là bắt buộc" }, { status: 400 });
    }

    const requestedSlug = (body.slug || "").trim();
    const normalizedRequestedSlug = normalizeSlugPath(requestedSlug || title);
    let slug = normalizedRequestedSlug;
    if (!slug) {
      return NextResponse.json({ success: false, error: "Slug không hợp lệ" }, { status: 400 });
    }

    const sectionDoc = body.sectionSlug && body.sectionSlug !== "__new__" ? await getDocBySlug(normalizeSlugPath(body.sectionSlug)) : null;
    const parentDoc = body.parentSlug ? await getDocBySlug(normalizeSlugPath(body.parentSlug)) : null;

    if (parentDoc?.slug) {
      const normalizedParentSlug = normalizeSlugPath(parentDoc.slug);
      if (slug !== normalizedParentSlug && !slug.startsWith(`${normalizedParentSlug}/`)) {
        const leaf = getSlugLeaf(slug);
        slug = normalizeSlugPath(`${normalizedParentSlug}/${leaf}`);
      }
    }

    const relativePath = buildRelativePathByHierarchy(type, slug, sectionDoc, parentDoc).replace(/\\/g, "/").trim();

    const sectionId =
      type === "article"
        ? sectionDoc?.id || (parentDoc?.type === "section" ? parentDoc.id : parentDoc?.section_id || null)
        : null;
    const parentId = parentDoc?.id || null;

    const existed = await pool.query("SELECT 1 FROM k12_documents WHERE slug = $1 LIMIT 1", [slug]);
    if (existed.rowCount) {
      return NextResponse.json({ success: false, error: "Slug đã tồn tại" }, { status: 409 });
    }

    const inserted = await pool.query(
      `INSERT INTO k12_documents (
         slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, created_by_email, updated_by_email
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
       RETURNING id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, updated_at`,
      [slug, title, relativePath, content, topic || null, excerpt || null, coverImageUrl || null, type, sectionId, parentId, status, sortOrder, auth.email]
    );

    return NextResponse.json({
      success: true,
      message: status === "draft" ? "Đã lưu nháp" : "Đã xuất bản",
      data: {
        slug: inserted.rows[0].slug,
        title: inserted.rows[0].title,
        relativePath: inserted.rows[0].relative_path,
        content: inserted.rows[0].content,
        topic: inserted.rows[0].topic || "",
        excerpt: inserted.rows[0].excerpt || "",
        coverImageUrl: inserted.rows[0].cover_image_url || "",
        type: inserted.rows[0].type || "article",
        sectionId: inserted.rows[0].section_id,
        parentId: inserted.rows[0].parent_id,
        status: inserted.rows[0].status,
        sortOrder: inserted.rows[0].sort_order,
        updatedAt: inserted.rows[0].updated_at,
      },
    });
  } catch (error: any) {
    console.error("k12-docs POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureK12Schema();

    const auth = await ensureSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as K12DocPayload;

    if (body.action === "publish_all") {
      await pool.query("BEGIN");

      const currentDocs = await pool.query(
        `SELECT id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, content_format, created_at, updated_at
         FROM k12_documents
         ORDER BY sort_order ASC, title ASC`
      );

      const snapshotData = currentDocs.rows.map((row) => mapDocumentRowToSnapshot(row)).map((row) => ({
        ...row,
        status: "published",
      }));

      await pool.query(
        `INSERT INTO k12_publish_snapshots (snapshot_data, document_count, created_by_email)
         VALUES ($1, $2, $3)`,
        [JSON.stringify(snapshotData), snapshotData.length, auth.email]
      );

      const updated = await pool.query(
        `UPDATE k12_documents
         SET status = 'published',
             updated_by_email = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE status <> 'published'`,
        [auth.email]
      );

      await pool.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Đã phát hành toàn bộ bộ tài liệu",
        data: { affectedCount: updated.rowCount || 0 },
      });
    }

    if (body.action === "restore_last_publish") {
      const latest = await pool.query(
        `SELECT snapshot_data, document_count, created_at, created_by_email
         FROM k12_publish_snapshots
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      );

      const latestRow = latest.rows[0];
      if (!latestRow) {
        return NextResponse.json({ success: false, error: "Chưa có lịch sử phát hành để khôi phục" }, { status: 404 });
      }

      const snapshotDocuments = normalizeSnapshotDocuments(latestRow.snapshot_data);
      if (snapshotDocuments.length === 0) {
        return NextResponse.json({ success: false, error: "Bản phát hành gần nhất không có dữ liệu để khôi phục" }, { status: 400 });
      }

      await pool.query("BEGIN");
      await pool.query("DELETE FROM k12_documents");

      for (const row of snapshotDocuments) {
        const createdAt = row.created_at ? new Date(row.created_at) : new Date();
        const updatedAt = row.updated_at ? new Date(row.updated_at) : createdAt;
        await pool.query(
          `INSERT INTO k12_documents (
             id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, content_format, created_by_email, updated_by_email, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            row.id,
            row.slug,
            row.title,
            row.relative_path,
            row.content,
            row.topic,
            row.excerpt,
            row.cover_image_url,
            row.type,
            row.section_id,
            row.parent_id,
            row.status,
            row.sort_order,
            row.content_format,
            auth.email,
            auth.email,
            createdAt,
            updatedAt,
          ]
        );
      }

      await pool.query(
        `SELECT setval(
           pg_get_serial_sequence('k12_documents', 'id'),
           COALESCE((SELECT MAX(id) FROM k12_documents), 1),
           true
         )`
      );
      await pool.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: `Đã khôi phục bản phát hành gần nhất (${latestRow.document_count || snapshotDocuments.length} tài liệu)`,
        data: {
          affectedCount: snapshotDocuments.length,
          createdAt: latestRow.created_at,
          createdByEmail: latestRow.created_by_email || "",
        },
      });
    }

    if (body.action === "repair_hierarchy") {
      const normalizedPathResult = await pool.query(
        `UPDATE k12_documents
         SET relative_path = regexp_replace(replace(relative_path, '\\\\', '/'), '/+', '/', 'g'),
             updated_by_email = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE relative_path LIKE '%\\\\%' OR relative_path LIKE '%//%'`,
        [auth.email]
      );

      const parentFixResult = await pool.query(
        `WITH normalized AS (
           SELECT
             id,
             regexp_replace(replace(relative_path, '\\\\', '/'), '/+', '/', 'g') AS norm_path
           FROM k12_documents
         ),
         stems AS (
           SELECT
             id,
             regexp_replace(norm_path, '\\.md$', '', 'i') AS stem
           FROM normalized
         ),
         inferred AS (
           SELECT
             child.id AS child_id,
             parent.id AS inferred_parent_id
           FROM stems child
           JOIN stems parent
             ON parent.stem = regexp_replace(child.stem, '/[^/]+$', '')
           WHERE child.stem LIKE '%/%'
         )
         UPDATE k12_documents target
         SET parent_id = inferred.inferred_parent_id,
             updated_by_email = $1,
             updated_at = CURRENT_TIMESTAMP
         FROM inferred
         WHERE target.id = inferred.child_id
           AND target.parent_id IS DISTINCT FROM inferred.inferred_parent_id`,
        [auth.email]
      );

      return NextResponse.json({
        success: true,
        message: "Đã rà và sửa phân cấp cha/con theo đường dẫn",
        data: {
          affectedCount: (normalizedPathResult.rowCount || 0) + (parentFixResult.rowCount || 0),
        },
      });
    }

    if (body.action === "reorder_siblings") {
      const orderedSlugs = Array.isArray(body.orderedSlugs)
        ? body.orderedSlugs.map((slug) => normalizeSlugPath(String(slug || ""))).filter(Boolean)
        : [];

      if (orderedSlugs.length === 0) {
        return NextResponse.json({ success: false, error: "Thiếu danh sách slug để sắp xếp" }, { status: 400 });
      }

      const parentDoc = body.parentSlug ? await getDocBySlug(normalizeSlugPath(body.parentSlug)) : null;
      const parentId = parentDoc?.id || null;

      await pool.query("BEGIN");

      let affectedCount = 0;
      for (let index = 0; index < orderedSlugs.length; index += 1) {
        const slug = orderedSlugs[index];
        const updated = await pool.query(
          `UPDATE k12_documents
           SET sort_order = $1,
               updated_by_email = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE slug = $3
             AND parent_id IS NOT DISTINCT FROM $4`,
          [index, auth.email, slug, parentId]
        );
        affectedCount += updated.rowCount || 0;
      }

      await pool.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Đã cập nhật thứ tự các mục cùng cấp",
        data: { affectedCount },
      });
    }

    const originalSlug = normalizeSlugPath((body.originalSlug || body.slug || "").trim());
    const nextType = body.type === "section" || body.sectionSlug === "__new__"
      ? "section"
      : body.type === "article"
        ? "article"
        : undefined;

    if (!originalSlug) {
      return NextResponse.json({ success: false, error: "Thiếu slug tài liệu" }, { status: 400 });
    }

    const current = await pool.query("SELECT * FROM k12_documents WHERE slug = $1", [originalSlug]);
    if (current.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy tài liệu" }, { status: 404 });
    }

    const title = (body.title || current.rows[0].title).trim();
    const nextSlug = normalizeSlugPath((body.slug || originalSlug).trim());
    const currentType = current.rows[0].type === "section" ? "section" : "article";
    const finalType = nextType || currentType;
    const sectionDoc = body.sectionSlug && body.sectionSlug !== "__new__" ? await getDocBySlug(normalizeSlugPath(body.sectionSlug)) : null;
    const parentDoc = body.parentSlug ? await getDocBySlug(normalizeSlugPath(body.parentSlug)) : null;
    const relativePath = buildRelativePathByHierarchy(finalType, nextSlug, sectionDoc, parentDoc).replace(/\\/g, "/").trim();
    const content = body.content ?? current.rows[0].content;
    const topic = (body.topic ?? current.rows[0].topic ?? "").trim();
    const excerpt = (body.excerpt ?? current.rows[0].excerpt ?? "").trim();
    const coverImageUrl = (body.coverImageUrl ?? current.rows[0].cover_image_url ?? "").trim();
    const status = body.status === "published" ? "published" : body.status === "draft" ? "draft" : current.rows[0].status;
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : current.rows[0].sort_order;
    const sectionId =
      finalType === "article"
        ? sectionDoc?.id || (parentDoc?.type === "section" ? parentDoc.id : parentDoc?.section_id || null)
        : null;
    const parentId = parentDoc?.id || null;

    if (!title || !nextSlug) {
      return NextResponse.json({ success: false, error: "Tiêu đề hoặc slug không hợp lệ" }, { status: 400 });
    }

    if (nextSlug !== originalSlug) {
      const existed = await pool.query("SELECT 1 FROM k12_documents WHERE slug = $1 LIMIT 1", [nextSlug]);
      if (existed.rowCount) {
        return NextResponse.json({ success: false, error: "Slug đã tồn tại" }, { status: 409 });
      }
    }

    await pool.query("BEGIN");

    const updated = await pool.query(
      `UPDATE k12_documents
       SET slug = $1,
           title = $2,
           relative_path = $3,
           content = $4,
           topic = $5,
           excerpt = $6,
           cover_image_url = $7,
           type = $8,
           section_id = $9,
           parent_id = $10,
           status = $11,
           sort_order = $12,
           updated_by_email = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE slug = $14
       RETURNING id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, updated_at`,
      [
        nextSlug,
        title,
        relativePath,
        content,
        topic || null,
        excerpt || null,
        coverImageUrl || null,
        finalType,
        sectionId,
        parentId,
        status,
        sortOrder,
        auth.email,
        originalSlug,
      ]
    );

    if (nextSlug !== originalSlug) {
      const descendants = await pool.query(
        `SELECT id, slug, relative_path
         FROM k12_documents
         WHERE slug LIKE $1`,
        [`${originalSlug}/%`]
      );

      for (const row of descendants.rows) {
        const childSlug: string = row.slug;
        const childRelativePath: string = row.relative_path || "";

        if (!childSlug.startsWith(`${originalSlug}/`)) continue;

        const slugSuffix = childSlug.slice(originalSlug.length);
        const nextChildSlug = `${nextSlug}${slugSuffix}`;
        const nextChildRelativePath = childRelativePath.startsWith(`${originalSlug}/`)
          ? `${nextSlug}${childRelativePath.slice(originalSlug.length)}`
          : childRelativePath;

        await pool.query(
          `UPDATE k12_documents
           SET slug = $1,
               relative_path = $2,
               updated_by_email = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [nextChildSlug, nextChildRelativePath, auth.email, row.id]
        );
      }
    }

    await pool.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: status === "draft" ? "Đã lưu nháp" : "Đã cập nhật",
      data: {
        slug: updated.rows[0].slug,
        title: updated.rows[0].title,
        relativePath: updated.rows[0].relative_path,
        content: updated.rows[0].content,
        topic: updated.rows[0].topic || "",
        excerpt: updated.rows[0].excerpt || "",
        coverImageUrl: updated.rows[0].cover_image_url || "",
        type: updated.rows[0].type || "article",
        sectionId: updated.rows[0].section_id,
        parentId: updated.rows[0].parent_id,
        status: updated.rows[0].status,
        sortOrder: updated.rows[0].sort_order,
        updatedAt: updated.rows[0].updated_at,
      },
    });
  } catch (error: any) {
    try {
      await pool.query("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    console.error("k12-docs PATCH error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureK12Schema();

    const auth = await ensureSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as { slug?: string; cascade?: boolean };
    const slug = (body.slug || "").trim();
    const cascade = body.cascade === true;

    if (!slug) {
      return NextResponse.json({ success: false, error: "Thiếu slug tài liệu" }, { status: 400 });
    }

    const target = await pool.query("SELECT id, slug FROM k12_documents WHERE slug = $1 LIMIT 1", [slug]);
    if (target.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy tài liệu" }, { status: 404 });
    }

    const descendantsCountResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM k12_documents WHERE slug LIKE $1",
      [`${slug}/%`]
    );
    const descendantsCount = Number(descendantsCountResult.rows[0]?.count || 0);

    if (descendantsCount > 0 && !cascade) {
      return NextResponse.json(
        {
          success: false,
          error: `Tài liệu này có ${descendantsCount} mục con. Vui lòng xác nhận xóa toàn bộ mục con trước khi tiếp tục.`,
        },
        { status: 409 }
      );
    }

    const deleted = await pool.query(
      `DELETE FROM k12_documents
       WHERE slug = $1 OR slug LIKE $2
       RETURNING slug`,
      [slug, `${slug}/%`]
    );

    const removedCount = deleted.rowCount || 0;
    const message = removedCount > 1
      ? `Đã xóa tài liệu và ${removedCount - 1} mục con`
      : "Đã xóa tài liệu";

    return NextResponse.json({ success: true, message, data: { affectedCount: removedCount } });
  } catch (error: any) {
    console.error("k12-docs DELETE error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
