import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_FACES, renderThemeCss } from "./css.js";
import { BASELINE_OFFSET, baselineShift, renderLayoutCss } from "./layout.js";
import { FONT_METRICS } from "./font-metrics.js";
import { colors } from "./tokens.js";

const require = createRequire(import.meta.url);

describe("fonts", () => {
  it("every declared font file exists in the installed Fontsource package", () => {
    for (const f of FONT_FACES) {
      const [scope, name] = f.source.split("/");
      const pkgDir = dirname(require.resolve(`${scope}/${name}/package.json`));
      const file = join(pkgDir, f.source.split("/").slice(2).join("/"));
      expect(existsSync(file), f.source).toBe(true);
    }
  });

  it("emits no webfont @font-face without an assetBase", () => {
    const css = renderThemeCss();
    // The metric-matched fallback always ships — it is what prevents a baseline
    // jump, and a host serving no fonts is exactly when it carries the page.
    expect(css.match(/@font-face/g)).toHaveLength(1);
    expect(css).toContain('font-family: "Lora Fallback"');
    expect(css).not.toContain("url(");
  });

  it("emits one @font-face per file under assetBase/fonts, trimming trailing slashes", () => {
    const css = renderThemeCss({ assetBase: "https://example.test/assets///" });
    // +1 for the fallback face.
    expect(css.match(/@font-face/g)).toHaveLength(FONT_FACES.length + 1);
    for (const f of FONT_FACES) {
      expect(css).toContain(`url("https://example.test/assets/fonts/${f.file}")`);
    }
  });
});

describe("scoping", () => {
  it("never styles the host page", () => {
    const css = renderThemeCss({ assetBase: "/a" });
    expect(css).not.toMatch(/(^|\n)\s*(:root|html|body)\b/);
    const selectors = [...css.matchAll(/(^|\n)([^\s@}][^{]*)\{/g)].map((m) => m[2]!.trim());
    expect(selectors.length).toBeGreaterThan(0);
    for (const s of selectors) expect(s.startsWith(".jotstak")).toBe(true);
  });

  it("honours a custom scope", () => {
    const css = renderThemeCss({ scope: ".preview" });
    expect(css).toContain(".preview {");
    expect(css).not.toContain(".jotstak");
  });
});

describe("tokens", () => {
  it("exposes every color token as a CSS variable", () => {
    const css = renderThemeCss();
    const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    for (const [group, values] of Object.entries(colors)) {
      for (const [key, value] of Object.entries(values)) {
        expect(css).toContain(`--jot-color-${kebab(group)}-${kebab(key)}: ${value};`);
      }
    }
  });

  it("gives px units to sizes but keeps ratios unitless", () => {
    const css = renderThemeCss();
    expect(css).toContain("--jot-space-baseline-grid: 28px;");
    expect(css).toContain("--jot-layout-max-content-width: 681.7px;");
    expect(css).toContain("--jot-layout-main-column-ratio: 0.77;");
  });

  it("never spends a unitless ratio token as a grid track", () => {
    // The ratio tokens are correctly unitless, which makes them unusable as
    // track sizes: grid-template-columns: var(--...-ratio) var(--...-ratio)
    // expanded to "0.77 0.23", which is invalid, so browsers dropped the whole
    // declaration and auto-sized the two columns at roughly 50/50. The result
    // looked plausible enough that nothing caught it — the margin channel was
    // simply always about twice the width it was designed to be.
    const css = renderLayoutCss();
    const rowGrid = css.match(/\.jot-row \{[\s\S]*?\}/)?.[0] ?? "";
    const tracks = rowGrid.match(/grid-template-columns:([\s\S]*?);/)?.[1] ?? "";

    expect(tracks).not.toBe("");
    expect(tracks).not.toMatch(/var\(--jot-layout-[a-z-]*ratio/);
    // Both tracks carry a real unit, and both can shrink below min-content so a
    // wide diagram cannot force the column and displace the margin channel.
    expect(tracks).toMatch(/minmax\(0, 0\.77fr\)/);
    expect(tracks).toMatch(/minmax\(0, 0\.23fr\)/);
  });

  it("re-points semantic aliases per mode", () => {
    const css = renderThemeCss();
    expect(css).toMatch(/\[data-mode="notebook"\] \{[^}]*--jot-surface: var\(--jot-color-notebook-paper\);/);
    expect(css).toMatch(/\[data-mode="doc"\] \{[^}]*--jot-surface: var\(--jot-color-doc-sheet\);/);
  });

  it("matches the reviewed snapshot", () => {
    expect(renderThemeCss({ assetBase: "/assets" })).toMatchSnapshot();
  });
});

describe("headings sit on the ruling", () => {
  const css = renderLayoutCss();
  const rule = (cls: string) => {
    // The first `.jot-hN` rule is the shared one (family, colour, space above);
    // the one that sizes the heading is the next. Take the one with a size.
    const m = [...css.matchAll(new RegExp(`\\.${cls}[ ,][^{}]*\\{([^}]*)\\}`, "g"))].find((r) =>
      r[1].includes("font-size"),
    );
    if (!m) throw new Error(`no sizing rule for .${cls}`);
    const num = (prop: string) => {
      const d = new RegExp(`${prop}:\\s*([\\d.]+)px`).exec(m[1]);
      return d ? parseFloat(d[1]) : 0;
    };
    return { size: num("font-size"), line: num("line-height"), pad: num("padding-top"), below: num("margin-bottom") };
  };

  /** Distance to the nearest whole row, either side — so 27.9999 reads as 0. */
  const offGrid = (px: number) => {
    const rem = ((px % 28) + 28) % 28;
    return Math.min(rem, 28 - rem);
  };

  // Every heading, by the arithmetic the renderer itself uses.
  it.each(["jot-h1", "jot-h2", "jot-h3"])("%s puts its first baseline on a rule", (cls) => {
    const { size, line, pad } = rule(cls);
    const half = (line - size * (FONT_METRICS.lora.ascent + FONT_METRICS.lora.descent + FONT_METRICS.lora.lineGap)) / 2;
    const baseline = pad + half + size * FONT_METRICS.lora.ascent;
    // On a rule means: a whole number of rows below the body baseline.
    expect(offGrid(baseline - BASELINE_OFFSET)).toBeCloseTo(0, 3);
  });

  it.each(["jot-h1", "jot-h2", "jot-h3"])("%s still occupies whole rows", (cls) => {
    const { line, pad, below } = rule(cls);
    // margin-top (one row) + padding + line box + margin-bottom.
    expect(offGrid(28 + pad + line + below)).toBeCloseTo(0, 3);
  });

  it("a heading that needed no shift keeps a full row beneath it", () => {
    expect(baselineShift(16, 28)).toBeCloseTo(0, 3);
  });
});
