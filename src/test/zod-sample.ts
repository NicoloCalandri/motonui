import { z, type ZodTypeAny } from 'zod';

/**
 * Builds a value that satisfies a Zod schema, for contract tests (T-3.8).
 * Optional fields are filled too, so their validation is exercised. Strings
 * with a regex use the first known sample that matches it; a schema this
 * cannot satisfy makes the caller's safeParse check fail loudly.
 */

const UUID = '10000000-0000-4000-8000-00000000000a';

/** Candidates for regex-constrained strings (dates, times, colours, slugs, codes). */
const REGEX_SAMPLES = ['2026-10-01', '10:30', '#C4622D', 'rapa-nui', 'EUR', 'ABC123', '2026-10-01T10:30', 'Rapa Nui'];

type Check = { kind: string; value?: unknown; regex?: RegExp };

function sampleString(schema: z.ZodString): string {
    const checks = (schema._def.checks ?? []) as Check[];
    const has = (kind: string) => checks.some((c) => c.kind === kind);
    const num = (kind: string) => checks.find((c) => c.kind === kind)?.value as number | undefined;

    let value: string;
    if (has('uuid')) value = UUID;
    else if (has('email')) value = 'giorgia@example.com';
    else if (has('url')) value = 'https://example.com/rapa-nui';
    else if (has('datetime')) value = '2026-10-01T10:30:00Z';
    else if (has('date')) value = '2026-10-01';
    else if (has('time')) value = '10:30:00';
    else {
        const regex = checks.find((c) => c.kind === 'regex')?.regex;
        value = regex ? REGEX_SAMPLES.find((s) => regex.test(s)) ?? 'x' : 'Rapa Nui';
    }

    const length = num('length');
    const min = num('min');
    const max = num('max');
    if (length !== undefined) value = value.padEnd(length, 'A').slice(0, length);
    if (min !== undefined && value.length < min) value = value.padEnd(min, 'a');
    if (max !== undefined && value.length > max) value = value.slice(0, max);
    return value;
}

function sampleNumber(schema: z.ZodNumber): number {
    const checks = (schema._def.checks ?? []) as Array<Check & { inclusive?: boolean }>;
    const min = checks.find((c) => c.kind === 'min');
    const max = checks.find((c) => c.kind === 'max');
    let value = 1;
    if (min && typeof min.value === 'number') value = Math.max(value, min.inclusive ? min.value : min.value + 1);
    if (max && typeof max.value === 'number') value = Math.min(value, max.value);
    return value;
}

export function zodSample(schema: ZodTypeAny): unknown {
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape as Record<string, ZodTypeAny>;
        return Object.fromEntries(Object.entries(shape).map(([key, field]) => [key, zodSample(field)]));
    }
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return zodSample(schema.unwrap());
    if (schema instanceof z.ZodDefault) return zodSample(schema._def.innerType);
    if (schema instanceof z.ZodCatch) return zodSample(schema._def.innerType);
    if (schema instanceof z.ZodEffects) return zodSample(schema.innerType());
    if (schema instanceof z.ZodPipeline) return zodSample(schema._def.in);
    if (schema instanceof z.ZodString) return sampleString(schema);
    if (schema instanceof z.ZodNumber) return sampleNumber(schema);
    if (schema instanceof z.ZodBoolean) return true;
    if (schema instanceof z.ZodDate) return new Date('2026-10-01T00:00:00Z');
    if (schema instanceof z.ZodEnum) return schema.options[0];
    if (schema instanceof z.ZodNativeEnum) return Object.values(schema.enum)[0];
    if (schema instanceof z.ZodLiteral) return schema.value;
    if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
        return zodSample((schema.options as ZodTypeAny[])[0]);
    }
    if (schema instanceof z.ZodArray) {
        const min = (schema._def.minLength?.value as number | undefined) ?? 1;
        return Array.from({ length: Math.max(min, 1) }, () => zodSample(schema.element));
    }
    if (schema instanceof z.ZodRecord) return {};
    if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) return 'x';
    throw new Error(`zodSample: unsupported schema ${schema.constructor.name}`);
}
