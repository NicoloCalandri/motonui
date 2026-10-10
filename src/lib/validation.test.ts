import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatZodError } from '@/lib/validation';

function errorOf(schema: z.ZodTypeAny, value: unknown) {
    const result = schema.safeParse(value);
    if (result.success) throw new Error('expected failure');
    return result.error;
}

describe('formatZodError', () => {
    it('lists field paths with Italian reasons', () => {
        const schema = z.object({
            title: z.string().min(3),
            amount: z.number(),
            category: z.enum(['food', 'other']),
            nested: z.object({ id: z.string().uuid() }),
        });
        const message = formatZodError(errorOf(schema, { title: 'a', category: 'x', nested: { id: 'no' } }));

        expect(message).toContain('title: troppo corto (minimo 3 caratteri)');
        expect(message).toContain('amount: campo obbligatorio');
        expect(message).toContain('category: valore non ammesso (valori possibili: food, other)');
        expect(message).toContain('nested.id: formato non valido');
    });

    it('does not echo input values', () => {
        const message = formatZodError(errorOf(z.object({ email: z.string().email() }), { email: '<script>x</script>' }));
        expect(message).not.toContain('<script>');
    });

    it('uses "richiesta" for root-level errors and caps the list', () => {
        expect(formatZodError(errorOf(z.object({}), 'x'))).toBe('richiesta: tipo non valido (atteso object)');

        const schema = z.object(Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`f${i}`, z.string()])));
        expect(formatZodError(errorOf(schema, {}))).toMatch(/; e altri 2 errori$/);
    });
});
