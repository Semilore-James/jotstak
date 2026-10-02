// AST -> HTML.
//
// Each block and its margin notes form one row: the block in column 1, any notes
// anchored to it in column 2 of that row's grid. Vertical alignment of a note
// against its anchor therefore falls out of the layout, with no measuring and no
// absolute positioning — which is what makes it survive reflow, font swaps and
// narrow viewports. Rows are separate elements so print can give one its own page.

import MarkdownIt from "markdown-it";
import { renderTree as renderTreeFigure } from "./tree.js";
import { renderMatrix as renderMatrixFigure } from "./matrix.js";
import { renderTable as renderTableFigure } from "./table.js";
import { renderTimeline as renderTimelineFigure } from "./timeline.js";
import { renderJourney as renderJourneyFigure } from "./journey.js";
import { renderStar as renderStarFigure } from "./star.js";
import { renderCover } from "./cover.js";
import { renderStickies } from "./sticky.js";
// @ts-expect-error — markdown-it-mark ships no type declarations.
import markPlugin from "markdown-it-mark";
import { getPrimitive } from "@jotstak/schema";
import type {
  BlockNode,
  DocumentNode,
  HeadingNode,
  ListNode,
  MarginNoteNode,
  Node,
  QuoteNode,
  TreeNode,
} from "./ast.js";
import type { Diagnostic, RenderMode } from "./index.js";

// Markdown is delegated rather than reimplemented (ADR-001). `html: false` matters:
// raw HTML in source is escaped, not passed through, so a .jot file can never
// inject markup into the extension webview or the playground page.
// `==highlight==` is the one inline mark .jot adds. It is safe for the superset
// promise because core Markdown gives `==` no meaning, unlike `__`, which is
// already bold — the TextMate grammar used to claim `__` meant underline, so the
// editor coloured it one way while the renderer produced another.
//
// Two parsers, differing in one option, because one option is a fork in the
// language (UX-45).
//
// Markdown says a single newline is a space: only a blank line starts a new
// paragraph, and a line break needs two trailing spaces. That rule is from
// 2004, when prose was hard-wrapped to 80 columns in a terminal, and every
// writing tool built since — GitHub, Slack, Notion — has abandoned it.
//
// Jotstak is ruled paper. A line you ended is a line. So `breaks` is on, and
// `@page breaks=off` restores CommonMark exactly, for pasting a .md file that
// WAS hard-wrapped and whose wrap points must not become real breaks. That
// keeps the superset promise honest rather than quietly redefining it.
type Markdown = InstanceType<typeof MarkdownIt>;

const parser = (breaks: boolean): Markdown =>
  new MarkdownIt({ html: false, linkify: true, typographer: true, breaks }).use(markPlugin);

const MD = { on: parser(true), off: parser(false) } as const;

/**
 * The Markdown parser a document is read with: `breaks` on, unless the
 * document says `@page breaks=off`. For outputs that walk Markdown's tokens
 * rather than its HTML — the Word export — so they read prose exactly as the
 * page does.
 */
export const markdownFor = (breaks: boolean): Markdown => (breaks ? MD.on : MD.off);

// Which one is in force. Set once per document, at the top of renderDocument,
// because every renderer below reaches for `block()` and `inline()` and
// threading a flag through all of them would touch every signature for one
// boolean. Safe because rendering is synchronous and single-pass: nothing runs
// between the assignment and the render that could observe a different value.
let md: Markdown = MD.on;

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline Markdown only — no wrapping <p>, for use inside our own elements. */
const inline = (s: string): string => md.renderInline(s);

/** Block-level Markdown, for prose runs. */
const block = (s: string): string => md.render(s);

const attr = (name: string, value: string | undefined): string =>
  value ? ` ${name}="${escapeHtml(value)}"` : "";

// ── Node renderers ───────────────────────────────────────────────────────

function renderHeading(n: HeadingNode, tail = ""): string {
  const id = n.params.id;
  // One class per level, all six. They used to collapse onto .jot-h3 past
  // three, which made @h4 and @h5 indistinguishable from each other and from
  // @h3 — six levels that produce three looks are not six levels.
  return `<h${n.level} class="jot-h${n.level}"${attr("id", id)}>${tail}${inline(n.text)}</h${n.level}>`;
}

/**
 * Put `tail` at the start of the last line of the paragraph `html` ends with:
 * after its last line break, or at its start if it has none. Nothing if the
 * html does not end in a paragraph — a code block or a table is not a place
 * to put a note inside.
 */
function intoLastLine(html: string, tail: string): string | undefined {
  const end = html.trimEnd();
  if (!end.endsWith("</p>")) return undefined;
  const open = end.lastIndexOf("<p>");
  if (open === -1) return undefined;
  let at = open + "<p>".length;
  const brk = end.lastIndexOf("<br>");
  if (brk > open) {
    at = brk + "<br>".length;
    if (end[at] === "\n") at += 1;
  }
  return `${end.slice(0, at)}${tail}${end.slice(at)}\n`;
}

/**
 * Lines of text and the blocks written among them, back in source order.
 * Runs of text are handed to `text` together, each run of blocks goes into
 * one .jot-nested. Used by a list item and by a column (UX-65), which are the
 * two places a block can sit among lines rather than after a body.
 */
function interleave(
  lines: TreeNode[],
  blocks: readonly Node[] | undefined,
  text: (run: TreeNode[]) => string,
  diagnostics: Diagnostic[],
  /** How many list levels in, so a drawn block can clear the ruling back to the page's edge. */
  depth?: number,
): string {
  if (!blocks || blocks.length === 0) return lines.length > 0 ? text(lines) : "";
  const all = [
    ...lines.map((l) => ({ line: l.position.line, l })),
    ...blocks.map((b) => ({ line: b.position.line, b })),
  ].sort((a, b) => a.line - b.line);

  // One wrapper per block rather than one per run, so each can say whether it
  // is drawn: a figure or a card clears the ruling, a table sits on it.
  const style = depth ? ` style="--jot-depth:${depth}"` : "";
  let out = "";
  let run: TreeNode[] = [];
  const flushText = (): void => {
    if (run.length > 0) out += text(run);
    run = [];
  };
  for (const x of all) {
    if ("l" in x) {
      run.push(x.l);
    } else {
      flushText();
      out += `<div class="jot-nested"${style}>${renderNode(x.b, diagnostics)}</div>`;
    }
  }
  flushText();
  return out;
}

function renderTree(
  items: TreeNode[],
  ordered: boolean,
  diagnostics: Diagnostic[],
  depth = 1,
  /** Margin notes to open one item with: the point they were written after (UX-68). */
  notes?: { at: TreeNode; html: string },
): string {
  const tag = ordered ? "ol" : "ul";
  const body = items
    .map((it) => {
      // A point, then the figure written under it, then its sub-points, in
      // whatever order they were written.
      const rest = interleave(
        it.children,
        it.blocks,
        (run) => renderTree(run, ordered, diagnostics, depth + 1, notes),
        diagnostics,
        depth,
      );
      const lead = notes && notes.at === it ? notes.html : "";
      return `<li>${lead}${inline(it.text)}${rest}</li>`;
    })
    .join("");
  return `<${tag}>${body}</${tag}>`;
}

function renderList(n: ListNode, diagnostics: Diagnostic[]): string {
  return renderTree(n.items, n.ordered, diagnostics);
}

function renderQuote(n: QuoteNode, tail = ""): string | undefined {
  let text = block(n.lines.join("\n"));
  if (tail) {
    const into = intoLastLine(text, tail);
    if (into === undefined) return undefined;
    text = into;
  }
  // @quote absorbed @evidence. They were one function: someone else's words
  // with provenance attached. A pull quote simply attaches less of it.
  const credit = [n.params.by, n.params.source, n.params.date]
    .filter(Boolean)
    .map((s) => escapeHtml(s!))
    .join(" · ");
  const tag = n.params.tag ? `<span class="jot-badge">${escapeHtml(n.params.tag)}</span>` : "";
  const caption = credit || tag ? `<cite>${credit}${tag}</cite>` : "";
  return `<blockquote class="jot-quote"${attr("id", n.params.id)}>${text}${caption}</blockquote>`;
}

/**
 * A margin note. In the margin column beside a box, or — `wrap` — inside the
 * text it is beside, as a float the lines flow around (UX-68). A span, because
 * it sits inside a <p> or an <li>, where a <p> would close the one it is in.
 */
function renderNote(n: MarginNoteNode, wrap = false): string {
  const words = inline(n.lines.join(" "));
  return wrap ? `<span class="jot-note" data-wrap>${words}</span>` : `<p class="jot-note">${words}</p>`;
}

/** The point written last in a list: its last item, or that item's last sub-item, all the way down. */
function lastPoint(items: TreeNode[]): TreeNode {
  let last = items[items.length - 1]!;
  while (last.children.length > 0) last = last.children[last.children.length - 1]!;
  return last;
}

/**
 * A text block with its notes placed where they were written (UX-68): in the
 * last line or the last point before them. Nothing for a box, which cannot
 * wrap around anything and keeps the margin column.
 */
function renderWrapped(n: Node, notes: string, diagnostics: Diagnostic[]): string | undefined {
  switch (n.type) {
    case "list":
      return n.items.length > 0
        ? renderTree(n.items, n.ordered, diagnostics, 1, { at: lastPoint(n.items), html: notes })
        : undefined;
    case "heading":
      return renderHeading(n, notes);
    case "markdown":
      return intoLastLine(block(n.text), notes);
    case "quote":
      return renderQuote(n, notes);
    default:
      return undefined;
  }
}

/** What a card says, before anything decides how it looks. */
export interface CardModel {
  /** The kicker: what kind of card this is, or the author's own label. */
  label: string;
  badge?: string;
  /** The badge, or the author, says this card needs attention. */
  alert: boolean;
  date?: string;
  title: string;
  /** @metric's figure, which the card leads with. */
  metric?: { value?: string; target?: string; trend?: string };
}

/** Whether a block is drawn as a card: @panel and the presets over it. */
export const isCard = (name: string): boolean => name in PANELS;

/**
 * Read a card out of its block. The page and the Word export both draw from
 * this, so a decision's badge or a risk's alert cannot mean one thing on
 * screen and another in a file somebody was sent.
 */
export function readCard(n: BlockNode): CardModel {
  const card = PANELS[n.name] ?? {};
  const spec = getPrimitive(n.name);
  const title = (card.titleParam ? n.params[card.titleParam] : undefined) ?? n.title;
  const badge = card.badgeParam ? n.params[card.badgeParam] : undefined;
  const alert =
    n.params.accent === "alert" || (badge !== undefined && (card.alertValues ?? []).includes(badge));
  // @panel says what it is; a preset is named for what it is.
  const label = n.params.label ?? card.label ?? (n.name === "panel" ? "" : (spec?.name ?? n.name));
  const date = card.dateParam ? n.params[card.dateParam] : undefined;
  const metric =
    n.name === "metric" ? { value: n.params.value, target: n.params.target, trend: n.params.trend } : undefined;
  return { label, badge, alert, date, title, metric };
}

function renderCard(n: BlockNode, diagnostics: Diagnostic[]): string {
  const { label, badge, alert, date, title } = readCard(n);
  const accent = n.params.accent;

  // A decision's date (UX-67). Written down so the record is findable in six
  // months, and read by nothing until now. A real calendar date is marked up
  // as one, so a screen reader and a search both know what it is.
  const dated = date
    ? /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? `<time class="jot-card-date" datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>`
      : `<span class="jot-card-date">${escapeHtml(date)}</span>`
    : "";

  const parts: string[] = [];
  if (label || badge || date) {
    parts.push(
      `<p class="jot-card-kicker">${escapeHtml(label)}` +
        (badge ? `<span class="jot-badge"${alert ? ' data-alert="true"' : ""}>${escapeHtml(badge)}</span>` : "") +
        dated +
        `</p>`,
    );
  }
  if (title) parts.push(`<p class="jot-card-title">${inline(title)}</p>`);

  // @metric leads with the number, because that is the thing being read.
  if (n.name === "metric") {
    const value = n.params.value;
    const target = n.params.target;
    const trend = n.params.trend;
    if (value) {
      parts.push(
        `<p class="jot-metric">` +
          `<span class="jot-metric-value">${escapeHtml(value)}</span>` +
          (trend ? `<span class="jot-trend" data-trend="${escapeHtml(trend)}">${TREND[trend] ?? ""}</span>` : "") +
          (target ? `<span class="jot-metric-target">target ${escapeHtml(target)}</span>` : "") +
          `</p>`,
      );
    }
  }

  parts.push(bodyParts(n, diagnostics));

  return `<section class="jot-card" data-primitive="${escapeHtml(n.name)}"${accent ? ` data-accent="${escapeHtml(accent)}"` : ""}${alert ? ' data-alert="true"' : ""}${attr("id", n.params.id)}>${parts.filter(Boolean).join("")}</section>`;
}

export const TREND: Record<string, string> = { up: "↑", down: "↓", flat: "→" };

/**
 * Which primitives share a rendering FUNCTION.
 *
 * Exported because it is the honest answer to "how many things does this
 * language actually do?" — and because the docs generate their reference from
 * it, so the count in the documentation can never drift from the renderer.
 * Names in the same bucket produce the same markup with different defaults.
 */
export const RENDER_FUNCTIONS: Record<string, readonly string[]> = {
  panel: ["panel", "decision", "risk", "assumption", "persona", "metric", "callout"],
  columns: ["columns"],
  quote: ["quote"],
  chips: ["meta"],
  margin: ["note"],
  heading: ["heading", "cover"],
  list: ["bullet", "numbered"],
  divider: ["divider", "pagebreak"],
  table: ["table"],
  tree: ["tree"],
  matrix: ["matrix"],
  timeline: ["timeline"],
  journey: ["journey"],
  star: ["star_model"],
  sticky: ["sticky"],
  freeform: ["doodle"],
  inline: ["icon", "footnote"],
  config: ["page"],
};

/**
 * @columns places regions side by side. Each keyed field is a column; its
 * children and any nested blocks fill it. This one function replaced both
 * @spread (two pages) and @pillars (feature columns), which were the same
 * mechanic wearing different names.
 */
function renderColumns(n: BlockNode, diagnostics: Diagnostic[]): string {
  const fields = n.body.shape === "keyed" ? n.body.fields : [];
  const showHeadings = n.params.headings !== "false";
  const ratio = (n.params.ratio ?? "")
    .split(":")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0);

  const cols = fields.map((f, i) => {
    const heading = showHeadings
      ? `<p class="jot-col-heading">${inline(f.key)}</p>`
      : "";
    // A column's lines, and any block written under its key among them.
    const items = interleave(
      f.children,
      f.blocks,
      (run) => block(proseOf(run)),
      diagnostics,
    );
    const basis = ratio[i] !== undefined ? ` style="flex-grow:${ratio[i]}"` : "";
    return `<div class="jot-col"${basis}>${heading}${items}</div>`;
  });

  // Wrapped one by one, like a block under a key, so a drawn one can clear
  // the ruling around itself.
  const nested = n.children.map((c) => `<div class="jot-nested">${renderNode(c, diagnostics)}</div>`).join("");
  const trailing = nested ? `<div class="jot-col">${nested}</div>` : "";
  return `<div class="jot-columns"${attr("id", n.params.id)}>${cols.join("")}${trailing}</div>`;
}

/** Callouts: the flavor is the shortcode, so it drives the colour and the label. */
function renderCallout(n: BlockNode, diagnostics: Diagnostic[]): string {
  const flavor = n.params.flavor ?? "info";
  return (
    `<aside class="jot-callout" data-flavor="${escapeHtml(flavor)}"${attr("id", n.params.id)}>` +
    `<p class="jot-callout-label">${escapeHtml(flavor)}</p>` +
    (bodyParts(n, diagnostics) || `<p>${inline(n.title)}</p>`) +
    `</aside>`
  );
}

/** @meta is a compact chip row of document metadata. */
function renderMeta(n: BlockNode): string {
  if (n.params.show === "false") return "";
  const fields = n.body.shape === "keyed" ? n.body.fields : [];
  if (fields.length === 0) return "";
  const chips = fields
    .map(
      (f) =>
        `<span class="jot-chip"><span class="jot-chip-key">${escapeHtml(f.key)}</span>${escapeHtml(f.value)}</span>`,
    )
    .join("");
  return `<div class="jot-meta">${chips}</div>`;
}

// ── The card mechanic, generalised ───────────────────────────────────────
//
// Six PM primitives are the same shape: a kicker, a title, an optional status
// badge, and keyed fields. Describing that shape as DATA rather than writing six
// renderers means adding a seventh is a table entry, and it guarantees they stay
// visually consistent — the thing that makes a document read as one artifact
// rather than a pile of widgets.
//
// Presentation lives here and not in @jotstak/schema on purpose: the schema says
// what a primitive MEANS, this says how it LOOKS. A future MCP or plain-text
// consumer wants the former without the latter.

interface PanelPreset {
  /** Param used as the panel's heading. */
  titleParam?: string;
  /** Param rendered as the badge beside the label. */
  badgeParam?: string;
  /** Badge values that should read as a warning rather than neutral. */
  alertValues?: string[];
  /** Param shown as a quiet date after the badge (UX-67). */
  dateParam?: string;
  /** Kicker text. Defaults to the primitive's own name. */
  label?: string;
}

/**
 * Every entry here is the SAME rendering function with different defaults.
 * `@panel` is the function; the rest are presets over it, so a document can be
 * written entirely in PM vocabulary or entirely without it. That choice belongs
 * to the author, which is why neither form is privileged in the renderer.
 */
const PANELS: Record<string, PanelPreset> = {
  panel:      { titleParam: "title", badgeParam: "badge" },
  decision:   { titleParam: "title", badgeParam: "status", alertValues: ["deprecated", "superseded"], dateParam: "date" },
  risk:       { titleParam: "title", badgeParam: "level", alertValues: ["high", "critical"] },
  assumption: { titleParam: "title", badgeParam: "confidence", alertValues: ["low"] },
  persona:    { titleParam: "name" },
  metric:     { titleParam: "name", badgeParam: "status", alertValues: ["at-risk", "off-track"] },
};

function fieldRows(fields: { key: string; value: string; children: TreeNode[] }[]): string {
  if (fields.length === 0) return "";
  const rows = fields
    .map((f) => {
      const nested =
        f.children.length > 0
          ? `<ul class="jot-field-list">${f.children.map((c) => `<li>${inline(c.text)}</li>`).join("")}</ul>`
          : "";
      const value = f.value ? inline(f.value) : "";
      return `<div class="jot-field"><span class="jot-field-key">${escapeHtml(f.key)}</span><span class="jot-field-value">${value}${nested}</span></div>`;
    })
    .join("");
  return `<div class="jot-fields">${rows}</div>`;
}

/**
 * Lines in a body that are not `key: value` are PROSE, not list items.
 *
 * They used to be emitted as `<li>`, which meant writing three sentences under
 * `@risk` produced three bullets — and a wrapped line became a bullet of its own.
 * Handing the text to markdown-it instead means ordinary prose stays prose,
 * wrapped lines join up, and `- item` becomes a list because the author asked
 * for one. Markdown's rules rather than ours (ADR-001).
 */
function looseProse(roots: TreeNode[]): string {
  if (roots.length === 0) return "";
  return block(proseOf(roots));
}

/** The last source line a line of text, and everything indented under it, reaches. */
function lastLine(r: TreeNode): number {
  let last = r;
  while (last.children.length > 0) last = last.children[last.children.length - 1]!;
  return last.position.line;
}

/**
 * The lines of a body, back as the Markdown they were written as — blank
 * lines included. The parser keeps each line's position but not the empty
 * lines between them, so a blank line in a card or a column, which starts a
 * new paragraph there as it does anywhere else, is read back off the gap in
 * the line numbers (UX-71). It used to vanish, and two paragraphs came out as
 * one with a line break in it.
 */
export function proseOf(roots: TreeNode[]): string {
  return roots
    .map((r, i) => {
      const prev = roots[i - 1];
      return (prev && r.position.line > lastLine(prev) + 1 ? "\n" : "") + renderNested(r);
    })
    .join("\n");
}

function renderNested(r: TreeNode, depth = 0): string {
  const here = `${"  ".repeat(depth)}${r.text}`;
  const kids = r.children.map((c) => renderNested(c, depth + 1));
  return [here, ...kids].join("\n");
}

function bodyParts(n: BlockNode, diagnostics: Diagnostic[] = []): string {
  const own =
    n.body.shape === "keyed"
      ? fieldRows(n.body.fields)
      : n.body.shape === "mixed"
        ? fieldRows(n.body.fields) + looseProse(n.body.roots)
        : n.body.shape === "plain" && n.body.lines.length > 0
          ? block(n.body.lines.join("\n"))
          : n.body.shape === "indented"
            ? looseProse(n.body.roots)
            : "";

  // Nested blocks render after the body's own content. This is what lets a table
  // sit inside a card. Which blocks reach here is the schema's call (`holds`).
  const nested = n.children.map((c) => renderNode(c, diagnostics)).join("");
  return nested ? `${own}<div class="jot-nested">${nested}</div>` : own;
}

/** Primitives without a renderer yet: show the content, flag it, lose nothing. */
function renderUnsupported(n: BlockNode, diagnostics: Diagnostic[]): string {
  diagnostics.push({
    severity: "info",
    message: `@${n.name} has no renderer yet; showing its content as plain text.`,
    line: n.position.line,
    column: n.position.column,
  });
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
  return text ? block(text) : "";
}

// ── Diagrams ─────────────────────────────────────────────────────────────
//
// Laid out in CSS rather than drawn in SVG. Three reasons, in order of weight:
//
//   1. Nodes should be able to CONTAIN other blocks. A metric inside a tree
//      node was the aim of composition, and SVG cannot hold arbitrary flow
//      content without foreignObject, which brings its own problems. It is
//      not built: today a block inside a figure is drawn below it (`holds:
//      "below"` in the schema), and CSS keeps the door open.
//   2. Text stays selectable, searchable and readable by a screen reader.
//   3. Boxes inherit the design tokens and the row contract for free; an SVG
//      would re-implement both and drift.
//
// SVG is reserved for connector geometry a border cannot express.

function renderTreeDiagram(n: BlockNode, diagnostics: Diagnostic[]): string {
  const nested = n.children.map((c) => renderNode(c, diagnostics)).join("");
  return renderTreeFigure(n, diagnostics, { inline, escapeHtml, attr }, nested);
}

function renderMatrixDiagram(n: BlockNode, diagnostics: Diagnostic[]): string {
  const nested = n.children.map((c) => renderNode(c, diagnostics)).join("");
  return renderMatrixFigure(n, diagnostics, { inline, escapeHtml, attr }, nested);
}

function renderTimelineDiagram(n: BlockNode, diagnostics: Diagnostic[]): string {
  const nested = n.children.map((c) => renderNode(c, diagnostics)).join("");
  return renderTimelineFigure(n, diagnostics, { inline, escapeHtml, attr }, nested);
}

function renderJourneyDiagram(n: BlockNode, diagnostics: Diagnostic[]): string {
  const nested = n.children.map((c) => renderNode(c, diagnostics)).join("");
  return renderJourneyFigure(n, diagnostics, { inline, escapeHtml, attr }, nested);
}

function renderStarDiagram(n: BlockNode, diagnostics: Diagnostic[]): string {
  const nested = n.children.map((c) => renderNode(c, diagnostics)).join("");
  return renderStarFigure(n, diagnostics, { inline, escapeHtml, attr }, nested);
}

function renderTableBlock(n: BlockNode, diagnostics: Diagnostic[]): string {
  const nested = n.children.map((c) => renderNode(c, diagnostics)).join("");
  return renderTableFigure(n, diagnostics, { inline, escapeHtml, attr }, nested);
}

/**
 * A break the author asked for, rather than one the paper imposed.
 *
 * Printing already cuts the document into real A4 pages and keeps blocks whole
 * while doing it, so this is only for the breaks pagination cannot guess: an
 * appendix, a section someone will detach, a cover that should stand alone.
 *
 * It draws on SCREEN as well, because otherwise the author is editing blind —
 * the one thing they cannot check without printing is the thing they just
 * asked for. One row tall, so it costs the ruling nothing.
 */
function renderPagebreak(n: BlockNode): string {
  const label = n.params.label ?? n.title ?? "";
  return (
    `<div class="jot-pagebreak"${attr("id", n.params.id)} role="separator"` +
    ` aria-label="${label ? escapeHtml(label) : "Page break"}">` +
    `<span class="jot-pagebreak-label">${label ? inline(label) : "new page"}</span>` +
    `</div>`
  );
}

function renderBlock(n: BlockNode, diagnostics: Diagnostic[]): string {
  if (n.name in PANELS) return renderCard(n, diagnostics);
  if (n.name === "table") return renderTableBlock(n, diagnostics);
  if (n.name === "tree") return renderTreeDiagram(n, diagnostics);
  if (n.name === "matrix") return renderMatrixDiagram(n, diagnostics);
  if (n.name === "timeline") return renderTimelineDiagram(n, diagnostics);
  if (n.name === "journey") return renderJourneyDiagram(n, diagnostics);
  if (n.name === "star_model") return renderStarDiagram(n, diagnostics);
  if (n.name === "columns") return renderColumns(n, diagnostics);
  if (n.name === "callout") return renderCallout(n, diagnostics);
  if (n.name === "meta") return renderMeta(n);
  if (n.name === "pagebreak") return renderPagebreak(n);
  if (n.name === "cover") return renderCover(n, diagnostics, { inline, escapeHtml, attr });
  // @page configures the document rather than rendering; handled by the shell.
  if (n.name === "page") return "";
  return renderUnsupported(n, diagnostics);
}

function renderNode(n: Node, diagnostics: Diagnostic[]): string {
  switch (n.type) {
    case "heading":
      return renderHeading(n);
    case "list":
      return renderList(n, diagnostics);
    case "divider":
      return `<hr class="jot-divider" data-style="${escapeHtml(n.style)}" />`;
    case "quote":
      return renderQuote(n) ?? "";
    case "markdown":
      return block(n.text);
    case "block":
      return renderBlock(n, diagnostics);
    case "margin_note":
    case "document":
      return "";
  }
}

// ── Document assembly ────────────────────────────────────────────────────

/**
 * Group the flat node list into rows of (content, notes). A margin note attaches
 * to the block it follows in source, which is what lets the grid align them.
 */
export interface Row {
  content: Node[];
  notes: MarginNoteNode[];
}

/** A @sticky block, the one thing that shares a row with its neighbours. */
const isSticky = (n: Node): n is BlockNode => n.type === "block" && n.name === "sticky";

/**
 * Exported as `rowsOf` for the other outputs, so that which block a note
 * belongs to is decided in one place: the Word export anchors a comment to the
 * same block this anchors the note beside.
 */
export function toRows(children: Node[]): Row[] {
  const rows: Row[] = [];
  for (const child of children) {
    if (child.type === "margin_note") {
      const last = rows[rows.length - 1];
      if (last) last.notes.push(child);
      else rows.push({ content: [], notes: [child] });
      continue;
    }

    // A run of stickies is ONE row, because a wall is one figure. Written one
    // after another they are a cluster; rendered as separate rows down the
    // page they would be a list with coloured backgrounds, which is not what
    // cluster synthesis looks like. Nothing else in the language does this,
    // and nothing else should: every other block owns its own row.
    const last = rows[rows.length - 1];
    if (isSticky(child) && last && last.notes.length === 0 && last.content.every(isSticky)) {
      last.content.push(child);
      continue;
    }

    rows.push({ content: [child], notes: [] });
  }
  return rows;
}

export interface HtmlOptions {
  mode: RenderMode;
  scope?: string;
}

export function renderDocument(
  ast: DocumentNode,
  options: HtmlOptions,
  diagnostics: Diagnostic[],
): string {
  const cls = (options.scope ?? "jotstak").replace(/^\./, "");

  // `@page breaks=off` before anything is rendered, since it changes how every
  // line of prose in the document is read.
  const page = ast.children.find((n): n is BlockNode => n.type === "block" && n.name === "page");
  md = page?.params.breaks === "off" ? MD.off : MD.on;

  const cells = toRows(ast.children)
    .map((row) => {
      const stickies = row.content.filter(isSticky);
      // Text with notes beside it wraps around them, and they sit at the line
      // they were written after (UX-68). A box cannot wrap, so it keeps the
      // margin column and narrows beside it (UX-37). The column copy of the
      // notes is always written too: on a narrow screen, where notes fold in
      // under their block, that is the one shown.
      const lone = row.content.length === 1 ? row.content[0] : undefined;
      const wrapped =
        row.notes.length > 0 && lone
          ? renderWrapped(lone, row.notes.map((n) => renderNote(n, true)).join(""), diagnostics)
          : undefined;
      const body =
        wrapped ??
        (stickies.length > 0 && stickies.length === row.content.length
          ? renderStickies(stickies, diagnostics, { inline, escapeHtml, attr })
          : row.content.map((n) => renderNode(n, diagnostics)).join(""));
      const aside = row.notes.map((n) => renderNote(n)).join("");
      // The row's kind lets CSS space blocks contextually. A uniform gap after
      // every block double-spaces a run of quotes and gives a horizontal rule
      // three rows to itself.
      const kind = row.content[0]?.type ?? "empty";
      const primitive = row.content[0]?.type === "block" ? row.content[0].name : "";
      // A row is its own element — the block beside its notes — rather than two
      // cells of one document-wide grid, because a printed page can only be
      // named (the landscape sheet) on a block in normal flow. See page.ts.
      return (
        `<div class="jot-row"${wrapped !== undefined ? ' data-notes="wrap"' : ""}>` +
        `<div class="jot-body" data-kind="${escapeHtml(kind)}"${primitive ? ` data-primitive="${escapeHtml(primitive)}"` : ""}>${body}</div>` +
        `<div class="jot-aside">${aside}</div>` +
        `</div>`
      );
    })
    .join("");

  return `<div class="${escapeHtml(cls)}" data-mode="${options.mode}"><div class="jot-doc">${cells}</div></div>`;
}
