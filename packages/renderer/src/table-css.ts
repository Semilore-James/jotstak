// The stylesheet for @table.
//
// Deliberately thin, because the house table style already exists: the rules
// for a pasted Markdown table in layout.ts set the type, put every row on a
// 28px line and underline the header with an inset shadow so it costs no
// height. An @table is the same object, so it inherits all of that and this
// file adds only what @table can do that a pipe table cannot — a caption, a
// measured column layout, alignment, and the drawn frame.
//
// Nothing here scales. A table's content is text, and text stays the size of
// the prose around it (see the note at the top of table.ts).

import { TABLE } from "./table.js";

export function renderTableCss(scope: string): string {
  const R = TABLE.row;
  const line = "var(--jot-table-line)";
  return `
/* ── @table ─────────────────────────────────────────────────────────── */
${scope} .jot-table-wrap {
  --jot-table-line: var(--jot-color-accent-slate-blue);
}
/* A table with nothing in the margin beside it already spans both tracks, the
   same as any other free block (UX-37), and a table with a note beside it
   narrows for it. The exception is a width the AUTHOR pinned: that outranks
   the note, because they asked. */
${scope} .jot-body:has(> .jot-table-wrap[data-width="full"][data-pinned]) { grid-column: 1 / -1; }

${scope} .jot-table-caption {
  margin: 0;
  font-family: var(--jot-font-label);
  font-size: ${TABLE.headSize}px;
  line-height: ${R}px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: ${TABLE.headTracking}em;
  color: var(--jot-ink);
}

/* A short header is held on one line, and that is what makes a squeezed table
   divide itself up correctly: automatic table layout gives every column at
   least its minimum content width, so an unwrappable header becomes the floor
   its column cannot be pushed below, and the columns of prose — which were
   going to wrap anyway — absorb the shortfall. Without it, CONFIDENCE over a
   column of "0.9" broke into CONFIDE / NCE.

   A header past ${TABLE.headWrapAt} characters is a phrase, so it wraps — between
   words, never inside one. A cell may break inside a word, because one long
   URL should not push a table off the page. */
${scope} .jot-table-wrap .jot-table { table-layout: auto; }
${scope} .jot-table th { white-space: nowrap; }
${scope} .jot-table th[data-wrap] { white-space: normal; }
${scope} .jot-table td { overflow-wrap: break-word; }

/* Figures in a right-aligned column line up under each other. */
${scope} .jot-table td[style*="right"] { font-variant-numeric: tabular-nums; }

/* sketch: the table someone drew on the page, rather than the one the page's
   own ruling gave them. Every line is an inset shadow, never a border: a
   border adds a pixel to the row it is on and a table of five rows would hand
   the ruling back five pixels out of phase. The shadows cost no height, so
   every row stays exactly ${R}px and the paper stays in step. */
${scope} .jot-table[data-style="sketch"] th,
${scope} .jot-table[data-style="sketch"] td {
  padding: 0 ${TABLE.sketchPadX}px;
  box-shadow: inset -1px 0 0 ${line}, inset 0 -1px 0 ${line};
}
${scope} .jot-table[data-style="sketch"] tr > :first-child {
  box-shadow: inset 1px 0 0 ${line}, inset -1px 0 0 ${line}, inset 0 -1px 0 ${line};
}
${scope} .jot-table[data-style="sketch"] thead th {
  box-shadow: inset -1px 0 0 ${line}, inset 0 1px 0 ${line}, inset 0 -1px 0 ${line};
  color: var(--jot-ink);
}
${scope} .jot-table[data-style="sketch"] thead tr > :first-child {
  box-shadow: inset 1px 0 0 ${line}, inset -1px 0 0 ${line}, inset 0 1px 0 ${line}, inset 0 -1px 0 ${line};
}
/* A drawn table brings its own grid, so the paper's rules go quiet behind it —
   two sets of horizontal lines at the same pitch read as a printing fault. */
${scope}[data-mode="notebook"] .jot-body:has(> .jot-table-wrap[data-drawn]) { background-image: none; }
${scope}[data-mode="doc"] .jot-table-wrap { --jot-table-line: var(--jot-color-doc-sheet-border); }
`;
}

/**
 * The print rules, handed back separately so layout.ts can put them inside the
 * one \`@media print\` block the stylesheet has. A second print block would
 * work, but the document's print behaviour is worth being able to read in one
 * place.
 */
export function renderTablePrintCss(scope: string): string {
  return `  /* A table is the one block that may be TALLER than a page and still has
     to be cut, because the alternative is a mostly-empty sheet. So it breaks
     between rows, never through one, and the header comes with it. */
  ${scope} .jot-row:has(.jot-table) { break-inside: auto; }
  ${scope} .jot-table thead { display: table-header-group; }
  ${scope} .jot-table tr { break-inside: avoid; }`;
}
