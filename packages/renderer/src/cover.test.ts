// @cover — a band across the page, not a page.
//
// The decision this file is mostly about: "cover" reads like a title page, and
// it is not one. `@pagebreak` already starts a sheet and does nothing else, so
// a band plus a break IS a title page, written in two lines that each do one
// thing. Building a whole-sheet mode into @cover would have put a second way
// to start a page inside a block whose name says nothing about pages.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";
import { COVER, coverRows, readCover } from "./cover.js";
import type { CoverModel } from "./cover.js";

const src = (...lines: string[]): string => lines.join("\n");
const out = (s: string) => render(s, { mode: "notebook" });
const rowsOf = (html: string): number => Number(/--jot-cover-rows:(\d+)/.exec(html)![1]);

const model = (over: Partial<CoverModel> = {}): CoverModel => ({
  title: "Discovery phase",
  subtitle: "Weeks 1-3",
  style: "default",
  ...over,
});

describe("reading a cover", () => {
  it("takes the title from the line it is written on", () => {
    const { html, diagnostics } = out("@cover Discovery phase");
    expect(diagnostics).toEqual([]);
    expect(html).toContain('<p class="jot-cover-title">Discovery phase</p>');
  });

  it("takes the subtitle either way, because both are the same subtitle", () => {
    // The indented form is the plainer spelling and the one the examples use.
    // The parameter form exists because every other primitive's parameters
    // work that way, and a special case would be worse than a synonym.
    const indented = out(src("@cover Discovery phase", "  Weeks 1-3")).html;
    const param = out('@cover(subtitle="Weeks 1-3") Discovery phase').html;
    expect(indented).toContain('<p class="jot-cover-subtitle">Weeks 1-3</p>');
    expect(indented).toBe(param);
  });

  it("does not read an unbracketed assignment as a parameter", () => {
    // This was the schema's own documented example, and it was wrong for as
    // long as @cover had no renderer to prove it: the line below a directive
    // is body unless it is bracketed, so this put the literal text
    // `subtitle="Weeks 1-3"` on the page.
    const html = out(src("@cover Discovery phase", '  subtitle="Weeks 1-3"')).html;
    expect(html).toContain("subtitle=");
    expect(html).not.toContain('<p class="jot-cover-subtitle">Weeks 1-3</p>');
  });

  it("says so when there is no title, and says where to put one", () => {
    const { diagnostics } = out("@cover");
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.message).toContain("@cover Discovery phase");
  });

  it("falls back to default on a style it does not have, and says so once", () => {
    // Once. The schema validates every enum on every primitive, so @cover
    // adding its own message would mean two diagnostics for one mistake.
    const { html, diagnostics } = out("@cover(style=enormous) Part two");
    expect(html).toContain('data-style="default"');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe("error");
    expect(diagnostics[0]!.message).toContain("Expected one of: default, minimal, bold");
  });

  it.each([
    ["@cover(style=minimal) A", "minimal"],
    ["@cover(style=bold) A", "bold"],
    ["@cover A", "default"],
  ])("%s", (source, style) => {
    expect(readCover({ ...blockOf(source) }).style).toBe(style);
    expect(out(source).html).toContain(`data-style="${style}"`);
  });
});

/** Parse one line of source back to the block node, for readCover's own tests. */
function blockOf(source: string) {
  // Going through render() rather than the parser directly keeps this honest
  // about what actually reaches the renderer.
  const html = out(source).html;
  const style = /data-style="([a-z]+)"/.exec(html)![1]!;
  return { params: { style }, title: "A", body: { shape: "plain" as const, lines: [] } } as never;
}

describe("how much page a cover takes", () => {
  it("is a whole number of rows, whatever it holds", () => {
    for (const style of ["default", "minimal", "bold"] as const) {
      for (const subtitle of ["", "Weeks 1-3"]) {
        expect(Number.isInteger(coverRows(model({ style, subtitle })))).toBe(true);
      }
    }
  });

  it("is a row shorter with no subtitle, rather than a row of empty space", () => {
    // The contract is that every block is a whole number of rows, not that
    // every block of a kind is the same number of them.
    for (const style of ["default", "minimal", "bold"] as const) {
      expect(coverRows(model({ style, subtitle: "" }))).toBe(
        coverRows(model({ style })) - 1,
      );
    }
  });

  it("gets louder in the order the styles are named", () => {
    expect(coverRows(model({ style: "minimal" }))).toBeLessThan(coverRows(model()));
    expect(coverRows(model())).toBeLessThan(coverRows(model({ style: "bold" })));
  });

  it("hands the row count to the stylesheet, which sets height from it", () => {
    // Height, not min-height. A band that grows past its own count puts every
    // ruled line below it out of phase, which is the whole ruled-line contract
    // failing quietly.
    expect(rowsOf(out(src("@cover Discovery phase", "  Weeks 1-3")).html)).toBe(5);
    expect(rowsOf(out("@cover Discovery phase").html)).toBe(4);
    const css = renderLayoutCss();
    expect(css).toContain("height: calc(var(--jot-cover-rows) *");
    expect(css).not.toContain("min-height: calc(var(--jot-cover-rows)");
  });
});

describe("a cover on the page", () => {
  it("spans the margin channel, which is what makes it an opener", () => {
    // A heading belongs to the text column. An opener sits across the page.
    expect(out("@cover Part two").html).toContain('data-width="full"');
    expect(renderLayoutCss()).toContain(
      '.jot-body:has(> .jot-cover[data-width="full"]) { grid-column: 1 / -1; }',
    );
  });

  it("can be pinned narrower, like any other block", () => {
    expect(out("@cover(width=column) Part two").html).toContain('data-width="column"');
  });

  it("clears the ruling across its whole row, like every drawn block", () => {
    expect(renderLayoutCss()).toContain(
      '[data-mode="notebook"] .jotstak .jot-body:has(> .jot-cover) { background-image: none; }',
    );
  });

  it("draws its rules in the accent, not the ruling colour", () => {
    // --jot-rule is TRANSPARENT in doc mode. Drawing a cover's rules in it
    // would have made the whole band vanish the moment somebody switched
    // modes — and nothing would have errored.
    const css = renderLayoutCss();
    const band = /\.jot-cover\[data-style="default"\] \{[^}]*\}/.exec(css)![0];
    expect(band).toContain("var(--jot-accent)");
    expect(band).not.toContain("var(--jot-rule)");
    // And the band itself is the same markup in both modes, so nothing about
    // it is waiting on a mode-specific rule to appear.
    const cover = (mode: "notebook" | "doc") =>
      /<div class="jot-cover"[\s\S]*?<\/div>/.exec(render("@cover A", { mode }).html)![0];
    expect(cover("notebook")).toBe(cover("doc"));
  });

  it("is never left at the foot of a page with its section overleaf", () => {
    expect(renderLayoutCss()).toContain(".jot-cover { break-after: avoid;");
  });

  it("composes with @pagebreak to make a real title page", () => {
    // The reason @cover is a band and not a sheet: this already works, and it
    // is two lines that each do one thing.
    const { html, diagnostics } = out(src("@cover Part two", "  Building it", "@pagebreak"));
    expect(diagnostics).toEqual([]);
    expect(html).toContain("jot-cover");
    expect(html).toContain("jot-pagebreak");
  });
});

describe("the constants the stylesheet is built from", () => {
  it("counts rows from the same numbers the CSS pads with", () => {
    // tree.ts's comment applies here too: the row count the renderer predicts
    // and the height the browser draws cannot be allowed to come from two
    // different places.
    const css = renderLayoutCss();
    expect(css).toContain(`${COVER.airTop.default * COVER.row - 1}`);
    expect(css).toContain(`${COVER.airBottom.bold * COVER.row}`);
  });
});
