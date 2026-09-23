// The stylesheet for @timeline, generated from the same geometry the renderer
// measures with (timeline.ts), so the drawing and the prediction cannot drift.
//
// Horizontal lengths are multiples of --u, which is 1px at full size and
// shrinks when the figure has less room than it wants. The vertical form is
// never scaled — it wraps like prose — so it is written in plain pixels, and
// --u resolves to 1px there because the renderer sets no natural size.

import { TIMELINE } from "./timeline.js";

const u = (n: number): string => (n === 0 ? "0" : `calc(${n} * var(--u, 1px))`);

export function renderTimelineCss(scope: string): string {
  const R = TIMELINE.row;
  const line = "1px solid var(--jot-timeline-line)";
  return `
/* ── @timeline: events on a line ────────────────────────────────────── */
${scope} .jot-timeline {
  --jot-timeline-line: var(--jot-color-accent-slate-blue);
  color: var(--jot-ink);
}
${scope} .jot-timeline .jot-timeline-title {
  margin: 0;
  font-family: var(--jot-font-label);
  font-size: ${u(TIMELINE.dateSize)};
  line-height: ${u(R)};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--jot-ink);
}
${scope} .jot-timeline .jot-timeline-date {
  margin: 0;
  font-family: var(--jot-font-label);
  font-size: ${u(TIMELINE.dateSize)};
  line-height: ${u(R)};
  font-weight: 600;
  letter-spacing: ${TIMELINE.dateTracking}em;
  text-transform: uppercase;
  color: var(--jot-ink-muted);
  white-space: nowrap;
}
${scope} .jot-timeline .jot-timeline-label {
  margin: 0;
  font-family: var(--jot-font-body);
  font-size: ${u(TIMELINE.labelSize)};
  line-height: ${u(R)};
  font-weight: 600;
}
${scope} .jot-timeline .jot-timeline-detail {
  margin: 0;
  font-family: var(--jot-font-body);
  font-size: ${u(TIMELINE.detailSize)};
  line-height: ${u(R)};
  color: var(--jot-ink-muted);
}
${scope} .jot-timeline-dot {
  width: ${u(TIMELINE.dot)};
  height: ${u(TIMELINE.dot)};
  border-radius: 50%;
  background: var(--jot-timeline-line);
}

/* ── Horizontal ─────────────────────────────────────────────────────── */
/* Two sub-columns per event, so a card can be centred on its own dot and
   stop exactly where its same-side neighbour's card begins. That doubling is
   what alternation BUYS: each side holds half the events, so each card gets
   two columns instead of one. The renderer writes the span per card, because
   it knows how many events there are and CSS would have to be told anyway. */
${scope} .jot-timeline-plot {
  display: grid;
  grid-template-columns: repeat(calc(var(--jot-tl-n) * 2), 1fr);
  grid-template-rows:
    calc(var(--jot-tl-above) * ${u(R)})
    ${u(R)}
    calc(var(--jot-tl-below) * ${u(R)});
}
${scope} .jot-timeline-axis {
  grid-row: 2;
  grid-column: 1 / -1;
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--jot-tl-n), 1fr);
  align-items: center;
}
/* The line runs the whole width and the dots sit on top of it. Its position
   inside the row is free: a figure clears the ruling across its whole block,
   so there is no rule here to land on. */
${scope} .jot-timeline-axis::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: ${line};
}
${scope} .jot-timeline-axis .jot-timeline-dot {
  justify-self: center;
  position: relative;
}
${scope} .jot-timeline-event {
  min-width: 0;
  padding-inline: ${u(TIMELINE.gutter)};
  text-align: center;
}
/* A card grows towards the line, not away from it, so every card on a side
   finishes level with the axis however tall it is. */
${scope} .jot-timeline-event[data-side="above"] { grid-row: 1; align-self: end; }
${scope} .jot-timeline-event[data-side="below"] { grid-row: 3; align-self: start; }

/* ── Vertical ───────────────────────────────────────────────────────── */
/* No sides, no measuring, no scaling: it runs down the page and wraps like
   prose, which is why it is the answer when there are too many events for a
   line across a page. */
${scope} .jot-timeline[data-dir="vertical"] .jot-timeline-rail {
  list-style: none;
  margin: 0;
  padding: 0 0 0 ${TIMELINE.railGap}px;
}
${scope} .jot-timeline[data-dir="vertical"] .jot-timeline-event {
  position: relative;
  margin: 0 0 ${R}px;
  text-align: left;
  padding: 0;
}
/* The rail is drawn in segments, one per event, each running from its own dot
   down to the next one — rather than as a single line down the whole list.
   A single line has to end somewhere, and it ended level with the bottom of
   the last event's detail, which left it hanging past the final dot as though
   the timeline had been cut off. This way it ends exactly on the last mark. */
${scope} .jot-timeline[data-dir="vertical"] .jot-timeline-event::before {
  content: "";
  position: absolute;
  /* Measured back from the item rather than forward from the list, because
     the segment now hangs off the item: the rail sits railX from the list's
     edge, and the item starts railGap in. */
  left: ${TIMELINE.railX - TIMELINE.railGap}px;
  top: ${R / 2}px;
  bottom: ${-(R + R / 2)}px;
  border-left: ${line};
}
${scope} .jot-timeline[data-dir="vertical"] .jot-timeline-event:last-child { margin-bottom: 0; }
${scope} .jot-timeline[data-dir="vertical"] .jot-timeline-event:last-child::before { display: none; }
${scope} .jot-timeline[data-dir="vertical"] .jot-timeline-dot {
  position: absolute;
  left: ${-TIMELINE.railGap + TIMELINE.railX - TIMELINE.dot / 2}px;
  top: ${(R - TIMELINE.dot) / 2}px;
}
`;
}
