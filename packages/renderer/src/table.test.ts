// @table — the figure whose content is text, and is therefore never scaled.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";
import { buildTable, measureTable, splitCells, TABLE } from "./table.js";
import { PAGE } from "./page.js";

const src = (...lines: string[]): string => lines.join("\n");
const out = (s: string) => render(s, { mode: "notebook" });

const COMPACT = src("@table", "  Feature, Status, Owner", "  Search, Shipped, Ana", "  Export, In progress, Ben");
const RECORD = src(
  "@table",
  "  - Feature: Search",
  "    Status: Shipped",
  "    Owner: Ana",
  "  - Feature: Export",
  "    Status: In progress",
  "    Owner: Ben",
);
const PIPE = src("@table", "  | Feature | Status | Owner |", "  | --- | --- | --- |", "  | Search | Shipped | Ana |");

describe("splitting a compact row", () => {
  it.each([
    ["Search, Shipped, Ana", ["Search", "Shipped", "Ana"]],
    ['"Search, export", Shipped', ["Search, export", "Shipped"]],
    ['"He said ""go""", ok', ['He said "go"', "ok"]],
    ["Search,,Ana", ["Search", "", "Ana"]],
  ])("%s", (line, cells) => {
    expect(splitCells(line, "comma")).toEqual(cells);
  });

  it("splits on tabs when asked", () => {
    expect(splitCells("Search\tShipped", "tab")).toEqual(["Search", "Shipped"]);
  });
});

describe("the three ways in produce the same table", () => {
  const cells = (html: string): string[] =>
    [...html.matchAll(/<(th|td)\b[^>]*>(.*?)<\/\1>/g)].map((m) => m[2]!);

  it("compact rows", () => {
    expect(cells(out(COMPACT).html)).toEqual([
      "Feature", "Status", "Owner",
      "Search", "Shipped", "Ana",
      "Export", "In progress", "Ben",
    ]);
  });

  it("the record form", () => {
    expect(cells(out(RECORD).html)).toEqual(cells(out(COMPACT).html));
  });

  it("a pipe table pasted out of Markdown", () => {
    // .jot has no pipe syntax of its own, but the superset promise means a
    // pasted .md table must not be mangled — and its rule row is not a row.
    const html = out(PIPE).html;
    expect(cells(html)).toEqual(["Feature", "Status", "Owner", "Search", "Shipped", "Ana"]);
    expect(html).not.toContain("---");
  });

  it("all three are header plus body, not one undifferentiated block", () => {
    for (const s of [COMPACT, RECORD, PIPE]) {
      expect(out(s).html).toContain("<thead>");
      expect(out(s).html).toContain("<tbody>");
    }
  });

  it("says nothing when the table is well formed", () => {
    for (const s of [COMPACT, RECORD, PIPE]) expect(out(s).diagnostics).toEqual([]);
  });
});

describe("what a table does with what it is given", () => {
  it("keeps inline formatting in a cell", () => {
    expect(out(src("@table", "  Feature, Status", "  **Search**, Shipped")).html).toContain(
      "<strong>Search</strong>",
    );
  });

  it("right-aligns a column that is nothing but figures", () => {
    const html = out(src("@table", "  Area, Confidence", "  Search, 0.8", "  Export, 0.4")).html;
    expect(html).toMatch(/<td style="text-align:right">0\.8<\/td>/);
    expect(html).toMatch(/<td>Search<\/td>/);
  });

  it("takes the author's alignment over its own guess", () => {
    const html = out(src('@table(align="right,left")', "  Area, Confidence", "  Search, 0.8")).html;
    expect(html).toMatch(/<th style="text-align:right">Area/);
    expect(html).toMatch(/<td>0\.8<\/td>/);
  });

  it("reads alignment out of a pasted rule row", () => {
    expect(out(src("@table", "  | A | B |", "  | --- | ---: |", "  | x | y |")).html).toMatch(
      /<th style="text-align:right">B/,
    );
  });

  it("names the table for a screen reader when it is captioned", () => {
    const html = out(src("@table Q4 status", "  Area, Owner", "  Search, Ana")).html;
    expect(html).toContain('<p class="jot-table-caption">Q4 status</p>');
    expect(html).toContain('aria-label="Q4 status"');
  });

  it("drops cells past the header and says which row", () => {
    const { diagnostics } = out(src("@table", "  A, B", "  1, 2, 3"));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.message).toContain("3 cells");
    expect(diagnostics[0]!.line).toBe(2);
  });

  it("points at the record form when a row is given indented detail", () => {
    const { diagnostics } = out(src("@table", "  A, B", "  1, 2", "    why it is 2"));
    expect(diagnostics[0]!.message).toContain("record form");
  });

  it("says so when there is nothing to draw", () => {
    expect(out("@table").diagnostics[0]!.message).toContain("no rows");
  });
});

describe("how much page a table takes", () => {
  it("stays in the text column when it fits", () => {
    const html = out(COMPACT).html;
    expect(html).toContain('data-width="column"');
    // Room to spare means auto layout: each column fits its own content.
    expect(html).not.toContain('data-fit="tight"');
    expect(html).not.toContain("<colgroup>");
  });

  it("takes the whole printable width when the column is not enough", () => {
    const wide = src(
      "@table",
      "  Area, Owner, Confidence, Notes",
      "  Search relevance rework, Ana Silva, 0.8, Depends on the new index landing first",
    );
    expect(out(wide).html).toContain('data-width="full"');
  });

  it("holds a short header on one line so its column cannot be squeezed under it", () => {
    // This is the whole of the squeezed-table layout: an unwrappable header is
    // the floor a column cannot go below, so the columns of prose absorb the
    // shortfall. CONFIDENCE over a column of "0.8" broke into CONFIDE / NCE
    // when the renderer divided the width up itself instead.
    const tight = src(
      "@table",
      "  Area, Owner, Confidence, Notes, Next step, Risk",
      "  Search relevance rework, Ana Silva, 0.8, Depends on the new index landing first, Ship behind a flag, The index migration slips again",
    );
    const html = out(tight).html;
    expect(html).not.toContain("<colgroup>");
    expect(html).not.toMatch(/<th[^>]*data-wrap/);
    expect(renderLayoutCss()).toContain(".jot-table th { white-space: nowrap; }");
  });

  it("lets a header that is a phrase rather than a word wrap between words", () => {
    const html = out(src("@table", "  What we learned this quarter, B", "  x, y")).html;
    expect(html).toMatch(/<th data-wrap>What we learned this quarter<\/th>/);
    const css = renderLayoutCss();
    expect(css).toContain(".jot-table th[data-wrap] { white-space: normal; }");
    // Between words, never inside one: only a CELL may break mid-word.
    expect(css).toContain(".jot-table td { overflow-wrap: break-word; }");
    expect(css).not.toContain(".jot-table th { overflow-wrap: break-word; }");
  });

  it("wraps rather than shrinking, and says so", () => {
    const huge = src(
      "@table",
      "  " + Array.from({ length: 9 }, (_, i) => `Column heading ${i}`).join(", "),
      "  " + Array.from({ length: 9 }, () => "a fairly long cell of prose").join(", "),
    );
    const { diagnostics, html } = out(huge);
    const info = diagnostics.find((d) => d.message.includes("wrap"));
    expect(info?.severity).toBe("info");
    expect(info?.message).toContain("never shrunk");
    // The one thing that must never happen to a table: scaling its text.
    expect(html).not.toContain("--jot-w");
    expect(html).not.toContain("jot-figure");
  });

  it("honours a pinned width", () => {
    expect(out(src("@table(width=full)", "  A, B", "  1, 2")).html).toContain('data-width="full"');
    const wide = src("@table(width=column)", "  A, B, C, D, E, F, G, H", "  1, 2, 3, 4, 5, 6, 7, 8");
    expect(out(wide).html).toContain('data-width="column"');
  });

  it("measures the header in its own smaller face", () => {
    // The header is 12px uppercase label type, not 16px body type. Measuring it
    // as body text made every short-celled table think it needed the full page.
    const m = measureTable({ head: ["Confidence"], rows: [["1"]], align: ["left"], caption: "" });
    expect(m.columns[0]).toBeLessThan(measureTable({ head: ["Confidence"], rows: [["Confidence"]], align: ["left"], caption: "" }).columns[0]!);
  });

  it("measures a short table well inside the text column", () => {
    const m = measureTable({ head: ["A", "B"], rows: [["x", "y"]], align: ["left", "left"], caption: "" });
    expect(m.natural).toBeLessThan(PAGE.portrait.column);
  });
});

describe("a table on ruled paper", () => {
  it("sits on the ruling by default, so the paper draws the rows", () => {
    const html = out(COMPACT).html;
    expect(html).toContain('data-style="ruled"');
    expect(html).not.toContain("data-drawn");
    const css = renderLayoutCss();
    // Not cleared: a ruled table has no lines of its own and borrows the page's.
    expect(css).not.toContain(
      '[data-mode="notebook"] .jot-body:has(> .jot-table-wrap[data-style="ruled"])',
    );
  });

  it("clears the ruling only when it draws its own grid", () => {
    expect(out(src("@table(style=sketch)", "  A, B", "  1, 2")).html).toContain("data-drawn");
    expect(renderLayoutCss()).toContain(
      '[data-mode="notebook"] .jot-body:has(> .jot-table-wrap[data-drawn]) { background-image: none; }',
    );
  });

  it("draws every line as an inset shadow, so no row costs an extra pixel", () => {
    const rules = renderLayoutCss()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .filter((r) => r.includes('.jot-table[data-style="sketch"]'));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule).toContain("inset");
      // A border would add a pixel per row and walk the ruling out of phase.
      expect(rule).not.toMatch(/\bborder(-top|-bottom)?\s*:/);
    }
  });

  it("keeps every row exactly one baseline row tall", () => {
    const css = renderLayoutCss();
    expect(css).toContain(`line-height: ${TABLE.row}px`);
    expect(css).toMatch(/\.jot-body th,\s*[^{]*\.jot-body td \{\s*padding: 0/);
  });

  it("narrows for a margin note, unless the author pinned the width", () => {
    // A table with nothing beside it already spans both tracks (UX-37). With a
    // note beside it, it gives the room back and wraps a little harder — a
    // drawing cannot do that, which is the difference. Only an explicit
    // `width=full` outranks the note.
    expect(out(src("@table", "  A, B", "  1, 2")).html).not.toContain("data-pinned");
    expect(out(src("@table(width=full)", "  A, B", "  1, 2")).html).toContain("data-pinned");
    expect(renderLayoutCss()).toContain(
      '.jot-body:has(> .jot-table-wrap[data-width="full"][data-pinned]) { grid-column: 1 / -1; }',
    );
  });

  it("carries its header onto the next page and never cuts a row in half", () => {
    const css = renderLayoutCss();
    expect(css).toContain(".jot-table thead { display: table-header-group; }");
    expect(css).toContain(".jot-table tr { break-inside: avoid; }");
  });
});

describe("a line break inside a cell", () => {
  // Enter breaks a line in prose, but a table row is one line of source per
  // row — so a cell that wants two lines has nowhere to put the second one.
  // A real backslash-n in the SOURCE, which is what an author types.
  const BROKEN = src("@table", "  Area, Notes", '  Search, "one\\ntwo"', "  Export, single");

  it("splits on a backslash-n and draws the break", () => {
    const html = out(BROKEN).html;
    expect(html).toContain("<td>one<br>two</td>");
    expect(html).toContain("<td>single</td>");
    expect(out(BROKEN).diagnostics).toEqual([]);
  });

  it("measures the widest line, not the joined string", () => {
    // Measuring the join would size the column for text that is no longer on
    // one line — the same drift that made the timeline stand a row too tall.
    const broken = measureTable({
      head: ["Notes"],
      rows: [["a fairly long first half\\nand a second"]],
      align: ["left"],
      caption: "",
    });
    const joined = measureTable({
      head: ["Notes"],
      rows: [["a fairly long first half and a second"]],
      align: ["left"],
      caption: "",
    });
    expect(broken.natural).toBeLessThan(joined.natural);
  });

  it("lets a header break where it is asked to, nowrap or not", () => {
    // A short header is normally held on one line so it cannot be squeezed
    // below its own width. Asking for a break outranks that.
    const html = out(src("@table", '  "Next\\nstep", B', "  x, y")).html;
    expect(html).toMatch(/<th data-wrap>Next<br>step<\/th>/);
  });

  it("leaves a cell with no break exactly as it was", () => {
    expect(out(BROKEN).html).not.toContain("<td>Search<br>");
  });
});
