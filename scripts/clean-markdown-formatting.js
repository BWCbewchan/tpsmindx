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
 * Clean up Markdown formatting issues
 */
function cleanMarkdown(content) {
  let cleaned = content
  
  // Fix headings that are on the same line (e.g., "# Title ### Subtitle")
  // Split them into separate lines
  cleaned = cleaned.replace(/^(#{1,6}\s+[^\n]+?)\s+(#{1,6}\s+)/gm, '$1\n\n$2')
  
  // Ensure headings have blank lines before and after
  cleaned = cleaned.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2')
  cleaned = cleaned.replace(/(#{1,6}\s+[^\n]+)\n([^\n#])/g, '$1\n\n$2')
  
  // Clean up excessive blank lines (more than 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  
  // Ensure lists have proper spacing
  cleaned = cleaned.replace(/([^\n])\n(\*\s+)/g, '$1\n\n$2')
  
  // Trim whitespace
  cleaned = cleaned.trim()
  
  return cleaned
}

async function cleanMarkdownFormatting() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    console.log('🧹 Cleaning Markdown formatting...\n')
    
    // Get all markdown documents
    const result = await client.query(
      `SELECT id, slug, title, content 
       FROM k12_documents 
       WHERE content_format = 'markdown'
       ORDER BY id`
    )
    
    console.log(`Found ${result.rows.length} Markdown documents\n`)
    
    let cleanedCount = 0
    
    for (const doc of result.rows) {
      const cleaned = cleanMarkdown(doc.content)
      
      // Only update if content changed
      if (cleaned !== doc.content) {
        await client.query(
          `UPDATE k12_documents 
           SET content = $1
           WHERE id = $2`,
          [cleaned, doc.id]
        )
        
        cleanedCount++
        console.log(`✅ Cleaned: ${doc.title} (ID: ${doc.id})`)
      }
    }
    
    await client.query('COMMIT')
    
    console.log(`\n✨ Cleaned ${cleanedCount} documents`)
    console.log('   Fixed heading spacing and formatting')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

cleanMarkdownFormatting().catch(console.error)
