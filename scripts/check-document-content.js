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

async function checkDocument() {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'SELECT id, title, slug, LEFT(content, 200) as content_preview FROM k12_documents WHERE slug = $1',
      ['i.-tong-quan/thong-tin-san-pham/cac-mo-hinh-hoc']
    )
    
    if (result.rows.length > 0) {
      console.log('Document found:')
      console.log('ID:', result.rows[0].id)
      console.log('Title:', result.rows[0].title)
      console.log('Slug:', result.rows[0].slug)
      console.log('\nContent preview (first 200 chars):')
      console.log(result.rows[0].content_preview)
    } else {
      console.log('Document not found with that slug')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkDocument()
