// The page (ARC-14, option A: print-true pages, continuous screen).
//
// A Jotstak document is an A4 document. On screen it is one continuous sheet
// exactly as wide as an A4 page's printable area, so anything that fits on
// screen fits on paper. In print the browser cuts it into real A4 pages: a
// block that doesn't fit the rest of a page moves to the next one whole, and a
// figure too wide for portrait gets a landscape page of its own.
//
// Every number here is DERIVED from the paper size and the 28px row, not typed
// in, for the same reason ADR-002 derives the baseline from the font files.

import { notebookLayout, spacing } from "./tokens.js";

const ROW = spacing.baselineGrid;
const PX_PER_MM = 96 / 25.4; // CSS's fixed reference: 96px to the inch
const floor2 = (n: number): number => Math.floor(n * 100) / 100;

/** A4, in CSS pixels. */
const A4 = { width: 210 * PX_PER_MM, height: 297 * PX_PER_MM };

/** Side margins. Top and bottom are derived below. */
const MARGIN_X = ROW * 2;

/**
 * Top and bottom margins are whatever makes the page body a WHOLE NUMBER OF
 * ROWS. A 297mm page less a flat 56px leaves 1010.5px — 36 rows plus 2.5px —
 * and that remainder would shift the ruling 2.5px further out of phase on every
 * page of a printed document. Rows must survive the page break.
 */
function orientation(paperWidth: number, paperHeight: number) {
  const rows = Math.floor((paperHeight - 2 * MARGIN_X) / ROW);
  const content = floor2(paperWidth - 2 * MARGIN_X);
  const gap = ROW;
  const ratio = notebookLayout.mainColumnRatio / (notebookLayout.mainColumnRatio + notebookLayout.marginChannelRatio);
  return {
    /** Printable width: the whole frame, main column plus margin channel. */
    content,
    /** Width of the main text column inside it. */
    column: floor2((content - gap) * ratio),
    rows,
    marginY: floor2((paperHeight - rows * ROW) / 2),
  };
}

export const PAGE = {
  marginX: MARGIN_X,
  portrait: orientation(A4.width, A4.height),
  landscape: orientation(A4.height, A4.width),
} as const;

/** Name of the page a figure is moved to when it needs a landscape sheet. */
export const LANDSCAPE_PAGE = "jot-landscape";

/**
 * How little room a document may be given before it stops being a SHEET and
 * becomes a column of text.
 *
 * UX-36 says every surface shows a whole A4 sheet zoomed to fit and never past
 * 1:1, and it is right about everything except a small screen. Measured on the
 * playground: a phone at 375px fits the sheet at 0.40, which puts body text on
 * screen at 6.4px. Nothing breaks, nothing overflows — the document is simply
 * too small to read, which is the worse failure because it looks deliberate.
 *
 * Below this width the sheet is given up. The document takes the room it has,
 * text at its real 16px and the ruling at its real 28px, and the figures fit
 * themselves to the narrower column the way they already do. What is lost is
 * the A4 proportion and the sense of paper; what is gained is a document
 * somebody can read on the thing they are holding.
 *
 * 680, because at that width a fitted sheet is already down to 0.86 and body
 * text to 13.7px. Below it, fitting costs more than reflowing.
 */
export const REFLOW_BELOW = 680;

/**
 * The @page rules. These are GLOBAL by nature — CSS cannot scope a page — so
 * unlike renderThemeCss() and renderLayoutCss() this is opt-in: a host includes
 * it only when it is the document, not when a document is embedded in a page
 * that prints as something else.
 *
 * It also paints the whole sheet, margins included, as notebook paper when the
 * document is in notebook mode: "print the notebook mode directly and it will
 * look like a printed notebook page" — and notebook paper does not stop 15mm
 * from the edge.
 */
export function renderPageCss(scope = ".jotstak"): string {
  const p = PAGE.portrait;
  const l = PAGE.landscape;
  return `
@page { size: A4 portrait; margin: ${p.marginY}px ${MARGIN_X}px; }
@page ${LANDSCAPE_PAGE} { size: A4 landscape; margin: ${l.marginY}px ${MARGIN_X}px; }
@media print {
  html:has(${scope}[data-mode="notebook"]) {
    background: var(--jot-color-notebook-paper, #fcf8f2);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
}
