import { defineConfig } from "vitest/config";

// The extension workspace has its own config — it aliases `vscode` to a stub,
// which only makes sense there. Without this, running vitest from the root
// picks those files up without the alias and reports a failure that says
// nothing about the code.
export default defineConfig({
  test: { exclude: ["**/node_modules/**", "**/dist/**", "apps/**"] },
});
