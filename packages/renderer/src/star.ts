// @star_model — one thing in the middle, the things that describe it around it.
//
// The only radial figure in the language, and the only one where CSS cannot be
// told the arrangement: a grid cannot say "at four o'clock". So the renderer
// computes the positions — which it can, because it already measures text
// (ARC-15) — and hands the browser coordinates.
//
// Three decisions worth stating:
//
//   The ellipse is sized, not guessed. Dimensions are placed, then checked for
//   overlap, and the ellipse grows a row at a time until nothing collides. A
//   fixed radius looks right for four dimensions and puts nine on top of each
//   other, and "it depends on the content" is exactly what a renderer that
//   measures is for.
//
//   The figure spans the printable width, like every other plate. So the
//   horizontal radius comes from the page and the vertical radius from the
//   content — a wide, flat ellipse rather than a circle, which is also the
//   shape that costs a portrait page the least height.
//
//   `layout=list` is a real second form, not a fallback with an apology. A
//   star model with fifteen dimensions is a list of fifteen dimensions, and
//   drawing it as a wheel of tiny text helps nobody.

import { ESTIMATE_SAFETY, measureText, type Face } from "./measure.js";
import { figureAttrs, placeFigure, ROW, wholeRows } from "./figure.js";
import { PAGE } from "./page.js";
import type { Placement, Size } from "./figure.js";
import type { BlockNode, TreeNode } from "./ast.js";
import type { Diagnostic } from "./index.js";

/** Every length the renderer and the stylesheet both need. */
export const STAR = {
  row: ROW,
  /** The fact, in the middle. */
  factSize: 15,
  factPadX: 14,
  /** A field inside the fact. */
  fieldSize: 12,
  /** A dimension, around the outside. */
  dimSize: 14,
  dimPadX: 12,
  /** Clear space between the fact's edge and a dimension's. */
  gap: 24,
  /** How far the ellipse may grow looking for room before it gives up. */
  maxGrowRows: 14,
} as const;

export interface Dim {
  label: string;
  /** Clock position 1–12 when the author named one. */
  clock: number | null;
}

export interface StarModel {
  title: string;
  fact: string;
  fields: string[];
  dims: Dim[];
  list: boolean;
}

/** Clock face and the compass words people write instead. */
const ANCHORS: Record<string, number> = {
  top: 12, n: 12, north: 12,
  "top-right": 1.5, ne: 1.5, northeast: 1.5,
  right: 3, e: 3, east: 3,
  "bottom-right": 4.5, se: 4.5, southeast: 4.5,
  bottom: 6, s: 6, south: 6,
  "bottom-left": 7.5, sw: 7.5, southwest: 7.5,
  left: 9, w: 9, west: 9,
  "top-left": 10.5, nw: 10.5, northwest: 10.5,
};

/** `Agents at 4` or `Agents at top-right` → the label and where it goes. */
export function readDim(text: string, diagnostics: Diagnostic[], at: TreeNode["position"]): Dim {
  const m = /^(.*?)\s+at\s+([A-Za-z0-9-]+)\s*$/i.exec(text.trim());
  if (!m) return { label: text.trim(), clock: null };

  const where = m[2]!.toLowerCase();
  const named = ANCHORS[where];
  if (named !== undefined) return { label: m[1]!.trim(), clock: named };

  const hour = Number(where);
  if (Number.isFinite(hour) && hour >= 1 && hour <= 12) {
    return { label: m[1]!.trim(), clock: hour };
  }

  // "at" is an ordinary word; only a real position takes it.
  diagnostics.push({
    severity: "warning",
    message: `"${where}" is not a position, so "${m[1]!.trim()}" is placed in written order instead. Positions are 1–12 on a clock face, or top, right, bottom, left and the corners.`,
    line: at.line,
    column: at.column,
  });
  return { label: text.trim(), clock: null };
}

export function buildStar(n: BlockNode, diagnostics: Diagnostic[]): StarModel {
  const fields = n.body.shape === "mixed" ? n.body.fields : [];
  const roots = n.body.shape === "mixed" ? n.body.roots : [];

  let fact = "";
  let factFields: string[] = [];
  const dims: Dim[] = [];

  for (const f of fields) {
    const key = f.key.toLowerCase();
    if (key === "fact") {
      fact = f.value;
      factFields = f.children.map((c) => c.text);
      continue;
    }
    if (key === "dim" || key === "dims") {
      // The terse form: `dim: Customer, Product, Date`.
      for (const part of f.value.split(",").map((s) => s.trim()).filter(Boolean)) {
        dims.push({ label: part, clock: null });
      }
      continue;
    }
    diagnostics.push({
      severity: "warning",
      message: `\`${f.key}\` is not part of a star model. The body is one \`fact:\` and any number of \`dim\` lines.`,
      line: f.position.line,
      column: f.position.column,
    });
  }

  for (const root of roots) {
    const text = root.text.trim();
    if (!/^dim\b/i.test(text)) {
      diagnostics.push({
        severity: "warning",
        message: `"${text}" is drawn as a dimension. Write \`dim ${text}\` to say so.`,
        line: root.position.line,
        column: root.position.column,
      });
      dims.push(readDim(text, diagnostics, root.position));
      continue;
    }
    dims.push(readDim(text.replace(/^dim\s+/i, ""), diagnostics, root.position));
  }

  if (!fact) {
    diagnostics.push({
      severity: "warning",
      message: "This star model has no centre. Name it with `fact: Orders` — everything else points at it.",
      line: n.position.line,
      column: n.position.column,
    });
  }
  if (dims.length === 0) {
    diagnostics.push({
      severity: "warning",
      message: "This star model has no dimensions. Each one is a line: `dim Customer`, or `dim Customer at 3` to place it.",
      line: n.position.line,
      column: n.position.column,
    });
  }

  return {
    title: n.title ?? "",
    fact,
    fields: factFields,
    dims,
    list: n.params.layout === "list",
  };
}

const width = (text: string, face: Face, size: number): number =>
  measureText(text, face, size) * ESTIMATE_SAFETY;

export interface Box {
  label: string;
  /** Top-left, in figure coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StarMetrics extends Size {
  fact: Box;
  dims: Box[];
  /** Height of the plot alone: the figure less its title row. */
  plotH: number;
}

/** Where a dimension sits on the clock, in radians, 12 o'clock up. */
export function angleOf(d: Dim, i: number, n: number): number {
  const clock = d.clock ?? (12 * i) / Math.max(1, n);
  return ((clock % 12) / 12) * Math.PI * 2 - Math.PI / 2;
}

const overlap = (a: Box, b: Box, pad: number): boolean =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

export function measureStar(m: StarModel, pinned = "auto"): StarMetrics {
  const factW = width(m.fact, "lora-600", STAR.factSize) + STAR.factPadX * 2;
  const fieldW = Math.max(0, ...m.fields.map((f) => width(f, "lora-400", STAR.fieldSize)));
  const fact: Box = {
    label: m.fact,
    x: 0,
    y: 0,
    w: Math.max(factW, fieldW + STAR.factPadX * 2),
    h: (1 + m.fields.length) * ROW,
  };

  const sizes = m.dims.map((d) => ({
    label: d.label,
    w: width(d.label, "lora-400", STAR.dimSize) + STAR.dimPadX * 2,
    h: ROW,
  }));
  const widestDim = Math.max(0, ...sizes.map((s) => s.w));

  const room =
    pinned === "landscape"
      ? PAGE.landscape.content
      : pinned === "column" || pinned === "wide"
        ? PAGE.portrait.column
        : PAGE.portrait.content;
  // The figure spans the page, so the horizontal radius comes from the page.
  // It only grows past it when one label genuinely needs more.
  const needed = fact.w + widestDim * 2 + STAR.gap * 2;
  const w = Math.max(room, needed);
  const rx = Math.max((w - widestDim) / 2, fact.w / 2 + widestDim / 2 + STAR.gap);

  // The vertical radius starts at the least that clears the fact box and grows
  // a row at a time until nothing collides. A fixed radius looks right for
  // four dimensions and stacks nine on top of each other.
  const base = fact.h / 2 + ROW + STAR.gap;
  let ry = base;
  let dims: Box[] = [];
  for (let step = 0; step <= STAR.maxGrowRows; step++) {
    ry = base + step * ROW;
    dims = m.dims.map((d, i) => {
      const a = angleOf(d, i, m.dims.length);
      const s = sizes[i]!;
      return {
        label: d.label,
        w: s.w,
        h: s.h,
        x: Math.cos(a) * rx - s.w / 2,
        y: Math.sin(a) * ry - s.h / 2,
      };
    });
    const centre: Box = { label: "", x: -fact.w / 2, y: -fact.h / 2, w: fact.w, h: fact.h };
    const clash =
      dims.some((d) => overlap(d, centre, STAR.gap / 2)) ||
      dims.some((d, i) => dims.slice(i + 1).some((e) => overlap(d, e, 8)));
    if (!clash) break;
  }

  // Everything has been placed around (0, 0); move it into the PLOT's box,
  // where the top left is the origin. The title sits above the plot and is
  // counted into the figure's height but not into these coordinates.
  const plotH = wholeRows(2 * ry + ROW);
  const cx = w / 2;
  const cy = plotH / 2;
  return {
    w,
    h: plotH + (m.title ? ROW : 0),
    plotH,
    fact: { ...fact, x: cx - fact.w / 2, y: cy - fact.h / 2 },
    dims: dims.map((d) => ({ ...d, x: d.x + cx, y: d.y + cy })),
  };
}

/**
 * Where a line from the centre of `from` towards the centre of `to` leaves
 * `from`'s edge. Connectors are drawn between edges rather than centres, so
 * they do not run underneath the boxes they join.
 */
function edge(from: Box, to: Box): { x: number; y: number } {
  const fx = from.x + from.w / 2;
  const fy = from.y + from.h / 2;
  const dx = to.x + to.w / 2 - fx;
  const dy = to.y + to.h / 2 - fy;
  if (dx === 0 && dy === 0) return { x: fx, y: fy };
  // How far along the ray the box's own half-width and half-height are, and
  // whichever comes first is the side it leaves by.
  const t = Math.min(
    dx === 0 ? Infinity : from.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : from.h / 2 / Math.abs(dy),
  );
  return { x: fx + dx * t, y: fy + dy * t };
}

export interface StarHelpers {
  inline: (text: string) => string;
  escapeHtml: (s: string) => string;
  attr: (name: string, value: string | undefined) => string;
}

export function renderStar(
  n: BlockNode,
  diagnostics: Diagnostic[],
  h: StarHelpers,
  nested: string,
): string {
  const model = buildStar(n, diagnostics);
  const pinned = n.params.width ?? "auto";
  const metrics = measureStar(model, pinned);
  const place: Placement = placeFigure(metrics, pinned, n, diagnostics, {
    noun: "star model",
    hint: "`layout=list` writes it out instead, and fits any number of dimensions.",
    sized: !model.list,
  });

  const title = model.title ? `<p class="jot-star-title">${h.inline(model.title)}</p>` : "";
  const fields = model.fields
    .map((f) => `<p class="jot-star-field">${h.inline(f)}</p>`)
    .join("");

  if (model.list) {
    return (
      `<div class="jot-figure" data-figure="star_model"${figureAttrs(place, metrics, false)}>` +
      `<div class="jot-star" data-layout="list"${h.attr("id", n.params.id)}>` +
      title +
      `<p class="jot-star-fact">${h.inline(model.fact)}</p>${fields}` +
      `<ul class="jot-star-list">` +
      model.dims.map((d) => `<li>${h.inline(d.label)}</li>`).join("") +
      `</ul></div></div>` +
      (nested ? `<div class="jot-nested">${nested}</div>` : "")
    );
  }

  const at = (b: Box): string =>
    ` style="left:calc(${b.x} * var(--u, 1px));top:calc(${b.y} * var(--u, 1px));width:calc(${b.w} * var(--u, 1px))"`;

  // Connectors first, so the boxes paint over their ends.
  const lines = metrics.dims
    .map((d) => {
      const a = edge(metrics.fact, d);
      const b = edge(d, metrics.fact);
      return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" vector-effect="non-scaling-stroke" />`;
    })
    .join("");

  return (
    `<div class="jot-figure" data-figure="star_model" data-fill${figureAttrs(place, metrics)}>` +
    `<div class="jot-star" data-layout="clock"${h.attr("id", n.params.id)}>` +
    title +
    `<div class="jot-star-plot" style="height:calc(${metrics.plotH} * var(--u, 1px))">` +
    `<svg class="jot-star-lines" viewBox="0 0 ${metrics.w} ${metrics.plotH}" aria-hidden="true">${lines}</svg>` +
    `<div class="jot-star-fact"${at(metrics.fact)}>` +
    `<p class="jot-star-name">${h.inline(model.fact)}</p>${fields}</div>` +
    metrics.dims
      .map((d) => `<div class="jot-star-dim"${at(d)}>${h.inline(d.label)}</div>`)
      .join("") +
    `</div></div></div>` +
    (nested ? `<div class="jot-nested">${nested}</div>` : "")
  );
}
