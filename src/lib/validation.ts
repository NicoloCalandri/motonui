import type { ZodError, ZodIssue } from 'zod';

const MAX_ISSUES = 5;

function describeIssue(issue: ZodIssue): string {
    switch (issue.code) {
        case 'invalid_type':
            return issue.received === 'undefined' ? 'campo obbligatorio' : `tipo non valido (atteso ${issue.expected})`;
        case 'invalid_string':
            return 'formato non valido';
        case 'invalid_enum_value':
            return `valore non ammesso (valori possibili: ${issue.options.join(', ')})`;
        case 'too_small':
            return issue.type === 'string' ? `troppo corto (minimo ${issue.minimum} caratteri)` : `troppo piccolo (minimo ${issue.minimum})`;
        case 'too_big':
            return issue.type === 'string' ? `troppo lungo (massimo ${issue.maximum} caratteri)` : `troppo grande (massimo ${issue.maximum})`;
        case 'invalid_date':
            return 'data non valida';
        case 'unrecognized_keys':
            return `campi non ammessi: ${issue.keys.join(', ')}`;
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
    const parts = error.issues.slice(0, MAX_ISSUES).map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'richiesta';
        return `${path}: ${describeIssue(issue)}`;
    });
    if (error.issues.length > MAX_ISSUES) parts.push(`e altri ${error.issues.length - MAX_ISSUES} errori`);
    return parts.join('; ');
}
