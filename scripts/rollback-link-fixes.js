/**
 * Rollback - Chuyển links về dạng relative path đơn giản
 * Vì mapGitbookHref trong K12DocsClient sẽ tự động xử lý
 */

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

async function rollback() {
  const client = await pool.connect()
  
  try {
    console.log('🔄 Rolling back link fixes...\n')
    
    const result = await client.query(
      'SELECT id, slug, content FROM k12_documents ORDER BY id'
    )
    
    let updatedCount = 0
    
    await client.query('BEGIN')
    
    for (const doc of result.rows) {
      let newContent = doc.content
      let hasChanges = false
      
      // Chuyển links dạng /user/quy-trinh-quy-dinh?doc=... về dạng relative
      const pattern = /\[([^\]]+)\]\(\/user\/quy-trinh-quy-dinh\?doc=([^)]+)\)/g
      
      if (pattern.test(newContent)) {
        newContent = newContent.replace(pattern, (match, text, encodedSlug) => {
          const slug = decodeURIComponent(encodedSlug)
          return `[${text}](${slug})`
        })
        hasChanges = true
      }
      
      if (hasChanges) {
        await client.query(
          'UPDATE k12_documents SET content = $1, updated_at = NOW() WHERE id = $2',
          [newContent, doc.id]
        )
        updatedCount++
        console.log(`✓ Rolled back document #${doc.id}: ${doc.slug}`)
      }
    }
    
    await client.query('COMMIT')
    
    console.log(`\n✅ Rolled back ${updatedCount} documents!`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

rollback().catch(console.error)
