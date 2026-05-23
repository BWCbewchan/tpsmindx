require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function parseCsvLine(line) {
  const cells = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }

  cells.push(cur)
  return cells
}

function toAsciiKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function toCodeFromEmail(email) {
  return String(email || '')
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

async function ensureEmailColumn(client) {
  await client.query(`
    ALTER TABLE teaching_leaders
      ADD COLUMN IF NOT EXISTS email VARCHAR(255)
  `)
}

function parseCsvMappings(csvText) {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/)
  const byCode = new Map()
  const byName = new Map()
  let inData = false

  for (const line of lines) {
    if (!line || !line.trim()) continue
    const row = parseCsvLine(line).map((c) => String(c || '').trim())

    if (!inData) {
      if (toAsciiKey(row[0]) === 'khu vuc phu trach') {
        inData = true
      }
      continue
    }

    const fullName = row[1] || ''
    const position = row[2] || ''
    const rawEmail = row[4] || ''
    const email = String(rawEmail).trim().toLowerCase()

    if (!fullName || !position || !isValidEmail(email)) continue
    if (toAsciiKey(fullName).includes('ngung hoat dong')) continue

    const code = toCodeFromEmail(email)
    const nameKey = toAsciiKey(fullName)

    if (code) {
      byCode.set(code, email)
    }
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, email)
    }
  }

  return { byCode, byName }
}

async function main() {
  const csvPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve('c:/Users/ADMIN/Downloads/draf - Trang tính1.csv')

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  const raw = fs.readFileSync(csvPath, 'utf8')
  const mappings = parseCsvMappings(raw)

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
    await ensureEmailColumn(client)

    const leadersRes = await client.query(
      `SELECT code, full_name, email
       FROM teaching_leaders`,
    )

    let matchedByCode = 0
    let matchedByName = 0
    let unchanged = 0
    let updated = 0
    let notFound = 0

    await client.query('BEGIN')

    for (const leader of leadersRes.rows) {
      const code = String(leader.code || '')
        .trim()
        .toLowerCase()
      const nameKey = toAsciiKey(leader.full_name)
      const currentEmail = String(leader.email || '')
        .trim()
        .toLowerCase()

      let targetEmail = mappings.byCode.get(code)
      if (targetEmail) {
        matchedByCode += 1
      } else if (nameKey) {
        targetEmail = mappings.byName.get(nameKey)
        if (targetEmail) matchedByName += 1
      }

      if (!targetEmail) {
        notFound += 1
        continue
      }

      if (currentEmail === targetEmail) {
        unchanged += 1
        continue
      }

      await client.query(
        `UPDATE teaching_leaders
         SET email = $1
         WHERE code = $2`,
        [targetEmail, leader.code],
      )
      updated += 1
    }

    await client.query('COMMIT')

    const statRes = await client.query(`
      SELECT
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE COALESCE(TRIM(email), '') <> '')::int AS rows_with_email,
        COUNT(*) FILTER (WHERE COALESCE(TRIM(email), '') = '')::int AS rows_missing_email
      FROM teaching_leaders
    `)

    console.log('BACKFILL_TEACHING_LEADERS_EMAIL_OK')
    console.log(
      JSON.stringify(
        {
          csvPath,
          csvEmailByCode: mappings.byCode.size,
          csvEmailByName: mappings.byName.size,
          matchedByCode,
          matchedByName,
          updated,
          unchanged,
          notFound,
          stats: statRes.rows[0],
        },
        null,
        2,
      ),
    )
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('backfill_teaching_leaders_email_from_csv failed:', error)
  process.exit(1)
})
