import { describe, expect, it } from 'vitest';
import { scanSource } from './check-client-bundle.mjs';

describe('check-client-bundle', () => {
    it('accepts client code that only uses public variables', () => {
        const source = 'const url="https://abc.supabase.co";const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;';
        expect(scanSource(source)).toEqual([]);
    });

    it('flags the name of a server-only variable', () => {
        expect(scanSource('new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY})')).toEqual(['variable ANTHROPIC_API_KEY']);
        expect(scanSource('x.SUPABASE_SERVICE_ROLE_KEY')).toEqual(['variable SUPABASE_SERVICE_ROLE_KEY']);
    });

    it('flags hard-coded secret values', () => {
        expect(scanSource(`k="sk-ant-api03-${'a'.repeat(30)}"`)).toEqual(['Anthropic API key']);
        expect(scanSource(`k="sb_secret_${'b'.repeat(30)}"`)).toEqual(['Supabase secret key']);
        // A JWT whose payload carries "role":"service_role".
        const payload = Buffer.from('{"iss":"supabase","role":"service_role"}').toString('base64url');
        expect(scanSource(`k="eyJhbGciOiJIUzI1NiJ9.${payload}.sig"`)).toEqual(['Supabase service_role JWT']);
    });

    it('does not flag the anon JWT', () => {
        const payload = Buffer.from('{"iss":"supabase","role":"anon"}').toString('base64url');
        expect(scanSource(`k="eyJhbGciOiJIUzI1NiJ9.${payload}.sig"`)).toEqual([]);
    });
});
