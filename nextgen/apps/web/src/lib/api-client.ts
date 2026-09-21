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
  const headers: Record<string, string> = {};

  // Copy existing headers
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (typeof init.headers === 'object') {
      Object.assign(headers, init.headers);
    }
  }

  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

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
