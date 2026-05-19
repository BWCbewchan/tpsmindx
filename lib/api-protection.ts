import { getApiSecret } from '@/lib/internal-api-secret';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API Protection Middleware — kiểm tra Origin/Referer/User-Agent.
 * Không thay thế xác thực Bearer/DB role: các route nhạy cảm vẫn phải gọi
 * `requireBearerSession` / `requireBearerDbRoles` trong handler.
 */

/** Strip trailing slashes; Origin header never includes a trailing slash. */
function normalizeAppOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** NEXT_PUBLIC_APP_URL có thể là một hoặc nhiều URL, phân tách bằng dấu phẩy hoặc chấm phẩy (vd: https://a.com,https://b.com). */
function parseAppUrlsFromEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => normalizeAppOrigin(s))
    .filter(Boolean);
}

/** Danh sách origin bổ sung (cách nhau bởi dấu phẩy/chấm phẩy/khoảng trắng) — cấu hình trong .env, không gắn cứng trong code. */
function parseExtraAllowedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => normalizeAppOrigin(s))
    .filter(Boolean);
}

const ALLOWED_ORIGINS = Array.from(
  new Set<string>([
    ...parseExtraAllowedOrigins(process.env.ALLOWED_API_EXTRA_ORIGINS),
    ...parseAppUrlsFromEnv(process.env.NEXT_PUBLIC_APP_URL),
  ]),
);

// Convenience: in local development allow common localhost origins so
// same-origin fetches from the browser are not accidentally rejected.
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://127.0.0.1:3000');
}
// Secret server-only — so khớp header x-api-key (cron / công cụ), không lộ ra bundle
const API_SECRET_KEY = getApiSecret();

/**
 * Validate request có đến từ giao diện ứng dụng không
 */
export function validateInternalRequest(request: NextRequest): {
  isValid: boolean;
  error?: string;
} {
  // 1. Kiểm tra origin và referer trước để xác định nguồn request
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Cho phép request từ cùng host (same-origin)
  const isSameOrigin = origin && host && (
    origin === `https://${host}` || 
    origin === `http://${host}`
  );
  
  // Kiểm tra xem request có từ allowed origins không
  const isFromAllowedOrigin = origin && (
    isSameOrigin || 
    ALLOWED_ORIGINS.includes(origin)
  );
  
  const isFromAllowedReferer = referer && (
    (host && referer.includes(host)) ||
    ALLOWED_ORIGINS.some(allowedOrigin => referer.startsWith(allowedOrigin))
  );

  // 2. Kiểm tra custom header hoặc Authorization token (optional cho client requests)
  const apiKey = request.headers.get('x-api-key');
  const authHeader = request.headers.get('authorization');
  
  const hasValidApiKey = apiKey && apiKey === API_SECRET_KEY;
  const hasAuthToken = authHeader && authHeader.startsWith('Bearer ');

  // 3. Kiểm tra user agent
  const userAgent = request.headers.get('user-agent') || '';
  const isToolRequest = (
    userAgent.toLowerCase().includes('curl') ||
    userAgent.toLowerCase().includes('wget') ||
    userAgent.toLowerCase().includes('postman')
  );

  // LOGIC MỚI:
  // - Nếu là request từ allowed origin/referer (browser/client) -> CHO PHÉP
  // - Nếu là tool request (curl/wget/postman) -> YÊU CẦU API key hoặc auth token
  // - Nếu không có origin/referer và không phải tool -> CHỜ phép (internal server request)
  
  // Cho phép nếu request từ client (browser) với origin/referer hợp lệ
  if (isFromAllowedOrigin || isFromAllowedReferer) {
    return { isValid: true };
  }

  // Nếu là tool request, yêu cầu API key hoặc auth token
  if (isToolRequest) {
    if (!hasValidApiKey && !hasAuthToken) {
      return {
        isValid: false,
        error: 'Unauthorized: Tool requests require API key or authentication token'
      };
    }
    return { isValid: true };
  }

  // Nếu có API key hoặc auth token hợp lệ -> cho phép
  if (hasValidApiKey || hasAuthToken) {
    return { isValid: true };
  }

  // Nếu có origin nhưng không valid
  if (origin && !isFromAllowedOrigin) {
    console.warn('[API Protection] Invalid origin:', origin, 'Expected:', ALLOWED_ORIGINS);
    return {
      isValid: false,
      error: `Forbidden: Invalid origin ${origin}`
    };
  }

  // Các trường hợp khác: không có origin, referer, hoặc auth -> block
  return {
    isValid: false,
    error: 'Unauthorized: Missing origin, referer, or authentication'
  };
}

/**
 * Tạo error response khi validation thất bại
 */
export function createUnauthorizedResponse(error: string): NextResponse {
  return NextResponse.json(
    { 
      error: 'Access denied',
      message: 'This API endpoint can only be accessed through the application interface.',
      details: error
    },
    { 
      status: 403,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      }
    }
  );
}

/**
 * Helper function để wrap API handler với protection
 */
export function withApiProtection(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const validation = validateInternalRequest(request);
    
    if (!validation.isValid) {
      console.warn(`[API Protection] Blocked request: ${validation.error}`, {
        url: request.url,
        method: request.method,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      });
      
      return createUnauthorizedResponse(validation.error || 'Access denied');
    }

    return handler(request);
  };
}
