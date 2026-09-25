import { describe, expect, it } from "vitest";
import { LANDSCAPE_PAGE, PAGE, renderPageCss } from "./page.js";
import { renderLayoutCss } from "./layout.js";
import { notebookLayout } from "./tokens.js";
import { render } from "./index.js";

const ROW = 28;
const MM = 96 / 25.4;

describe("the page (ARC-14: print-true A4, continuous screen)", () => {
  it("is A4: 210mm of width less two 56px margins, in either orientation", () => {
    expect(PAGE.portrait.content).toBeCloseTo(210 * MM - 112, 1);
    expect(PAGE.landscape.content).toBeCloseTo(297 * MM - 112, 1);
  });

  it("makes every printed page a whole number of rows, so the ruling survives page breaks", () => {
    // Without this the 2.5px left over on an A4 page shifts the ruling a
    // little further out of phase on every page of a printed document.
    for (const [o, paperHeight] of [["portrait", 297 * MM], ["landscape", 210 * MM]] as const) {
      const g = PAGE[o];
      expect(g.rows * ROW + 2 * g.marginY, o).toBeCloseTo(paperHeight, 1);
      expect(Number.isInteger(g.rows), o).toBe(true);
    }
    expect(PAGE.portrait.rows).toBe(36);
    expect(PAGE.landscape.rows).toBe(24);
  });

  it("keeps the frame token in step with the page", () => {
    expect(notebookLayout.maxContentWidth).toBe(PAGE.portrait.content);
  });

  it("sizes the screen frame to the printable width, so what fits on screen fits on paper", () => {
    const css = renderLayoutCss();
    const frame = css.match(/\.jot-doc \{[\s\S]*?\}/)?.[0] ?? "";
    expect(frame).toContain(`max-width: ${PAGE.portrait.content}px`);
  });

  it("declares A4 pages, and a named landscape page for figures that need one", () => {
    const css = renderPageCss();
    expect(css).toContain(`@page { size: A4 portrait; margin: ${PAGE.portrait.marginY}px 56px; }`);
    expect(css).toContain(`@page ${LANDSCAPE_PAGE} { size: A4 landscape; margin: ${PAGE.landscape.marginY}px 56px; }`);
  });

  it("prints blocks whole, never ends a page on a heading, and turns wide figures landscape", () => {
    const print = renderLayoutCss().split("@media print")[1] ?? "";
    expect(print).toMatch(/\.jot-row:has\(> \.jot-body\[data-kind="block"\]\) \{ break-inside: avoid; \}/);
    expect(print).toMatch(/\.jot-row:has\(> \.jot-body\[data-kind="heading"\]\) \{ break-after: avoid; \}/);
    expect(print).toContain(`page: ${LANDSCAPE_PAGE};`);
    expect(print).toContain("print-color-adjust: exact");
  });

  it("wraps each block and its notes in a row, because only a block in normal flow can take a named page", () => {
    const { html } = render("# Title\n\nSome prose.\n\n>> a note", { mode: "notebook" });
    const doc = /<div class="jot-doc">(.*)<\/div><\/div>$/s.exec(html)?.[1] ?? "";
    expect(doc.startsWith('<div class="jot-row">')).toBe(true);
    // Nothing sits directly in the frame except rows.
    expect(doc.replace(/<div class="jot-row">.*?<\/div><\/div>/gs, "")).toBe("");
    expect(html).toMatch(/<div class="jot-row"><div class="jot-body"[^>]*>.*?<\/div><div class="jot-aside">.*?a note.*?<\/div><\/div>/s);
  });
});

describe("the margin channel folds on the page's width, not the window's", () => {
  const css = renderLayoutCss();

  it("asks how wide the page is, because every host zooms a whole sheet to fit", () => {
    // UX-36: on a phone the sheet is still the full printable width inside —
    // it is only drawn smaller. A viewport query fired anyway and folded the
    // channel of a document that had plenty of room for it, leaving notes
    // stacked under their anchors inside an already-scaled sheet.
    expect(css).toMatch(/@container jot-page \(max-width: \d+px\)/);
    expect(css).not.toContain("@media (max-width:");
  });

  it("declares the container it queries", () => {
    // A container query against a container that does not exist is not an
    // error — it simply never matches, which would silently drop the fold.
    const doc = css.split("}").find((r) => r.includes(".jot-doc {"))!;
    expect(doc).toContain("container-type: inline-size");
    expect(doc).toContain("container-name: jot-page");
  });

  it("folds below the width where the channel stops holding a note", () => {
    const at = Number(/@container jot-page \(max-width: (\d+)px\)/.exec(css)![1]);
    // Narrower than a whole page, or it would fold at full size.
    expect(at).toBeLessThan(PAGE.portrait.content);
    // And wide enough that the channel is genuinely unusable by then: a
    // couple of words of handwriting, not a readable aside.
    expect((at - 28) * notebookLayout.marginChannelRatio).toBeLessThan(120);
  });
});
