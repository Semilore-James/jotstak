// A scaffold must RENDER. This is the test, and the rest are details.
//
// An autocomplete that hands somebody a block the renderer then complains about
// is worse than one that hands back a bare name: the name at least does not
// look like it was supposed to work. And the scaffolds are derived — from each
// primitive's own documented example, through a separator rule — so the way
// they break is not "this one is wrong", it is "the derivation was wrong for a
// shape I did not think of". That is only findable by running all of them.
//
// So: insert every scaffold as VS Code would, hand it to the real renderer, and
// require silence.

import { describe as group, expect, it } from "vitest";
import { PRIMITIVES } from "@jotstak/schema";
import { render } from "@jotstak/renderer";
import { primitiveCompletions, scaffold } from "./language-features.js";

/**
 * What the editor leaves in the buffer once the snippet is accepted and the
 * author has tabbed through without changing anything.
 *
 * `${1:hint}` becomes `hint`, a choice list becomes its first option, `$0`
 * disappears. This is VS Code's own behaviour, not an approximation of it.
 */
export function accept(snippet: string): string {
  return snippet
    .replace(/\$\{\d+\|([^|]*)\|\}/g, (_, choices: string) => choices.split(",")[0]!)
    .replace(/\$\{\d+:((?:[^{}\\]|\\.)*)\}/g, (_, hint: string) => hint.replace(/\\([\\$}])/g, "$1"))
    .replace(/\$\{\d+\}/g, "")
    .replace(/\$0/g, "");
}

const BUILT = PRIMITIVES.filter((p) => !p.planned);

group("accepting a scaffold", () => {
  it.each(BUILT.map((p) => p.name))("@%s renders with nothing to report", (name) => {
    const spec = BUILT.find((p) => p.name === name)!;
    const source = "@" + accept(scaffold(spec).value);

    const { html, diagnostics } = render(source, { mode: "notebook" });

    // An error means the scaffold is not valid `.jot`. A warning means it is
    // valid but incomplete — "this star model has no dimensions" — which is
    // just as bad coming straight out of the editor.
    expect(diagnostics, `@${name} scaffolds to:\n${source}\n`).toEqual([]);
    expect(html, `@${name} rendered nothing`).toContain("jot-");
  });

  // The five that are named in the language and draw nothing yet. Pinned in
  // BOTH directions on purpose: an unflagged primitive that stops rendering
  // fails above, and a flagged one that starts rendering fails here. Either way
  // the schema and the renderer are made to agree before a release.
  it("knows exactly which primitives have no renderer", () => {
    expect(PRIMITIVES.filter((p) => p.planned).map((p) => p.name)).toEqual([
      "footnote",
      "doodle",
      "sticky",
      "icon",
    ]);
  });

  it.each(PRIMITIVES.filter((p) => p.planned).map((p) => p.name))(
    "@%s still parses and keeps every word",
    (name) => {
      const spec = PRIMITIVES.find((p) => p.name === name)!;
      const source = "@" + accept(scaffold(spec).value);
      const { html, diagnostics } = render(source, { mode: "notebook" });

      // Exactly one info, saying so. Not an error, and not silence.
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.severity).toBe("info");
      expect(diagnostics[0]!.message).toContain("no renderer yet");
      expect(html).toContain("jot-");
    },
  );

  it("says in the list that a planned block is not built", () => {
    // The worst version of this is silence: you pick @sticky, get a paragraph,
    // and cannot tell whether you wrote it wrong or it was never built.
    const items = primitiveCompletions(new Set());
    const sticky = items.find((i) => i.label === "sticky")!;
    expect(sticky.detail).toContain("not built yet");
    // And it sorts below every block that works.
    const table = items.find((i) => i.label === "table")!;
    expect(table.sortText! < sticky.sortText!).toBe(true);
  });

  it("leaves no snippet syntax behind", () => {
    // A stray `${` or `$0` in the buffer is the failure mode that looks like a
    // renderer bug and is not one.
    for (const spec of PRIMITIVES) {
      const inserted = accept(scaffold(spec).value);
      expect(inserted, `@${spec.name}`).not.toMatch(/\$\{|\$\d/);
    }
  });

  it("renders the same thing the documentation shows", () => {
    // The hint comes from the example, so the scaffold should produce a block
    // of the same kind — not a different one that merely parses.
    const timeline = accept(scaffold(PRIMITIVES.find((p) => p.name === "timeline")!).value);
    expect(timeline).toBe('timeline\n  Q3 2026: Discovery');
    expect(render("@" + timeline, { mode: "notebook" }).html).toContain('data-figure="timeline"');
  });
});
