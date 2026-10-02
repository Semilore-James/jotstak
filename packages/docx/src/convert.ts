// A document's blocks, as Word content.
//
// What becomes what (PRD-31, UX-70):
//
//   headings, prose, lists, quotes, tables   real Word content, editable
//   cards, callouts, covers, columns         one-cell (or one-row) tables,
//                                            drawn as doc mode draws them
//   diagrams and sticky walls                pictures, drawn by the page itself
//   margin notes                             Word comments, in the margin
//
// The page is the reference throughout: doc mode, measured. Where Word cannot
// do what the page does, the nearest thing it can do is chosen and the reason
// is written beside it.

import { PAGE, buildTable, isCard, readCard, readCover, rowsOf, TREND } from "@jotstak/renderer";
import type {
  BlockNode,
  DocumentNode,
  Field,
  HeadingNode,
  ListNode,
  MarginNoteNode,
  Node,
  QuoteNode,
  Row,
  TreeNode,
} from "@jotstak/renderer";
import { HEADINGS, KICKER, LABEL, Numbering, ROW_TW } from "./styles.js";
import {
  C,
  FONT,
  ROW,
  emu,
  esc,
  hp,
  lineBreak,
  pPr,
  pageBreak,
  rPr,
  run,
  sectPr,
  tblPr,
  tcPr,
  tw,
} from "./xml.js";
import type { Border, CellProps, PageSize, ParaProps, RunProps, TableProps } from "./xml.js";

// ── The page ─────────────────────────────────────────────────────────────

const A4 = { short: 11906, long: 16838 };

/** The PDF's own margins, so lines and diagrams are the width they are on screen (UX-70). */
export const PORTRAIT: PageSize = {
  width: A4.short,
  height: A4.long,
  marginX: tw(PAGE.marginX),
  marginY: tw(PAGE.portrait.marginY),
  landscape: false,
};
/** A landscape sheet keeps the portrait top margin, as the printed one does (ENG-36). */
export const LANDSCAPE: PageSize = { ...PORTRAIT, width: A4.long, height: A4.short, landscape: true };

const textWidth = (p: PageSize): number => p.width - 2 * p.marginX;
const textHeight = (p: PageSize): number => p.height - 2 * p.marginY;

// ── What a block turns into ──────────────────────────────────────────────

export interface Para {
  kind: "p";
  props: ParaProps;
  runs: string;
  /** Markers before and after the runs: bookmarks, a comment's range. */
  open: string;
  close: string;
}

export interface Cell {
  props: CellProps;
  items: Item[];
}

export interface TableRow {
  cantSplit?: boolean;
  header?: boolean;
  cells: Cell[];
}

export interface Table {
  kind: "tbl";
  props: TableProps;
  grid: number[];
  rows: TableRow[];
}

export type Item = Para | Table;

export const para = (runs: string, props: ParaProps = {}): Para => ({ kind: "p", props, runs, open: "", close: "" });

/** A row of space, as its own paragraph. See the Gap style. */
const gapPara = (): Para => para("", { style: "Gap" });

// ── Pictures ─────────────────────────────────────────────────────────────

/** A figure drawn as a picture, by whatever can draw the page. */
export interface Picture {
  png: Uint8Array;
  /** The size to show it at, in CSS pixels. Text in it is then the size of the text around it. */
  width: number;
  height: number;
  /** It needs a landscape sheet of its own, as it gets in print. */
  landscape?: boolean;
}

export interface PictureRequest {
  /** The room it has, in CSS pixels. */
  width: number;
  /** Whether it may have a landscape page: only a figure on the page itself, not one inside a card. */
  landscape: boolean;
}

/**
 * Draws a figure. Given the blocks to draw — one figure, or one wall of
 * stickies — it returns a picture, or nothing, in which case the figure's
 * content is written out as text instead. The browser does this with the
 * page's own renderer and stylesheet, so a diagram in Word is the diagram on
 * the page, not a second drawing of it.
 */
export type DrawPicture = (nodes: Node[], request: PictureRequest) => Promise<Picture | undefined>;

const FIGURES = new Set(["tree", "matrix", "timeline", "journey", "star_model"]);

// ── Context ──────────────────────────────────────────────────────────────

/** The few parts of a markdown-it token this reads. */
interface Tok {
  type: string;
  tag: string;
  content: string;
  hidden: boolean;
  children: Tok[] | null;
  attrGet(name: string): string | null;
}

interface Markdown {
  parse(src: string, env: object): unknown[];
  parseInline(src: string, env: object): unknown[];
}

export interface Relationship {
  id: string;
  type: string;
  target: string;
  external?: boolean;
}

const REL = {
  hyperlink: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
  image: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
};

export class Context {
  readonly numbering = new Numbering();
  readonly rels: Relationship[] = [];
  readonly comments: string[] = [];
  readonly media: { path: string; data: Uint8Array }[] = [];
  private drawings = 0;
  private bookmarks = 0;
  private readonly links = new Map<string, string>();

  constructor(
    readonly md: Markdown,
    /** Whether a single newline in prose is a line break (`@page breaks=off` says not). */
    readonly breaks: boolean,
    /** The name every comment carries: the document's author, else "Note" (UX-70). */
    readonly author: string,
    readonly picture?: DrawPicture,
  ) {}

  private rel(type: string, target: string, external = false): string {
    // rId1 to rId9 are the fixed parts: styles, numbering, settings, fonts, comments.
    const id = `rId${this.rels.length + 10}`;
    this.rels.push({ id, type, target, external });
    return id;
  }

  /** A link: to a heading or block in this document by its id, or out to the web. */
  hyperlink(href: string, runs: string): string {
    if (href.startsWith("#")) return `<w:hyperlink w:anchor="${esc(bookmarkName(href.slice(1)))}">${runs}</w:hyperlink>`;
    let id = this.links.get(href);
    if (!id) {
      id = this.rel(REL.hyperlink, href, true);
      this.links.set(href, id);
    }
    return `<w:hyperlink r:id="${id}" w:history="1">${runs}</w:hyperlink>`;
  }

  image(png: Uint8Array): { rel: string; n: number } {
    const n = ++this.drawings;
    const path = `media/figure${n}.png`;
    this.media.push({ path, data: png });
    return { rel: this.rel(REL.image, path), n };
  }

  /** Mark a paragraph as a place a link can jump to: the block's `id`. */
  bookmark(p: Para | undefined, name: string | undefined): void {
    if (!p || !name) return;
    const id = this.bookmarks++;
    p.open = `<w:bookmarkStart w:id="${id}" w:name="${esc(bookmarkName(name))}"/>` + p.open;
    p.close += `<w:bookmarkEnd w:id="${id}"/>`;
  }

  /** A margin note, as a comment on the paragraph it was written after. */
  comment(note: MarginNoteNode, anchor: Para): void {
    const id = this.comments.length;
    const ref = `<w:r>${rPr({ style: "CommentReference" })}<w:annotationRef/></w:r>`;
    const words = inline(note.lines.join(" "), {}, this);
    this.comments.push(
      `<w:comment w:id="${id}" w:author="${esc(this.author)}" w:initials="${esc(initials(this.author))}">` +
        `<w:p>${pPr({ style: "CommentText" })}${ref}${words}</w:p>` +
        `</w:comment>`,
    );
    anchor.open = `<w:commentRangeStart w:id="${id}"/>` + anchor.open;
    anchor.close +=
      `<w:commentRangeEnd w:id="${id}"/>` +
      `<w:r>${rPr({ style: "CommentReference" })}<w:commentReference w:id="${id}"/></w:r>`;
  }
}

/** Word's rules for a bookmark: a letter first, then letters, digits and underscores, 40 at most. */
export function bookmarkName(id: string): string {
  const name = id.replace(/[^A-Za-z0-9_]/g, "_");
  return (/^[A-Za-z]/.test(name) ? name : `id_${name}`).slice(0, 40);
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 3) || "N";

/** Where a block is being placed. */
interface Where {
  /** Twips of room. */
  width: number;
  /** Twips in from the left, inside a list item. */
  indent: number;
  /** On the page itself, rather than inside a card, a column or a list. */
  top: boolean;
}

// ── Inline text ──────────────────────────────────────────────────────────

/** Markdown's inline tokens, as Word runs. */
function inlineTokens(tokens: Tok[], base: RunProps, ctx: Context): string {
  let out = "";
  const links: { href: string; buf: string }[] = [];
  let bold = 0;
  let italic = 0;
  let strike = 0;
  let mark = 0;
  const props = (): RunProps => ({
    ...base,
    bold: base.bold || bold > 0 || undefined,
    italic: base.italic || italic > 0 || undefined,
    strike: strike > 0 || undefined,
    fill: mark > 0 ? C.accentPale : base.fill,
    ...(links.length > 0 ? { style: "Hyperlink", color: undefined } : {}),
  });
  const emit = (s: string): void => {
    const open = links[links.length - 1];
    if (open) open.buf += s;
    else out += s;
  };
  for (const t of tokens) {
    switch (t.type) {
      case "text":
        emit(run(t.content, props()));
        break;
      case "softbreak":
        emit(ctx.breaks ? lineBreak() : run(" ", props()));
        break;
      case "hardbreak":
        emit(lineBreak());
        break;
      case "strong_open":
        bold++;
        break;
      case "strong_close":
        bold--;
        break;
      case "em_open":
        italic++;
        break;
      case "em_close":
        italic--;
        break;
      case "s_open":
        strike++;
        break;
      case "s_close":
        strike--;
        break;
      case "mark_open":
        mark++;
        break;
      case "mark_close":
        mark--;
        break;
      case "code_inline":
        emit(run(t.content, { ...props(), font: FONT.mono, size: hp(13) }));
        break;
      case "link_open":
        links.push({ href: t.attrGet("href") ?? "", buf: "" });
        break;
      case "link_close": {
        const link = links.pop();
        if (link) emit(link.href ? ctx.hyperlink(link.href, link.buf) : link.buf);
        break;
      }
      case "image":
        // A picture by address cannot be fetched from here; its words stand in.
        emit(run(t.content, props()));
        break;
      default:
        if (t.content) emit(run(t.content, props()));
    }
  }
  for (const link of links) out += link.buf;
  return out;
}

export function inline(text: string, base: RunProps, ctx: Context): string {
  const [root] = ctx.md.parseInline(text, {}) as Tok[];
  return inlineTokens(root?.children ?? [], base, ctx);
}

// ── Block-level Markdown ─────────────────────────────────────────────────

/** The space after a block: on its last paragraph, or a Gap paragraph after a table. */
function gapAfter(items: Item[], twips = ROW_TW): void {
  const last = items[items.length - 1];
  if (!last) return;
  if (last.kind === "tbl") {
    items.push(gapPara());
    return;
  }
  const spacing = last.props.spacing ?? {};
  last.props = { ...last.props, spacing: { ...spacing, after: Math.max(spacing.after ?? 0, twips) } };
}

const listIndent = (where: Where, level: number) => ({
  left: where.indent + ROW_TW * (level + 1),
  hanging: ROW_TW,
});

/**
 * Prose: paragraphs, Markdown lists, quotes, code, pasted tables. A blank
 * line between two paragraphs is a row of space, as it is in every Markdown
 * renderer and every Word document.
 */
function markdown(text: string, where: Where, ctx: Context, quote = false): Item[] {
  const tokens = ctx.md.parse(text, {}) as Tok[];
  const items: Item[] = [];
  const lists: { num: number }[] = [];
  let quotes = quote ? 1 : 0;
  let marker: { id: number; level: number } | undefined;
  /** Nothing written yet since a quote opened: its first paragraph needs no space above. */
  let fresh = true;
  // A new block at the outer level gets a row of space above it.
  const startBlock = (): void => {
    if (lists.length === 0 && items.length > 0) gapAfter(items);
    fresh = false;
  };
  const props = (base: ParaProps = {}): ParaProps => {
    if (marker) {
      const p = { ...base, numbering: marker, indent: listIndent(where, marker.level) };
      marker = undefined;
      return p;
    }
    if (lists.length > 0) return { ...base, indent: { left: where.indent + ROW_TW * lists.length } };
    if (quotes > 0) return { ...base, style: "Quote", indent: { left: where.indent + ROW_TW } };
    return where.indent ? { ...base, indent: { left: where.indent } } : base;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    switch (t.type) {
      case "bullet_list_open":
      case "ordered_list_open":
        startBlock();
        lists.push({
          num: t.type === "bullet_list_open" ? ctx.numbering.bullets : ctx.numbering.numbered(Number(t.attrGet("start") ?? 1)),
        });
        break;
      case "bullet_list_close":
      case "ordered_list_close":
        lists.pop();
        break;
      case "list_item_open":
        marker = { id: lists[lists.length - 1]!.num, level: lists.length - 1 };
        break;
      case "blockquote_open":
        if (quotes === 0) startBlock();
        quotes++;
        fresh = true;
        break;
      case "blockquote_close":
        quotes--;
        break;
      case "heading_open": {
        startBlock();
        const level = Math.min(6, Number(t.tag.slice(1)) || 1);
        const words = tokens[i + 1]?.children ?? [];
        items.push(para(inlineTokens(words, {}, ctx), { style: `Heading${level}`, indent: where.indent ? { left: where.indent } : undefined }));
        i += 2;
        break;
      }
      case "paragraph_open": {
        // A paragraph after another is a blank line in the source: a row of space.
        if (fresh) fresh = false;
        else startBlock();
        const words = tokens[i + 1]?.children ?? [];
        items.push(para(inlineTokens(words, {}, ctx), props()));
        i += 2;
        break;
      }
      case "fence":
      case "code_block":
        startBlock();
        items.push(codeBlock(t.content, where));
        break;
      case "hr":
        startBlock();
        items.push(divider("line", where));
        break;
      case "table_open": {
        startBlock();
        let end = i;
        while (end < tokens.length && tokens[end]!.type !== "table_close") end++;
        items.push(pastedTable(tokens.slice(i, end + 1), where, ctx));
        i = end;
        break;
      }
      default:
        if (t.type === "inline" && t.content) items.push(para(run(t.content), props()));
    }
  }
  return items;
}

function codeBlock(text: string, where: Where): Table {
  const lines = text.replace(/\n$/, "").split("\n");
  const runs = lines.map((l, i) => (i > 0 ? lineBreak() : "") + run(l, { font: FONT.mono, size: hp(15) })).join("");
  // Doc mode draws code with a grey rule down its left side, inset.
  return box([para(runs, { style: "Code" })], where, {
    borders: { left: { px: 2, color: C.hairline } },
    margins: { top: tw(ROW / 2), bottom: tw(ROW / 2), left: tw(ROW - 2), right: 0 },
  });
}

/** A Markdown pipe table, pasted into prose rather than written as @table. */
function pastedTable(tokens: Tok[], where: Where, ctx: Context): Table {
  const rows: { head: boolean; cells: { text: Tok[]; align: string }[] }[] = [];
  let head = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type === "thead_open") head = true;
    if (t.type === "thead_close") head = false;
    if (t.type === "tr_open") rows.push({ head, cells: [] });
    if (t.type === "th_open" || t.type === "td_open") {
      const style = t.attrGet("style") ?? "";
      const align = /center/.test(style) ? "center" : /right/.test(style) ? "right" : "left";
      rows[rows.length - 1]?.cells.push({ text: tokens[i + 1]?.children ?? [], align });
    }
  }
  const width = Math.max(1, ...rows.map((r) => r.cells.length));
  const texts = rows.map((r) => r.cells.map((c) => c.text.map((t) => t.content).join("")));
  return dataTable(
    rows.map((r) =>
      r.cells.map((c) => ({
        runs: inlineTokens(c.text, r.head ? LABEL : {}, ctx),
        align: c.align as "left" | "center" | "right",
      })),
    ),
    rows.map((r) => r.head),
    columnWidths(texts, width, where.width),
    "ruled",
    where,
  );
}

// ── Tables ───────────────────────────────────────────────────────────────

/**
 * Column widths for Word to start from. Word re-measures an autofit table
 * itself; Google Docs mostly keeps what it is given. So a column gets room in
 * proportion to its longest cell, the way a browser shares out an automatic
 * table, with a floor so a short column is never a sliver.
 */
function columnWidths(rows: string[][], cols: number, total: number): number[] {
  const want = Array.from({ length: cols }, (_, c) =>
    Math.max(4, Math.min(40, Math.max(...rows.map((r) => (r[c] ?? "").length)))),
  );
  const sum = want.reduce((a, b) => a + b, 0);
  const widths = want.map((w) => Math.floor((w / sum) * total));
  widths[widths.length - 1]! += total - widths.reduce((a, b) => a + b, 0);
  return widths;
}

function dataTable(
  rows: { runs: string; align: "left" | "center" | "right" }[][],
  head: boolean[],
  grid: number[],
  style: string,
  where: Where,
): Table {
  // Doc mode draws an ordinary table with no lines at all — the ruling it sits
  // on is the paper's, and doc mode has none. `sketch` keeps its frame.
  const line: Border = { px: 1, color: C.hairline };
  const sketch = style === "sketch";
  const pad = sketch ? tw(10) : 0;
  return {
    kind: "tbl",
    props: {
      width: grid.reduce((a, b) => a + b, 0),
      indent: where.indent || undefined,
      borders: sketch ? { top: line, left: line, bottom: line, right: line, insideH: line, insideV: line } : {},
      cellMargins: { top: 0, left: pad, bottom: 0, right: sketch ? pad : tw(ROW / 2) },
    },
    grid,
    rows: rows.map((cells, r) => ({
      header: head[r],
      cantSplit: true,
      cells: grid.map((w, c) => ({
        props: { width: w },
        items: [para(cells[c]?.runs ?? "", { align: cells[c]?.align === "left" ? undefined : cells[c]?.align, keepNext: head[r] })],
      })),
    })),
  };
}

// ── Boxes: cards, callouts, covers ───────────────────────────────────────

/**
 * A one-cell table. It keeps a card in one piece — on one page, as print
 * keeps it — and lets a rule run across its top or down its side exactly as
 * long as the card is, which a paragraph border cannot do once a card holds
 * a table of its own.
 */
function box(items: Item[], where: Where, cell: Omit<CellProps, "width">, keep = true): Table {
  const content = items.length > 0 ? items : [para("")];
  // A cell must end in a paragraph, and one that ends in a table needs one after it.
  if (content[content.length - 1]!.kind === "tbl") content.push(para("", { spacing: { line: 20, rule: "exact" } }));
  return {
    kind: "tbl",
    props: { width: where.width, indent: where.indent || undefined, fixed: true, cellMargins: { top: 0, left: 0, bottom: 0, right: 0 } },
    grid: [where.width],
    rows: [{ cantSplit: keep, cells: [{ props: { ...cell, width: where.width }, items: content }] }],
  };
}

/** Room inside a box with these side margins. */
const inside = (where: Where, left = 0, right = 0): Where => ({ width: where.width - left - right, indent: 0, top: false });

async function card(n: BlockNode, where: Where, ctx: Context): Promise<Item[]> {
  const m = readCard(n);
  const items: Item[] = [];
  const cell = inside(where);

  if (m.label || m.badge || m.date) {
    const nb = " ";
    const space = (n: number, after: boolean): string => (after ? nb.repeat(n) : "");
    const runs =
      run(m.label, KICKER) +
      (m.badge ? run(`${space(2, Boolean(m.label))}${m.badge}`, { ...KICKER, color: m.alert ? C.accent : C.muted }) : "") +
      (m.date ? run(`${space(4, Boolean(m.label || m.badge))}${m.date}`, { ...KICKER, bold: undefined }) : "");
    items.push(para(runs, { style: "Kicker" }));
  }
  if (m.title) items.push(para(inline(m.title, {}, ctx), { style: "CardTitle" }));
  if (m.metric?.value) {
    const trend = m.metric.trend ? TREND[m.metric.trend] : undefined;
    const trendColor = m.metric.trend === "up" ? C.sage : m.metric.trend === "down" ? C.accent : C.muted;
    const small: RunProps = { font: FONT.label, size: hp(12), color: C.muted };
    items.push(
      para(
        run(m.metric.value, { bold: true, size: hp(28) }) +
          (trend ? run(`  ${trend}`, { ...small, color: trendColor }) : "") +
          (m.metric.target ? run(`  target ${m.metric.target}`, small) : ""),
        { spacing: { line: tw(2 * ROW), rule: "exact" }, keepNext: true },
      ),
    );
  }
  items.push(...bodyItems(n, cell, ctx));
  await nestedAfter(n.children, items, cell, ctx);

  // Doc mode: a hairline across the top, terracotta when the card is flagged,
  // dotted when the card sits inside another (UX-70).
  const top: Border = { px: 1, color: m.alert ? C.accent : C.hairline, style: where.top ? "single" : "dotted" };
  const table = box(items, where, { borders: { top }, margins: { top: tw(13), bottom: tw(14), left: 0, right: 0 } });
  ctx.bookmark(firstPara(items), n.params.id);
  return [table];
}

const CALLOUT_COLORS: Record<string, string> = { info: C.slate, tip: C.sage, warn: C.accent, question: C.sepia };

async function callout(n: BlockNode, where: Where, ctx: Context): Promise<Item[]> {
  const flavor = n.params.flavor ?? "info";
  const color = CALLOUT_COLORS[flavor] ?? C.hairline;
  const left = tw(ROW - 2);
  const cell = inside(where, left);
  const items: Item[] = [para(run(flavor, { ...KICKER, color }), { keepNext: true })];
  const body = bodyItems(n, cell, ctx);
  items.push(...(body.length > 0 ? body : n.title ? [para(inline(n.title, {}, ctx))] : []));
  await nestedAfter(n.children, items, cell, ctx);
  ctx.bookmark(firstPara(items), n.params.id);
  return [
    box(items, where, {
      borders: { left: { px: 2, color } },
      margins: { top: tw(ROW / 2), bottom: tw(ROW / 2), left, right: 0 },
    }),
  ];
}

function cover(n: BlockNode, where: Where, ctx: Context): Item[] {
  const m = readCover(n);
  const accent: Border = { px: 1, color: C.accent };
  const title = para(inline(m.title, {}, ctx), {
    style: "Title",
    ...(m.style === "minimal"
      ? { mark: { size: hp(22) }, spacing: { line: tw(ROW), rule: "exact" as const } }
      : {}),
  });
  // A minimal cover's title comes down a size, so it is not louder than the h1 under it.
  if (m.style === "minimal") title.runs = inline(m.title, { size: hp(22), tracking: tw(-0.22) }, ctx);
  const items: Item[] = [title];
  if (m.subtitle) items.push(para(inline(m.subtitle, {}, ctx), { style: "Subtitle" }));
  ctx.bookmark(title, n.params.id);

  const air = tw(ROW - 1);
  const cell: Omit<CellProps, "width"> =
    m.style === "bold"
      ? {
          fill: C.accentPale,
          borders: { left: { px: 4, color: C.accent } },
          margins: { top: tw(ROW), bottom: tw(2 * ROW), left: tw(ROW / 2), right: tw(ROW / 2) },
        }
      : m.style === "minimal"
        ? { borders: { bottom: accent }, margins: { top: 0, bottom: air, left: 0, right: 0 } }
        : { borders: { top: accent, bottom: accent }, margins: { top: air, bottom: air, left: 0, right: 0 } };
  return [box(items, { ...where, indent: 0 }, cell)];
}

async function columns(n: BlockNode, where: Where, ctx: Context): Promise<Item[]> {
  const fields = n.body.shape === "keyed" ? n.body.fields : [];
  const showHeadings = n.params.headings !== "false";
  const ratio = (n.params.ratio ?? "")
    .split(":")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0);
  const count = fields.length + (n.children.length > 0 ? 1 : 0);
  if (count === 0) return [];

  const weights = Array.from({ length: count }, (_, i) => ratio[i] ?? 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const grid = weights.map((w) => Math.floor((w / sum) * where.width));
  grid[grid.length - 1]! += where.width - grid.reduce((a, b) => a + b, 0);
  // 28px between columns, as on the page: half on each side of the gutter.
  const half = tw(ROW / 2);
  const margins = (i: number) => ({ top: 0, bottom: 0, left: i === 0 ? 0 : half, right: i === count - 1 ? 0 : half });

  const cells = await Promise.all(
    grid.map(async (w, i): Promise<Cell> => {
      const m = margins(i);
      const room = inside({ ...where, width: w }, m.left, m.right);
      const items: Item[] = [];
      const f = fields[i];
      if (f) {
        if (showHeadings) items.push(para(inline(f.key, LABEL, ctx), { keepNext: true }));
        items.push(...(await interleave(f.children, f.blocks, (lines) => looseProse(lines, room, ctx), room, ctx)));
      } else {
        for (const child of n.children) {
          if (items.length > 0) gapAfter(items);
          items.push(...(await block(child, room, ctx)).items);
        }
      }
      return { props: { width: w, margins: m }, items: items.length > 0 ? endInPara(items) : [para("")] };
    }),
  );

  const table: Table = {
    kind: "tbl",
    props: { width: where.width, indent: where.indent || undefined, fixed: true },
    grid,
    rows: [{ cells }],
  };
  return [table];
}

function endInPara(items: Item[]): Item[] {
  if (items[items.length - 1]?.kind === "tbl") items.push(para("", { spacing: { line: 20, rule: "exact" } }));
  return items;
}

function meta(n: BlockNode): Item[] {
  if (n.params.show === "false") return [];
  const fields = n.body.shape === "keyed" ? n.body.fields : [];
  if (fields.length === 0) return [];
  const nb = " ";
  const runs = fields
    .map(
      (f, i) =>
        (i > 0 ? run("     ", { font: FONT.label, size: hp(12) }) : "") +
        run(`${f.key}${nb}`, { ...KICKER, bold: undefined }) +
        run(f.value, { font: FONT.label, size: hp(12) }),
    )
    .join("");
  return [para(runs)];
}

/** A divider: a short centred mark, 40% of the width, in the accent. */
function divider(style: string, where: Where): Para {
  const quarter = Math.round(where.width * 0.3);
  const border: Border =
    style === "dots"
      ? { px: 2, color: C.accent, style: "dotted" }
      : style === "wave"
        ? { px: 1, color: C.accent, style: "wave" }
        : { px: 2, color: C.accent };
  return para("", {
    borders: { bottom: border },
    indent: { left: where.indent + quarter, right: quarter },
    spacing: { line: tw(20), rule: "exact", after: tw(8) },
  });
}

// ── Bodies ───────────────────────────────────────────────────────────────

function fieldTable(fields: Field[], where: Where, ctx: Context): Table {
  // The page's field grid: a 7rem key column, a 14px gap, then the value.
  const key = tw(112 + ROW / 2);
  const value = where.width - key;
  return {
    kind: "tbl",
    props: { width: where.width, fixed: true },
    grid: [key, value],
    rows: fields.map((f) => {
      const items: Item[] = [];
      if (f.value) items.push(para(inline(f.value, {}, ctx)));
      for (const c of f.children) {
        items.push(para(inline(c.text, {}, ctx), { numbering: { id: ctx.numbering.bullets, level: 0 }, indent: listIndent({ width: value, indent: 0, top: false }, 0) }));
      }
      return {
        cells: [
          { props: { width: key, margins: { right: tw(ROW / 2) } }, items: [para(run(f.key, LABEL))] },
          { props: { width: value }, items: items.length > 0 ? items : [para("")] },
        ],
      };
    }),
  };
}

const nested = (r: TreeNode, depth = 0): string =>
  [`${"  ".repeat(depth)}${r.text}`, ...r.children.map((c) => nested(c, depth + 1))].join("\n");

/** Lines in a body that are not `key: value` are prose, read as Markdown, as on the page. */
function looseProse(roots: TreeNode[], where: Where, ctx: Context): Item[] {
  if (roots.length === 0) return [];
  return markdown(roots.map((r) => (r.children.length > 0 ? nested(r) : r.text)).join("\n"), where, ctx);
}

function bodyItems(n: BlockNode, where: Where, ctx: Context): Item[] {
  const b = n.body;
  switch (b.shape) {
    case "keyed":
      return b.fields.length > 0 ? [fieldTable(b.fields, where, ctx)] : [];
    case "mixed":
      return [...(b.fields.length > 0 ? [fieldTable(b.fields, where, ctx)] : []), ...looseProse(b.roots, where, ctx)];
    case "plain":
      return b.lines.length > 0 ? markdown(b.lines.join("\n"), where, ctx) : [];
    case "indented":
      return looseProse(b.roots, where, ctx);
    default:
      return [];
  }
}

/** Blocks written inside another, after its own content, a row clear of it. */
async function nestedAfter(children: Node[], items: Item[], where: Where, ctx: Context): Promise<void> {
  for (const child of children) {
    const out = await block(child, where, ctx);
    if (out.items.length === 0) continue;
    if (items.length > 0) gapAfter(items);
    items.push(...out.items);
  }
}

/** Lines and the blocks written among them, back in the order they were written (UX-65). */
async function interleave(
  lines: TreeNode[],
  blocks: readonly Node[] | undefined,
  text: (run: TreeNode[]) => Item[],
  where: Where,
  ctx: Context,
): Promise<Item[]> {
  const all = [
    ...lines.map((l) => ({ line: l.position.line, l })),
    ...(blocks ?? []).map((b) => ({ line: b.position.line, b })),
  ].sort((a, b) => a.line - b.line);
  const items: Item[] = [];
  let pending: TreeNode[] = [];
  const flush = (): void => {
    if (pending.length > 0) items.push(...text(pending));
    pending = [];
  };
  for (const x of all) {
    if ("l" in x) {
      pending.push(x.l);
      continue;
    }
    flush();
    const out = await block(x.b, where, ctx);
    if (out.items.length === 0) continue;
    if (items.length > 0) gapAfter(items);
    items.push(...out.items);
    gapAfter(items);
  }
  flush();
  return items;
}

// ── Lists ────────────────────────────────────────────────────────────────

async function listItems(
  items: TreeNode[],
  num: number,
  level: number,
  where: Where,
  ctx: Context,
  points: Map<TreeNode, Para>,
): Promise<Item[]> {
  const out: Item[] = [];
  for (const it of items) {
    const p = para(inline(it.text, {}, ctx), { numbering: { id: num, level }, indent: listIndent(where, level) });
    points.set(it, p);
    out.push(p);
    // A point, then the figure written under it, then its sub-points, in the
    // order they were written. A block under a point sits a row clear of it
    // and of the next point, indented to the point's text.
    const room: Where = { width: where.width - ROW_TW * (level + 1), indent: where.indent + ROW_TW * (level + 1), top: false };
    const all = [
      ...it.children.map((c) => ({ line: c.position.line, c })),
      ...(it.blocks ?? []).map((b) => ({ line: b.position.line, b })),
    ].sort((a, b) => a.line - b.line);
    let pending: TreeNode[] = [];
    const flush = async (): Promise<void> => {
      if (pending.length > 0) out.push(...(await listItems(pending, num, level + 1, where, ctx, points)));
      pending = [];
    };
    for (const x of all) {
      if ("c" in x) {
        pending.push(x.c);
        continue;
      }
      await flush();
      const block_ = await block(x.b, room, ctx);
      if (block_.items.length === 0) continue;
      gapAfter(out);
      out.push(...block_.items);
      gapAfter(out);
    }
    await flush();
  }
  return out;
}

/** The point written last: its last item, or that item's last sub-item, all the way down (UX-68). */
function lastPoint(items: TreeNode[]): TreeNode | undefined {
  let last = items[items.length - 1];
  while (last && last.children.length > 0) last = last.children[last.children.length - 1];
  return last;
}

async function list(n: ListNode, where: Where, ctx: Context): Promise<Converted> {
  const num = n.ordered ? ctx.numbering.numbered() : ctx.numbering.bullets;
  const points = new Map<TreeNode, Para>();
  const items = await listItems(n.items, num, 0, where, ctx, points);
  const last = lastPoint(n.items);
  return { items, anchor: last ? points.get(last) : undefined };
}

// ── Quotes and headings ──────────────────────────────────────────────────

function quote(n: QuoteNode, where: Where, ctx: Context): Item[] {
  const items = markdown(n.lines.join("\n"), where, ctx, true);
  const credit = [n.params.by, n.params.source, n.params.date].filter(Boolean).join(" · ");
  if (credit || n.params.tag) {
    const runs = run(credit) + (n.params.tag ? run(`${credit ? "  " : ""}${n.params.tag}`, KICKER) : "");
    items.push(para(runs, { style: "QuoteCredit", indent: { left: where.indent + ROW_TW } }));
  }
  ctx.bookmark(firstPara(items), n.params.id);
  return items;
}

function heading(n: HeadingNode, where: Where, ctx: Context, first: boolean): Para {
  const h = HEADINGS[n.level];
  const p = para(inline(n.text, {}, ctx), {
    style: `Heading${n.level}`,
    // The first thing on the page has nothing to be spaced from.
    ...(first ? { spacing: { before: tw(h.before - ROW) } } : {}),
    ...(where.indent ? { indent: { left: where.indent } } : {}),
  });
  ctx.bookmark(p, n.params.id);
  return p;
}

// ── Figures ──────────────────────────────────────────────────────────────

/** The picture's own blocks only: what is written below a figure follows it as Word content. */
const alone = (n: Node): Node => (n.type === "block" ? { ...n, children: [] } : n);

/** What a sticky says: its title line, or the note written under it. */
const stickyText = (n: Node): string =>
  n.type !== "block"
    ? ""
    : (n.title || (n.body.shape === "plain" ? n.body.lines.filter((l) => l.trim()).join(" ") : "")).trim();

/**
 * The words a screen reader gives for the picture. A wall of stickies has
 * its notes read out; a diagram has its kind and title.
 */
function altText(nodes: Node[]): string {
  const first = nodes[0];
  if (!first || first.type !== "block") return "Diagram";
  if (first.name === "sticky") return `Sticky notes: ${nodes.map(stickyText).filter(Boolean).join("; ")}`;
  const kind = { tree: "Tree", matrix: "Matrix", timeline: "Timeline", journey: "Journey map", star_model: "Star model" }[first.name] ?? "Diagram";
  return first.title ? `${kind}: ${first.title}` : kind;
}

function drawing(rel: string, n: number, widthPx: number, heightPx: number, alt: string): string {
  const cx = emu(widthPx);
  const cy = emu(heightPx);
  const d = esc(alt);
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${n}" name="Figure ${n}" descr="${d}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="figure${n}.png" descr="${d}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

async function figure(nodes: Node[], where: Where, ctx: Context): Promise<Converted> {
  const picture = ctx.picture
    ? await ctx.picture(nodes.map(alone), { width: where.width / 15, landscape: where.top }).catch(() => undefined)
    : undefined;
  if (!picture) return { items: nodes.flatMap((n) => (n.type === "block" ? outline(n, where, ctx) : [])) };

  const landscape = Boolean(picture.landscape) && where.top;
  const page = landscape ? LANDSCAPE : PORTRAIT;
  const maxW = (landscape ? textWidth(page) : where.width) / 15;
  // Leave a little of the page's height free: a paragraph exactly a page tall
  // is pushed on to the next page and leaves this one blank.
  const maxH = textHeight(page) / 15 - ROW;
  const scale = Math.min(1, maxW / picture.width, maxH / picture.height);
  const { rel, n } = ctx.image(picture.png);
  const p = para(drawing(rel, n, picture.width * scale, picture.height * scale, altText(nodes)), {
    keepLines: true,
    indent: where.indent ? { left: where.indent } : undefined,
  });
  const first = nodes[0];
  if (first?.type === "block") ctx.bookmark(p, first.params.id);
  return { items: [p], landscape };
}

/**
 * A figure with nothing to draw it — no browser, or a drawing that failed —
 * as its own words: the title, then its lines as a list. Less than the
 * picture, and nothing lost.
 */
function outline(n: BlockNode, where: Where, ctx: Context): Item[] {
  const items: Item[] = [];
  if (n.title) items.push(para(inline(n.title, { bold: true }, ctx), { keepNext: true, indent: where.indent ? { left: where.indent } : undefined }));
  const bullet = (text: string, level: number): Para =>
    para(inline(text, {}, ctx), { numbering: { id: ctx.numbering.bullets, level }, indent: listIndent(where, level) });
  const tree = (roots: TreeNode[], level: number): void => {
    for (const r of roots) {
      items.push(bullet(r.text, level));
      tree(r.children, level + 1);
    }
  };
  const fields = n.body.shape === "keyed" || n.body.shape === "mixed" ? n.body.fields : [];
  for (const f of fields) {
    items.push(bullet(f.value ? `**${f.key}:** ${f.value}` : `**${f.key}**`, 0));
    tree(f.children, 1);
  }
  if (n.body.shape === "indented" || n.body.shape === "mixed") tree(n.body.roots, 0);
  if (n.body.shape === "plain") for (const l of n.body.lines) if (l.trim()) items.push(bullet(l.trim(), 0));
  return items;
}

// ── Any block ────────────────────────────────────────────────────────────

interface Converted {
  items: Item[];
  /** The paragraph a margin note written after this block is anchored to. */
  anchor?: Para;
  /** A figure on a landscape page of its own. */
  landscape?: boolean;
}

const firstPara = (items: Item[]): Para | undefined => {
  for (const it of items) {
    if (it.kind === "p") return it;
    for (const row of it.rows) for (const cell of row.cells) {
      const p = firstPara(cell.items);
      if (p) return p;
    }
  }
  return undefined;
};

export const lastPara = (items: Item[]): Para | undefined => {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.kind === "p") {
      if (it.props.style !== "Gap") return it;
      continue;
    }
    for (let r = it.rows.length - 1; r >= 0; r--) {
      const cells = it.rows[r]!.cells;
      for (let c = cells.length - 1; c >= 0; c--) {
        const p = lastPara(cells[c]!.items);
        if (p) return p;
      }
    }
  }
  return undefined;
};

async function block(n: Node, where: Where, ctx: Context, first = false): Promise<Converted> {
  switch (n.type) {
    case "heading":
      return { items: [heading(n, where, ctx, first)] };
    case "list":
      return list(n, where, ctx);
    case "quote":
      return { items: quote(n, where, ctx) };
    case "markdown":
      return { items: markdown(n.text, where, ctx) };
    case "divider":
      return { items: [divider(n.style, where)] };
    case "margin_note":
    case "document":
      return { items: [] };
    case "block":
      break;
  }

  if (isCard(n.name)) return { items: await card(n, where, ctx) };
  if (FIGURES.has(n.name) || n.name === "sticky") {
    const out = await figure([n], where, ctx);
    await nestedAfter(n.children, out.items, { ...where, top: false }, ctx);
    return out;
  }
  switch (n.name) {
    case "table": {
      const items = tableBlock(n, where, ctx);
      await nestedAfter(n.children, items, { ...where, top: false }, ctx);
      return { items };
    }
    case "columns":
      return { items: await columns(n, where, ctx) };
    case "callout":
      return { items: await callout(n, where, ctx) };
    case "cover":
      return { items: cover(n, where, ctx) };
    case "meta":
      return { items: meta(n) };
    case "pagebreak":
      return { items: [para(pageBreak(), { spacing: { line: 20, rule: "exact" } })] };
    case "page":
      return { items: [] };
    default: {
      // No renderer yet (@doodle, @icon, @footnote): its words, as on the page.
      const lines =
        n.body.shape === "plain"
          ? n.body.lines
          : n.body.shape === "keyed"
            ? n.body.fields.map((f) => `${f.key}: ${f.value}`)
            : n.body.shape === "mixed"
              ? [...n.body.fields.map((f) => `${f.key}: ${f.value}`), ...n.body.roots.map((r) => r.text)]
              : n.body.shape === "indented"
                ? n.body.roots.map((r) => r.text)
                : [];
      const text = [n.title, ...lines].filter(Boolean).join("\n");
      return { items: text ? markdown(text, where, ctx) : [] };
    }
  }
}

function tableBlock(n: BlockNode, where: Where, ctx: Context): Item[] {
  const model = buildTable(n, []);
  const style = ["ruled", "sketch", "plain"].includes(n.params.style ?? "") ? n.params.style! : "ruled";
  const cols = Math.max(model.head.length, ...model.rows.map((r) => r.length));
  if (cols === 0) return [];
  const items: Item[] = [];
  if (model.caption) items.push(para(inline(model.caption, {}, ctx), { style: "TableCaption", indent: where.indent ? { left: where.indent } : undefined }));
  const rows = [
    ...(model.head.length > 0 ? [model.head.map((h) => ({ runs: inline(h, LABEL, ctx), align: "left" as const }))] : []),
    ...model.rows.map((r) =>
      Array.from({ length: cols }, (_, c) => ({ runs: inline(r[c] ?? "", {}, ctx), align: model.align[c] ?? "left" })),
    ),
  ];
  const head = rows.map((_, i) => i === 0 && model.head.length > 0);
  const table = dataTable(rows, head, columnWidths([model.head, ...model.rows], cols, where.width), style, where);
  items.push(table);
  ctx.bookmark(firstPara(items), n.params.id);
  return items;
}

// ── The document ─────────────────────────────────────────────────────────

export interface Section {
  landscape: boolean;
  items: Item[];
}

const kindOf = (row: Row): string => {
  const n = row.content[0];
  return n ? (n.type === "block" ? n.name : n.type) : "empty";
};

/**
 * Every block and its notes, top to bottom. Blocks are a row apart, as on
 * the page, with the page's exceptions: a heading carries its own space, a
 * divider is a row on its own, and quotes written one after another read as
 * one passage.
 */
export async function convertDocument(ast: DocumentNode, ctx: Context): Promise<Section[]> {
  const where: Where = { width: textWidth(PORTRAIT), indent: 0, top: true };
  const sections: Section[] = [{ landscape: false, items: [] }];
  let previous: string | undefined;

  for (const row of rowsOf(ast.children)) {
    const stickies = row.content.length > 1 && row.content.every((n) => n.type === "block" && n.name === "sticky");
    const out = stickies
      ? await figure(row.content, where, ctx)
      : await (async (): Promise<Converted> => {
          const items: Item[] = [];
          let anchor: Para | undefined;
          let landscape = false;
          for (const n of row.content) {
            const c = await block(n, where, ctx, previous === undefined && items.length === 0);
            items.push(...c.items);
            anchor = c.anchor ?? anchor;
            landscape ||= Boolean(c.landscape);
          }
          return { items, anchor, landscape };
        })();

    // Notes become comments on the line written before them (UX-68): the last
    // point of a list, the last line of a paragraph, the picture of a figure.
    const anchor = out.anchor ?? lastPara(out.items);
    for (const note of row.notes) {
      if (anchor) ctx.comment(note, anchor);
      else out.items.push(para(inline(note.lines.join(" "), { italic: true, color: C.muted }, ctx)));
    }
    if (out.items.length === 0) continue;

    if (out.landscape) {
      sections.push({ landscape: true, items: out.items }, { landscape: false, items: [] });
      previous = undefined;
      continue;
    }

    const kind = kindOf(row);
    const items = sections[sections.length - 1]!.items;
    if (previous !== undefined && previous !== "heading" && previous !== "divider" && !(previous === "quote" && kind === "quote")) {
      gapAfter(items);
    }
    items.push(...out.items);
    previous = kind;
  }
  return sections;
}

// ── Writing it out ───────────────────────────────────────────────────────

function itemXml(it: Item): string {
  if (it.kind === "p") return `<w:p>${pPr(it.props)}${it.open}${it.runs}${it.close}</w:p>`;
  return (
    `<w:tbl>${tblPr(it.props)}` +
    `<w:tblGrid>${it.grid.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>` +
    it.rows
      .map(
        (r) =>
          `<w:tr>` +
          (r.cantSplit || r.header ? `<w:trPr>${r.cantSplit ? "<w:cantSplit/>" : ""}${r.header ? "<w:tblHeader/>" : ""}</w:trPr>` : "") +
          r.cells.map((c) => `<w:tc>${tcPr(c.props)}${endInPara([...c.items]).map(itemXml).join("")}</w:tc>`).join("") +
          `</w:tr>`,
      )
      .join("") +
    `</w:tbl>`
  );
}

export function bodyXml(sections: Section[]): string {
  const kept = sections.filter((s) => s.items.length > 0);
  if (kept.length === 0) kept.push({ landscape: false, items: [para("")] });
  return kept
    .map((s, i) => {
      const sect = sectPr(s.landscape ? LANDSCAPE : PORTRAIT);
      if (i === kept.length - 1) return s.items.map(itemXml).join("") + sect;
      // A section ends on a paragraph that carries its page settings.
      const items = [...s.items];
      if (items[items.length - 1]!.kind !== "p") items.push(gapPara());
      const last = items[items.length - 1] as Para;
      items[items.length - 1] = { ...last, props: { ...last.props, section: sect } };
      return items.map(itemXml).join("");
    })
    .join("");
}
