import { vi } from 'vitest';

export interface QueryResult {
    data: unknown;
    error: { message: string } | null;
}

const BUILDER_METHODS = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'lt', 'lte', 'gt', 'gte', 'like', 'order', 'limit', 'range',
] as const;

type BuilderMethod = (typeof BUILDER_METHODS)[number];

export type QueryChain = {
    [K in BuilderMethod]: ReturnType<typeof vi.fn>;
} & {
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
    /** Every builder call in order, e.g. ['eq', ['trip_id', '…']]. */
    calls: Array<[string, unknown[]]>;
};

/**
 * PostgREST-like query mock for route tests: every builder method returns the
 * chain, and awaiting it (or single/maybeSingle) resolves to `result`.
 */
export function queryChain(result: QueryResult = { data: null, error: null }): QueryChain {
    const calls: Array<[string, unknown[]]> = [];
    const chain = { calls } as unknown as QueryChain;
    for (const method of BUILDER_METHODS) {
        chain[method] = vi.fn((...args: unknown[]) => {
            calls.push([method, args]);
            return chain;
        });
    }
    chain.single = vi.fn(async () => result);
    chain.maybeSingle = vi.fn(async () => result);
    chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return chain;
}
