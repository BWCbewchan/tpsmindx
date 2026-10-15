const LMS_API_URL = process.env.LMS_API_URL || 'https://lms-api.mindx.edu.vn/';

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface LmsApiRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface LmsApiOptions extends LmsApiRequestOptions {
  allowPartialErrors?: boolean;
}

/**
 * Core function to call LMS API directly from the server.
 */
async function requestLmsApi<T>(
  request: GraphQLRequest,
  authHeader?: string,
  retries = 0,
  options: LmsApiOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30000;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;

  try {
    const response = await fetch(LMS_API_URL, {
      method: 'POST',
      signal,
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
      if (options.signal?.aborted) {
        throw new Error(options.signal.reason?.name === 'TimeoutError'
          ? 'LMS API request timed out'
          : 'LMS API request cancelled');
      }
      return requestLmsApi<T>(request, authHeader, retries + 1, options);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[lms-api] HTTP ${response.status} error:`, errorText);
      throw new Error(`LMS API responded with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.errors?.length && !options.allowPartialErrors) {
      const messages = result.errors.map((e: any) => e.message).join('; ');
      console.error('[lms-api] GraphQL errors:', result.errors);
      throw new Error(`GraphQL error: ${messages}`);
    }

    return result as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (timedOut || options.signal?.reason?.name === 'TimeoutError') {
      throw new Error('LMS API request timed out');
    }
    if (options.signal?.aborted) throw new Error('LMS API request cancelled');
    if (error.name === 'AbortError') throw new Error('LMS API request timed out');
    throw error;
  }
}

export async function callLmsApi<T>(
  request: GraphQLRequest,
  authHeader?: string,
  retries = 0,
): Promise<T> {
  return requestLmsApi<T>(request, authHeader, retries);
}

export async function callLmsApiWithOptions<T>(
  request: GraphQLRequest,
  authHeader?: string,
  options: LmsApiRequestOptions = {},
): Promise<T> {
  return requestLmsApi<T>(request, authHeader, 0, options);
}

/**
 * Some LMS lookup queries legitimately return "not found" for one alias while
 * still returning valid data for the other aliases in the same request.
 */
export async function callLmsApiAllowPartial<T>(
  request: GraphQLRequest,
  authHeader?: string,
): Promise<T> {
  return requestLmsApi<T>(request, authHeader, 0, { allowPartialErrors: true });
}

export async function callLmsApiAllowPartialWithOptions<T>(
  request: GraphQLRequest,
  authHeader?: string,
  options: LmsApiRequestOptions = {},
): Promise<T> {
  return requestLmsApi<T>(request, authHeader, 0, {
    ...options,
    allowPartialErrors: true,
  });
}
