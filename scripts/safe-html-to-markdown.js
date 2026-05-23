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
 * Safely convert HTML-wrapped Markdown to pure Markdown
 * This version is more careful to preserve content integrity
 */
function safeHtmlToMarkdown(html) {
  let content = html
  
  // Step 1: Convert <img> tags to Markdown FIRST (before removing <p> tags)
  content = content.replace(
    /<img[^>]*class="tiptap-image"[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi,
    '\n\n![$ 2]($1)\n\n'
  )
  
  content = content.replace(
    /<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi,
    '\n\n![$2]($1)\n\n'
  )
  
  content = content.replace(
    /<img[^>]*src="([^"]+)"[^>]*>/gi,
    '\n\n![image]($1)\n\n'
  )
  
  // Step 2: Replace </p> with double newline
  content = content.replace(/<\/p>/gi, '\n\n')
  
  // Step 3: Remove opening <p> tags
  content = content.replace(/<p[^>]*>/gi, '')
  
  // Step 4: Remove any other HTML tags
  content = content.replace(/<[^>]+>/g, '')
  
  // Step 5: Decode HTML entities
  content = content
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  
  // Step 6: Clean up whitespace but preserve structure
  // Remove trailing spaces
  content = content.replace(/ +$/gm, '')
  
  // Normalize multiple blank lines to max 2
  content = content.replace(/\n{4,}/g, '\n\n\n')
  
  // Trim start and end
  content = content.trim()
  
  return content
}

async function testConversion() {
  const client = await pool.connect()
  try {
    console.log('🧪 Testing HTML to Markdown conversion on document 63...\n')
    
    // Get the document
    const result = await client.query(
      'SELECT id, slug, title, content, content_format FROM k12_documents WHERE id = $1',
      [63]
    )
    
    if (result.rows.length === 0) {
      console.log('Document not found')
      return
    }
    
    const doc = result.rows[0]
    console.log(`Document: ${doc.title}`)
    console.log(`Current format: ${doc.content_format}`)
    console.log(`\nOriginal content (first 500 chars):`)
    console.log(doc.content.substring(0, 500))
    console.log('\n---\n')
    
    const converted = safeHtmlToMarkdown(doc.content)
    
    console.log(`Converted content (first 800 chars):`)
    console.log(converted.substring(0, 800))
    console.log('\n---\n')
    
    console.log('Does this look correct? (Check the output above)')
    console.log('\nIf it looks good, the content will be saved to database.')
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...')
    
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Update the document
    await client.query('BEGIN')
    await client.query(
      'UPDATE k12_documents SET content = $1, content_format = $2 WHERE id = $3',
      [converted, 'markdown', doc.id]
    )
    await client.query('COMMIT')
    
    console.log('\n✅ Document updated successfully!')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

testConversion().catch(console.error)
