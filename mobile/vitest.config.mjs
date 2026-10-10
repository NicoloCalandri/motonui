import ts from 'typescript';
import { defineConfig } from 'vitest/config';

/**
 * Runs the pure tests in mobile/lib with the root Vitest (`npm run test:mobile`).
 *
 * mobile/tsconfig.json extends expo's base config, which exists only after
 * `npm ci` inside mobile/. CI installs the root dependencies alone, and the
 * default transform fails when it cannot load that tsconfig: files are
 * transpiled here with TypeScript instead, without reading any tsconfig.
 */
export default defineConfig({
  oxc: false,
  plugins: [
    {
      name: 'mobile-ts-transpile',
      transform(code, id) {
        if (!/\.tsx?$/.test(id)) return null;
        const output = ts.transpileModule(code, {
          fileName: id,
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, sourceMap: true },
        });
        return { code: output.outputText, map: output.sourceMapText };
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
