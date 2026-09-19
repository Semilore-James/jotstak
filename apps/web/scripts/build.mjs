// Runs `astro build` with an explicit heap ceiling.
//
// The docs render ~30 real .jot documents at build time, one per live example.
// That is genuinely memory-hungry, and Node's default old-space limit is not
// enough on every machine — the build died with a heap error locally while
// succeeding in CI, which is exactly the kind of difference that wastes an
// afternoon. Pinning it here makes the build behave the same everywhere.
//
// Resolved through the module system rather than a hard-coded path, so it works
// whether npm hoists astro to the workspace root or keeps it local.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const astroRoot = dirname(require.resolve("astro/package.json"));
const bin = join(astroRoot, "bin", "astro.mjs");

const result = spawnSync(
  process.execPath,
  ["--max-old-space-size=4096", bin, ...process.argv.slice(2)],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
