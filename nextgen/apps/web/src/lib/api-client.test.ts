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

  it('handles case-insensitive Content-Type detection', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    // Pass lowercase 'content-type' header to test case-insensitive handling
    // When body is present, should NOT add duplicate Content-Type if one already exists (case-insensitive)
    await apiFetch('/api/test', { headers: { 'content-type': 'application/xml' }, body: 'test' });
    const [, init] = fetchMock.mock.calls[0];
    // Verify: only one Content-Type header (case-insensitive), regardless of case
    const headerKeys = Object.keys(init.headers as Record<string, string>);
    const contentTypeKeys = headerKeys.filter(k => k.toLowerCase() === 'content-type');
    expect(contentTypeKeys.length).toBe(1);
    // Get the actual value from whichever case key exists
    const contentTypeValue = (init.headers as Record<string, string>)[contentTypeKeys[0]];
    expect(contentTypeValue).toBe('application/xml');
  });

  it('handles array-form headers input', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    // Pass headers as array of tuples (valid HeadersInit form)
    await apiFetch('/api/test', { headers: [['x-custom', 'value']] });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['x-custom']).toBe('value');
  });
});
