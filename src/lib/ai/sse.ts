/**
 * Reads the text stream of our AI routes (`data: {"text": …}` lines, closed by
 * `data: [DONE]`). Calls onText with the text so far; returns the full text.
 * Malformed chunks are skipped.
 */
export async function readSseText(body: ReadableStream<Uint8Array>, onText: (full: string) => void): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') {
                await reader.cancel();
                return full;
            }
            try {
                const { text } = JSON.parse(payload) as { text: string };
                full += text;
                onText(full);
            } catch { /* ignore malformed chunks */ }
        }
    }
    return full;
}
