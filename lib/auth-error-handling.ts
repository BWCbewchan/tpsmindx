export type HttpStatusError = Error & {
  status?: number
  info?: unknown
}

export function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined
  }

  const status = Number((error as { status?: unknown }).status)
  return Number.isFinite(status) ? status : undefined
}

export function isUnauthorizedStatus(status: unknown): boolean {
  return Number(status) === 401
}

export function isTransientFetchError(error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status !== undefined) {
    return status === 408 || status === 429 || status >= 500
  }

  if (error instanceof TypeError) {
    return true
  }

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error ?? '').toLowerCase()

  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed')
  )
}

export async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function createHttpError(
  message: string,
  response: Response,
  info?: unknown,
): HttpStatusError {
  const error = new Error(message) as HttpStatusError
  error.status = response.status
  error.info = info
  return error
}
