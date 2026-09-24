// The stylesheet for @star_model, generated from the same geometry the
// renderer measures with (star.ts).
//
// This is the one figure whose positions are written by the renderer rather
// than described here: a grid cannot say "at four o'clock". Every coordinate
// arrives as an inline style already multiplied by --u, so the whole
// arrangement scales together when the figure has less room than it wants.

import { STAR } from "./star.js";

const u = (n: number): string => (n === 0 ? "0" : `calc(${n} * var(--u, 1px))`);

export function renderStarCss(scope: string): string {
  const R = STAR.row;
  return `
/* ── @star_model: a fact in the middle, dimensions around it ────────── */
${scope} .jot-star {
  --jot-star-line: var(--jot-color-accent-slate-blue);
  --jot-star-fact-fill: var(--jot-color-accent-terracotta-pale);
  --jot-star-fact-line: var(--jot-color-accent-terracotta);
  --jot-star-dim-fill: var(--jot-surface-elevated);
  --jot-star-dim-line: var(--jot-color-notebook-rule-lines);
  color: var(--jot-ink);
}
${scope}[data-mode="doc"] .jot-star {
  --jot-star-fact-fill: var(--jot-color-doc-sheet);
  --jot-star-dim-fill: var(--jot-color-doc-sheet);
  --jot-star-dim-line: var(--jot-color-doc-sheet-border);
}
${scope} .jot-star .jot-star-title {
  margin: 0;
  font-family: var(--jot-font-label);
  font-size: ${u(STAR.fieldSize)};
  line-height: ${u(R)};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

${scope} .jot-star-plot { position: relative; }
/* The lines are drawn first so the boxes paint over their ends; connectors run
   between EDGES rather than centres, so none of them passes under a label. */
${scope} .jot-star-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  stroke: var(--jot-star-line);
  stroke-width: 1;
  fill: none;
}
${scope} .jot-star-fact,
${scope} .jot-star-dim {
  position: absolute;
  box-sizing: border-box;
  text-align: center;
}
/* The fact is the thing everything else is about, so it is the only filled
   box in the figure. */
${scope} .jot-star-fact {
  border: 1px solid var(--jot-star-fact-line);
  border-radius: var(--jot-shape-border-radius-sm);
  background: var(--jot-star-fact-fill);
  padding: 0 ${u(STAR.factPadX)};
}
${scope} .jot-star .jot-star-name {
  margin: 0;
  font-family: var(--jot-font-body);
  font-size: ${u(STAR.factSize)};
  line-height: calc(${u(R)} - 2px);
  font-weight: 600;
}
${scope} .jot-star .jot-star-field {
  margin: 0;
  font-family: var(--jot-font-mono);
  font-size: ${u(STAR.fieldSize)};
  line-height: ${u(R)};
  color: var(--jot-ink-muted);
  text-align: left;
  white-space: nowrap;
}
${scope} .jot-star-dim {
  font-family: var(--jot-font-body);
  font-size: ${u(STAR.dimSize)};
  line-height: calc(${u(R)} - 2px);
  padding: 0 ${u(STAR.dimPadX)};
  border: 1px solid var(--jot-star-dim-line);
  border-radius: ${u(R / 2)};
  background: var(--jot-star-dim-fill);
  white-space: nowrap;
}

/* ── layout=list ────────────────────────────────────────────────────── */
/* Not a fallback with an apology: a star model with fifteen dimensions IS a
   list of fifteen dimensions, and a wheel of tiny text helps nobody. Never
   measured, never scaled, wraps like prose. */
/* block + fit-content, not inline-block: an inline-block sits on the text
   baseline, so its line box reserves room for descenders underneath it and the
   figure came out a pixel over a whole row. */
${scope} .jot-star[data-layout="list"] .jot-star-fact {
  position: static;
  display: block;
  width: fit-content;
  text-align: left;
  font-family: var(--jot-font-body);
  font-size: ${STAR.factSize}px;
  line-height: ${R - 2}px;
  font-weight: 600;
  margin: 0;
  padding: 0 ${STAR.factPadX}px;
}
${scope} .jot-star[data-layout="list"] .jot-star-field {
  font-size: ${STAR.fieldSize}px;
  padding-left: ${STAR.factPadX}px;
}
/* A whole row of gap, not half of one. An unsized figure is only in phase if
   every part of it is a whole number of rows, and a 14px margin here put the
   list layout 12.54 rows tall — so every line after it landed off the rule. */
${scope} .jot-star-list {
  list-style: none;
  margin: ${R}px 0 0;
  padding: 0 0 0 ${R}px;
}
${scope} .jot-star-list li {
  position: relative;
  font-size: ${STAR.dimSize}px;
  line-height: ${R}px;
}
/* One tick per dimension, pointing back at the fact above them. */
${scope} .jot-star-list li::before {
  content: "";
  position: absolute;
  left: ${-R / 2}px;
  top: ${R / 2}px;
  width: ${R / 2 - 4}px;
  border-top: 1px solid var(--jot-star-line);
}
`;
}
