import { z } from 'zod';

/**
 * Builds a value that satisfies a Zod schema, for contract tests (T-3.8).
 * Optional fields are filled too, so their validation is exercised. Strings
 * with a regex use the first known sample that matches it; a schema this
 * cannot satisfy makes the caller's safeParse check fail loudly.
 *
 * Zod 4: the schema is read through its public JSON Schema of the *input*
 * side (`z.toJSONSchema`, `io: 'input'`), instead of Zod 3's internal
 * `_def.checks`. Refinements are not representable: routes that need one list
 * an example in VALID_BODIES.
 */

const UUID = '10000000-0000-4000-8000-00000000000a';

/** Candidates for regex-constrained strings (dates, times, colours, slugs, codes). */
const REGEX_SAMPLES = [UUID, '2026-10-01', '10:30', '#C4622D', 'rapa-nui', 'EUR', 'ABC123', '2026-10-01T10:30', 'Rapa Nui'];

type JsonSchema = {
    type?: string | string[];
    format?: string;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    minItems?: number;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    anyOf?: JsonSchema[];
    oneOf?: JsonSchema[];
    allOf?: JsonSchema[];
    enum?: unknown[];
    const?: unknown;
};

const FORMAT_SAMPLES: Record<string, string> = {
    uuid: UUID,
    guid: UUID,
    email: 'giorgia@example.com',
    uri: 'https://example.com/rapa-nui',
    url: 'https://example.com/rapa-nui',
    'date-time': '2026-10-01T10:30:00Z',
    date: '2026-10-01',
    time: '10:30:00',
};

function sampleString(schema: JsonSchema): string {
    let value: string;
    const formatted = schema.format ? FORMAT_SAMPLES[schema.format] : undefined;
    if (formatted) value = formatted;
    else if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        value = REGEX_SAMPLES.find((s) => regex.test(s)) ?? 'x';
    } else value = 'Rapa Nui';

    const { minLength: min, maxLength: max } = schema;
    if (min !== undefined && value.length < min) value = value.padEnd(min, min === max ? 'A' : 'a');
    if (max !== undefined && value.length > max) value = value.slice(0, max);
    return value;
}

function sampleNumber(schema: JsonSchema): number {
    let value = 1;
    if (schema.minimum !== undefined) value = Math.max(value, schema.minimum);
    if (schema.exclusiveMinimum !== undefined) value = Math.max(value, schema.exclusiveMinimum + 1);
    if (schema.maximum !== undefined) value = Math.min(value, schema.maximum);
    if (schema.exclusiveMaximum !== undefined) value = Math.min(value, schema.exclusiveMaximum - 1);
    return value;
}

function sampleJson(schema: JsonSchema): unknown {
    if (schema.const !== undefined) return schema.const;
    if (schema.enum) return schema.enum[0];
    const union = schema.anyOf ?? schema.oneOf;
    if (union) return sampleJson(union.find((option) => option.type !== 'null') ?? union[0]);
    if (schema.allOf) return sampleJson(Object.assign({}, ...schema.allOf) as JsonSchema);

    const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
    switch (type) {
        case 'object':
            return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, field]) => [key, sampleJson(field)]));
        case 'array':
            return Array.from({ length: Math.max(schema.minItems ?? 1, 1) }, () => sampleJson(schema.items ?? {}));
        case 'string':
            return sampleString(schema);
        case 'number':
        case 'integer':
            return sampleNumber(schema);
        case 'boolean':
            return true;
        case 'null':
            return null;
        default:
            // `{}`: z.any(), z.unknown() or a type JSON Schema cannot express.
            return 'x';
    }
}

export function zodSample(schema: z.ZodType): unknown {
    const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
    return sampleJson(json);
}
