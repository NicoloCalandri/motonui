import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from './api-client';

describe('apiFetch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    ));
    const result = await apiFetch<{ ok: boolean }>('/api/health');
    expect(result).toEqual({ ok: true });
  });

  it('throws ApiError with code/status from the standard error shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Non trovato', code: 'TRIP_NOT_FOUND', status: 404 }), { status: 404 })
    ));
    await expect(apiFetch('/api/trips/x')).rejects.toMatchObject({
      message: 'Non trovato',
      code: 'TRIP_NOT_FOUND',
      status: 404,
    });
  });

  it('attaches the Supabase access token as a Bearer header when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/api/trips', { headers: {} }, 'test-token');
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });
});
