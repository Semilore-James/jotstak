// @sticky — a note, and a wall of them.
//
// The decision worth pinning is the wall. Stickies written one after another
// are ONE figure and one row of the document, which is the only place in the
// language where a block shares a row with its neighbour. Rendered as separate
// rows down the page they would be a list with coloured backgrounds, and
// cluster synthesis is the one thing @sticky is for.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";
import { fitSticky, groupRows, notesAcross, STICKY, STICKY_COLORS, STICKY_SIDE, tilt } from "./sticky.js";
import { PAGE } from "./page.js";

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

  it("fits four across the page, which is what makes it a wall", () => {
    // Four rows was the first size and gave 88px of inner width, about twelve
    // characters a line — too small to be a sticky note at all.
    const across = Math.floor((PAGE.portrait.content + STICKY.gap) / (STICKY_SIDE + STICKY.gap));
    expect(across).toBe(4);
    expect(STICKY_SIDE).toBe(STICKY.rows * STICKY.row);
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

  it("gives the wall the height of its tallest note", () => {
    const { html } = out(src(...note(SHORT), ...note(LONG)));
    const wall = Number(/--jot-sticky-wall-rows:(\d+)/.exec(html)![1]);
    expect(wall).toBe(fitSticky(LONG).rows);
  });

  it("adds a row for the cluster labels, and only when there are any", () => {
    const rows = (s: string) => Number(/--jot-sticky-wall-rows:(\d+)/.exec(out(s).html)![1]);
    expect(rows(src(...note("A")))).toBe(STICKY.rows);
    expect(rows(src(...note("A", 'cluster="wins"')))).toBe(STICKY.rows + 1);
  });
});

describe("a wall that wraps", () => {
  // THE bug in this block, and the one a fixed height hides.
  //
  // The first version counted one line of notes per group. The wall's height
  // is set by CSS, so declared and drawn agreed perfectly while two clusters
  // of three ran straight out of the bottom of the wall and over the paragraph
  // below. Comparing a fixed height against itself proves nothing. What had to
  // be measured was whether the CONTENT fits, and what found it was a
  // screenshot.
  it("counts every line of notes, not just the first", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ text: `Note ${i}`, color: "yellow" as const, cluster: "" }));
    // Four across, so five notes are two lines: 5 + 1 gap + 5.
    expect(notesAcross(PAGE.portrait.content)).toBe(4);
    expect(groupRows(five, 4)).toBe(STICKY.rows + STICKY.rowGap / STICKY.row + STICKY.rows);
  });

  it("stacks one cluster under the next rather than beside it", () => {
    const one = { text: "A", color: "yellow" as const, cluster: "wins" };
    // Two groups of one are two bands, each a label plus a note.
    expect(groupRows([one], 4) * 2).toBe(2 * (1 + STICKY.rows));
  });

  it("puts a whole row between two lines of notes, not half of one", () => {
    // 14px would be half a row, and five notes would measure 294px — not a
    // whole number of rows, so the wall would round up and carry 14px of dead
    // space at its foot forever.
    expect(STICKY.rowGap).toBe(STICKY.row);
    const five = Array.from({ length: 5 }, () => ({ text: "A", color: "yellow" as const, cluster: "" }));
    expect((groupRows(five, 4) * STICKY.row) % STICKY.row).toBe(0);
  });

  it("never claims a line fits more notes than the page is wide", () => {
    for (const width of [PAGE.portrait.content, PAGE.portrait.column, 100, 1]) {
      const across = notesAcross(width);
      expect(across).toBeGreaterThanOrEqual(1);
      expect(across * STICKY_SIDE + (across - 1) * STICKY.gap).toBeLessThanOrEqual(
        Math.max(width, STICKY_SIDE),
      );
    }
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
