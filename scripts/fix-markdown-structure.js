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
 * Fix Markdown structure issues
 */
function fixMarkdownStructure(content) {
  let fixed = content
  
  // 1. Ensure headings are on their own lines with blank lines before/after
  // Match any heading (# to ######) that might be in the middle of text
  fixed = fixed.replace(/([^\n])\s*(#{1,6}\s+[^\n]+)/g, '$1\n\n$2')
  fixed = fixed.replace(/(#{1,6}\s+[^\n]+)\s*([^\n#])/g, '$1\n\n$2')
  
  // 2. Ensure list items are on their own lines
  // Match bullet points that might be in the middle of text
  fixed = fixed.replace(/([^\n])\s*(\*\s+[^\n]+)/g, '$1\n$2')
  
  // 3. Ensure each list item starts on a new line
  fixed = fixed.replace(/(\*\s+[^\n]+)\s+(\*\s+)/g, '$1\n$2')
  
  // 4. Add blank line before first list item if preceded by text
  fixed = fixed.replace(/([^\n*])\n(\*\s+)/g, '$1\n\n$2')
  
  // 5. Add blank line after last list item if followed by text
  fixed = fixed.replace(/(\*\s+[^\n]+)\n([^\n*#])/g, '$1\n\n$2')
  
  // 6. Clean up excessive blank lines (more than 2)
  fixed = fixed.replace(/\n{3,}/g, '\n\n')
  
  // 7. Trim whitespace
  fixed = fixed.trim()
  
  return fixed
}

async function fixMarkdownStructureInDb() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    console.log('🔧 Fixing Markdown structure issues...\n')
    
    // Get all markdown documents
    const result = await client.query(
      `SELECT id, slug, title, content 
       FROM k12_documents 
       WHERE content_format = 'markdown'
       ORDER BY id`
    )
    
    console.log(`Found ${result.rows.length} Markdown documents\n`)
    
    let fixedCount = 0
    
    for (const doc of result.rows) {
      const fixed = fixMarkdownStructure(doc.content)
      
      // Only update if content changed
      if (fixed !== doc.content) {
        await client.query(
          `UPDATE k12_documents 
           SET content = $1
           WHERE id = $2`,
          [fixed, doc.id]
        )
        
        fixedCount++
        console.log(`✅ Fixed: ${doc.title} (ID: ${doc.id})`)
      }
    }
    
    await client.query('COMMIT')
    
    console.log(`\n✨ Fixed ${fixedCount} documents`)
    console.log('   Separated headings and lists properly')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixMarkdownStructureInDb().catch(console.error)
