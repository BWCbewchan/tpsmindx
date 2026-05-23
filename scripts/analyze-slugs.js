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

async function analyzeSlugs() {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'SELECT id, slug, title, relative_path FROM k12_documents ORDER BY slug'
    )
    
    console.log('📊 Analyzing slugs...\n')
    
    const issues = []
    
    for (const doc of result.rows) {
      const slug = doc.slug
      const segments = slug.split('/')
      
      // Check for duplicate segments
      const hasDuplicate = segments.some((seg, idx) => {
        return segments.slice(idx + 1).some(otherSeg => 
          otherSeg.includes(seg) && seg.length > 3
        )
      })
      
      // Check for very long segments
      const hasLongSegment = segments.some(seg => seg.length > 50)
      
      // Check for concatenated segments (no dashes)
      const hasConcatenated = segments.some(seg => 
        seg.length > 30 && !seg.includes('-')
      )
      
      if (hasDuplicate || hasLongSegment || hasConcatenated) {
        issues.push({
          id: doc.id,
          slug: doc.slug,
          title: doc.title,
          relativePath: doc.relative_path,
          problems: [
            hasDuplicate && 'Duplicate segments',
            hasLongSegment && 'Very long segment',
            hasConcatenated && 'Concatenated segment'
          ].filter(Boolean)
        })
      }
    }
    
    console.log(`Found ${issues.length} problematic slugs:\n`)
    
    issues.forEach(issue => {
      console.log(`ID: ${issue.id}`)
      console.log(`Title: ${issue.title}`)
      console.log(`Slug: ${issue.slug}`)
      console.log(`Relative Path: ${issue.relativePath}`)
      console.log(`Problems: ${issue.problems.join(', ')}`)
      console.log('---\n')
    })
    
    // Suggest fixes
    console.log('\n💡 Suggested fixes:\n')
    
    issues.forEach(issue => {
      const segments = issue.slug.split('/')
      const cleanedSegments = []
      
      for (const seg of segments) {
        // Skip if this segment is already included in previous segments
        const isDuplicate = cleanedSegments.some(prev => 
          seg.includes(prev) || prev.includes(seg)
        )
        
        if (!isDuplicate) {
          cleanedSegments.push(seg)
        }
      }
      
      const suggestedSlug = cleanedSegments.join('/')
      
      if (suggestedSlug !== issue.slug) {
        console.log(`ID ${issue.id}:`)
        console.log(`  OLD: ${issue.slug}`)
        console.log(`  NEW: ${suggestedSlug}`)
        console.log()
      }
    })
    
  } finally {
    client.release()
    await pool.end()
  }
}

analyzeSlugs().catch(console.error)
