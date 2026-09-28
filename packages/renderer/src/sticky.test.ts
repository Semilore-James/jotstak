// @sticky — a note, and a wall of them.
//
// The decision worth pinning is the wall. Stickies written one after another
// are ONE figure and one row of the document, which is the only place in the
// language where a block shares a row with its neighbour. Rendered as separate
// rows down the page they would be a list with coloured backgrounds, and
// cluster synthesis is the one thing @sticky is for.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";
import { fitSticky, STICKY, STICKY_COLORS, STICKY_SIDE, tilt } from "./sticky.js";

const src = (...lines: string[]): string => lines.join("\n");
const out = (s: string) => render(s, { mode: "notebook" });
const note = (text: string, params = ""): string[] => [`@sticky${params ? " " + params : ""}`, `  ${text}`, ""];

describe("a wall of stickies", () => {
  it("draws a run of them as one figure in one row", () => {
    const { html, diagnostics } = out(
      src(...note("First"), ...note("Second"), ...note("Third")),
    );
    expect(diagnostics).toEqual([]);
    // One wall, three notes, one row.
    expect(html.match(/class="jot-sticky-wall"/g)).toHaveLength(1);
    expect(html.match(/class="jot-sticky"/g)).toHaveLength(3);
    expect(html.match(/class="jot-row"/g)).toHaveLength(1);
  });

  it("starts a new wall when something else comes between", () => {
    const { html } = out(src(...note("First"), "Some prose.", "", ...note("Second")));
    expect(html.match(/class="jot-sticky-wall"/g)).toHaveLength(2);
  });

  it("groups consecutive stickies that name the same cluster", () => {
    const { html } = out(
      src(
        ...note("Playground drove installs", 'cluster="wins"'),
        ...note("Two PMs asked for Word", 'cluster="wins"'),
        ...note("Nobody read the docs", 'cluster="concerns"'),
      ),
    );
    expect(html.match(/jot-sticky-group/g)).toHaveLength(2);
    expect(html).toContain('<p class="jot-sticky-cluster">wins</p>');
    expect(html).toContain('<p class="jot-sticky-cluster">concerns</p>');
  });

  it("leaves an unnamed run ungrouped rather than inventing a heading", () => {
    const { html } = out(src(...note("First"), ...note("Second")));
    expect(html).not.toContain("jot-sticky-group");
    expect(html).toContain("jot-sticky-notes");
  });

  it("spans the margin channel, because a wall is wider than the text column", () => {
    expect(renderLayoutCss()).toContain(
      ".jot-body:has(> .jot-sticky-wall) { grid-column: 1 / -1; }",
    );
  });

  it("is a square of whole rows, big enough to hold a real note", () => {
    // Four rows was the first size and gave 88px of inner width, about twelve
    // characters a line — too small to be a sticky note at all. How many fit
    // across is the grid's business, not the renderer's: it depends on the
    // width the document was given, which reflow means is not fixed.
    expect(STICKY_SIDE).toBe(STICKY.rows * STICKY.row);
    expect(STICKY.rows).toBe(5);
  });
});

describe("fitting text to a square", () => {
  const SHORT = "Playground drove 3x installs on launch day";
  const MEDIUM =
    "No one read the docs before filing a bug, which tells us something about where people actually look";
  const LONG =
    "A really long note that has far too much on it for anybody to read at a glance and should probably have been split into two or three separate observations rather than crammed onto one square of paper";

  it("keeps the square at full size when the text fits", () => {
    expect(fitSticky(SHORT)).toEqual({ step: 0, rows: STICKY.rows, grew: false });
  });

  it("drops one size before it gives up the square", () => {
    // The chosen behaviour: a sticky is a square, and the first thing to give
    // is the type, not the shape.
    expect(fitSticky(MEDIUM)).toEqual({ step: 1, rows: STICKY.rows, grew: false });
  });

  it("grows in whole rows rather than losing a word", () => {
    const fit = fitSticky(LONG);
    expect(fit.grew).toBe(true);
    expect(fit.rows).toBeGreaterThan(STICKY.rows);
    expect(Number.isInteger(fit.rows)).toBe(true);
    // And never shrinks below the smallest step, however long the text.
    expect(fit.step).toBe(STICKY.sizes.length - 1);
  });

  it("says when a note grew, and what to do about it", () => {
    const { diagnostics } = out(src(...note(LONG)));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe("info");
    expect(diagnostics[0]!.message).toContain("split it into two");
  });

  it("says nothing about a note that fits", () => {
    expect(out(src(...note(SHORT))).diagnostics).toEqual([]);
    expect(out(src(...note(MEDIUM))).diagnostics).toEqual([]);
  });

});

describe("a wall that wraps", () => {
  // THE bug here, twice over.
  //
  // The first version counted one line of notes per group, so two clusters of
  // three ran out of the bottom of the wall and over the paragraph below —
  // while the check said declared 6, drawn 6, match. A fixed height agrees
  // with itself.
  //
  // The second version counted the lines properly, for a printable page. Then
  // reflow gave a phone 343px, two notes fit across instead of four, and a
  // wall declared at 12 rows drew 24. Guessing a column count is right for
  // exactly one width, and a document no longer has one width.
  //
  // So nothing is declared. The wall is a grid of fixed-size notes with a
  // whole-row gap between lines, and its height comes out in whole rows by
  // arithmetic at any width: a note is 5 rows, a gap is 1, so a wall is 6n-1.
  it("declares no height at all, and lets the grid decide the columns", () => {
    const html = out(src(...note("First"), ...note("Second"), ...note("Third"))).html;
    expect(html).not.toContain("--jot-sticky-wall-rows");

    const css = renderLayoutCss();
    expect(css).toContain("grid-template-columns: repeat(auto-fill,");
    expect(css).not.toMatch(/\.jot-sticky-wall \{[^}]*height:/);
  });

  it("is built only from whole-row parts, so any wall is whole rows", () => {
    // The arithmetic the grid relies on. If a note stopped being a whole
    // number of rows, or the gap did, no column count would be safe.
    expect(STICKY_SIDE % STICKY.row).toBe(0);
    expect(STICKY.rowGap % STICKY.row).toBe(0);
  });

  it("puts a whole row between two lines of notes, not half of one", () => {
    // 14px would be half a row, and a wrapped wall would land off the ruling
    // at every width rather than at none.
    expect(STICKY.rowGap).toBe(STICKY.row);
  });
});

describe("how a sticky looks", () => {
  it("offers the six colours a Post-it comes in", () => {
    const css = renderLayoutCss();
    for (const color of STICKY_COLORS) {
      expect(out(src(...note("A", `color=${color}`))).html).toContain(`data-color="${color}"`);
      expect(css).toContain(`.jot-sticky[data-color="${color}"]`);
    }
  });

  it("falls back to yellow rather than drawing a colourless sticky", () => {
    // The enum is validated by the schema, which errors. This is what the
    // renderer does with the value anyway, so nothing is ever drawn blank.
    expect(out(src(...note("A", "color=chartreuse"))).html).toContain('data-color="yellow"');
  });

  it("tilts each note, and the same note the same way every time", () => {
    // A random angle would change on every keystroke, so a note would twitch
    // while you typed in the block above it.
    expect(tilt("Playground drove installs")).toBe(tilt("Playground drove installs"));
    expect(Math.abs(tilt("anything"))).toBeLessThanOrEqual(1.5);
    const angles = new Set(["one", "two", "three", "four", "five"].map(tilt));
    expect(angles.size, "every note sits at the same angle").toBeGreaterThan(1);
  });

  it("keeps the colour in doc mode and drops the notebook mannerisms", () => {
    // A sticky with no colour is not a sticky. The tilt and the shadow are
    // handwriting, and doc mode does not have handwriting.
    const css = renderLayoutCss();
    expect(css).toContain('[data-mode="doc"] .jot-sticky { rotate: none; box-shadow: none; }');
    expect(render(src(...note("A", "color=coral")), { mode: "doc" }).html).toContain(
      'data-color="coral"',
    );
  });

  it("prints its colours, because they are the content", () => {
    expect(renderLayoutCss()).toContain("print-color-adjust: exact");
  });

  it("clears the ruling across its whole row, like every drawn block", () => {
    expect(renderLayoutCss()).toContain(
      '[data-mode="notebook"] .jotstak .jot-body:has(> .jot-sticky-wall) { background-image: none; }',
    );
  });

  it("says so when a sticky has nothing on it", () => {
    const { diagnostics } = out("@sticky");
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.message).toContain("nothing on it");
  });
});
