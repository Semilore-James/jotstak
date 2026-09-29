// Autocomplete asks the parser's question before it offers anything: can a
// block go HERE? The answers are held to the renderer's, so the editor never
// offers a block the page will then warn about.

import { describe, expect, it } from "vitest";
import { PRIMITIVES, canHold, getPrimitive, slotAt } from "@jotstak/schema";
import { render } from "@jotstak/renderer";
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

  // UX-65: a column and a list item hold blocks, at any depth inside them.
  const parentOf = (doc: string): string | false => {
    const s = slot(doc);
    return s.kind === "block" && s.parent.name;
  };

  it("under a column's key, the column holds it", () => {
    expect(parentOf("@columns\n  left:\n    |")).toBe("columns");
    expect(parentOf("@columns\n  left:\n    Some words\n      |")).toBe("columns");
  });

  it("under a list item, the list holds it, in either spelling", () => {
    expect(parentOf("- A point\n  |")).toBe("bullet");
    expect(parentOf("1. A step\n   |")).toBe("numbered");
    expect(parentOf("- A\n  - a1\n    |")).toBe("bullet");
    expect(parentOf("- A point that\n  wraps\n    |")).toBe("bullet");
    expect(parentOf("@bullet\n  A point\n    |")).toBe("bullet");
  });

  it("between the items of @bullet, only text", () => {
    expect(slot("@bullet\n  A point\n  |").kind).toBe("text");
  });

  it("under a list written inside a card, the card's text", () => {
    expect(slot('@panel title="P"\n  - item\n    |').kind).toBe("text");
  });

  it("under a tree's node, a card's key or a paragraph, only text", () => {
    expect(slot("@tree\n  Root\n    |").kind).toBe("text");
    expect(slot("@decision\n  context: why\n    |").kind).toBe("text");
    expect(slot("A paragraph.\n  |").kind).toBe("text");
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
        // A list takes a block under one of its items, not between them.
        const src =
          parent.holds === "items"
            ? `@${parent.name}\n  An item\n    @${child.name}\n      Words`
            : `@${parent.name}\n  @${child.name}\n    Words`;
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

describe("settings that are not built yet (ENG-34)", () => {
  it("are not advertised on the hover card", () => {
    // `icon` was listed under every block, and nothing read it.
    const card = hoverFor(getPrimitive("panel")!).value;
    expect(card).toContain("`width`");
    expect(card).not.toContain("`icon`");
  });

  it("say so when used, and still parse", () => {
    const { diagnostics } = render('@panel icon=star title="P"\n  Words', { mode: "notebook" });
    expect(diagnostics.map((d) => `${d.severity}: ${d.message}`)).toEqual([
      "info: `icon` is not built yet, so it does nothing for now. It waits on the icon set.",
    ]);
  });
});
