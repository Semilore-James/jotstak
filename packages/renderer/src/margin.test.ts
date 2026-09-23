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
    (m) => [m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), m[2] !== ""],
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
