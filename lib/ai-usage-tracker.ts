/**
 * AI Usage Tracker
 * Track AI API usage for monitoring and cost analysis
 */

import pool from '@/lib/db';

export type UsageLogData = {
  userEmail: string;
  feature: string;
  classId?: string;
  sessionNumber?: number;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  responseTimeMs?: number;
  success: boolean;
  errorMessage?: string;
};

/**
 * Log AI usage
 * @param data Usage log data
 */
export async function logAIUsage(data: UsageLogData): Promise<void> {
  try {
    await pool.query(
      `
      INSERT INTO ai_usage_logs (
        user_email, feature, class_id, session_number, model,
        input_tokens, output_tokens, total_tokens, estimated_cost,
        response_time_ms, success, error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        data.userEmail,
        data.feature,
        data.classId || null,
        data.sessionNumber || null,
        data.model,
        data.inputTokens || 0,
        data.outputTokens || 0,
        data.totalTokens || 0,
        data.estimatedCost || 0,
        data.responseTimeMs || null,
        data.success,
        data.errorMessage || null,
      ]
    );

    console.log(`[usage-tracker] Logged: ${data.userEmail} - ${data.feature} - ${data.model} - $${data.estimatedCost?.toFixed(4)}`);
  } catch (error) {
    console.error('[usage-tracker] Error logging usage:', error);
  }
}

/**
 * Calculate estimated cost based on model and tokens
 * @param model Model name
 * @param inputTokens Input tokens
 * @param outputTokens Output tokens
 * @returns Estimated cost in USD
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Pricing as of 2024 (update as needed)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 }, // per 1K tokens
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  };

  const modelPricing = pricing[model] || pricing['gpt-3.5-turbo']; // Default to GPT-3.5
  const inputCost = (inputTokens / 1000) * modelPricing.input;
  const outputCost = (outputTokens / 1000) * modelPricing.output;

  return inputCost + outputCost;
}

/**
 * Get daily cost for a user
 * @param userEmail User email
 * @param date Date (default: today)
 * @returns Total cost in USD
 */
export async function getDailyCost(userEmail?: string, date?: Date): Promise<number> {
  try {
    const targetDate = date || new Date();
    const query = userEmail
      ? `
        SELECT COALESCE(SUM(estimated_cost), 0) as total_cost
        FROM ai_usage_logs
        WHERE user_email = $1 AND DATE(created_at) = DATE($2)
      `
      : `
        SELECT COALESCE(SUM(estimated_cost), 0) as total_cost
        FROM ai_usage_logs
        WHERE DATE(created_at) = DATE($1)
      `;

    const params = userEmail ? [userEmail, targetDate] : [targetDate];
    const result = await pool.query(query, params);

    return parseFloat(result.rows[0].total_cost);
  } catch (error) {
    console.error('[usage-tracker] Error getting daily cost:', error);
    return 0;
  }
}

/**
 * Get monthly cost for a user
 * @param userEmail User email
 * @param year Year
 * @param month Month (1-12)
 * @returns Total cost in USD
 */
export async function getMonthlyCost(userEmail?: string, year?: number, month?: number): Promise<number> {
  try {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    const query = userEmail
      ? `
        SELECT COALESCE(SUM(estimated_cost), 0) as total_cost
        FROM ai_usage_logs
        WHERE user_email = $1 
          AND EXTRACT(YEAR FROM created_at) = $2
          AND EXTRACT(MONTH FROM created_at) = $3
      `
      : `
        SELECT COALESCE(SUM(estimated_cost), 0) as total_cost
        FROM ai_usage_logs
        WHERE EXTRACT(YEAR FROM created_at) = $1
          AND EXTRACT(MONTH FROM created_at) = $2
      `;

    const params = userEmail ? [userEmail, targetYear, targetMonth] : [targetYear, targetMonth];
    const result = await pool.query(query, params);

    return parseFloat(result.rows[0].total_cost);
  } catch (error) {
    console.error('[usage-tracker] Error getting monthly cost:', error);
    return 0;
  }
}

/**
 * Get usage statistics
 * @param userEmail Optional user email filter
 * @param days Number of days to look back (default: 30)
 */
export async function getUsageStats(userEmail?: string, days: number = 30) {
  try {
    const query = userEmail
      ? `
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_requests,
          SUM(total_tokens) as total_tokens,
          SUM(estimated_cost) as total_cost,
          AVG(response_time_ms) as avg_response_time_ms,
          COUNT(DISTINCT DATE(created_at)) as active_days
        FROM ai_usage_logs
        WHERE user_email = $1 AND created_at >= NOW() - INTERVAL '${days} days'
      `
      : `
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_requests,
          SUM(total_tokens) as total_tokens,
          SUM(estimated_cost) as total_cost,
          AVG(response_time_ms) as avg_response_time_ms,
          COUNT(DISTINCT user_email) as unique_users,
          COUNT(DISTINCT DATE(created_at)) as active_days
        FROM ai_usage_logs
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `;

    const params = userEmail ? [userEmail] : [];
    const result = await pool.query(query, params);

    return result.rows[0];
  } catch (error) {
    console.error('[usage-tracker] Error getting usage stats:', error);
    return null;
  }
}

/**
 * Check if daily cost exceeds threshold and send alert
 * @param threshold Threshold in USD (default: $50)
 */
export async function checkCostAlert(threshold: number = 50): Promise<boolean> {
  try {
    const dailyCost = await getDailyCost();

    if (dailyCost > threshold) {
      console.warn(`⚠️ [usage-tracker] ALERT: Daily cost $${dailyCost.toFixed(2)} exceeds threshold $${threshold}`);
      // TODO: Send email/Slack notification
      return true;
    }

    return false;
  } catch (error) {
    console.error('[usage-tracker] Error checking cost alert:', error);
    return false;
  }
}
