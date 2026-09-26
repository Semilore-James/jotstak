// The stylesheet for @cover, generated from the same constants the renderer
// counts rows with (cover.ts), so the two cannot drift.
//
// Three looks that differ in WEIGHT, not in kind. All three are a title, an
// optional subtitle, and a band across the page; what changes is how loudly
// the band announces itself:
//
//   minimal   one hairline underneath. For a section you are marking, not
//             introducing.
//   default   rules above and below, air inside them, the title at h1 size.
//   bold      the rules become a tinted field the type sits in.
//
// Air is drawn with padding rather than margin, so the band's own height is
// what --jot-cover-rows says it is. A margin would collapse against the block
// above and the row count would be right in the stylesheet and wrong on the
// page — the drift this file exists to prevent.

import { COVER } from "./cover.js";
import { typography } from "./tokens.js";

const R = COVER.row;

export function renderCoverCss(scope: string): string {
  const u = (n: number): string => `calc(${n} * var(--u, 1px))`;

  return `
/* ── @cover: a band across the page ─────────────────────────────────── */
/* Spans the margin channel. That is the whole difference between a cover and
   a large heading: a heading belongs to the text column, an opener sits
   across the page. */
${scope} .jot-body:has(> .jot-cover[data-width="full"]) { grid-column: 1 / -1; }

${scope} .jot-cover {
  /* The height the renderer counted, in rows. Not min-height: a band that
     grows past its own count puts every ruled line below it out of phase. */
  height: ${u(R)};
  height: calc(var(--jot-cover-rows) * ${u(R)});
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Two classes, not one. The title is a <p>, so the prose rule
   .jotstak .jot-body p reaches it at (0,2,1); a single extra class is (0,2,0),
   which LOSES, silently, and the title renders at 16px while this file says
   36. ENG-18, for the fourth block in a row. */
${scope} .jot-cover .jot-cover-title {
  font-family: var(--jot-font-heading);
  color: var(--jot-ink);
  margin: 0;
  font-weight: 600;
  font-size: ${typography.headline.xl.size};
  line-height: ${u(R * 2)};
  letter-spacing: ${typography.headline.xl.letterSpacing};
}

${scope} .jot-cover .jot-cover-subtitle {
  font-family: var(--jot-font-label);
  color: var(--jot-ink-muted);
  margin: 0;
  font-size: ${typography.body.lg.size};
  line-height: ${u(R)};
}

/* ── default: rules above and below ──────────────────────────────────── */
/* var(--jot-accent), not var(--jot-rule). The ruling is TRANSPARENT in doc
   mode, and a cover's rules are structure rather than ruling: drawing them in
   the ruling colour would have made the whole band vanish the moment somebody
   switched to doc. Terracotta is what the divider and the quote already use
   for a mark that is meant to be seen. */
${scope} .jot-cover[data-style="default"] {
  border-top: 1px solid var(--jot-accent);
  border-bottom: 1px solid var(--jot-accent);
  padding: ${u(COVER.airTop.default * R - 1)} 0 ${u(COVER.airBottom.default * R - 1)};
}

/* ── minimal: one hairline underneath, and the title comes down a size ── */
/* At h1 size a "minimal" cover is louder than the h1 it sits above, which is
   the wrong way round. */
${scope} .jot-cover[data-style="minimal"] {
  border-bottom: 1px solid var(--jot-accent);
  padding: 0 0 ${u(COVER.airBottom.minimal * R - 1)};
}
${scope} .jot-cover[data-style="minimal"] .jot-cover-title {
  font-size: ${typography.headline.md.size};
  line-height: ${u(R)};
  letter-spacing: ${typography.headline.md.letterSpacing};
}

/* ── bold: the rules become a field ──────────────────────────────────── */
/* Tinted rather than reversed out. Reversed white-on-ink is a print job the
   cream paper is not doing — a solid black band on a notebook page reads as a
   redaction, not a cover. */
${scope} .jot-cover[data-style="bold"] {
  background: var(--jot-color-accent-terracotta-pale);
  border-left: ${u(4)} solid var(--jot-accent);
  padding: ${u(COVER.airTop.bold * R)} ${u(R / 2)} ${u(COVER.airBottom.bold * R)};
}

/* A drawn block clears the ruling across its whole row, like every other one. */
[data-mode="notebook"] ${scope} .jot-body:has(> .jot-cover) { background-image: none; }

`;
}

/**
 * The print rules, handed back separately so they can join the ONE print block
 * the stylesheet has.
 *
 * Emitting a second `@media print` from here worked and still broke a test,
 * which is the useful part: the test reads "the" print block out of the sheet
 * by finding the first one, and a second one further up meant it was reading a
 * different block than the one it was written about. table-css.ts already
 * exported its print rules this way; this is that pattern, not a new one.
 */
export function renderCoverPrintCss(scope: string): string {
  return `
  /* Never leave a cover stranded at the foot of a page with its section
     overleaf. That is the one thing a cover must not do. */
  ${scope} .jot-cover { break-after: avoid; break-inside: avoid; }`;
}
