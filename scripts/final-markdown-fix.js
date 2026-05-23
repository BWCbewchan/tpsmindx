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

/**
 * Final fix for all markdown documents
 * This will ONLY fix documents that are already in markdown format
 * and have clear structural issues
 */
async function finalMarkdownFix() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    console.log('🔧 Final Markdown fix - reverting broken documents...\n')
    
    // Get all markdown documents
    const result = await client.query(
      `SELECT id, slug, title, content 
       FROM k12_documents 
       WHERE content_format = 'markdown'
       ORDER BY id`
    )
    
    console.log(`Found ${result.rows.length} Markdown documents\n`)
    
    let revertedCount = 0
    
    for (const doc of result.rows) {
      // Check if content is clearly broken (has isolated characters on lines)
      const hasBrokenContent = /^[a-z]{1,2}$/m.test(doc.content) || 
                               /\*\n\*/.test(doc.content) ||
                               doc.content.includes('\n\nc\n\n') ||
                               doc.content.includes('\n\n*\n*\n\n')
      
      if (hasBrokenContent) {
        // Revert to HTML format so it can be re-converted properly
        await client.query(
          'UPDATE k12_documents SET content_format = $1 WHERE id = $2',
          ['html', doc.id]
        )
        
        revertedCount++
        console.log(`⚠️  Reverted to HTML: ${doc.title} (ID: ${doc.id}) - will need re-conversion`)
      }
    }
    
    await client.query('COMMIT')
    
    console.log(`\n✨ Reverted ${revertedCount} broken documents to HTML format`)
    console.log('   These documents need to be re-imported from GitBook or fixed manually')
    
    if (revertedCount === 0) {
      console.log('   All documents look good!')
    }
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

finalMarkdownFix().catch(console.error)
