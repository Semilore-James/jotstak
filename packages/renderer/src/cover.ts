// @cover — a full-width opener for a major section.
//
// A BAND IN THE FLOW, NOT A PAGE.
//
// The obvious reading of "cover" is a title page: the whole sheet given over
// to a title, everything after it starting overleaf. That was considered and
// turned down, because `@pagebreak` already exists. A band plus a page break
// IS a title page, written in two lines that each do one thing:
//
//   @cover Discovery phase
//     Weeks 1-3
//   @pagebreak
//
// Building a whole-sheet mode into @cover would have meant a second way to
// start a page, living inside a block whose name says nothing about pages.
// That is the trade the primitive recut was about — 28 names over 18
// rendering functions — and it applies to the nineteenth as much as the rest.
//
// The band spans the margin channel by default. That is the whole difference
// between a cover and a large heading: a heading belongs to the text column,
// an opener sits across the page.

import type { BlockNode } from "./ast.js";
import type { Diagnostic } from "./index.js";

/**
 * The geometry, in CSS pixels at full size. cover-css.ts is generated from
 * these same numbers, so the rows the renderer counts and the rows the browser
 * draws cannot drift apart.
 */
export const COVER = {
  row: 28,
  /** The title's own height, in rows, per style. 36px type needs two. */
  titleRows: { minimal: 1, default: 2, bold: 2 },
  /** Air above and below the type, in rows, per style. */
  airTop: { minimal: 0, default: 1, bold: 1 },
  airBottom: { minimal: 1, default: 1, bold: 2 },
} as const;

export type CoverStyle = keyof typeof COVER.titleRows;

const STYLES: CoverStyle[] = ["default", "minimal", "bold"];

export interface CoverModel {
  title: string;
  subtitle: string;
  style: CoverStyle;
}

/**
 * Read a cover out of its block.
 *
 * The subtitle can be written either way, and both are the same subtitle:
 *
 *   @cover(subtitle="Weeks 1-3") Discovery phase
 *   @cover Discovery phase
 *     Weeks 1-3
 *
 * The second is the plainer spelling and the one the examples use. The first
 * exists because every other primitive's parameters work that way and a
 * special case would be worse than a synonym.
 *
 * The schema's own example used to be a third thing — `subtitle="Weeks 1-3"`
 * indented under the directive with no brackets — which is not a parameter at
 * all. It rendered as the literal text `subtitle="Weeks 1-3"` on the page for
 * as long as @cover had no renderer to notice.
 */
export function readCover(n: BlockNode): CoverModel {
  const body = n.body.shape === "plain" ? n.body.lines.filter((l) => l.trim()) : [];
  return {
    title: (n.params.title ?? n.title ?? "").trim(),
    subtitle: (n.params.subtitle ?? body.join(" ")).trim(),
    style: readStyle(n.params.style),
  };
}

function readStyle(raw: string | undefined): CoverStyle {
  const found = STYLES.find((s) => s === raw?.trim().toLowerCase());
  return found ?? "default";
}

/**
 * How many whole rows the band takes.
 *
 * A cover with no subtitle is a row shorter rather than a row of empty space:
 * the contract is that every block is a whole number of rows, not that every
 * block of a kind is the same number of them.
 */
export function coverRows(model: CoverModel): number {
  return (
    COVER.airTop[model.style] +
    COVER.titleRows[model.style] +
    (model.subtitle ? 1 : 0) +
    COVER.airBottom[model.style]
  );
}

export interface CoverHelpers {
  inline: (text: string) => string;
  escapeHtml: (s: string) => string;
  attr: (name: string, value: string | undefined) => string;
}

export function renderCover(n: BlockNode, diagnostics: Diagnostic[], h: CoverHelpers): string {
  const model = readCover(n);

  if (!model.title) {
    diagnostics.push({
      severity: "warning",
      message:
        "This cover has no title. Write it on the same line: `@cover Discovery phase`, with the subtitle indented underneath.",
      line: n.position.line,
      column: n.position.column,
    });
  }
  // No diagnostic for an unknown style. The schema validates every enum on
  // every primitive already, and says it better than this could:
  //   Invalid value "enormous" for param "style" on @cover.
  //   Expected one of: default, minimal, bold.
  // A second message saying the same thing less precisely is how a language
  // ends up telling you twice and disagreeing with itself once.

  const width = n.params.width ?? "full";
  const rows = coverRows(model);
  const subtitle = model.subtitle
    ? `<p class="jot-cover-subtitle">${h.inline(model.subtitle)}</p>`
    : "";

  return (
    `<div class="jot-cover" data-style="${h.escapeHtml(model.style)}" data-width="${h.escapeHtml(width)}"` +
    ` style="--jot-cover-rows:${rows}"${h.attr("id", n.params.id)}>` +
    `<p class="jot-cover-title">${h.inline(model.title)}</p>` +
    subtitle +
    `</div>`
  );
}
