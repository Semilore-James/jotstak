// @matrix — a 2×2 that is a plate on the page, not a drawing that shrinks.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";
import { MATRIX, measureMatrix, readPlacement } from "./matrix.js";
import { PAGE } from "./page.js";

const src = (...lines: string[]): string => lines.join("\n");
const out = (s: string) => render(s, { mode: "notebook" });

describe("reading a placement", () => {
  it.each([
    ["Search at tr", "Search", "tr"],
    ["Search at top-right", "Search", "tr"],
    ["Dark mode at BOTTOM-LEFT", "Dark mode", "bl"],
    ["Bulk import at bl", "Bulk import", "bl"],
  ])("%s", (text, label, quadrant) => {
    expect(readPlacement(text)).toEqual({ label, quadrant });
  });

  it("keeps the whole line when the quadrant is not one", () => {
    // "at" is an ordinary word; only a real quadrant name takes it.
    expect(readPlacement("Look at pricing")).toEqual({ label: "Look at pricing", quadrant: null });
  });
});

describe("what a matrix does with what it is given", () => {
  it("places items in the four quadrants", () => {
    const { html, diagnostics } = out(
      src("@matrix x=\"Effort\" y=\"Impact\"", "  Search at tr", "  Export at tl", "  Dark mode at br", "  Animations at bl"),
    );
    expect(diagnostics).toEqual([]);
    for (const q of ["tl", "tr", "bl", "br"]) {
      expect(html).toContain(`data-q="${q}"`);
    }
    expect(html).toMatch(/data-q="tr">\s*<span class="jot-matrix-chip">Search/);
  });

  it("keeps an item that names no quadrant, and says where it put it", () => {
    const { html, diagnostics } = out(src("@matrix x=\"Effort\" y=\"Impact\"", "  Search"));
    expect(html).toContain("Search");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.message).toContain("bottom-left");
  });

  it("labels each axis towards its high end", () => {
    const { html } = out(src("@matrix x=\"Effort\" y=\"Impact\"", "  Search at tr"));
    expect(html).toMatch(/data-axis="y">Impact <span aria-hidden="true">&uarr;/);
    expect(html).toMatch(/data-axis="x">Effort <span aria-hidden="true">&rarr;/);
  });

  it("draws the cross alone by default and adds a frame on request", () => {
    expect(out(src("@matrix x=\"E\" y=\"I\"", "  A at tr")).html).toContain('data-style="axes"');
    expect(out(src("@matrix(x=\"E\" y=\"I\" style=boxed)", "  A at tr")).html).toContain('data-style="boxed"');
  });
});

describe("how much page a matrix takes", () => {
  const model = {
    items: { tl: ["Export"], tr: ["Search"], bl: ["Animations"], br: ["Dark mode"] },
    x: "Effort",
    y: "Impact",
    title: "",
  };

  it("spans the printable width, margin to margin", () => {
    // Not the text column: a matrix is a plate, and stopping short of the
    // margin channel made it look dropped onto the page rather than drawn on it.
    expect(measureMatrix(model).w).toBe(PAGE.portrait.content);
    expect(out(src("@matrix x=\"E\" y=\"I\"", "  A at tr")).html).toContain('data-width="full"');
  });

  it("takes exactly the room it is given, with no rounding over the edge", () => {
    // 681.7 rounded up to 682 would be a third of a pixel over its own page,
    // which reported a scale on a figure that fits.
    const { diagnostics } = out(src("@matrix(x=\"E\" y=\"I\" width=full)", "  A at tr"));
    expect(diagnostics).toEqual([]);
  });

  it("is a whole number of rows tall", () => {
    for (const title of ["", "Q4"]) {
      const h = measureMatrix({ ...model, title }).h;
      expect(h % MATRIX.row).toBe(0);
    }
  });

  it("grows down the page rather than letting a quadrant squeeze its chips", () => {
    const packed = measureMatrix({
      ...model,
      items: { ...model.items, tr: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"] },
    });
    expect(packed.h).toBeGreaterThan(measureMatrix(model).h);
    expect(packed.h % MATRIX.row).toBe(0);
  });

  it("widens past the page only when a label genuinely needs it", () => {
    const long = measureMatrix({
      ...model,
      items: { ...model.items, tl: ["A label so long that one quadrant alone is wider than a sheet of A4 could ever be"] },
    });
    expect(long.w).toBeGreaterThan(PAGE.portrait.content);
  });
});

describe("a matrix on ruled paper", () => {
  it("clears the ruling from the whole block, not just under itself", () => {
    // Painting the figure's own background over the rules left them running
    // down either side of it, which made a diagram look dropped onto a ruled
    // sheet rather than drawn on one.
    expect(renderLayoutCss()).toContain(
      '[data-mode="notebook"] .jot-body:has(> .jot-figure) { background-image: none; }',
    );
    expect(out(src("@matrix x=\"E\" y=\"I\"", "  A at tr")).html).toContain('data-primitive="matrix"');
  });

  it("says nothing when everything fits", () => {
    expect(out(src("@matrix x=\"Effort\" y=\"Impact\"", "  Search at tr", "  Export at tl")).diagnostics).toEqual([]);
  });
});
