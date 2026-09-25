// The extent ruler must agree with the parser about what a block owns.
//
// A ruler that used a different rule from the renderer would be worse than no
// ruler at all: it would be confidently wrong about the one thing it exists to
// show. So these cases are checked twice — once against `blockExtent`, and
// once against the renderer itself, by asking whether the content actually
// came out inside the block.

import { describe, expect, it } from "vitest";
import { render } from "@jotstak/renderer";
import { blockExtent } from "./indentation.js";
import { doc } from "../test/vscode.js";

/** `blockExtent` as line numbers, for a test to read. */
const extent = (source: string, line: number): [number, number] | undefined => {
  const range = blockExtent(doc(source) as never, line);
  return range ? [range.start.line, range.end.line] : undefined;
};

describe("what a block owns", () => {
  const PANEL = `
@panel(title="Scope")
  Everything here belongs to the panel.
  owner: Ana

Outside it again.
`;

  it("runs to the last line indented under the opener", () => {
    expect(extent(PANEL, 0)).toEqual([0, 2]);
  });

  it("stops at the first line back at the opener's own indent", () => {
    // Line 4 is the prose after the panel, and it is not the panel's.
    expect(extent(PANEL, 0)?.[1]).toBeLessThan(4);
  });

  it("keeps a blank line that is inside the run", () => {
    const withGap = `
@panel(title="Scope")
  First paragraph.

  Second paragraph.
After.
`;
    expect(extent(withGap, 0)).toEqual([0, 3]);
  });

  it("does not let a trailing blank line extend the block", () => {
    expect(extent("@panel\n  body\n\n\n", 0)).toEqual([0, 1]);
  });

  it("has no extent when nothing is indented under the line", () => {
    expect(extent("Just prose.\nMore prose.", 0)).toBeUndefined();
    expect(extent("@pagebreak\n\nAfter.", 0)).toBeUndefined();
  });

  it("nests, so an inner block owns less than the outer one", () => {
    const nested = `
@panel(title="Outer")
  @panel(title="Inner")
    deep
  back to outer
last
`;
    expect(extent(nested, 0)).toEqual([0, 3]);
    expect(extent(nested, 1)).toEqual([1, 2]);
  });
});

describe("the ruler agrees with the renderer", () => {
  // The rule is "everything indented further than the opener", and the
  // renderer's parser uses the same one. These check the two do not drift by
  // asking the renderer where the content ACTUALLY ended up.
  it.each([
    ["inside", "@panel(title=\"T\")\n  mine\nnot mine", "mine", true],
    ["outside", "@panel(title=\"T\")\n  mine\nnot mine", "not mine", false],
  ])("%s the card", (_name, source, text, shouldBeInside) => {
    const { html } = render(source, { mode: "notebook" });
    const card = /<section class="jot-card"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect(card.includes(text)).toBe(shouldBeInside);
    expect(html).toContain(text);

    // And the ruler would draw the same boundary.
    const range = extent(source, 0);
    expect(range).toEqual([0, 1]);
  });
});
