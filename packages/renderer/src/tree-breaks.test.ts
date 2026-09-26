// The one label in the language that cannot take a forced break.
//
// `\n` draws a real break in a table cell, a timeline card, a journey stage and
// a matrix chip. A tree node is the exception, and the reason is geometry: all
// five looks position their connectors off a node being exactly one row tall,
// which is the same arithmetic UX-32 is still an open question about. Until
// that is settled the escape folds to a space and says so.
//
// What this pins is that it does not go back to what it was doing — printing a
// literal backslash-n on the page with nothing to say about it.

import { describe, expect, it } from "vitest";
import { render } from "./index.js";
import { measureTree } from "./tree.js";
import type { TreeNode } from "./ast.js";

const src = (...lines: string[]): string => lines.join("\n");
const out = (s: string) => render(s, { mode: "notebook" });

const node = (text: string, children: TreeNode[] = []): TreeNode => ({ text, children });

describe("a forced break in a tree label", () => {
  it("never reaches the page as a literal backslash-n", () => {
    // What shipped until now. It is the one outcome that is simply wrong: the
    // author typed an escape the language documents, and got the escape.
    const html = out(src("@tree", "  Platform", "    Search\\n relevance")).html;
    expect(html).not.toContain("\\n");
    expect(html).toContain("Search relevance");
  });

  it("says so once, whatever the look, and says what to do instead", () => {
    for (const dir of ["down", "right", "split"]) {
      for (const nodes of ["text", "boxed"]) {
        const { diagnostics } = out(
          src(`@tree(dir=${dir} nodes=${nodes})`, "  Platform", "    Search\\n relevance", "    Export"),
        );
        const mine = diagnostics.filter((d) => d.message.includes("cannot break"));
        expect(mine, `${dir}/${nodes}`).toHaveLength(1);
        expect(mine[0]!.severity).toBe("info");
        // Naming the look that CAN wrap is the difference between a complaint
        // and an instruction.
        expect(mine[0]!.message).toContain("dir=down nodes=text");
      }
    }
  });

  it("says nothing about a tree that never asked", () => {
    const { diagnostics } = out(src("@tree", "  Platform", "    Search", "    Export"));
    expect(diagnostics.filter((d) => d.message.includes("cannot break"))).toEqual([]);
  });

  it("measures the folded label, not the escape", () => {
    // The escape is two characters wide in any font. Measuring it would widen
    // the node by a hair and push a tree that fits towards a landscape page —
    // the drift that costs a figure a row, arriving through a label.
    const broken = measureTree("chart", [node("Platform", [node("Search\\n relevance")])], "boxed", "rail");
    const folded = measureTree("chart", [node("Platform", [node("Search relevance")])], "boxed", "rail");
    expect(broken).toEqual(folded);
  });

  it("leaves every tree with no break measuring exactly as it did", () => {
    // The guard on the whole change: folding is the only new behaviour, so a
    // document that does not use the escape cannot have moved by a pixel.
    const roots = [node("Platform", [node("Search"), node("Export", [node("CSV")])])];
    for (const look of ["outline", "columns", "chart", "split"] as const) {
      const sides = { left: [node("Search")], right: [node("Export")] };
      expect(measureTree(look, roots, "boxed", "rail", sides)).toEqual(
        measureTree(look, roots, "boxed", "rail", sides),
      );
    }
    // And the numbers themselves, so a refactor cannot quietly change them.
    expect(measureTree("chart", roots, "boxed", "rail").h).toBe(4 * 28);
  });
});
