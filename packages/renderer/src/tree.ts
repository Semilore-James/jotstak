// @tree — five looks from one indented hierarchy.
//
// `dir` is the way the tree grows (UX-28) and `nodes` how each node is drawn:
//
//   down  + text   → outline        the look approved first, unchanged
//   right + text   → columns        each level its own aligned column, labels
//                                   joined by thin lines (the "Table" reference)
//   right + boxed  → columns        the same, every node a pill (UX-29)
//   down  + boxed  → chart          top-down pills; families spread side by
//                                   side, and a family of leaves stacks only
//                                   when spreading would not fit (UX-75)
//                                   (the "Literature" reference)
//   split + either → split          branches balanced either side of a hub
//
// Everything that can be wider than the page is sized HERE, before any browser
// lays it out (ARC-15), so the renderer can decide where it goes (UX-31): the
// text column if it fits, the full width if it doesn't, a landscape page of its
// own if it still doesn't — and scaled to fit, never cut off, beyond that.

import type { BlockNode, TreeNode } from "./ast.js";
import type { Diagnostic } from "./index.js";
import { broken, brokenWidth, ESTIMATE_SAFETY, segments, type Face } from "./measure.js";
import { figureAttrs, placeFigure } from "./figure.js";
import type { Placement, Size } from "./figure.js";
import { PAGE } from "./page.js";

/**
 * The geometry every look is built from, in CSS pixels at full size. The
 * stylesheet (tree-css.ts) is generated from these same numbers, so the width
 * the renderer predicts and the width the browser draws cannot drift apart.
 */
export const TREE = {
  row: 28,
  /** Where a connector meets a row: its middle. */
  mid: 14,
  labelSize: 16,
  /** Columns: space between one level and the next; the spine runs down its middle. */
  gap: 28,
  /** Columns, text: space between a label and the line leaving it. */
  stubGap: 6,
  /** Columns: the shortest line leaving a parent inside its own column. */
  stubMin: 8,
  /** Columns, text: space between an incoming line and the label it points at. */
  tickGap: 4,
  /** Outline and split: a label's side padding. */
  labelPadX: 7,
  /** Outline and split: indent per level (list padding + node padding). */
  outlineIndent: 28,
  outlineStep: 14,
  /** Pills: 14px text on a 22px line in a 1px border — 24px tall, 2px clear of the row edges. */
  pillSize: 14,
  pillHeight: 24,
  pillPadX: 10,
  pillBorder: 1,
  /** Pills: arrowhead length and half-width. */
  arrow: 6,
  arrowHalf: 4,
  /** Chart: half the gap between siblings that spread side by side. */
  spread: 7,
  /** Chart, stacked leaves: the line from the rail across to each pill. */
  railToItem: 22,
  /** Split: space between the hub and each side. */
  splitGap: 28,
  /** Split hub label side padding. */
  hubPadX: 14,
} as const;

/**
 * How far a figure may shrink before it is moved to a landscape page instead.
 * A landscape page is a big interruption to a document, and the Table
 * reference — the very thing a portrait breakdown is modelled on — measures
 * 682.8px against a 681.7px page: one pixel over. At 0.9 the smallest body
 * text a scaled figure shows is 14.4px.
 *
 * It lives in figure.ts now, with the rest of what every figure shares, and is
 * re-exported here because it was a tree constant first.
 */
export { MIN_SCALE_BEFORE_LANDSCAPE } from "./figure.js";

/** Deepest tree the columns look lays out; deeper levels are reported. */
export const MAX_COLUMNS = 16;

export type Look = "outline" | "columns" | "chart" | "split";

export interface TreeHelpers {
  inline: (text: string) => string;
  escapeHtml: (s: string) => string;
  attr: (name: string, value: string | undefined) => string;
}

// ── reading the source ───────────────────────────────────────────────────

/** `>` and `<` prefix a split branch's side. Intent, not coordinates. */
export function readSide(text: string): { side: "left" | "right" | null; text: string } {
  if (text.startsWith("> ")) return { side: "right", text: text.slice(2) };
  if (text.startsWith("< ")) return { side: "left", text: text.slice(2) };
  return { side: null, text };
}
/** A tree node's text, with the side marker taken off. */
const label = (n: TreeNode): string => readSide(n.text).text;

/**
 * How many rows one node's own label takes.
 *
 * A node used to be exactly one row tall everywhere, and every connector in
 * every look was positioned off that. Making a label breakable meant deciding
 * where a line should MEET a node that is two rows tall, and the answer that
 * costs nothing is the middle of its FIRST row: siblings of different heights
 * then all connect at the same offset from their own top, so a column of
 * connectors stays level, and not one of the existing `top` values changes.
 *
 * The alternative — the middle of the whole node — puts a two-line node's
 * connector a full row below a one-line sibling's, which reads as two
 * different kinds of thing rather than two entries in one list.
 */
const labelRows = (n: TreeNode): number => segments(label(n)).length;

/**
 * Rows a subtree occupies in the COLUMNS look, where height comes from the
 * leaves: a parent is only as tall as the children beside it.
 *
 * With a breakable label a parent can be taller than its whole family — a
 * two-line node with one one-line child — so it takes whichever is greater.
 * Without that, the parent overflows its own column and the level below it
 * drifts up the page.
 */
const leaves = (n: TreeNode): number =>
  n.children.length === 0
    ? labelRows(n)
    : Math.max(labelRows(n), n.children.reduce((s, c) => s + leaves(c), 0));
const depth = (n: TreeNode): number => 1 + Math.max(0, ...n.children.map(depth));
const count = (n: TreeNode): number => labelRows(n) + n.children.reduce((s, c) => s + count(c), 0);
/** A parent whose children are all leaves: the only kind of family that can hang down a rail. */
const leafFamily = (n: TreeNode): boolean => n.children.length > 0 && n.children.every((c) => c.children.length === 0);

/** The families of leaves in a chart that hang down a rail rather than spread. */
export type Stacks = ReadonlySet<TreeNode>;

/**
 * Which families of leaves stack (UX-75).
 *
 * Every family spreads side by side under its parent while the chart fits the
 * room it has. When it does not, the family whose stacking saves the most
 * width stacks first, then the chart is measured again, until it fits or
 * every family of leaves is stacked — at which point it is a figure too wide
 * for its page like any other, and goes to the full width or a landscape
 * sheet (UX-31). That is the packing a designer does by hand, and the rule it
 * replaced (UX-30: leaves always stack) stood five short tools in a column
 * under "One PRD" with two thirds of the page empty beside them.
 */
export function chooseStacks(roots: TreeNode[], room: number): Set<TreeNode> {
  const stacks = new Set<TreeNode>();
  const width = (): number =>
    Math.ceil(roots.reduce((s, r) => s + chartWidth(r, true, stacks) + 2 * TREE.spread, 0) * ESTIMATE_SAFETY);
  const families: TreeNode[] = [];
  const visit = (n: TreeNode): void => {
    if (leafFamily(n)) families.push(n);
    n.children.forEach(visit);
  };
  roots.forEach(visit);
  while (width() > room) {
    let best: TreeNode | undefined;
    let bestWidth = Infinity;
    for (const f of families) {
      if (stacks.has(f)) continue;
      stacks.add(f);
      const w = width();
      stacks.delete(f);
      if (w < bestWidth) {
        best = f;
        bestWidth = w;
      }
    }
    if (!best) break;
    stacks.add(best);
  }
  return stacks;
}

export function resolveLook(dir: string, nodes: string): Look {
  if (dir === "split") return "split";
  if (dir === "right") return "columns";
  return nodes === "boxed" ? "chart" : "outline";
}

// ── measuring (ARC-15) ───────────────────────────────────────────────────

/** A label's width is its widest LINE. Measuring the whole string would size
 * a column for text that is no longer on one line. */
const textWidth = (s: string, face: Face, size: number): number => brokenWidth(s, face, size);
const pillWidth = (s: string, face: Face): number =>
  brokenWidth(s, face, TREE.pillSize) + 2 * TREE.pillPadX + 2 * TREE.pillBorder;

type Role = "root" | "branch" | "leaf";
const roleOf = (n: TreeNode, isRoot: boolean): Role => (isRoot ? "root" : n.children.length ? "branch" : "leaf");
const pillFace = (role: Role): Face => (role === "root" ? "lora-600" : "lora-400");

/** Width of every level of a columns tree, level by level. */
function columnWidths(roots: TreeNode[], boxed: boolean): number[] {
  const widths: number[] = [];
  const visit = (n: TreeNode, d: number, isRoot: boolean): void => {
    const role = roleOf(n, isRoot);
    const body = boxed ? pillWidth(label(n), pillFace(role)) : textWidth(label(n), "lora-400", TREE.labelSize);
    // A parent's outgoing line reaches half-way into the gap on a negative
    // margin, so it only widens its column by whatever it needs beyond that —
    // which at these sizes is nothing. Counting it anyway over-estimated a
    // four-level chain by 37% (measured) and would have sent trees that fit
    // portrait to a landscape page.
    const stub = n.children.length ? Math.max(0, (boxed ? 0 : TREE.stubGap) + TREE.stubMin - TREE.gap / 2) : 0;
    widths[d] = Math.max(widths[d] ?? 0, body + stub);
    n.children.forEach((c) => visit(c, d + 1, false));
  };
  roots.forEach((r) => visit(r, 0, true));
  return widths;
}

/** Chart: the width one node's family needs, not counting the spread padding its parent adds. */
function chartWidth(n: TreeNode, isRoot: boolean, stacks: Stacks): number {
  const pw = pillWidth(label(n), pillFace(roleOf(n, isRoot)));
  if (!n.children.length) return pw;
  if (stacks.has(n)) {
    const widest = Math.max(...n.children.map((c) => pillWidth(label(c), "lora-400")));
    return Math.max(pw, TREE.railToItem + widest);
  }
  return Math.max(pw, n.children.reduce((s, c) => s + chartWidth(c, false, stacks) + 2 * TREE.spread, 0));
}
/** Chart: rows a node's family occupies. A stack spends one on the jog (UX-32). */
function chartRows(n: TreeNode, stacks: Stacks): number {
  if (!n.children.length) return labelRows(n);
  const own = labelRows(n) + 1;
  if (stacks.has(n)) return own + n.children.reduce((s, c) => s + labelRows(c), 0);
  return own + Math.max(...n.children.map((c) => chartRows(c, stacks)));
}

/** Split (outline sides): the width one side needs. */
function outlineSideWidth(nodes: TreeNode[], firstIndent: number): number {
  let w = 0;
  const visit = (n: TreeNode, x: number): void => {
    w = Math.max(w, x + TREE.outlineStep + textWidth(label(n), "lora-400", TREE.labelSize) + 2 * TREE.labelPadX);
    n.children.forEach((c) => visit(c, x + TREE.outlineStep + TREE.outlineIndent));
  };
  nodes.forEach((n) => visit(n, firstIndent));
  return w;
}
/** Split (boxed sides): depth as columns, each pill followed by its children. */
function boxedSideWidth(n: TreeNode): number {
  const pw = pillWidth(label(n), "lora-400");
  if (!n.children.length) return pw;
  return pw + TREE.outlineIndent + Math.max(...n.children.map((c) => TREE.outlineStep + boxedSideWidth(c)));
}



export function measureTree(
  look: Look,
  roots: TreeNode[],
  nodes: string,
  sides?: { left: TreeNode[]; right: TreeNode[] },
  stacks: Stacks = look === "chart" ? chooseStacks(roots, PAGE.portrait.content) : new Set(),
): Size {
  const R = TREE.row;
  const safe = (w: number): number => Math.ceil(w * ESTIMATE_SAFETY);
  switch (look) {
    case "outline": {
      // An outline wraps like prose, so it never needs more than the column.
      return { w: 0, h: roots.reduce((s, r) => s + count(r), 0) * R };
    }
    case "columns": {
      const widths = columnWidths(roots, nodes === "boxed");
      const w = widths.reduce((s, x) => s + x, 0) + TREE.gap * Math.max(0, widths.length - 1);
      return { w: safe(w), h: roots.reduce((s, r) => s + leaves(r), 0) * R };
    }
    case "chart": {
      const w = roots.reduce((s, r) => s + chartWidth(r, true, stacks) + 2 * TREE.spread, 0);
      return { w: safe(w), h: Math.max(...roots.map((r) => chartRows(r, stacks))) * R };
    }
    case "split": {
      const hub = roots[0]!;
      const { left, right } = sides!;
      const boxed = nodes === "boxed";
      const sideW = (group: TreeNode[]): number =>
        group.length === 0
          ? 0
          : boxed
            ? TREE.outlineIndent + Math.max(...group.map((n) => TREE.outlineStep + boxedSideWidth(n)))
            : outlineSideWidth(group, TREE.outlineIndent);
      const hubW = boxed
        ? pillWidth(label(hub), "lora-600")
        : textWidth(label(hub), "lora-600", TREE.labelSize) + 2 * TREE.hubPadX + 2;
      const w = 2 * Math.max(sideW(left), sideW(right)) + hubW + 2 * TREE.splitGap;
      const rows = (group: TreeNode[]): number =>
        group.reduce((s, n) => s + (boxed ? leaves(n) : count(n)), 0);
      const extra = roots.slice(1).reduce((s, r) => s + count(r), 0);
      // The HUB's own height counts too. It never had to before: a hub was one
      // row like everything else, so the taller side always won. A hub whose
      // label breaks is two rows with one row of branches either side, and the
      // figure reported one row while the pill ran 26px out of the bottom of
      // its own box — declared and drawn agreeing at 28 the whole time,
      // because both came from the same wrong number.
      return {
        w: safe(w),
        h: (Math.max(1, labelRows(hub), rows(left), rows(right)) + extra) * R,
      };
    }
  }
}

// ── balancing a split ────────────────────────────────────────────────────

/** Total nodes in a subtree, including itself. The weight used to balance sides. */
function subtreeWeight(node: TreeNode): number {
  return 1 + node.children.reduce((sum, c) => sum + subtreeWeight(c), 0);
}

/**
 * Split a mind map's branches into a balanced left and right group.
 *
 * The author says "split" and marks a branch with `<` or `>` only when they
 * care. Everything else is the renderer's job — that is the whole of "intent,
 * not coordinates", and making someone hand-balance a diagram breaks it.
 *
 * Balance is by SUBTREE WEIGHT, not branch count: explicit marks first, then
 * the rest heaviest-first onto whichever side is lighter — the standard greedy
 * partition, good enough for the handful of branches a readable mind map holds.
 */
export function splitSides(branches: TreeNode[]): { left: TreeNode[]; right: TreeNode[] } {
  const left: TreeNode[] = [];
  const right: TreeNode[] = [];
  let leftWeight = 0;
  let rightWeight = 0;
  const unmarked: TreeNode[] = [];
  for (const b of branches) {
    const { side } = readSide(b.text);
    const w = subtreeWeight(b);
    if (side === "left") { left.push(b); leftWeight += w; }
    else if (side === "right") { right.push(b); rightWeight += w; }
    else unmarked.push(b);
  }
  for (const b of [...unmarked].sort((a, c) => subtreeWeight(c) - subtreeWeight(a))) {
    const w = subtreeWeight(b);
    if (leftWeight <= rightWeight) { left.push(b); leftWeight += w; }
    else { right.push(b); rightWeight += w; }
  }
  // Keep authored order within each side; only the side itself is chosen for you.
  const order = new Map(branches.map((b, i) => [b, i]));
  const bySource = (a: TreeNode, c: TreeNode) => (order.get(a) ?? 0) - (order.get(c) ?? 0);
  return { left: left.sort(bySource), right: right.sort(bySource) };
}

// ── placing (UX-31) ──────────────────────────────────────────────────────


/**
 * Where a tree goes. The rules are shared by every figure (figure.ts); a tree
 * only adds what advice to give when one does not fit, and the fact that an
 * outline wraps like prose and is therefore never sized or scaled.
 */
export function placeTree(look: Look, size: Size, pinned: string, n: BlockNode, diagnostics: Diagnostic[]): Placement {
  return placeFigure(size, pinned, n, diagnostics, {
    noun: "tree",
    sized: look !== "outline",
    hint:
      look === "columns"
        ? "Fewer levels or shorter labels would fit."
        : "dir=right grows down the page instead of across it.",
  });
}

// ── drawing ──────────────────────────────────────────────────────────────

/**
 * How a family of stacked leaves hangs from its parent pill (UX-32, awaiting a
 * choice by eye): "rail" drops a straight line from near the pill's left end;
 * "centre" drops it from the pill's centre and jogs across to the rail. Both
 * exist only until one is picked from the side-by-side mock.
 */
/**
 * `data-rows="2"` on a node whose label breaks.
 *
 * The stylesheet needs to know, because every look holds a label at exactly
 * one row and most of them hold it on one line as well — a tree is a diagram,
 * and a label left free to wrap would re-shape the figure the renderer has
 * already measured. An asked-for break is the one thing that releases it.
 */
const rowsAttr = (n: TreeNode): string => {
  const rows = labelRows(n);
  return rows > 1 ? ` data-rows="${rows}"` : "";
};

function nodeHtml(n: TreeNode, isRoot: boolean, look: Look, h: TreeHelpers, stacks: Stacks = new Set()): string {
  const flow = look === "chart" && n.children.length ? (stacks.has(n) ? "stack" : "spread") : "";
  const flowAttr = flow ? ` data-flow="${flow}"` : "";
  const kids = n.children.length
    ? `<ul class="jot-tree-kids"${flowAttr}>${n.children.map((c) => nodeHtml(c, false, look, h, stacks)).join("")}</ul>`
    : "";
  return (
    `<li class="jot-tree-node" data-role="${roleOf(n, isRoot)}"${flowAttr}${rowsAttr(n)}>` +
    `<span class="jot-tree-label"><span class="jot-tree-text">${broken(h, label(n))}</span></span>${kids}</li>`
  );
}

export function renderTree(n: BlockNode, diagnostics: Diagnostic[], h: TreeHelpers, nested: string): string {
  const roots = n.body.shape === "indented" ? n.body.roots : [];
  const dir = n.params.dir ?? "down";
  const nodes = n.params.nodes ?? "text";
  const style = n.params.style ?? "solid";
  const pinned = n.params.width ?? "auto";
  const look = resolveLook(dir, nodes);

  const sides = look === "split" && roots[0] ? splitSides(roots[0].children) : undefined;
  // A chart spreads its families while they fit the room it is pinned to, or
  // the page's full width when it is not pinned (UX-75).
  const stacks =
    look === "chart" ? chooseStacks(roots, pinned === "column" ? PAGE.portrait.column : PAGE.portrait.content) : new Set<TreeNode>();
  const size = measureTree(look, roots, nodes, sides, stacks);
  const place = placeTree(look, size, pinned, n, diagnostics);

  const levels = Math.max(1, ...roots.map(depth));
  if (look === "columns" && levels > MAX_COLUMNS) {
    diagnostics.push({
      severity: "warning",
      message: `This tree is ${levels} levels deep; dir=right lays out at most ${MAX_COLUMNS}. Deeper levels are drawn in the last column.`,
      line: n.position.line,
      column: n.position.column,
    });
  }

  let body = "";
  if (look === "split" && roots[0] && sides) {
    const hub = roots[0];
    const side = (group: TreeNode[], which: "left" | "right"): string =>
      `<div class="jot-tree-side" data-side="${which}"><ul class="jot-tree-kids">${group.map((c) => nodeHtml(c, false, look, h)).join("")}</ul></div>`;
    body =
      `<div class="jot-tree-split">` +
      side(sides.left, "left") +
      `<div class="jot-tree-hub" data-role="root"${rowsAttr(hub)}><span class="jot-tree-label"><span class="jot-tree-text">${broken(h, label(hub))}</span></span></div>` +
      side(sides.right, "right") +
      `</div>` +
      // A mind map has one hub. Extra roots are drawn beneath it as outlines
      // rather than silently dropped.
      roots.slice(1).map((r) => `<ul class="jot-tree-root">${nodeHtml(r, true, "outline", h)}</ul>`).join("");
  } else {
    body = `<ul class="jot-tree-root">${roots.map((r) => nodeHtml(r, true, look, h, stacks)).join("")}</ul>`;
  }

  const figure =
    ` data-look="${look}" data-width="${place.width}"` +
    (place.page === "landscape" ? ` data-page="landscape"` : "") +
    (place.tall ? ` data-tall` : "") +
    // The outline wraps like prose, so it is never sized or scaled.
    (look === "outline" ? "" : ` style="--jot-w:${size.w};--jot-h:${size.h}"`);
  const tree =
    ` data-look="${look}" data-dir="${h.escapeHtml(dir)}" data-nodes="${h.escapeHtml(nodes)}" data-style="${h.escapeHtml(style)}"` +
    (look === "columns" ? ` data-depth="${Math.min(levels, MAX_COLUMNS)}"` : "") +
    h.attr("id", n.params.id);

  return (
    `<div class="jot-figure"${figure}><div class="jot-tree"${tree}>${body}</div></div>` +
    (nested ? `<div class="jot-nested">${nested}</div>` : "")
  );
}
