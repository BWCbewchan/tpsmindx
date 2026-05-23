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

async function fixDuplicateSlugs() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    console.log('🔧 Fixing duplicate slugs...\n')
    
    // Fix ID 70: Độ tuổi tham gia khoá học
    const oldSlug70 = 'i.-tong-quan/thong-tin-san-pham/i-tong-quanthong-tin-san-phamdo-tuoi-tham-gia-khoa-hoc'
    const newSlug70 = 'i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc'
    const newPath70 = 'i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc.md'
    
    await client.query(
      'UPDATE k12_documents SET slug = $1, relative_path = $2 WHERE id = 70',
      [newSlug70, newPath70]
    )
    
    console.log(`✅ Fixed ID 70:`)
    console.log(`   OLD: ${oldSlug70}`)
    console.log(`   NEW: ${newSlug70}\n`)
    
    // Fix ID 105: Quy trình thực hiện kiểm tra Checkpoint
    const oldSlug105 = 'vi.-quy-trinh-van-hanh-lop-hoc/quy-trinh-mot-buoi-giang-day/vi-quy-trinh-van-hanh-lop-hocquy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise'
    const newSlug105 = 'vi.-quy-trinh-van-hanh-lop-hoc/quy-trinh-mot-buoi-giang-day/quy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise'
    const newPath105 = 'vi.-quy-trinh-van-hanh-lop-hoc/quy-trinh-mot-buoi-giang-day/quy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise.md'
    
    await client.query(
      'UPDATE k12_documents SET slug = $1, relative_path = $2 WHERE id = 105',
      [newSlug105, newPath105]
    )
    
    console.log(`✅ Fixed ID 105:`)
    console.log(`   OLD: ${oldSlug105}`)
    console.log(`   NEW: ${newSlug105}\n`)
    
    // Now fix all internal links that reference the old slug
    console.log('🔗 Fixing internal links...\n')
    
    const allDocs = await client.query('SELECT id, title, content FROM k12_documents')
    
    let linksFixed = 0
    
    for (const doc of allDocs.rows) {
      let content = doc.content
      let modified = false
      
      // Fix links to ID 70
      const oldLinkPattern70 = /i-tong-quanthong-tin-san-phamdo-tuoi-tham-gia-khoa-hoc/g
      if (content.match(oldLinkPattern70)) {
        content = content.replace(oldLinkPattern70, 'do-tuoi-tham-gia-khoa-hoc')
        modified = true
        linksFixed++
      }
      
      // Fix links to ID 105
      const oldLinkPattern105 = /vi-quy-trinh-van-hanh-lop-hocquy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise/g
      if (content.match(oldLinkPattern105)) {
        content = content.replace(oldLinkPattern105, 'quy-trinh-thuc-hien-kiem-tra-checkpoint-tren-lms-va-denise')
        modified = true
        linksFixed++
      }
      
      if (modified) {
        await client.query(
          'UPDATE k12_documents SET content = $1 WHERE id = $2',
          [content, doc.id]
        )
        console.log(`   ✅ Updated links in: ${doc.title} (ID: ${doc.id})`)
      }
    }
    
    await client.query('COMMIT')
    
    console.log(`\n✨ Done!`)
    console.log(`   - Fixed 2 duplicate slugs`)
    console.log(`   - Updated ${linksFixed} internal links`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixDuplicateSlugs().catch(console.error)
