// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { AI_MAX_RETRIES, AI_TIMEOUT_MS, createAnthropicClient } from './client';

describe('createAnthropicClient', () => {
    it('bounds the timeout and the retries', () => {
        vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
        const client = createAnthropicClient();
        expect(client.timeout).toBe(AI_TIMEOUT_MS);
        expect(client.maxRetries).toBe(AI_MAX_RETRIES);
        expect(AI_TIMEOUT_MS).toBeLessThan(60_000);
        vi.unstubAllEnvs();
    });
});
