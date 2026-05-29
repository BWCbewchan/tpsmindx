-- Migration: Create tables for AI usage tracking, rate limiting, and caching
-- Run this in your PostgreSQL database

-- Table 1: AI Usage Logs (tracking & monitoring)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  feature VARCHAR(100) NOT NULL, -- 'teaching-analysis', 'document-summary', etc.
  class_id VARCHAR(100),
  session_number INTEGER,
  model VARCHAR(50) NOT NULL, -- 'gpt-4-turbo-preview', 'gpt-3.5-turbo', 'mock'
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 6) DEFAULT 0, -- in USD
  response_time_ms INTEGER, -- milliseconds
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for fast queries
  INDEX idx_user_email (user_email),
  INDEX idx_created_at (created_at),
  INDEX idx_feature (feature),
  INDEX idx_user_date (user_email, created_at)
);

-- Table 2: AI Rate Limits (per-user daily limits)
CREATE TABLE IF NOT EXISTS ai_rate_limits (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  feature VARCHAR(100) NOT NULL,
  request_count INTEGER DEFAULT 0,
  limit_per_day INTEGER DEFAULT 10,
  reset_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: one record per user per feature per day
  UNIQUE (user_email, feature, reset_at),
  
  -- Indexes
  INDEX idx_user_feature (user_email, feature),
  INDEX idx_reset_at (reset_at)
);

-- Table 3: AI Analysis Cache (cache analysis results)
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL UNIQUE, -- format: "teaching-analysis:{classId}:{sessionNumber}"
  analysis_data JSONB NOT NULL,
  metadata JSONB, -- store additional info like model used, tokens, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0, -- track cache hits
  last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_cache_key (cache_key),
  INDEX idx_expires_at (expires_at),
  INDEX idx_created_at (created_at)
);

-- Function: Auto-delete expired cache entries
CREATE OR REPLACE FUNCTION delete_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_analysis_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up expired cache (if using pg_cron)
-- SELECT cron.schedule('cleanup-ai-cache', '0 * * * *', 'SELECT delete_expired_cache()');

-- View: Daily cost summary
CREATE OR REPLACE VIEW ai_daily_cost_summary AS
SELECT 
  DATE(created_at) as date,
  user_email,
  feature,
  model,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost) as total_cost,
  AVG(response_time_ms) as avg_response_time_ms,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as error_count
FROM ai_usage_logs
GROUP BY DATE(created_at), user_email, feature, model
ORDER BY date DESC, total_cost DESC;

-- View: User rate limit status
CREATE OR REPLACE VIEW ai_user_rate_limit_status AS
SELECT 
  user_email,
  feature,
  request_count,
  limit_per_day,
  (limit_per_day - request_count) as remaining,
  ROUND((request_count::DECIMAL / limit_per_day * 100), 2) as usage_percentage,
  reset_at,
  CASE 
    WHEN request_count >= limit_per_day THEN 'EXCEEDED'
    WHEN request_count >= limit_per_day * 0.8 THEN 'WARNING'
    ELSE 'OK'
  END as status
FROM ai_rate_limits
WHERE reset_at > NOW()
ORDER BY usage_percentage DESC;

-- View: Cache statistics
CREATE OR REPLACE VIEW ai_cache_statistics AS
SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_entries,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry,
  ROUND(AVG(EXTRACT(EPOCH FROM (expires_at - created_at)) / 3600), 2) as avg_ttl_hours,
  pg_size_pretty(pg_total_relation_size('ai_analysis_cache')) as table_size
FROM ai_analysis_cache;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ai_usage_logs TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ai_rate_limits TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ai_analysis_cache TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Sample queries for monitoring:

-- 1. Check today's cost
-- SELECT * FROM ai_daily_cost_summary WHERE date = CURRENT_DATE;

-- 2. Check user rate limits
-- SELECT * FROM ai_user_rate_limit_status WHERE user_email = 'user@example.com';

-- 3. Check cache hit rate
-- SELECT * FROM ai_cache_statistics;

-- 4. Top users by cost
-- SELECT user_email, SUM(total_cost) as total_cost 
-- FROM ai_daily_cost_summary 
-- WHERE date >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY user_email 
-- ORDER BY total_cost DESC 
-- LIMIT 10;

-- 5. Clean up expired cache manually
-- SELECT delete_expired_cache();
