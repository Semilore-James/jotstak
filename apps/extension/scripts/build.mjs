// Bundles the extension into one CommonJS file, and copies the fonts beside it.
//
// Bundling is not an optimisation here, it is the only thing that works. The
// extension imports @jotstak/renderer, which is a workspace package: `vsce`
// packages the extension folder, not the monorepo, so an unbundled build ships
// an import of a package that is not there. esbuild inlines it.
//
// CommonJS for the same kind of reason — the extension host loads `main` with
// require(), and an ESM entry point is a different contract with a different
// set of caveats per VS Code version. One file, one format, no surprises.

import { build } from "esbuild";
import { FONT_FACES } from "@jotstak/renderer";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const watch = process.argv.includes("--watch");

// ── Fonts ────────────────────────────────────────────────────────────────
// The renderer names the files it expects via FONT_FACES, so the extension
// cannot drift from the faces the CSS actually references. The SIL Open Font
// License requires the licence text to ship with them.
const fontDir = join(root, "media", "fonts");
mkdirSync(fontDir, { recursive: true });

const packages = [];
for (const face of FONT_FACES) {
  copyFileSync(require.resolve(face.source), join(fontDir, face.file));
  const pkg = face.source.split("/files/")[0];
  if (!packages.includes(pkg)) packages.push(pkg);
}
writeFileSync(
  join(fontDir, "LICENSES.txt"),
  packages
    .map((pkg) => {
      const dir = dirname(require.resolve(`${pkg}/package.json`));
      return `── ${pkg} ──\n${require("node:fs").readFileSync(join(dir, "LICENSE"), "utf8")}`;
    })
    .join("\n\n"),
);
console.log(`copied ${FONT_FACES.length} font files + LICENSES.txt to media/fonts/`);

// ── Bundle ───────────────────────────────────────────────────────────────
const options = {
  entryPoints: [join(root, "src", "extension.ts")],
  outfile: join(root, "dist", "extension.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  // Supplied by the extension host, never bundled.
  external: ["vscode"],
  sourcemap: true,
  minify: !watch,
  logLevel: "info",
};

if (watch) {
  const ctx = await (await import("esbuild")).context(options);
  await ctx.watch();
  console.log("watching…");
} else {
  await build(options);
}
