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
    "design-imports/**",
    // Worktree build artifacts（.next/** 只 match 根目錄，worktree 路徑需明確列出）
    ".claude/worktrees/**/.next/**",
  ]),
]);

export default eslintConfig;
