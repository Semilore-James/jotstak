import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // The real module only exists inside an extension host.
      vscode: fileURLToPath(new URL("./test/vscode.ts", import.meta.url)),
    },
  },
});
