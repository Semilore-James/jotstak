import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // The real module only exists inside an extension host.
      vscode: fileURLToPath(new URL("./test/vscode.ts", import.meta.url)),
    },
  },
  plugins: [
    {
      // A .jot file imported as its text, as the bundler's "text" loader does
      // (scripts/build.mjs): the welcome document is samples/welcome.jot.
      name: "jot-as-text",
      transform(code, id) {
        if (id.endsWith(".jot")) return { code: `export default ${JSON.stringify(code)};`, map: null };
      },
    },
  ],
});
