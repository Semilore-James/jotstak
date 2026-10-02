// @jotstak/renderer — the shared heart.
// Parses .jot source into an AST and renders it to HTML in one of two modes.
// This same module is imported by the VS Code preview webview and the web playground,
// so it must stay framework-free and DOM-agnostic (returns HTML strings, not nodes).

import { parse } from "./parser.js";
import { renderDocument } from "./html.js";

export type RenderMode = "notebook" | "doc";

export interface RenderOptions {
  mode: RenderMode;
  /** Base URL for bundled assets (icons, fonts) so both surfaces can resolve them. */
  assetBase?: string;
  /** Selector the document is scoped under. Must match the CSS scope. */
  scope?: string;
}

export interface RenderResult {
  html: string;
  /** Diagnostics for the LSP: parse errors, unknown primitives, bad params. */
  diagnostics: Diagnostic[];
}

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  line: number;
  column: number;
}

// --- Pipeline: source -> tokens -> AST -> HTML -----------------------------
// parse()   lives in ./parser
// render()  lives in ./render
// Primitive definitions come from @jotstak/schema so behavior and docs never drift.

export function render(source: string, options: RenderOptions): RenderResult {
  const { ast, diagnostics } = parse(source);
  const html = renderDocument(ast, { mode: options.mode, scope: options.scope }, diagnostics);
  return { html, diagnostics };
}

export const RENDERER_VERSION = "0.0.0";

export { FONT_FACES, renderThemeCss } from "./css.js";
export type { FontFace, ThemeCssOptions } from "./css.js";

export { renderLayoutCss, BASELINE_OFFSET, toWholeRows } from "./layout.js";
export { PAGE, LANDSCAPE_PAGE, renderPageCss } from "./page.js";
export { measureText, ESTIMATE_SAFETY } from "./measure.js";
export { renderDocument, RENDER_FUNCTIONS } from "./html.js";
export type { HtmlOptions } from "./html.js";

// What the other outputs read a document with — the Word export — so that a
// card, a table, a cover and a note's anchor mean the same thing there as on
// the page. Each is the function the page itself is drawn from.
export { readCard, isCard, TREND, markdownFor, proseOf, toRows as rowsOf } from "./html.js";
export type { CardModel, Row } from "./html.js";
export { buildTable } from "./table.js";
export type { TableModel, Align } from "./table.js";
export { readCover } from "./cover.js";
export type { CoverModel, CoverStyle } from "./cover.js";
export * as tokens from "./tokens.js";

export { lex } from "./lexer.js";
export type { LineKind, LineToken, LexResult, DirectiveParams } from "./lexer.js";

export { parse, parseTokens } from "./parser.js";
export type { ParseResult } from "./parser.js";

export type {
  Position,
  Field,
  TreeNode,
  BlockBody,
  DocumentNode,
  BlockNode,
  HeadingNode,
  ListNode,
  DividerNode,
  QuoteNode,
  MarginNoteNode,
  MarkdownNode,
  Node,
} from "./ast.js";

// Pages on screen (UX-73): the one piece that runs in a browser, after render.
export { paginate, pagesScript, PAGE_GEOMETRY } from "./pages.js";
export type { PageGeometry, SheetGeometry } from "./pages.js";

// One document as a page of its own, for the file export and the PDF service.
export { renderStandalone, documentName } from "./standalone.js";
export type { StandaloneOptions } from "./standalone.js";
