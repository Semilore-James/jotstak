// Every surface that embeds a rendered document must show it as a page.
//
// Three separate hosts had quietly redefined the document's width to suit
// their own chrome. The playground put the preview in an `overflow: auto` box
// and squeezed the sheet to whatever the pane happened to be. The docs demos
// halved it so the source could sit beside it, which shrank a split tree to
// 57% and folded the margin channel under its anchor. The landing page folded
// the channel away too, and went on reserving 23% of the sheet for it after
// the selector doing the folding had gone stale.
//
// Each one made the thing on screen a different document from the one that
// prints — the single promise ARC-14 exists to keep — and each was caught by
// eye, weeks later, in a screenshot. So the rule is written down instead:
// a host renders a whole A4 sheet and zooms it to fit. Nothing scrolls, and
// nothing decides the document's width on its own.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The hosts that embed a rendered document, and the element each wraps it in. */
const HOSTS: Record<string, RegExp> = {
  "apps/web/src/pages/playground.astro": /#out-wrap|#out\b/,
  "apps/web/src/pages/index.astro": /\.rendered/,
  "apps/web/scripts/generate-reference.mjs": /\.jot-demo-out/,
  // The extension's live preview, and the HTML it exports. Added the day they
  // were written rather than the week after someone noticed: the three above
  // were all caught by eye, and being a new host is exactly when it is easiest
  // to invent a fifth way to size a page. The preview's markup lives in a file
  // of its own so this test reads the thing that draws the page, not a copy.
  "apps/extension/src/webview-shell.ts": /#sheet\b/,
  "apps/extension/src/export.ts": /#sheet\b/,
};

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), "utf8");

/** Rules as [selector, body], with `${…}` interpolations flattened first so
 *  their braces do not look like rule boundaries. */
function rules(source: string): Array<[string, string]> {
  const flat = source.replace(/\$\{[^}]*\}/g, "0");
  return [...flat.matchAll(/([^{}();]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
}

describe.each(Object.keys(HOSTS))("%s", (path) => {
  const source = read(path);

  it("sizes the sheet from the page geometry, not by eye", () => {
    expect(source).toMatch(/SHEET = PAGE\.portrait\.content \+ 2 \* PAGE\.marginX/);
    // Fit to the column, never magnified past 1:1.
    expect(source).toMatch(/zoom:\s*min\(1,\s*calc\(100cqw\s*\/\s*\$\{SHEET\}px\)\)/);
    // Real page margins, so the sheet is exactly A4 wide.
    expect(source).toMatch(/padding-inline:\s*\$\{PAGE\.marginX\}px/);
  });

  it("never scrolls or clips the document", () => {
    const wrapper = HOSTS[path];
    for (const [selector, body] of rules(source)) {
      if (!wrapper.test(selector) && !/\.jot-doc/.test(selector)) continue;
      // A print rule may turn containment off again; that is not a scroller.
      expect(
        body,
        `${selector} must not scroll or clip the document`,
      ).not.toMatch(/overflow(-x|-y)?:\s*(auto|scroll|hidden|clip)/);
    }
  });

  it("does not override the document's own width", () => {
    for (const [selector, body] of rules(source)) {
      if (!/\.jot-doc/.test(selector)) continue;
      expect(body, `${selector} must leave max-width to the renderer`).not.toMatch(
        /max-width:/,
      );
    }
  });
});
