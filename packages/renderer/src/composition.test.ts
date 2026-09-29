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

/**
 * The parent, then the child at the parent's own body indent — or, for a
 * list, under its last item, since that is where a list takes a block.
 */
function compose(parent: PrimitiveSpec, child: PrimitiveSpec): { src: string; childLine: number } {
  const p = source(parent);
  const lines = p.split("\n");
  const bodyIndent = lines.slice(1).find((l) => l.trim())?.match(/^\s*/)![0] || "  ";
  const at = parent.holds === "items" ? `${bodyIndent}  ` : bodyIndent;
  return { src: `${p}\n${indent(source(child), at)}`, childLine: lines.length };
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
      if (sig && !child.planned) {
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

  it("names the tree node it was written under", () => {
    const [w] = warnings('@tree\n  Root\n    Child\n      @metric name="Churn" value="4%"');
    expect(w).toContain("the node “Child”");
    expect(w).toContain("drawn below the tree");
  });

  it("catches a block between the items of @bullet rather than under one", () => {
    const [w] = warnings("@bullet\n  A point\n  @tree\n    Root");
    expect(w).toContain("between the items of `@bullet`");
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

describe("a block under a list item or a column's key (UX-65)", () => {
  const html = (src: string): string => {
    const r = render(src, { mode: "notebook" });
    expect(r.diagnostics.filter(refusal), src).toEqual([]);
    return r.html;
  };

  it("goes inside the list item it is written under", () => {
    // The report that started the matrix: a point, then the tree that explains
    // it. It used to come out as one line, "A point @tree Root Child".
    const out = html("- A point\n  @tree\n    Root\n      Child\n- Next point");
    expect(out).toMatch(/<li>A point<div class="jot-nested" style="--jot-depth:1"><div class="jot-figure"[\s\S]*?<\/li><li>Next point<\/li>/);
  });

  it("keeps the order it was written in, among the sub-points", () => {
    const out = html('- A\n  - first\n  @metric name="M" value="1"\n  - second');
    const at = (s: string): number => out.indexOf(s);
    expect(at("first")).toBeLessThan(at('data-primitive="metric"'));
    expect(at('data-primitive="metric"')).toBeLessThan(at("second"));
  });

  it("goes under a numbered item, and under a sub-item", () => {
    expect(html("1. Step\n   @callout warn\n     Careful")).toMatch(/<ol><li>Step<div class="jot-nested" style="--jot-depth:1"><aside class="jot-callout"/);
    expect(html("- A\n  - a1\n    @tree\n      Root")).toMatch(/<li>a1<div class="jot-nested" style="--jot-depth:2"><div class="jot-figure"/);
  });

  it("works in the @bullet spelling too", () => {
    expect(html("@bullet\n  A point\n    @tree\n      Root")).toMatch(/<li>A point<div class="jot-nested" style="--jot-depth:1"><div class="jot-figure"/);
  });

  it("goes in the column whose key it is written under", () => {
    const out = html("@columns\n  left:\n    Words first.\n    @tree\n      Root\n        Child\n  right:\n    Other words");
    const left = /<div class="jot-col"><p class="jot-col-heading">left<\/p>([\s\S]*?)<div class="jot-col">/.exec(out)?.[1] ?? "";
    expect(left).toContain("Words first.");
    expect(left).toContain('class="jot-figure"');
    expect(left.indexOf("Words first.")).toBeLessThan(left.indexOf("jot-figure"));
  });

  it("still joins a wrapped line onto the item, and leaves an @-mention as words", () => {
    // Markdown's lazy continuation, and a name that happens to lead a line.
    expect(html("- A point that\n  wraps onto a second line")).toContain("<li>A point that wraps onto a second line</li>");
    const out = render("- Meeting\n  @priya to follow up", { mode: "notebook" }).html;
    expect(out).not.toContain("jot-nested");
    expect(out).toContain("@priya to follow up");
  });

  it("keeps a page-level block's words, and says where it goes instead", () => {
    const r = render("- A point\n  @note check this", { mode: "notebook" });
    expect(text(r.html)).toContain("check this");
    expect(r.diagnostics.find(refusal)?.message).toContain("inside a list item");
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
