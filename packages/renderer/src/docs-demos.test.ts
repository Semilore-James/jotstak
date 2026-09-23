// Every live example in the docs must render clean.
//
// The docs run the real renderer over every ```jot-demo fence at build time,
// which is the whole point of them — an example cannot rot into a screenshot
// of something the tool no longer does. But a fence that renders *badly* still
// ships: the first cookbook recipe used @table, which has no renderer yet, and
// the flagship page quietly showed a row of comma-separated text where a table
// should be. Nothing failed. The build was green.
//
// Info is allowed — "@table has no renderer yet" is information, and the docs
// deliberately document primitives before they are built. Errors and warnings
// are not: those mean the example itself is wrong.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "./index.js";

const docsDir = fileURLToPath(new URL("../../../apps/web/src/content/docs/docs", import.meta.url));

/** Every .md under the docs tree, at any depth. */
function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? markdownFiles(join(dir, e.name)) : e.name.endsWith(".md") ? [join(dir, e.name)] : [],
  );
}

const FENCE = /```jot-demo\r?\n([\s\S]*?)```/g;

const demos = markdownFiles(docsDir).flatMap((file) => {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(FENCE)].map((m, i) => ({
    name: `${file.slice(docsDir.length + 1).replace(/\\/g, "/")} #${i + 1}`,
    source: m[1]!,
  }));
});

describe("live examples in the docs", () => {
  it("finds them", () => {
    expect(demos.length).toBeGreaterThan(20);
  });

  it.each(demos.map((d) => [d.name, d.source]))("%s renders without errors or warnings", (_name, source) => {
    for (const mode of ["notebook", "doc"] as const) {
      const { diagnostics } = render(source, { mode });
      const problems = diagnostics.filter((d) => d.severity === "error" || d.severity === "warning");
      expect(problems.map((p) => p.message)).toEqual([]);
    }
  });
});
