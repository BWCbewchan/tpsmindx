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

async function verifyLinks() {
  const client = await pool.connect()
  try {
    console.log('🔍 Verifying K12 document links...\n')
    
    // Get all documents
    const result = await client.query(
      'SELECT id, slug, title, content FROM k12_documents ORDER BY id'
    )
    
    const documents = result.rows
    const allSlugs = new Set(documents.map(doc => doc.slug))
    
    let totalLinks = 0
    let brokenLinks = 0
    const brokenLinkDetails = []
    
    for (const doc of documents) {
      const linkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g
      let match
      
      while ((match = linkRegex.exec(doc.content)) !== null) {
        const linkText = match[1]
        const href = match[2]
        
        // Skip external links
        if (href.startsWith('http://') || href.startsWith('https://')) {
          // Check if it's a GitBook link that should be internal
          if (!href.includes('cxohok12.gitbook.io')) {
            continue
          }
        }
        
        totalLinks++
        
        // Extract the slug from the href
        let extractedSlug = href
          .replace(/^\/quy-trinh-quy-dinh-danh-cho-giao-vien\//, '')
          .replace(/^quy-trinh-quy-dinh-danh-cho-giao-vien\//, '')
          .replace(/^\//, '')
          .replace(/\.md$/i, '')
          .split('#')[0]
          .split('?')[0]
        
        // Check if this slug exists
        if (!allSlugs.has(extractedSlug)) {
          brokenLinks++
          brokenLinkDetails.push({
            sourceDoc: doc.title,
            sourceSlug: doc.slug,
            linkText,
            targetSlug: extractedSlug,
            originalHref: href
          })
        }
      }
    }
    
    console.log(`📊 Link Analysis Results:`)
    console.log(`   Total internal links: ${totalLinks}`)
    console.log(`   Working links: ${totalLinks - brokenLinks}`)
    console.log(`   Broken links: ${brokenLinks}\n`)
    
    if (brokenLinks > 0) {
      console.log('❌ Broken Links:\n')
      brokenLinkDetails.forEach((detail, index) => {
        console.log(`${index + 1}. In document: "${detail.sourceDoc}"`)
        console.log(`   Source slug: ${detail.sourceSlug}`)
        console.log(`   Link text: "${detail.linkText}"`)
        console.log(`   Target slug: ${detail.targetSlug}`)
        console.log(`   Original href: ${detail.originalHref}`)
        console.log()
      })
    } else {
      console.log('✅ All internal links are working correctly!')
    }
    
    // Verify the specific links mentioned in the context
    console.log('\n🎯 Verifying specific links from context:\n')
    
    const specificChecks = [
      {
        name: 'Độ tuổi tham gia khoá học',
        slug: 'i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc'
      },
      {
        name: 'Thông tin sản phẩm (parent)',
        slug: 'i.-tong-quan/thong-tin-san-pham'
      },
      {
        name: 'Các mô hình học',
        slug: 'i.-tong-quan/thong-tin-san-pham/cac-mo-hinh-hoc'
      }
    ]
    
    for (const check of specificChecks) {
      const exists = allSlugs.has(check.slug)
      console.log(`${exists ? '✅' : '❌'} ${check.name}`)
      console.log(`   Slug: ${check.slug}`)
      console.log(`   URL: /user/quy-trinh-quy-dinh?doc=${encodeURIComponent(check.slug)}`)
      console.log()
    }
    
  } finally {
    client.release()
    await pool.end()
  }
}

verifyLinks().catch(console.error)
