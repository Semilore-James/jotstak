// Layout CSS — the ruled-line contract, expressed in stylesheet form.
//
// Everything here exists to keep one promise: a text baseline lands exactly on a
// ruled line, and stays there however long the document gets. That requires three
// things working together:
//
//   1. Every line box is exactly one baseline row tall (28px), so text can't drift.
//   2. The rules are painted at the BASELINE offset inside each row, not at the row
//      edge — text sits ON the line like handwriting, not between lines.
//   3. Anything that isn't a plain line of text (a card, a diagram) occupies a whole
//      number of rows, so the text after it resumes in phase.
//
// Rule 3 is the load-bearing one. A card 93px tall pushes every following line 5px
// off the rule, and the error never corrects itself. Chrome is therefore sized so
// borders + padding total exactly one row, and inner content is always row-multiples.

import { notebookLayout, spacing, typography } from "./tokens.js";
import { LANDSCAPE_PAGE, PAGE } from "./page.js";
import { renderTreeCss } from "./tree-css.js";
import { FONT_METRICS } from "./font-metrics.js";

const ROW = spacing.baselineGrid; // 28

/**
 * Distance from the top of a line box down to the text baseline, for body text.
 *
 *   half-leading = (lineHeight - fontSize * (ascent + descent + lineGap)) / 2
 *   baseline     = half-leading + fontSize * ascent
 *
 * The metrics come from the shipped woff2 (see scripts/extract-font-metrics.mjs),
 * not from a hand-written constant. That distinction is the whole of ADR-002: the
 * first hand-written attempt put Lora's descent at 0.302 when it is 0.274, which
 * moved every baseline a quarter-pixel off its rule.
 */
const LORA = FONT_METRICS.lora;
const BODY_PX = parseFloat(typography.body.lg.size);
const halfLeading = (ROW - BODY_PX * (LORA.ascent + LORA.descent + LORA.lineGap)) / 2;
export const BASELINE_OFFSET = +(halfLeading + BODY_PX * LORA.ascent).toFixed(3);

/**
 * A fallback face that OCCUPIES THE SAME SPACE as Lora.
 *
 * Without this the page renders in Georgia until the webfont arrives, Georgia has
 * different metrics, so the baseline sits somewhere else — and every line visibly
 * jumps off its rule and back the instant Lora loads. The overrides force the
 * fallback to report Lora's ascent and descent, and `size-adjust` matches mean
 * glyph width so the text does not reflow either. The swap becomes invisible.
 */
export function renderFallbackFaceCss(): string {
  const GEORGIA_MEAN_ADVANCE = 0.4944; // a–z mean, Georgia 400
  const sizeAdjust = ((LORA.meanLowercaseAdvance / GEORGIA_MEAN_ADVANCE) * 100).toFixed(2);
  return `@font-face {
  font-family: "Lora Fallback";
  src: local("Georgia"), local("Times New Roman"), local("Liberation Serif");
  ascent-override: ${(LORA.ascent * 100).toFixed(2)}%;
  descent-override: ${(LORA.descent * 100).toFixed(2)}%;
  line-gap-override: ${(LORA.lineGap * 100).toFixed(2)}%;
  size-adjust: ${sizeAdjust}%;
}
`;
}

/** Round a pixel height up to a whole number of baseline rows. */
export function toWholeRows(px: number): number {
  return Math.ceil(px / ROW) * ROW;
}

export function renderLayoutCss(scope = ".jotstak"): string {
  return `
/* ── Page frame ─────────────────────────────────────────────────────── */
${scope} .jot-doc {
  --jot-rule-offset: ${BASELINE_OFFSET}px;
  /* Exactly an A4 page's printable width (ARC-14), so anything that fits on
     screen fits on paper. The number is derived from the paper size in
     page.ts, not typed here. */
  max-width: ${PAGE.portrait.content}px;
  box-sizing: content-box;
  margin: 0 auto;
  padding: ${ROW}px 0;
}
/* One row per block: the block beside its margin notes. Rows are separate
   elements rather than cells of one document-wide grid because print needs
   them to be. A browser honours a named page — the landscape sheet — only on
   a block in normal flow; tested on a grid item, it turned the WHOLE FIRST
   PAGE landscape and isolated nothing. Every row uses identical tracks, so
   the two columns still line up down the page exactly as one grid did. */
${scope} .jot-row {
  display: grid;
  /* The 'fr' unit is written here rather than taken from the custom property,
     and that is not a style choice. The ratio tokens are unitless numbers, so
     the var expanded to 'grid-template-columns: 0.77 0.23' — invalid, silently
     dropped by every browser, and the two columns had been auto-sizing at
     roughly 50/50 ever since instead of 77/23. calc(0.77 * 1fr) is rejected
     too, so the ratio is interpolated from the token at build time.
     minmax(0, …) lets a wide block shrink inside its column rather than force
     the track wider and shove the margin channel off the page. */
  grid-template-columns:
    minmax(0, ${notebookLayout.mainColumnRatio}fr)
    minmax(0, ${notebookLayout.marginChannelRatio}fr);
  column-gap: ${ROW}px;
  align-items: start;
}

/* The body column carries the ruling. Painted at the baseline offset so text
   sits ON the rule; the period is one row so the phase can never slip. */
${scope}[data-mode="notebook"] .jot-body {
  background-image: repeating-linear-gradient(
    to bottom,
    var(--jot-rule) 0,
    var(--jot-rule) 1px,
    transparent 1px,
    transparent ${ROW}px
  );
  background-position: 0 calc(var(--jot-rule-offset) - 1px);
}
${scope}[data-mode="doc"] .jot-body { background-image: none; }

/* ── Doc mode ───────────────────────────────────────────────────────── */
/* Doc mode is not "notebook with the rules switched off" — that reads as a
   generic web page and makes writing .jot look pointless. It is the same
   document in an editorial register: a white sheet on a grey backing, hairline
   rules instead of filled cards, quieter labels. The STRUCTURE still shows —
   a card is still a card, a metric is still prominent — because that structure
   is what the author wrote, and it is the reason to use the tool at all.
   The grid is unchanged; only the surface treatment differs. */
${scope}[data-mode="doc"] {
  background: var(--jot-color-doc-viewport);
  padding: ${ROW}px 0;
}
${scope}[data-mode="doc"] .jot-doc {
  background: var(--jot-color-doc-sheet);
  border: 1px solid var(--jot-color-doc-sheet-border);
  box-shadow: var(--jot-shape-elevation-doc-sheet);
  padding: ${ROW * 2}px ${ROW * 2}px;
  border-radius: 2px;
}
/* Cards lose their fill and keep a single hairline: on a white sheet a filled
   panel reads as a UI widget, not as part of a document. */
${scope}[data-mode="doc"] .jot-card {
  background: none;
  border: 0;
  border-top: 1px solid var(--jot-color-doc-sheet-border);
  border-radius: 0;
  /* One border plus 13 + 14 padding is exactly one row. Redesigning the chrome
     for doc mode without redoing this arithmetic is what broke it the first
     time — every surface treatment has to satisfy the same row contract. */
  padding: 13px 0 14px;
}
${scope}[data-mode="doc"] .jot-card[data-alert="true"] {
  border-top-color: var(--jot-color-accent-terracotta);
}
${scope}[data-mode="doc"] .jot-card-kicker {
  color: var(--jot-color-doc-ink-muted);
}
/* Written with the attribute selector so it outranks \`.jot-badge[data-alert]\`,
   which otherwise kept its pink pill in doc mode and collided with the dash. */
${scope}[data-mode="doc"] .jot-badge,
${scope}[data-mode="doc"] .jot-badge[data-alert="true"] {
  background: none;
  padding: 0;
  margin-left: ${ROW / 4}px;
  color: var(--jot-color-doc-ink-muted);
}
${scope}[data-mode="doc"] .jot-badge[data-alert="true"] { color: var(--jot-color-accent-terracotta); }
${scope}[data-mode="doc"] .jot-callout,
${scope}[data-mode="doc"] .jot-body pre {
  background: none;
  border: 0;
  border-left: 2px solid var(--jot-color-doc-sheet-border);
  border-radius: 0;
  /* No horizontal borders here, so the padding alone carries the row. */
  padding: ${ROW / 2}px 0 ${ROW / 2}px ${ROW - 2}px;
}
${scope}[data-mode="doc"] .jot-body table th { color: var(--jot-color-doc-ink-muted); }
${scope}[data-mode="doc"] .jot-chip-key { color: var(--jot-color-doc-ink-muted); }
${scope}[data-mode="doc"] .jot-nested .jot-card { border-top-style: dotted; }

/* Margin notes become true sidenotes: still in the margin, still the author's
   aside, but set in the body face rather than handwriting, because handwriting
   on a printed sheet reads as a mistake. */
${scope}[data-mode="doc"] .jot-note::before { display: none; }
${scope}[data-mode="doc"] .jot-note {
  padding-left: 0;
  border-left: 1px solid var(--jot-color-doc-sheet-border);
  padding-inline-start: ${ROW / 2}px;
  color: var(--jot-color-doc-ink-muted);
}

${scope} .jot-body { grid-column: 1; min-width: 0; }
${scope} .jot-aside { grid-column: 2; min-width: 0; }

/* Deterministic vertical rhythm.
   \`flow-root\` stops child margins collapsing out of the cell: without it a
   block's spacing depends on what happens to sit next to it, gaps come out as
   0/28/36/56px instead of a consistent row, and the phase drifts permanently
   the first time a non-multiple appears. Containing the margins makes every
   cell's height = content + its own margins, both of which are row multiples,
   so the phase cannot slip no matter how long the document is. */
${scope} .jot-body { display: flow-root; }
${scope} .jot-body > * { margin-top: 0; margin-bottom: ${ROW}px; }
/* The margin channel needs the same discipline. A grid row is as tall as its
   TALLEST cell, so a note left on browser-default paragraph margins sets the row
   height to a non-multiple and pushes everything below it off the ruling — even
   when every block in the main column is perfectly sized. */
${scope} .jot-aside { display: flow-root; }
${scope} .jot-aside > * { margin-top: 0; margin-bottom: ${ROW}px; }

/* Contextual spacing. A uniform gap after every block reads as double-spacing:
   a run of quotes gets a blank line between each, and a horizontal rule costs
   three rows — the previous block's margin, its own row, and its own margin.
   These exceptions stay whole-row, so the phase is unaffected. */
${scope} .jot-body[data-kind="divider"] > * { margin-bottom: 0; }
${scope} .jot-row:has(> .jot-body[data-kind="quote"]):has(> .jot-aside:empty) + .jot-row > .jot-body[data-kind="quote"] > *,
${scope} .jot-row:has(> .jot-body[data-kind="list"]):has(> .jot-aside:empty) + .jot-row > .jot-body[data-kind="list"] > *,
${scope} .jot-row:has(> .jot-body[data-primitive="sticky"]):has(> .jot-aside:empty) + .jot-row > .jot-body[data-primitive="sticky"] > * { margin-top: 0; }
${scope} .jot-row:has(> .jot-aside:empty):has(+ .jot-row > .jot-body[data-kind="quote"]) > .jot-body[data-kind="quote"] > * { margin-bottom: 0; }
/* @meta sits tight under the title it describes. */
${scope} .jot-body[data-primitive="meta"] > * { margin-bottom: ${ROW}px; }
/* A trailing margin inside a container would escape the row maths. */
${scope} .jot-quote > :last-child,
${scope} .jot-card > :last-child,
${scope} .jot-body li > :last-child { margin-bottom: 0; }
/* Clearance around a drawn block is ONE ROW BELOW, not half a row on each side.
   Half-and-half was designed for inline flow; every block is now its own grid
   cell, so the gap between two blocks is already the sum of one block's bottom
   margin and nothing else. It also survives the first-child margin reset, which
   zeroes margin-top and used to leave the first card half a row short. */
${scope} .jot-body > .jot-card,
${scope} .jot-body > .jot-columns,
${scope} .jot-body > .jot-callout { margin: 0 0 ${ROW}px; }

/* ── Text on the grid ───────────────────────────────────────────────── */
/* Every one of these is a whole number of rows. The token line-heights are
   deliberately overridden: grid discipline outranks the type scale, because a
   36px line-height in a 28px grid desynchronises the whole page. */
${scope} .jot-body p,
${scope} .jot-body li,
${scope} .jot-body blockquote p {
  margin: 0;
  line-height: ${ROW}px;
  font-size: ${typography.body.lg.size};
}


${scope} .jot-h1,
${scope} .jot-h2,
${scope} .jot-h3 {
  font-family: var(--jot-font-heading);
  color: var(--jot-ink);
  margin-top: ${ROW}px;
  font-weight: 600;
}
${scope} .jot-h1 { font-size: ${typography.headline.xl.size}; line-height: ${ROW * 2}px; letter-spacing: ${typography.headline.xl.letterSpacing}; }
${scope} .jot-h2 { font-size: ${typography.headline.lg.size}; line-height: ${ROW * 2}px; letter-spacing: ${typography.headline.lg.letterSpacing}; }
${scope} .jot-h3 { font-size: ${typography.headline.md.size}; line-height: ${ROW}px; letter-spacing: ${typography.headline.md.letterSpacing}; }
${scope} .jot-doc > .jot-row:first-child > .jot-body > :first-child { margin-top: 0; }

${scope} .jot-body strong { font-weight: 600; }
/* \`==highlight==\`. Like inline code, its box is capped below the line strut so
   a highlighted phrase cannot stretch the row it sits in. */
${scope} .jot-body mark {
  background: linear-gradient(transparent 12%, var(--jot-color-accent-terracotta-pale) 12%, var(--jot-color-accent-terracotta-pale) 88%, transparent 88%);
  color: inherit;
  padding: 0 2px;
  line-height: 20px;
}
${scope}[data-mode="doc"] .jot-body mark {
  background: var(--jot-color-accent-terracotta-pale);
}
${scope} .jot-body em { font-style: italic; }
${scope} .jot-body a { color: var(--jot-accent); text-underline-offset: 3px; }
${scope} .jot-body code {
  font-family: var(--jot-font-mono);
  font-size: ${typography.code.md.size};
  background: var(--jot-surface-elevated);
  border-radius: var(--jot-shape-border-radius-sm);
  padding: 0 4px;
  /* An inline box taller than the line's strut GROWS the line. The mono face at
     ${typography.code.md.size} inheriting a ${ROW}px line-height did exactly that: every line
     containing inline code became ${ROW + 2}px, so a paragraph mentioning a filename
     drifted 2px per line. Capping it below the strut keeps the row at ${ROW}px
     while leaving the highlight tall enough to read as a token. */
  line-height: 20px;
}

/* ── Fenced code ────────────────────────────────────────────────────── */
/* A drawn block like any other: it clears the ruling and its chrome totals one
   row. Code lines get a full ${ROW}px each rather than the token's 20px, because
   a 20px line inside a ${ROW}px grid desynchronises everything below it. The
   size is nudged up to suit the looser leading. */
${scope} .jot-body pre {
  background: var(--jot-surface-elevated);
  border: 1px solid var(--jot-rule);
  border-radius: var(--jot-shape-border-radius-base);
  padding: 13px 18px;
  /* Wrap rather than scroll. \`overflow-x: auto\` adds a ~15px horizontal
     scrollbar when a line is long, which is not a row multiple and knocks
     everything below it off the ruling. Wrapping keeps every line ${ROW}px. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
${scope} .jot-body pre code {
  background: none;
  border-radius: 0;
  padding: 0;
  font-size: 15px;
  line-height: ${ROW}px;
  display: block;
}

/* ── Markdown tables ────────────────────────────────────────────────── */
/* \`.jot\` has no pipe-table syntax of its own, but a pasted .md file may well
   contain one, and the superset promise covers it. Collapsed borders and zero
   vertical padding keep each row a whole number of ${ROW}px lines; the header
   underline is an inset shadow rather than a border so it costs no height. */
${scope} .jot-body table {
  border-collapse: collapse;
  width: 100%;
  font-size: ${typography.body.lg.size};
}
${scope} .jot-body th,
${scope} .jot-body td {
  padding: 0 ${ROW / 2}px 0 0;
  line-height: ${ROW}px;
  vertical-align: top;
  text-align: left;
  border: 0;
}
${scope} .jot-body thead th {
  font-family: var(--jot-font-label);
  font-size: ${typography.label.md.size};
  font-weight: 600;
  letter-spacing: ${typography.label.md.letterSpacing};
  text-transform: uppercase;
  color: var(--jot-ink-muted);
  box-shadow: inset 0 -1px 0 var(--jot-rule);
}

/* ── Lists ──────────────────────────────────────────────────────────── */
${scope} .jot-body ul,
${scope} .jot-body ol { padding-left: ${ROW}px; }
${scope} .jot-body ul ul,
${scope} .jot-body ol ol,
${scope} .jot-body ul ol,
${scope} .jot-body ol ul { margin-bottom: 0; }
${scope} .jot-body li::marker { color: var(--jot-accent); }

/* ── Quote ──────────────────────────────────────────────────────────── */
${scope} .jot-quote {
  padding-left: ${ROW - 1}px;
  border-left: 1px solid var(--jot-accent);
  font-style: italic;
  color: var(--jot-ink-muted);
}
${scope} .jot-quote cite {
  display: block;
  font-family: var(--jot-font-label);
  font-size: ${typography.label.md.size};
  font-style: normal;
  line-height: ${ROW}px;
  color: var(--jot-ink-muted);
}

/* ── Divider ────────────────────────────────────────────────────────── */
/* A full-width line drawn ON a ruled line is invisible by construction — it
   just makes one rule slightly darker. A section break has to read as
   deliberate, so it is a SHORT CENTRED mark instead: clearly not part of the
   ruling, while still sitting on the grid. The schema offers three styles and
   all three are implemented rather than falling through to the same line. */
${scope} .jot-divider {
  border: 0;
  height: ${ROW}px;
  background: none;
  position: relative;
}
${scope} .jot-divider::after {
  content: "";
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: calc(var(--jot-rule-offset) - 1px);
  width: 18%;
  min-width: 84px;
  border-top: 2px solid var(--jot-accent);
}
${scope} .jot-divider[data-style="dots"]::after {
  border-top: 0;
  height: 3px;
  width: 64px;
  min-width: 0;
  top: calc(var(--jot-rule-offset) - 3px);
  background-image: radial-gradient(circle, var(--jot-accent) 2px, transparent 2.1px);
  background-size: 18px 4px;
  background-repeat: repeat-x;
}
${scope} .jot-divider[data-style="wave"]::after {
  border-top: 0;
  height: 8px;
  width: 96px;
  min-width: 0;
  top: calc(var(--jot-rule-offset) - 5px);
  background-image:
    radial-gradient(circle at 50% 100%, transparent 5px, var(--jot-accent) 5px, var(--jot-accent) 6.4px, transparent 6.5px),
    radial-gradient(circle at 50% 0%,   transparent 5px, var(--jot-accent) 5px, var(--jot-accent) 6.4px, transparent 6.5px);
  background-size: 24px 8px, 24px 8px;
  background-position: 0 0, 12px 0;
  background-repeat: repeat-x;
}

/* ── Drawn blocks ───────────────────────────────────────────────────── */
/* Rule 2: opaque background masks the ruling so the card breathes.
   Rule 3: 1px border + 13px padding, top and bottom, totals exactly ${ROW}px of
   chrome. Inner content is row-multiples, so the card's height is always a whole
   number of rows and the text after it resumes in phase.
   Rule 4: ${ROW / 2}px margin top and bottom is the half-row clearance. */
${scope} .jot-card {
  background: var(--jot-surface-elevated);
  border: 1px solid var(--jot-rule);
  border-radius: var(--jot-shape-border-radius-base);
  box-shadow: var(--jot-card-shadow);
  padding: 13px 18px;
  margin: 0 0 ${ROW}px;
}
${scope} .jot-card-title {
  font-family: var(--jot-font-heading);
  font-size: ${typography.headline.sm.size};
  font-weight: 600;
  line-height: ${ROW}px;
  margin: 0;
  color: var(--jot-ink);
}
${scope} .jot-card-kicker {
  font-family: var(--jot-font-label);
  font-size: ${typography.label.sm.size};
  font-weight: 600;
  letter-spacing: ${typography.label.sm.letterSpacing};
  text-transform: uppercase;
  line-height: ${ROW}px;
  color: var(--jot-accent);
  margin: 0;
}
${scope} .jot-fields { margin: 0; }
${scope} .jot-field {
  display: grid;
  grid-template-columns: 7rem 1fr;
  column-gap: ${ROW / 2}px;
  line-height: ${ROW}px;
}
${scope} .jot-field-key {
  font-family: var(--jot-font-label);
  font-size: ${typography.label.md.size};
  font-weight: 600;
  letter-spacing: ${typography.label.md.letterSpacing};
  text-transform: uppercase;
  color: var(--jot-ink-muted);
}
${scope} .jot-field-value { font-size: ${typography.body.lg.size}; }
${scope} .jot-field-list { margin: 0; padding-left: ${ROW}px; }
${scope} .jot-field-list li { line-height: ${ROW}px; }

/* Badge beside the kicker: the card's status at a glance. Inline-block with a
   capped line-height so it cannot grow the row it sits in. */
${scope} .jot-badge {
  display: inline-block;
  margin-left: ${ROW / 4}px;
  padding: 0 7px;
  border-radius: var(--jot-shape-border-radius-full);
  background: var(--jot-color-accent-terracotta-pale);
  color: var(--jot-color-accent-sepia);
  font-family: var(--jot-font-label);
  font-size: ${typography.label.sm.size};
  font-weight: 600;
  letter-spacing: ${typography.label.sm.letterSpacing};
  text-transform: uppercase;
  line-height: 18px;
  vertical-align: baseline;
}
${scope} .jot-badge[data-alert="true"] { background: #f7d9d4; color: #8c1d18; }
${scope} .jot-card[data-alert="true"] { border-color: var(--jot-color-accent-terracotta); }

/* @metric leads with the number. */
/* A ${typography.headline.lg.size} number does not fit a ${ROW}px line box — Lora's content height is
   about 1.28em — so the figure takes two rows rather than overflowing by 6px. */
/* Two rows for the figure, as a plain line box rather than flex.
   Flex baseline alignment stretched the row: a ${typography.headline.lg.size} number's inline ascent
   exceeds the strut's, and the line grows to fit it. Capping the number's own
   line-height keeps its inline box inside the strut, so the row stays exactly
   two. Scoped under .jot-body to out-specify the generic \`.jot-body p\` rule. */
${scope} .jot-body p.jot-metric { line-height: ${ROW * 2}px; }
${scope} .jot-body .jot-metric > * + * { margin-left: ${ROW / 2}px; }
${scope} .jot-body .jot-metric-value {
  font-family: var(--jot-font-heading);
  font-size: ${typography.headline.lg.size};
  font-weight: 600;
  /* line-height 1 keeps this inline box smaller than the surrounding strut,
     so a large figure cannot stretch the line it sits on. */
  line-height: 1;
}
${scope} .jot-body .jot-metric-target,
${scope} .jot-body .jot-trend {
  font-family: var(--jot-font-label);
  font-size: ${typography.label.md.size};
  color: var(--jot-ink-muted);
  line-height: 1;
}
${scope} .jot-trend[data-trend="up"] { color: var(--jot-color-accent-sage); }
${scope} .jot-trend[data-trend="down"] { color: var(--jot-color-accent-terracotta); }

/* ── @columns ───────────────────────────────────────────────────────── */
/* One mechanic for what used to be two primitives: a two-page spread and a row
   of feature pillars are both "regions side by side". Gaps are whole rows so a
   column that wraps on a narrow screen cannot break the ruling. */
${scope} .jot-columns { display: flex; flex-wrap: wrap; gap: 0 ${ROW}px; }
/* A small basis so columns actually sit side by side in a narrow preview pane;
   they still wrap on a phone, where stacking is the right answer. */
${scope} .jot-col { flex: 1 1 150px; min-width: 0; }
${scope} .jot-col > :last-child { margin-bottom: 0; }
${scope} .jot-col-heading {
  font-family: var(--jot-font-label);
  font-size: ${typography.label.md.size};
  font-weight: 600;
  letter-spacing: ${typography.label.md.letterSpacing};
  text-transform: uppercase;
  color: var(--jot-ink-muted);
  line-height: ${ROW}px;
  margin: 0;
}

/* ── Panel accents ──────────────────────────────────────────────────── */
/* The accent is what makes a panel read as what it IS before the label is
   read. Presets set it; @panel takes it directly. */
${scope} .jot-card[data-accent="alert"]    { border-left: 3px solid var(--jot-color-accent-terracotta); }
${scope} .jot-card[data-accent="positive"] { border-left: 3px solid var(--jot-color-accent-sage); }
${scope} .jot-card[data-accent="info"]     { border-left: 3px solid var(--jot-color-accent-slate-blue); }
${scope} .jot-card[data-accent="quiet"] {
  background: none;
  box-shadow: none;
  border-style: dashed;
}

${renderTreeCss(scope)}
/* ── Nested blocks ──────────────────────────────────────────────────── */
/* A block inside a block. Chrome is deliberately lighter at depth: a card
   inside a card with the same border and shadow reads as clutter. The nested
   container adds a half-row above so the child is visibly inside its parent,
   and the child's own half-row margin completes the row. */
/* Same discipline as a body cell, for the same reason. \`.jot-body > *\` only
   normalises DIRECT children, so a nested blockquote kept its browser-default
   16px margin and pushed its parent card 2px off a whole row. flow-root also
   stops the children's margins collapsing out of the container. */
${scope} .jot-nested { display: flow-root; margin-top: ${ROW}px; }
${scope} .jot-nested > * { margin-top: 0; margin-bottom: ${ROW}px; }
${scope} .jot-nested > :last-child { margin-bottom: 0; }
${scope} .jot-nested .jot-card {
  box-shadow: none;
  background: var(--jot-surface);
}
${scope} .jot-nested .jot-card-kicker { font-size: ${typography.label.sm.size}; }

/* ── Callouts: the flavor is the shortcode, so it drives the colour ─── */
${scope} .jot-callout {
  padding: 13px 18px;
  border-radius: var(--jot-shape-border-radius-base);
  border: 1px solid var(--jot-rule);
  border-left-width: 3px;
  background: var(--jot-surface-elevated);
}
${scope} .jot-callout-label {
  font-family: var(--jot-font-label);
  font-size: ${typography.label.sm.size};
  font-weight: 600;
  letter-spacing: ${typography.label.sm.letterSpacing};
  text-transform: uppercase;
  line-height: ${ROW}px;
  margin: 0;
}
${scope} .jot-callout[data-flavor="info"]     { border-left-color: var(--jot-color-accent-slate-blue); }
${scope} .jot-callout[data-flavor="info"] .jot-callout-label { color: var(--jot-color-accent-slate-blue); }
${scope} .jot-callout[data-flavor="tip"]      { border-left-color: var(--jot-color-accent-sage); }
${scope} .jot-callout[data-flavor="tip"] .jot-callout-label { color: var(--jot-color-accent-sage); }
${scope} .jot-callout[data-flavor="warn"]     { border-left-color: var(--jot-color-accent-terracotta); }
${scope} .jot-callout[data-flavor="warn"] .jot-callout-label { color: var(--jot-color-accent-terracotta); }
${scope} .jot-callout[data-flavor="question"] { border-left-color: var(--jot-color-accent-sepia); }
${scope} .jot-callout[data-flavor="question"] .jot-callout-label { color: var(--jot-color-accent-sepia); }

/* ── @meta: a chip row of document metadata ─────────────────────────── */
/* Row-gap must be 0: when the chips wrap, any gap is added BETWEEN the wrapped
   lines and is not a row multiple, so the whole document below slips off the
   ruling. The ${ROW}px line-height already separates the lines. */
${scope} .jot-meta { display: flex; flex-wrap: wrap; gap: 0 ${ROW / 2}px; line-height: ${ROW}px; }
${scope} .jot-chip {
  font-family: var(--jot-font-label);
  font-size: ${typography.label.md.size};
  color: var(--jot-ink);
  line-height: ${ROW}px;
}
${scope} .jot-chip-key {
  color: var(--jot-ink-muted);
  text-transform: uppercase;
  letter-spacing: ${typography.label.sm.letterSpacing};
  font-size: ${typography.label.sm.size};
  margin-right: 6px;
}

/* ── Margin notes ───────────────────────────────────────────────────── */
/* Placed in the grid's second column on the same row as their anchor, so
   vertical alignment falls out of the layout rather than being computed. */
${scope} .jot-note {
  font-family: var(--jot-font-margin);
  font-size: ${typography.margin.md.size};
  line-height: ${ROW}px;
  color: var(--jot-color-accent-sepia);
  position: relative;
  padding-left: ${ROW / 2}px;
}
${scope} .jot-note::before {
  content: "";
  position: absolute;
  left: 0;
  top: calc(var(--jot-rule-offset) - ${notebookTickRadius()}px);
  width: ${notebookTickRadius() * 2}px;
  height: ${notebookTickRadius() * 2}px;
  border-radius: 50%;
  background: var(--jot-layout-margin-tick-color, var(--jot-accent));
}
${scope}[data-mode="doc"] .jot-note {
  font-family: var(--jot-font-body);
  font-size: ${typography.body.md.size};
  font-style: italic;
}

/* ── Diagnostics surfaced in the output ─────────────────────────────── */
${scope} .jot-error {
  font-family: var(--jot-font-mono);
  font-size: ${typography.code.md.size};
  line-height: ${ROW}px;
  color: #b3261e;
  background: #fdecea;
  border-left: 2px solid #b3261e;
  padding: 0 ${ROW / 2}px;
}

/* ── Print: real A4 pages (ARC-14) ──────────────────────────────────── */
/* Page size and margins live in renderPageCss() (page.ts), because @page cannot
   be scoped. What follows is scoped like everything else. */
@media print {
  /* Browsers drop backgrounds when printing unless told otherwise. Here the
     paper, the ruling and the card fills ARE the document. */
  ${scope} { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* The page is the frame now; its margins come from @page. */
  ${scope} .jot-doc { max-width: none; margin: 0; padding: 0; }
  ${scope}[data-mode="doc"] { background: none; padding: 0; }
  ${scope}[data-mode="doc"] .jot-doc { border: 0; box-shadow: none; border-radius: 0; padding: 0; }
  /* A block moves to the next page whole rather than being cut in two… */
  ${scope} .jot-row:has(> .jot-body[data-kind="block"]) { break-inside: avoid; }
  /* …unless it is taller than a page, which the renderer knows and marks. */
  ${scope} .jot-row:has(.jot-figure[data-tall]) { break-inside: auto; }
  /* A heading never ends a page. */
  ${scope} .jot-row:has(> .jot-body[data-kind="heading"]) { break-after: avoid; }
  /* A figure too wide for portrait gets a landscape page of its own. */
  ${scope} .jot-row:has(.jot-figure[data-page="landscape"]) { page: ${LANDSCAPE_PAGE}; }
}

/* ── Responsive: below the two-column threshold the margin channel folds
   underneath its anchor rather than being dropped. ─────────────────── */
@media (max-width: 720px) {
  ${scope} .jot-row { grid-template-columns: 1fr; }
  ${scope} .jot-body, ${scope} .jot-aside { grid-column: 1; }
  ${scope} .jot-note { padding-left: ${ROW}px; margin-bottom: ${ROW}px; }
}
`.trimStart();
}

function notebookTickRadius(): number {
  return 3;
}
