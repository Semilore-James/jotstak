// The stylesheet for @sticky, generated from the same constants the renderer
// fits text with (sticky.ts), so the size it predicts and the size the browser
// draws cannot drift.
//
// The six colours are the ones a Post-it comes in, pulled toward the paper.
// Full-strength sticky colours on warm cream read as something pasted in from
// another application, which is the one thing the notebook look is trying not
// to be. These sit on #fcf8f2 and still say "sticky" at a glance.
//
// Ink stays the document's own ink on every colour. A sticky is written on
// with the same pen as everything else.

import { STICKY, STICKY_SIDE } from "./sticky.js";

const R = STICKY.row;

/** Muted Post-it on cream. Tint, then a shade a step down for the edge. */
export const STICKY_TINTS: Record<string, { fill: string; edge: string }> = {
  yellow: { fill: "#f5e6a8", edge: "#e8d488" },
  green: { fill: "#cfdcc0", edge: "#b9caa6" },
  coral: { fill: "#f5c9b8", edge: "#e8b09a" },
  blue: { fill: "#c3d4dd", edge: "#a7bfcc" },
  pink: { fill: "#eccdd4", edge: "#dcb2bd" },
  purple: { fill: "#d6cde0", edge: "#bfb2cf" },
};

export function renderStickyCss(scope: string): string {
  const u = (n: number): string => `calc(${n} * var(--u, 1px))`;

  const tints = Object.entries(STICKY_TINTS)
    .map(
      ([name, { fill, edge }]) =>
        `${scope} .jot-sticky[data-color="${name}"] { background: ${fill}; border-color: ${edge}; }`,
    )
    .join("\n");

  const steps = STICKY.sizes
    .map(
      ({ size, line }, i) =>
        `${scope} .jot-sticky[data-step="${i}"] .jot-sticky-text { font-size: ${u(size)}; line-height: ${u(line)}; }`,
    )
    .join("\n");

  return `
/* ── @sticky: a wall of notes ───────────────────────────────────────── */
/* A run of stickies is ONE figure and one row of the document. Two in a row
   rendering as two blocks down the page would be a list with coloured
   backgrounds, which is not what cluster synthesis looks like. */
${scope} .jot-body:has(> .jot-sticky-wall) { grid-column: 1 / -1; }

/* Groups STACK; notes inside a group wrap. A cluster is a line of the wall,
   which is also how a wall works on an actual wall. Laying the groups out side
   by side instead let a second cluster wrap below the wall's own height and
   run over the paragraph underneath — and the wall's height being fixed meant
   declared and drawn agreed the whole time it was happening. */
${scope} .jot-sticky-wall {
  height: calc(var(--jot-sticky-wall-rows) * ${u(R)});
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

${scope} .jot-sticky-group { display: flex; flex-direction: column; }
${scope} .jot-sticky-notes { display: flex; flex-wrap: wrap; column-gap: ${u(STICKY.gap)}; row-gap: ${u(STICKY.rowGap)}; }

/* The cluster's name, in the label face, on its own row above the notes. */
${scope} .jot-sticky-wall .jot-sticky-cluster {
  font-family: var(--jot-font-label);
  font-size: ${u(12)};
  line-height: ${u(R)};
  margin: 0;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--jot-ink-muted);
}

${scope} .jot-sticky {
  width: ${u(STICKY_SIDE)};
  height: calc(var(--jot-sticky-rows) * ${u(R)});
  box-sizing: border-box;
  padding: ${u(STICKY.pad)};
  border: 1px solid;
  /* A sticky is paper on paper, so it casts a short shadow rather than
     carrying a heavy outline. */
  box-shadow: 0 1px 2px rgba(44, 37, 35, 0.14);
  rotate: var(--jot-sticky-tilt, 0deg);
  overflow: hidden;
}

/* Two classes, not one: the text is a <p>, so .jotstak .jot-body p reaches it
   at (0,2,1) and a single extra class would lose. ENG-18. */
${scope} .jot-sticky .jot-sticky-text {
  font-family: var(--jot-font-body);
  color: var(--jot-ink);
  margin: 0;
}
${steps}

${tints}

/* A drawn block clears the ruling across its whole row, like every other one. */
[data-mode="notebook"] ${scope} .jot-body:has(> .jot-sticky-wall) { background-image: none; }

/* Doc mode keeps the colours — a sticky with no colour is not a sticky — but
   loses the tilt and the shadow, which are notebook mannerisms. */
${scope}[data-mode="doc"] .jot-sticky { rotate: none; box-shadow: none; }
`;
}

/** Print rules, for the one print block the stylesheet has. */
export function renderStickyPrintCss(scope: string): string {
  return `
  /* A wall is one thought. Splitting it across two sheets loses the thought. */
  ${scope} .jot-sticky-wall { break-inside: avoid; }
  /* Backgrounds are the content here, not decoration. */
  ${scope} .jot-sticky { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
}
