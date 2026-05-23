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

async function fixSlugs() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    console.log('🔧 Fixing problematic slugs...\n')
    
    // Fix ID 70: Độ tuổi tham gia khoá học
    // OLD: i.-tong-quan/thong-tin-san-pham/i-tong-quanthong-tin-san-phamdo-tuoi-tham-gia-khoa-hoc
    // NEW: i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc
    const fix70 = {
      id: 70,
      oldSlug: 'i.-tong-quan/thong-tin-san-pham/i-tong-quanthong-tin-san-phamdo-tuoi-tham-gia-khoa-hoc',
      newSlug: 'i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc',
      newRelativePath: 'i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc.md'
    }
    
    await client.query(
      'UPDATE k12_documents SET slug = $1, relative_path = $2 WHERE id = $3',
      [fix70.newSlug, fix70.newRelativePath, fix70.id]
    )
    
    console.log(`✅ Fixed ID ${fix70.id}:`)
    console.log(`   OLD: ${fix70.oldSlug}`)
    console.log(`   NEW: ${fix70.newSlug}\n`)
    
    // Fix ID 105: Quy trình thực hiện kiểm tra Checkpoint trên LMS và Denise
    // OLD: vi.-quy-trinh-van-hanh-lop-hoc/quy-trinh-mot-buoi-giang-day/vi-quy-trinh-van-hanh-lop-hocquy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise
    // NEW: vi.-quy-trinh-van-hanh-lop-hoc/quy-trinh-mot-buoi-giang-day/quy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise
    const fix105 = {
      id: 105,
      oldSlug: 'vi.-quy-trinh-van-hanh-lop-hoc/quy-trinh-mot-buoi-giang-day/vi-quy-trinh-van-hanh-lop-hocquy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise',
      newSlug: 'vi.-quy-trinh-van-hanh-lop-hoc/quy-trinh-mot-buoi-giang-day/quy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise',
      newRelativePath: 'vi.-quy-trinh-van-hanh-lop-hoc/quy-trinh-mot-buoi-giang-day/quy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise.md'
    }
    
    await client.query(
      'UPDATE k12_documents SET slug = $1, relative_path = $2 WHERE id = $3',
      [fix105.newSlug, fix105.newRelativePath, fix105.id]
    )
    
    console.log(`✅ Fixed ID ${fix105.id}:`)
    console.log(`   OLD: ${fix105.oldSlug}`)
    console.log(`   NEW: ${fix105.newSlug}\n`)
    
    // Now fix all internal links in content that reference the old slugs
    console.log('🔗 Fixing internal links in content...\n')
    
    // Get all documents
    const allDocs = await client.query('SELECT id, content FROM k12_documents')
    
    let linksFixed = 0
    
    for (const doc of allDocs.rows) {
      let content = doc.content
      let modified = false
      
      // Fix links to ID 70
      const oldLink70Pattern = /do-tuoi-tham-gia-khoa-hoc/g
      if (content.includes('do-tuoi-tham-gia-khoa-hoc')) {
        // This is already correct, but we need to check if there are any references to the old concatenated path
        const oldConcatenatedPattern = /i-tong-quanthong-tin-san-phamdo-tuoi-tham-gia-khoa-hoc/g
        if (content.match(oldConcatenatedPattern)) {
          content = content.replace(oldConcatenatedPattern, 'do-tuoi-tham-gia-khoa-hoc')
          modified = true
          linksFixed++
        }
      }
      
      // Fix links to ID 105
      const oldLink105Pattern = /vi-quy-trinh-van-hanh-lop-hocquy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise/g
      if (content.match(oldLink105Pattern)) {
        content = content.replace(oldLink105Pattern, 'quy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise')
        modified = true
        linksFixed++
      }
      
      if (modified) {
        await client.query(
          'UPDATE k12_documents SET content = $1 WHERE id = $2',
          [content, doc.id]
        )
        console.log(`   Updated links in document ID ${doc.id}`)
      }
    }
    
    console.log(`\n✅ Fixed ${linksFixed} internal links\n`)
    
    await client.query('COMMIT')
    
    console.log('✨ All slugs and links have been fixed successfully!\n')
    console.log('Summary:')
    console.log('- Fixed 2 problematic slugs (ID 70, 105)')
    console.log(`- Updated ${linksFixed} internal links`)
    console.log('\nThe other long slugs (ID 56, 78, 84, 86, 102) are acceptable as they are descriptive and not concatenated.')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error fixing slugs:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixSlugs().catch(console.error)
