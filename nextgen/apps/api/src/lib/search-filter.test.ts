import { describe, expect, it } from 'vitest';
import { ilikeAnyFilter, normalizeSearchTerm } from './search-filter';

describe('normalizeSearchTerm', () => {
    it('keeps names and emails', () => {
        expect(normalizeSearchTerm('giorgia.rossi+test@example.com')).toBe('giorgia.rossi+test@example.com');
        expect(normalizeSearchTerm("  Nicolò  D'Amico ")).toBe("Nicolò D'Amico");
    });

    it('drops the characters that change a PostgREST filter', () => {
        // A comma would add a condition, parentheses a group, `*`/`%` wildcards.
        expect(normalizeSearchTerm('x%,role.eq.admin')).toBe('x role.eq.admin');
        expect(normalizeSearchTerm('a),or(id.neq.0')).toBe('a or id.neq.0');
        expect(normalizeSearchTerm('"quoted"*\\')).toBe('quoted');
    });

    it('handles empty input and caps the length', () => {
        expect(normalizeSearchTerm(undefined)).toBe('');
        expect(normalizeSearchTerm(null)).toBe('');
        expect(normalizeSearchTerm('a'.repeat(200))).toHaveLength(80);
    });
});

describe('ilikeAnyFilter', () => {
    it('builds one ilike condition per column', () => {
        expect(ilikeAnyFilter(['email', 'display_name'], 'gio')).toBe('email.ilike.%gio%,display_name.ilike.%gio%');
    });

    it('never yields more conditions than columns', () => {
        const filter = ilikeAnyFilter(['email', 'display_name'], 'x%,role.eq.admin,id.not.is.null');
        expect(filter.split(',')).toHaveLength(2);
        expect(filter).not.toMatch(/[()]/);
    });
});
