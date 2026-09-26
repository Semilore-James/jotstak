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

  // The bug this suite could not see, because a wrong line break is not a
  // diagnostic. Every sample was hard-wrapped at about 80 columns, written back
  // when a single newline was a space. UX-45 made a line you ended a line, and
  // in that moment fourteen wrap points across three documents turned into real
  // breaks in the middle of sentences — in the shop window, and on the
  // playground's starter document, which is the first thing a stranger sees.
  //
  // Nothing errored. Nothing warned. The pages just quietly read wrong.
  it.each(shipped)("%s breaks a line only where it asked to", (file) => {
    const src = readFileSync(fileURLToPath(new URL(`../../../${file}`, import.meta.url)), "utf8");
    const { html } = render(src, { mode: "notebook" });

    // The two ways to ask for a break on purpose: the `\n` escape, for the
    // places Enter cannot reach, and Markdown's two trailing spaces.
    const asked =
      (src.match(/\\n/g) ?? []).length + (src.match(/ {2}$/gm) ?? []).length;
    const drawn = (html.match(/<br>/g) ?? []).length;

    expect(
      drawn,
      `${file} draws ${drawn} line breaks and asked for ${asked}. A paragraph is one line of source; let the column decide where it wraps.`,
    ).toBeLessThanOrEqual(asked);
  });

  // Found while rewriting them: samples/pricing-v2.jot and samples/showcase.jot
  // were byte-identical. Two files, one document, and the one nothing linked to
  // was the one being kept up to date.
  it("ships no document twice", () => {
    const seen = new Map<string, string>();
    for (const file of shipped) {
      const src = readFileSync(fileURLToPath(new URL(`../../../${file}`, import.meta.url)), "utf8");
      const first = seen.get(src);
      expect(first, `${file} is byte-identical to ${first}`).toBeUndefined();
      seen.set(src, file);
    }
  });
});
