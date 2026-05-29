/**
 * AI Analysis Cache
 * Cache AI analysis results to reduce API calls and costs
 */

import pool from '@/lib/db';

export type CacheOptions = {
  ttlHours?: number; // Time to live in hours (default: 24)
};

/**
 * Get cached analysis
 * @param cacheKey Unique cache key
 * @returns Cached data or null if not found/expired
 */
export async function getCachedAnalysis<T = any>(cacheKey: string): Promise<T | null> {
  try {
    const result = await pool.query(
      `
      SELECT analysis_data, metadata, expires_at
      FROM ai_analysis_cache
      WHERE cache_key = $1 AND expires_at > NOW()
      LIMIT 1
      `,
      [cacheKey]
    );

    if (result.rows.length === 0) {
      console.log(`[ai-cache] Cache MISS: ${cacheKey}`);
      return null;
    }

    // Update hit count and last accessed time
    await pool.query(
      `
      UPDATE ai_analysis_cache
      SET hit_count = hit_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP
      WHERE cache_key = $1
      `,
      [cacheKey]
    );

    console.log(`[ai-cache] Cache HIT: ${cacheKey}`);
    return result.rows[0].analysis_data as T;
  } catch (error) {
    console.error('[ai-cache] Error getting cache:', error);
    return null;
  }
}

/**
 * Set cached analysis
 * @param cacheKey Unique cache key
 * @param data Data to cache
 * @param metadata Optional metadata
 * @param options Cache options
 */
export async function setCachedAnalysis(
  cacheKey: string,
  data: any,
  metadata?: any,
  options: CacheOptions = {}
): Promise<void> {
  try {
    const ttlHours = options.ttlHours || 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    await pool.query(
      `
      INSERT INTO ai_analysis_cache (cache_key, analysis_data, metadata, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (cache_key)
      DO UPDATE SET
        analysis_data = EXCLUDED.analysis_data,
        metadata = EXCLUDED.metadata,
        expires_at = EXCLUDED.expires_at,
        hit_count = 0,
        last_accessed_at = CURRENT_TIMESTAMP
      `,
      [cacheKey, JSON.stringify(data), metadata ? JSON.stringify(metadata) : null, expiresAt]
    );

    console.log(`[ai-cache] Cached: ${cacheKey} (TTL: ${ttlHours}h)`);
  } catch (error) {
    console.error('[ai-cache] Error setting cache:', error);
  }
}

/**
 * Invalidate (delete) cached analysis
 * @param cacheKey Cache key to invalidate
 */
export async function invalidateCache(cacheKey: string): Promise<void> {
  try {
    await pool.query(
      `
      DELETE FROM ai_analysis_cache
      WHERE cache_key = $1
      `,
      [cacheKey]
    );
    console.log(`[ai-cache] Invalidated: ${cacheKey}`);
  } catch (error) {
    console.error('[ai-cache] Error invalidating cache:', error);
  }
}

/**
 * Invalidate all cache for a class
 * @param classId Class ID
 */
export async function invalidateClassCache(classId: string): Promise<void> {
  try {
    const result = await pool.query(
      `
      DELETE FROM ai_analysis_cache
      WHERE cache_key LIKE $1
      RETURNING cache_key
      `,
      [`teaching-analysis:${classId}:%`]
    );
    const deletedCount = result.rowCount || 0;
    console.log(`[ai-cache] Invalidated ${deletedCount} cache entries for class ${classId}`);
  } catch (error) {
    console.error('[ai-cache] Error invalidating class cache:', error);
  }
}

/**
 * Clean up expired cache entries
 * @returns Number of deleted entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await pool.query(
      `
      DELETE FROM ai_analysis_cache
      WHERE expires_at < NOW()
      RETURNING id
      `
    );
    const deletedCount = result.rowCount || 0;
    console.log(`[ai-cache] Cleaned up ${deletedCount} expired cache entries`);
    return deletedCount;
  } catch (error) {
    console.error('[ai-cache] Error cleaning up cache:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  activeEntries: number;
  expiredEntries: number;
  totalHits: number;
  avgHitsPerEntry: number;
  hitRate: number;
}> {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_entries,
        COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_entries,
        COALESCE(SUM(hit_count), 0) as total_hits,
        COALESCE(AVG(hit_count), 0) as avg_hits_per_entry
      FROM ai_analysis_cache
    `);

    const stats = result.rows[0];
    const totalRequests = parseInt(stats.total_entries) + parseInt(stats.total_hits);
    const hitRate = totalRequests > 0 ? (parseInt(stats.total_hits) / totalRequests) * 100 : 0;

    return {
      totalEntries: parseInt(stats.total_entries),
      activeEntries: parseInt(stats.active_entries),
      expiredEntries: parseInt(stats.expired_entries),
      totalHits: parseInt(stats.total_hits),
      avgHitsPerEntry: parseFloat(stats.avg_hits_per_entry),
      hitRate: Math.round(hitRate * 100) / 100,
    };
  } catch (error) {
    console.error('[ai-cache] Error getting stats:', error);
    return {
      totalEntries: 0,
      activeEntries: 0,
      expiredEntries: 0,
      totalHits: 0,
      avgHitsPerEntry: 0,
      hitRate: 0,
    };
  }
}

/**
 * Generate cache key for teaching analysis
 * @param classId Class ID
 * @param sessionNumber Session number
 * @returns Cache key
 */
export function generateTeachingAnalysisCacheKey(classId: string, sessionNumber: number): string {
  return `teaching-analysis:${classId}:${sessionNumber}`;
}
