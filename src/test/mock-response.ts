import type { Mock } from 'vitest';

/**
 * Shape of the NextResponse stand-ins that route tests mock with
 * `{ body, status }`. Cast results with `as unknown as MockResponse`.
 */
export type MockResponse = {
    status: number;
    body: { code?: string; error?: string } & Record<string, unknown>;
    _ok?: boolean;
    redirectUrl?: string;
    cookies: { set: Mock; delete: Mock };
};
