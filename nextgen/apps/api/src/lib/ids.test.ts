import { describe, expect, it } from 'vitest';
import { guid } from './ids';

describe('guid', () => {
    it.each([
        '10000000-0000-4000-8000-00000000000a',
        '00000000-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
    ])('accepts %s', (id) => {
        expect(guid().safeParse(id).success).toBe(true);
    });

    it.each(['not-a-uuid', "1' or '1'='1", '10000000-0000-4000-8000-00000000000', '10000000000040008000000000000000a', ''])(
        'rejects %s',
        (id) => {
            expect(guid().safeParse(id).success).toBe(false);
        },
    );
});
