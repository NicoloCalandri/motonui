export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string
): Promise<T> {
  // Normalize headers using Headers constructor (handles array form and case-insensitivity)
  const normalizedHeaders = new Headers(init.headers);

  // Work with plain object to ensure test compatibility
  const headers: Record<string, string> = {};

  // Copy normalized headers to plain object
  normalizedHeaders.forEach((value, key) => {
    headers[key] = value;
  });

  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  // Check for Content-Type case-insensitively
  const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === 'content-type');
  if (init.body && !hasContentType) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.error ?? 'Errore imprevisto 🏝️',
      body.code ?? 'UNKNOWN_ERROR',
      res.status
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
