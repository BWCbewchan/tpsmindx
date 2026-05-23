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

async function updateConstraint() {
  const client = await pool.connect()
  try {
    console.log('🔧 Updating content_format constraint...\n')
    
    // Drop old constraint
    await client.query(`
      ALTER TABLE k12_documents 
      DROP CONSTRAINT IF EXISTS k12_documents_content_format_check
    `)
    console.log('✅ Dropped old constraint')
    
    // Add new constraint with markdown support
    await client.query(`
      ALTER TABLE k12_documents 
      ADD CONSTRAINT k12_documents_content_format_check 
      CHECK (content_format IN ('html', 'json', 'markdown'))
    `)
    console.log('✅ Added new constraint with markdown support')
    
    console.log('\n✨ Constraint updated successfully!')
    console.log('   Allowed values: html, json, markdown')
    
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

updateConstraint().catch(console.error)
