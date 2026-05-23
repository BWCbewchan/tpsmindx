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

function normalizeAreaTokens(raw) {
  const key = toAsciiKey(raw)
  if (!key) return []

  if (key === 'toan he thong') return ['HO']
  if (key === 'group email') return []
  if (key === 'online') return ['ONLINE']
  if (key === 'hn') return ['HN']
  if (key === 'hn1') return ['HN 1']
  if (key === 'hn2') return ['HN 2']
  if (key === 'hcm hcm 1') return ['HCM 1']
  if (key === 'hcm hcm 2') return ['HCM 2']
  if (key === 'hcm hcm 3') return ['HCM 3']
  if (key === 'hcm hcm 4') return ['HCM 4']

  if (
    key.includes('hcm') &&
    key.includes('online') &&
    key.includes('tinh nam')
  ) {
    return ['HCM 1', 'HCM 2', 'HCM 3', 'HCM 4', 'ONLINE', 'TỈNH NAM']
  }

  if (key === 'tinh phia nam') return ['TỈNH NAM']
  if (key === 'tinh bac') return ['TỈNH BẮC']
  if (key === 'tinh trung') return ['TỈNH TRUNG']
  if (key === 'tinh bac trung') return ['TỈNH BẮC', 'TỈNH TRUNG']

  return []
}

function mapRoleCode(position) {
  const key = toAsciiKey(position)
  if (key === 'tm') return 'TM'
  if (key.includes('tegl')) return 'TEGL'
  if (key === 'coding leader') return 'CL'
  if (key === 'robotic leader') return 'RL'
  if (key === 'art leader') return 'AL'
  if (key === 'teacher coordinator') return 'TC'
  if (key === 'teaching executive') return 'TE'
  return 'LEAD'
}

function mapCourse(position) {
  const key = toAsciiKey(position)
  if (key === 'coding leader') return 'Coding'
  if (key === 'robotic leader') return 'Robotics'
  if (key === 'art leader') return 'X-Art'
  return null
}

function rolePriority(roleCode) {
  switch (roleCode) {
    case 'TM':
      return 100
    case 'TEGL':
      return 90
    case 'TC':
      return 70
    case 'CL':
    case 'RL':
    case 'AL':
      return 60
    case 'TE':
      return 50
    default:
      return 10
  }
}

async function hasAreasColumn(client) {
  const r = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'teaching_leaders'
       AND column_name = 'areas'
     LIMIT 1`,
  )
  return (r.rowCount || 0) > 0
}

async function ensureEmailColumn(client) {
  await client.query(`
    ALTER TABLE teaching_leaders
      ADD COLUMN IF NOT EXISTS email VARCHAR(255)
  `)
}

function resolveCenterName(rawCenter, centers) {
  const raw = String(rawCenter || '').trim()
  if (!raw) return null

  const rawKey = toAsciiKey(raw)
  if (!rawKey) return null

  let best = null
  let bestScore = -1

  for (const c of centers) {
    const fullKey = toAsciiKey(c.full_name)
    const displayKey = toAsciiKey(c.display_name)
    const shortKey = toAsciiKey(c.short_code)

    let score = -1
    if (rawKey === fullKey || rawKey === displayKey || rawKey === shortKey) {
      score = 100
    } else if (fullKey.includes(rawKey) || displayKey.includes(rawKey)) {
      score = 80
    } else if (rawKey.includes(fullKey) || rawKey.includes(displayKey)) {
      score = 70
    } else if (shortKey && rawKey.includes(shortKey)) {
      score = 60
    }

    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  if (best && bestScore >= 70) {
    return { fullName: best.full_name, region: best.region }
  }

  return { fullName: raw, region: null }
}

async function main() {
  const csvPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve('c:/Users/ADMIN/Downloads/draf - Trang tính1.csv')

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  const raw = fs.readFileSync(csvPath, 'utf8')
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/)

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

    const centersRes = await client.query(
      `SELECT full_name, display_name, short_code, region
       FROM centers
       WHERE status = 'Active'`,
    )
    const centers = centersRes.rows

    const people = new Map()
    let inData = false
    let currentAreas = []

    for (const line of lines) {
      if (!line || !line.trim()) continue
      const row = parseCsvLine(line).map((c) => String(c || '').trim())

      if (!inData) {
        if (toAsciiKey(row[0]) === 'khu vuc phu trach') {
          inData = true
        }
        continue
      }

      const scope = row[0] || ''
      const fullName = row[1] || ''
      const position = row[2] || ''
      const email = (row[4] || '').toLowerCase()

      if (!email || !position) continue
      if (toAsciiKey(fullName).includes('ngung hoat dong')) continue
      if (toAsciiKey(scope) === 'group email') continue

      const scopeAreas = normalizeAreaTokens(scope)
      if (scopeAreas.length > 0) {
        currentAreas = scopeAreas
      }

      const roleCode = mapRoleCode(position)
      const course = mapCourse(position)
      const centerMatch = resolveCenterName(scope, centers)

      let rowAreas = []
      if (scopeAreas.length > 0) {
        rowAreas = scopeAreas
      } else if (centerMatch && centerMatch.region) {
        rowAreas = [centerMatch.region]
      } else if (currentAreas.length > 0) {
        rowAreas = currentAreas
      }

      if (!people.has(email)) {
        people.set(email, {
          code: email
            .split('@')[0]
            .replace(/[^a-z0-9]/gi, '')
            .toLowerCase(),
          email,
          full_name: fullName,
          role_code: roleCode,
          role_name: position,
          courses: new Set(),
          centers: new Set(),
          areas: new Set(),
        })
      }

      const person = people.get(email)

      if (rolePriority(roleCode) > rolePriority(person.role_code)) {
        person.role_code = roleCode
        person.role_name = position
      }

      if (fullName && person.full_name !== fullName) {
        person.full_name = fullName
      }

      if (course) person.courses.add(course)
      if (centerMatch && centerMatch.fullName)
        person.centers.add(centerMatch.fullName)
      for (const a of rowAreas) {
        if (a) person.areas.add(a)
      }
    }

    const roleNameDefaults = {
      TM: 'Teaching Manager',
      TEGL: 'Teaching Executive Group Leader',
      CL: 'Coding Leader',
      RL: 'Robotic Leader',
      AL: 'Art Leader',
      TC: 'Teacher Coordinator',
      TE: 'Teaching Executive',
      LEAD: 'Leader',
    }

    const roleCodes = Array.from(
      new Set(Array.from(people.values()).map((p) => p.role_code)),
    )
    for (const code of roleCodes) {
      await client.query(
        `INSERT INTO roles (role_code, role_name, department, is_active)
         VALUES ($1, $2, 'Center', true)
         ON CONFLICT (role_code) DO NOTHING`,
        [code, roleNameDefaults[code] || code],
      )
    }

    await client.query('BEGIN')
    await client.query('DELETE FROM teaching_leaders')

    const useAreas = await hasAreasColumn(client)

    const finalRows = Array.from(people.values()).map((p) => {
      const areas = Array.from(p.areas)
      const centersList = Array.from(p.centers)
      const center =
        centersList[0] || (areas[0] === 'HO' ? 'HO' : 'MindX - Online')
      const courses = Array.from(p.courses).join(', ') || null
      return {
        code: p.code,
        email: p.email || null,
        full_name: p.full_name,
        role_code: p.role_code,
        role_name: p.role_name,
        center,
        courses,
        area: areas[0] || null,
        areas,
        status: 'Active',
      }
    })

    for (const row of finalRows) {
      if (useAreas) {
        await client.query(
          `INSERT INTO teaching_leaders
           (code, email, full_name, role_code, role_name, center, courses, area, areas, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
          [
            row.code,
            row.email,
            row.full_name,
            row.role_code,
            row.role_name,
            row.center,
            row.courses,
            row.area,
            JSON.stringify(row.areas),
            row.status,
          ],
        )
      } else {
        await client.query(
          `INSERT INTO teaching_leaders
           (code, email, full_name, role_code, role_name, center, courses, area, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            row.code,
            row.email,
            row.full_name,
            row.role_code,
            row.role_name,
            row.center,
            row.courses,
            row.areas.join(', '),
            row.status,
          ],
        )
      }
    }

    await client.query('COMMIT')

    console.log('RESET_OK')
    console.log(
      JSON.stringify(
        {
          csvPath,
          leadersInserted: finalRows.length,
          sample: finalRows.slice(0, 12),
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
  console.error('reset_leaders_from_csv failed:', error)
  process.exit(1)
})
