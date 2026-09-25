// Text measurement without a browser (ARC-15).
//
// Whether a diagram fits the column, needs the whole page width, or needs a
// landscape page of its own has to be decided while rendering, not after a
// browser has laid it out — the renderer returns plain HTML and CSS, and print
// needs the answer before the first page is cut. So the renderer measures text
// itself, from the advance widths of the same woff2 files the browser draws with.
//
// Checked against a real browser with the real fonts (2026-09-22), across 124
// labels in two weights and two sizes: mean error +0.23%, worst under-estimate
// −0.17%, worst over-estimate +4.5% (kerned pairs like "AV" and "Wo", which a
// per-character sum cannot see). Kerning only ever narrows text, so ignoring it
// errs wide — the safe direction.

import { FONT_ADVANCES } from "./font-metrics.js";

export type Face = keyof typeof FONT_ADVANCES;

/** Inline Markdown that changes what is drawn but not how wide it is drawn. */
function visibleText(source: string): string {
  return source
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links and images keep their text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|==|~~)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_]([^*_]+)[*_](?=$|[^\w*])/g, "$1$2");
}

/** Width in CSS pixels of `text` set in `face` at `sizePx`. */
export function measureText(text: string, face: Face, sizePx: number): number {
  const table = FONT_ADVANCES[face];
  let units = 0;
  for (const ch of visibleText(text)) units += table.widths[ch] ?? table.fallback;
  return (units / table.unitsPerEm) * sizePx;
}

/**
 * The margin every estimate is widened by. A too-narrow estimate is the
 * dangerous direction — the figure would be placed somewhere it does not fit —
 * so estimates round up, never down.
 */
export const ESTIMATE_SAFETY = 1.03;

/**
 * A forced line break inside a label or a cell.
 *
 * Enter breaks a line in prose (UX-45), but there are places a line has
 * nowhere to go: a table row is one line of source per row, and a diagram
 * label is a single line by construction. `\n` is the escape hatch for those —
 * two characters everybody already reads as "new line", and two characters
 * that plain Markdown has no meaning for, so the superset promise is intact.
 *
 * Splitting is a MEASUREMENT concern as much as a rendering one: a cell broken
 * into two lines is as wide as its widest half and twice as tall, and a
 * renderer that draws the break without measuring it would size the column for
 * text that is no longer on one line.
 */
export function segments(text: string): string[] {
  // A literal backslash followed by `n`, as typed in the source — not a real
  // newline, which cannot reach here: a cell and a label are one line each.
  return text.split(/\\n/).map((s) => s.trim());
}
