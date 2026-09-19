// Copies the bundled woff2 files into public/fonts/ so the site can serve them.
//
// The renderer names the files it expects via FONT_FACES; this script resolves
// each one out of node_modules and copies it. Keeping the list in the renderer
// means the site cannot drift from the faces the CSS actually references.
//
// The SIL Open Font License requires the licence text to ship with the fonts,
// so it is copied alongside them rather than left in node_modules.

import { FONT_FACES } from "@jotstak/renderer";
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "fonts");

mkdirSync(outDir, { recursive: true });

const licences = [];
for (const face of FONT_FACES) {
  copyFileSync(require.resolve(face.source), join(outDir, face.file));
  const pkg = face.source.split("/files/")[0];
  if (!licences.includes(pkg)) licences.push(pkg);
}

const notices = licences
  .map((pkg) => {
    const path = require.resolve(`${pkg}/package.json`);
    const meta = JSON.parse(readIfExists(path) ?? "{}");
    return `${meta.name ?? pkg} — ${meta.license ?? "SIL OFL 1.1"}\n  ${meta.homepage ?? ""}`;
  })
  .join("\n\n");

writeFileSync(
  join(outDir, "LICENSES.txt"),
  `Fonts bundled with Jotstak.\n\nAll four families are licensed under the SIL Open Font License 1.1,\nwhich permits bundling and redistribution with this notice retained.\n\n${notices}\n`,
);

function readIfExists(p) {
  try {
    return existsSync(p) ? require("node:fs").readFileSync(p, "utf8") : null;
  } catch {
    return null;
  }
}

console.log(`copied ${FONT_FACES.length} font files + LICENSES.txt to public/fonts/`);
