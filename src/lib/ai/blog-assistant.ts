import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS } from '@/lib/ai/models';
import { log } from '@/lib/log';
import { untrustedText, withUntrustedRule } from '@/lib/ai/untrusted';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

// ─── System Prompts ───────────────────────────────────────────────────────────

const BLOG_SYSTEM_IT = `Sei un assistente AI per la scrittura di blog di viaggio di coppia.
Aiuti a scrivere contenuti autentici, poetici e coinvolgenti.
Scivi in prima persona plurale (noi/nostro) con un tono caldo e personale.
Evita i cliché del turismo. Focalizzati sulle emozioni, i dettagli inaspettati e l'esperienza condivisa.
Quando continui o migliori un testo esistente, mantieni il tono e lo stile dell'autore.`;

const BLOG_SYSTEM_EN = `You are an AI assistant for couples travel blog writing.
You help write authentic, poetic, and engaging content.
Write in first person plural (we/our) with a warm, personal tone.
Avoid tourist clichés. Focus on emotions, unexpected details, and shared experiences.
When continuing or improving existing text, maintain the author's tone and style.`;

// ─── Streaming Blog Assistant ─────────────────────────────────────────────────

interface AssistBlogInput {
    command: 'continue' | 'improve' | 'summarize' | 'expand';
    selectedText?: string;
    context?: string;
    language: 'it' | 'en';
}

/**
 * Streams a blog writing AI response for the Tiptap editor.
 * Returns a ReadableStream for Server-Sent Events.
 */
export function streamBlogAssistant(input: AssistBlogInput): ReadableStream {
    const { command, selectedText, context, language } = input;

    const system = withUntrustedRule(language === 'it' ? BLOG_SYSTEM_IT : BLOG_SYSTEM_EN, language);
    const userPrompt = buildBlogPrompt(command, selectedText ?? context ?? '', language);

    return new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            try {
                const stream = anthropic.messages.stream({
                    model: AI_MODELS.longForm,
                    max_tokens: 1024,
                    system,
                    messages: [{ role: 'user', content: userPrompt }],
                });

                for await (const event of stream) {
                    if (
                        event.type === 'content_block_delta' &&
                        event.delta.type === 'text_delta'
                    ) {
                        const data = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`;
                        controller.enqueue(encoder.encode(data));
                    }
                }

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            } catch (err) {
                log.error('[motonui][blog-assistant] Stream error:', err);
                controller.error(err);
            }
        },
    });
}

const COMMANDS: Record<AssistBlogInput['command'], Record<'it' | 'en', string>> = {
    continue: {
        it: 'Continua in modo naturale (2-3 paragrafi) il testo di viaggio contenuto nei dati.',
        en: 'Naturally continue (2-3 paragraphs) the travel text contained in the data.',
    },
    improve: {
        it: 'Migliora il testo contenuto nei dati rendendolo più vivido e coinvolgente, mantenendo il significato originale.',
        en: 'Improve the text contained in the data to make it more vivid and engaging while keeping the original meaning.',
    },
    summarize: {
        it: 'Riassumi in 2-3 frasi evocative il testo contenuto nei dati.',
        en: 'Summarize the text contained in the data in 2-3 evocative sentences.',
    },
    expand: {
        it: 'Espandi il testo contenuto nei dati aggiungendo dettagli sensoriali e riflessioni personali.',
        en: 'Expand the text contained in the data by adding sensory details and personal reflections.',
    },
};

/**
 * T-5.3: the instruction is ours and stays outside the block; the editor text
 * (selection or context) is untrusted and goes inside it.
 */
export function buildBlogPrompt(command: AssistBlogInput['command'], text: string, language: 'it' | 'en'): string {
    return `${COMMANDS[command][language]}\n\n${untrustedText(text, 6000)}`;
}
