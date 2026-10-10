import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BlogLayout from './layout';
import { seriousA11yViolations } from '@/test/axe';

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
}

describe('public blog shell (T-5.1)', () => {
    it('renders the public navigation without the app shell', async () => {
        const { container } = render(BlogLayout({ children: <p>contenuto</p> }));
        expect(screen.getByRole('navigation', { name: 'Navigazione del blog' })).toBeDefined();
        expect(screen.getByRole('link', { name: /Blog/ }).getAttribute('href')).toBe('/blog');
        expect(screen.getByText('contenuto')).toBeDefined();
        expect(await seriousA11yViolations(container)).toEqual([]);
    });

    it('makes no auth or session call from the browser', () => {
        const dir = join(process.cwd(), 'src/app/(public)/blog');
        for (const file of sourceFiles(dir)) {
            const source = readFileSync(file, 'utf8');
            expect(source, file).not.toMatch(/@\/lib\/supabase\/(client|server)/);
            expect(source, file).not.toMatch(/useProfile|getAuthUser|\.auth\./);
        }
    });
});
