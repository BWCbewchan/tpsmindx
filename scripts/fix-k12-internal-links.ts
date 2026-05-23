/**
 * Script để sửa tất cả internal links trong k12_documents
 * 
 * Vấn đề: Links từ GitBook có dạng:
 *   /quy-trinh-quy-dinh-danh-cho-giao-vien/i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc
 * 
 * Nhưng slug thực tế trong database là:
 *   i.-tong-quan/thong-tin-san-pham/i-tong-quanthong-tin-san-phamdo-tuoi-tham-gia-khoa-hoc
 * 
 * Script này sẽ:
 * 1. Tìm tất cả links trong content
 * 2. Map sang slug thực tế trong database
 * 3. Update content với links đã fix
 */

import pool from '../lib/db'

interface Document {
  id: number
  slug: string
  content: string
}

interface SlugMapping {
  [key: string]: string // old path -> actual slug
}

// Normalize path để so sánh
function normalizePath(path: string): string {
  return path
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
    .replace(/\.md$/i, '') // Remove .md extension
    .replace(/\s+/g, '-') // Replace spaces with dashes
}

// Extract slug từ URL
function extractSlugFromUrl(url: string): string | null {
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
function findBestMatch(extractedPath: string, allSlugs: string[]): string | null {
  const normalizedExtracted = normalizePath(extractedPath)
  
  // 1. Exact match
  const exactMatch = allSlugs.find(slug => normalizePath(slug) === normalizedExtracted)
  if (exactMatch) return exactMatch

  // 2. Ends with match (slug có thể có prefix từ parent folders)
  const endsWithMatch = allSlugs.find(slug => {
    const normalizedSlug = normalizePath(slug)
    return normalizedSlug.endsWith(normalizedExtracted) || normalizedExtracted.endsWith(normalizedSlug)
  })
  if (endsWithMatch) return endsWithMatch

  // 3. Contains all segments
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
    
    // Lấy tất cả documents
    const result = await client.query<Document>(
      'SELECT id, slug, content FROM k12_documents ORDER BY id'
    )
    
    const documents = result.rows
    console.log(`📚 Found ${documents.length} documents`)
    
    // Tạo danh sách tất cả slugs
    const allSlugs = documents.map(doc => doc.slug)
    
    // Build slug mapping
    const slugMapping: SlugMapping = {}
    let totalLinksFound = 0
    let totalLinksMapped = 0
    
    console.log('\n🔗 Analyzing links...')
    
    // Tìm tất cả links trong content
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    
    for (const doc of documents) {
      let match: RegExpExecArray | null
      const linksInDoc: string[] = []
      
      while ((match = linkRegex.exec(doc.content)) !== null) {
        const url = match[2]
        linksInDoc.push(url)
      }
      
      if (linksInDoc.length > 0) {
        totalLinksFound += linksInDoc.length
        
        for (const url of linksInDoc) {
          const extractedPath = extractSlugFromUrl(url)
          if (!extractedPath) continue
          
          const bestMatch = findBestMatch(extractedPath, allSlugs)
          if (bestMatch) {
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
    Object.entries(slugMapping).slice(0, 5).forEach(([oldUrl, newSlug]) => {
      console.log(`   ${oldUrl}`)
      console.log(`   → ${newSlug}`)
    })
    
    // Ask for confirmation
    console.log('\n⚠️  This will update content in database.')
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    console.log('\n🔧 Updating documents...')
    let updatedCount = 0
    
    await client.query('BEGIN')
    
    for (const doc of documents) {
      let newContent = doc.content
      let hasChanges = false
      
      // Replace all mapped links
      for (const [oldUrl, newSlug] of Object.entries(slugMapping)) {
        const oldPattern = new RegExp(`\\[([^\\]]+)\\]\\(${oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g')
        const newUrl = `/user/quy-trinh-quy-dinh?doc=${encodeURIComponent(newSlug)}`
        const replacement = `[$1](${newUrl})`
        
        if (oldPattern.test(newContent)) {
          newContent = newContent.replace(oldPattern, replacement)
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
  }
}

// Run the script
fixInternalLinks()
  .then(() => {
    console.log('\n🎉 Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error)
    process.exit(1)
  })
