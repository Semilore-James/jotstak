import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, renderLayoutCss, BASELINE_OFFSET, toWholeRows } from "./index.js";
import { spacing } from "./tokens.js";

const ROW = spacing.baselineGrid;

/**
 * The layout CSS minus the rules that deliberately sit off-grid. Each is an
 * INLINE box, and an inline box taller than the line's strut stretches the line
 * — so these are capped below a row on purpose rather than snapped to one.
 */
function gridLineHeights(): string {
  return renderLayoutCss()
    .replace(/\.jot-body code \{[^}]*\}/g, "")
    .replace(/\.jot-body \.jot-metric-value \{[^}]*\}/g, "")
    .replace(/\.jot-body \.jot-metric-target,[\s\S]*?\}/g, "")
    .replace(/\.jot-badge \{[^}]*\}/g, "")
    .replace(/\.jot-body mark \{[^}]*\}/g, "");
}

/**
 * The declaration block of a BASE rule (no `[data-mode=...]` prefix).
 * Needed because doc-mode rules also contain `.jot-card {`, so a bare regex
 * happily matches the wrong one.
 */
function baseRule(sel: string): string {
  const css = renderLayoutCss();
  const needle = `
.jotstak ${sel} {`;
  const at = css.indexOf(needle);
  if (at === -1) return "";
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open, close + 1);
}

describe("render — document shell", () => {
  it("wraps output in the scope class and declares the mode", () => {
    const { html } = render("# Title", { mode: "notebook" });
    expect(html).toContain('class="jotstak"');
    expect(html).toContain('data-mode="notebook"');
  });

  it("honours a custom scope", () => {
    const { html } = render("# Title", { mode: "doc", scope: "my-doc" });
    expect(html).toContain('class="my-doc"');
    expect(html).toContain('data-mode="doc"');
  });

  it("renders the same source in both modes", () => {
    const src = "# Title\n\nSome prose.";
    const nb = render(src, { mode: "notebook" }).html;
    const doc = render(src, { mode: "doc" }).html;
    expect(nb).toContain("Some prose.");
    expect(doc).toContain("Some prose.");
    // Only the mode attribute differs — the markup is shared.
    expect(nb.replace('data-mode="notebook"', "MODE")).toBe(doc.replace('data-mode="doc"', "MODE"));
  });
});

describe("render — structure", () => {
  it("puts a margin note in the aside cell beside its anchor", () => {
    const { html } = render("Some prose.\n>> a note", { mode: "notebook" });
    const row = /<div class="jot-body"[^>]*>(.*?)<\/div><div class="jot-aside">(.*?)<\/div>/s.exec(html);
    expect(row).not.toBeNull();
    expect(row![1]).toContain("Some prose.");
    expect(row![2]).toContain("a note");
    expect(row![2]).toContain("jot-note");
  });

  it("renders a @decision as a card with its fields", () => {
    const { html } = render(
      '@decision title="Use Astro" status=accepted\n  context: local-first\n  choice: Astro on Pages',
      { mode: "notebook" },
    );
    expect(html).toContain('class="jot-card"');
    expect(html).toContain('data-primitive="decision"');
    expect(html).toContain("Use Astro");
    expect(html).toContain("accepted");
    expect(html).toContain("context");
    expect(html).toContain("local-first");
  });

  it("renders headings, lists, quotes and dividers", () => {
    const { html } = render("# H\n\n- one\n- two\n\n> quoted\n\n---", { mode: "notebook" });
    expect(html).toContain("jot-h1");
    expect(html).toContain("<ul>");
    expect(html).toContain("jot-quote");
    expect(html).toContain("jot-divider");
  });

  it("keeps an unrendered primitive's content instead of dropping it", () => {
    // @star_model has no renderer yet. Until it does, its content must still
    // appear, with an info diagnostic rather than silence — a half-written
    // document should render something.
    const { html, diagnostics } = render("@star_model Orders\n  fact: Orders\n  dim Customer", {
      mode: "notebook",
    });
    expect(html).toContain("Customer");
    expect(diagnostics.some((d) => d.message.includes("no renderer yet"))).toBe(true);
  });
});

describe("render — safety", () => {
  it("escapes raw HTML in source rather than passing it through", () => {
    const { html } = render("A <script>alert(1)</script> line", { mode: "notebook" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML inside block params", () => {
    const { html } = render('@decision title="<img onerror=x>"\n  context: y', { mode: "notebook" });
    expect(html).not.toContain("<img onerror");
  });
});

describe("render — the ruled-line contract", () => {
  it("rounds heights up to whole rows", () => {
    expect(toWholeRows(1)).toBe(ROW);
    expect(toWholeRows(ROW)).toBe(ROW);
    expect(toWholeRows(ROW + 1)).toBe(ROW * 2);
    expect(toWholeRows(93)).toBe(112);
  });

  it("puts the baseline inside the row, not at its edge", () => {
    // Text sitting ON the rule means the rule is drawn near the baseline,
    // which is well down the row — not at 0 and not at the bottom edge.
    expect(BASELINE_OFFSET).toBeGreaterThan(ROW * 0.5);
    expect(BASELINE_OFFSET).toBeLessThan(ROW);
  });

  it("sizes card chrome so border plus padding is exactly one row", () => {
    const card = baseRule(".jot-card");
    const padding = Number(/padding:\s*(\d+)px/.exec(card)![1]);
    const border = Number(/border:\s*(\d+)px/.exec(card)![1]);
    expect((padding + border) * 2).toBe(ROW);
  });

  it("gives drawn blocks a whole row of clearance below", () => {
    // Half a row above and below was an inline-flow idea. Every block is its
    // own grid cell now, so the gap between two blocks is one block's bottom
    // margin — and a full row survives the first-child margin-top reset.
    expect(baseRule(".jot-card")).toContain(`margin: 0 0 ${ROW}px`);
  });

  it("makes drawn blocks opaque so they clear the ruling", () => {
    expect(baseRule(".jot-card")).toContain("background: var(--jot-surface-elevated)");
  });

  it("contains cell margins so the phase cannot drift", () => {
    // Without flow-root, margins collapse out of a grid cell and gaps stop being
    // row multiples — which is precisely how the baseline drifts down a page.
    expect(renderLayoutCss()).toContain("display: flow-root");
  });

  it("draws the ruling only in notebook mode", () => {
    const css = renderLayoutCss();
    expect(css).toContain('[data-mode="notebook"] .jot-body');
    expect(css).toContain('[data-mode="doc"] .jot-body { background-image: none; }');
  });

  it("uses whole-row line heights for every block element", () => {
    // Three deliberate exceptions, all inline boxes that must stay BELOW the
    // strut rather than on the grid, because an inline box taller than the strut
    // grows the line it sits in. Each is asserted separately.
    for (const [, value] of gridLineHeights().matchAll(/line-height:\s*(\d+)px/g)) {
      expect(Number(value) % ROW).toBe(0);
    }
  });
});

describe("render — the sample document", () => {
  const sample = readFileSync(
    join(import.meta.dirname, "..", "..", "..", "samples", "problem-statement.jot"),
    "utf8",
  );

  it("renders with no errors or warnings", () => {
    const { diagnostics } = render(sample, { mode: "notebook" });
    const bad = diagnostics.filter((d) => d.severity !== "info");
    expect(bad).toEqual([]);
  });

  it("produces the card, the notes and the prose", () => {
    const { html } = render(sample, { mode: "notebook" });
    expect(html).toContain("jot-card");
    expect(html).toContain("jot-note");
    expect(html).toContain("Fragmentation leads");
    expect((html.match(/jot-note/g) ?? []).length).toBe(4);
  });
});

describe("render — plain Markdown", () => {
  it("renders a .md file with no diagnostics at all", () => {
    const md = [
      "# My Document",
      "",
      "Some paragraph with **bold** and *italic* and a [link](https://example.com).",
      "",
      "- List item one",
      "  - Nested item",
      "- List item two",
      "",
      "> A blockquote",
      "",
      "---",
      "",
      "1. Numbered",
      "2. Items",
    ].join("\n");

    const { html, diagnostics } = render(md, { mode: "notebook" });
    expect(diagnostics).toEqual([]);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("Nested item");
  });
});

describe("render — regressions found by rendering real documents", () => {
  const css = renderLayoutCss();

  it("keeps fenced code literal instead of parsing its contents", () => {
    const src = ["Intro.", "", "```bash", "# not a heading", "- not a bullet", "```", "", "After."].join("\n");
    const { html, diagnostics } = render(src, { mode: "notebook" });
    expect(diagnostics).toEqual([]);
    expect(html).toContain("<pre>");
    expect(html).toContain("# not a heading");
    expect(html).not.toMatch(/<h1[^>]*>.*not a heading/);
    expect(html).not.toContain("<li>not a bullet</li>");
  });

  it("warns about an unclosed fence rather than silently eating the document", () => {
    const { diagnostics } = render("text\n\n```js\nconst a = 1;", { mode: "notebook" });
    expect(diagnostics.some((d) => d.message.includes("Unclosed"))).toBe(true);
  });

  it("wraps long code lines rather than scrolling them", () => {
    // A horizontal scrollbar is ~15px tall and is not a row multiple, so it
    // knocks every line below the block off the ruling.
    const declarations = baseRule(".jot-body pre").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(declarations).toContain("white-space: pre-wrap");
    expect(declarations).not.toContain("overflow-x");
  });

  it("caps inline code below the line strut so it cannot grow the row", () => {
    const lh = Number(/line-height:\s*(\d+)px/.exec(baseRule(".jot-body code"))![1]);
    expect(lh).toBeLessThan(ROW);
  });

  it("row-disciplines the margin channel, not just the body column", () => {
    // A grid row is as tall as its tallest cell, so an undisciplined note sets
    // the row height and pushes everything below it off the ruling.
    expect(css).toContain(".jot-aside { display: flow-root; }");
    expect(css).toMatch(/\.jot-aside > \* \{[^}]*margin-bottom: 28px/);
  });

  it("styles Markdown tables onto the grid", () => {
    const { html } = render("| a | b |\n| --- | --- |\n| 1 | 2 |", { mode: "notebook" });
    expect(html).toContain("<table>");
    const table = /\.jot-body table \{[^}]*\}/.exec(css)![0];
    expect(table).toContain("border-collapse: collapse");
    // A header border would add 1px and break the row; an inset shadow does not.
    expect(/\.jot-body thead th \{[^}]*\}/.exec(css)![0]).toContain("box-shadow: inset");
  });
});

describe("render — M2 primitives", () => {
  it("renders every card primitive with a kicker and badge", () => {
    const cases: [string, string, string][] = [
      ["risk", '@risk(level=high title="Churn")\n  mitigation: grandfather plans', "high"],
      ["assumption", '@assumption(title="They accept" confidence=medium)\n  validation: ask 5', "medium"],
      ["decision", '@decision(title="Ship it" status=accepted)\n  context: x', "accepted"],
      ["metric", '@metric(name="WAU" value="1,240" status=on-track)', "on-track"],
    ];
    for (const [name, src, badge] of cases) {
      const { html, diagnostics } = render(src, { mode: "notebook" });
      expect(diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
      expect(html).toContain(`data-primitive="${name}"`);
      expect(html).toContain("jot-card-kicker");
      expect(html).toContain(`<span class="jot-badge"`);
      expect(html).toContain(badge);
    }
  });

  it("marks dangerous badge values as alerts", () => {
    expect(render('@risk(level=critical title="x")', { mode: "notebook" }).html).toContain('data-alert="true"');
    expect(render('@risk(level=low title="x")', { mode: "notebook" }).html).not.toContain('data-alert="true"');
  });

  it("leads @metric with the value and a trend arrow", () => {
    const { html } = render('@metric(name="WAU" value="1,240" target="2,000" trend=up)', { mode: "notebook" });
    expect(html).toContain("jot-metric-value");
    expect(html).toContain("1,240");
    expect(html).toContain('data-trend="up"');
    expect(html).toContain("target 2,000");
  });

  it("renders @quote with the attribution @evidence used to carry", () => {
    const { html } = render('@quote(by="P7" source="Interview 3" tag=pricing)\n  It cost money.', {
      mode: "notebook",
    });
    expect(html).toContain("jot-quote");
    expect(html).toContain("P7 · Interview 3");
    expect(html).toContain("pricing");
  });

  it("colours a callout by its flavor, taken from the shortcode", () => {
    expect(render("@warn\n  careful", { mode: "notebook" }).html).toContain('data-flavor="warn"');
    expect(render("@tip\n  handy", { mode: "notebook" }).html).toContain('data-flavor="tip"');
    expect(render("@callout question\n  really?", { mode: "notebook" }).html).toContain('data-flavor="question"');
  });

  it("renders @meta as a chip row, and honours show=false", () => {
    const shown = render("@meta\n  project: Jotstak\n  status: active", { mode: "notebook" }).html;
    expect(shown).toContain("jot-meta");
    expect(shown).toContain("jot-chip");
    const hidden = render("@meta(show=false)\n  project: Jotstak", { mode: "notebook" }).html;
    expect(hidden).not.toContain("jot-meta");
  });

  it("does not render @page, which configures rather than displays", () => {
    const { html, diagnostics } = render("@page(margin=both rule=ruled)", { mode: "notebook" });
    expect(html).not.toContain("jot-card");
    expect(diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("tags each row with its kind so spacing can be contextual", () => {
    const { html } = render("> a\n\n> b\n\n---", { mode: "notebook" });
    expect(html).toContain('data-kind="quote"');
    expect(html).toContain('data-kind="divider"');
  });

  it("keeps every new block's line heights on the grid", () => {
    const css = renderLayoutCss();
    // The large @metric figure is the deliberate exception: its inline box is
    // capped with line-height:1 so it cannot stretch the line it sits on.
    for (const [, v] of gridLineHeights().matchAll(/line-height:\s*(\d+)px/g)) {
      expect(Number(v) % ROW).toBe(0);
    }
  });
});

describe("render — the showcase document", () => {
  const sample = readFileSync(
    join(import.meta.dirname, "..", "..", "..", "samples", "showcase.jot"),
    "utf8",
  );

  it("renders every primitive it uses with no errors or warnings", () => {
    const { html, diagnostics } = render(sample, { mode: "notebook" });
    expect(diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
    for (const p of ["meta", "risk", "metric", "quote", "decision", "assumption", "persona"]) {
      expect(html, `missing @${p}`).toContain(p);
    }
  });

  it("renders in doc mode from the same source", () => {
    const nb = render(sample, { mode: "notebook" }).html.replace('data-mode="notebook"', "M");
    const doc = render(sample, { mode: "doc" }).html.replace('data-mode="doc"', "M");
    expect(nb).toBe(doc);
  });
});

describe("render — body prose is prose, not a list", () => {
  it("does not turn sentences in a card body into bullets", () => {
    const { html } = render(
      '@risk(level=high title="Churn")\n  mitigation: Grandfather plans.\n  Small teams pay less, but they are also the loudest\n  segment and the first to post.',
      { mode: "notebook" },
    );
    expect(html).not.toContain("<li>Small teams");
    expect(html).toContain("<p>Small teams");
  });

  it("joins a wrapped line instead of making it a second item", () => {
    const { html } = render(
      '@risk(level=low title="X")\n  A sentence that wraps onto\n  a second line.',
      { mode: "notebook" },
    );
    expect(html).toMatch(/A sentence that wraps onto\s*\n?\s*a second line\./);
    expect((html.match(/<li>/g) ?? []).length).toBe(0);
  });

  it("still makes a real list when the author writes one", () => {
    const { html } = render('@risk(level=low title="X")\n  Prose.\n  - a bullet\n  - another', {
      mode: "notebook",
    });
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).toContain("<p>Prose.</p>");
  });
});

describe("render — doc mode is designed, not just undecorated", () => {
  const css = renderLayoutCss();
  /** The declaration block of the first doc-mode rule mentioning `sel`. */
  const docRule = (sel: string): string => {
    const needle = `[data-mode="doc"] ${sel} {`;
    const at = css.indexOf(needle);
    if (at === -1) return "";
    const open = css.indexOf("{", at);
    const close = css.indexOf("}", open);
    return open === -1 || close === -1 ? "" : css.slice(open, close + 1);
  };

  it("gives doc mode a sheet on a backing, not a bare page", () => {
    expect(css).toContain('[data-mode="doc"] .jot-doc');
    expect(docRule(".jot-doc")).toContain("--jot-color-doc-sheet");
  });

  it("keeps cards legible as cards rather than deleting them", () => {
    // The structure the author wrote must still read in doc mode, or writing
    // .jot instead of Markdown buys nothing on export.
    const card = docRule(".jot-card");
    expect(card).toContain("border-top");
    expect(card).not.toContain("display: none");
  });

  it("keeps doc-mode chrome on the row contract", () => {
    // A redesign that forgets the arithmetic breaks the rhythm just as surely
    // as a maths error: border-top 1px + 13 + 14 padding is one row.
    const card = docRule(".jot-card");
    const pad = /padding:\s*(\d+)px 0 (\d+)px/.exec(card);
    const border = /border-top:\s*(\d+)px/.exec(card);
    expect(pad).not.toBeNull();
    expect(Number(pad![1]) + Number(pad![2]) + Number(border![1])).toBe(ROW);
  });

  it("sets margin notes in the body face rather than handwriting", () => {
    expect(docRule(".jot-note")).toContain("border-left");
  });
});

describe("render — nested blocks keep the row contract", () => {
  it("normalises nested children's margins", () => {
    // `.jot-body > *` only reaches DIRECT children, so a nested blockquote kept
    // its browser-default 16px margin and pushed its parent 2px off a row.
    const css = renderLayoutCss();
    expect(css).toMatch(/\.jot-nested \{[^}]*display: flow-root/);
    expect(css).toMatch(/\.jot-nested > \* \{[^}]*margin-bottom: 28px/);
  });

  it("renders a nested block inside its parent's markup", () => {
    const { html } = render(
      '@decision(title="Outer")\n  context: a\n\n  @metric(name="Inner" value="1")',
      { mode: "notebook" },
    );
    const card = /<section class="jot-card"[^>]*data-primitive="decision"[\s\S]*?<\/section>/.exec(html);
    expect(card).not.toBeNull();
    expect(card![0]).toContain("jot-nested");
    expect(card![0]).toContain('data-primitive="metric"');
  });
});

describe("render — M3 diagrams: @tree", () => {
  it("renders a hierarchy from indentation", () => {
    const { html, diagnostics } = render("@tree(dir=right)\n  Orders\n    Customer\n      Segment\n    Product", {
      mode: "notebook",
    });
    expect(diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
    expect(html).toContain('class="jot-tree"');
    expect(html).toContain('data-dir="right"');
    for (const label of ["Orders", "Customer", "Segment", "Product"]) {
      expect(html).toContain(`>${label}<`);
    }
    // Depth is real nesting, not indentation faked with padding.
    expect(html).toMatch(/Orders[\s\S]*jot-tree-kids[\s\S]*Customer[\s\S]*jot-tree-kids[\s\S]*Segment/);
  });

  it("lets a tree contain other blocks", () => {
    // The reason diagrams are CSS and not SVG: a node must be able to hold
    // ordinary flow content, including another primitive.
    const { html } = render(
      '@tree(dir=right)\n  Pricing\n    Usage-based\n\n  @metric(name="Teams" value="1,240")',
      { mode: "notebook" },
    );
    expect(html).toMatch(/jot-tree[\s\S]*jot-nested[\s\S]*data-primitive="metric"/);
  });

  it("reads > and < as sides rather than as coordinates", () => {
    const { html } = render("@tree(dir=split)\n  Central\n    > Right branch\n    < Left branch", {
      mode: "notebook",
    });
    expect(html).toContain('data-side="right"');
    expect(html).toContain('data-side="left"');
    // The marker is consumed, not printed.
    expect(html).not.toContain("&gt; Right branch");
  });

  it("keeps every tree label one row tall", () => {
    const css = renderLayoutCss();
    const label = baseRule(".jot-tree-label");
    expect(Number(/line-height:\s*(\d+)px/.exec(label)![1]) % ROW).toBe(0);
    // Connectors are borders on the nodes, so they cannot drift from the boxes
    // they belong to the way a separate SVG overlay would.
    expect(css).toContain("border-left: 1px solid var(--jot-color-accent-slate-blue)");
  });
});

describe("render — tree connectors and dividers", () => {
  const css = renderLayoutCss();

  it("draws each connector with two pseudo-elements that meet", () => {
    // An earlier version drew the spine as a border on the <li> and patched the
    // last child with a third element, leaving a visible one-pixel seam. One
    // element per direction, sharing the elbow row, cannot seam.
    expect(css).toMatch(/\.jot-tree-kids > \.jot-tree-node::before \{[^}]*border-left/);
    expect(css).toMatch(/\.jot-tree-kids > \.jot-tree-node::after \{[^}]*border-top/);
    const last = /\.jot-tree-kids > \.jot-tree-node:last-child::before \{[^}]*\}/.exec(css)![0];
    const elbow = /\.jot-tree-kids > \.jot-tree-node::after \{[^}]*\}/.exec(css)![0];
    // The last child's spine stops exactly where the elbow sits.
    expect(Number(/height:\s*(\d+)px/.exec(last)![1])).toBe(Number(/top:\s*(\d+)px/.exec(elbow)![1]));
  });

  it("gives dir=split real connectors, not bare columns", () => {
    // split used to match none of the connector rules, so it rendered as two
    // unlinked lists.
    expect(css).toContain('[data-dir="split"]');
    expect(css).toMatch(/\[data-dir="split"\][^{]*\.jot-tree-kids::before \{[^}]*border-left/);
    // Left-marked branches mirror rather than repeating the right-hand layout.
    expect(css).toMatch(/\[data-side="left"\][^{]*::before \{[^}]*right: 0/);
  });

  it("keeps the split trunk and branch gap on whole rows", () => {
    const trunk = /\[data-dir="split"\][^{]*\.jot-tree-kids::before \{[^}]*\}/.exec(css)![0];
    expect(Number(/height:\s*(\d+)px/.exec(trunk)![1]) % ROW).toBe(0);
  });

  it("suppresses the generic elbow on top-level split branches", () => {
    // They hang off the trunk; inheriting the elbow drew an orphan connector
    // floating at the outer edge of the diagram.
    expect(css).toMatch(/\[data-dir="split"\][\s\S]{0,400}?display: none/);
  });

  it("draws the divider as a short centred mark, not a full-width rule", () => {
    // A full-width line on a ruled line is invisible: it just makes one rule
    // darker. A section break has to read as deliberate.
    const rule = /\.jot-divider::after \{[^}]*\}/.exec(css)![0];
    expect(rule).toContain("left: 50%");
    expect(rule).toContain("translateX(-50%)");
    expect(rule).not.toMatch(/right:\s*0/);
  });

  it("implements all three divider styles the schema promises", () => {
    for (const style of ["dots", "wave"]) {
      expect(css, `missing divider style ${style}`).toContain(`.jot-divider[data-style="${style}"]`);
    }
    for (const [src, style] of [["---", "line"], ["@divider(style=dots)", "dots"], ["@divider(style=wave)", "wave"]] as const) {
      expect(render(src, { mode: "notebook" }).html).toContain(`data-style="${style}"`);
    }
  });
});

describe("render — dir=split arranges itself", () => {
  /**
   * Top-level branch labels per side. Depth-aware on purpose: a flat regex
   * also catches every descendant's label, which made the first version of
   * these tests assert on grandchildren.
   */
  const sides = (html: string): Record<string, string[]> => {
    const out: Record<string, string[]> = { left: [], right: [] };
    for (const m of html.matchAll(/<div class="jot-tree-side" data-side="(left|right)">/g)) {
      const from = m.index! + m[0].length;
      let depth = 0;
      const labels: string[] = [];
      const token = /<ul class="jot-tree-kids">|<\/ul>|<span class="jot-tree-label">([^<]*)</g;
      token.lastIndex = from;
      let t: RegExpExecArray | null;
      while ((t = token.exec(html)) !== null) {
        if (t[0].startsWith("<ul")) { depth += 1; continue; }
        if (t[0] === "</ul>") { depth -= 1; if (depth === 0) break; continue; }
        if (depth === 1) labels.push(t[1]!);
      }
      out[m[1]!] = labels;
    }
    return out;
  };

  it("balances unmarked branches without being told", () => {
    // "Intent, not coordinates": the author says split, the renderer arranges.
    // Before this, unmarked branches all took the right-hand treatment and the
    // hub sat off-centre between them.
    const { html } = render(
      "@tree(dir=split)\n  Central\n    A\n      a1\n      a2\n    B\n      b1\n    C\n    D",
      { mode: "notebook" },
    );
    const s = sides(html);
    expect(s.left!.length).toBeGreaterThan(0);
    expect(s.right!.length).toBeGreaterThan(0);
    expect([...s.left!, ...s.right!].sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("balances by subtree weight rather than branch count", () => {
    // One branch with five nodes against three with one each: splitting by
    // count would put the heavy one opposite a single light one.
    const { html } = render(
      "@tree(dir=split)\n  Central\n    Heavy\n      one\n      two\n      three\n      four\n    L1\n    L2\n    L3",
      { mode: "notebook" },
    );
    const s = sides(html);
    const heavySide = s.left!.includes("Heavy") ? s.left! : s.right!;
    const otherSide = s.left!.includes("Heavy") ? s.right! : s.left!;
    expect(heavySide).toEqual(["Heavy"]);
    expect(otherSide.sort()).toEqual(["L1", "L2", "L3"]);
  });

  it("lets an explicit marker override the balancing", () => {
    const { html } = render("@tree(dir=split)\n  Central\n    < Forced left\n    < Also left\n    Free", {
      mode: "notebook",
    });
    const s = sides(html);
    expect(s.left).toContain("Forced left");
    expect(s.left).toContain("Also left");
    expect(s.right).toContain("Free");
  });

  it("consumes the marker instead of printing it", () => {
    const { html } = render("@tree(dir=split)\n  Central\n    > Right one\n    < Left one", {
      mode: "notebook",
    });
    expect(html).not.toContain("&gt; Right one");
    expect(html).not.toContain("&lt; Left one");
    expect(html).toContain(">Right one<");
  });

  it("puts the hub between the two sides, not beside them", () => {
    const { html } = render("@tree(dir=split)\n  Central\n    A\n    B", { mode: "notebook" });
    expect(html).toMatch(/data-side="left"[\s\S]*jot-tree-hub[\s\S]*data-side="right"/);
    // Three columns total, not one per branch — four branches used to produce
    // four columns and an off-centre hub.
    expect(renderLayoutCss()).toMatch(/\.jot-tree-split \{[^}]*grid-template-columns: 1fr auto 1fr/);
  });
});
