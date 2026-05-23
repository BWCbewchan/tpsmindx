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
 * Convert HTML-wrapped Markdown back to pure Markdown
 */
function htmlToMarkdown(html) {
  let content = html
  
  // Remove <p> tags but keep content
  content = content.replace(/<p>/g, '\n\n')
  content = content.replace(/<\/p>/g, '')
  
  // Convert <img> tags to Markdown
  content = content.replace(
    /<img[^>]*class="tiptap-image"[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/g,
    (match, src, alt) => `\n\n![${alt || 'image'}](${src})\n\n`
  )
  
  // Handle images without alt
  content = content.replace(
    /<img[^>]*src="([^"]+)"[^>]*>/g,
    (match, src) => `\n\n![image](${src})\n\n`
  )
  
  // Remove other HTML tags
  content = content.replace(/<[^>]+>/g, '')
  
  // Decode HTML entities
  content = content
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  
  // Clean up excessive newlines
  content = content.replace(/\n{3,}/g, '\n\n')
  
  return content.trim()
}

async function fixHtmlWithMarkdown() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    console.log('🔍 Finding documents with HTML format containing Markdown syntax...\n')
    
    // Get all HTML format documents
    const result = await client.query(
      `SELECT id, slug, title, content, content_format 
       FROM k12_documents 
       WHERE content_format = 'html'
       ORDER BY id`
    )
    
    console.log(`Found ${result.rows.length} HTML documents\n`)
    
    let fixedCount = 0
    
    for (const doc of result.rows) {
      // Check if content contains Markdown syntax inside HTML
      const hasMarkdownInHtml = 
        doc.content.includes('<p>#') || 
        doc.content.includes('<p>##') ||
        doc.content.includes('**') ||
        doc.content.includes('###')
      
      if (hasMarkdownInHtml) {
        console.log(`📝 Fixing: ${doc.title} (ID: ${doc.id})`)
        console.log(`   Slug: ${doc.slug}`)
        
        // Convert HTML to Markdown
        const markdownContent = htmlToMarkdown(doc.content)
        
        // Update database
        await client.query(
          `UPDATE k12_documents 
           SET content = $1, content_format = 'markdown'
           WHERE id = $2`,
          [markdownContent, doc.id]
        )
        
        fixedCount++
        console.log(`   ✅ Converted to Markdown\n`)
      }
    }
    
    await client.query('COMMIT')
    
    console.log(`\n✨ Fixed ${fixedCount} documents`)
    console.log(`   Changed content_format from 'html' to 'markdown'`)
    console.log(`   Removed HTML wrappers and kept Markdown syntax`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixHtmlWithMarkdown().catch(console.error)
