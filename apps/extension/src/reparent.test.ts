// Tab moves a line and everything it owns.
//
// Written against plain arrays of lines rather than a TextDocument, so the
// rule can be checked without launching an editor — which is the whole of
// ENG-22, and the reason three host-width bugs survived for weeks before it.

import { describe, expect, it } from "vitest";
import { fencedLines, indentOf, isTypingPosition, ownedThrough, reindent } from "./reparent.js";

/** A document written the way it looks, so a test reads like the file it is about. */
const doc = (text: string): string[] => text.replace(/^\n/, "").replace(/\n$/, "").split("\n");

/** Apply a reindent and hand back the whole document, for comparing by eye. */
function apply(lines: string[], from: number, to: number, dir: 1 | -1, unit = 2): string {
  const move = reindent(lines, from, to, dir, unit);
  if (!move) return "REFUSED";
  const out = [...lines];
  for (const { line, text } of move.lines) out[line] = text;
  return out.join("\n");
}

describe("reading the indent", () => {
  it.each([
    ["no indent", 0],
    ["  two", 2],
    ["\tone tab", 1],
    ["", 0],
  ])("%s", (line, want) => {
    expect(indentOf(line)).toBe(want);
  });
});

describe("what a line owns", () => {
  const tree = doc(`
@panel
  first
    deeper
    also deeper
  second
after
`);

  it("takes every line indented further than it", () => {
    expect(ownedThrough(tree, 1)).toBe(3); // "first" owns its two children
    expect(ownedThrough(tree, 0)).toBe(4); // @panel owns all of them
  });

  it("stops at a sibling", () => {
    expect(ownedThrough(tree, 4)).toBe(4); // "second" owns nothing
  });

  it("stops at the margin", () => {
    expect(ownedThrough(tree, 5)).toBe(5); // "after" owns nothing
  });

  it("keeps blank lines inside a run but does not own the ones after it", () => {
    const spaced = doc(`
@panel
  first

  second

after
`);
    expect(ownedThrough(spaced, 0)).toBe(3);
  });

  it("never returns less than it was given", () => {
    // A selection that ends on a blank line still covers that blank line.
    const spaced = doc("@panel\n  first\n\nafter");
    expect(ownedThrough(spaced, 2)).toBeGreaterThanOrEqual(2);
  });
});

describe("Tab takes the children", () => {
  it("moves a whole family, not just the line", () => {
    // THE point of this file. Indenting "second" and leaving "child" behind
    // would silently make the child a sibling, and nothing would error.
    const before = doc(`
@panel
  first
  second
    child
`);
    expect(apply(before, 2, 2, 1)).toBe(
      ["@panel", "  first", "    second", "      child"].join("\n"),
    );
  });

  it("keeps the shape of the family it moved", () => {
    const before = doc(`
@panel
  first
  second
    child
      grandchild
`);
    const after = apply(before, 2, 2, 1).split("\n");
    // Every relative depth is what it was; the whole subtree shifted by one.
    expect(after.slice(2).map(indentOf)).toEqual([4, 6, 8]);
  });

  it("refuses a line that is the first child of its parent", () => {
    // "first" is the only thing under @panel, so there is no sibling above it
    // to become a child of. Every outliner refuses this, and people expect it.
    expect(apply(doc("@panel\n  first\n    deeper"), 1, 1, 1)).toBe("REFUSED");
  });

  it("extends a multi-line selection to the children of its last line", () => {
    // Selecting "two" and "three" and pressing Tab has to bring "child of two"
    // along too, or the selection quietly reshapes the document.
    const before = doc(`
@panel
  one
  two
    child of two
  three
`);
    expect(apply(before, 2, 4, 1)).toBe(
      ["@panel", "  one", "    two", "      child of two", "    three"].join("\n"),
    );
  });

  it("leaves blank lines blank rather than filling them with spaces", () => {
    // Trailing whitespace on an empty line is invisible, survives review, and
    // shows up in every diff of the file afterwards.
    const before = doc("@panel\n  one\n  two\n\n  three");
    const after = apply(before, 2, 4, 1).split("\n");
    expect(after[3]).toBe("");
  });
});

describe("how deep Tab may go", () => {
  it("allows exactly one level deeper than the line above", () => {
    expect(apply(doc("@panel\nbody"), 1, 1, 1)).toBe("@panel\n  body");
  });

  it("refuses two levels, which would be a child of nothing", () => {
    // `deep` is already a child of `first`. One more Tab puts it at 6 with
    // nothing at 4 — the parser accepts it and the document stops meaning what
    // it looks like it means.
    const before = doc("@panel\n  first\n    deep");
    expect(apply(before, 2, 2, 1)).toBe("REFUSED");
  });

  it("refuses the first line of a document, which has no parent to join", () => {
    expect(apply(doc("@panel\n  body"), 0, 0, 1)).toBe("REFUSED");
  });

  it("measures depth from the line above, wherever that line sits", () => {
    // `second` follows a line at indent 4, so it may go to 4 and become that
    // line's sibling — not only to 4 from its own parent's point of view.
    const before = doc("@panel\n  first\n    deep\n  second");
    expect(apply(before, 3, 3, 1)).toBe(
      ["@panel", "  first", "    deep", "    second"].join("\n"),
    );
  });
});

describe("Shift-Tab", () => {
  it("moves a family left and keeps its shape", () => {
    const before = doc(`
@panel
    first
      deeper
`);
    expect(apply(before, 1, 1, -1)).toBe(["@panel", "  first", "    deeper"].join("\n"));
  });

  it("refuses at the margin rather than eating the line", () => {
    expect(apply(doc("@panel\nbody"), 1, 1, -1)).toBe("REFUSED");
  });

  it("never outdents past the margin when the indent is not a whole unit", () => {
    // Three spaces with a unit of two gives back three, not a negative slice.
    const before = doc("@panel\n   odd");
    expect(apply(before, 1, 1, -1)).toBe("@panel\n odd");
    expect(apply(doc("@panel\n odd"), 1, 1, -1)).toBe("@panel\nodd");
  });

  it("is the inverse of Tab, for a family that had room to move", () => {
    const before = doc("@panel\n  first\n  second\n    child");
    const indented = apply(before, 2, 2, 1).split("\n");
    expect(apply(indented, 2, 2, -1)).toBe(before.join("\n"));
  });
});

describe("a fenced code block is content, not structure", () => {
  const withFence = doc(`
@panel
  Here is some code.

  \`\`\`python
  def f():
      return 1
  \`\`\`

  After.
`);

  it("knows which lines are inside a fence", () => {
    expect([...fencedLines(withFence)].sort((a, b) => a - b)).toEqual([3, 4, 5, 6]);
  });

  it("refuses to re-parent a line inside one", () => {
    // Re-parenting somebody's Python is the worst kind of help: in a fence,
    // indentation is the program.
    expect(apply(withFence, 4, 4, 1)).toBe("REFUSED");
    expect(apply(withFence, 5, 5, -1)).toBe("REFUSED");
  });

  it("refuses when a fence would be dragged along as a child", () => {
    expect(apply(withFence, 1, 1, 1)).toBe("REFUSED");
  });

  it("still works on lines outside it", () => {
    // "After." sits below the fence and moves like any other line.
    const after = apply(withFence, 8, 8, -1).split("\n");
    expect(after[8]).toBe("After.");
    // …and the fence itself is untouched by it.
    expect(after.slice(3, 7)).toEqual(withFence.slice(3, 7));
  });
});

describe("when Tab should just be a tab", () => {
  it.each([
    ["  first", 2, false, "at the indentation, which is where Tab re-parents"],
    ["  first", 0, false, "before the indentation"],
    ["  first", 3, true, "one character in, because you are typing"],
    ["  first", 7, true, "at the end of the line"],
    ["    ", 4, false, "on a blank line, whatever the column"],
    ["", 0, false, "on an empty line"],
  ])("%s at %i", (line, character, want) => {
    expect(isTypingPosition(line, character)).toBe(want);
  });

  it("matters because a tab is a real character in this language", () => {
    // `@table sep=tab` exists, so somebody typing a tab mid-line means it.
    expect(isTypingPosition("  Feature	Status", 11)).toBe(true);
  });
});

describe("what it refuses outright", () => {
  it.each([
    ["a range that runs off the end", 0, 99],
    ["a backwards range", 2, 1],
    ["a negative line", -1, 0],
  ])("%s", (_name, from, to) => {
    expect(reindent(doc("@panel\n  one\n  two"), from, to, 1, 2)).toBeUndefined();
  });

  it("a selection of nothing but blank lines", () => {
    expect(reindent(doc("@panel\n\n\nafter"), 1, 2, 1, 2)).toBeUndefined();
  });
});
