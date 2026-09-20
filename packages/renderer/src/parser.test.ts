import { describe, it, expect } from "vitest";
import { parse } from "./parser.js";
import type { BlockNode, HeadingNode, ListNode, MarginNoteNode, QuoteNode, MarkdownNode, DividerNode } from "./ast.js";

function first(src: string) {
  return parse(src).ast.children[0]!;
}

describe("parser — block bodies by shape", () => {
  it("shapes a keyed body into fields", () => {
    const n = first(
      '@decision title="Use Astro"\n  context: local-first\n  choice: Astro on Pages\n  consequences: near-zero cost',
    ) as BlockNode;

    expect(n.type).toBe("block");
    expect(n.name).toBe("decision");
    expect(n.params.title).toBe("Use Astro");
    expect(n.body.shape).toBe("keyed");
    if (n.body.shape !== "keyed") throw new Error("wrong shape");
    expect(n.body.fields.map((f) => f.key)).toEqual(["context", "choice", "consequences"]);
    expect(n.body.fields[0]!.value).toBe("local-first");
  });

  it("shapes a plain body into lines", () => {
    const n = first(
      '@quote by="P7"\n  I just want it to not lose my work.\n  Three tabs open, terrified.',
    ) as QuoteNode;

    expect(n.type).toBe("quote");
    expect(n.lines).toHaveLength(2);
    expect(n.lines[0]).toBe("I just want it to not lose my work.");
  });

  it("shapes an indented body into a tree", () => {
    const n = first("@tree dir=right\n  Orders\n    Customer\n      Segment\n    Product") as BlockNode;

    expect(n.body.shape).toBe("indented");
    if (n.body.shape !== "indented") throw new Error("wrong shape");
    expect(n.body.roots).toHaveLength(1);
    const orders = n.body.roots[0]!;
    expect(orders.text).toBe("Orders");
    expect(orders.children.map((c) => c.text)).toEqual(["Customer", "Product"]);
    expect(orders.children[0]!.children[0]!.text).toBe("Segment");
  });

  it("shapes a mixed body into fields plus loose rows", () => {
    const n = first(
      '@panel title="Sprint 14"\n  goal: Ship the table primitive\n  capacity: 3 engineers\n  items:\n    [done] Table renderer\n    [todo] Playground wiring',
    ) as BlockNode;

    expect(n.body.shape).toBe("mixed");
    if (n.body.shape !== "mixed") throw new Error("wrong shape");
    expect(n.body.fields.map((f) => f.key)).toEqual(["goal", "capacity", "items"]);

    const items = n.body.fields.find((f) => f.key === "items")!;
    expect(items.value).toBe("");
    expect(items.children.map((c) => c.text)).toEqual([
      "[done] Table renderer",
      "[todo] Playground wiring",
    ]);
  });

  it("treats comma rows as loose content, not fields", () => {
    const n = first("@table\n  Feature, Status, Owner\n  Search, Shipped, Ana") as BlockNode;

    expect(n.body.shape).toBe("mixed");
    if (n.body.shape !== "mixed") throw new Error("wrong shape");
    expect(n.body.fields).toHaveLength(0);
    expect(n.body.roots.map((r) => r.text)).toEqual([
      "Feature, Status, Owner",
      "Search, Shipped, Ana",
    ]);
  });

  it("keeps deeper key:value lines as children, not top-level fields", () => {
    const n = first("@table\n  - Feature: Search\n    Status: Shipped\n  - Feature: Export\n    Status: In progress") as BlockNode;

    if (n.body.shape !== "mixed") throw new Error("wrong shape");
    expect(n.body.fields).toHaveLength(0);
    expect(n.body.roots).toHaveLength(2);
    expect(n.body.roots[0]!.text).toBe("- Feature: Search");
    expect(n.body.roots[0]!.children[0]!.text).toBe("Status: Shipped");
  });

  it("gives a none-shape primitive an empty body", () => {
    const n = first("@page margin=both rule=ruled") as BlockNode;
    expect(n.body.shape).toBe("none");
    expect(n.params.margin).toBe("both");
  });
});

describe("parser — shorthand and directive produce the same node", () => {
  it("# Overview and @heading Overview agree", () => {
    const a = first("# Overview") as HeadingNode;
    const b = first("@heading Overview") as HeadingNode;

    expect(a.type).toBe("heading");
    expect(b.type).toBe("heading");
    expect(a.level).toBe(b.level);
    expect(a.text).toBe(b.text);
  });

  it("### maps to level 3 and @heading level=3 matches", () => {
    const a = first("### Deep") as HeadingNode;
    const b = first("@heading level=3 Deep") as HeadingNode;
    expect(a.level).toBe(3);
    expect(b.level).toBe(3);
    expect(b.text).toBe("Deep");
  });

  it("--- and @divider agree", () => {
    expect((first("---") as DividerNode).type).toBe("divider");
    expect((first("@divider") as DividerNode).type).toBe("divider");
    expect((first("@divider style=wave") as DividerNode).style).toBe("wave");
  });

  it(">> and @note both produce a margin note", () => {
    const a = first(">> revisit at scale") as MarginNoteNode;
    const b = first("@note\n  revisit at scale") as MarginNoteNode;

    expect(a.type).toBe("margin_note");
    expect(b.type).toBe("margin_note");
    expect(a.lines).toEqual(["revisit at scale"]);
    expect(b.lines).toEqual(["revisit at scale"]);
  });

  it("> and @quote both produce a quote", () => {
    const a = first("> A wise thought") as QuoteNode;
    const b = first('@quote by="P7"\n  A wise thought') as QuoteNode;

    expect(a.type).toBe("quote");
    expect(b.type).toBe("quote");
    expect(a.lines).toEqual(["A wise thought"]);
    expect(b.lines).toEqual(["A wise thought"]);
    expect(b.params.by).toBe("P7");
  });
});

describe("parser — shortcode sugar", () => {
  it("@warn resolves to callout with flavor=warn", () => {
    const n = first("@warn\n  Metric is lagging.") as BlockNode;
    expect(n.name).toBe("callout");
    expect(n.writtenAs).toBe("warn");
    expect(n.params.flavor).toBe("warn");
  });

  it("@callout warn sets flavor from the first bare word", () => {
    const n = first("@callout warn\n  Metric is lagging.") as BlockNode;
    expect(n.name).toBe("callout");
    expect(n.params.flavor).toBe("warn");
    expect(n.title).toBe("");
  });

  it("does not eat a title that is not an enum value", () => {
    const n = first("@cover Discovery phase") as BlockNode;
    expect(n.name).toBe("cover");
    expect(n.title).toBe("Discovery phase");
    expect(n.params.style).toBeUndefined();
  });
});

describe("parser — lists", () => {
  it("nests bullets by indentation", () => {
    const n = first("- First\n  - Nested\n    - Deep\n- Second") as ListNode;

    expect(n.type).toBe("list");
    expect(n.ordered).toBe(false);
    expect(n.items).toHaveLength(2);
    expect(n.items[0]!.text).toBe("First");
    expect(n.items[0]!.children[0]!.text).toBe("Nested");
    expect(n.items[0]!.children[0]!.children[0]!.text).toBe("Deep");
    expect(n.items[1]!.text).toBe("Second");
  });

  it("marks numbered lists as ordered", () => {
    const n = first("1. First\n2. Second") as ListNode;
    expect(n.ordered).toBe(true);
    expect(n.items.map((it) => it.text)).toEqual(["First", "Second"]);
  });
});

describe("parser — prose and structure", () => {
  it("groups consecutive prose into one markdown node", () => {
    const n = first("Some prose.\nMore prose on the next line.") as MarkdownNode;
    expect(n.type).toBe("markdown");
    expect(n.text).toBe("Some prose.\nMore prose on the next line.");
  });

  it("keeps a blank line inside a prose run as a paragraph break", () => {
    const n = first("Para one.\n\nPara two.") as MarkdownNode;
    expect(n.text).toBe("Para one.\n\nPara two.");
  });

  it("drops comments entirely", () => {
    const { ast } = parse("// internal\n# Title");
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]!.type).toBe("heading");
  });

  it("warns on an indented line with no block above it", () => {
    const { diagnostics } = parse("  orphaned indent");
    expect(diagnostics.some((d) => d.message.includes("does not belong to any block"))).toBe(true);
  });

  it("records source positions on every node", () => {
    const { ast } = parse("# Title\n\n@divider\n\n- Item");
    expect(ast.children[0]!.position.line).toBe(0);
    expect(ast.children[1]!.position.line).toBe(2);
    expect(ast.children[2]!.position.line).toBe(4);
  });
});

describe("parser — whole documents", () => {
  it("parses a realistic .jot document", () => {
    const src = [
      "@meta",
      "  project: Jotstak",
      "  status: active",
      "",
      "# Overview",
      "",
      "Jotstak renders documents as a notebook.",
      "",
      '@decision title="Use hybrid parser" status=accepted',
      "  context: must handle .jot and .md",
      "  choice: hand-written scanner + markdown-it",
      "",
      ">> hardest call so far",
      "",
      "- First",
      "- Second",
    ].join("\n");

    const { ast, diagnostics } = parse(src);
    expect(diagnostics).toHaveLength(0);
    expect(ast.children.map((c) => c.type)).toEqual([
      "block",
      "heading",
      "markdown",
      "block",
      "margin_note",
      "list",
    ]);
  });

  it("parses a plain Markdown file with zero diagnostics", () => {
    const md = [
      "# My Document",
      "",
      "Some paragraph with **bold** and *italic*.",
      "",
      "- List item one",
      "- List item two",
      "",
      "> A blockquote",
      "",
      "---",
      "",
      "1. Numbered",
      "2. Items",
    ].join("\n");

    const { ast, diagnostics } = parse(md);
    expect(diagnostics).toHaveLength(0);
    expect(ast.children.map((c) => c.type)).toEqual([
      "heading",
      "markdown",
      "list",
      "quote",
      "divider",
      "list",
    ]);
  });

  it("keeps content from an unknown primitive rather than dropping it", () => {
    const { ast, diagnostics } = parse("@nonexistent\n  some content");
    expect(diagnostics.some((d) => d.message.includes("Unknown primitive"))).toBe(true);
    expect(ast.children[0]!.type).toBe("markdown");
    expect((ast.children[0] as MarkdownNode).text).toContain("some content");
  });

  it("survives a blank line inside a block body", () => {
    const n = first('@decision title="X"\n  context: a\n\n  choice: b') as BlockNode;
    if (n.body.shape !== "keyed") throw new Error("wrong shape");
    expect(n.body.fields.map((f) => f.key)).toEqual(["context", "choice"]);
  });
});

describe("parser — list continuation lines", () => {
  it("treats an unmarked wrapped line as continuation, not a child", () => {
    const n = first("- Context is lost on the seams. The diagram lives in\n  a different tool from the paragraph.") as ListNode;
    expect(n.items).toHaveLength(1);
    expect(n.items[0]!.children).toHaveLength(0);
    expect(n.items[0]!.text).toBe(
      "Context is lost on the seams. The diagram lives in a different tool from the paragraph.",
    );
  });

  it("still nests a genuinely marked sub-bullet", () => {
    const n = first("- Parent wraps\n  onto a second line\n  - Real child") as ListNode;
    expect(n.items).toHaveLength(1);
    expect(n.items[0]!.text).toBe("Parent wraps onto a second line");
    expect(n.items[0]!.children.map((c) => c.text)).toEqual(["Real child"]);
  });
});

describe("parser — parenthesised param lists", () => {
  it("accepts params in parentheses on one line", () => {
    const n = first('@decision(title="Use Astro" status=accepted)\n  context: local-first') as BlockNode;
    expect(n.params.title).toBe("Use Astro");
    expect(n.params.status).toBe("accepted");
  });

  it("accepts params spanning several lines", () => {
    const n = first(
      '@decision(\n  title="Move to usage-based pricing"\n  status=deprecated\n  date=2026-09-19\n)\n  context: Seat pricing punishes fast adopters\n  choice: Usage-based',
    ) as BlockNode;
    expect(n.params).toEqual({
      title: "Move to usage-based pricing",
      status: "deprecated",
      date: "2026-09-19",
    });
    if (n.body.shape !== "keyed") throw new Error("wrong shape");
    expect(n.body.fields.map((f) => f.key)).toEqual(["context", "choice"]);
  });

  it("means exactly the same as the inline form", () => {
    const inline = first('@decision title="Use Astro" status=accepted\n  context: local-first') as BlockNode;
    const parens = first('@decision(title="Use Astro" status=accepted)\n  context: local-first') as BlockNode;
    expect(parens.params).toEqual(inline.params);
    expect(parens.body).toEqual(inline.body);
  });

  it("does not let a parenthesis inside a quoted value unbalance the list", () => {
    const n = first('@decision(title="Pricing (Q3) review" status=accepted)\n  context: x') as BlockNode;
    expect(n.params.title).toBe("Pricing (Q3) review");
    expect(n.params.status).toBe("accepted");
  });

  it("treats text after the closing paren as the title", () => {
    const n = first("@cover(style=bold) Discovery phase") as BlockNode;
    expect(n.params.style).toBe("bold");
    expect(n.title).toBe("Discovery phase");
  });

  it("reports an unclosed parameter list", () => {
    const { diagnostics } = parse('@decision(\n  title="oops"\n  context: y');
    expect(diagnostics.some((d) => d.severity === "error" && d.message.includes("Unclosed `(`"))).toBe(true);
  });

  it("leaves `@name(` inside a code fence alone", () => {
    const { diagnostics } = parse('```js\n@decision(\n```\n\nAfter.');
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
});

describe("parser — nested blocks", () => {
  it("parses a block inside a block", () => {
    const n = first(
      '@decision(title="Pricing")\n  context: seats punish adopters\n\n  @metric(name="WAU" value="1,240")\n    Growing 8%.',
    ) as BlockNode;

    expect(n.name).toBe("decision");
    expect(n.children).toHaveLength(1);
    const child = n.children[0] as BlockNode;
    expect(child.type).toBe("block");
    expect(child.name).toBe("metric");
    expect(child.params.value).toBe("1,240");
  });

  it("keeps the parent's own fields separate from its children", () => {
    const n = first(
      '@decision(title="Pricing")\n  context: a\n  choice: b\n\n  @quote(by="P7")\n    it cost money',
    ) as BlockNode;
    if (n.body.shape !== "keyed") throw new Error("wrong shape");
    expect(n.body.fields.map((f) => f.key)).toEqual(["context", "choice"]);
    expect(n.children).toHaveLength(1);
  });

  it("nests more than one level deep", () => {
    const n = first(
      '@decision(title="Outer")\n  @risk(level=high title="Middle")\n    @metric(name="Inner" value="1")',
    ) as BlockNode;
    const mid = n.children[0] as BlockNode;
    expect(mid.name).toBe("risk");
    const inner = mid.children[0] as BlockNode;
    expect(inner.name).toBe("metric");
    expect(inner.params.name).toBe("Inner");
  });

  it("reports a nested block's diagnostics against the real file line", () => {
    const { diagnostics } = parse(
      '@decision(title="X")\n  context: a\n\n  @nonexistent\n    body',
    );
    const unknown = diagnostics.find((d) => d.message.includes("Unknown primitive"));
    expect(unknown).toBeDefined();
    // The @nonexistent line is line 4 of the document (index 3), not line 0 of
    // the extracted sub-document.
    expect(unknown!.line).toBe(3);
  });

  it("leaves a block with no nested children with an empty array", () => {
    const n = first('@decision(title="X")\n  context: a') as BlockNode;
    expect(n.children).toEqual([]);
  });
});

describe("parser — indentation is the sharpest edge, so it is reported", () => {
  const indentWarnings = (src: string) =>
    parse(src).diagnostics.filter((d) => /Ambiguous indentation/.test(d.message));

  it("flags a branch indented between its parent and its parent's children", () => {
    // Reported from the playground: this tree lost its entire left side. The
    // one-space overshoot made "Pillar B" a child of "Pillar A" rather than its
    // sibling, so nothing remained to balance against and the hub drifted off
    // centre. The source looked correct, and the output said nothing.
    const src = [
      "@tree dir=split",
      "  Central idea",
      "    > Pillar A",
      "      > Sub-point",
      "     Pillar B",
      "      Sub-point",
    ].join("\n");

    const warnings = indentWarnings(src);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.line).toBe(4);
    expect(warnings[0]!.message).toContain("5 spaces in");
    expect(warnings[0]!.message).toContain('"Pillar A"');
    expect(warnings[0]!.message).toContain("sit at 6");
  });

  it("says nothing when the same tree is indented consistently", () => {
    const src = [
      "@tree dir=split",
      "  Central idea",
      "    > Pillar A",
      "      > Sub-point",
      "    Pillar B",
      "      Sub-point",
    ].join("\n");
    expect(indentWarnings(src)).toEqual([]);
  });

  it("judges consistency, not step size, so a four-space document is fine", () => {
    const src = ["@tree", "    A", "        B", "        C", "    D"].join("\n");
    expect(indentWarnings(src)).toEqual([]);
  });

  it("accepts different step sizes at different depths, as long as siblings agree", () => {
    const src = ["@tree", "  A", "      B", "      C", "  D"].join("\n");
    expect(indentWarnings(src)).toEqual([]);
  });

  it("flags top-level lines that do not line up with each other", () => {
    // Only reachable when a later root is *shallower* than the first: a deeper
    // line is never ambiguous, it simply nests.
    const src = ["@tree", "   A", "  B"].join("\n");
    const warnings = indentWarnings(src);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("the other top-level lines");
  });
});
