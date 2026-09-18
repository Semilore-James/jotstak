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
export { renderDocument } from "./html.js";
export type { HtmlOptions } from "./html.js";
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
