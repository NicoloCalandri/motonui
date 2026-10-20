import { describe, expect, it, vi } from 'vitest';
import { readSseText } from './sse';

function stream(chunks: string[]) {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
            controller.close();
        },
    });
}

describe('readSseText', () => {
    it('joins text chunks split across reads and stops at [DONE]', async () => {
        const onText = vi.fn();
        const full = await readSseText(
            stream(['data: {"text":"Ciao"}\n', 'data: {"te', 'xt":" Rapa Nui"}\n', 'data: [DONE]\n', 'data: {"text":"dopo"}\n']),
            onText,
        );
        expect(full).toBe('Ciao Rapa Nui');
        expect(onText).toHaveBeenLastCalledWith('Ciao Rapa Nui');
    });

    it('skips malformed and non-data lines', async () => {
        const full = await readSseText(stream([': ping\n', 'data: {oops\n', 'data: {"text":"ok"}\n']), () => {});
        expect(full).toBe('ok');
    });
});
