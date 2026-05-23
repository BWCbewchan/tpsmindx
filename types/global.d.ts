import { Pool } from 'pg';

declare global {
  var pool: Pool | undefined;
  var migrationInitPromise: Promise<void> | undefined;
}
