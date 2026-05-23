require('dotenv').config()
const { Client } = require('pg')

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    const centersRes = await client.query(
      `SELECT full_name, display_name, short_code FROM centers`,
    )
    const leadersRes = await client.query(
      `SELECT code, full_name, center, area, areas FROM teaching_leaders ORDER BY full_name`,
    )

    const keySet = new Set()
    for (const c of centersRes.rows) {
      ;[c.full_name, c.display_name, c.short_code].forEach((v) => {
        const k = normalizeKey(v)
        if (k) keySet.add(k)
      })
    }

    const unmatched = leadersRes.rows.filter((l) => {
      const k = normalizeKey(l.center)
      if (!k) return true
      return !keySet.has(k)
    })

    console.log('UNMATCHED_LEADER_CENTERS')
    console.log(
      JSON.stringify({ total: unmatched.length, rows: unmatched }, null, 2),
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('check_unmatched_leader_centers failed:', error)
  process.exit(1)
})
