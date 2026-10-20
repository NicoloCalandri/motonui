export type Fingerprint = {
    tables: Set<string>;
    rpcs: Set<string>;
    fields: Set<string>;
    functions: Set<string>;
    messages: Set<string>;
};
export type Difference = Partial<Record<keyof Fingerprint, { onlyNext: string[]; onlyHono: string[] }>>;

export const RESOURCES: Record<string, string[]>;
export function nextFilesFor(patterns: string[]): string[];
export function fingerprint(source: string): Fingerprint;
export function compare(resource: string): { nextFiles: string[]; diff: Difference };
