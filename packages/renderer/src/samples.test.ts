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
//
// And it happened AGAIN, to the other half of the shop window: both starter
// templates opened with `@banner`, which was folded into `@cover` at some
// point, so the first file a new user copies rendered a red error banner. This
// test had been written for precisely that and was only pointed at samples/.
// A guard aimed at one of two directories is a guard that will miss.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { render } from "./index.js";

/** Every .jot file this repository hands to someone else. */
const shipped = ["samples", "templates"].flatMap((dir) => {
  const path = fileURLToPath(new URL(`../../../${dir}`, import.meta.url));
  return readdirSync(path)
    .filter((f) => f.endsWith(".jot"))
    .map((f) => `${dir}/${f}`);
});

describe("shipped .jot documents", () => {
  it("finds both directories, so neither can go unchecked", () => {
    expect(shipped.filter((f) => f.startsWith("samples/")).length).toBeGreaterThan(0);
    expect(shipped.filter((f) => f.startsWith("templates/")).length).toBeGreaterThan(0);
  });

  it.each(shipped)("%s renders without errors or warnings", (file) => {
    const src = readFileSync(fileURLToPath(new URL(`../../../${file}`, import.meta.url)), "utf8");

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
