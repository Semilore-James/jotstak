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

function renderHeading(n: HeadingNode): string {
  const id = n.params.id;
  return `<h${n.level} class="jot-h${n.level}"${attr("id", id)}>${inline(n.text)}</h${n.level}>`;
}

function renderTree(items: TreeNode[], ordered: boolean): string {
  const tag = ordered ? "ol" : "ul";
  const body = items
    .map((it) => {
      const kids = it.children.length > 0 ? renderTree(it.children, ordered) : "";
      return `<li>${inline(it.text)}${kids}</li>`;
    })
    .join("");
  return `<${tag}>${body}</${tag}>`;
}

function renderList(n: ListNode): string {
  return renderTree(n.items, n.ordered);
}

function renderQuote(n: QuoteNode): string {
  const text = block(n.lines.join("\n"));
  // @quote absorbed @evidence. They were one function: someone else's words
  // with provenance attached. A pull quote simply attaches less of it.
  const credit = [n.params.by, n.params.source, n.params.date]
    .filter(Boolean)
    .map((s) => escapeHtml(s!))
    .join(" · ");
  const tag = n.params.tag ? `<span class="jot-badge">${escapeHtml(n.params.tag)}</span>` : "";
  const caption = credit || tag ? `<cite>${credit}${tag}</cite>` : "";
  return `<blockquote class="jot-quote">${text}${caption}</blockquote>`;
}

function renderNote(n: MarginNoteNode): string {
  return `<p class="jot-note">${inline(n.lines.join(" "))}</p>`;
}

function renderCard(n: BlockNode, diagnostics: Diagnostic[]): string {
  const card = PANELS[n.name] ?? {};
  const spec = getPrimitive(n.name);
  const title = (card.titleParam ? n.params[card.titleParam] : undefined) ?? n.title;
  const badge = card.badgeParam ? n.params[card.badgeParam] : undefined;
  const accent = n.params.accent;
  const alert =
    accent === "alert" || (badge !== undefined && (card.alertValues ?? []).includes(badge));
  // @panel says what it is; a preset is named for what it is.
  const label = n.params.label ?? card.label ?? (n.name === "panel" ? "" : (spec?.name ?? n.name));

  const parts: string[] = [];
  if (label || badge) {
    parts.push(
      `<p class="jot-card-kicker">${escapeHtml(label)}` +
        (badge ? `<span class="jot-badge"${alert ? ' data-alert="true"' : ""}>${escapeHtml(badge)}</span>` : "") +
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

const TREND: Record<string, string> = { up: "↑", down: "↓", flat: "→" };

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
  divider: ["divider"],
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
    const items =
      f.children.length > 0
        ? block(f.children.map((c) => renderNested(c)).join("\n"))
        : "";
    const basis = ratio[i] !== undefined ? ` style="flex-grow:${ratio[i]}"` : "";
    return `<div class="jot-col"${basis}>${heading}${items}</div>`;
  });

  const nested = n.children.map((c) => renderNode(c, diagnostics)).join("");
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
  decision:   { titleParam: "title", badgeParam: "status", alertValues: ["deprecated", "superseded"] },
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
  const lines = roots.map((r) => (r.children.length > 0 ? renderNested(r) : r.text));
  return block(lines.join("\n"));
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
  // sit inside a card, or a metric inside a diagram node.
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
//   1. Nodes must be able to CONTAIN other blocks. A metric inside a tree node
//      is the whole point of composition, and SVG cannot hold arbitrary flow
//      content without foreignObject, which brings its own problems.
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
  // @page configures the document rather than rendering; handled by the shell.
  if (n.name === "page") return "";
  return renderUnsupported(n, diagnostics);
}

function renderNode(n: Node, diagnostics: Diagnostic[]): string {
  switch (n.type) {
    case "heading":
      return renderHeading(n);
    case "list":
      return renderList(n);
    case "divider":
      return `<hr class="jot-divider" data-style="${escapeHtml(n.style)}" />`;
    case "quote":
      return renderQuote(n);
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
interface Row {
  content: Node[];
  notes: MarginNoteNode[];
}

function toRows(children: Node[]): Row[] {
  const rows: Row[] = [];
  for (const child of children) {
    if (child.type === "margin_note") {
      const last = rows[rows.length - 1];
      if (last) last.notes.push(child);
      else rows.push({ content: [], notes: [child] });
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
      const body = row.content.map((n) => renderNode(n, diagnostics)).join("");
      const aside = row.notes.map(renderNote).join("");
      // The row's kind lets CSS space blocks contextually. A uniform gap after
      // every block double-spaces a run of quotes and gives a horizontal rule
      // three rows to itself.
      const kind = row.content[0]?.type ?? "empty";
      const primitive = row.content[0]?.type === "block" ? row.content[0].name : "";
      // A row is its own element — the block beside its notes — rather than two
      // cells of one document-wide grid, because a printed page can only be
      // named (the landscape sheet) on a block in normal flow. See page.ts.
      return (
        `<div class="jot-row">` +
        `<div class="jot-body" data-kind="${escapeHtml(kind)}"${primitive ? ` data-primitive="${escapeHtml(primitive)}"` : ""}>${body}</div>` +
        `<div class="jot-aside">${aside}</div>` +
        `</div>`
      );
    })
    .join("");

  return `<div class="${escapeHtml(cls)}" data-mode="${options.mode}"><div class="jot-doc">${cells}</div></div>`;
}
