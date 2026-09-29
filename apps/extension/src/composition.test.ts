// Autocomplete asks the parser's question before it offers anything: can a
// block go HERE? The answers are held to the renderer's, so the editor never
// offers a block the page will then warn about.

import { describe, expect, it } from "vitest";
import { PRIMITIVES, canHold, getPrimitive } from "@jotstak/schema";
import { render } from "@jotstak/renderer";
import { slotAt } from "./composition.js";
import { describe as hoverFor, primitiveCompletions } from "./language-features.js";

/** Where the `|` is, as a slot. */
function slot(doc: string) {
  const lines = doc.split("\n");
  const line = lines.findIndex((l) => l.includes("|"));
  return slotAt(lines, line, lines[line]!.indexOf("|"));
}

describe("where the cursor is", () => {
  it("at the left edge, anything can start", () => {
    expect(slot("# Title\n|").kind).toBe("page");
  });

  it("directly inside a panel, the panel holds it", () => {
    const s = slot('@panel title="P"\n  some words\n  |');
    expect(s.kind === "block" && s.parent.name).toBe("panel");
  });

  it("inside a block that has no body yet", () => {
    const s = slot("@callout warn\n  |");
    expect(s.kind === "block" && s.parent.name).toBe("callout");
  });

  it("inside a quote, only text", () => {
    expect(slot("@quote\n  |").kind).toBe("text");
  });

  it("under a column's key, only text — the case that started this", () => {
    expect(slot("@columns\n  left:\n    |").kind).toBe("text");
  });

  it("under a list item, only text", () => {
    expect(slot("- A point\n  |").kind).toBe("text");
  });

  it("under a tree's node, only text", () => {
    expect(slot("@tree\n  Root\n    |").kind).toBe("text");
  });

  it("skips blank lines to find the owner", () => {
    const s = slot('@panel title="P"\n  words\n\n  |');
    expect(s.kind === "block" && s.parent.name).toBe("panel");
  });
});

describe("what autocomplete offers there", () => {
  it("offers everything at the left edge", () => {
    expect(primitiveCompletions(new Set())).toHaveLength(PRIMITIVES.length);
  });

  it("inside a panel, only the blocks a panel can hold", () => {
    const offered = primitiveCompletions(new Set(), getPrimitive("panel")).map((c) => c.label);
    expect(offered).toContain("tree");
    expect(offered).not.toContain("note");
    expect(offered).not.toContain("cover");
    expect(offered).not.toContain("page");
  });

  it("never offers a block the renderer would refuse", () => {
    // Held to the page, not only to the matrix: every block offered inside
    // every container renders there without a composition warning.
    for (const parent of PRIMITIVES.filter((p) => p.holds !== "text")) {
      for (const item of primitiveCompletions(new Set(), parent)) {
        const child = getPrimitive(String(item.label))!;
        expect(canHold(parent.name, child.name)).toBe(true);
        const src = `@${parent.name}\n  @${child.name}\n    Words`;
        const refused = render(src, { mode: "notebook" }).diagnostics.filter((d) =>
          /can't go|goes on the page itself/.test(d.message),
        );
        expect(refused, src).toEqual([]);
      }
    }
  });
});

describe("the hover card", () => {
  it("says what can go inside the block", () => {
    expect(hoverFor(getPrimitive("panel")!).value).toContain("Other blocks can go inside it.");
    expect(hoverFor(getPrimitive("quote")!).value).toContain("Holds text, not other blocks.");
    expect(hoverFor(getPrimitive("note")!).value).toContain("never inside another block");
  });
});
