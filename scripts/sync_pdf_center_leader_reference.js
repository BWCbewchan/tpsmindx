require('dotenv').config()
const { Client } = require('pg')

const PDF_MAPPINGS = [
  {
    code: 'vuth',
    email: 'vuth@mindx.com.vn',
    fullName: 'Trần Huy Vũ',
    roleCode: 'TEGL',
    roleName: 'TEGL+',
    regions: ['HCM 1', 'HCM 2', 'HCM 3', 'HCM 4', 'ONLINE', 'TỈNH NAM'],
    areas: ['HCM 1', 'HCM 2', 'HCM 3', 'HCM 4', 'ONLINE', 'TỈNH NAM'],
  },
  {
    code: 'anhpnh',
    email: 'anhpnh@mindx.com.vn',
    fullName: 'Phan Ngọc Hoàng Anh',
    roleCode: 'TEGL',
    roleName: 'TEGL',
    regions: ['HCM 1', 'HCM 4'],
    areas: ['HCM 1', 'HCM 4'],
  },
  {
    code: 'soncq',
    email: 'soncq@mindx.com.vn',
    fullName: 'Cao Quang Sơn',
    roleCode: 'TEGL',
    roleName: 'TEGL',
    regions: ['HCM 2', 'HCM 3'],
    areas: ['HCM 2', 'HCM 3'],
  },
  {
    code: 'hunghv',
    email: 'hunghv@mindx.com.vn',
    fullName: 'Hoàng Việt Hùng',
    roleCode: 'TEGL',
    roleName: 'TEGL+',
    regions: ['HN 1', 'HN 2'],
    areas: ['HN 1', 'HN 2'],
  },
]

async function hasAreasColumn(client) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'teaching_leaders'
       AND column_name = 'areas'
     LIMIT 1`,
  )
  return result.rowCount > 0
}

async function upsertAppUser(client, mapping) {
  const username = mapping.email.split('@')[0].toLowerCase()
  const result = await client.query(
    `INSERT INTO app_users (
       email,
       username,
       password_hash,
       display_name,
       role,
       auth_type,
       is_active,
       created_by
     )
     VALUES ($1, $2, NULL, $3, 'manager', 'firebase', true, 'pdf-sync')
     ON CONFLICT (email)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       role = 'manager',
       auth_type = COALESCE(app_users.auth_type, EXCLUDED.auth_type),
       is_active = true,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [mapping.email.toLowerCase(), username, mapping.fullName],
  )
  return result.rows[0].id
}

async function pickPrimaryCenter(client, mapping) {
  const result = await client.query(
    `SELECT id, full_name, region
     FROM centers
     WHERE status = 'Active'
       AND region = ANY($1::text[])
     ORDER BY CASE WHEN region = $2 THEN 0 ELSE 1 END, full_name
     LIMIT 1`,
    [mapping.regions, mapping.regions[0] || ''],
  )
  return result.rows[0] || null
}

async function upsertTeachingLeader(
  client,
  mapping,
  centerFullName,
  canUseAreas,
) {
  if (canUseAreas) {
    await client.query(
      `INSERT INTO teaching_leaders (
         code,
         full_name,
         role_code,
         role_name,
         center,
         courses,
         area,
         areas,
         status
       )
       VALUES ($1, $2, $3, $4, $5, NULL, $6, $7::jsonb, 'Active')
       ON CONFLICT (code)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role_code = EXCLUDED.role_code,
         role_name = EXCLUDED.role_name,
         center = EXCLUDED.center,
         area = EXCLUDED.area,
         areas = EXCLUDED.areas,
         status = 'Active',
         updated_at = CURRENT_TIMESTAMP`,
      [
        mapping.code,
        mapping.fullName,
        mapping.roleCode,
        mapping.roleName,
        centerFullName,
        mapping.areas[0] || null,
        JSON.stringify(mapping.areas),
      ],
    )
  } else {
    await client.query(
      `INSERT INTO teaching_leaders (
         code,
         full_name,
         role_code,
         role_name,
         center,
         courses,
         area,
         status
       )
       VALUES ($1, $2, $3, $4, $5, NULL, $6, 'Active')
       ON CONFLICT (code)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role_code = EXCLUDED.role_code,
         role_name = EXCLUDED.role_name,
         center = EXCLUDED.center,
         area = EXCLUDED.area,
         status = 'Active',
         updated_at = CURRENT_TIMESTAMP`,
      [
        mapping.code,
        mapping.fullName,
        mapping.roleCode,
        mapping.roleName,
        centerFullName,
        mapping.areas.join(', '),
      ],
    )
  }
}

async function replaceManagerCenters(client, userId, mapping) {
  await client.query('DELETE FROM manager_centers WHERE user_id = $1', [userId])

  const insertResult = await client.query(
    `INSERT INTO manager_centers (user_id, center_id, assigned_by_email, assigned_at)
     SELECT $1, c.id, 'pdf-sync@system', CURRENT_TIMESTAMP
     FROM centers c
     WHERE c.status = 'Active'
       AND c.region = ANY($2::text[])
     ON CONFLICT (user_id, center_id) DO NOTHING`,
    [userId, mapping.regions],
  )

  return insertResult.rowCount || 0
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
    await client.query('BEGIN')

    const canUseAreas = await hasAreasColumn(client)
    const summary = []

    for (const mapping of PDF_MAPPINGS) {
      const userId = await upsertAppUser(client, mapping)
      const primaryCenter = await pickPrimaryCenter(client, mapping)
      const centerFullName = primaryCenter?.full_name || 'MindX - Online'

      await upsertTeachingLeader(client, mapping, centerFullName, canUseAreas)
      const assignedCount = await replaceManagerCenters(client, userId, mapping)

      summary.push({
        email: mapping.email,
        userId,
        code: mapping.code,
        leaderCenter: centerFullName,
        leaderAreas: mapping.areas,
        assignedCenters: assignedCount,
      })
    }

    await client.query('COMMIT')

    console.log('SYNC_OK')
    console.log(JSON.stringify(summary, null, 2))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('sync_pdf_center_leader_reference failed:', error)
  process.exit(1)
})
