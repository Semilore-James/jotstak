// What accepting a completion leaves behind.
//
// The lesson taken from Dart's analysis server: the value of autocomplete is
// not the list, it is the construct you are holding afterwards. `@timeline` on
// its own answers none of the question somebody opened the list to ask, which
// is what goes underneath it. So every primitive that takes a body must
// scaffold one, and the parts you are meant to replace must be tabstops.
//
// These are checked for ALL twenty-eight primitives rather than the two I
// happened to try, because the scaffolds are derived from the schema's own
// examples and an example can be shaped in a way the derivation did not expect
// — @cover breaks its parameters over lines, @footnote's example holds two
// blocks, @numbered's is written in Markdown form at column zero.

import { describe as group, expect, it } from "vitest";
import { PRIMITIVES, getPrimitive } from "@jotstak/schema";
import type { PrimitiveSpec } from "@jotstak/schema";
import {
  exampleBodyLine,
  primitiveCompletions,
  rankText,
  scaffold,
  signature,
  tabstops,
  usedHere,
  valueCompletions,
} from "./language-features.js";

const snippet = (spec: PrimitiveSpec): string => scaffold(spec).value;
const stops = (s: string): number[] =>
  [...s.matchAll(/\$\{(\d+)[:|]/g)].map((m) => Number(m[1]));

group("the block a primitive scaffolds", () => {
  it.each(PRIMITIVES.map((p) => p.name))("@%s is usable the moment it is accepted", (name) => {
    const spec = getPrimitive(name)!;
    const text = snippet(spec);

    expect(text, "does not start with its own name").toMatch(new RegExp(`^${spec.name}\\b`));

    // Every required parameter, or the block is an error as inserted.
    for (const p of spec.params.filter((q) => q.required)) {
      expect(text, `leaves out the required ${p.name}`).toContain(`${p.name}=`);
    }

    // No optional parameter, or the author starts by deleting.
    for (const p of spec.params.filter((q) => !q.required)) {
      expect(text, `fills in the optional ${p.name}`).not.toContain(`${p.name}=`);
    }

    // A body if the primitive takes one, indented so it reads as body.
    if (spec.bodyShape === "none") {
      expect(text, "invents a body for a block that has none").not.toContain("\n");
    } else {
      expect(text, "has no body line").toContain("\n  ");
    }

    // Tabstops numbered from 1 with no gaps and no repeats, or Tab skips
    // somewhere strange.
    const ordered = stops(text);
    expect(ordered, "tabstops are out of order or repeated").toEqual(
      ordered.map((_, i) => i + 1),
    );
    expect(text, "never leaves the cursor after the block").toContain("$0");
  });

  it("takes the body hint from the primitive's own example", () => {
    // Not written here. A scaffold and a documentation page that disagree about
    // what a timeline event looks like is worse than having no scaffold.
    expect(exampleBodyLine(getPrimitive("timeline")!)).toBe("Q3 2026: Discovery");
    expect(snippet(getPrimitive("timeline")!)).toContain("${1:Q3 2026}: ${2:Discovery}");
  });

  it("turns away an example line that is not body", () => {
    // @cover continues its parameters onto the next line; @numbered's example
    // is the Markdown form and never opens a directive at all. Neither has a
    // body line to copy, and using what is there would scaffold nonsense.
    expect(exampleBodyLine(getPrimitive("cover")!)).toBeUndefined();
    // @footnote's example shows the reference first and the note second, so
    // the hint has to come from under the directive, not from line one.
    expect(exampleBodyLine(getPrimitive("footnote")!)).toBe(
      "Findings from the March discovery sprint, slide 14.",
    );
    expect(exampleBodyLine(getPrimitive("numbered")!)).toBeUndefined();
    // …and falls back to the shape rather than to nothing.
    expect(snippet(getPrimitive("numbered")!)).toContain("${1:item}");
  });

  it("puts a required enum in a choice list, not a quoted blank", () => {
    // There is no required enum today; this is the branch that would be wrong
    // the first time one is added.
    const invented: PrimitiveSpec = {
      ...getPrimitive("panel")!,
      params: [
        {
          name: "kind",
          type: "enum",
          required: true,
          description: "x",
          enumValues: ["one", "two"],
        },
      ],
    };
    expect(snippet(invented)).toContain("kind=${1|one,two|}");
  });

  it("escapes a hint that contains snippet syntax", () => {
    // A `$` or a `}` in an example body line would otherwise end the tabstop
    // early and insert broken text.
    expect(tabstops("cost: $40k")).toBe("${1:cost}: ${2:\\$40k}");
  });
});

group("breaking a hint into tabstops", () => {
  it.each([
    ["Q3 2026: Discovery", [": "], "${1:Q3 2026}: ${2:Discovery}"],
    ["Feature, Status, Owner", [" | ", ", "], "${1:Feature}, ${2:Status}, ${3:Owner}"],
    ["Search at tr", [], "${1:Search at tr}"],
    ["left:", [": "], "${1:left}:"],
  ] as [string, string[], string][])("%s", (line, seps, want) => {
    expect(tabstops(line, 1, seps)).toBe(want);
  });

  it("only splits on punctuation the primitive actually uses", () => {
    // @footnote's example is prose — "Findings from the March discovery
    // sprint, slide 14." — and a comma-splitter cut it in half and offered the
    // two halves as fields. Which separators count is asked of the primitive.
    expect(snippet(getPrimitive("footnote")!)).toContain(
      "${1:Findings from the March discovery sprint, slide 14.}",
    );
  });

  it("leaves a key whose value is a nested block as just the key", () => {
    // @columns writes `left:` and puts the column underneath it. The colon is
    // structure, not something to type over.
    expect(snippet(getPrimitive("columns")!)).toContain("${1:left}:");
  });

  it("starts where the parameters left off", () => {
    // @matrix takes two required parameters, so its body line is the third and
    // fourth stop, not the first.
    expect(snippet(getPrimitive("matrix")!)).toContain('x="${1:x}"');
    expect(snippet(getPrimitive("matrix")!)).toContain("${3:");
  });
});

group("the order the list comes in", () => {
  it("sorts a rank as a number, not as a string", () => {
    // "10" sorts before "9" as a string, so a plain rank shuffles the list the
    // moment there are ten of anything. Dart pads for the same reason.
    expect(rankText(10) < rankText(9)).toBe(true);
    expect(rankText(100) < rankText(10)).toBe(true);
    expect(rankText(0)).toHaveLength(4);
  });

  it("puts what the document already uses first", () => {
    // The only relevance signal we have that is honestly about this document.
    // Dart's comes from a scraped corpus and is the reason its own users
    // complain the obvious item is seventh.
    const used = usedHere('@decision title="Pricing"\n  context: x\n@doodle\n');
    expect(used).toContain("decision");

    const items = primitiveCompletions(used);
    const rank = (name: string) => items.find((i) => i.label === name)!.sortText!;
    // @decision is a PM artifact and @panel is structure, so on group order
    // alone @panel would lead. Being in the document beats the group.
    expect(rank("decision") < rank("panel")).toBe(true);
    // @note is also structure-adjacent and unused, so the used block still wins.
    expect(rank("decision") < rank("note")).toBe(true);
  });

  it("puts a block with no renderer last even when the document uses it", () => {
    // @doodle is the escape hatch and has no renderer. Having reached for it
    // once does not make offering it again a favour.
    const items = primitiveCompletions(usedHere("@doodle\n  box\n"));
    const rank = (name: string) => items.find((i) => i.label === name)!.sortText!;
    expect(rank("doodle") > rank("table")).toBe(true);
  });

  it("names the required parameters in the grey text beside the name", () => {
    // Dart puts the signature here so you can tell two overloads apart. Ours
    // says what you must supply, which is what decides whether you can use it.
    expect(signature(getPrimitive("matrix")!)).toBe("x, y · diagram");
    expect(signature(getPrimitive("quote")!)).toBe("text");
  });

  it("accepts a primitive on the space or bracket that would follow it", () => {
    const table = primitiveCompletions(new Set()).find((i) => i.label === "table")!;
    expect(table.commitCharacters).toEqual([" ", "("]);
  });
});

group("completing a value", () => {
  it("offers each choice with what it means, which a snippet list cannot", () => {
    const style = getPrimitive("table")!.params.find((p) => p.name === "style")!;
    const items = valueCompletions(style);
    expect(items.map((i) => i.label)).toEqual(["ruled", "sketch", "plain"]);
    expect(items[0]!.documentation!.value).toBe(style.description);
  });

  it("marks and preselects the default", () => {
    const style = getPrimitive("table")!.params.find((p) => p.name === "style")!;
    const items = valueCompletions(style);
    const ruled = items.find((i) => i.label === "ruled")!;
    expect(ruled.detail).toBe("default");
    expect(ruled.preselect).toBe(true);
  });

  it("keeps the schema's order rather than sorting alphabetically", () => {
    // The specs list values plainest first, which is the order to read them
    // in. Alphabetical would put `sketch` above `plain` for no reason.
    const items = valueCompletions(getPrimitive("table")!.params.find((p) => p.name === "style")!);
    expect(items[0]!.sortText! < items[1]!.sortText!).toBe(true);
  });
});
