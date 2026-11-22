import Anthropic from '@anthropic-ai/sdk';

/**
 * The one way to build the Anthropic client (audit B3.45). The SDK default is
 * a 10-minute timeout: a stuck call would hold a serverless function (and the
 * user) for the whole Vercel limit. Short tasks answer in seconds; long-form
 * text streams, and the timeout covers the wait for the stream to start.
 * Retries are limited to 2, with the SDK's backoff, on 408/409/429/5xx and
 * connection errors only. The key stays server-side (env, never in a prompt).
 */
export const AI_TIMEOUT_MS = 45_000;
export const AI_MAX_RETRIES = 2;

export function createAnthropicClient(): Anthropic {
    return new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY ?? '',
        timeout: AI_TIMEOUT_MS,
        maxRetries: AI_MAX_RETRIES,
    });
}
