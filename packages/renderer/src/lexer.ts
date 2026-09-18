// Lexer — the first pass of the .jot parser pipeline.
// Reads raw source, splits into lines, classifies each line by its leading
// syntax. Does NOT build a tree; the parser (Step 4) consumes these tokens.

import { getPrimitive, getAllParams, UNIVERSAL_PARAMS } from "@jotstak/schema";
import type { ParamSpec } from "@jotstak/schema";
import type { Diagnostic } from "./index.js";

// ── Token types ──────────────────────────────────────────────────────────

export type LineKind =
  | "directive"     // @primitive [params]
  | "heading"       // # / ## / ###
  | "bullet"        // - item
  | "numbered"      // 1. item
  | "divider"       // ---
  | "blockquote"    // > text (Markdown blockquote)
  | "margin_note"   // >> text
  | "comment"       // // text
  | "body"          // indented continuation line
  | "blank"         // empty or whitespace-only
  | "text";         // everything else — handed to markdown-it

export interface DirectiveParams {
  /** Parsed key=value pairs. Unquoted values are trimmed strings. */
  params: Record<string, string>;
  /** The bare text after the @name and params (the "title" or inline body). */
  rest: string;
}

export interface LineToken {
  kind: LineKind;
  /** 0-based line number in the source. */
  line: number;
  /** 0-based column of the first non-whitespace character. */
  column: number;
  /** Number of leading spaces (tabs expanded to 2). */
  indent: number;
  /** The raw source text of this line (no trailing newline). */
  raw: string;
  /** The meaningful content after stripping the leading syntax marker. */
  content: string;

  // ── Only set for kind === "directive" ──
  /** The primitive name (e.g. "decision", "star_model"). */
  name?: string;
  /** Parsed inline params and trailing text. */
  directive?: DirectiveParams;

  // ── Only set for kind === "heading" ──
  /** 1, 2, or 3. */
  headingLevel?: number;
}

// ── Param parser ─────────────────────────────────────────────────────────

const PARAM_RE = /([a-zA-Z_][a-zA-Z0-9_]*)=(?:"([^"]*?)"|'([^']*?)'|(\S+))/g;

function parseInlineParams(
  text: string,
  primitiveName: string,
  lineNum: number,
  diagnostics: Diagnostic[],
): DirectiveParams {
  const params: Record<string, string> = {};
  let lastIndex = 0;

  PARAM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PARAM_RE.exec(text)) !== null) {
    const key = match[1]!;
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    params[key] = value;
    lastIndex = PARAM_RE.lastIndex;
  }

  const allParams = getAllParams(primitiveName);
  for (const key of Object.keys(params)) {
    const spec = allParams.find((p) => p.name === key);
    if (!spec) {
      diagnostics.push({
        severity: "warning",
        message: `Unknown param "${key}" on @${primitiveName}.`,
        line: lineNum,
        column: 0,
      });
      continue;
    }
    validateParamValue(spec, params[key]!, primitiveName, lineNum, diagnostics);
  }

  const rest = text.slice(lastIndex).trim();
  return { params, rest };
}

function validateParamValue(
  spec: ParamSpec,
  value: string,
  primitiveName: string,
  lineNum: number,
  diagnostics: Diagnostic[],
): void {
  if (spec.type === "enum" && spec.enumValues) {
    if (!spec.enumValues.includes(value)) {
      diagnostics.push({
        severity: "error",
        message: `Invalid value "${value}" for param "${spec.name}" on @${primitiveName}. Expected one of: ${spec.enumValues.join(", ")}.`,
        line: lineNum,
        column: 0,
      });
    }
  }
  if (spec.type === "number" && !/^-?\d+(\.\d+)?$/.test(value)) {
    diagnostics.push({
      severity: "warning",
      message: `Param "${spec.name}" on @${primitiveName} expects a number, got "${value}".`,
      line: lineNum,
      column: 0,
    });
  }
  if (spec.type === "boolean" && !["true", "false"].includes(value)) {
    diagnostics.push({
      severity: "warning",
      message: `Param "${spec.name}" on @${primitiveName} expects true or false, got "${value}".`,
      line: lineNum,
      column: 0,
    });
  }
}

// ── Line classification ──────────────────────────────────────────────────

const DIRECTIVE_RE = /^@([a-zA-Z_][a-zA-Z0-9_]*)\s*(.*)/;
const HEADING_RE = /^(#{1,3})\s+(.*)/;
const BULLET_RE = /^-\s+(.*)/;
const NUMBERED_RE = /^\d+\.\s+(.*)/;
const DIVIDER_RE = /^---+\s*$/;
const BLOCKQUOTE_RE = /^>\s(.*)/;
const MARGIN_NOTE_RE = /^>>\s*(.*)/;
const COMMENT_RE = /^\/\/\s?(.*)/;

function measureIndent(raw: string): { indent: number; stripped: string } {
  let indent = 0;
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === " ") {
      indent++;
      i++;
    } else if (raw[i] === "\t") {
      indent += 2;
      i++;
    } else {
      break;
    }
  }
  return { indent, stripped: raw.slice(i) };
}

function classifyLine(
  raw: string,
  lineNum: number,
  diagnostics: Diagnostic[],
): LineToken {
  const { indent, stripped } = measureIndent(raw);
  const column = raw.length - raw.trimStart().length;

  const base = {
    line: lineNum,
    column,
    indent,
    raw,
  };

  if (stripped.length === 0) {
    return { ...base, kind: "blank", content: "" };
  }

  // Indented lines (2+ spaces) are body lines — they belong to the block
  // above them. We check this BEFORE syntax markers so that indented
  // `- item` inside a block body stays as body, not a new bullet.
  // Exception: a line at indent 0 is never body.
  if (indent >= 2) {
    return { ...base, kind: "body", content: stripped };
  }

  // Margin note: >> must come before blockquote > to avoid ambiguity
  const marginMatch = MARGIN_NOTE_RE.exec(stripped);
  if (marginMatch) {
    return { ...base, kind: "margin_note", content: marginMatch[1] ?? "" };
  }

  // Comment
  const commentMatch = COMMENT_RE.exec(stripped);
  if (commentMatch) {
    return { ...base, kind: "comment", content: commentMatch[1] ?? "" };
  }

  // Directive: @name [params] [rest]
  const directiveMatch = DIRECTIVE_RE.exec(stripped);
  if (directiveMatch) {
    const name = directiveMatch[1]!;
    const afterName = directiveMatch[2] ?? "";
    const spec = getPrimitive(name);

    if (!spec) {
      diagnostics.push({
        severity: "error",
        message: `Unknown primitive "@${name}".`,
        line: lineNum,
        column,
      });
    }

    const directive = parseInlineParams(
      afterName,
      name,
      lineNum,
      diagnostics,
    );

    // Check required params
    if (spec) {
      const allParams = getAllParams(name);
      for (const p of allParams) {
        if (p.required && !(p.name in directive.params)) {
          diagnostics.push({
            severity: "error",
            message: `Missing required param "${p.name}" on @${name}.`,
            line: lineNum,
            column,
          });
        }
      }
    }

    return {
      ...base,
      kind: "directive",
      content: afterName,
      name,
      directive,
    };
  }

  // Heading: # / ## / ###
  const headingMatch = HEADING_RE.exec(stripped);
  if (headingMatch) {
    return {
      ...base,
      kind: "heading",
      content: headingMatch[2] ?? "",
      headingLevel: headingMatch[1]!.length as 1 | 2 | 3,
    };
  }

  // Divider: --- (must come before bullet to avoid ambiguity with -)
  if (DIVIDER_RE.test(stripped)) {
    return { ...base, kind: "divider", content: "" };
  }

  // Bullet: - item
  const bulletMatch = BULLET_RE.exec(stripped);
  if (bulletMatch) {
    return { ...base, kind: "bullet", content: bulletMatch[1] ?? "" };
  }

  // Numbered: 1. item
  const numberedMatch = NUMBERED_RE.exec(stripped);
  if (numberedMatch) {
    return { ...base, kind: "numbered", content: numberedMatch[1] ?? "" };
  }

  // Blockquote: > text
  const blockquoteMatch = BLOCKQUOTE_RE.exec(stripped);
  if (blockquoteMatch) {
    return { ...base, kind: "blockquote", content: blockquoteMatch[1] ?? "" };
  }

  // Everything else is plain text — markdown-it will handle it
  return { ...base, kind: "text", content: stripped };
}

// ── Public API ───────────────────────────────────────────────────────────

export interface LexResult {
  tokens: LineToken[];
  diagnostics: Diagnostic[];
}

export function lex(source: string): LexResult {
  const diagnostics: Diagnostic[] = [];
  const lines = source.split(/\r?\n/);
  const tokens = lines.map((raw, i) => classifyLine(raw, i, diagnostics));
  return { tokens, diagnostics };
}
