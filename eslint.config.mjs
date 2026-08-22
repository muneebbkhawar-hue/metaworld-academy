import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // scripts/*.js are plain Node CommonJS scripts run directly via
    // `node scripts/xyz.js` (see package.json's "backends"/"dev:all"),
    // not part of the Next.js/TypeScript app bundle - package.json has no
    // "type": "module", so require()/module.exports is the correct, working
    // module system here, not a legacy pattern to migrate away from.
    // @typescript-eslint/no-require-imports assumes ESM-first TypeScript
    // code and genuinely conflicts with that intentional design; disabling
    // it for this directory only (not project-wide) documents that
    // exception instead of silencing the rule everywhere.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
