/**
 * AI Rate Limiter
 * Kiểm soát số lượng requests AI per user per day
 */

import pool from '@/lib/db';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  message?: string;
};

/**
 * Check if user has exceeded rate limit
 * @param userEmail User email
 * @param feature Feature name (e.g., 'teaching-analysis')
 * @param limitPerDay Daily limit (default: 10)
 * @returns RateLimitResult
 */
export async function checkRateLimit(
  userEmail: string,
  feature: string = 'teaching-analysis',
  limitPerDay: number = 10
): Promise<RateLimitResult> {
  try {
    // Calculate reset time (midnight tonight)
    const now = new Date();
    const resetAt = new Date(now);
    resetAt.setHours(24, 0, 0, 0); // Next midnight

    // Get or create rate limit record
    const result = await pool.query(
      `
      INSERT INTO ai_rate_limits (user_email, feature, request_count, limit_per_day, reset_at)
      VALUES ($1, $2, 1, $3, $4)
      ON CONFLICT (user_email, feature, reset_at)
      DO UPDATE SET 
        request_count = ai_rate_limits.request_count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING request_count, limit_per_day, reset_at
      `,
      [userEmail, feature, limitPerDay, resetAt]
    );

    const record = result.rows[0];
    const requestCount = record.request_count;
    const limit = record.limit_per_day;
    const remaining = Math.max(0, limit - requestCount);
    const allowed = requestCount <= limit;

    return {
      allowed,
      remaining,
      limit,
      resetAt: new Date(record.reset_at),
      message: allowed
        ? `Còn ${remaining}/${limit} requests hôm nay`
        : `Đã vượt quá giới hạn ${limit} requests/ngày. Reset lúc ${new Date(record.reset_at).toLocaleTimeString('vi-VN')}`,
    };
  } catch (error) {
    console.error('[rate-limiter] Error:', error);
    // Fallback: Allow request if rate limiter fails
    return {
      allowed: true,
      remaining: limitPerDay,
      limit: limitPerDay,
      resetAt: new Date(),
      message: 'Rate limiter unavailable, allowing request',
    };
  }
}

/**
 * Get user's current rate limit status
 * @param userEmail User email
 * @param feature Feature name
 * @returns RateLimitResult or null if no record
 */
export async function getRateLimitStatus(
  userEmail: string,
  feature: string = 'teaching-analysis'
): Promise<RateLimitResult | null> {
  try {
    const result = await pool.query(
      `
      SELECT request_count, limit_per_day, reset_at
      FROM ai_rate_limits
      WHERE user_email = $1 
        AND feature = $2 
        AND reset_at > NOW()
      ORDER BY reset_at DESC
      LIMIT 1
      `,
      [userEmail, feature]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const record = result.rows[0];
    const requestCount = record.request_count;
    const limit = record.limit_per_day;
    const remaining = Math.max(0, limit - requestCount);
    const allowed = requestCount < limit;

    return {
      allowed,
      remaining,
      limit,
      resetAt: new Date(record.reset_at),
      message: `Đã dùng ${requestCount}/${limit} requests hôm nay`,
    };
  } catch (error) {
    console.error('[rate-limiter] Error getting status:', error);
    return null;
  }
}

/**
 * Reset rate limit for a user (admin function)
 * @param userEmail User email
 * @param feature Feature name
 */
export async function resetRateLimit(userEmail: string, feature: string = 'teaching-analysis'): Promise<void> {
  try {
    await pool.query(
      `
      DELETE FROM ai_rate_limits
      WHERE user_email = $1 AND feature = $2
      `,
      [userEmail, feature]
    );
    console.log(`[rate-limiter] Reset rate limit for ${userEmail} - ${feature}`);
  } catch (error) {
    console.error('[rate-limiter] Error resetting:', error);
  }
}

/**
 * Clean up old rate limit records (run daily)
 */
export async function cleanupOldRateLimits(): Promise<number> {
  try {
    const result = await pool.query(
      `
      DELETE FROM ai_rate_limits
      WHERE reset_at < NOW() - INTERVAL '7 days'
      RETURNING id
      `
    );
    const deletedCount = result.rowCount || 0;
    console.log(`[rate-limiter] Cleaned up ${deletedCount} old records`);
    return deletedCount;
  } catch (error) {
    console.error('[rate-limiter] Error cleaning up:', error);
    return 0;
  }
}
