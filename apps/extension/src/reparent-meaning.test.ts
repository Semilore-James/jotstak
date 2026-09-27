// Re-parenting has to change the document's MEANING the way it looks like it
// does, and not in any other way.
//
// reparent.test.ts checks the arithmetic: which lines move, and by how much.
// That is not the claim. The claim is that indentation decides what a block
// owns, so moving a line without its children silently changes ownership —
// and the only thing that can confirm ownership is the renderer, which is the
// thing that defines it.
//
// So: take a document, press Tab, render both, and ask the renderer what
// changed. It is the same argument as the extent ruler being tested against
// the renderer rather than against the parser's shape. A tool that uses a
// different rule from the renderer is confidently wrong about the one thing it
// exists to get right.

import { describe, expect, it } from "vitest";
import { render } from "@jotstak/renderer";
import { reindent } from "./reparent.js";

const doc = (text: string): string[] => text.replace(/^\n/, "").replace(/\n$/, "").split("\n");

/** Press Tab (or Shift-Tab) on a line range and hand back the new source. */
function press(lines: string[], from: number, to: number, dir: 1 | -1): string {
  const plan = reindent(lines, from, to, dir, 2);
  if (!plan) throw new Error(`refused: ${dir > 0 ? "Tab" : "Shift-Tab"} on ${from}..${to}`);
  const out = [...lines];
  for (const { line, text } of plan.lines) out[line] = text;
  return out.join("\n");
}

const html = (source: string): string => render(source, { mode: "notebook" }).html;
const problems = (source: string) =>
  render(source, { mode: "notebook" }).diagnostics.filter((d) => d.severity !== "info");

describe("what the renderer says after a Tab", () => {
  it("keeps a child inside the parent it moved with", () => {
    // `second` and its child move under `first`. Both are still in the panel,
    // and `child` is still inside `second` — which is the whole claim.
    const before = doc(`
@panel title="Scope"
  first
  second
    child of second
`);
    const after = press(before, 2, 2, 1);
    expect(problems(after)).toEqual([]);
    expect(html(after)).toContain("child of second");
    // Nested content renders inside a nested container; a child that had been
    // orphaned would come out as a sibling paragraph instead.
    expect(html(after)).toContain("jot-card");
  });

  it("does not change what the document contains, only its shape", () => {
    // Every word still there, before and after. A re-parent that dropped or
    // duplicated a line would pass every arithmetic test in the other file.
    const before = doc(`
@panel title="Scope"
  first
  second
    child of second
  third
`);
    const words = (s: string) => (s.match(/[a-z]+/g) ?? []).sort().join(" ");
    const after = press(before, 2, 2, 1);
    expect(words(html(after))).toBe(words(html(before.join("\n"))));
  });

  it("survives a round trip with the file byte-identical", () => {
    // Tab then Shift-Tab is the move somebody makes by accident constantly.
    // Coming back to something merely equivalent is not good enough: the file
    // is in Git and a stray two spaces is a diff.
    for (const [source, line] of [
      ["@panel\n  first\n  second\n    child", 2],
      ["@timeline\n  Q3: Discovery\n  Q4: Alpha\n    detail", 2],
      // Line 2 would be refused here — `One` is Root's first child, so there
      // is no sibling above it to nest under. `Two` has one.
      ["@tree\n  Root\n    One\n    Two", 3],
    ] as [string, number][]) {
      const there = press(doc(source), line, line, 1);
      const back = press(there.split("\n"), line, line, -1);
      expect(back, source).toBe(source);
    }
  });

  it("changes meaning out loud, never silently", () => {
    // Tab is a STRUCTURAL operation. Whether the structure it makes is
    // meaningful for a particular block is the renderer's job to say, not the
    // editor's to prevent — teaching Tab what a matrix will accept would put
    // renderer semantics in the editor and give the two somewhere to disagree.
    //
    // So the guarantee is not "the document stays clean". It is that when a
    // Tab does change what the document means, something says so.
    const before = doc(`
@matrix x="Effort" y="Impact"
  Search at top-right
  Export at top-left
`);
    expect(problems(before.join("\n"))).toEqual([]);

    // Indenting Export under Search makes it DETAIL of Search rather than a
    // second item. That is a real change of meaning, it is exactly what the
    // author asked for, and the matrix says what it did with it.
    const said = problems(press(before, 2, 2, 1));
    expect(said).toHaveLength(1);
    expect(said[0]!.message).toContain("not drawn");
  });

  it("moves a whole figure without disturbing what it draws", () => {
    // A timeline nested inside a panel is still a timeline.
    const before = doc(`
@panel title="Plan"
  Some prose.
@timeline
  Q3 2026: Discovery
  Q4 2026: Alpha
`);
    const after = press(before, 2, 2, 1);
    expect(problems(after)).toEqual([]);
    expect(html(after)).toContain('data-figure="timeline"');
    // …and it is inside the panel now, which is what the Tab meant.
    expect(html(after)).toContain("jot-nested");
  });
});
