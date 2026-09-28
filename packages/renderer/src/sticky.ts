// @sticky — a sticky note, and a wall of them.
//
// Two decisions shape everything here.
//
// COLOUR. The schema names six colours a Post-it comes in — yellow, green,
// coral, blue, pink, purple — and the document's own palette is terracotta,
// slate blue, sage and sepia. Those are different worlds, and picking the
// document's would have made `color=pink` a lie. So the six are kept and
// pulled toward the paper: saturated enough to read instantly as a sticky,
// muted enough to sit on warm cream rather than look pasted in from another
// application. The same move as the sketch table style, which references a
// real object without importing it wholesale.
//
// OVERFLOW. A sticky is a square, and text does not respect squares. It drops
// one size step to try to fit, and if it still does not, the note grows in
// whole rows and says it did. Never losing a word matters more than the shape;
// saying so matters more than quietly becoming a rectangle.
//
// And a wall: stickies written one after another are ONE figure, laid out as a
// grid, because that is what "cluster synthesis" means. Two stickies in a row
// that rendered as two separate blocks down the page would be a list with
// coloured backgrounds.

import type { BlockNode } from "./ast.js";
import type { Diagnostic } from "./index.js";
import { ESTIMATE_SAFETY, measureText, segments } from "./measure.js";

export const STICKY = {
  row: 28,
  /**
   * A sticky is square: five rows each way, so 140px.
   *
   * Four rows was the first try and it was too small to be a sticky note. At
   * 112px the inner width is 88px, which is about twelve characters a line, so
   * "No one read the docs before filing a bug" already overflowed a square.
   * At five rows a note holds roughly eighty characters at full size and four
   * sit across the full page width, which is what a wall looks like.
   *
   * A real Post-it is 76mm, about 287px, and ten rows of those would give two
   * per page. The square is smaller than life so that a cluster reads as a
   * cluster.
   */
  rows: 5,
  /** Inside padding, per side. */
  pad: 12,
  /** Space between two stickies side by side. Horizontal, so off-grid is fine. */
  gap: 14,
  /**
   * Space between two LINES of stickies: exactly one row.
   *
   * 14px here would be half a row, and a group of five notes would measure
   * 294px, which is not a whole number of rows. Rounding that up leaves 14px
   * of dead space at the foot of the wall. A full row costs the same height
   * and lands the second line of notes on the ruling.
   */
  rowGap: 28,
  /** The two type sizes, in order of preference, with their line heights. */
  sizes: [
    { size: 14, line: 20 },
    { size: 12, line: 17 },
  ],
} as const;

export const STICKY_COLORS = ["yellow", "green", "coral", "blue", "pink", "purple"] as const;
export type StickyColor = (typeof STICKY_COLORS)[number];

export const STICKY_SIDE = STICKY.rows * STICKY.row;

export interface StickyModel {
  text: string;
  color: StickyColor;
  cluster: string;
}

export interface StickyFit {
  /** Index into STICKY.sizes. */
  step: number;
  /** Whole rows the note takes. Four unless it had to grow. */
  rows: number;
  /** Did it grow past the square? */
  grew: boolean;
}

/** How many lines `text` takes across `w` pixels, counting asked-for breaks. */
function lines(text: string, size: number, w: number): number {
  if (!text.trim() || w <= 0) return 1;
  return segments(text).reduce(
    (total, part) =>
      total + Math.max(1, Math.ceil((measureText(part, "lora-400", size) * ESTIMATE_SAFETY) / w)),
    0,
  );
}

/**
 * Fit the text to the square, then to a taller note if it must.
 *
 * Tries each size step in turn at the square's height. If none fits, it keeps
 * the smallest step and adds whole rows until the text is inside — so the
 * failure mode is a tall sticky, never a clipped one.
 */
export function fitSticky(text: string): StickyFit {
  const inner = STICKY_SIDE - 2 * STICKY.pad;

  for (let step = 0; step < STICKY.sizes.length; step++) {
    const { size, line } = STICKY.sizes[step]!;
    if (lines(text, size, inner) * line <= inner) return { step, rows: STICKY.rows, grew: false };
  }

  const step = STICKY.sizes.length - 1;
  const { size, line } = STICKY.sizes[step]!;
  const needed = lines(text, size, inner) * line + 2 * STICKY.pad;
  return { step, rows: Math.ceil(needed / STICKY.row), grew: true };
}

/**
 * A small, stable tilt, from the text itself.
 *
 * Stable matters: a random angle would change on every keystroke, so a note
 * would twitch while you typed in the block above it. Deriving it from the
 * content means the same sticky always sits the same way, and two stickies
 * side by side almost never sit at the same angle.
 */
export function tilt(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  // Five positions across three degrees: -1.5, -0.75, 0, 0.75, 1.5.
  return (Math.abs(hash) % 5) * 0.75 - 1.5;
}

export function readSticky(n: BlockNode, diagnostics: Diagnostic[]): StickyModel {
  const body = n.body.shape === "plain" ? n.body.lines.filter((l) => l.trim()) : [];
  const text = (n.title || body.join(" ")).trim();

  if (!text) {
    diagnostics.push({
      severity: "warning",
      message: "This sticky has nothing on it. Write the note underneath, indented.",
      line: n.position.line,
      column: n.position.column,
    });
  }

  const raw = n.params.color?.trim().toLowerCase();
  const color = (STICKY_COLORS as readonly string[]).includes(raw ?? "")
    ? (raw as StickyColor)
    : "yellow";

  return { text, color, cluster: (n.params.cluster ?? "").trim() };
}

export interface StickyHelpers {
  inline: (text: string) => string;
  escapeHtml: (s: string) => string;
  attr: (name: string, value: string | undefined) => string;
}

/**
 * Render a run of stickies as one wall.
 *
 * The whole run is one figure and one row of the document. Given a `cluster`,
 * consecutive stickies naming the same one are grouped under it and labelled,
 * which is the only thing a cluster name is for.
 */
export function renderStickies(
  blocks: BlockNode[],
  diagnostics: Diagnostic[],
  h: StickyHelpers,
): string {
  const notes = blocks.map((b) => ({ block: b, model: readSticky(b, diagnostics) }));

  const grown = notes.filter(({ model }) => fitSticky(model.text).grew);
  for (const { block, model } of grown) {
    diagnostics.push({
      severity: "info",
      message: `This sticky grew past its square to fit ${model.text.length} characters. Shorten it, or split it into two.`,
      line: block.position.line,
      column: block.position.column,
    });
  }

  // Consecutive stickies naming the same cluster are one group. Not a lookup
  // across the whole document: a cluster is a thing you see on the page, so it
  // is made of notes that are next to each other.
  const groups: { name: string; notes: typeof notes }[] = [];
  for (const note of notes) {
    const last = groups[groups.length - 1];
    if (last && last.name === note.model.cluster) last.notes.push(note);
    else groups.push({ name: note.model.cluster, notes: [note] });
  }


  const one = ({ model }: (typeof notes)[number]): string => {
    const fit = fitSticky(model.text);
    return (
      `<div class="jot-sticky" data-color="${h.escapeHtml(model.color)}" data-step="${fit.step}"` +
      ` style="--jot-sticky-rows:${fit.rows};--jot-sticky-tilt:${tilt(model.text)}deg">` +
      `<p class="jot-sticky-text">${h.inline(model.text)}</p>` +
      `</div>`
    );
  };

  const wall = groups
    .map((g) =>
      g.name
        ? `<div class="jot-sticky-group">` +
          `<p class="jot-sticky-cluster">${h.inline(g.name)}</p>` +
          `<div class="jot-sticky-notes">${g.notes.map(one).join("")}</div>` +
          `</div>`
        : `<div class="jot-sticky-notes">${g.notes.map(one).join("")}</div>`,
    )
    .join("");


  // No declared height. The wall is a grid of fixed-size notes with a
  // whole-row gap, so its height is a whole number of rows by arithmetic at
  // whatever width it is given — including the narrow one a reflowed document
  // has, where the old "four across a printable page" was out by a factor of
  // two and drew 338px of stickies over the next block.
  return (
    `<div class="jot-sticky-wall" data-count="${notes.length}"` +
    `${h.attr("id", blocks[0]!.params.id)}>${wall}</div>`
  );
}
