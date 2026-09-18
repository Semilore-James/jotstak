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
  const spec = getPrimitive(n.name);
  const title = n.params.title ?? n.title;
  const status = n.params.status;

  const parts: string[] = [];
  parts.push(
    `<p class="jot-card-kicker">${escapeHtml(spec?.name ?? n.name)}${status ? ` · ${escapeHtml(status)}` : ""}</p>`,
  );
  if (title) parts.push(`<p class="jot-card-title">${inline(title)}</p>`);

  if (n.body.shape === "keyed" || n.body.shape === "mixed") {
    const rows = n.body.fields
      .map(
        (f) =>
          `<div class="jot-field"><span class="jot-field-key">${escapeHtml(f.key)}</span><span class="jot-field-value">${inline(f.value)}</span></div>`,
      )
      .join("");
    if (rows) parts.push(`<div class="jot-fields">${rows}</div>`);
  } else if (n.body.shape === "plain" && n.body.lines.length > 0) {
    parts.push(block(n.body.lines.join("\n")));
  }

  return `<section class="jot-card" data-primitive="${escapeHtml(n.name)}"${attr("id", n.params.id)}>${parts.join("")}</section>`;
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

// Primitives the first render pass covers as drawn cards. Everything else falls
// back to readable text rather than disappearing.
const CARD_PRIMITIVES = new Set(["decision"]);

function renderBlock(n: BlockNode, diagnostics: Diagnostic[]): string {
  if (CARD_PRIMITIVES.has(n.name)) return renderCard(n);
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
      return `<div class="jot-body">${body}</div><div class="jot-aside">${aside}</div>`;
    })
    .join("");

  return `<div class="${escapeHtml(cls)}" data-mode="${options.mode}"><div class="jot-doc">${cells}</div></div>`;
}
