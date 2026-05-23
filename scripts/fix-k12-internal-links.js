/**
 * Script để sửa tất cả internal links trong k12_documents
 * Run: node scripts/fix-k12-internal-links.js
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

// Normalize path để so sánh
function normalizePath(path) {
  return path
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.md$/i, '')
    .replace(/\s+/g, '-')
}

// Extract slug từ URL
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

  // Relative path
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    return normalizePath(url)
  }

  return null
}

// Tìm slug thực tế gần nhất
function findBestMatch(extractedPath, allSlugs) {
  const normalizedExtracted = normalizePath(extractedPath)
  
  // 1. Exact match
  const exactMatch = allSlugs.find(slug => normalizePath(slug) === normalizedExtracted)
  if (exactMatch) return exactMatch

  // 2. Ends with match
  const endsWithMatch = allSlugs.find(slug => {
    const normalizedSlug = normalizePath(slug)
    return normalizedSlug.endsWith(normalizedExtracted) || normalizedExtracted.endsWith(normalizedSlug)
  })
  if (endsWithMatch) return endsWithMatch

  // 3. Contains last segment
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

async function fixInternalLinks() {
  const client = await pool.connect()
  
  try {
    console.log('🔍 Fetching all documents...')
    
    const result = await client.query(
      'SELECT id, slug, content FROM k12_documents ORDER BY id'
    )
    
    const documents = result.rows
    console.log(`📚 Found ${documents.length} documents`)
    
    const allSlugs = documents.map(doc => doc.slug)
    const slugMapping = {}
    let totalLinksFound = 0
    let totalLinksMapped = 0
    
    console.log('\n🔗 Analyzing links...')
    
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    
    for (const doc of documents) {
      const linksInDoc = []
      let match
      
      while ((match = linkRegex.exec(doc.content)) !== null) {
        linksInDoc.push(match[2])
      }
      
      if (linksInDoc.length > 0) {
        totalLinksFound += linksInDoc.length
        
        for (const url of linksInDoc) {
          const extractedPath = extractSlugFromUrl(url)
          if (!extractedPath) continue
          
          const bestMatch = findBestMatch(extractedPath, allSlugs)
          if (bestMatch && !slugMapping[url]) {
            slugMapping[url] = bestMatch
            totalLinksMapped++
          }
        }
      }
    }
    
    console.log(`\n📊 Statistics:`)
    console.log(`   Total links found: ${totalLinksFound}`)
    console.log(`   Links mapped: ${totalLinksMapped}`)
    console.log(`   Unique mappings: ${Object.keys(slugMapping).length}`)
    
    if (Object.keys(slugMapping).length === 0) {
      console.log('\n✅ No links need fixing!')
      return
    }
    
    console.log('\n📝 Sample mappings:')
    Object.entries(slugMapping).slice(0, 10).forEach(([oldUrl, newSlug]) => {
      console.log(`   ${oldUrl}`)
      console.log(`   → ${newSlug}`)
    })
    
    console.log('\n⚠️  This will update content in database.')
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    console.log('\n🔧 Updating documents...')
    let updatedCount = 0
    
    await client.query('BEGIN')
    
    for (const doc of documents) {
      let newContent = doc.content
      let hasChanges = false
      
      for (const [oldUrl, newSlug] of Object.entries(slugMapping)) {
        // Escape special regex characters
        const escapedUrl = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const oldPattern = new RegExp(`\\[([^\\]]+)\\]\\(${escapedUrl}\\)`, 'g')
        const newUrl = `/user/quy-trinh-quy-dinh?doc=${encodeURIComponent(newSlug)}`
        
        if (oldPattern.test(newContent)) {
          newContent = newContent.replace(oldPattern, `[$1](${newUrl})`)
          hasChanges = true
        }
      }
      
      if (hasChanges) {
        await client.query(
          'UPDATE k12_documents SET content = $1, updated_at = NOW() WHERE id = $2',
          [newContent, doc.id]
        )
        updatedCount++
        console.log(`   ✓ Updated document #${doc.id}: ${doc.slug}`)
      }
    }
    
    await client.query('COMMIT')
    
    console.log(`\n✅ Successfully updated ${updatedCount} documents!`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Run
fixInternalLinks()
  .then(() => {
    console.log('\n🎉 Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error)
    process.exit(1)
  })
