// @matrix — the 2×2 every prioritisation argument ends up drawing.
//
// Two axes, four quadrants, items placed in one of them. The layout choices
// worth stating, because they are the ones a reader notices:
//
//   No rotated text. A vertical y-axis label is the convention in charting
//   tools and it fights everything here: it cannot sit on a rule, it cannot be
//   measured with the rest of the type, and on paper it makes the reader turn
//   the page. The axes are labelled the way you would label them by hand —
//   "Impact ↑" above the plot on the left, "Effort →" under it on the right —
//   which also says which end is high without a legend.
//
//   The quadrants are equal. A quadrant sized to its contents would make the
//   busiest one the biggest, which reads as importance and is exactly the
//   wrong signal: a matrix is about position, not volume.
//
//   Items are chips, not bullets. Inside a bordered quadrant a bullet list
//   reads as a list that happens to be in a box; a chip reads as a thing that
//   has been placed somewhere on purpose.

import { ESTIMATE_SAFETY, measureText } from "./measure.js";
import { figureAttrs, placeFigure, ROW, wholeRows } from "./figure.js";
import { PAGE } from "./page.js";
import type { Placement, Size } from "./figure.js";
import type { BlockNode, TreeNode } from "./ast.js";
import type { Diagnostic } from "./index.js";

/** Every length the renderer and the stylesheet both need. */
export const MATRIX = {
  row: ROW,
  /** Chip type, matching a tree's boxed node so figures share one voice. */
  chipSize: 14,
  chipHeight: 24,
  chipPadX: 10,
  chipGap: 4,
  /** Padding inside a quadrant, around its chips. */
  cellPad: 10,
  /** Smallest a quadrant may be: enough to read as a region, not a cell. */
  minCellW: 120,
  minCellRows: 3,
  /** Axis labels, above and below the plot. */
  axisSize: 12,
  axisRows: 1,
  titleSize: 12,
  /** Plot height as a fraction of its width, before content pushes it taller. */
  plotRatio: 0.6,
} as const;

export type Quadrant = "tl" | "tr" | "bl" | "br";

const QUADRANTS: Record<string, Quadrant> = {
  tl: "tl", tr: "tr", bl: "bl", br: "br",
  "top-left": "tl", "top-right": "tr", "bottom-left": "bl", "bottom-right": "br",
};

export interface MatrixItem {
  label: string;
  quadrant: Quadrant;
}

export interface MatrixModel {
  items: Record<Quadrant, string[]>;
  x: string;
  y: string;
  title: string;
}

/** `Search at top-right` → the label and where it goes. */
export function readPlacement(text: string): { label: string; quadrant: Quadrant | null } {
  const m = /^(.*?)\s+at\s+([a-z-]+)\s*$/i.exec(text.trim());
  if (!m) return { label: text.trim(), quadrant: null };
  const q = QUADRANTS[m[2]!.toLowerCase()];
  return q ? { label: m[1]!.trim(), quadrant: q } : { label: text.trim(), quadrant: null };
}

export function buildMatrix(n: BlockNode, diagnostics: Diagnostic[]): MatrixModel {
  const roots = n.body.shape === "indented" ? n.body.roots : [];
  const items: Record<Quadrant, string[]> = { tl: [], tr: [], bl: [], br: [] };

  for (const root of roots) {
    const { label, quadrant } = readPlacement(root.text);
    if (quadrant === null) {
      // Nothing is dropped: it goes low/low and says so, because an item whose
      // position was never stated has no honest position.
      diagnostics.push({
        severity: "warning",
        message: `"${label}" has no quadrant, so it sits bottom-left. Add e.g. \`${label} at top-right\` — quadrants are top-left, top-right, bottom-left, bottom-right, or tl/tr/bl/br.`,
        line: root.position.line,
        column: root.position.column,
      });
      items.bl.push(label);
    } else {
      items[quadrant].push(label);
    }
    if (root.children.length > 0) {
      diagnostics.push({
        severity: "warning",
        message: `Detail under "${label}" is not drawn: a matrix shows where things sit, not what they are. Put the detail in the prose around it.`,
        line: root.children[0]!.position.line,
        column: root.children[0]!.position.column,
      });
    }
  }

  return {
    items,
    x: n.params.x ?? "",
    y: n.params.y ?? "",
    title: n.params.title ?? n.title ?? "",
  };
}

/** Width of one chip at full size. */
function chipWidth(label: string): number {
  return measureText(label, "lora-400", MATRIX.chipSize) * ESTIMATE_SAFETY + MATRIX.chipPadX * 2;
}

export function measureMatrix(m: MatrixModel, pinned = "auto"): Size {
  const all = Object.values(m.items).flat();
  const widest = all.length ? Math.max(...all.map(chipWidth)) : 0;
  const needed = (Math.max(MATRIX.minCellW, widest + MATRIX.cellPad * 2)) * 2;

  // A matrix is a plate, not a drawing that shrinks to its contents. Five short
  // labels in a 240px box read as a stamp on the page, and two matrices of
  // different sizes in one document read as two different kinds of thing.
  //
  // So it spans the whole printable width by default — margin to margin,
  // through the margin channel — rather than stopping at the text column. It
  // only grows past that when a label genuinely needs the width.
  const room =
    pinned === "landscape"
      ? PAGE.landscape.content
      : pinned === "column" || pinned === "wide"
        ? PAGE.portrait.column
        : PAGE.portrait.content;
  // Exactly the room when the content fits — rounding 681.7 up to 682 would
  // put the figure a third of a pixel over its own page and report a scale.
  const w = needed > room ? Math.round(needed) : room;

  const rowsFor = (labels: string[]): number =>
    Math.max(
      MATRIX.minCellRows,
      Math.ceil((labels.length * (MATRIX.chipHeight + MATRIX.chipGap) - MATRIX.chipGap + MATRIX.cellPad * 2) / ROW),
    );
  // Both rows of the grid take the taller of their two quadrants: equal
  // quadrants are the point (see the note at the top of this file).
  const contentRows = Math.max(
    rowsFor(m.items.tl),
    rowsFor(m.items.tr),
    rowsFor(m.items.bl),
    rowsFor(m.items.br),
  );
  // Squarish, but never letterboxed: the plot is at least three-fifths as tall
  // as it is wide, rounded to an even number of rows so the two quadrant rows
  // are identical.
  const shapelyRows = Math.ceil((w * MATRIX.plotRatio) / ROW / 2);
  const cellRows = Math.max(contentRows, shapelyRows);

  const axisRows = (m.y ? MATRIX.axisRows : 0) + (m.x ? MATRIX.axisRows : 0);
  const titleRows = m.title ? 1 : 0;

  return { w, h: wholeRows((cellRows * 2 + axisRows + titleRows) * ROW) };
}

export interface MatrixHelpers {
  inline: (text: string) => string;
  escapeHtml: (s: string) => string;
  attr: (name: string, value: string | undefined) => string;
}

export function renderMatrix(n: BlockNode, diagnostics: Diagnostic[], h: MatrixHelpers, nested: string): string {
  const model = buildMatrix(n, diagnostics);
  const pinned = n.params.width ?? "auto";
  const size = measureMatrix(model, pinned);
  const place: Placement = placeFigure(size, pinned, n, diagnostics, {
    noun: "matrix",
    hint: "Shorter item names would fit.",
  });

  const cell = (q: Quadrant): string =>
    `<div class="jot-matrix-cell" data-q="${q}">` +
    model.items[q].map((label) => `<span class="jot-matrix-chip">${h.inline(label)}</span>`).join("") +
    `</div>`;

  const axisY = model.y
    ? `<p class="jot-matrix-axis" data-axis="y">${h.inline(model.y)} <span aria-hidden="true">&uarr;</span></p>`
    : "";
  const axisX = model.x
    ? `<p class="jot-matrix-axis" data-axis="x">${h.inline(model.x)} <span aria-hidden="true">&rarr;</span></p>`
    : "";
  const title = model.title ? `<p class="jot-matrix-title">${h.inline(model.title)}</p>` : "";

  return (
    `<div class="jot-figure" data-figure="matrix" data-fill${figureAttrs(place, size)}>` +
    `<div class="jot-matrix" data-style="${h.escapeHtml(n.params.style ?? "axes")}"${h.attr("id", n.params.id)}>` +
    title +
    axisY +
    `<div class="jot-matrix-plot">${cell("tl")}${cell("tr")}${cell("bl")}${cell("br")}</div>` +
    axisX +
    `</div></div>` +
    (nested ? `<div class="jot-nested">${nested}</div>` : "")
  );
}
