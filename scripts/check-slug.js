require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
})

async function checkSlug() {
  const client = await pool.connect()
  try {
    // Tìm slug có chứa "do-tuoi-tham-gia"
    const result = await client.query(
      `SELECT id, slug, title FROM k12_documents 
       WHERE slug LIKE '%do-tuoi-tham-gia%' 
       ORDER BY slug`
    )
    
    console.log('📚 Documents matching "do-tuoi-tham-gia":\n')
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}`)
      console.log(`Slug: ${row.slug}`)
      console.log(`Title: ${row.title}`)
      console.log('---')
    })
    
    // Tìm tất cả slugs trong thư mục thong-tin-san-pham
    const result2 = await client.query(
      `SELECT id, slug, title FROM k12_documents 
       WHERE slug LIKE '%thong-tin-san-pham%' 
       ORDER BY slug`
    )
    
    console.log('\n📂 All documents in "thong-tin-san-pham":\n')
    result2.rows.forEach(row => {
      console.log(`ID: ${row.id}`)
      console.log(`Slug: ${row.slug}`)
      console.log(`Title: ${row.title}`)
      console.log('---')
    })
    
  } finally {
    client.release()
    await pool.end()
  }
}

checkSlug().catch(console.error)
