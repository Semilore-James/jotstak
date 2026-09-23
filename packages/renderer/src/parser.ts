// Parser — second pass of the pipeline. Consumes the lexer's flat token list
// and builds the AST: groups body lines under their directive, shapes each body
// according to the schema, nests lists by indentation, and normalises Markdown
// shorthands onto the same nodes their @primitive equivalents produce.

import { getPrimitive } from "@jotstak/schema";
import type { PrimitiveSpec } from "@jotstak/schema";
import { lex } from "./lexer.js";
import type { LineToken } from "./lexer.js";
import type {
  BlockBody,
  DocumentNode,
  Field,
  Node,
  Position,
  TreeNode,
} from "./ast.js";
import type { Diagnostic } from "./index.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function posOf(t: LineToken): Position {
  return { line: t.line, column: t.column };
}

/** Lines that look like `key: value`. Bullets, tree markers and status tags aren't fields. */
const FIELD_RE = /^([A-Za-z_][A-Za-z0-9_ -]*?):[ \t]*(.*)$/;

function isFieldLine(text: string): boolean {
  if (/^[-*>\[<]/.test(text)) return false;
  return FIELD_RE.test(text);
}

interface Entry {
  indent: number;
  text: string;
  position: Position;
}

/** A node's own words, without the markers that steer layout rather than read. */
function bareLabel(text: string): string {
  return text.replace(/^([-*]|\d+[.)]|[<>])\s+/, "").trim();
}

/**
 * Build a hierarchy from indentation. Deeper lines become children of the last
 * shallower line.
 *
 * Siblings are expected to line up, and a line that does not is reported. This
 * is the single sharpest edge in the language: indentation decides structure,
 * so one stray space silently reshapes the document, and the source still looks
 * right because a one-space difference is not visible while you type. A
 * dir=split tree lost its whole left side this way — a branch indented one
 * space too far became a child of its sibling, so there was nothing left to
 * balance against and the hub drifted off centre. Nothing in the output said
 * why. Now it does.
 *
 * Only sibling *consistency* is checked, never the size of the step, so
 * indenting by two, three or four spaces is equally fine as long as a set of
 * siblings agrees with itself.
 */
function buildTree(entries: Entry[], diagnostics?: Diagnostic[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: { indent: number; node: TreeNode; childIndent?: number }[] = [];
  let rootIndent: number | undefined;

  const disagree = (e: Entry, expected: number, parentText: string | null): void => {
    if (!diagnostics) return;
    const where = parentText === null ? "the other top-level lines" : `the other children of "${bareLabel(parentText)}"`;
    diagnostics.push({
      severity: "warning",
      message:
        `Ambiguous indentation: this line sits ${e.indent} spaces in, but ${where} sit at ${expected}. ` +
        `Indent it to ${expected} to line up with them, or out to make it a sibling one level up.`,
      line: e.position.line,
      column: e.position.column,
    });
  };

  for (const e of entries) {
    const node: TreeNode = { text: e.text, children: [], position: e.position };
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= e.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      if (parent.childIndent === undefined) parent.childIndent = e.indent;
      else if (parent.childIndent !== e.indent) disagree(e, parent.childIndent, parent.node.text);
      parent.node.children.push(node);
    } else {
      if (rootIndent === undefined) rootIndent = e.indent;
      else if (rootIndent !== e.indent) disagree(e, rootIndent, null);
      roots.push(node);
    }
    stack.push({ indent: e.indent, node });
  }
  return roots;
}

/** Collect the indented lines belonging to the block that starts at `start`. */
function collectBody(
  tokens: LineToken[],
  start: number,
): { body: LineToken[]; next: number } {
  const body: LineToken[] = [];
  let pendingBlanks: LineToken[] = [];
  let i = start;

  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t.kind === "blank") {
      pendingBlanks.push(t);
      i++;
      continue;
    }
    if (t.indent >= 2) {
      // A blank only stays in the body if more body follows it.
      body.push(...pendingBlanks, t);
      pendingBlanks = [];
      i++;
      continue;
    }
    break;
  }
  return { body, next: i };
}

/**
 * Pull nested `@blocks` out of a body before it is shaped.
 *
 * A directive at the body's base indent starts a child block, which owns every
 * deeper-indented line under it. The chunk is dedented and run back through the
 * lexer and parser, so nesting is recursive and costs no new grammar — a nested
 * block behaves exactly like a top-level one.
 *
 * Line numbers are mapped back to the original document as the tokens come out,
 * so diagnostics and LSP positions still point at the real file.
 */
function extractNested(
  body: LineToken[],
  baseIndent: number,
  diagnostics: Diagnostic[],
): { own: LineToken[]; children: Node[] } {
  const own: LineToken[] = [];
  const children: Node[] = [];

  let i = 0;
  while (i < body.length) {
    const t = body[i]!;
    const isNested =
      t.kind !== "blank" && t.indent === baseIndent && /^@[a-zA-Z_][a-zA-Z0-9_]*/.test(t.content);

    if (!isNested) {
      own.push(t);
      i++;
      continue;
    }

    const chunk: LineToken[] = [t];
    let j = i + 1;
    while (j < body.length) {
      const c = body[j]!;
      if (c.kind === "blank") {
        chunk.push(c);
        j++;
        continue;
      }
      if (c.indent <= baseIndent) break;
      chunk.push(c);
      j++;
    }
    while (chunk.length > 0 && chunk[chunk.length - 1]!.kind === "blank") chunk.pop();

    const text = chunk
      .map((c) => (c.kind === "blank" ? "" : " ".repeat(Math.max(0, c.indent - baseIndent)) + c.content))
      .join("\n");

    const sub = lex(text);
    // Map the sub-document's line numbers back onto the real file.
    const remap = (line: number): Position => {
      const origin = chunk[line];
      return origin ? posOf(origin) : posOf(t);
    };
    for (const tok of sub.tokens) {
      const p = remap(tok.line);
      tok.line = p.line;
      tok.column = p.column;
    }
    for (const d of sub.diagnostics) {
      const p = remap(d.line);
      diagnostics.push({ ...d, line: p.line, column: p.column });
    }
    children.push(...parseTokens(sub.tokens, diagnostics).children);
    i = j;
  }

  return { own, children };
}

/** Split body lines into base-indent fields and everything else, per body shape. */
function shapeBody(
  body: LineToken[],
  shape: PrimitiveSpec["bodyShape"],
  diagnostics: Diagnostic[],
): BlockBody {
  if (shape === "none" || body.length === 0) {
    return shape === "none" ? { shape: "none" } : emptyFor(shape);
  }

  const baseIndent = Math.min(
    ...body.filter((t) => t.kind !== "blank").map((t) => t.indent),
  );

  if (shape === "plain") {
    const lines = body.map((t) =>
      t.kind === "blank" ? "" : " ".repeat(t.indent - baseIndent) + t.content,
    );
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return { shape: "plain", lines };
  }

  // keyed / indented / mixed all work off base-indent lines plus their children.
  const fields: Field[] = [];
  const roots: TreeNode[] = [];
  const looseEntries: Entry[] = [];

  let i = 0;
  while (i < body.length) {
    const t = body[i]!;
    if (t.kind === "blank") {
      i++;
      continue;
    }

    // Gather this line's deeper-indented children.
    const children: Entry[] = [];
    let j = i + 1;
    while (j < body.length) {
      const c = body[j]!;
      if (c.kind === "blank") {
        j++;
        continue;
      }
      if (c.indent <= t.indent) break;
      children.push({ indent: c.indent, text: c.content, position: posOf(c) });
      j++;
    }

    const treatAsField = shape !== "indented" && isFieldLine(t.content);
    if (treatAsField) {
      const m = FIELD_RE.exec(t.content)!;
      fields.push({
        key: m[1]!.trim(),
        value: m[2]!.trim(),
        children: buildTree(children, diagnostics),
        position: posOf(t),
      });
    } else {
      looseEntries.push({ indent: t.indent, text: t.content, position: posOf(t) });
      looseEntries.push(...children);
    }
    i = j;
  }

  roots.push(...buildTree(looseEntries, diagnostics));

  if (shape === "keyed") return { shape: "keyed", fields };
  if (shape === "indented") return { shape: "indented", roots };
  return { shape: "mixed", fields, roots };
}

function emptyFor(shape: PrimitiveSpec["bodyShape"]): BlockBody {
  switch (shape) {
    case "plain":
      return { shape: "plain", lines: [] };
    case "keyed":
      return { shape: "keyed", fields: [] };
    case "indented":
      return { shape: "indented", roots: [] };
    case "mixed":
      return { shape: "mixed", fields: [], roots: [] };
    default:
      return { shape: "none" };
  }
}

function bodyToLines(body: BlockBody): string[] {
  if (body.shape === "plain") return body.lines;
  if (body.shape === "indented") return body.roots.map((r) => r.text);
  return [];
}

/**
 * Resolve shortcode sugar into explicit params:
 *   `@warn ...`     -> callout with flavor=warn   (alias maps onto an enum param)
 *   `@callout warn` -> callout with flavor=warn   (first bare word matches that param)
 */
function applyShorthandParams(
  spec: PrimitiveSpec,
  writtenName: string,
  params: Record<string, string>,
  title: string,
): { params: Record<string, string>; title: string } {
  const out = { ...params };

  if (writtenName !== spec.name) {
    const target = spec.params.find(
      (p) => p.type === "enum" && p.enumValues?.includes(writtenName),
    );
    if (target && !(target.name in out)) out[target.name] = writtenName;
  }

  const first = spec.params[0];
  if (first?.type === "enum" && first.enumValues && !(first.name in out)) {
    const word = title.split(/\s+/)[0];
    if (word && first.enumValues.includes(word)) {
      out[first.name] = word;
      return { params: out, title: title.slice(word.length).trim() };
    }
  }

  return { params: out, title };
}

// ── Parser ───────────────────────────────────────────────────────────────

export function parseTokens(
  tokens: LineToken[],
  diagnostics: Diagnostic[],
): DocumentNode {
  const children: Node[] = [];
  let markdownBuf: string[] = [];
  let markdownStart: Position | null = null;

  const flushMarkdown = (): void => {
    while (markdownBuf.length > 0 && markdownBuf[markdownBuf.length - 1] === "") {
      markdownBuf.pop();
    }
    if (markdownBuf.length > 0 && markdownStart) {
      children.push({
        type: "markdown",
        text: markdownBuf.join("\n"),
        position: markdownStart,
      });
    }
    markdownBuf = [];
    markdownStart = null;
  };

  /**
   * Flush the run of prose so far, but leave its LAST paragraph as a block of
   * its own — because a margin note is about the paragraph it follows, not
   * about everything written since the last directive.
   *
   * It matters visually: a block with a note beside it narrows to make room,
   * and without this the note narrowed every paragraph back to the top of the
   * run. Only a plain final paragraph is split off; a list, a quote, a table
   * or anything near a fence is left whole, because cutting one of those in
   * half would change what it means.
   */
  const flushMarkdownKeepingLastParagraph = (): void => {
    while (markdownBuf.length > 0 && markdownBuf[markdownBuf.length - 1] === "") {
      markdownBuf.pop();
    }
    const blank = markdownBuf.lastIndexOf("");
    const last = markdownBuf.slice(blank + 1);
    const fenced = markdownBuf.some((l) => l.trimStart().startsWith("```"));
    const plain = last.length > 0 && last.every((l) => /^\S/.test(l) && !/^([-*+>#|]|\d+[.)])\s/.test(l));

    if (blank > 0 && plain && !fenced && markdownStart) {
      const head = markdownBuf.slice(0, blank);
      children.push({ type: "markdown", text: head.join("\n"), position: markdownStart });
      markdownBuf = last;
      markdownStart = { ...markdownStart, line: markdownStart.line + blank + 1 };
    }
    flushMarkdown();
  };

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;

    switch (t.kind) {
      case "blank": {
        if (markdownBuf.length > 0) markdownBuf.push("");
        i++;
        break;
      }

      case "comment": {
        i++;
        break;
      }

      case "text": {
        if (markdownBuf.length === 0) markdownStart = posOf(t);
        markdownBuf.push(t.content);
        i++;
        break;
      }

      case "body": {
        // An indented line with no block above it. Four or more spaces is a
        // Markdown indented code block, so keep the indentation and let
        // markdown-it read it as code. Two or three is more likely a mis-indented
        // block body, so it still gets flagged — but either way nothing is lost.
        if (markdownBuf.length === 0) markdownStart = posOf(t);
        markdownBuf.push(" ".repeat(t.indent) + t.content);
        if (t.indent < 4) {
          diagnostics.push({
            severity: "warning",
            message:
              "Indented line does not belong to any block; treated as ordinary text.",
            line: t.line,
            column: t.column,
          });
        }
        i++;
        break;
      }

      case "heading": {
        flushMarkdown();
        children.push({
          type: "heading",
          level: (t.headingLevel ?? 1) as 1 | 2 | 3,
          text: t.content,
          params: {},
          position: posOf(t),
        });
        i++;
        break;
      }

      case "divider": {
        flushMarkdown();
        children.push({ type: "divider", style: "line", position: posOf(t) });
        i++;
        break;
      }

      case "bullet":
      case "numbered": {
        flushMarkdown();
        const ordered = t.kind === "numbered";
        const entries: Entry[] = [];
        const startPos = posOf(t);

        while (i < tokens.length) {
          const cur = tokens[i]!;
          if (cur.kind === t.kind && cur.indent === 0) {
            entries.push({ indent: 0, text: cur.content, position: posOf(cur) });
            i++;
            const nested = collectBody(tokens, i);
            for (const n of nested.body) {
              if (n.kind === "blank") continue;
              const marker = /^(?:[-*]\s+|\d+\.\s+)/.exec(n.content);
              if (marker) {
                entries.push({
                  indent: n.indent,
                  text: n.content.slice(marker[0].length),
                  position: posOf(n),
                });
              } else {
                // No marker: a wrapped continuation of the item above, not a
                // child of it. Markdown's lazy continuation — losing this makes
                // every line-wrapped bullet sprout a phantom sub-bullet.
                const prev = entries[entries.length - 1];
                if (prev) prev.text = `${prev.text} ${n.content}`;
                else entries.push({ indent: n.indent, text: n.content, position: posOf(n) });
              }
            }
            i = nested.next;
            continue;
          }
          break;
        }

        children.push({
          type: "list",
          ordered,
          items: buildTree(entries, diagnostics),
          position: startPos,
        });
        break;
      }

      case "blockquote": {
        flushMarkdown();
        const lines: string[] = [];
        const startPos = posOf(t);
        while (i < tokens.length && tokens[i]!.kind === "blockquote") {
          lines.push(tokens[i]!.content);
          i++;
        }
        children.push({ type: "quote", lines, params: {}, position: startPos });
        break;
      }

      case "margin_note": {
        flushMarkdownKeepingLastParagraph();
        children.push({
          type: "margin_note",
          lines: [t.content],
          params: {},
          position: posOf(t),
        });
        i++;
        break;
      }

      case "directive": {
        const written = t.name!;
        const spec = getPrimitive(written);
        // `@note` is the long form of `>>` and attaches the same way: to the
        // paragraph it follows, not to everything written before it.
        if (spec?.name === "note") flushMarkdownKeepingLastParagraph();
        else flushMarkdown();
        const startPos = posOf(t);
        const collected = collectBody(tokens, i + 1);
        i = collected.next;

        if (!spec) {
          // The lexer already reported the unknown primitive; keep the text.
          const lines = collected.body
            .filter((b) => b.kind !== "blank")
            .map((b) => b.content);
          children.push({
            type: "markdown",
            text: [t.directive?.rest ?? "", ...lines].filter(Boolean).join("\n"),
            position: startPos,
          });
          break;
        }

        const resolved = applyShorthandParams(
          spec,
          written,
          t.directive?.params ?? {},
          t.directive?.rest ?? "",
        );
        const realLines = collected.body.filter((b) => b.kind !== "blank");
        const baseIndent = realLines.length > 0 ? Math.min(...realLines.map((b) => b.indent)) : 2;
        const { own, children: nested } = extractNested(collected.body, baseIndent, diagnostics);
        const body = shapeBody(own, spec.bodyShape, diagnostics);

        // Normalise onto the node type that matches the concept, so the
        // renderer never has to care which spelling was used.
        switch (spec.name) {
          case "heading": {
            const lvl = Number(resolved.params.level ?? "1");
            children.push({
              type: "heading",
              level: (lvl >= 1 && lvl <= 3 ? lvl : 1) as 1 | 2 | 3,
              text: resolved.title || bodyToLines(body)[0] || "",
              params: resolved.params,
              position: startPos,
            });
            break;
          }
          case "divider": {
            children.push({
              type: "divider",
              style: resolved.params.style ?? "line",
              position: startPos,
            });
            break;
          }
          case "quote": {
            const lines = bodyToLines(body);
            children.push({
              type: "quote",
              lines: lines.length > 0 ? lines : [resolved.title].filter(Boolean),
              params: resolved.params,
              position: startPos,
            });
            break;
          }
          case "note": {
            const lines = bodyToLines(body);
            children.push({
              type: "margin_note",
              lines: lines.length > 0 ? lines : [resolved.title].filter(Boolean),
              params: resolved.params,
              position: startPos,
            });
            break;
          }
          case "bullet":
          case "numbered": {
            const roots = body.shape === "indented" ? body.roots : [];
            children.push({
              type: "list",
              ordered: spec.name === "numbered",
              items: roots,
              position: startPos,
            });
            break;
          }
          default: {
            children.push({
              type: "block",
              name: spec.name,
              ...(written !== spec.name ? { writtenAs: written } : {}),
              params: resolved.params,
              title: resolved.title,
              body,
              children: nested,
              position: startPos,
            });
          }
        }
        break;
      }
    }
  }

  flushMarkdown();
  return { type: "document", children, position: { line: 0, column: 0 } };
}

export interface ParseResult {
  ast: DocumentNode;
  diagnostics: Diagnostic[];
}

export function parse(source: string): ParseResult {
  const { tokens, diagnostics } = lex(source);
  const ast = parseTokens(tokens, diagnostics);
  return { ast, diagnostics };
}
