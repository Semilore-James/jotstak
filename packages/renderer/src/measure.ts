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
