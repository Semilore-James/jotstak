import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, renderLayoutCss, BASELINE_OFFSET, toWholeRows } from "./index.js";
import { spacing } from "./tokens.js";

const ROW = spacing.baselineGrid;

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
    const row = /<div class="jot-body">(.*?)<\/div><div class="jot-aside">(.*?)<\/div>/s.exec(html);
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
    const { html, diagnostics } = render("@persona name=\"Marta\"\n  role: Platform PM", {
      mode: "notebook",
    });
    expect(html).toContain("Platform PM");
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
    const css = renderLayoutCss();
    const card = /\.jot-card \{[^}]*\}/.exec(css)![0];
    const padding = Number(/padding:\s*(\d+)px/.exec(card)![1]);
    const border = Number(/border:\s*(\d+)px/.exec(card)![1]);
    expect((padding + border) * 2).toBe(ROW);
  });

  it("gives drawn blocks half a row of clearance each side", () => {
    const css = renderLayoutCss();
    const card = /\.jot-card \{[^}]*\}/.exec(css)![0];
    expect(card).toContain(`margin: ${ROW / 2}px 0`);
  });

  it("makes drawn blocks opaque so they clear the ruling", () => {
    const css = renderLayoutCss();
    const card = /\.jot-card \{[^}]*\}/.exec(css)![0];
    expect(card).toContain("background: var(--jot-surface-elevated)");
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
    // Inline code is the one deliberate exception: its box must stay BELOW the
    // strut, not on the grid, or it grows the line it sits in. It is asserted
    // separately in the regressions block.
    const css = renderLayoutCss().replace(/\.jot-body code \{[^}]*\}/, "");
    for (const [, value] of css.matchAll(/line-height:\s*(\d+)px/g)) {
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
    const declarations = /\.jot-body pre \{[^}]*\}/
      .exec(css)![0]
      .replace(/\/\*[\s\S]*?\*\//g, ""); // the rationale comment names the property
    expect(declarations).toContain("white-space: pre-wrap");
    expect(declarations).not.toContain("overflow-x");
  });

  it("caps inline code below the line strut so it cannot grow the row", () => {
    const code = /\.jot-body code \{[^}]*\}/.exec(css)![0];
    const lh = Number(/line-height:\s*(\d+)px/.exec(code)![1]);
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
