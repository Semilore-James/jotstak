// A forced break in a tree label.
//
// This was the last label in the language that could not take one, and the
// reason was never effort: every one of the tree's looks positioned its
// connectors off a node being exactly one row tall, and UX-32 — where a
// stacked family's line leaves its parent pill — was an open question about
// that same arithmetic. Building the break first would have meant deriving the
// connector geometry twice. UX-32 settled on 2026-09-27; this followed it.
//
// What made it cheap in the end was one decision: a line meets a node at the
// middle of its FIRST row. Siblings of different heights then connect at the
// same offset from their own top, a column of connectors stays level, and not
// one existing `top` value had to change.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";
import { measureTree, TREE } from "./tree.js";
import type { TreeNode } from "./ast.js";

const src = (...lines: string[]): string => lines.join("\n");
const out = (s: string) => render(s, { mode: "notebook" });
const node = (text: string, children: TreeNode[] = []): TreeNode => ({ text, children });
const height = (html: string): number | null => {
  const m = /--jot-h:(\d+)/.exec(html);
  return m ? Number(m[1]) : null;
};

/** Every shape of tree the language draws, as (dir, nodes). */
const LOOKS: [string, string][] = [
  ["down", "text"],
  ["right", "text"],
  ["right", "boxed"],
  ["down", "boxed"],
  ["split", "text"],
  ["split", "boxed"],
];

const tree = (dir: string, nodes: string, ...body: string[]): string =>
  src(`@tree(dir=${dir} nodes=${nodes})`, ...body);

describe("drawing the break", () => {
  it.each(LOOKS)("%s / %s draws it", (dir, nodes) => {
    const marker = dir === "split" ? "> " : "";
    const { html, diagnostics } = out(
      tree(dir, nodes, "  Platform", `    ${marker}Search\\n relevance`, `    ${marker}Export`),
    );
    expect(diagnostics).toEqual([]);
    expect(html).toContain("Search<br>relevance");
    // No literal backslash-n anywhere. That is what shipped before this: the
    // author typed an escape the language documents, and got the escape.
    expect(html).not.toContain("\\n");
  });

  it("marks the node so the stylesheet can release its hold", () => {
    // A tree is a diagram. A label left free to wrap would re-shape a figure
    // the renderer has already measured and placed, so every look holds its
    // labels to one line — and only a node that asked gets let go.
    const html = out(tree("right", "boxed", "  Platform", "    Search\\n relevance", "    Export")).html;
    expect(html).toContain('data-rows="2"');
    expect(html.match(/data-rows/g)).toHaveLength(1);

    const css = renderLayoutCss();
    expect(css).toContain("[data-rows] > .jot-tree-label");
    expect(css).toContain("white-space: normal");
  });

  it("leaves a label with no break on one line", () => {
    const html = out(tree("right", "boxed", "  Platform", "    Search")).html;
    expect(html).not.toContain("<br>");
    expect(html).not.toContain("data-rows");
  });
});

describe("measuring the break", () => {
  it.each(LOOKS)("%s / %s is taller for it, in whole rows", (dir, nodes) => {
    const marker = dir === "split" ? "> " : "";
    const flat = out(tree(dir, nodes, "  Platform", `    ${marker}Search relevance`)).html;
    const broken = out(tree(dir, nodes, "  Platform", `    ${marker}Search\\n relevance`)).html;

    // The outline is never sized — it wraps like prose — so it has no height
    // to compare. Every other look does.
    if (height(flat) === null) return;
    expect(height(broken)!).toBeGreaterThan(height(flat)!);
    expect(height(broken)! % TREE.row).toBe(0);
  });

  it("is as wide as its widest line, not as wide as both", () => {
    // Measuring the unbroken string would size a column for text that is no
    // longer on one line, and push a tree that fits towards a landscape page.
    const wide = measureTree("columns", [node("Platform", [node("Search relevance")])], "boxed");
    const broken = measureTree("columns", [node("Platform", [node("Search\\nrelevance")])], "boxed");
    expect(broken.w).toBeLessThan(wide.w);
    expect(broken.h).toBeGreaterThan(wide.h);
  });

  it("counts a hub that breaks, which nothing used to", () => {
    // Found by looking, not by arithmetic. A hub was one row like everything
    // else, so the taller SIDE always won and the hub's own height was never
    // in the sum. A two-line hub with one branch either side reported one row
    // while its pill ran 26px out of the bottom of the figure — declared and
    // drawn agreeing at 28 the whole time, because both came from the same
    // wrong number.
    const flat = out(tree("split", "boxed", "  Platform", "    > Search", "    < Export")).html;
    const broken = out(tree("split", "boxed", "  Platform\\n and tools", "    > Search", "    < Export")).html;
    expect(height(flat)).toBe(TREE.row);
    expect(height(broken)).toBe(2 * TREE.row);
  });

  it("lets a parent be taller than the family beside it", () => {
    // The columns look takes its height from the LEAVES, so a two-line parent
    // with one one-line child would otherwise overflow its own column and push
    // the level below it up the page.
    const parent = measureTree("columns", [node("Platform\\nand tools", [node("Search")])], "boxed");
    expect(parent.h).toBe(2 * TREE.row);
  });

  it("counts three lines as three rows", () => {
    const html = out(tree("right", "boxed", "  Platform", "    Search\\n and\\n relevance")).html;
    expect(html).toContain('data-rows="3"');
    expect(height(html)).toBe(3 * TREE.row);
  });
});

describe("what a tree with no break does", () => {
  it("measures exactly what it did before labels could break", () => {
    // The guard on the whole change. Breaking is the only new behaviour, so a
    // document that does not use the escape cannot have moved by a pixel.
    const roots = [node("Platform", [node("Search"), node("Export", [node("CSV")])])];
    const sides = { left: [node("Search")], right: [node("Export")] };
    expect(measureTree("columns", roots, "boxed").h).toBe(2 * TREE.row);
    // Platform spreads to Search and Export; Export is a stack, so it spends a
    // row on the jog out of it (UX-32).
    expect(measureTree("chart", roots, "boxed").h).toBe(5 * TREE.row);
    expect(measureTree("split", roots, "boxed", sides).h).toBe(TREE.row);
    expect(measureTree("outline", roots, "text").h).toBe(4 * TREE.row);
  });
});
