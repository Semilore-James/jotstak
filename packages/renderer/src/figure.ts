// What every drawn figure shares: how wide it is allowed to be, what happens
// when it wants more, and the wrapper that makes it fit.
//
// @tree worked this out first (UX-31, ARC-15) and the rules are not about
// trees: measure the thing in real pixels, then take the text column, or the
// full printable width, or a landscape page of its own — in that order — and
// scale down rather than ever cutting anything off. A matrix, a timeline and
// a star model all want exactly that, so it lives here rather than being
// written four times with four sets of slightly different rounding.

import { spacing } from "./tokens.js";
import { PAGE } from "./page.js";
import type { BlockNode } from "./ast.js";
import type { Diagnostic } from "./index.js";

/** The baseline row. Every figure is a whole number of these tall. */
export const ROW = spacing.baselineGrid;

/** A figure's natural size, before any scaling to fit. */
export interface Size {
  w: number;
  h: number;
}

export type Placement = {
  width: "column" | "full";
  page: "portrait" | "landscape";
  tall: boolean;
};

/**
 * Below this, scaling to fit costs more than turning the paper.
 *
 * The number was earned: the Table reference measured 1.1px over the portrait
 * width and was being sent to a landscape page for it. A tenth of a scale is
 * imperceptible; a page turn is not.
 */
export const MIN_SCALE_BEFORE_LANDSCAPE = 0.9;

export interface PlaceOptions {
  /** What to call the figure in a diagnostic: "tree", "matrix", "timeline". */
  noun: string;
  /** Advice when it does not fit, specific to the kind of figure. */
  hint?: string;
  /** False for figures that wrap like prose and are never sized or scaled. */
  sized?: boolean;
}

/** Round a height up to whole rows, with a floor of one row. */
export function wholeRows(px: number): number {
  return Math.max(ROW, Math.ceil(px / ROW) * ROW);
}

/**
 * Where a figure goes. `auto` escalates — column, then the full width, then a
 * landscape page of its own — and an author's `width=` pins it. Anything given
 * less room than it needs is scaled down to fit, never cut off.
 */
export function placeFigure(
  size: Size,
  pinned: string,
  n: BlockNode,
  diagnostics: Diagnostic[],
  opts: PlaceOptions,
): Placement {
  const { column, content } = PAGE.portrait;
  const land = PAGE.landscape.content;
  const sized = opts.sized !== false;
  const note = (severity: Diagnostic["severity"], message: string): void => {
    diagnostics.push({ severity, message, line: n.position.line, column: n.position.column });
  };
  const px = (v: number): string => `${Math.round(v)}px`;

  let placement: Placement;
  if (pinned === "landscape") placement = { width: "full", page: "landscape", tall: false };
  else if (pinned === "full") placement = { width: "full", page: "portrait", tall: false };
  else if (pinned === "column" || pinned === "wide") placement = { width: "column", page: "portrait", tall: false };
  else if (!sized || size.w <= column) placement = { width: "column", page: "portrait", tall: false };
  else if (size.w * MIN_SCALE_BEFORE_LANDSCAPE <= content) placement = { width: "full", page: "portrait", tall: false };
  else placement = { width: "full", page: "landscape", tall: false };

  const room = placement.page === "landscape" ? land : placement.width === "full" ? content : column;
  if (sized) {
    if (pinned === "auto" && placement.page === "landscape" && size.w <= land) {
      // The hint belongs here too, and did not used to be: a timeline sent to
      // a landscape page never mentioned that `dir=vertical` would have kept
      // it on the page it was already on.
      note(
        "info",
        `This ${opts.noun} is about ${px(size.w)} wide — more than a portrait page (${px(content)}) — so it prints on a landscape page of its own. On screen it is shown scaled to fit.` +
          (opts.hint ? ` ${opts.hint}` : ""),
      );
    } else if (size.w > room) {
      const scale = room / size.w;
      const pct = Math.round(scale * 100);
      if (scale >= MIN_SCALE_BEFORE_LANDSCAPE) {
        // Inside the band a figure is MEANT to shrink rather than move, so this
        // is a note, not a problem.
        note("info", `Scaled to ${pct}% to fit the page.`);
      } else {
        note(
          pinned === "auto" ? "warning" : "info",
          `This ${opts.noun} is about ${px(size.w)} wide, more than the ${px(room)} it has, so it is scaled to ${pct}% to fit.` +
            (opts.hint ? ` ${opts.hint}` : ""),
        );
      }
    }
  }
  const rowsPerPage = placement.page === "landscape" ? PAGE.landscape.rows : PAGE.portrait.rows;
  placement.tall = size.h > rowsPerPage * ROW;
  return placement;
}

/**
 * The attributes on the `.jot-figure` wrapper. `--jot-w` and `--jot-h` are the
 * natural size the CSS scales from; a figure that wraps like prose sets
 * neither, which makes those lengths invalid and hands sizing back to CSS.
 */
export function figureAttrs(place: Placement, size: Size, sized = true): string {
  return (
    ` data-width="${place.width}"` +
    (place.page === "landscape" ? ` data-page="landscape"` : "") +
    (place.tall ? ` data-tall` : "") +
    (sized ? ` style="--jot-w:${size.w};--jot-h:${size.h}"` : "")
  );
}
