import { describe, it, expect } from 'vitest';
import { applyFilter, cropToAspect } from './process';
import { readFileSync } from 'fs';
import { join } from 'path';

// We test with a small synthetic 1×1 white PNG embedded as base64
const TINY_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const tinyBuffer = () => Buffer.from(TINY_PNG_B64, 'base64');

describe('applyFilter', () => {
    it('should return a buffer for each filter type', async () => {
        const filters = ['none', 'warm', 'cool', 'vintage', 'bw', 'vivid'] as const;
        for (const filter of filters) {
            const result = await applyFilter(tinyBuffer(), filter);
            expect(result).toBeInstanceOf(Buffer);
            expect(result.byteLength).toBeGreaterThan(0);
        }
    });

    it('should return a different result for warm vs bw', async () => {
        const warm = await applyFilter(tinyBuffer(), 'warm');
        const bw = await applyFilter(tinyBuffer(), 'bw');
        // Buffers may have same length for 1×1 but won't be identical (color values differ)
        expect(warm.equals(bw)).toBe(false);
    });
});

describe('cropToAspect', () => {
    it('should return a buffer for each aspect ratio', async () => {
        const ratios = ['1:1', '4:5', '9:16', '16:9'] as const;
        for (const ratio of ratios) {
            const result = await cropToAspect(tinyBuffer(), ratio);
            expect(result).toBeInstanceOf(Buffer);
            expect(result.byteLength).toBeGreaterThan(0);
        }
    });
});
