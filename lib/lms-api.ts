const LMS_API_URL = process.env.LMS_API_URL || 'https://lms-api.mindx.edu.vn/';

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/**
 * Core function to call LMS API directly from the server.
 */
export async function callLmsApi<T>(
  request: GraphQLRequest,
  authHeader?: string,
  retries = 0,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(LMS_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        'X-API-KEY': process.env.LMS_API_KEY || '',
      },
      body: JSON.stringify(request),
    });

    clearTimeout(timeoutId);

    // Auto-retry on HTTP 429 Rate Limit
    if (response.status === 429 && retries < 3) {
      const waitMs = (retries + 1) * 1000;
      console.warn(`[lms-api] Rate limited (429). Retrying in ${waitMs}ms (attempt ${retries + 1}/3)...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return callLmsApi<T>(request, authHeader, retries + 1);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[lms-api] HTTP ${response.status} error:`, errorText);
      throw new Error(`LMS API responded with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.errors?.length) {
      const messages = result.errors.map((e: any) => e.message).join('; ');
      console.error('[lms-api] GraphQL errors:', result.errors);
      throw new Error(`GraphQL error: ${messages}`);
    }

    return result as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('LMS API request timed out');
    }
    throw error;
  }
}
