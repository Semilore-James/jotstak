// The stylesheet for @journey, generated from the same geometry the renderer
// measures with (journey.ts), so the drawing and the prediction cannot drift.
//
// Horizontal lengths are multiples of --u, which is 1px at full size and
// shrinks when the figure has less room than it wants. The vertical form is
// never scaled — it wraps like prose — so it is written in plain pixels.

import { JOURNEY } from "./journey.js";

const u = (n: number): string => (n === 0 ? "0" : `calc(${n} * var(--u, 1px))`);

export function renderJourneyCss(scope: string): string {
  const R = JOURNEY.row;
  const band = `calc(${JOURNEY.bandRows} * ${u(R)})`;
  return `
/* ── @journey: stages across, and how each one felt ─────────────────── */
${scope} .jot-journey {
  --jot-journey-line: var(--jot-color-notebook-rule-lines);
  --jot-journey-happy: var(--jot-color-accent-sage);
  --jot-journey-neutral: var(--jot-color-accent-slate-blue);
  --jot-journey-frustrated: var(--jot-color-accent-terracotta);
  color: var(--jot-ink);
}
${scope}[data-mode="doc"] .jot-journey { --jot-journey-line: var(--jot-color-doc-sheet-border); }

${scope} .jot-journey .jot-journey-title,
${scope} .jot-journey .jot-journey-track {
  margin: 0;
  font-family: var(--jot-font-label);
  font-size: ${u(JOURNEY.trackSize)};
  line-height: ${u(R)};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--jot-ink);
}
${scope} .jot-journey .jot-journey-track { color: var(--jot-ink-muted); }
${scope} .jot-journey .jot-journey-name {
  margin: 0;
  font-family: var(--jot-font-body);
  font-size: ${u(JOURNEY.nameSize)};
  line-height: ${u(R)};
  font-weight: 600;
}
${scope} .jot-journey .jot-journey-item {
  margin: 0;
  font-family: var(--jot-font-body);
  font-size: ${u(JOURNEY.itemSize)};
  line-height: ${u(R)};
  color: var(--jot-ink-muted);
}

/* ── Horizontal ─────────────────────────────────────────────────────── */
/* Three bands down: the stage names, the emotion band, then what happens at
   each stage. Equal columns, because a stage with more written under it is
   not a longer stage. */
${scope} .jot-journey-lane {
  display: grid;
  grid-template-columns: repeat(var(--jot-j-n), 1fr);
  grid-template-rows:
    calc(var(--jot-j-name) * ${u(R)})
    ${band}
    calc(var(--jot-j-items) * ${u(R)});
}
/* The stage is a wrapper for authoring, not for layout: its three parts belong
   in three different rows of the lane's grid, so it generates no box of its
   own and hands them straight to the grid. */
${scope} .jot-journey-stage { display: contents; }
${scope} .jot-journey .jot-journey-name,
${scope} .jot-journey-items { padding-inline: ${u(JOURNEY.gutter)}; min-width: 0; }
${scope} .jot-journey .jot-journey-name { grid-row: 1; align-self: end; }
${scope} .jot-journey-items { grid-row: 3; align-self: start; }

/* The band holds the line; the dots sit in it, one per stage, at the height of
   their own feeling. The dots come after it in the markup, so they paint on
   top of the line without needing a stacking context. */
${scope} .jot-journey-band {
  grid-row: 2;
  grid-column: 1 / -1;
  position: relative;
}
/* Neutral, drawn faintly, so rising above it and dropping below it both mean
   something at a glance. */
${scope} .jot-journey-band::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: calc(${u(R)} + ${u(R / 2)});
  border-top: 1px dashed var(--jot-journey-line);
}
${scope} .jot-journey-line {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: var(--jot-journey-neutral);
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
${scope} .jot-journey-dot {
  grid-row: 2;
  justify-self: center;
  align-self: start;
  /* Level 0, 1 or 2 down the band, centred in its own row. */
  margin-top: calc(var(--jot-j-level) * ${u(R)} + ${u((R - JOURNEY.dot) / 2)});
  width: ${u(JOURNEY.dot)};
  height: ${u(JOURNEY.dot)};
  border-radius: 50%;
  background: var(--jot-journey-neutral);
}
${scope} .jot-journey-stage[data-feeling="happy"] > .jot-journey-dot { background: var(--jot-journey-happy); }
${scope} .jot-journey-stage[data-feeling="frustrated"] > .jot-journey-dot { background: var(--jot-journey-frustrated); }
/* A stage that went wrong is worth finding without reading the map. */
${scope} .jot-journey-stage[data-feeling="frustrated"] > .jot-journey-name { color: var(--jot-journey-frustrated); }

/* ── Vertical ───────────────────────────────────────────────────────── */
/* No band and no curve: down the page the feeling is carried by the mark
   beside each stage, which is what a rail can say. Never measured or scaled. */
${scope} .jot-journey[data-dir="vertical"] .jot-journey-rail {
  list-style: none;
  margin: 0;
  padding: 0 0 0 ${JOURNEY.railGap}px;
}
${scope} .jot-journey[data-dir="vertical"] .jot-journey-step {
  position: relative;
  margin: 0 0 ${R}px;
}
${scope} .jot-journey[data-dir="vertical"] .jot-journey-step::before {
  content: "";
  position: absolute;
  left: ${JOURNEY.railX - JOURNEY.railGap}px;
  top: ${R / 2}px;
  bottom: ${-(R + R / 2)}px;
  border-left: 1px solid var(--jot-journey-line);
}
${scope} .jot-journey[data-dir="vertical"] .jot-journey-step:last-child { margin-bottom: 0; }
${scope} .jot-journey[data-dir="vertical"] .jot-journey-step:last-child::before { display: none; }
${scope} .jot-journey[data-dir="vertical"] .jot-journey-dot {
  position: absolute;
  left: ${JOURNEY.railX - JOURNEY.railGap - JOURNEY.dot / 2}px;
  top: ${(R - JOURNEY.dot) / 2}px;
  margin-top: 0;
}
`;
}
