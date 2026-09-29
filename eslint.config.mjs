import { defineConfig } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default defineConfig([
  {
    // nextgen/ (own workspace lint) and mobile/ (Expo, React Native) are
    // separate projects; coverage/ and tmp/ are generated or scratch output.
    ignores: [".next/**", "nextgen/**", "mobile/**", "coverage/**", "tmp/**", "undefined/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/triple-slash-reference": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
      // Photos and documents are private files served through short-lived
      // signed URLs (or user-provided https links): next/image would proxy and
      // cache them through the image optimizer. Plain <img> is deliberate.
      "@next/next/no-img-element": "off",
    },
  },
]);