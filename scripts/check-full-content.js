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
      'SELECT id, title, slug, content FROM k12_documents WHERE slug = $1',
      ['i.-tong-quan/thong-tin-san-pham/cac-mo-hinh-hoc']
    )
    
    if (result.rows.length > 0) {
      const doc = result.rows[0]
      console.log('Document ID:', doc.id)
      console.log('Title:', doc.title)
      console.log('Slug:', doc.slug)
      console.log('\n=== FULL CONTENT ===')
      console.log(doc.content)
      console.log('\n=== END CONTENT ===')
      
      // Check if it starts with HTML tags
      if (doc.content.trim().startsWith('<')) {
        console.log('\n⚠️  Content starts with HTML tag!')
      } else if (doc.content.trim().startsWith('#')) {
        console.log('\n✅ Content starts with Markdown!')
      }
    } else {
      console.log('Document not found')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkDocument()
