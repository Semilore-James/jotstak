// What a tile on the playground's rack puts down.
//
// The same block the editor's autocomplete writes, as plain text. It has to
// render cleanly the moment it lands: a rack that puts down a block the page
// immediately objects to would teach the wrong thing on someone's first try.

import { describe, expect, it } from "vitest";
import { PRIMITIVES, scaffoldSource } from "@jotstak/schema";
import { render } from "./index.js";

describe("a block as the rack puts it down", () => {
  const built = PRIMITIVES.filter((p) => !p.planned).map((p) => [p.name, p] as const);

  it.each(built)("@%s renders with nothing to complain about, first line only", (_name, spec) => {
    const source = scaffoldSource(spec);
    const { diagnostics } = render(source, { mode: "notebook" });
    expect(diagnostics, `@${spec.name} put down as:\n${source}\n`).toEqual([]);
  });

  it.each(built)("@%s renders with nothing to complain about, whole body", (_name, spec) => {
    const source = scaffoldSource(spec, { body: "whole" });
    const { diagnostics } = render(source, { mode: "notebook" });
    expect(diagnostics, `@${spec.name} put down as:\n${source}\n`).toEqual([]);
  });

  it("fills a required parameter with the value its example uses", () => {
    // `x="Effort"` reads as an axis on the page; `x="x"` reads as a bug.
    const matrix = PRIMITIVES.find((p) => p.name === "matrix")!;
    expect(scaffoldSource(matrix).split("\n")[0]).toBe('@matrix x="Effort" y="Impact"');
  });

  it("writes no optional parameter", () => {
    // The playground shows those beside the block, to be added, rather than
    // putting them in for the author to delete.
    const panel = PRIMITIVES.find((p) => p.name === "panel")!;
    expect(scaffoldSource(panel)).not.toMatch(/accent=|badge=|label=/);
  });
});
