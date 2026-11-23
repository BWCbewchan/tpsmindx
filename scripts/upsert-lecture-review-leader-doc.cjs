const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')

require('dotenv').config({ quiet: true })

const ROOT = path.resolve(__dirname, '..')
const CONTENT_PATH = path.join(
  ROOT,
  'docs',
  'guides',
  'lecture-review-leader-te.md',
)

const DOC = {
  slug: 'iv-quy-trinh-lam-viec/1-codingroboticsart-leader/13-quan-ly-chat-luong/132-quy-trinh-ang-ky-va-quan-ly-duyet-giang',
  title: '1.3.2. Quy trình đăng ký và quản lý duyệt giảng',
  relativePath:
    'iv-quy-trinh-lam-viec/1-codingroboticsart-leader/13-quan-ly-chat-luong/132-quy-trinh-ang-ky-va-quan-ly-duyet-giang.md',
  topic: 'Quy Trình, Quy Định K12 Teaching - Leader/TE/TC',
  excerpt:
    'Hướng dẫn Leader/TE đăng ký lịch duyệt giảng, gửi tài liệu và theo dõi các phiếu đã đăng ký trên TPS.',
  type: 'article',
  sectionId: 1,
  parentId: 64,
  status: 'published',
  sortOrder: 1,
  contentFormat: 'html',
}

const ACTOR_EMAIL = 'hoteaching@mindx.com.vn'

function connectionOptions() {
  return {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:
      process.env.DATABASE_URL ||
      process.env.DB_SSL === 'true' ||
      process.env.DB_SSL === '1'
        ? { rejectUnauthorized: false }
        : undefined,
  }
}

async function main() {
  const markdown = fs.readFileSync(CONTENT_PATH, 'utf8')
  const { marked } = await import('marked')
  const content = await marked.parse(markdown, {
    gfm: true,
    breaks: false,
  })
  const client = new Client(connectionOptions())
  await client.connect()

  try {
    await client.query('BEGIN')

    const allDocuments = await client.query(
      `SELECT id, slug, title, relative_path, content, topic, excerpt,
              cover_image_url, type, section_id, parent_id, status, sort_order,
              content_format, created_at, updated_at
       FROM k12_leader_documents
       ORDER BY sort_order ASC, title ASC`,
    )
    const snapshotRows = allDocuments.rows.map((row) => ({
      ...row,
      topic: row.topic || null,
      excerpt: row.excerpt || null,
      cover_image_url: row.cover_image_url || null,
      type: row.type || 'article',
      status: 'published',
      sort_order: row.sort_order || 0,
      content_format: row.content_format || 'html',
    }))
    await client.query(
      `INSERT INTO k12_leader_publish_snapshots
         (snapshot_data, document_count, created_by_email)
       VALUES ($1, $2, $3)`,
      [JSON.stringify(snapshotRows), snapshotRows.length, ACTOR_EMAIL],
    )

    const existing = await client.query(
      `SELECT id
       FROM k12_leader_documents
       WHERE slug = $1 OR relative_path = $2
       LIMIT 1`,
      [DOC.slug, DOC.relativePath],
    )

    let saved
    if (existing.rows[0]) {
      saved = await client.query(
        `UPDATE k12_leader_documents
         SET title = $1,
             slug = $2,
             relative_path = $3,
             content = $4,
             topic = $5,
             excerpt = $6,
             cover_image_url = NULL,
             type = $7,
             section_id = $8,
             parent_id = $9,
             status = $10,
             sort_order = $11,
             content_format = $12,
             updated_by_email = $13,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $14
         RETURNING id, slug, title, status, content_format, parent_id, sort_order`,
        [
          DOC.title,
          DOC.slug,
          DOC.relativePath,
          content,
          DOC.topic,
          DOC.excerpt,
          DOC.type,
          DOC.sectionId,
          DOC.parentId,
          DOC.status,
          DOC.sortOrder,
          DOC.contentFormat,
          ACTOR_EMAIL,
          existing.rows[0].id,
        ],
      )
    } else {
      saved = await client.query(
        `INSERT INTO k12_leader_documents
           (slug, title, relative_path, content, topic, excerpt,
            cover_image_url, type, section_id, parent_id, status, sort_order,
            content_format, created_by_email, updated_by_email)
         VALUES
           ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, $11, $12, $13, $13)
         RETURNING id, slug, title, status, content_format, parent_id, sort_order`,
        [
          DOC.slug,
          DOC.title,
          DOC.relativePath,
          content,
          DOC.topic,
          DOC.excerpt,
          DOC.type,
          DOC.sectionId,
          DOC.parentId,
          DOC.status,
          DOC.sortOrder,
          DOC.contentFormat,
          ACTOR_EMAIL,
        ],
      )
    }

    await client.query('COMMIT')
    process.stdout.write(`${JSON.stringify(saved.rows[0], null, 2)}\n`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
