// The stylesheet for @tree, generated from the same geometry the renderer uses
// to predict how wide a tree will be (tree.ts), so the two cannot drift apart.
//
// Every length is written as a multiple of --u, which is 1px when the tree fits
// and shrinks when it does not: a figure given less room than it needs scales
// down proportionally instead of overflowing or being cut off (UX-31). Only
// hairlines stay 1px, so they stay crisp at any size.

import { MAX_COLUMNS, TREE } from "./tree.js";

/** A length in tree units. */
const u = (n: number): string => (n === 0 ? "0" : `calc(${n} * var(--u, 1px))`);

export function renderTreeCss(scope: string): string {
  const R = TREE.row;
  const M = TREE.mid;
  const G = TREE.gap;
  const pillMargin = (R - TREE.pillHeight) / 2;
  // The line style is a variable so dashed applies ONLY to the sides a
  // connector draws. Setting border-style on the whole element turned on its
  // other three sides too, at the default 3px "medium" width: every dashed
  // connector grew 6px wider and sprouted borders it should not have.
  const line = "1px var(--jot-tree-line-style, solid) var(--jot-tree-line)";
  const arrowRight = `
  content: "";
  position: absolute;
  top: 50%;
  right: calc(100% + 1px);
  transform: translateY(-50%);
  border-left: ${u(TREE.arrow)} solid var(--jot-tree-line);
  border-top: ${u(TREE.arrowHalf)} solid transparent;
  border-bottom: ${u(TREE.arrowHalf)} solid transparent;`;

  return `
/* ── @tree: a figure that always fits its page (UX-31) ──────────────── */
/* The renderer measures the tree (ARC-15) and writes its natural size as
   --jot-w and --jot-h. The figure takes that width, or all the room it has if
   that is less, and --u shrinks every length inside by the same ratio. Its
   height rounds UP to whole rows, so a scaled figure still hands the ruling
   back in phase. An outline wraps like prose and sets neither, so all of this
   resolves to "invalid", which CSS turns back into ordinary auto sizing. */
${scope} .jot-body:has(> .jot-figure) { container-type: inline-size; }
${scope} .jot-body:has(> .jot-figure[data-width="full"]) { grid-column: 1 / -1; }
${scope} .jot-figure {
  --u: min(1px, calc(100cqw / var(--jot-w)));
  width: calc(var(--jot-w) * var(--u));
  height: round(up, calc(var(--jot-h) * var(--u)), ${R}px);
  max-width: 100%;
  margin-inline: 0;
  background: var(--jot-surface);
}
${scope} .jot-figure[data-look="chart"],
${scope} .jot-figure[data-look="split"] { margin-inline: auto; }

${scope} .jot-tree {
  --jot-tree-line: var(--jot-color-accent-slate-blue);
  color: var(--jot-ink);
  font-size: ${u(TREE.labelSize)};
  line-height: ${u(R)};
}
/* A tree is built from lists, so the prose list rules reach into it unless
   they are out-ranked. \`.jot-body li { font-size: 16px }\` did exactly that: a
   scaled tree kept 16px text inside shrunken columns, and 69px of labels ran
   past the edge of its frame. Hence these selectors carry a class more than
   the prose ones, rather than relying on coming later in the file. */
${scope} .jot-tree .jot-tree-root,
${scope} .jot-tree .jot-tree-kids { list-style: none; margin: 0; padding: 0; }
${scope} .jot-tree .jot-tree-node {
  position: relative;
  margin: 0;
  font-size: ${u(TREE.labelSize)};
  line-height: ${u(R)};
}
${scope} .jot-tree[data-style="dashed"] { --jot-tree-line-style: dashed; }

/* ── Pills: nodes=boxed (UX-29) ─────────────────────────────────────── */
/* Every node the same shape, sized to its own text with even padding, one
   line, text centred. Two shades carry the structure — a branch is darker than
   the leaves inside it — and the root is heaviest. Each shade is tested for
   WCAG AA contrast against the ink it carries. */
${scope} .jot-tree[data-nodes="boxed"] {
  --pill-leaf-fill: var(--jot-color-notebook-paper-elevated);
  --pill-leaf-line: var(--jot-color-notebook-rule-lines);
  --pill-branch-fill: var(--jot-color-notebook-rule-lines);
  --pill-branch-line: color-mix(in srgb, var(--jot-color-notebook-rule-lines), var(--jot-color-notebook-ink) 22%);
  --pill-root-fill: var(--jot-color-accent-terracotta-pale);
  --pill-root-line: var(--jot-color-accent-terracotta);
}
${scope}[data-mode="doc"] .jot-tree[data-nodes="boxed"] {
  --pill-leaf-fill: var(--jot-color-doc-sheet);
  --pill-leaf-line: var(--jot-color-doc-sheet-border);
  --pill-branch-fill: var(--jot-color-doc-viewport);
  --pill-branch-line: color-mix(in srgb, var(--jot-color-doc-sheet-border), var(--jot-color-doc-ink) 22%);
}
${scope} .jot-tree[data-nodes="boxed"] .jot-tree-text {
  display: inline-block;
  position: relative;
  box-sizing: border-box;
  height: ${u(TREE.pillHeight)};
  line-height: calc(${u(TREE.pillHeight)} - 2px);
  margin: ${u(pillMargin)} 0;
  padding: 0 ${u(TREE.pillPadX)};
  border: ${TREE.pillBorder}px solid var(--pill-line, var(--pill-leaf-line));
  border-radius: 999px;
  background: var(--pill-fill, var(--pill-leaf-fill));
  font-size: ${u(TREE.pillSize)};
  white-space: nowrap;
  text-align: center;
  /* An inline-block sits on the text baseline and leaves descender space under
     it, which made a boxed split 2px taller than its rows (measured). */
  vertical-align: top;
}
${scope} .jot-tree[data-nodes="boxed"] [data-role="branch"] > .jot-tree-label > .jot-tree-text {
  --pill-fill: var(--pill-branch-fill);
  --pill-line: var(--pill-branch-line);
}
${scope} .jot-tree[data-nodes="boxed"] [data-role="root"] > .jot-tree-label > .jot-tree-text {
  --pill-fill: var(--pill-root-fill);
  --pill-line: var(--pill-root-line);
  font-weight: 600;
}

/* ── dir=down, text: the outline ────────────────────────────────────── */
/* Unchanged from the look first approved. Connectors are borders on
   pseudo-elements of each node, so they cannot drift from the box they belong
   to; two per node, never three — ::before the spine, ::after the elbow, and
   they MEET at the elbow row. A version that patched the last child with a
   third element left a one-pixel seam. */
${scope} .jot-tree[data-look="outline"] .jot-tree-label {
  display: inline-block;
  line-height: ${u(R)};
  padding: 0 ${u(TREE.labelPadX)};
}
${scope} .jot-tree[data-look="outline"] .jot-tree-node { line-height: ${u(R)}; }
${scope} .jot-tree[data-look="outline"] .jot-tree-kids { padding-left: ${u(TREE.outlineIndent)}; }
${scope} .jot-tree[data-look="outline"] .jot-tree-kids > .jot-tree-node { padding-left: ${u(TREE.outlineStep)}; }
${scope} .jot-tree[data-look="outline"] .jot-tree-kids > .jot-tree-node::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-left: ${line};
}
${scope} .jot-tree[data-look="outline"] .jot-tree-kids > .jot-tree-node:last-child::before {
  bottom: auto;
  height: ${u(M)};
}
${scope} .jot-tree[data-look="outline"] .jot-tree-kids > .jot-tree-node::after {
  content: "";
  position: absolute;
  left: 0;
  top: ${u(M)};
  width: ${u(TREE.outlineStep)};
  border-top: ${line};
}
${scope} .jot-tree[data-look="outline"] > .jot-tree-root > .jot-tree-node > .jot-tree-label {
  font-weight: 600;
  background: var(--jot-surface-elevated);
  border-radius: var(--jot-shape-border-radius-sm);
}

/* ── dir=right: aligned columns (UX-28) ─────────────────────────────── */
/* One grid for the whole tree, one column per level, and every list a SUBGRID
   of it — so each column is as wide as its widest label and every label in a
   level starts at the same left edge, however the families above it are
   shaped. A parent shares the row of its first child; a family takes all the
   rows it needs before the next begins. That is the reference exactly: if the
   labels in a column were ragged, the columns would stop reading as columns. */
${scope} .jot-tree[data-look="columns"] .jot-tree-root {
  display: grid;
  column-gap: ${u(G)};
  align-items: start;
}
${Array.from({ length: MAX_COLUMNS }, (_, i) => `${scope} .jot-tree[data-look="columns"][data-depth="${i + 1}"] .jot-tree-root { grid-template-columns: repeat(${i + 1}, max-content); }`).join("\n")}
${scope} .jot-tree[data-look="columns"] .jot-tree-node {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: start;
}
${scope} .jot-tree[data-look="columns"] .jot-tree-kids {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 2 / -1;
  grid-row: 1;
}
${scope} .jot-tree[data-look="columns"] .jot-tree-label {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  align-items: flex-start;
  height: ${u(R)};
  position: relative;
  white-space: nowrap;
}
/* The line leaving a parent runs from its label to the spine in the middle of
   the gap. As a flex item it fills whatever its column has left over, so a
   short label's line is simply longer. */
${scope} .jot-tree[data-look="columns"] .jot-tree-node:has(> .jot-tree-kids) > .jot-tree-label::after {
  content: "";
  flex: 1 0 ${u(TREE.stubMin)};
  margin: ${u(M)} ${u(-G / 2)} 0 ${u(TREE.stubGap)};
  border-top: ${line};
}
${scope} .jot-tree[data-look="columns"][data-nodes="boxed"] .jot-tree-node:has(> .jot-tree-kids) > .jot-tree-label::after {
  margin-left: 0;
}
/* The spine, one child's length at a time: from the first child's middle to the
   last child's middle, down the centre of the gap. */
${scope} .jot-tree[data-look="columns"] .jot-tree-kids > .jot-tree-node::before {
  content: "";
  position: absolute;
  left: ${u(-G / 2)};
  top: 0;
  bottom: 0;
  border-left: ${line};
}
${scope} .jot-tree[data-look="columns"] .jot-tree-kids > .jot-tree-node:first-child::before { top: ${u(M)}; }
${scope} .jot-tree[data-look="columns"] .jot-tree-kids > .jot-tree-node:last-child::before { bottom: auto; height: ${u(M)}; }
${scope} .jot-tree[data-look="columns"] .jot-tree-kids > .jot-tree-node:only-child::before { display: none; }
/* The line into each child. Text looks stop just short of the label; pills end
   in an arrowhead at the pill's edge. */
${scope} .jot-tree[data-look="columns"] .jot-tree-kids > .jot-tree-node > .jot-tree-label::before {
  content: "";
  position: absolute;
  left: ${u(-G / 2)};
  top: ${u(M)};
  width: ${u(G / 2 - TREE.tickGap)};
  border-top: ${line};
}
${scope} .jot-tree[data-look="columns"][data-nodes="boxed"] .jot-tree-kids > .jot-tree-node > .jot-tree-label::before {
  width: ${u(G / 2 - TREE.arrow)};
}
${scope} .jot-tree[data-look="columns"][data-nodes="boxed"] .jot-tree-kids > .jot-tree-node > .jot-tree-label > .jot-tree-text::before {${arrowRight}
}
/* Rounded: the last child's corner is one element, so the curve is continuous. */
${scope} .jot-tree[data-look="columns"][data-style="rounded"] .jot-tree-kids > .jot-tree-node:last-child:not(:only-child)::before { display: none; }
${scope} .jot-tree[data-look="columns"][data-style="rounded"] .jot-tree-kids > .jot-tree-node:last-child:not(:only-child) > .jot-tree-label::before {
  top: 0;
  height: ${u(M)};
  border-top: 0;
  border-left: ${line};
  border-bottom: ${line};
  border-bottom-left-radius: ${u(R / 4)};
}

/* ── dir=down, boxed: the chart (UX-29, UX-30) ──────────────────────── */
/* Depth is distance from the top. A family whose children are all leaves
   STACKS them down a rail; any other family SPREADS its children in a row.
   That one rule stands in for the packing a designer does by hand: stacking
   the last level is what stops a top-down tree getting wider than the page.
   Lines run from pill edge to pill edge, bend at right angles, and end in an
   arrowhead pointing from parent to child. */
${scope} .jot-tree[data-look="chart"] .jot-tree-root {
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
${scope} .jot-tree[data-look="chart"] .jot-tree-root > .jot-tree-node { padding: 0 ${u(TREE.spread)}; }
${scope} .jot-tree[data-look="chart"] .jot-tree-node {
  display: flex;
  flex-direction: column;
  align-items: center;
}
${scope} .jot-tree[data-look="chart"] .jot-tree-label { display: block; height: ${u(R)}; }
${scope} .jot-tree[data-look="chart"] .jot-tree-kids { position: relative; }

/* Spread: a stem down from the parent, a bar across, a drop into each child. */
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="spread"] {
  display: flex;
  align-items: flex-start;
  padding-top: ${u(R)};
}
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="spread"] > .jot-tree-node { padding: 0 ${u(TREE.spread)}; }
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="spread"]::before {
  content: "";
  position: absolute;
  top: ${u(-pillMargin)};
  left: 50%;
  height: ${u(pillMargin + M)};
  border-left: ${line};
}
/* Each child draws the half of the bar on either side of where it is entered,
   so siblings' halves meet and the bar runs exactly from the first drop to the
   last. --attach is where a child is entered: its centre, unless it is a stack
   hanging from a rail (below). */
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="spread"] > .jot-tree-node::before {
  content: "";
  position: absolute;
  top: ${u(-M)};
  left: 0;
  width: var(--attach, 50%);
  border-top: ${line};
}
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="spread"] > .jot-tree-node::after {
  content: "";
  position: absolute;
  top: ${u(-M)};
  left: var(--attach, 50%);
  right: 0;
  height: ${u(M + pillMargin - TREE.arrow)};
  border-top: ${line};
  border-left: ${line};
}
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="spread"] > .jot-tree-node:first-child::before { border-top: 0; }
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="spread"] > .jot-tree-node:last-child::after { border-top: 0; }
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="spread"] > .jot-tree-node > .jot-tree-label > .jot-tree-text::before {
  content: "";
  position: absolute;
  bottom: calc(100% + 1px);
  left: var(--pill-attach, 50%);
  transform: translateX(-50%);
  border-top: ${u(TREE.arrow)} solid var(--jot-tree-line);
  border-left: ${u(TREE.arrowHalf)} solid transparent;
  border-right: ${u(TREE.arrowHalf)} solid transparent;
}
${scope} .jot-tree[data-look="chart"][data-style="rounded"] .jot-tree-kids[data-flow="spread"] > .jot-tree-node:first-child:not(:only-child)::after { border-top-left-radius: ${u(R / 4)}; }
${scope} .jot-tree[data-look="chart"][data-style="rounded"] .jot-tree-kids[data-flow="spread"] > .jot-tree-node:last-child:not(:only-child)::before {
  border-top: ${line};
  border-right: ${line};
  border-top-right-radius: ${u(R / 4)};
  height: ${u(M + pillMargin - TREE.arrow)};
}
${scope} .jot-tree[data-look="chart"][data-style="rounded"] .jot-tree-kids[data-flow="spread"] > .jot-tree-node:last-child:not(:only-child)::after { border-left: 0; }

/* Stack: leaves hang down a rail, each entered from the side. */
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="stack"] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-left: ${u(TREE.railToItem)};
}
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="stack"] > .jot-tree-node::before {
  content: "";
  position: absolute;
  left: ${u(-TREE.railToItem)};
  top: ${u(M)};
  width: ${u(TREE.railToItem - TREE.arrow)};
  border-top: ${line};
}
${scope} .jot-tree[data-look="chart"] .jot-tree-kids[data-flow="stack"] > .jot-tree-node > .jot-tree-label > .jot-tree-text::before {${arrowRight}
}

/* UX-32, "rail": the parent pill sits at the left of its family and the rail
   drops straight from near its left end — exact and compact, entered at the
   rail rather than the pill's centre. */
${scope} .jot-tree[data-look="chart"][data-attach="rail"] .jot-tree-node[data-flow="stack"] {
  align-items: flex-start;
  --attach: ${u(TREE.spread + TREE.railInset)};
}
${scope} .jot-tree[data-look="chart"][data-attach="rail"] .jot-tree-node[data-flow="stack"] > .jot-tree-label > .jot-tree-text {
  --pill-attach: calc(${u(TREE.railInset)} - ${TREE.pillBorder}px);
}
${scope} .jot-tree[data-look="chart"][data-attach="rail"] .jot-tree-kids[data-flow="stack"] { margin-left: ${u(TREE.railInset)}; }
${scope} .jot-tree[data-look="chart"][data-attach="rail"] .jot-tree-kids[data-flow="stack"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: ${u(-pillMargin)};
  bottom: ${u(M)};
  border-left: ${line};
}

/* UX-32, "centre": the parent pill stays centred; its line drops from the
   centre and jogs across to the rail, which costs one row. */
${scope} .jot-tree[data-look="chart"][data-attach="centre"] .jot-tree-kids[data-flow="stack"] { padding-top: ${u(R)}; }
${scope} .jot-tree[data-look="chart"][data-attach="centre"] .jot-tree-kids[data-flow="stack"]::after {
  content: "";
  position: absolute;
  top: ${u(-pillMargin)};
  left: 0;
  right: 50%;
  height: ${u(pillMargin + M)};
  border-right: ${line};
  border-bottom: ${line};
}
${scope} .jot-tree[data-look="chart"][data-attach="centre"][data-style="rounded"] .jot-tree-kids[data-flow="stack"]::after { border-bottom-right-radius: ${u(R / 4)}; }
${scope} .jot-tree[data-look="chart"][data-attach="centre"] .jot-tree-kids[data-flow="stack"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: ${u(M)};
  bottom: ${u(M)};
  border-left: ${line};
}

/* ── dir=split: a bilateral mind map ────────────────────────────────── */
/* Three columns — left branches, the hub, right branches — not one column per
   branch, which gave four columns for four branches and an off-centre hub. The
   renderer chooses each branch's side, balancing by subtree weight; < and >
   override it. The grid fills the figure, so both sides are always equal and
   the hub always centred. */
${scope} .jot-tree[data-look="split"] .jot-tree-split {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  column-gap: ${u(TREE.splitGap)};
}
${scope} .jot-tree[data-look="split"] .jot-tree-label {
  display: inline-block;
  line-height: ${u(R)};
  padding: 0 ${u(TREE.labelPadX)};
  white-space: nowrap;
}
${scope} .jot-tree[data-look="split"] .jot-tree-node { line-height: ${u(R)}; }
${scope} .jot-tree[data-look="split"] .jot-tree-kids { padding-left: ${u(TREE.outlineIndent)}; }
${scope} .jot-tree[data-look="split"] .jot-tree-kids > .jot-tree-node { padding-left: ${u(TREE.outlineStep)}; }
${scope} .jot-tree[data-look="split"] .jot-tree-kids > .jot-tree-node::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-left: ${line};
}
${scope} .jot-tree[data-look="split"] .jot-tree-kids > .jot-tree-node:last-child::before { bottom: auto; height: ${u(M)}; }
${scope} .jot-tree[data-look="split"] .jot-tree-kids > .jot-tree-node::after {
  content: "";
  position: absolute;
  left: 0;
  top: ${u(M)};
  width: ${u(TREE.outlineStep)};
  border-top: ${line};
}
/* Where a parent sits BESIDE its children rather than above them — the hub and
   a side's first level, and every level of a boxed split — the spine starts at
   the first child's middle, where the parent's line arrives. Started at the top
   of the row, it left a stray tick poking up above every such junction. */
${scope} .jot-tree[data-look="split"] .jot-tree-side > .jot-tree-kids > .jot-tree-node:first-child::before,
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-kids > .jot-tree-node:first-child::before { top: ${u(M)}; }
${scope} .jot-tree[data-look="split"] .jot-tree-side > .jot-tree-kids > .jot-tree-node:only-child::before,
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-kids > .jot-tree-node:only-child::before { display: none; }
${scope} .jot-tree[data-look="split"] .jot-tree-hub { display: flex; justify-content: center; }
${scope} .jot-tree[data-look="split"][data-nodes="text"] .jot-tree-hub > .jot-tree-label {
  font-weight: 600;
  background: var(--jot-surface-elevated);
  border-radius: var(--jot-shape-border-radius-sm);
  border: 1px solid var(--jot-rule);
  padding: 0 ${u(TREE.hubPadX)};
}
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-hub > .jot-tree-label { padding: 0; }
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-hub > .jot-tree-label > .jot-tree-text {
  --pill-fill: var(--pill-root-fill);
  --pill-line: var(--pill-root-line);
  font-weight: 600;
}
${scope} .jot-tree[data-look="split"] .jot-tree-side > .jot-tree-kids { padding: 0; }
${scope} .jot-tree[data-look="split"] .jot-tree-side[data-side="right"] > .jot-tree-kids { padding-left: ${u(TREE.outlineIndent)}; }
/* The left side mirrors completely — text, spine and elbow all flip — at EVERY
   level. Mirroring only the top level once left deeper levels with no indent,
   so a three-deep branch collapsed onto a single spine. */
${scope} .jot-tree[data-look="split"] .jot-tree-side[data-side="left"] { text-align: right; }
${scope} .jot-tree[data-look="split"] .jot-tree-side[data-side="left"] .jot-tree-kids { padding-left: 0; padding-right: ${u(TREE.outlineIndent)}; }
${scope} .jot-tree[data-look="split"] .jot-tree-side[data-side="left"] > .jot-tree-kids { padding-right: ${u(TREE.outlineIndent)}; }
${scope} .jot-tree[data-look="split"] .jot-tree-side[data-side="left"] .jot-tree-kids > .jot-tree-node {
  padding-left: 0;
  padding-right: ${u(TREE.outlineStep)};
}
${scope} .jot-tree[data-look="split"] .jot-tree-side[data-side="left"] .jot-tree-kids > .jot-tree-node::before,
${scope} .jot-tree[data-look="split"] .jot-tree-side[data-side="left"] .jot-tree-kids > .jot-tree-node::after {
  left: auto;
  right: 0;
}
/* Each side connects inward to the hub, so the hub visibly joins both — from
   the hub's own edge, across the gap between the columns, to the side's spine.
   It used to stop at the side's edge and leave the gap bare, so the lines
   seemed to start in mid-air rather than at the hub. */
${scope} .jot-tree[data-look="split"] .jot-tree-side { position: relative; }
${scope} .jot-tree[data-look="split"] .jot-tree-side::after {
  content: "";
  position: absolute;
  top: ${u(M)};
  width: ${u(TREE.splitGap + TREE.outlineIndent)};
  border-top: ${line};
}
${scope} .jot-tree[data-look="split"] .jot-tree-side[data-side="right"]::after { left: ${u(-TREE.splitGap)}; }
${scope} .jot-tree[data-look="split"] .jot-tree-side[data-side="left"]::after { right: ${u(-TREE.splitGap)}; }
${scope} .jot-tree[data-look="split"] .jot-tree-side:has(.jot-tree-kids:empty)::after { display: none; }
/* Boxed split: depth as columns, each pill followed by its children, mirrored
   in FLOW on the left as well as in text, or a left branch's children would
   march back toward the hub. Arrowheads point away from the hub. */
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-node { display: flex; align-items: flex-start; }
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-label { padding: 0; flex: none; display: block; height: ${u(R)}; }
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-side[data-side="left"] .jot-tree-node { flex-direction: row-reverse; }
/* A boxed node's children sit BESIDE it, not below it, so the line from the
   pill to their spine has to be drawn — it spans the list's indent. Without it
   a second level floated free of its parent (the old version did this too). */
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-label { position: relative; }
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-node:has(> .jot-tree-kids) > .jot-tree-label::after {
  content: "";
  position: absolute;
  top: ${u(M)};
  width: ${u(TREE.outlineIndent)};
  border-top: ${line};
}
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-side[data-side="right"] .jot-tree-node:has(> .jot-tree-kids) > .jot-tree-label::after { left: 100%; }
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-side[data-side="left"] .jot-tree-node:has(> .jot-tree-kids) > .jot-tree-label::after { right: 100%; }
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-kids > .jot-tree-node::after { width: ${u(TREE.outlineStep - TREE.arrow)}; }
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-side[data-side="right"] .jot-tree-kids > .jot-tree-node > .jot-tree-label > .jot-tree-text::before {${arrowRight}
}
${scope} .jot-tree[data-look="split"][data-nodes="boxed"] .jot-tree-side[data-side="left"] .jot-tree-kids > .jot-tree-node > .jot-tree-label > .jot-tree-text::before {
  content: "";
  position: absolute;
  top: 50%;
  left: calc(100% + 1px);
  transform: translateY(-50%);
  border-right: ${u(TREE.arrow)} solid var(--jot-tree-line);
  border-top: ${u(TREE.arrowHalf)} solid transparent;
  border-bottom: ${u(TREE.arrowHalf)} solid transparent;
}
/* Extra roots under a split hub are drawn as outlines. */
${scope} .jot-tree[data-look="split"] > .jot-tree-root .jot-tree-label { white-space: normal; }
`;
}
