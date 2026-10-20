require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function updateDoc124() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, slug, title, content FROM k12_documents WHERE id = 124');
    if (res.rows.length === 0) {
      console.error('Doc 124 not found');
      return;
    }

    const doc = res.rows[0];
    let content = doc.content;

    console.log(`Original content length: ${content.length}`);

    const img1Old = /data:image\/jpeg;base64,[^"']+/;
    const img2Old = /data:image\/png;base64,[^"']+/;

    const newImg1 = '/k12-docs/quy-trinh-nop-san-pham/chon-buoi-hoc-va-san-pham-hoc-sinh.jpg';
    const newImg2 = '/k12-docs/quy-trinh-nop-san-pham/bieu-mau-nhap-thong-tin-san-pham.png';

    if (!img1Old.test(content) && !content.includes(newImg1)) {
      console.log('Image 1 already updated or not found');
    }
    if (!img2Old.test(content) && !content.includes(newImg2)) {
      console.log('Image 2 already updated or not found');
    }

    content = content
      .replace(img1Old, newImg1)
      .replace(img2Old, newImg2);

    // Also add alt attribute if not present
    content = content.replace(
      `<img class="tiptap-image" src="${newImg1}"`,
      `<img class="tiptap-image" alt="Chọn buổi học và Sản phẩm của học sinh" src="${newImg1}"`
    );
    content = content.replace(
      `<img class="tiptap-image" src="${newImg2}"`,
      `<img class="tiptap-image" alt="Biểu mẫu nhập thông tin và tải bộ sản phẩm" src="${newImg2}"`
    );

    console.log(`New content length: ${content.length}`);

    await client.query(
      'UPDATE k12_documents SET content = $1, updated_at = NOW() WHERE id = 124',
      [content]
    );

    console.log('Successfully updated k12_documents for id 124!');
  } finally {
    client.release();
    await pool.end();
  }
}

updateDoc124().catch(console.error);
