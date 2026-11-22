import type { ZodError } from 'zod';

const MAX_ISSUES = 5;

/**
 * The issue fields read below, as Zod 3 and Zod 4 name them. The app runs on
 * Zod 4; nextgen/ still uses Zod 3 with a copy of this file, so both shapes
 * are handled: `invalid_string`/`invalid_format`, `invalid_enum_value`
 * (`options`)/`invalid_value` (`values`), `type`/`origin` on size issues.
 */
type LooseIssue = {
    code: string;
    path: readonly PropertyKey[];
    message: string;
    received?: unknown;
    expected?: unknown;
    options?: readonly unknown[];
    values?: readonly unknown[];
    type?: string;
    origin?: string;
    minimum?: number | bigint;
    maximum?: number | bigint;
    keys?: readonly string[];
};

/** Zod 4 drops `received`: a missing field says "received undefined" in the message. */
function isMissing(issue: LooseIssue): boolean {
    return issue.received === 'undefined' || /received undefined/.test(issue.message);
}

function describeIssue(issue: LooseIssue): string {
    const kind = issue.type ?? issue.origin;
    switch (issue.code) {
        case 'invalid_type':
            return isMissing(issue) ? 'campo obbligatorio' : `tipo non valido (atteso ${String(issue.expected)})`;
        case 'invalid_string':
        case 'invalid_format':
            return 'formato non valido';
        case 'invalid_enum_value':
        case 'invalid_value':
            return `valore non ammesso (valori possibili: ${(issue.options ?? issue.values ?? []).map(String).join(', ')})`;
        case 'too_small':
            return kind === 'string' ? `troppo corto (minimo ${issue.minimum} caratteri)` : `troppo piccolo (minimo ${issue.minimum})`;
        case 'too_big':
            return kind === 'string' ? `troppo lungo (massimo ${issue.maximum} caratteri)` : `troppo grande (massimo ${issue.maximum})`;
        case 'invalid_date':
            return 'data non valida';
        case 'unrecognized_keys':
            return `campi non ammessi: ${(issue.keys ?? []).join(', ')}`;
        default:
            return 'valore non valido';
    }
}

/**
 * Turns a ZodError into a short, readable Italian message
 * (`campo: motivo; campo: motivo`) instead of Zod's raw JSON dump.
 * Only field paths and generic reasons are included, never input values.
 */
export function formatZodError(error: ZodError): string {
    const issues = error.issues as readonly unknown[] as readonly LooseIssue[];
    const parts = issues.slice(0, MAX_ISSUES).map((issue) => {
        const path = issue.path.length > 0 ? issue.path.map(String).join('.') : 'richiesta';
        return `${path}: ${describeIssue(issue)}`;
    });
    if (error.issues.length > MAX_ISSUES) parts.push(`e altri ${error.issues.length - MAX_ISSUES} errori`);
    return parts.join('; ');
}
