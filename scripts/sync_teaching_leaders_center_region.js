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

function getAreasFromLeader(leader) {
  if (Array.isArray(leader.areas)) {
    return leader.areas.map((x) => String(x || '').trim()).filter(Boolean)
  }
  if (typeof leader.areas === 'string' && leader.areas.trim()) {
    try {
      const parsed = JSON.parse(leader.areas)
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x || '').trim()).filter(Boolean)
      }
    } catch {}
  }
  const area = String(leader.area || '').trim()
  if (!area) return []
  return area
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function uniqueAreas(values) {
  return Array.from(
    new Set(values.map((x) => String(x || '').trim()).filter(Boolean)),
  )
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
    const hasAreasRes = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'teaching_leaders'
        AND column_name = 'areas'
      LIMIT 1
    `)
    const hasAreas = (hasAreasRes.rowCount || 0) > 0

    const centersRes = await client.query(`
      SELECT id, full_name, display_name, short_code, region
      FROM centers
    `)
    const leadersRes = await client.query(`
      SELECT code, center, area, areas
      FROM teaching_leaders
    `)

    const centers = centersRes.rows
    const leaders = leadersRes.rows

    const centerByKey = new Map()
    for (const c of centers) {
      const keys = [c.full_name, c.display_name, c.short_code]
      for (const k of keys) {
        const key = normalizeKey(k)
        if (!key || centerByKey.has(key)) continue
        centerByKey.set(key, c)
      }
    }

    let centerMatched = 0
    let centerRenamed = 0
    let regionApplied = 0
    let updatedRows = 0
    let unmatchedCenter = 0

    await client.query('BEGIN')

    for (const leader of leaders) {
      const currentCenter = String(leader.center || '').trim()
      const centerKey = normalizeKey(currentCenter)
      const matchedCenter = centerKey ? centerByKey.get(centerKey) : null

      let nextCenter = currentCenter
      let nextAreas = getAreasFromLeader(leader)

      if (matchedCenter) {
        centerMatched += 1
        if (
          String(matchedCenter.full_name || '').trim() &&
          String(matchedCenter.full_name).trim() !== currentCenter
        ) {
          nextCenter = String(matchedCenter.full_name).trim()
          centerRenamed += 1
        }

        const region = String(matchedCenter.region || '').trim()
        if (region) {
          nextAreas = uniqueAreas([region, ...nextAreas])
          regionApplied += 1
        }
      } else if (currentCenter) {
        unmatchedCenter += 1
      }

      const nextPrimaryArea = nextAreas[0] || null
      const prevAreas = getAreasFromLeader(leader)
      const centerChanged = nextCenter !== currentCenter
      const primaryChanged =
        (String(leader.area || '').trim() || null) !== nextPrimaryArea
      const areasChanged =
        JSON.stringify(prevAreas) !== JSON.stringify(nextAreas)

      if (!centerChanged && !primaryChanged && !areasChanged) {
        continue
      }

      if (hasAreas) {
        await client.query(
          `UPDATE teaching_leaders
           SET center = $2,
               area = $3,
               areas = $4::jsonb
           WHERE code = $1`,
          [
            leader.code,
            nextCenter || null,
            nextPrimaryArea,
            JSON.stringify(nextAreas),
          ],
        )
      } else {
        await client.query(
          `UPDATE teaching_leaders
           SET center = $2,
               area = $3
           WHERE code = $1`,
          [leader.code, nextCenter || null, nextAreas.join(', ') || null],
        )
      }

      updatedRows += 1
    }

    await client.query('COMMIT')

    const statRes = await client.query(`
      SELECT
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE COALESCE(TRIM(center), '') <> '')::int AS rows_with_center,
        COUNT(*) FILTER (WHERE COALESCE(TRIM(area), '') <> '')::int AS rows_with_area
      FROM teaching_leaders
    `)

    console.log('SYNC_TEACHING_LEADERS_CENTER_REGION_OK')
    console.log(
      JSON.stringify(
        {
          centersTotal: centers.length,
          leadersTotal: leaders.length,
          centerMatched,
          centerRenamed,
          regionApplied,
          unmatchedCenter,
          updatedRows,
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
  console.error('sync_teaching_leaders_center_region failed:', error)
  process.exit(1)
})
