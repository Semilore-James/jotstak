// Every primitive must be able to explain itself in the editor.
//
// The schema has had a summary, typed parameters with descriptions and
// defaults, and worked examples for all of them since the beginning — and
// every word of it went to the documentation site and none of it to the place
// somebody is actually trying to remember what @panel does. This checks the
// hover card is really built from that, for every primitive, rather than for
// the two I happened to try.

import { describe as group, expect, it } from "vitest";
import { PRIMITIVES, getPrimitive } from "@jotstak/schema";
import { describe as hoverFor } from "./language-features.js";

group("the hover card", () => {
  it.each(PRIMITIVES.map((p) => p.name))("@%s explains itself", (name) => {
    const spec = getPrimitive(name)!;
    const card = hoverFor(spec).value;

    expect(card, "does not name the primitive").toContain(`**@${spec.name}**`);
    expect(card, "does not say what it is").toContain(spec.short);

    for (const p of spec.params) {
      expect(card, `omits the ${p.name} parameter`).toContain(`\`${p.name}\``);
    }
  });

  it("shows an example where the schema has one", () => {
    const spec = getPrimitive("matrix")!;
    expect(hoverFor(spec).value).toContain(spec.examples[0]!);
  });

  it("names the other spellings, so an alias is not a dead end", () => {
    // @h2 and @warn have to lead somewhere: hovering one should say what it is.
    const heading = getPrimitive("heading")!;
    expect(heading.aliases).toContain("h2");
    expect(hoverFor(heading).value).toContain("`@h2`");
  });

  it("marks a required parameter as required and an optional one's default", () => {
    const matrix = hoverFor(getPrimitive("matrix")!).value;
    expect(matrix).toContain("(required)");
    expect(matrix).toContain("(default axes)");
  });

  it("stays short: one line to say what it is, not a paragraph", () => {
    // A hover card long enough to scroll is one nobody reads to the end of.
    for (const spec of PRIMITIVES) {
      expect(spec.short.length, `@${spec.name}'s one-liner is a paragraph`).toBeLessThan(90);
      expect(spec.short, `@${spec.name}'s one-liner has an em dash`).not.toContain("—");
      // One sentence. A line that needs a second one is not a one-liner.
      expect(
        spec.short.replace(/(e\.g|i\.e)\./g, "").split(". ").length,
        `@${spec.name}'s one-liner is two sentences`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("puts the example above the parameters, because the shape reads faster", () => {
    const card = hoverFor(getPrimitive("matrix")!).value;
    expect(card.indexOf("```")).toBeLessThan(card.indexOf("**Parameters**"));
  });

  it("cuts a parameter description at its first sentence", () => {
    // The schema's descriptions are written for a docs page — the longest is
    // 444 characters. The card takes the part that says what the thing IS.
    const page = hoverFor(getPrimitive("page")!).value;
    expect(page).toContain("What a single Enter does in prose");
    expect(page).not.toContain("this is ruled paper");
  });

  it("lists an enum's choices rather than the word 'enum'", () => {
    // "style: enum" tells you nothing you could not guess. The values are the
    // reason to look.
    expect(hoverFor(getPrimitive("table")!).value).toContain("ruled | sketch | plain");
  });
});
