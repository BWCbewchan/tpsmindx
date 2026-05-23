const { default: pool } = require('../lib/db');

async function main() {
  const result = await pool.query("SELECT email, display_name FROM app_users WHERE email = 'baotc@mindx.com.vn'");
  console.log('from app_users:', result.rows);
  
  const result2 = await pool.query("SELECT email, full_name FROM teachers WHERE email = 'baotc@mindx.com.vn'");
  console.log('from teachers:', result2.rows);
  
  process.exit(0);
}
main().catch(console.error);
