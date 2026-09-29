// The composition matrix, held to what the renderer actually does.
//
// The schema says which blocks go inside which (`holds` and `nests`). That is
// only worth having if it is TRUE, and before it existed the answer lived in
// each renderer by accident: a tree in a panel worked, a tree in a column
// printed its own source back, a tree in a quote vanished, and none of the
// three said a word. So this renders every pair — all 28 blocks inside all 28
// — and checks the page against the matrix in both directions.

import { describe, expect, it } from "vitest";
import { PRIMITIVES, canHold } from "@jotstak/schema";
import type { PrimitiveSpec } from "@jotstak/schema";
import { render } from "./index.js";
import type { Diagnostic } from "./index.js";

/** A block written in @-form. Two primitives lead their examples with Markdown. */
function source(spec: PrimitiveSpec): string {
  return spec.examples.find((e) => e.startsWith("@")) ?? `@${spec.name}\n  Written by hand`;
}

const indent = (src: string, by: string): string =>
  src
    .split("\n")
    .map((l) => (l ? by + l : l))
    .join("\n");

/** The parent, then the child at the parent's own body indent. */
function compose(parent: PrimitiveSpec, child: PrimitiveSpec): { src: string; childLine: number } {
  const p = source(parent);
  const lines = p.split("\n");
  const bodyIndent = lines.slice(1).find((l) => l.trim())?.match(/^\s*/)![0] || "  ";
  return { src: `${p}\n${indent(source(child), bodyIndent)}`, childLine: lines.length };
}

/** The first element a block renders as, with its class: what it looks like on the page. */
function signature(spec: PrimitiveSpec): string | undefined {
  const { html } = render(source(spec), { mode: "notebook" });
  const m = /<div class="jot-body"[^>]*>(<([a-z0-9]+)(?: class="([^"]*)")?)/.exec(html);
  if (!m) return undefined;
  return m[3] ? `<${m[2]} class="${m[3]}"` : `<${m[2]}>`;
}

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;

/** Diagnostics that refuse a composition, as opposed to ones about a block's own content. */
const refusal = (d: Diagnostic): boolean =>
  d.severity === "warning" && /can't go|goes on the page itself/.test(d.message);

/** The longest real word a block says, to check it survives being misplaced. */
function aWordOf(spec: PrimitiveSpec): string | undefined {
  const body = source(spec)
    .split("\n")
    .slice(1)
    .join(" ");
  const title = source(spec).split("\n")[0]!.replace(/^@\S+/, "").replace(/\S+=("[^"]*"|\S+)/g, "");
  const words = `${title} ${body}`.match(/[A-Za-z]{5,}/g) ?? [];
  return words.sort((a, b) => b.length - a.length)[0];
}

const text = (html: string): string => html.replace(/<[^>]+>/g, " ");

describe("the composition matrix", () => {
  const pairs = PRIMITIVES.flatMap((parent) => PRIMITIVES.map((child) => [parent, child] as const));

  it.each(pairs.map(([p, c]) => [p.name, c.name, p, c] as const))(
    "@%s holding @%s does what the matrix says",
    (_p, _c, parent, child) => {
      const { src, childLine } = compose(parent, child);
      const { html, diagnostics } = render(src, { mode: "notebook" });
      const allowed = canHold(parent.name, child.name);
      const refused = diagnostics.filter(refusal).filter((d) => d.line === childLine);

      // 1. It says so exactly when it cannot go there.
      expect(refused.length > 0, `${src}\n\n${JSON.stringify(diagnostics, null, 1)}`).toBe(!allowed);

      // 2. Allowed means drawn as itself; refused means not. Counted against
      //    the parent alone, because a quote in a quote shares its markup.
      const sig = signature(child);
      // A list keeps a misplaced list as its own sub-items, which are a list:
      // correct, and indistinguishable by markup from the real thing.
      const keptAsList = !allowed && parent.bodyShape === "indented" && parent.holds === "text";
      if (sig && !child.planned && !keptAsList) {
        const alone = count(render(source(parent), { mode: "notebook" }).html, sig);
        const composed = count(html, sig);
        if (allowed) expect(composed, `${sig} in\n${src}`).toBeGreaterThan(alone);
        else expect(composed, `${sig} in\n${src}`).toBe(alone);
      }

      // 3. Nothing is lost either way. The exception is a parent with no body
      //    to keep text in — a divider, a page break, the metadata row — which
      //    already drops any line it cannot read, @ or not. It still warns.
      const keepsText = parent.bodyShape !== "none" && !(parent.bodyShape === "keyed" && parent.holds === "text");
      const word = aWordOf(child);
      if (word && keepsText) expect(text(html), `"${word}" lost from\n${src}`).toContain(word);
    },
  );
});

describe("a block written where only text can go", () => {
  const warnings = (src: string): string[] =>
    render(src, { mode: "notebook" }).diagnostics.filter(refusal).map((d) => d.message);

  it("names the column it was written in", () => {
    // The case that started this: a tree under a column's key printed its own
    // source as a paragraph, with no diagnostic at all.
    const [w] = warnings("@columns\n  left:\n    @tree\n      Root\n        Child\n  right:\n    Words");
    expect(w).toContain("the `left` column");
    expect(w).toContain("becomes a column of its own");
  });

  it("names the tree node it was written under", () => {
    const [w] = warnings('@tree\n  Root\n    Child\n      @metric name="Churn" value="4%"');
    expect(w).toContain("the node “Child”");
    expect(w).toContain("drawn below the tree");
  });

  it("catches a block under a Markdown list item", () => {
    const [w] = warnings("- A point\n  @tree\n    Root\n      Child");
    expect(w).toContain("under a list item");
  });

  it("reports a misplaced block once, not once per line of it", () => {
    expect(warnings("@quote\n  @panel\n    @tree\n      Root")).toHaveLength(1);
  });

  it("leaves an @-mention alone", () => {
    // `owner: @alex` is how PMs write an owner. Only a real primitive name is
    // a misplaced block; anything else is words that happen to start with @.
    expect(warnings("@meta\n  owner: @alex")).toEqual([]);
    expect(warnings("@panel\n  owner: @sam\n  @alex said this")).toEqual([]);
    expect(warnings("@tree\n  Root\n    @alex")).toEqual([]);
    expect(warnings("- Ask @priya about it")).toEqual([]);
  });
});

describe("a block that belongs to the page", () => {
  it("keeps a margin note's words when it is written inside a panel", () => {
    // It used to render as nothing at all: a note inside a panel became a
    // margin_note node, and a nested one had no margin to go to.
    const { html, diagnostics } = render('@panel title="P"\n  body\n  @note check the numbers', {
      mode: "notebook",
    });
    expect(text(html)).toContain("check the numbers");
    expect(diagnostics.find(refusal)?.message).toContain("sits in the margin beside it");
  });

  it("no longer tells you a sticky has no renderer", () => {
    // It has one. It just cannot go inside a panel, and saying "no renderer
    // yet" sent people looking for a feature that was already built.
    const { diagnostics } = render('@panel title="P"\n  @sticky one', { mode: "notebook" });
    expect(diagnostics.map((d) => d.message).join("\n")).not.toContain("no renderer");
  });
});
