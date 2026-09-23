// M0 step 6 — the two promises that close the milestone.
//
//   1. .jot is a superset of Markdown: a real .md file renders unchanged, with
//      nothing dropped and no diagnostics. Tested against files actually in this
//      repo rather than fixtures written to pass.
//   2. The baseline is derived from font metrics, not guessed, and stays derived.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as fontkit from "fontkit";
import { createRequire } from "node:module";
import { render, renderThemeCss, BASELINE_OFFSET } from "./index.js";
import { FONT_METRICS } from "./font-metrics.js";
import { spacing, typography } from "./tokens.js";

const require = createRequire(import.meta.url);
const REPO = join(import.meta.dirname, "..", "..", "..");
const ROW = spacing.baselineGrid;

/** Remove fenced regions so source counts ignore code content. */
function stripFences(src: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of src.split(/\r?\n/)) {
    const m = /^(`{3,}|~{3,})\s*(.*)$/.exec(line);
    if (fence !== null) {
      if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length && (m[2] ?? "").trim() === "") fence = null;
      continue;
    }
    if (m) { fence = m[1]!; continue; }
    out.push(line);
  }
  return out.join("\n");
}

/** Real Markdown files from this repository — not fixtures written to pass. */
const REAL_MARKDOWN = ["README.md", "CONTRIBUTING.md", "CHANGELOG.md"];

describe("superset — real Markdown files render unchanged", () => {
  for (const name of REAL_MARKDOWN) {
    it(`${name} renders with zero diagnostics`, () => {
      const src = readFileSync(join(REPO, name), "utf8");
      const { html, diagnostics } = render(src, { mode: "notebook" });
      expect(diagnostics).toEqual([]);
      expect(html.length).toBeGreaterThan(src.length / 2);
    });

    it(`${name} renders every heading and every list item`, () => {
      const src = readFileSync(join(REPO, name), "utf8");
      const { html } = render(src, { mode: "notebook" });

      // Count rather than match text: counts catch content being dropped or
      // invented, without being brittle about punctuation and inline markup.
      // Headings inside fenced code must NOT count — that was a real bug.
      const outsideFences = stripFences(src);
      const srcHeadings = (outsideFences.match(/^#{1,3} +\S/gm) ?? []).length;
      const outHeadings = (html.match(/<h[123] class="jot-h[123]"/g) ?? []).length;
      expect(outHeadings).toBe(srcHeadings);

      // Both bullets and numbered items render as <li>.
      const srcBullets = (outsideFences.match(/^ *(?:[-*]|\d+\.) +\S/gm) ?? []).length;
      const outBullets = (html.match(/<li>/g) ?? []).length;
      expect(outBullets).toBe(srcBullets);
    });

    it(`${name} preserves fenced code blocks verbatim`, () => {
      const src = readFileSync(join(REPO, name), "utf8");
      const fences = (src.match(/^```/gm) ?? []).length;
      if (fences === 0) return;
      const { html } = render(src, { mode: "notebook" });
      expect((html.match(/<pre>/g) ?? []).length).toBe(fences / 2);
    });
  }

  it("renders a document that uses no .jot syntax at all", () => {
    const src = readFileSync(join(REPO, "README.md"), "utf8");
    expect(src).not.toMatch(/^@[a-z_]+/m);
    expect(src).not.toMatch(/^>> /m);
    const { diagnostics } = render(src, { mode: "notebook" });
    expect(diagnostics).toEqual([]);
  });

  it("renders the same Markdown identically in both modes", () => {
    const src = readFileSync(join(REPO, "CONTRIBUTING.md"), "utf8");
    const nb = render(src, { mode: "notebook" }).html.replace('data-mode="notebook"', "M");
    const doc = render(src, { mode: "doc" }).html.replace('data-mode="doc"', "M");
    expect(nb).toBe(doc);
  });
});

describe("superset — Markdown constructs survive", () => {
  const cases: [string, string, RegExp][] = [
    ["bold", "**bold**", /<strong>bold<\/strong>/],
    ["italic", "*slanted*", /<em>slanted<\/em>/],
    ["inline code", "`code`", /<code>code<\/code>/],
    ["link", "[text](https://example.com)", /href="https:\/\/example\.com"/],
    ["autolink", "See https://example.com now", /href="https:\/\/example\.com"/],
    ["nested list", "- a\n  - b", /<ul>[\s\S]*<ul>/],
    ["ordered list", "1. one\n2. two", /<ol>/],
    ["blockquote", "> quoted", /jot-quote/],
    // `>>` is a quote inside a quote. Jotstak used to read it as its own
    // margin-note shorthand, so any .md file that quoted a quote lost the
    // inner one to the margin. A superset does not get to redefine Markdown
    // it happens to find convenient — margin notes are written @note.
    ["nested blockquote", "> outer\n>> inner", /<blockquote[\s\S]*<blockquote/],
    ["thematic break", "---", /jot-divider/],
    ["h1/h2/h3", "# a\n\n## b\n\n### c", /jot-h3/],
  ];
  for (const [label, src, expected] of cases) {
    it(`preserves ${label}`, () => {
      const { html, diagnostics } = render(src, { mode: "notebook" });
      expect(diagnostics).toEqual([]);
      expect(html).toMatch(expected);
    });
  }
});

describe("baseline — derived from the font, and staying derived", () => {
  it("matches the metrics of the woff2 actually shipped", () => {
    const file = require.resolve("@fontsource/lora/files/lora-latin-400-normal.woff2");
    const font = fontkit.openSync(file) as unknown as {
      unitsPerEm: number; ascent: number; descent: number; lineGap: number;
    };
    const upm = font.unitsPerEm;
    // If Fontsource ships a Lora whose metrics changed, this fails rather than
    // silently moving every baseline off its rule.
    expect(FONT_METRICS.lora.unitsPerEm).toBe(upm);
    expect(FONT_METRICS.lora.ascent).toBeCloseTo(font.ascent / upm, 4);
    expect(FONT_METRICS.lora.descent).toBeCloseTo(Math.abs(font.descent) / upm, 4);
    expect(FONT_METRICS.lora.lineGap).toBeCloseTo(font.lineGap / upm, 4);
  });

  it("computes the offset from those metrics, not a constant", () => {
    const px = parseFloat(typography.body.lg.size);
    const m = FONT_METRICS.lora;
    const halfLeading = (ROW - px * (m.ascent + m.descent + m.lineGap)) / 2;
    expect(BASELINE_OFFSET).toBeCloseTo(halfLeading + px * m.ascent, 3);
  });

  it("leaves room for descenders below the rule", () => {
    const px = parseFloat(typography.body.lg.size);
    const descenderDepth = px * FONT_METRICS.lora.descent;
    // Descenders dip below the rule (that is the handwriting look) but must not
    // collide with the next rule down.
    expect(BASELINE_OFFSET + descenderDepth).toBeLessThan(ROW);
  });
});

describe("font loading — the fallback must not move the baseline", () => {
  const css = renderThemeCss();

  it("declares a metric-matched fallback face", () => {
    expect(css).toContain('font-family: "Lora Fallback"');
    expect(css).toContain("ascent-override:");
    expect(css).toContain("descent-override:");
    expect(css).toContain("size-adjust:");
  });

  it("overrides with Lora's real metrics", () => {
    const face = /@font-face \{[^}]*Lora Fallback[^}]*\}/.exec(css)![0];
    expect(face).toContain(`ascent-override: ${(FONT_METRICS.lora.ascent * 100).toFixed(2)}%`);
    expect(face).toContain(`descent-override: ${(FONT_METRICS.lora.descent * 100).toFixed(2)}%`);
  });

  it("puts the fallback ahead of the generic serif in the stack", () => {
    const stack = /--jot-font-body: ([^;]+);/.exec(css)![1]!;
    expect(stack.indexOf("Lora Fallback")).toBeGreaterThan(stack.indexOf('"Lora"'));
    expect(stack.indexOf("Lora Fallback")).toBeLessThan(stack.indexOf("Georgia"));
  });

  it("ships the fallback even when no webfonts are served", () => {
    // A host that provides no assetBase gets no @font-face for Lora itself, but
    // must still get the fallback — that is exactly when it matters most.
    expect(renderThemeCss()).toContain("Lora Fallback");
    expect(renderThemeCss()).not.toContain("lora-latin-400-normal.woff2");
  });
});

describe("integration — the website actually consumes the design system", () => {
  // This suite exists because of a real bug: renderThemeCss and renderLayoutCss
  // were fully built, tested and snapshot-reviewed, and no page ever called them.
  // The site shipped in browser-default serif for days. Unit tests on a generator
  // prove it generates; they say nothing about whether anyone uses the output.
  const layout = readFileSync(join(REPO, "apps", "web", "src", "layouts", "Base.astro"), "utf8");

  it("imports both CSS generators", () => {
    expect(layout).toMatch(/import \{[^}]*renderThemeCss[^}]*\} from "@jotstak\/renderer"/);
    expect(layout).toContain("renderLayoutCss");
  });

  it("injects them into the document head", () => {
    expect(layout).toMatch(/<style[^>]*set:html=\{themeCss\}/);
    expect(layout).toMatch(/<style[^>]*set:html=\{layoutCss\}/);
  });

  it("passes an assetBase so @font-face rules are emitted at all", () => {
    // Without assetBase the generator emits no webfont faces and the page falls
    // back to system serif — which is exactly how it looked when this broke.
    expect(layout).toMatch(/renderThemeCss\(\{\s*assetBase:/);
  });

  it("serves every font file the CSS references", async () => {
    const { FONT_FACES } = await import("./css.js");
    for (const face of FONT_FACES) {
      const served = join(REPO, "apps", "web", "public", "fonts", face.file);
      expect(existsSync(served), `missing public/fonts/${face.file}`).toBe(true);
    }
  });

  it("ships the OFL licence text alongside the bundled fonts", () => {
    expect(existsSync(join(REPO, "apps", "web", "public", "fonts", "LICENSES.txt"))).toBe(true);
  });
});
