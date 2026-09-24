// A figure's own type must out-rank the prose rules it sits inside.
//
// This is a whole class of bug and it has now been found three times. The
// document sets prose type with `.jotstak .jot-body p` — two classes and an
// element, specificity (0,2,1). A figure that styles its own label with
// `.jotstak .jot-matrix-axis` is (0,2,0), which LOSES, silently: the rule
// applies everything except the declarations prose also sets, so the label
// keeps its colour and its letter-spacing and quietly renders at 16px instead
// of 12px. Nothing errors, the height is close enough that most layouts still
// look plausible, and it survives review because the stylesheet says 12px.
//
// @tree hit it first (`.jot-body li` kept 16px text inside shrunken columns
// and ran 69px past the frame). @matrix and @table shipped with it. So it is
// checked rather than remembered: any figure rule that sets a property the
// prose rules also set has to carry a second class.

import { describe, expect, it } from "vitest";
import { renderLayoutCss } from "./index.js";

/** Properties the generic prose rules claim, at (0,2,1). */
const CONTESTED = ["font-size", "line-height", "margin"];

interface Rule {
  selectors: string[];
  body: string;
}

function rules(css: string): Rule[] {
  // Strip comments and at-rule wrappers; the declarations inside a media query
  // are still ordinary rules for this purpose.
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*\{/g, "");
  const out: Rule[] = [];
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const head = m[1]!.trim();
    if (!head || head.startsWith("@")) continue;
    out.push({ selectors: head.split(",").map((s) => s.trim()), body: m[2]! });
  }
  return out;
}

/** Classes in a selector, minus the leading `.jotstak` scope. */
function classCount(selector: string): number {
  const classes = selector.match(/\.[A-Za-z][\w-]*/g) ?? [];
  return classes.filter((c) => c !== ".jotstak").length;
}

describe("figure type out-ranks prose type", () => {
  const css = renderLayoutCss();

  // Every class a figure gives to an element that is a <p>, <li> or <blockquote>
  // in the markup — the ones the prose rules can reach.
  const PROSE_SHAPED = [
    "jot-matrix-title",
    "jot-matrix-axis",
    "jot-table-caption",
    "jot-timeline-title",
    "jot-timeline-date",
    "jot-timeline-label",
    "jot-timeline-detail",
  ];

  it.each(PROSE_SHAPED)("%s is never set at prose specificity", (cls) => {
    const owned = rules(css).filter(
      (r) =>
        r.selectors.some((s) => s.includes(`.${cls}`)) &&
        CONTESTED.some((p) => new RegExp(`(^|;|\\s)${p}\\s*:`).test(r.body)),
    );
    expect(owned.length).toBeGreaterThan(0);
    for (const rule of owned) {
      for (const selector of rule.selectors) {
        if (!selector.includes(`.${cls}`)) continue;
        // Two classes after the scope beats `.jotstak .jot-body p`.
        expect(
          classCount(selector),
          `"${selector}" sets type at prose specificity, so .jot-body p wins`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("knows what it is competing with", () => {
    // If the prose rule ever changes shape, this test's premise changes with
    // it, and the count above has to be revisited rather than quietly passing.
    const prose = rules(css).find((r) => r.selectors.includes(".jotstak .jot-body p"));
    expect(prose, "the prose rule this test is calibrated against has moved").toBeDefined();
    expect(classCount(".jotstak .jot-body p")).toBe(1);
    expect(prose!.body).toMatch(/font-size:/);
  });
});

// ── Bold has to have somewhere to go ─────────────────────────────────────
//
// The sibling of the cascade bug above, and it shipped for the same reason:
// the markup was right, the stylesheet was right, and the glyphs were
// identical. The document uses 600 for emphasis-by-role — a heading, a tree
// pill, a timeline event, a table header, a margin note in handwriting. With
// `strong` also at 600, writing **bold** in any of those changed nothing.
//
// Bold means "one step heavier than whatever this is". That only works if a
// step above 600 exists IN THE FAMILY the text is set in, which is why this
// checks every family the document uses, not just the body face.

describe("bold is heavier than the weight it lands on", () => {
  const css = renderLayoutCss();

  it("sets strong above the 600 used for emphasis-by-role", () => {
    const rule = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .find((r) => r.includes(".jot-body strong"));
    const weight = Number(/font-weight:\s*(\d+)/.exec(rule ?? "")?.[1]);
    expect(weight).toBeGreaterThan(600);
  });

  it("ships that weight in every family the document sets text in", async () => {
    const { FONT_FACES, renderThemeCss } = await import("./css.js");
    const theme = renderThemeCss({ assetBase: "" });

    // The families actually reachable by prose. Mono is excluded: `**bold**`
    // inside a code span is literal text, not emphasis.
    const families = [...theme.matchAll(/--jot-font-(?!mono)[a-z]+:\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(families.length).toBeGreaterThan(0);

    for (const family of new Set(families)) {
      const weights = FONT_FACES.filter((f) => f.family === family && f.style === "normal").map(
        (f) => f.weight,
      );
      expect(weights, `${family} has no face for text to be set in`).not.toHaveLength(0);
      expect(
        Math.max(...weights),
        `**bold** in ${family} falls back to ${Math.max(...weights)}, which is a weight the document already uses`,
      ).toBeGreaterThanOrEqual(700);
    }
  });
});
