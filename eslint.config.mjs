import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  {
    // nextgen/ (own workspace lint) and mobile/ (Expo, React Native) are
    // separate projects; coverage/ and tmp/ are generated or scratch output.
    ignores: [".next/**", "nextgen/**", "mobile/**", "coverage/**", "tmp/**", "undefined/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
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
      // React Compiler rules of eslint-plugin-react-hooks 7. The old
      // FlatCompat setup never enabled them; turning them on (19 findings)
      // is its own change, not part of restoring the lint job.
      "react-hooks/incompatible-library": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
]);