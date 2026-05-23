import { Pool, type PoolConfig } from 'pg';
import { initDatabase } from './migrations';

const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build';

function buildPoolConfig(): PoolConfig {
  // Keep conservative defaults to avoid exhausting Postgres slots (Aiven hobby tiers are tiny).
  // Raise DB_POOL_MAX in .env if local dev needs more parallel queries.
  // Non-Vercel `next start` shares Aiven with dev tools — default 2 to leave headroom for superuser slots.
  const defaultPoolMax =
    process.env.NODE_ENV === 'development' ? '1' : process.env.VERCEL ? '5' : '2';
  const max = Math.max(1, parseInt(process.env.DB_POOL_MAX || defaultPoolMax, 10));
  const connectionTimeoutMillis = Math.max(
    2000,
    parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '20000', 10)
  );
  const idleTimeoutMillis = Math.max(
    5000,
    parseInt(process.env.DB_IDLE_TIMEOUT_MS || '60000', 10)
  );

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const dbHost = process.env.DB_HOST?.trim() || '';
  const dbUser = process.env.DB_USER?.trim() || '';
  const dbName = process.env.DB_NAME?.trim() || '';

  const urlDisablesSsl = Boolean(databaseUrl && /sslmode=disable/i.test(databaseUrl));
  const urlRequiresSsl = Boolean(
    databaseUrl &&
      (/sslmode=require|sslmode=no-verify/i.test(databaseUrl) || /[?&]ssl=true\b/i.test(databaseUrl))
  );
  const urlLooksHosted = Boolean(
    databaseUrl &&
      /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(
        databaseUrl
      )
  );
  const hostLooksHosted = Boolean(
    dbHost &&
      /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(dbHost)
  );
  // Aiven defaults often show up with these values.
  const looksLikeAivenDefaults = dbUser === 'avnadmin' || dbName === 'defaultdb';
  const sslExplicitOn = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';

  const useSsl =
    !urlDisablesSsl && (sslExplicitOn || urlRequiresSsl || urlLooksHosted || hostLooksHosted || looksLikeAivenDefaults);

  const ssl: PoolConfig['ssl'] = useSsl
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
    : undefined;

  const base: Pick<
    PoolConfig,
    | 'max'
    | 'idleTimeoutMillis'
    | 'connectionTimeoutMillis'
    | 'allowExitOnIdle'
    | 'keepAlive'
    | 'application_name'
  > = {
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    allowExitOnIdle: process.env.NODE_ENV === 'development',
    keepAlive: true,
    application_name: process.env.DB_APPLICATION_NAME || 'tps-next',
  };

  if (databaseUrl) {
    return { ...base, connectionString: databaseUrl, ssl };
  }

  return {
    ...base,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
  };
}

// Prevent creating multiple pools during hot reloads in development (Next.js specific fix for serverless/HMR)
if (!global.pool) {
  const poolConfig = buildPoolConfig();
  console.log(`[DB] Pool init — ssl: ${poolConfig.ssl ? 'ON' : 'OFF'}, host: ${poolConfig.host || '(connection string)'}`);
  global.pool = new Pool(poolConfig);

  global.pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  if (!isBuildPhase) {
    global.migrationInitPromise = initDatabase(global.pool).catch((err) => {
      console.error('⚠️ Auto-migration failed (app vẫn chạy bình thường):', err.message);
    });
  }
}

const pool = global.pool;

export default pool;
