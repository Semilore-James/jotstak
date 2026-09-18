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

import { spacing, typography } from "./tokens.js";

const ROW = spacing.baselineGrid; // 28

/**
 * Distance from the top of a line box down to the text baseline, for body text.
 *
 *   half-leading   = (lineHeight - fontSize * (ascent + descent)) / 2
 *   baseline       = half-leading + fontSize * ascent
 *
 * Lora's ascent/descent are 1.006 / 0.302 em. At 16px in a 28px row that puts the
 * baseline at 19.63px. ADR-002 calls for reading these from the font file at build
 * time rather than hard-coding them; until that tooling exists this is the measured
 * value for the shipped face, exposed as a variable so a host can correct it.
 */
const LORA_ASCENT = 1.006;
const LORA_DESCENT = 0.302;
const BODY_PX = parseFloat(typography.body.lg.size);
const halfLeading = (ROW - BODY_PX * (LORA_ASCENT + LORA_DESCENT)) / 2;
export const BASELINE_OFFSET = +(halfLeading + BODY_PX * LORA_ASCENT).toFixed(2);

/** Round a pixel height up to a whole number of baseline rows. */
export function toWholeRows(px: number): number {
  return Math.ceil(px / ROW) * ROW;
}

export function renderLayoutCss(scope = ".jotstak"): string {
  return `
/* ── Page frame ─────────────────────────────────────────────────────── */
${scope} .jot-doc {
  --jot-rule-offset: ${BASELINE_OFFSET}px;
  max-width: var(--jot-layout-max-content-width);
  margin: 0 auto;
  padding: ${ROW}px 0;
  display: grid;
  grid-template-columns: var(--jot-layout-main-column-ratio, 0.77fr) var(--jot-layout-margin-channel-ratio, 0.23fr);
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
/* A trailing margin inside a container would escape the row maths. */
${scope} .jot-quote > :last-child,
${scope} .jot-card > :last-child,
${scope} .jot-body li > :last-child { margin-bottom: 0; }

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
${scope} .jot-doc > .jot-body:first-child > :first-child { margin-top: 0; }

${scope} .jot-body strong { font-weight: 600; }
${scope} .jot-body em { font-style: italic; }
${scope} .jot-body a { color: var(--jot-accent); text-underline-offset: 3px; }
${scope} .jot-body code {
  font-family: var(--jot-font-mono);
  font-size: ${typography.code.md.size};
  background: var(--jot-surface-elevated);
  border-radius: var(--jot-shape-border-radius-sm);
  padding: 0 4px;
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

/* ── Divider: sits ON a rule, occupying exactly one row ─────────────── */
${scope} .jot-divider {
  border: 0;
  height: ${ROW}px;
  background: none;
  position: relative;
}
${scope} .jot-divider::after {
  content: "";
  position: absolute;
  left: 0; right: 0;
  top: calc(var(--jot-rule-offset) - 1px);
  border-top: 1px solid var(--jot-accent);
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
  margin: ${ROW / 2}px 0;
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

/* ── Responsive: below the two-column threshold the margin channel folds
   underneath its anchor rather than being dropped. ─────────────────── */
@media (max-width: 720px) {
  ${scope} .jot-doc { grid-template-columns: 1fr; }
  ${scope} .jot-body, ${scope} .jot-aside { grid-column: 1; }
  ${scope} .jot-note { padding-left: ${ROW}px; margin-bottom: ${ROW}px; }
}
`.trimStart();
}

function notebookTickRadius(): number {
  return 3;
}
