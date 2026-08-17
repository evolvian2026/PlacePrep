/** Thin typed wrapper around the JSON API. */

const TOKEN_KEY = 'pp_token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'error',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Return raw text instead of parsed JSON (used for CSV downloads). */
  raw?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (options.raw) {
    const text = await response.text();
    if (!response.ok) throw new ApiError(response.status, text.slice(0, 200));
    return text as unknown as T;
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string; details?: unknown } } | null)?.error;
    // A 401 means the stored token is dead; drop it so the guard redirects.
    if (response.status === 401) setToken(null);
    throw new ApiError(
      response.status,
      error?.message ?? `Request failed with ${response.status}`,
      error?.code,
      error?.details,
    );
  }

  return payload as T;
}

/** Formats validation details from the server into something readable. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (Array.isArray(error.details)) {
      const issues = (error.details as { path?: string; message?: string }[])
        .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
        .filter(Boolean);
      if (issues.length) return `${error.message} — ${issues.join('; ')}`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
