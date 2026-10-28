import type { Pool } from 'pg'

/** Import only a source-owned missing profile. Never overwrite a concurrent confirmation. */
export async function insertMissingTeacherFromSource(pool: Pick<Pool, 'query'>, raw: Record<string, string>) {
  const f = (key: string) => String(raw[key] || '').trim()
  if (!f('Code') || !f('Full name') || !f('Work email')) throw new Error('Nguồn chưa có đầy đủ mã, tên và email giáo viên')
  return pool.query(`INSERT INTO teachers (
         code, full_name, user_name, work_email, personal_email, phone_number,
         status_update, centers, khoi_final, role, course_line, rank,
         joined_date, teacher_point, data_hr_raw, status_check, bu_check,
         khoi_check, check_col, te_quan_ly, leader_quan_ly,
         rate_k12_check, rank_k12_check, status, main_centre,
         "Full name", "User name", "Work email", "Main centre", "Status", "Course Line",
         onboarding_snapshot, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17,
         $18, $19, $20, $21,
         $22, $23, $24, $8,
         $2, $3, $4, $8, $24, $11,
         $25::jsonb, CURRENT_TIMESTAMP
       )
       ON CONFLICT (code) DO NOTHING
       RETURNING code`, [
    f('Code'), f('Full name'), f('User name') || f('Code'), f('Work email').toLowerCase(), f('Personal email') || null, f('Phone number') || null,
    f('Status (update)') || null, f('Centers') || null, f('Khối final') || null, f('Role') || null, f('Course line') || null, f('Rank') || null,
    f('Joined date') || null, f('Teacher point') || null, f('Data HR (Raw)') || null, f('Status check') || null, f('BU check') || null,
    f('Khối check') || null, f('CHECK') || null, f('TE quản lý') || null, f('Leader quản lý') || null,
    f('Rate K12 check') || null, f('Rank K12 check') || null, f('Status check') || f('Status (update)') || 'Active', JSON.stringify(raw),
  ])
}
