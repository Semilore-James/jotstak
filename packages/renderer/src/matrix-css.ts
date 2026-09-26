// The stylesheet for @matrix, generated from the same geometry the renderer
// measures with (matrix.ts), so the drawing and the prediction cannot drift.
//
// Lengths are multiples of --u, which is 1px at full size and shrinks when the
// figure has less room than it wants. Hairlines stay 1px so they stay crisp.

import { MATRIX } from "./matrix.js";

const u = (n: number): string => (n === 0 ? "0" : `calc(${n} * var(--u, 1px))`);

export function renderMatrixCss(scope: string): string {
  const line = "1px solid var(--jot-matrix-cross)";
  return `
/* ── @matrix: two axes, four equal quadrants ────────────────────────── */
${scope} .jot-matrix {
  --jot-matrix-cross: var(--jot-color-accent-slate-blue);
  --jot-matrix-frame: var(--jot-color-notebook-rule-lines);
  --jot-matrix-axis-ink: var(--jot-ink-muted);
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--jot-ink);
}
${scope}[data-mode="doc"] .jot-matrix { --jot-matrix-frame: var(--jot-color-doc-sheet-border); }

${scope} .jot-matrix .jot-matrix-title,
${scope} .jot-matrix .jot-matrix-axis {
  font-family: var(--jot-font-label);
  font-size: ${u(MATRIX.axisSize)};
  line-height: ${u(MATRIX.row)};
  margin: 0;
  color: var(--jot-matrix-axis-ink);
  letter-spacing: 0.04em;
}
${scope} .jot-matrix .jot-matrix-title {
  font-size: ${u(MATRIX.titleSize)};
  text-transform: uppercase;
  font-weight: 600;
  color: var(--jot-ink);
}
/* The y label sits above the plot at the left and the x label under it at the
   right, each with an arrow towards "high". No rotated text: it cannot sit on
   a rule, and on paper it makes the reader turn the page. */
${scope} .jot-matrix .jot-matrix-axis[data-axis="y"] { text-align: left; }
${scope} .jot-matrix .jot-matrix-axis[data-axis="x"] { text-align: right; }

/* The plot takes whatever height is left after the labels, which is a whole
   number of rows because the figure's height is. */
${scope} .jot-matrix-plot {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}
/* Two framings, both wanted (UX-39).
   style=axes draws the cross alone, in the same slate as a tree's connectors,
   so a matrix reads as something drawn on the page. style=boxed adds the outer
   border in the paler rule colour, which reads closer to a table. The cross is
   the axis either way, so it is always the stronger of the two lines. */
${scope} .jot-matrix[data-style="boxed"] .jot-matrix-plot { border: 1px solid var(--jot-matrix-frame); }
${scope} .jot-matrix-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${u(MATRIX.chipGap)};
  padding: ${u(MATRIX.cellPad)};
  min-width: 0;
  overflow: hidden;
}
/* One cross through the middle, drawn as two borders rather than four, so the
   lines meet exactly at the centre. */
${scope} .jot-matrix-cell[data-q="tr"],
${scope} .jot-matrix-cell[data-q="br"] { border-left: ${line}; }
${scope} .jot-matrix-cell[data-q="bl"],
${scope} .jot-matrix-cell[data-q="br"] { border-top: ${line}; }

/* The chip is the tree's boxed node, to the pixel: one voice for every figure
   in the document. */
${scope} .jot-matrix-chip {
  display: block;
  max-width: 100%;
  box-sizing: border-box;
  font-family: var(--jot-font-body);
  font-size: ${u(MATRIX.chipSize)};
  line-height: calc(${u(MATRIX.chipHeight)} - 2px);
  padding: 0 ${u(MATRIX.chipPadX)};
  border: 1px solid var(--jot-color-accent-terracotta-pale);
  border-radius: ${u(MATRIX.chipHeight / 2)};
  background: var(--jot-surface-elevated);
  color: var(--jot-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* A chip is held on one line so a long label cannot stretch the quadrant. A
   break the author asked for is the one thing that releases it, and then the
   chip is as tall as the lines it was given. */
${scope} .jot-matrix-chip[data-wrap] {
  white-space: normal;
  text-align: center;
  line-height: calc(${u(MATRIX.chipHeight)} - 2px);
  height: auto;
}
${scope}[data-mode="doc"] .jot-matrix-chip {
  background: var(--jot-color-doc-sheet);
  border-color: var(--jot-color-doc-sheet-border);
}
`;
}
