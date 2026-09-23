// @table — the one figure that is not a drawing.
//
// A tree and a matrix are pictures: measure them, and if they do not fit,
// shrink them. A table cannot be treated that way, and this is the decision
// worth stating because everything below follows from it:
//
//   A TABLE'S CONTENT IS TEXT, SO IT IS NEVER SCALED.
//
// Scaling a figure makes a drawing smaller. Scaling a table makes the WORDS
// smaller than the words around them, which is the one thing a document must
// never do — a reader notices instantly, and it is the tell of a table pasted
// in from somewhere else. So a table widens, and past that its cells wrap, and
// the type stays exactly the size of the prose above it.
//
// The second consequence: a table SITS ON THE RULING rather than clearing it.
// Every row is one baseline row tall, so the paper's own rules become the
// table's row lines. That is what ruled paper is for, and it is why a `.jot`
// table looks written on the page rather than dropped onto it. The exception
// is `style=sketch`, which is a drawn frame and does clear the rules.
//
// Three ways in, because tables arrive from three places: comma rows a PM
// types, the record form when the cells are long, and pipe tables pasted out
// of Markdown (the superset promise — .jot has no pipe syntax of its own, but
// it must not choke on one).

import { ESTIMATE_SAFETY, measureText } from "./measure.js";
import { ROW } from "./figure.js";
import { PAGE } from "./page.js";
import type { BlockNode, TreeNode } from "./ast.js";
import type { Diagnostic } from "./index.js";

/** Every length the renderer and the stylesheet both need. */
export const TABLE = {
  row: ROW,
  /** Body cells: the prose size, so a table reads as part of the document. */
  cellSize: 16,
  /** Header cells: the label face, uppercase, one size down. */
  headSize: 12,
  headTracking: 0.02,
  /** Space between one column's text and the next. */
  gap: ROW / 2,
  /** Side padding inside a drawn cell (style=sketch only). */
  sketchPadX: 10,
  /**
   * The longest a header may be before it is allowed to wrap.
   *
   * Short headers are held on one line, and that single declaration is what
   * divides a squeezed table up correctly. A browser's automatic table layout
   * gives each column at least its minimum content width and shares the
   * shortfall out of the rest in proportion to how much each has to spare — so
   * an unwrappable header becomes the floor its column cannot be pushed below,
   * and the columns of prose, which were going to wrap anyway, absorb it.
   *
   * Measured column widths written into a colgroup did the same arithmetic by
   * hand and got it wrong the first time (CONFIDENCE broke into CONFIDE /
   * NCE), because the renderer has to guess the width the table will end up
   * with and the browser knows it. The renderer still measures — that is how
   * it decides between the text column and the full width — but it does not
   * dictate.
   *
   * Past this length a header is a phrase rather than a word, so it wraps
   * between words. It never breaks INSIDE one.
   */
  headWrapAt: 18,
} as const;

export type Align = "left" | "center" | "right";

export interface TableModel {
  head: string[];
  rows: string[][];
  align: Align[];
  /** Bare text after the shortcode, set above the table. */
  caption: string;
}

// ── Reading the three input forms ────────────────────────────────────────

/**
 * Split one compact row into cells. Quoted cells keep their separator, which
 * is the only escape hatch the compact form needs: `"Search, export", Shipped`
 * is two cells, not three.
 */
export function splitCells(line: string, sep: "comma" | "tab"): string[] {
  if (sep === "tab") return line.split("\t").map((c) => c.trim());
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      // A doubled quote inside a quoted cell is a literal quote.
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** `| Feature | Status |` → the cells between the pipes. */
function splitPipeRow(line: string): string[] {
  return line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

/** Markdown's `|:---|---:|` row: no content, but it carries the alignment. */
function readRuleRow(cells: string[]): Align[] | null {
  if (cells.length === 0 || !cells.every((c) => /^:?-{1,}:?$/.test(c))) return null;
  return cells.map((c) =>
    c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left",
  );
}

/** A column of nothing but figures reads right-aligned, the way a table should. */
const NUMERIC = /^[+-]?[$£€¥]?\d[\d,\s]*(\.\d+)?\s*%?$/;

function autoAlign(head: string[], rows: string[][]): Align[] {
  return head.map((_, c) => {
    const cells = rows.map((r) => r[c] ?? "").filter((v) => v !== "" && v !== "—" && v !== "-");
    return cells.length > 0 && cells.every((v) => NUMERIC.test(v)) ? "right" : "left";
  });
}

/** `Status: Shipped` inside a record. */
const PAIR = /^([^:]+):\s*(.*)$/;

/**
 * The record form: one `- Key: value` per record, further pairs indented under
 * it. Written this way when the cells are long enough that a comma row would
 * be unreadable in the source — the table still comes out identical.
 *
 * Its rows arrive as plain lines, not as fields: inside a block body the lexer
 * leaves the line exactly as written, marker and all, because a body line
 * belongs to the primitive rather than to Markdown. So the marker comes off
 * here, which is also what makes `- ` the thing that SAYS "this is a record".
 */
function fromRecords(records: TreeNode[], diagnostics: Diagnostic[]): { head: string[]; rows: string[][] } {
  const head: string[] = [];
  const out: Record<string, string>[] = [];

  const take = (row: Record<string, string>, key: string, value: string): void => {
    if (!head.includes(key)) head.push(key);
    row[key] = value;
  };

  for (const node of records) {
    const row: Record<string, string> = {};
    for (const line of [node, ...node.children]) {
      const text = line === node ? stripMarker(line.text) : line.text;
      const m = PAIR.exec(text);
      if (!m) {
        diagnostics.push({
          severity: "warning",
          message: `"${text}" is not a column: inside a record every line is \`Column: value\`.`,
          line: line.position.line,
          column: line.position.column,
        });
        continue;
      }
      take(row, m[1]!.trim(), m[2]!.trim());
    }
    out.push(row);
  }

  return { head, rows: out.map((r) => head.map((k) => r[k] ?? "")) };
}

const MARKER = /^[-*+]\s+/;
const stripMarker = (text: string): string => text.replace(MARKER, "");

export function buildTable(n: BlockNode, diagnostics: Diagnostic[]): TableModel {
  const fields = n.body.shape === "mixed" ? n.body.fields : [];
  const roots = n.body.shape === "mixed" ? n.body.roots : [];
  const sep = n.params.sep === "tab" ? "tab" : "comma";

  let head: string[] = [];
  let rows: string[][] = [];
  let ruleAlign: Align[] | null = null;

  // A leading `- ` is what distinguishes a record from a comma row, so the
  // first line decides which form the whole table is written in.
  const records = roots.filter((r) => MARKER.test(r.text.trim()));

  if (records.length > 0) {
    ({ head, rows } = fromRecords(records, diagnostics));
    for (const root of roots) {
      if (records.includes(root)) continue;
      diagnostics.push({
        severity: "warning",
        message: `"${root.text}" is not part of the table: a record table is a list of \`- Column: value\` records.`,
        line: root.position.line,
        column: root.position.column,
      });
    }
  } else if (fields.length > 0) {
    // `Column: value` lines with no marker at all: one record, so a one-row
    // table. The marker is what separates one record from the next, and
    // without it there is nothing to separate.
    head = fields.map((f) => f.key);
    rows = [fields.map((f) => f.value)];
  } else {
    const lines = roots.filter((r) => r.text.trim() !== "");
    // Pipes only when the table is written that way throughout: a single cell
    // containing a pipe should not change how every row is read.
    const piped = lines.length > 0 && lines.every((r) => r.text.trim().startsWith("|"));
    const parsed: { cells: string[]; node: TreeNode }[] = [];

    for (const root of lines) {
      const cells = piped ? splitPipeRow(root.text.trim()) : splitCells(root.text, sep);
      const rule = readRuleRow(cells);
      if (rule) {
        ruleAlign = rule;
        continue;
      }
      parsed.push({ cells, node: root });
      if (root.children.length > 0) {
        diagnostics.push({
          severity: "warning",
          message: `Detail under "${cells[0] ?? root.text}" is not drawn: a table row is one line. Use the record form (\`- Column: value\`) if the cells are long.`,
          line: root.children[0]!.position.line,
          column: root.children[0]!.position.column,
        });
      }
    }

    head = parsed[0]?.cells ?? [];
    rows = parsed.slice(1).map(({ cells, node }) => {
      if (cells.length > head.length && head.length > 0) {
        diagnostics.push({
          severity: "warning",
          message: `This row has ${cells.length} cells but the header has ${head.length}, so the extra ${cells.length - head.length === 1 ? "one is" : "ones are"} dropped. Quote a cell that contains a comma: \`"a, b"\`.`,
          line: node.position.line,
          column: node.position.column,
        });
      }
      return head.map((_, i) => cells[i] ?? "");
    });
  }

  // Explicit beats pasted beats guessed.
  const asked = (n.params.align ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean) as Align[];
  const align = head.map((_, i) =>
    asked[i] && ["left", "center", "right"].includes(asked[i]!)
      ? asked[i]!
      : (ruleAlign?.[i] ?? autoAlign(head, rows)[i] ?? "left"),
  );

  if (head.length === 0) {
    diagnostics.push({
      severity: "warning",
      message: "This table has no rows. The first line is the header: `Feature, Status, Owner`.",
      line: n.position.line,
      column: n.position.column,
    });
  }

  return { head, rows, align, caption: n.params.title ?? n.title ?? "" };
}

// ── How much page a table takes ──────────────────────────────────────────

/** Width of a header cell: the label face, uppercased by CSS before it is drawn. */
function headWidth(text: string): number {
  const upper = text.toUpperCase();
  return (
    measureText(upper, "lora-600", TABLE.headSize) * ESTIMATE_SAFETY +
    upper.length * TABLE.headTracking * TABLE.headSize
  );
}

function cellWidth(text: string): number {
  return measureText(text, "lora-400", TABLE.cellSize) * ESTIMATE_SAFETY;
}

export interface TableMetrics {
  /** Natural width of each column, longest cell and all. */
  columns: number[];
  /** The width below which a column's HEADER would have to break. */
  headers: number[];
  /** What the whole table wants, separators included. */
  natural: number;
}

export function measureTable(m: TableModel, style = "ruled"): TableMetrics {
  const pad = style === "sketch" ? TABLE.sketchPadX * 2 : TABLE.gap;
  const headers = m.head.map((h) => headWidth(h) + pad);
  const columns = m.head.map((h, c) =>
    Math.max(headWidth(h), ...m.rows.map((r) => cellWidth(r[c] ?? "")), 0) + pad,
  );
  return { columns, headers, natural: columns.reduce((a, b) => a + b, 0) };
}


export type TableWidth = "column" | "full";

/**
 * Where a table sits. Two stops, not the figure's three: the text column if it
 * fits, otherwise the full printable width. There is no landscape page and no
 * scaling — past the full width the cells wrap, which is what text does, and
 * the type stays the size of the prose around it.
 */
export function placeTable(
  metrics: TableMetrics,
  pinned: string,
  n: BlockNode,
  diagnostics: Diagnostic[],
): TableWidth {
  const { column, content } = PAGE.portrait;
  if (pinned === "column") return "column";
  if (pinned === "full") return "full";
  if (metrics.natural <= column) return "column";
  if (metrics.natural > content) {
    diagnostics.push({
      severity: "info",
      message: `This table wants about ${Math.round(metrics.natural)}px and the page is ${Math.round(content)}px, so the longest cells wrap onto a second line. The text stays full size — a table is never shrunk.`,
      line: n.position.line,
      column: n.position.column,
    });
  }
  return "full";
}

// ── Drawing it ───────────────────────────────────────────────────────────

export interface TableHelpers {
  inline: (text: string) => string;
  escapeHtml: (s: string) => string;
  attr: (name: string, value: string | undefined) => string;
}

const STYLES = new Set(["ruled", "sketch", "plain"]);

export function renderTable(
  n: BlockNode,
  diagnostics: Diagnostic[],
  h: TableHelpers,
  nested: string,
): string {
  const model = buildTable(n, diagnostics);
  const style = STYLES.has(n.params.style ?? "") ? n.params.style! : "ruled";
  const metrics = measureTable(model, style);
  const pinned = n.params.width ?? "auto";
  const width = placeTable(metrics, pinned, n, diagnostics);

  const cell = (tag: "th" | "td", text: string, c: number): string => {
    const align = model.align[c] && model.align[c] !== "left" ? ` style="text-align:${model.align[c]}"` : "";
    const wrap = tag === "th" && text.length > TABLE.headWrapAt ? " data-wrap" : "";
    return `<${tag}${align}${wrap}>${h.inline(text)}</${tag}>`;
  };

  // `plain` means alignment and nothing else, and that has to include the
  // header: a first row set in small caps with a rule under it is chrome, and
  // a plain table is reached for precisely when the rows are not data with
  // headings — a schedule, a key and its values, two columns of prose.
  const headed = style !== "plain";
  const thead =
    headed && model.head.length
      ? `<thead><tr>${model.head.map((t, c) => cell("th", t, c)).join("")}</tr></thead>`
      : "";
  const data = headed ? model.rows : model.head.length ? [model.head, ...model.rows] : [];
  const tbody = data.length
    ? `<tbody>${data.map((r) => `<tr>${r.map((t, c) => cell("td", t, c)).join("")}</tr>`).join("")}</tbody>`
    : "";

  // The caption is a sibling rather than a <caption> element, because a drawn
  // frame goes round the table and a <caption> lives INSIDE the table it
  // titles — the frame would enclose the title too. `aria-label` keeps the
  // accessible name a <caption> would have given it.
  const caption = model.caption
    ? `<p class="jot-table-caption">${h.inline(model.caption)}</p>`
    : "";
  const named = model.caption ? ` aria-label="${h.escapeHtml(model.caption)}"` : "";

  // `data-pinned` marks a width the AUTHOR asked for, which is the only thing
  // that outranks a margin note. Left to itself a table with a note beside it
  // narrows to the text column and wraps a little harder, exactly as every
  // other block does (UX-37) — losing where a note points is worse than two
  // more wrapped lines, and unlike a drawing, a table can give the room back.
  const pin = pinned === "full" || pinned === "landscape" ? " data-pinned" : "";
  return (
    `<div class="jot-table-wrap" data-width="${width}"${pin}${style === "sketch" ? " data-drawn" : ""}>` +
    caption +
    `<table class="jot-table" data-style="${h.escapeHtml(style)}"${named}${h.attr("id", n.params.id)}>` +
    thead +
    tbody +
    `</table></div>` +
    (nested ? `<div class="jot-nested">${nested}</div>` : "")
  );
}
