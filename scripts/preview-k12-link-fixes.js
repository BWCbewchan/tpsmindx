/**
 * Preview script - Xem trước các thay đổi mà KHÔNG update database
 * Run: node scripts/preview-k12-link-fixes.js
 */

require('dotenv').config()
const { Pool } = require('pg')

// Sử dụng Supabase credentials từ .env
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
})

function normalizePath(path) {
  return path
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.md$/i, '')
    .replace(/\s+/g, '-')
}

function extractSlugFromUrl(url) {
  const patterns = [
    /^\/quy-trinh-quy-dinh-danh-cho-giao-vien\/(.+)$/,
    /^quy-trinh-quy-dinh-danh-cho-giao-vien\/(.+)$/,
    /cxohok12\.gitbook\.io\/quy-trinh-quy-dinh-danh-cho-giao-vien\/(.+)$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return normalizePath(match[1])
    }
  }

  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    return normalizePath(url)
  }

  return null
}

function findBestMatch(extractedPath, allSlugs) {
  const normalizedExtracted = normalizePath(extractedPath)
  
  const exactMatch = allSlugs.find(slug => normalizePath(slug) === normalizedExtracted)
  if (exactMatch) return exactMatch

  const endsWithMatch = allSlugs.find(slug => {
    const normalizedSlug = normalizePath(slug)
    return normalizedSlug.endsWith(normalizedExtracted) || normalizedExtracted.endsWith(normalizedSlug)
  })
  if (endsWithMatch) return endsWithMatch

  const extractedSegments = normalizedExtracted.split('/').filter(Boolean)
  const lastSegment = extractedSegments[extractedSegments.length - 1]
  
  if (lastSegment) {
    const containsLastSegment = allSlugs.find(slug => {
      const normalizedSlug = normalizePath(slug)
      return normalizedSlug.includes(lastSegment)
    })
    if (containsLastSegment) return containsLastSegment
  }

  return null
}

async function previewFixes() {
  const client = await pool.connect()
  
  try {
    console.log('🔍 Fetching all documents...')
    
    const result = await client.query(
      'SELECT id, slug, title, content FROM k12_documents ORDER BY id'
    )
    
    const documents = result.rows
    console.log(`📚 Found ${documents.length} documents\n`)
    
    const allSlugs = documents.map(doc => doc.slug)
    const slugMapping = {}
    const documentChanges = []
    
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    
    for (const doc of documents) {
      const linksInDoc = []
      let match
      
      while ((match = linkRegex.exec(doc.content)) !== null) {
        linksInDoc.push({ text: match[1], url: match[2] })
      }
      
      const changes = []
      
      for (const link of linksInDoc) {
        const extractedPath = extractSlugFromUrl(link.url)
        if (!extractedPath) continue
        
        const bestMatch = findBestMatch(extractedPath, allSlugs)
        if (bestMatch && !slugMapping[link.url]) {
          slugMapping[link.url] = bestMatch
          changes.push({
            text: link.text,
            oldUrl: link.url,
            newSlug: bestMatch
          })
        }
      }
      
      if (changes.length > 0) {
        documentChanges.push({
          id: doc.id,
          slug: doc.slug,
          title: doc.title,
          changes
        })
      }
    }
    
    console.log(`📊 Summary:`)
    console.log(`   Documents with changes: ${documentChanges.length}`)
    console.log(`   Total link fixes: ${Object.keys(slugMapping).length}\n`)
    
    if (documentChanges.length === 0) {
      console.log('✅ No links need fixing!')
      return
    }
    
    console.log('📝 Detailed changes:\n')
    console.log('='.repeat(80))
    
    for (const doc of documentChanges) {
      console.log(`\n📄 Document #${doc.id}: ${doc.title}`)
      console.log(`   Slug: ${doc.slug}`)
      console.log(`   Changes: ${doc.changes.length}\n`)
      
      for (const change of doc.changes) {
        console.log(`   Link text: "${change.text}"`)
        console.log(`   OLD: ${change.oldUrl}`)
        console.log(`   NEW: /user/quy-trinh-quy-dinh?doc=${encodeURIComponent(change.newSlug)}`)
        console.log()
      }
      
      console.log('-'.repeat(80))
    }
    
    console.log(`\n✅ Preview complete!`)
    console.log(`\nTo apply these changes, run:`)
    console.log(`   node scripts/fix-k12-internal-links.js`)
    
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

previewFixes()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error)
    process.exit(1)
  })
