/**
 * Chuỗi bí mật ký JWT — tối thiểu 16 ký tự.
 * Đọc qua khóa động để tránh Next/Webpack inline `undefined` khi build CI chưa có biến,
 * sau đó bạn thêm JWT_SECRET trên hosting (giá trị vẫn đọc được lúc chạy).
 */
function readJwtSecretFromEnv(): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const key = ['JWT', 'SECRET'].join('_');
  const raw = process.env[key];
  return typeof raw === 'string' ? raw : undefined;
}

export function getJwtSecret(): string {
  const s = readJwtSecretFromEnv()?.trim();
  if (s && s.length >= 16) return s;

  throw new Error(
    'JWT_SECRET thiếu hoặc ngắn hơn 16 ký tự. Thêm vào file .env (local) hoặc Vercel: Project → Settings → Environment Variables (Production), rồi redeploy.',
  );
}
