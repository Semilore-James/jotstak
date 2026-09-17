import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_FACES, renderThemeCss } from "./css.js";
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

  it("emits no @font-face without an assetBase", () => {
    expect(renderThemeCss()).not.toContain("@font-face");
  });

  it("emits one @font-face per file under assetBase/fonts, trimming trailing slashes", () => {
    const css = renderThemeCss({ assetBase: "https://example.test/assets///" });
    expect(css.match(/@font-face/g)).toHaveLength(FONT_FACES.length);
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
    expect(css).toContain("--jot-layout-max-content-width: 880px;");
    expect(css).toContain("--jot-layout-main-column-ratio: 0.77;");
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
