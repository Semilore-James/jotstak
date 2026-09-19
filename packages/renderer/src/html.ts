// AST -> HTML.
//
// Blocks and their margin notes are emitted as paired grid cells: the block in
// column 1, any notes anchored to it in column 2 of the SAME grid row. Vertical
// alignment of a note against its anchor therefore falls out of the layout, with
// no measuring and no absolute positioning — which is what makes it survive
// reflow, font swaps and narrow viewports.

import MarkdownIt from "markdown-it";
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
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

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
  const by = n.params.by;
  const source = n.params.source;
  const credit =
    by || source
      ? `<cite>${[by, source].filter(Boolean).map((s) => escapeHtml(s!)).join(" — ")}</cite>`
      : "";
  return `<blockquote class="jot-quote">${text}${credit}</blockquote>`;
}

function renderNote(n: MarginNoteNode): string {
  return `<p class="jot-note">${inline(n.lines.join(" "))}</p>`;
}

function renderCard(n: BlockNode): string {
  const card = CARDS[n.name] ?? {};
  const spec = getPrimitive(n.name);
  const title = (card.titleParam ? n.params[card.titleParam] : undefined) ?? n.title;
  const badge = card.badgeParam ? n.params[card.badgeParam] : undefined;
  const alert = badge !== undefined && (card.alertValues ?? []).includes(badge);

  const parts: string[] = [];
  parts.push(
    `<p class="jot-card-kicker">${escapeHtml(spec?.name ?? n.name)}` +
      (badge ? `<span class="jot-badge"${alert ? ' data-alert="true"' : ""}>${escapeHtml(badge)}</span>` : "") +
      `</p>`,
  );
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

  parts.push(bodyParts(n));

  return `<section class="jot-card" data-primitive="${escapeHtml(n.name)}"${alert ? ' data-alert="true"' : ""}${attr("id", n.params.id)}>${parts.filter(Boolean).join("")}</section>`;
}

const TREND: Record<string, string> = { up: "↑", down: "↓", flat: "→" };

/** @evidence is a quotation with structured attribution, not a field card. */
function renderEvidence(n: BlockNode): string {
  const lines = n.body.shape === "plain" ? n.body.lines : [];
  const text = lines.length > 0 ? block(lines.join("\n")) : `<p>${inline(n.title)}</p>`;
  const credit = [n.params.by, n.params.source, n.params.date].filter(Boolean).map((s) => escapeHtml(s!));
  const tag = n.params.tag ? `<span class="jot-badge">${escapeHtml(n.params.tag)}</span>` : "";
  return (
    `<figure class="jot-evidence"${attr("id", n.params.id)}>` +
    `<blockquote>${text}</blockquote>` +
    (credit.length > 0 || tag
      ? `<figcaption>${credit.join(" · ")}${tag}</figcaption>`
      : "") +
    `</figure>`
  );
}

/** Callouts: the flavor is the shortcode, so it drives the colour and the label. */
function renderCallout(n: BlockNode): string {
  const flavor = n.params.flavor ?? "info";
  return (
    `<aside class="jot-callout" data-flavor="${escapeHtml(flavor)}"${attr("id", n.params.id)}>` +
    `<p class="jot-callout-label">${escapeHtml(flavor)}</p>` +
    (bodyParts(n) || `<p>${inline(n.title)}</p>`) +
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

interface CardSpec {
  /** Param used as the card's heading, if any. */
  titleParam?: string;
  /** Param rendered as the badge beside the kicker. */
  badgeParam?: string;
  /** Badge values that should read as a warning rather than neutral. */
  alertValues?: string[];
}

const CARDS: Record<string, CardSpec> = {
  decision:   { titleParam: "title", badgeParam: "status", alertValues: ["deprecated", "superseded"] },
  risk:       { titleParam: "title", badgeParam: "level", alertValues: ["high", "critical"] },
  assumption: { titleParam: "title", badgeParam: "confidence", alertValues: ["low"] },
  sprint:     { titleParam: "name" },
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

function bodyParts(n: BlockNode): string {
  if (n.body.shape === "keyed") return fieldRows(n.body.fields);
  if (n.body.shape === "mixed") {
    const loose = n.body.roots.length > 0
      ? `<ul class="jot-field-list">${n.body.roots.map((r) => `<li>${inline(r.text)}</li>`).join("")}</ul>`
      : "";
    return fieldRows(n.body.fields) + loose;
  }
  if (n.body.shape === "plain" && n.body.lines.length > 0) return block(n.body.lines.join("\n"));
  if (n.body.shape === "indented" && n.body.roots.length > 0) {
    return `<ul class="jot-field-list">${n.body.roots.map((r) => `<li>${inline(r.text)}</li>`).join("")}</ul>`;
  }
  return "";
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

function renderBlock(n: BlockNode, diagnostics: Diagnostic[]): string {
  if (n.name in CARDS) return renderCard(n);
  if (n.name === "evidence") return renderEvidence(n);
  if (n.name === "callout") return renderCallout(n);
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
      return `<hr class="jot-divider" />`;
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
  const cells = toRows(ast.children)
    .map((row) => {
      const body = row.content.map((n) => renderNode(n, diagnostics)).join("");
      const aside = row.notes.map(renderNote).join("");
      // The row's kind lets CSS space blocks contextually. A uniform gap after
      // every block double-spaces a run of quotes and gives a horizontal rule
      // three rows to itself.
      const kind = row.content[0]?.type ?? "empty";
      const primitive = row.content[0]?.type === "block" ? row.content[0].name : "";
      return (
        `<div class="jot-body" data-kind="${escapeHtml(kind)}"${primitive ? ` data-primitive="${escapeHtml(primitive)}"` : ""}>${body}</div>` +
        `<div class="jot-aside">${aside}</div>`
      );
    })
    .join("");

  return `<div class="${escapeHtml(cls)}" data-mode="${options.mode}"><div class="jot-doc">${cells}</div></div>`;
}
