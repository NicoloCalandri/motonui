export const SRC_LIB: string;
export function targetPath(module: string): string;
export function transform(source: string, module: string): string;
export function portedFiles(): string[];
export function compare(module: string): { path: string; expected: string; current: string | null; same: boolean };
export function transformWeb(source: string, file: string): string;
export function compareWeb(file: string): { path: string; expected: string; current: string | null; same: boolean };
