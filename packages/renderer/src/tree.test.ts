import { describe, expect, it } from "vitest";
import { render } from "./index.js";
import { renderLayoutCss } from "./layout.js";
import { PAGE } from "./page.js";
import { MIN_SCALE_BEFORE_LANDSCAPE, TREE, chartStack, resolveLook } from "./tree.js";
import { colors } from "./tokens.js";

const figure = (src: string) => {
  const { html, diagnostics } = render(src, { mode: "notebook" });
  const tag = /<div class="jot-figure"([^>]*)>/.exec(html)?.[1] ?? "";
  const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];
  const w = Number(/--jot-w:(\d+)/.exec(tag)?.[1] ?? NaN);
  const h = Number(/--jot-h:(\d+)/.exec(tag)?.[1] ?? NaN);
  return { html, diagnostics, tag, w, h, look: attr("data-look"), width: attr("data-width"), landscape: /data-page="landscape"/.test(tag), tall: /data-tall/.test(tag) };
};
const tree = (dir: string, nodes: string, body: string, extra = "") =>
  `@tree(dir=${dir} nodes=${nodes}${extra ? " " + extra : ""})\n${body}`;
const lines = (...rows: string[]) => rows.map((r) => "  " + r).join("\n");
/** A chart with `n` branches of two leaves each — as wide as n families side by side. */
const families = (n: number) =>
  [
    "@tree(dir=down nodes=boxed)",
    "  Root",
    ...Array.from({ length: n }, (_, i) => [`    Branch number ${i}`, `      leaf a${i}`, `      leaf b${i}`]).flat(),
  ].join("\n");

describe("@tree — dir means the way it grows (UX-28)", () => {
  it("maps dir and nodes onto the four layouts", () => {
    expect(resolveLook("down", "text")).toBe("outline");
    expect(resolveLook("right", "text")).toBe("columns");
    expect(resolveLook("right", "boxed")).toBe("columns");
    expect(resolveLook("down", "boxed")).toBe("chart");
    expect(resolveLook("split", "text")).toBe("split");
    expect(resolveLook("split", "boxed")).toBe("split");
  });

  it("leaves the default outline exactly as it was: no size, no scaling", () => {
    const f = figure("@tree\n  A\n    B");
    expect(f.look).toBe("outline");
    // An outline wraps like prose, so it is never measured or scaled.
    expect(f.tag).not.toContain("--jot-w");
  });

  it("no longer accepts dir=left or dir=up (PRD-20)", () => {
    for (const dir of ["left", "up"]) {
      const { diagnostics } = render(`@tree dir=${dir}\n  A\n    B`, { mode: "notebook" });
      expect(diagnostics.some((d) => d.severity === "error" && d.message.includes("down, right, split"))).toBe(true);
    }
  });
});

describe("@tree — the chart stacks leaves and spreads branches (UX-30)", () => {
  it("stacks a family whose children are all leaves, and spreads any other", () => {
    const { html } = render(tree("down", "boxed", lines("Root", "  Stacked", "    a", "    b", "  Spread", "    Deeper", "      x", "    leaf")), { mode: "notebook" });
    expect(html).toMatch(/data-role="root" data-flow="spread"/);
    expect(html).toMatch(/data-role="branch" data-flow="stack"><span class="jot-tree-label"><span class="jot-tree-text">Stacked/);
    expect(html).toMatch(/data-role="branch" data-flow="spread"><span class="jot-tree-label"><span class="jot-tree-text">Spread/);
  });

  it("marks every node's role, which is what the two shades hang on", () => {
    const { html } = render(tree("down", "boxed", lines("R", "  B", "    L")), { mode: "notebook" });
    expect(html).toContain('data-role="root"');
    expect(html).toContain('data-role="branch"');
    expect(html).toContain('data-role="leaf"');
  });
});

describe("@tree — sizes are predicted, not discovered (ARC-15)", () => {
  // Checked against the browser on 2026-09-22 across 15 trees, including both
  // reference diagrams: every predicted height exact, every predicted width
  // 0–6% wide of the real one. These tests pin the formulas that got there.

  it("predicts heights in whole rows for every layout", () => {
    const R = TREE.row;
    expect(figure(tree("right", "text", lines("A", "  B", "  C", "    D"))).h).toBe(2 * R); // leaves
    expect(figure(tree("right", "boxed", lines("A", "  B", "  C"))).h).toBe(2 * R);
    // chart: root row + connector row + the stack (parent + 2 leaves)
    expect(figure(tree("down", "boxed", lines("A", "  B", "    x", "    y"))).h).toBe(5 * R);
    expect(figure(tree("split", "text", lines("Hub", "  > a", "    a1", "  < b"))).h).toBe(2 * R);
  });

  it("costs the centre attach style exactly one more row per stack", () => {
    const src = tree("down", "boxed", lines("A", "  x", "  y"));
    chartStack.attach = "centre";
    const centre = figure(src).h;
    chartStack.attach = "rail";
    expect(centre - figure(src).h).toBe(TREE.row);
  });

  it("does not count a parent's outgoing line as width", () => {
    // It reaches into the gap on a negative margin, so it adds nothing; counting
    // it over-estimated a four-level chain by 37% and would have sent trees
    // that fit portrait to a landscape page.
    const chain = figure(tree("right", "text", lines("A", "  B", "    C", "      D"))).w;
    const flat = figure(tree("right", "text", lines("A", "  B"))).w;
    // Two more one-letter levels cost two gaps and two letters — nowhere near 2×14px of stub.
    expect(chain - flat).toBeLessThan(2 * TREE.gap + 2 * 14);
  });
});

describe("@tree — a figure always fits its page (UX-31)", () => {
  it("stays in the text column when it fits", () => {
    const f = figure(tree("right", "text", lines("A", "  B")));
    expect(f.width).toBe("column");
    expect(f.landscape).toBe(false);
  });

  it("takes the full width as soon as it is wider than the column", () => {
    const f = figure(tree("split", "text", lines("Central idea", "  > Pillar A", "    > Sub-point", "  Pillar B", "    Sub-point")));
    expect(f.w).toBeGreaterThan(PAGE.portrait.column);
    expect(f.width).toBe("full");
    expect(f.landscape).toBe(false);
  });

  it("shrinks up to 10% rather than taking a landscape page", () => {
    // The Table reference is 1px wider than a portrait page. Sending it to a
    // landscape sheet over that would be absurd.
    expect(MIN_SCALE_BEFORE_LANDSCAPE).toBe(0.9);
    // The widest label of each level of the Table reference, as one chain: the
    // same five column widths, so the same total width as the whole diagram.
    const { diagnostics, landscape, width, w } = figure(
      "@tree dir=right\n" + lines("Table", "  Keyboard support", "    Command format", "      Enabled destructive", "        Alphanumeric"),
    );
    expect(w).toBeGreaterThan(PAGE.portrait.content);
    expect(w * MIN_SCALE_BEFORE_LANDSCAPE).toBeLessThanOrEqual(PAGE.portrait.content);
    expect(landscape).toBe(false);
    expect(width).toBe("full");
    // Inside the band this is expected behaviour, so it is a note, not a warning.
    expect(diagnostics.find((d) => d.message.startsWith("Scaled to"))?.severity).toBe("info");
  });

  it("moves to a landscape page when it would otherwise shrink below 90%", () => {
    const f = figure(families(9));
    expect(f.w * MIN_SCALE_BEFORE_LANDSCAPE).toBeGreaterThan(PAGE.portrait.content);
    expect(f.landscape).toBe(true);
  });

  it("warns — and suggests growing down instead — when even a landscape page is too narrow", () => {
    const f = figure(families(30));
    expect(f.w * MIN_SCALE_BEFORE_LANDSCAPE).toBeGreaterThan(PAGE.landscape.content);
    expect(f.landscape).toBe(true);
    const warning = f.diagnostics.find((d) => d.severity === "warning");
    expect(warning?.message).toMatch(/scaled to \d+% to fit\. dir=right grows down the page/);
  });

  it("lets the author pin the width, and says when a pin forces scaling", () => {
    expect(figure(tree("right", "text", lines("A", "  B"), "width=landscape")).landscape).toBe(true);
    expect(figure(tree("right", "text", lines("A", "  B"), "width=full")).width).toBe("full");
    // Four levels of 30-character labels: far wider than the text column.
    const pinned = figure(
      tree("right", "text", lines("x".repeat(30), "  " + "y".repeat(30), "    " + "z".repeat(30), "      " + "w".repeat(30)), "width=column"),
    );
    expect(pinned.w).toBeGreaterThan(PAGE.portrait.column);
    expect(pinned.width).toBe("column");
    expect(pinned.diagnostics.some((d) => d.severity === "info" && /scaled to \d+%/.test(d.message))).toBe(true);
  });

  it("marks a figure taller than a page, so print may break it between rows", () => {
    const tall = figure("@tree dir=right\n" + lines("Root", ...Array.from({ length: 40 }, (_, i) => `  item ${i}`)));
    expect(tall.h).toBeGreaterThan(PAGE.portrait.rows * TREE.row);
    expect(tall.tall).toBe(true);
    expect(figure(tree("right", "text", lines("A", "  B"))).tall).toBe(false);
  });
});

describe("@tree — the stylesheet keeps the promises", () => {
  const css = renderLayoutCss();

  it("scales every length together and rounds the figure up to whole rows", () => {
    expect(css).toContain("--u: min(1px, calc(100cqw / var(--jot-w)));");
    expect(css).toContain("height: round(up, calc(var(--jot-h) * var(--u)), 28px);");
    expect(css).toMatch(/\.jot-body:has\(> \.jot-figure\) \{ container-type: inline-size; \}/);
  });

  it("out-ranks the prose list rules, which once kept a scaled tree's text at 16px", () => {
    // .jotstak .jot-body li is (0,2,1); the tree's node rule must beat it.
    expect(css).toMatch(/\.jotstak \.jot-tree \.jot-tree-node \{[^}]*font-size: calc\(16 \* var\(--u, 1px\)\)/);
  });

  it("dashes only the sides a connector draws", () => {
    // border-style on the whole element switched on three extra 3px borders.
    expect(css).toContain('.jot-tree[data-style="dashed"] { --jot-tree-line-style: dashed; }');
    expect(css).not.toMatch(/\.jot-tree\[data-style="dashed"\][^{]*\{[^}]*border-style: dashed/);
  });

  it("never lets a tree scroll sideways", () => {
    expect(css).not.toMatch(/\.jot-tree[^{]*\{[^}]*overflow-x/);
  });
});

describe("@tree — pill shades pass WCAG AA (UX-29)", () => {
  const lum = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string): number => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };

  it("keeps ink readable on every fill, in both modes", () => {
    const notebook = { leaf: colors.notebook.paperElevated, branch: colors.notebook.ruleLines, root: colors.accent.terracottaPale };
    const doc = { leaf: colors.doc.sheet, branch: colors.doc.viewport, root: colors.accent.terracottaPale };
    for (const [role, fill] of Object.entries(notebook)) {
      expect(contrast(colors.notebook.ink, fill), `notebook ${role}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const [role, fill] of Object.entries(doc)) {
      expect(contrast(colors.doc.ink, fill), `doc ${role}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses those same tokens in the stylesheet", () => {
    const css = renderLayoutCss();
    expect(css).toContain("--pill-leaf-fill: var(--jot-color-notebook-paper-elevated);");
    expect(css).toContain("--pill-branch-fill: var(--jot-color-notebook-rule-lines);");
    expect(css).toContain("--pill-root-fill: var(--jot-color-accent-terracotta-pale);");
    expect(css).toContain("--pill-branch-fill: var(--jot-color-doc-viewport);");
  });
});
