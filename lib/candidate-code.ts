import pool from './db';
import bcrypt from 'bcryptjs';

export const REGION_MAP: Record<string, string> = {
  'HCM': '1',
  'HN': '2',
  'DN': '3',
  // Add more regions as needed
};

export const BLOCK_MAP: Record<string, string> = {
  'Art': '1',
  'Tech': '2',
  'Biz': '3',
  // Add more blocks as needed
};

/**
 * Generates a unique candidate code based on the format: [Region][GenNumber][Block][Seq]
 * Example: 1131301 = HCM (1) + GEN131 (131) + Art (3) + #01
 */
export async function generateCandidateCode(
  regionCode: string,
  genNumber: number,
  blockCode: string
): Promise<string> {
  const region = REGION_MAP[regionCode] || (['1', '2', '3', '4', '5'].includes(regionCode) ? regionCode : '0');
  const block = BLOCK_MAP[blockCode] || (['1', '2', '3'].includes(blockCode) ? blockCode : '0');
  const paddedGen = genNumber.toString().padStart(3, '0');
  const prefix = `${region}${paddedGen}${block}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Use advisory lock to prevent duplicate sequence numbers during concurrent generation
    // We use a hash of the prefix to create a unique lock ID
    const lockId = hashString(prefix);
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

    const res = await client.query(
      `SELECT MAX(CAST(RIGHT(candidate_code, 2) AS INTEGER)) as last_seq 
       FROM hr_candidates 
       WHERE candidate_code LIKE $1 || '%'`,
      [prefix]
    );

    const lastSeq = res.rows[0]?.last_seq || 0;
    const nextSeq = (lastSeq + 1).toString().padStart(2, '0');
    
    await client.query('COMMIT');
    return `${prefix}${nextSeq}`;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Simple string hashing function for advisory locks
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Creates a candidate user account with default password
 */
export async function createCandidateUser(candidateId: number, candidateCode: string) {
  const defaultPassword = 'MindX@2024';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);
  
  await pool.query(
    `INSERT INTO hr_candidate_users (candidate_id, username, password_hash) 
     VALUES ($1, $2, $3)`,
    [candidateId, candidateCode, passwordHash]
  );
}
