// The margin channel is room for a note, not a permanent indent.
//
// Every block used to sit in the 503px text column and leave the channel empty
// beside it, whether or not anything was written there — so prose and headings
// stopped short of the page for a reason the reader could not see. A block with
// nothing beside it now takes the whole printable width, and a block with a
// note narrows to make room for it. That is the only time the narrower measure
// means anything.
//
// And a note is about the paragraph it FOLLOWS. Attaching it to the whole run
// of prose since the last block narrowed every paragraph back to the top.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";

/** Each row as [what the body says, whether anything is in the margin]. */
function rows(src: string): Array<[string, boolean]> {
  const { html } = render(src, { mode: "notebook" });
  return [...html.matchAll(/<div class="jot-body"[^>]*>([\s\S]*?)<\/div><div class="jot-aside">([\s\S]*?)<\/div>/g)].map(
    (m) => [
      // The wrapped copy of a note sits inside the text it is beside (UX-68);
      // it is not part of what the text says.
      m[1]!
        .replace(/<span class="jot-note" data-wrap>[\s\S]*?<\/span>/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      m[2] !== "",
    ],
  );
}

describe("the margin channel", () => {
  it("is given up by any block that has no note beside it", () => {
    const css = renderLayoutCss();
    expect(css).toContain(".jot-row:has(> .jot-aside:empty) > .jot-body { grid-column: 1 / -1; }");
  });

  it("still holds the two columns for a block that does have one", () => {
    const css = renderLayoutCss();
    expect(css).toContain(".jot-body { grid-column: 1; min-width: 0; }");
    expect(css).toContain(".jot-aside { grid-column: 2; min-width: 0; }");
  });
});

describe("what a margin note attaches to", () => {
  it("takes the paragraph it follows, not the whole run of prose", () => {
    expect(rows(["First.", "", "Second.", "", "Third, with the note.", "", "@note a note"].join("\n"))).toEqual([
      ["First. Second.", false],
      ["Third, with the note.", true],
    ]);
  });

  it("reads an inline @note the same way as an indented one", () => {
    expect(rows(["First.", "", "Second, with the note.", "", "@note", "  a note"].join("\n"))).toEqual([
      ["First.", false],
      ["Second, with the note.", true],
    ]);
  });

  it("leaves a single paragraph alone", () => {
    expect(rows(["Only one.", "", "@note a note"].join("\n"))).toEqual([["Only one.", true]]);
  });

  it("never cuts a fenced block in half", () => {
    // The blank line inside the fence is not a paragraph break, and splitting
    // there would put half the code in one block and half in another.
    const out = rows(["Intro.", "", "```js", "const x = 1;", "", "const y = 2;", "```", "", "@note a note"].join("\n"));
    expect(out).toHaveLength(1);
    expect(out[0]![1]).toBe(true);
    expect(out[0]![0]).toContain("const x = 1;");
    expect(out[0]![0]).toContain("const y = 2;");
  });

  it("never cuts a table in half", () => {
    const out = rows(["Intro.", "", "| a | b |", "| --- | --- |", "| 1 | 2 |", "", "@note a note"].join("\n"));
    expect(out).toHaveLength(1);
    expect(out[0]![1]).toBe(true);
  });
});

describe("a note beside text wraps it, where it was written (UX-68)", () => {
  const html = (src: string): string => render(src, { mode: "notebook" }).html;
  const NOTE = '<span class="jot-note" data-wrap>';

  it("sits beside the last point of a list, not the first", () => {
    // Written after the list, so it belongs beside the point written last.
    // It used to open the list's row, beside the first point.
    const out = html("- First point\n- Second point\n- Last point\n\n@note about the last one");
    expect(out).toContain(`<li>${NOTE}about the last one</span>Last point</li>`);
    expect(out).toContain('<div class="jot-row" data-notes="wrap">');
  });

  it("goes down to a sub-point when that is what was written last", () => {
    const out = html("- A\n  - a1\n  - a2\n\n@note on a2");
    expect(out).toContain(`<li>${NOTE}on a2</span>a2</li>`);
  });

  it("sits at the last line of a paragraph", () => {
    const out = html("One line.\nTwo lines.\nThe last line.\n\n@note here");
    expect(out).toContain(`Two lines.<br>\n${NOTE}here</span>The last line.</p>`);
  });

  it("keeps the column copy, for a narrow screen to fold in under the text", () => {
    const out = html("Words.\n\n@note folded");
    expect(out).toMatch(/<div class="jot-aside"><p class="jot-note">folded<\/p><\/div>/);
    const css = renderLayoutCss();
    // As specific as the rule that floats it, or the float rule would win.
    expect(css).toMatch(/@container jot-page[\s\S]*\.jot-body \.jot-note\[data-wrap\] \{ display: none; \}/);
  });

  it("leaves a box in the margin column, since a box cannot wrap", () => {
    const out = html('@panel title="P"\n  Words.\n\n@note beside the box');
    expect(out).not.toContain("data-wrap");
    expect(out).toContain('<div class="jot-row"><div class="jot-body"');
  });

  it("leaves text that does not end in a paragraph in the column too", () => {
    // Inside a code block a note would be printed as code.
    const out = html("```\nconst x = 1;\n```\n\n@note about the code");
    expect(out).not.toContain("data-wrap");
  });

  it("stacks several notes on one line, in the order written", () => {
    const out = html("Words.\n\n@note one\n@note two");
    expect(out).toContain(`${NOTE}one</span>${NOTE}two</span>Words.`);
  });
});
