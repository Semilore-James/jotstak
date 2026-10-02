// WordprocessingML, written as strings.
//
// One thing about the format shapes everything here: the children of a
// property element have a FIXED ORDER in the schema. Word is strict about it —
// a paragraph whose spacing comes before its numbering is enough for Word to
// call the whole file damaged — while every other reader is forgiving, so a
// file can open fine everywhere it is tested and fail on the one program it
// is for. So properties are never concatenated by hand. Each builder below
// takes an object and writes its fields in schema order.

import { tokens } from "@jotstak/renderer";

// ── Units ────────────────────────────────────────────────────────────────
// The page is designed in CSS pixels, 96 to the inch. Word measures in
// twips (1/20 pt), half-points for type, eighths of a point for borders and
// EMUs for pictures. 1px = 0.75pt.

export const ROW = tokens.spacing.baselineGrid;
/** CSS px to twips. */
export const tw = (px: number): number => Math.round(px * 15);
/** CSS px to half-points, Word's unit for type size. */
export const hp = (px: number): number => Math.round(px * 1.5);
/** CSS px to eighths of a point, Word's unit for a border's width. */
export const eighths = (px: number): number => Math.max(2, Math.round(px * 6));
/** CSS px to English Metric Units, for pictures. */
export const emu = (px: number): number => Math.round(px * 9525);

/** A colour token as Word writes it: six hex digits, no hash. */
export const hex = (color: string): string => color.replace(/^#/, "").toUpperCase();

export const C = {
  ink: hex(tokens.colors.doc.ink),
  muted: hex(tokens.colors.doc.inkMuted),
  hairline: hex(tokens.colors.doc.sheetBorder),
  accent: hex(tokens.colors.accent.terracotta),
  accentPale: hex(tokens.colors.accent.terracottaPale),
  slate: hex(tokens.colors.accent.slateBlue),
  sage: hex(tokens.colors.accent.sage),
  sepia: hex(tokens.colors.accent.sepia),
} as const;

export const FONT = {
  body: "Lora",
  label: "Inter",
  mono: "IBM Plex Mono",
} as const;

// ── Text ─────────────────────────────────────────────────────────────────

/**
 * Escape for XML, and drop what XML 1.0 cannot hold at all. A stray control
 * character pasted into a source file would otherwise make Word refuse the
 * whole document rather than the one character.
 */
export const esc = (s: string): string =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const on = (name: string, value: boolean | undefined): string => (value ? `<w:${name}/>` : "");
const val = (name: string, value: string | number | undefined): string =>
  value === undefined ? "" : `<w:${name} w:val="${esc(String(value))}"/>`;

// ── Runs ─────────────────────────────────────────────────────────────────

export interface RunProps {
  style?: string;
  font?: string;
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  strike?: boolean;
  color?: string;
  /** Letter-spacing, in twips. */
  tracking?: number;
  /** Half-points. */
  size?: number;
  underline?: boolean;
  /** Background fill, for `==highlight==`. */
  fill?: string;
}

export function rPr(p: RunProps): string {
  const fonts = p.font
    ? `<w:rFonts w:ascii="${esc(p.font)}" w:hAnsi="${esc(p.font)}" w:eastAsia="${esc(p.font)}" w:cs="${esc(p.font)}"/>`
    : "";
  const inner =
    val("rStyle", p.style) +
    fonts +
    (p.bold ? "<w:b/><w:bCs/>" : "") +
    (p.italic ? "<w:i/><w:iCs/>" : "") +
    on("caps", p.caps) +
    on("strike", p.strike) +
    val("color", p.color) +
    val("spacing", p.tracking) +
    (p.size ? `<w:sz w:val="${p.size}"/><w:szCs w:val="${p.size}"/>` : "") +
    (p.underline ? `<w:u w:val="single"/>` : "") +
    (p.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${p.fill}"/>` : "");
  return inner ? `<w:rPr>${inner}</w:rPr>` : "";
}

/** One run of text. Tabs and line breaks become Word's own elements. */
export function run(text: string, p: RunProps = {}): string {
  if (!text) return "";
  const body = text
    .split(/(\t|\n)/)
    .map((part) =>
      part === "\t" ? "<w:tab/>" : part === "\n" ? "<w:br/>" : part ? `<w:t xml:space="preserve">${esc(part)}</w:t>` : "",
    )
    .join("");
  return `<w:r>${rPr(p)}${body}</w:r>`;
}

export const lineBreak = (): string => "<w:r><w:br/></w:r>";
export const pageBreak = (): string => `<w:r><w:br w:type="page"/></w:r>`;

// ── Borders ──────────────────────────────────────────────────────────────

export interface Border {
  /** single, dotted, wave… */
  style?: string;
  /** Width in CSS px. */
  px: number;
  color: string;
  /** Space between the border and the text, in points (paragraphs only). */
  space?: number;
}

const border = (side: string, b: Border | undefined): string =>
  b
    ? `<w:${side} w:val="${b.style ?? "single"}" w:sz="${eighths(b.px)}" w:space="${b.space ?? 0}" w:color="${b.color}"/>`
    : "";

export interface Sides {
  top?: Border;
  left?: Border;
  bottom?: Border;
  right?: Border;
}

const noBorders = (sides: string[]): string => sides.map((s) => `<w:${s} w:val="nil"/>`).join("");

// ── Paragraphs ───────────────────────────────────────────────────────────

export interface Spacing {
  before?: number;
  after?: number;
  /** Twips. */
  line?: number;
  rule?: "auto" | "exact" | "atLeast";
}

export interface ParaProps {
  style?: string;
  keepNext?: boolean;
  keepLines?: boolean;
  numbering?: { id: number; level: number };
  borders?: Sides;
  /** Background fill. */
  fill?: string;
  spacing?: Spacing;
  indent?: { left?: number; right?: number; hanging?: number };
  align?: "left" | "center" | "right" | "both";
  outline?: number;
  /** Run properties for the paragraph mark itself. */
  mark?: RunProps;
  /** The section this paragraph ends. */
  section?: string;
}

export function pPr(p: ParaProps): string {
  const s = p.spacing;
  const spacing =
    s && (s.before !== undefined || s.after !== undefined || s.line !== undefined)
      ? `<w:spacing${s.before !== undefined ? ` w:before="${s.before}"` : ""}${s.after !== undefined ? ` w:after="${s.after}"` : ""}${s.line !== undefined ? ` w:line="${s.line}" w:lineRule="${s.rule ?? "auto"}"` : ""}/>`
      : "";
  const i = p.indent;
  const indent =
    i && (i.left || i.right || i.hanging)
      ? `<w:ind${i.left ? ` w:left="${i.left}"` : ""}${i.right ? ` w:right="${i.right}"` : ""}${i.hanging ? ` w:hanging="${i.hanging}"` : ""}/>`
      : "";
  const b = p.borders;
  const borders =
    b && (b.top || b.left || b.bottom || b.right)
      ? `<w:pBdr>${border("top", b.top)}${border("left", b.left)}${border("bottom", b.bottom)}${border("right", b.right)}</w:pBdr>`
      : "";
  const inner =
    val("pStyle", p.style) +
    on("keepNext", p.keepNext) +
    on("keepLines", p.keepLines) +
    (p.numbering ? `<w:numPr><w:ilvl w:val="${p.numbering.level}"/><w:numId w:val="${p.numbering.id}"/></w:numPr>` : "") +
    borders +
    (p.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${p.fill}"/>` : "") +
    spacing +
    indent +
    val("jc", p.align) +
    val("outlineLvl", p.outline) +
    (p.mark ? rPr(p.mark) : "") +
    (p.section ?? "");
  return inner ? `<w:pPr>${inner}</w:pPr>` : "";
}

// ── Tables ───────────────────────────────────────────────────────────────

export interface Margins {
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
}

const margins = (tag: string, m: Margins | undefined): string =>
  m
    ? `<w:${tag}>${(["top", "left", "bottom", "right"] as const)
        .map((side) => (m[side] !== undefined ? `<w:${side} w:w="${m[side]}" w:type="dxa"/>` : ""))
        .join("")}</w:${tag}>`
    : "";

export interface TableProps {
  /** Twips, or "auto" to fill the width. */
  width: number | "full";
  indent?: number;
  borders?: Sides & { insideH?: Border; insideV?: Border };
  /** Fixed column widths rather than Word re-measuring the content. */
  fixed?: boolean;
  cellMargins?: Margins;
}

export function tblPr(p: TableProps): string {
  const width = p.width === "full" ? `<w:tblW w:w="5000" w:type="pct"/>` : `<w:tblW w:w="${p.width}" w:type="dxa"/>`;
  const b = p.borders ?? {};
  const borders =
    `<w:tblBorders>` +
    (b.top ? border("top", b.top) : noBorders(["top"])) +
    (b.left ? border("left", b.left) : noBorders(["left"])) +
    (b.bottom ? border("bottom", b.bottom) : noBorders(["bottom"])) +
    (b.right ? border("right", b.right) : noBorders(["right"])) +
    (b.insideH ? border("insideH", b.insideH) : noBorders(["insideH"])) +
    (b.insideV ? border("insideV", b.insideV) : noBorders(["insideV"])) +
    `</w:tblBorders>`;
  return (
    `<w:tblPr>${width}` +
    (p.indent ? `<w:tblInd w:w="${p.indent}" w:type="dxa"/>` : "") +
    borders +
    `<w:tblLayout w:type="${p.fixed ? "fixed" : "autofit"}"/>` +
    margins("tblCellMar", p.cellMargins ?? { top: 0, left: 0, bottom: 0, right: 0 }) +
    `<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>` +
    `</w:tblPr>`
  );
}

export interface CellProps {
  width: number;
  borders?: Sides;
  fill?: string;
  margins?: Margins;
}

export function tcPr(p: CellProps): string {
  const b = p.borders;
  const borders =
    b && (b.top || b.left || b.bottom || b.right)
      ? `<w:tcBorders>${border("top", b.top)}${border("left", b.left)}${border("bottom", b.bottom)}${border("right", b.right)}</w:tcBorders>`
      : "";
  return (
    `<w:tcPr><w:tcW w:w="${p.width}" w:type="dxa"/>` +
    borders +
    (p.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${p.fill}"/>` : "") +
    margins("tcMar", p.margins) +
    `</w:tcPr>`
  );
}

// ── The page ─────────────────────────────────────────────────────────────

export interface PageSize {
  /** Twips. */
  width: number;
  height: number;
  marginX: number;
  marginY: number;
  landscape: boolean;
}

export const sectPr = (page: PageSize): string =>
  `<w:sectPr>` +
  `<w:type w:val="nextPage"/>` +
  `<w:pgSz w:w="${page.width}" w:h="${page.height}"${page.landscape ? ` w:orient="landscape"` : ""}/>` +
  `<w:pgMar w:top="${page.marginY}" w:right="${page.marginX}" w:bottom="${page.marginY}" w:left="${page.marginX}" w:header="0" w:footer="0" w:gutter="0"/>` +
  `<w:cols w:space="720"/>` +
  `</w:sectPr>`;

export const NS =
  `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
  `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
  `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
  `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
  `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;

export const XML_HEAD = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
