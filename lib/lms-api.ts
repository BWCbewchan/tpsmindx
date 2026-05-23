const LMS_API_URL = 'https://lms-api.mindx.edu.vn/graphql';

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/**
 * Core function to call LMS API directly from the server.
 */
export async function callLmsApi<T>(request: GraphQLRequest, authHeader?: string): Promise<T> {
  console.log(`[LMS-API] Sending request to ${LMS_API_URL}...`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout sau 10s

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
    console.log(`[LMS-API] Response received. Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LMS-API] Error Body: ${errorText}`);
      throw new Error(`LMS API responded with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.errors?.length) {
      const messages = result.errors.map((e: any) => e.message).join('; ');
      console.error(`[LMS-API] GraphQL Errors: ${messages}`);
      throw new Error(`GraphQL error: ${messages}`);
    }

    return result as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`[LMS-API] Request timed out after 10 seconds`);
      throw new Error('LMS API request timed out');
    }
    throw error;
  }
}
