// Every document shipped in samples/ must still render cleanly.
//
// This exists because one did not. The primitive recut folded @evidence into
// @quote, and the playground's starter document — a string literal inside
// playground.astro at the time — was never updated. It kept rendering with a
// red "Unknown primitive" banner for anyone who opened the page, and nothing
// in the test suite had any opinion about it, because no test had ever looked
// at a whole document.
//
// The lesson is not "remember to grep after a rename". It is that the sample
// documents are the tool's shop window and were the only artefacts with no
// coverage at all. Now a cut primitive breaks the build.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "./index.js";

const samplesDir = fileURLToPath(new URL("../../../samples", import.meta.url));
const samples = readdirSync(samplesDir).filter((f) => f.endsWith(".jot"));

describe("shipped sample documents", () => {
  it("finds the samples directory", () => {
    expect(samples.length).toBeGreaterThan(0);
  });

  it.each(samples)("%s renders without errors or warnings", (file) => {
    const src = readFileSync(join(samplesDir, file), "utf8");

    for (const mode of ["notebook", "doc"] as const) {
      const { html, diagnostics } = render(src, { mode });

      // Warnings count too: an unknown *param* is the same rot as an unknown
      // primitive, one rename earlier.
      const problems = diagnostics.filter(
        (d) => d.severity === "error" || d.severity === "warning",
      );
      expect(
        problems,
        `${file} (${mode}) — ${problems.map((d) => `line ${d.line}: ${d.message}`).join("; ")}`,
      ).toEqual([]);

      expect(html.length, `${file} (${mode}) rendered nothing`).toBeGreaterThan(0);
    }
  });
});
