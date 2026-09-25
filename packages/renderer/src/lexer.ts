// Lexer — the first pass of the .jot parser pipeline.
// Reads raw source, splits into lines, classifies each line by its leading
// syntax. Does NOT build a tree; the parser (Step 4) consumes these tokens.

import { getPrimitive, getAllParams, PRIMITIVES, UNIVERSAL_PARAMS } from "@jotstak/schema";
import type { ParamSpec } from "@jotstak/schema";
import type { Diagnostic } from "./index.js";
import type { HeadingLevel } from "./ast.js";

// ── Token types ──────────────────────────────────────────────────────────

export type LineKind =
  | "directive"     // @primitive [params]
  | "heading"       // # through ######
  | "bullet"        // - item
  | "numbered"      // 1. item
  | "divider"       // ---
  | "blockquote"    // > text (Markdown blockquote)
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
  headingLevel?: HeadingLevel;
}

// ── Param parser ─────────────────────────────────────────────────────────

const PARAM_RE = /([a-zA-Z_][a-zA-Z0-9_]*)=(?:"([^"]*?)"|'([^']*?)'|(\S+))/g;

/**
 * Splits `(a=1 b=2) trailing text` into the param region and whatever follows.
 * Returns null when the text does not use the parenthesised form.
 */
function splitParenRegion(text: string): { inside: string; after: string } | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("(")) return null;

  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (quote !== null) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        return { inside: trimmed.slice(1, i), after: trimmed.slice(i + 1).trim() };
      }
    }
  }
  // Unbalanced — the lexer has already reported it; take everything as params.
  return { inside: trimmed.slice(1), after: "" };
}

/**
 * Parse a parenthesised parameter list that was written on its own line,
 * under the directive it belongs to. The parser reaches for this when a
 * block's first body line opens with `(` — see the note there.
 */
export function lexParams(
  text: string,
  primitiveName: string,
  lineNum: number,
  diagnostics: Diagnostic[],
): DirectiveParams {
  return parseInlineParams(text.trimStart(), primitiveName, lineNum, diagnostics);
}

function parseInlineParams(
  text: string,
  primitiveName: string,
  lineNum: number,
  diagnostics: Diagnostic[],
): DirectiveParams {
  const params: Record<string, string> = {};
  let lastIndex = 0;

  // `@name(...)` keeps params and trailing text explicitly separated, so a
  // title containing an `=` cannot be misread as a param and vice versa.
  const paren = splitParenRegion(text);
  const scan = paren ? paren.inside : text;

  PARAM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PARAM_RE.exec(scan)) !== null) {
    const key = match[1]!;
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    params[key] = value;
    lastIndex = PARAM_RE.lastIndex;
  }

  // `key: value` where `key=value` was meant.
  //
  // PARAM_RE only matches `=`, so a colon never became a param and never
  // reached the unknown-param check below either: someone wrote
  // `(color:yellow title="…")` and the colour silently went nowhere. Quoted
  // values are blanked first, so a colon inside a title is not a mistake.
  const unquoted = scan.replace(/"[^"]*"|'[^']*'/g, (m) => " ".repeat(m.length));
  for (const m of unquoted.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(\S+)/g)) {
    diagnostics.push({
      severity: "warning",
      message: `Parameters use \`=\`, not \`:\`. Write \`${m[1]}=${m[2]}\` on @${primitiveName}.`,
      line: lineNum,
      column: 0,
    });
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

  const rest = paren ? paren.after : text.slice(lastIndex).trim();
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
const HEADING_RE = /^(#{1,6})\s+(.*)/;
const BULLET_RE = /^-\s+(.*)/;
const NUMBERED_RE = /^\d+\.\s+(.*)/;
const DIVIDER_RE = /^---+\s*$/;
const BLOCKQUOTE_RE = /^>\s(.*)/;
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

/** An opening or closing code fence: three or more backticks or tildes. */
const FENCE_RE = /^(`{3,}|~{3,})\s*(.*)$/;


/**
 * What went wrong when `@something` is not a primitive.
 *
 * Almost always one of two things, and saying which turns a dead end into a
 * correction. Someone wrote `@label The problem is fragmentation` inside a
 * @panel, and "Unknown primitive" is a true sentence that helps nobody: label
 * IS a real thing, it is just a PARAMETER, and parameters are written on the
 * block's own line rather than as blocks of their own.
 *
 * The other case is a near miss on a real name, which is worth catching for
 * the same reason.
 */
function unknownDirective(name: string): string {
  const owners = PRIMITIVES.filter((p) => p.params.some((x) => x.name === name)).map((p) => p.name);
  if (owners.length > 0 || UNIVERSAL_PARAMS.some((x) => x.name === name)) {
    // Naming all seven owners of `title` would be a message nobody reads.
    const where =
      owners.length === 0
        ? "every block"
        : owners.length <= 3
          ? owners.map((o) => `@${o}`).join(", ")
          : `@${owners[0]} and ${owners.length - 1} others`;
    const on = owners[0] ?? "panel";
    return (
      `\`${name}\` is a parameter of ${where}, not a block of its own. ` +
      `Write it on the block's line: \`@${on}(${name}="…")\`.`
    );
  }

  const near = PRIMITIVES.map((p) => p.name).find(
    (n) => n.startsWith(name.slice(0, 3)) || name.startsWith(n.slice(0, 3)),
  );
  return `Unknown primitive "@${name}".` + (near ? ` Did you mean \`@${near}\`?` : "");
}


function classifyLine(
  raw: string,
  lineNum: number,
  diagnostics: Diagnostic[],
  fence: FenceState,
): LineToken {
  const { indent, stripped } = measureIndent(raw);
  const column = raw.length - raw.trimStart().length;

  const base = {
    line: lineNum,
    column,
    indent,
    raw,
  };

  // Fenced code is literal. Everything between the fences is handed through as
  // text so markdown-it sees an intact block: without this a `# comment` inside
  // a shell example becomes a heading and a `- item` becomes a bullet, silently
  // destroying the block and breaking the "any .md renders unchanged" promise.
  const fenceMatch = FENCE_RE.exec(stripped);
  if (fence.marker !== null) {
    const closes =
      fenceMatch !== null &&
      fenceMatch[1]![0] === fence.marker[0] &&
      fenceMatch[1]!.length >= fence.marker.length &&
      (fenceMatch[2] ?? "").trim() === "";
    if (closes) fence.marker = null;
    return { ...base, kind: "text", content: raw };
  }
  if (fenceMatch) {
    fence.marker = fenceMatch[1]!;
    return { ...base, kind: "text", content: raw };
  }

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

  // `>>` used to mean a margin note here. It does not any more, and that is a
  // correctness fix rather than a preference: `>> text` is valid Markdown — a
  // blockquote inside a blockquote — so every .md file that quoted a quote
  // rendered its inner quote as a note in the margin. A superset that changes
  // what existing Markdown means is not a superset.
  //
  // The Markdown shorthands (#, -, |, >) exist because .md files must keep
  // working. Jotstak's own blocks use Jotstak's own syntax: @note.

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
        message: unknownDirective(name),
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

  // Heading: # through ######
  const headingMatch = HEADING_RE.exec(stripped);
  if (headingMatch) {
    return {
      ...base,
      kind: "heading",
      content: headingMatch[2] ?? "",
      headingLevel: headingMatch[1]!.length as HeadingLevel,
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

/** Carries fence state across lines; a fence spans many of them. */
interface FenceState {
  marker: string | null;
}

/** A directive opening a parenthesised param list: `@name(` possibly with params after. */
const PAREN_OPEN_RE = /^@[a-zA-Z_][a-zA-Z0-9_]*\s*\(/;

/**
 * Net parenthesis depth of a line, ignoring parens inside quoted values so a
 * title like "Pricing (Q3)" does not unbalance the list.
 */
function parenDelta(text: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote !== null) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
  }
  return depth;
}

export function lex(source: string): LexResult {
  const diagnostics: Diagnostic[] = [];
  const lines = source.split(/\r?\n/);
  const fence: FenceState = { marker: null };
  const tokens: LineToken[] = [];

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i]!;

    // A parenthesised param list may span lines. Join it back into one logical
    // line before classifying, so the rest of the lexer never has to know that
    // params can wrap. Not applied inside a code fence, where `@name(` is text.
    if (fence.marker === null && PAREN_OPEN_RE.test(raw.trimStart())) {
      let depth = parenDelta(raw);
      if (depth > 0) {
        const parts = [raw];
        let j = i + 1;
        while (j < lines.length && depth > 0) {
          parts.push(lines[j]!);
          depth += parenDelta(lines[j]!);
          j++;
        }
        if (depth > 0) {
          diagnostics.push({
            severity: "error",
            message: "Unclosed `(` in the param list; expected a matching `)`.",
            line: i,
            column: raw.length - raw.trimStart().length,
          });
        }
        const joined = parts.map((p, k) => (k === 0 ? p : p.trim())).join(" ");
        tokens.push(classifyLine(joined, i, diagnostics, fence));
        i = j;
        continue;
      }
    }

    tokens.push(classifyLine(raw, i, diagnostics, fence));
    i++;
  }

  if (fence.marker !== null) {
    diagnostics.push({
      severity: "warning",
      message: `Unclosed \`${fence.marker}\` code fence; everything after it is treated as code.`,
      line: lines.length - 1,
      column: 0,
    });
  }
  return { tokens, diagnostics };
}
