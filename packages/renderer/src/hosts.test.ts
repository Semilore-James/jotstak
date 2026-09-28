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
import { renderLayoutCss } from "./index.js";
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

  it("takes the fit from the renderer rather than deriving its own", () => {
    // The expression used to be written out in all five hosts, which is how
    // three of them came to disagree about it. It lives in layout.ts now, as
    // --jot-fit, and a host says only where to apply it. That also means the
    // reflow below REFLOW_BELOW reaches every host at once instead of five
    // times — a phone fitting an A4 sheet at 0.40 put body text at 6.4px.
    expect(source).toMatch(/zoom:\s*var\(--jot-fit\)/);
    // …over a wrapper the container query can find.
    expect(source).toMatch(/container-type:\s*inline-size;\s*container-name:\s*jot-host/);
    // And no host may go back to computing it.
    expect(source, "this host derives its own zoom again").not.toMatch(/zoom:\s*min\(/);

    // The zoom must sit on the .jotstak element ITSELF. --jot-fit is declared
    // there by the renderer, and a custom property inherits downwards only —
    // zoom a wrapper around it and the reflow sets the variable on a child
    // nothing reads it from. The playground did exactly that: the document
    // took `max-width: 100%` of a parent still scaled to 0.40 and came out
    // the same 6.4px it had been.
    const zoomed = /([^{};\n]*)\{[^{}]*zoom:\s*var\(--jot-fit\)/.exec(source)?.[1] ?? "";
    expect(zoomed.trim(), `${path} zooms a wrapper, not .jotstak`).toMatch(/\.jotstak\s*$/);
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

// ── The host's defaults stop at the paper ────────────────────────────────
//
// The mirror of the rule above. Those tests stop a host deciding how wide the
// document is; this one stops a host deciding what it looks like.
//
// VS Code injects an element stylesheet into every webview — blockquote, table
// and link rules in the editor's own colours. A quote rendered as a dark grey
// box on cream paper because of it, and nothing was wrong with the markup or
// with any rule we had written: the gap was the rule we had NOT written. Our
// quote rule set a border and a colour and never a background, so the host's
// background won by default.
describe("a host cannot restyle the document", () => {
  const css = renderLayoutCss();

  /** Elements a host is likely to have an opinion about. */
  const CLAIMED = ["blockquote", "table", "kbd", "code", "pre"];

  it.each(CLAIMED)("%s has a background of our own", (element) => {
    const owns = rules(css).some(
      ([selector, body]) =>
        new RegExp(`\\b${element}\\b`).test(selector) && /background(-color)?:/.test(body),
    );
    expect(owns, `nothing declares a background for ${element}, so the host's wins`).toBe(true);
  });

  it("covers the quote by its class as well as its element", () => {
    // @quote renders a <blockquote class="jot-quote">, and a host rule for the
    // bare element reaches it either way.
    const quote = rules(css).filter(([s]) => /\.jot-quote\b/.test(s));
    expect(quote.some(([, body]) => /background:/.test(body))).toBe(true);
  });
});
