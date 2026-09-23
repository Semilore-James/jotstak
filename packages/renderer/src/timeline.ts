// @timeline — events on a line, alternating above and below it.
//
// The horizontal timeline is the hardest figure to fit on a portrait page, and
// one observation makes it work: ALTERNATING IS NOT DECORATION. If events go
// above, below, above, below, then each side holds only half of them, and an
// event's nearest neighbour ON ITS OWN SIDE is two columns away. So every card
// may be two columns wide while still never touching another card. Six events
// on a 682px page get 114px of column each and 227px of card.
//
// Turn alternation off and that doubling goes with it — which is the honest
// trade, and why `alternate` defaults to on.
//
// The rest follows the usual figure rules (see figure.ts): measure in real
// pixels, take the text column, the full width, or a landscape page in that
// order, and scale rather than cut. Past about seven events a horizontal
// timeline is squeezed however it is drawn, so the diagnostic points at
// `dir=vertical`, which has no such limit — it runs down the page, one event
// per few rows, and wraps like prose.

import { ESTIMATE_SAFETY, measureText, type Face } from "./measure.js";
import { figureAttrs, placeFigure, ROW, wholeRows } from "./figure.js";
import { PAGE } from "./page.js";
import type { Placement, Size } from "./figure.js";
import type { BlockNode } from "./ast.js";
import type { Diagnostic } from "./index.js";

/** Every length the renderer and the stylesheet both need. */
export const TIMELINE = {
  row: ROW,
  /** The date: label face, uppercase, the same voice as a matrix axis. */
  dateSize: 12,
  dateTracking: 0.04,
  /** The event itself. */
  labelSize: 14,
  /** What happened, under the event. */
  detailSize: 13,
  /** The mark on the line. */
  dot: 7,
  /** Half the space between one card and the next. */
  gutter: 8,
  /** Narrowest a column may be: seven of these still fit a portrait page. */
  minColW: 96,
  /** Vertical: the rail's inset, and the gap from rail to text. */
  railX: 7,
  railGap: 21,
} as const;

export type Side = "above" | "below";

export interface TimelineEvent {
  date: string;
  label: string;
  detail: string[];
  /** Only when the author said so; otherwise alternation decides. */
  pinned: Side | null;
}

export interface TimelineModel {
  events: TimelineEvent[];
  title: string;
  vertical: boolean;
  alternate: boolean;
}

/** `Dec 2026: Beta above` → the date, the event, and the side if one is named. */
export function readEvent(text: string): { date: string; label: string; pinned: Side | null } {
  let rest = text.trim();
  let pinned: Side | null = null;
  const side = /\s+(above|below)$/i.exec(rest);
  if (side) {
    pinned = side[1]!.toLowerCase() as Side;
    rest = rest.slice(0, side.index).trim();
  }
  // The date is whatever comes before the first colon. No colon is allowed:
  // a sequence of steps is a timeline too, it just has no dates.
  const m = /^([^:]{1,24}):\s*(.+)$/.exec(rest);
  return m ? { date: m[1]!.trim(), label: m[2]!.trim(), pinned } : { date: "", label: rest, pinned };
}

export function buildTimeline(n: BlockNode, diagnostics: Diagnostic[]): TimelineModel {
  const roots = n.body.shape === "indented" ? n.body.roots : [];
  const vertical = n.params.dir === "vertical";
  const alternate = n.params.alternate !== "false";

  const events: TimelineEvent[] = roots.map((root) => {
    const { date, label, pinned } = readEvent(root.text);
    if (pinned && vertical) {
      diagnostics.push({
        severity: "info",
        message: `"${label}" names a side, which a vertical timeline does not have. Remove \`${pinned}\`, or drop \`dir=vertical\`.`,
        line: root.position.line,
        column: root.position.column,
      });
    }
    return { date, label, pinned: vertical ? null : pinned, detail: root.children.map((c) => c.text) };
  });

  if (events.length === 0) {
    diagnostics.push({
      severity: "warning",
      message: "This timeline has no events. Each one is a line: `Oct 2026: Alpha`, with any detail indented under it.",
      line: n.position.line,
      column: n.position.column,
    });
  }

  return { events, title: n.params.title ?? n.title ?? "", vertical, alternate };
}

/**
 * Which side each event falls on. Alternation is the default and a pinned side
 * takes over from there, so `above` on the third event flips the fourth too
 * rather than putting two in a row on the same side.
 */
export function sides(model: TimelineModel): Side[] {
  if (!model.alternate) return model.events.map((e) => e.pinned ?? "below");
  let next: Side = "above";
  return model.events.map((e) => {
    const side = e.pinned ?? next;
    next = side === "above" ? "below" : "above";
    return side;
  });
}

/**
 * How far each card reaches either side of its own dot, in sub-columns — the
 * grid is two sub-columns per event, so a reach of 2 is one whole column each
 * way and a card two columns wide.
 *
 * Every card is SYMMETRIC about its dot, and that is the constraint doing the
 * work. Letting a card run two columns and clamping it at the page edge is
 * what a grid does naturally, and it put the first and last labels half a
 * column to the inside of the dots they belong to — close enough to look like
 * a mistake rather than a style. So an end card takes one column instead, and
 * stays over its mark.
 *
 * Moving the dots to the card centres instead would line everything up too,
 * and would be wrong: dots evenly spaced say "equal intervals", and a reader
 * reads an uneven gap as uneven time.
 */
export function reach(i: number, side: Side[]): number {
  const n = side.length;
  const dot = 2 * i + 2;

  // How many events away the nearest event ON THE SAME SIDE is. Two events
  // that far apart have dots twice that many sub-columns apart, so each may
  // reach that far and their cards meet exactly halfway.
  //
  // Derived rather than assumed, because alternation is only the default:
  // `above` on one event pushes its neighbour onto the same side, and a card
  // still reaching two columns then ran straight through it.
  let near = Infinity;
  for (let j = 0; j < n; j++) {
    if (j !== i && side[j] === side[i]) near = Math.min(near, Math.abs(j - i));
  }

  return Math.max(1, Math.min(2, near, dot - 1, 2 * n + 1 - dot));
}

const width = (text: string, face: Face, size: number): number =>
  measureText(text, face, size) * ESTIMATE_SAFETY;

const dateWidth = (text: string): number =>
  width(text.toUpperCase(), "lora-600", TIMELINE.dateSize) +
  text.length * TIMELINE.dateTracking * TIMELINE.dateSize;

/** How many lines `text` takes in `w` pixels. Rounds up, which errs tall. */
function lines(text: string, face: Face, size: number, w: number): number {
  if (!text || w <= 0) return 0;
  return Math.max(1, Math.ceil(width(text, face, size) / w));
}

/** Rows one card occupies at a given card width. */
export function cardRows(e: TimelineEvent, cardW: number): number {
  const rows =
    (e.date ? 1 : 0) +
    lines(e.label, "lora-600", TIMELINE.labelSize, cardW) +
    e.detail.reduce((a, d) => a + lines(d, "lora-400", TIMELINE.detailSize, cardW), 0);
  return Math.max(1, rows);
}

export interface TimelineMetrics extends Size {
  /** Width of one event's column. */
  column: number;
  /** Rows above the line, and below it. */
  above: number;
  below: number;
}

export function measureTimeline(m: TimelineModel, pinned = "auto"): TimelineMetrics {
  const n = m.events.length;
  const titleRows = m.title ? 1 : 0;

  if (m.vertical) {
    // Vertical wraps like prose: it takes the width it is given and grows down
    // the page, so there is nothing to measure but the height.
    const cardW = Math.max(120, 480 - TIMELINE.railGap);
    const rows = m.events.reduce((a, e) => a + cardRows(e, cardW) + 1, 0);
    return { w: 0, h: wholeRows((titleRows + Math.max(1, rows)) * ROW), column: 0, above: 0, below: 0 };
  }

  const widest = Math.max(0, ...m.events.map((e) => dateWidth(e.date)));
  // A card spans two columns, so a column only needs half the room the date
  // wants. The date never wraps — it is four to eight characters and breaking
  // it would be absurd — while labels and detail wrap inside the card.
  const need = Math.max(TIMELINE.minColW, Math.ceil((widest + TIMELINE.gutter * 2) / 2));

  // A timeline is a plate like a matrix: it takes the whole printable width
  // and divides it up, rather than shrinking to its contents. That is not only
  // how it looks — it is how the height comes out right. Measuring columns at
  // their natural 96px while the browser drew them at 170px predicted five
  // rows of card where four were drawn, and every timeline stood a row taller
  // than its contents.
  const room =
    pinned === "landscape"
      ? PAGE.landscape.content
      : pinned === "column" || pinned === "wide"
        ? PAGE.portrait.column
        : PAGE.portrait.content;
  // Exactly the room when the content fits — rounding 681.7 up to 682 would
  // put the figure a third of a pixel over its own page and report a scale.
  const w = need * n > room ? need * n : room;
  const column = w / Math.max(1, n);

  // Each card is measured at ITS OWN width: the two at the ends get one
  // column rather than two, so they wrap sooner and can be the tallest.
  const side = sides(m);
  const cardW = (i: number): number => reach(i, side) * column - TIMELINE.gutter * 2;
  const rowsOn = (want: Side): number =>
    Math.max(0, ...m.events.map((e, i) => (side[i] === want ? cardRows(e, cardW(i)) : 0)));
  const above = rowsOn("above");
  const below = rowsOn("below");

  return {
    w,
    h: wholeRows((titleRows + above + 1 + below) * ROW),
    column,
    above,
    below,
  };
}

export interface TimelineHelpers {
  inline: (text: string) => string;
  escapeHtml: (s: string) => string;
  attr: (name: string, value: string | undefined) => string;
}

export function renderTimeline(
  n: BlockNode,
  diagnostics: Diagnostic[],
  h: TimelineHelpers,
  nested: string,
): string {
  const model = buildTimeline(n, diagnostics);
  const pinned = n.params.width ?? "auto";
  const metrics = measureTimeline(model, pinned);
  const place: Placement = placeFigure(metrics, pinned, n, diagnostics, {
    noun: "timeline",
    hint: "`dir=vertical` runs down the page instead, and fits any number of events.",
    sized: !model.vertical,
  });

  const title = model.title
    ? `<p class="jot-timeline-title">${h.inline(model.title)}</p>`
    : "";
  const body = (e: TimelineEvent): string =>
    (e.date ? `<p class="jot-timeline-date">${h.inline(e.date)}</p>` : "") +
    (e.label ? `<p class="jot-timeline-label">${h.inline(e.label)}</p>` : "") +
    e.detail.map((d) => `<p class="jot-timeline-detail">${h.inline(d)}</p>`).join("");

  const inner = model.vertical
    ? renderVertical(model, h, body)
    : renderHorizontal(model, metrics, h, body);

  return (
    `<div class="jot-figure" data-figure="timeline"${model.vertical ? "" : " data-fill"}${figureAttrs(place, metrics, !model.vertical)}>` +
    `<div class="jot-timeline" data-dir="${model.vertical ? "vertical" : "horizontal"}"${h.attr("id", n.params.id)}>` +
    title +
    inner +
    `</div></div>` +
    (nested ? `<div class="jot-nested">${nested}</div>` : "")
  );
}

function renderVertical(
  m: TimelineModel,
  h: TimelineHelpers,
  body: (e: TimelineEvent) => string,
): string {
  void h;
  const items = m.events
    .map((e) => `<li class="jot-timeline-event"><span class="jot-timeline-dot"></span>${body(e)}</li>`)
    .join("");
  return `<ol class="jot-timeline-rail">${items}</ol>`;
}

function renderHorizontal(
  m: TimelineModel,
  metrics: TimelineMetrics,
  h: TimelineHelpers,
  body: (e: TimelineEvent) => string,
): string {
  void h;
  const n = Math.max(1, m.events.length);
  const side = sides(m);

  // Sub-columns, two per event, so a card can be centred on its own dot and
  // still stop exactly where its same-side neighbour's begins.
  const cards = m.events
    .map((e, i) => {
      const dot = 2 * i + 2;
      const r = reach(i, side);
      return (
        `<div class="jot-timeline-event" data-side="${side[i]}"` +
        ` style="grid-column:${dot - r} / ${dot + r}">${body(e)}</div>`
      );
    })
    .join("");

  const dots = m.events.map(() => `<span class="jot-timeline-dot"></span>`).join("");

  return (
    `<div class="jot-timeline-plot" style="--jot-tl-n:${n};--jot-tl-above:${metrics.above};--jot-tl-below:${metrics.below}">` +
    `<div class="jot-timeline-axis">${dots}</div>` +
    cards +
    `</div>`
  );
}
