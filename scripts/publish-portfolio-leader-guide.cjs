// Preview: node scripts/publish-portfolio-leader-guide.cjs
// Publish this article only: node scripts/publish-portfolio-leader-guide.cjs --apply
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { JSDOM } = require('jsdom');

const parentSlug = 'iv-quy-trinh-lam-viec/1-codingroboticsart-leader';
const slug = `${parentSlug}/14-portfolio-ho-so-hoc-vien`;
const title = '1.4. Portfolio - Hồ sơ học viên';
const content = fs.readFileSync(path.join(__dirname, '../docs/k12-leader/portfolio-ho-so-hoc-vien.html'), 'utf8');
const dom = new JSDOM(content);
if (content.includes('{{') || dom.window.document.querySelectorAll('img').length !== 5 || !dom.window.document.querySelector('video[controls]')) {
  throw new Error('Guide must include resolved media URLs, five screenshots and a video player.');
}
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ title, slug, images: 5, video: true, characters: content.length }, null, 2));
} else {
  const pool = new Pool({
    ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    }),
    ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
    max: 1,
  });
  (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const parent = await client.query('SELECT id, section_id FROM k12_leader_documents WHERE slug = $1', [parentSlug]);
      if (parent.rowCount !== 1) throw new Error('Missing IV / 1. Coding/Robotics/Art Leader parent document.');
      const previous = await client.query('SELECT * FROM k12_leader_documents WHERE slug = $1 FOR UPDATE', [slug]);
      if (previous.rowCount) {
        const directory = path.join(__dirname, '../tmp/portfolio-guide');
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, `backup-${Date.now()}.json`), JSON.stringify(previous.rows[0], null, 2));
      }
      const result = await client.query(`
        INSERT INTO k12_leader_documents
          (slug, title, relative_path, content, status, type, parent_id, section_id, sort_order, content_format, topic, excerpt)
        VALUES ($1, $2, $3, $4, 'published', 'article', $5, $6,
          3, 'html', $7, $8)
        ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content,
          status = 'published', content_format = 'html', topic = EXCLUDED.topic,
          excerpt = EXCLUDED.excerpt, parent_id = EXCLUDED.parent_id, section_id = EXCLUDED.section_id,
          relative_path = EXCLUDED.relative_path, sort_order = EXCLUDED.sort_order, updated_at = CURRENT_TIMESTAMP
        RETURNING id, slug, status`,
      [slug, title, `${slug}.md`, content, parent.rows[0].id, parent.rows[0].section_id || parent.rows[0].id,
        'Portfolio - Hồ sơ học viên', 'Hướng dẫn tạo bản thô từ LMS, tùy chỉnh hồ sơ, chia sẻ link public và phân quyền quản lý; kèm video và ảnh thao tác.']);
      const verified = await client.query('SELECT content FROM k12_leader_documents WHERE slug = $1', [slug]);
      if (verified.rows[0]?.content !== content) throw new Error('Stored article differs from source.');
      await client.query('COMMIT');
      console.log(JSON.stringify({ ...result.rows[0], verified: true }));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
