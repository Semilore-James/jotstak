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

/** Build a hierarchy from indentation. Deeper lines become children of the last shallower line. */
function buildTree(entries: Entry[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: { indent: number; node: TreeNode }[] = [];

  for (const e of entries) {
    const node: TreeNode = { text: e.text, children: [], position: e.position };
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= e.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) parent.node.children.push(node);
    else roots.push(node);
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

/** Split body lines into base-indent fields and everything else, per body shape. */
function shapeBody(
  body: LineToken[],
  shape: PrimitiveSpec["bodyShape"],
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
        children: buildTree(children),
        position: posOf(t),
      });
    } else {
      looseEntries.push({ indent: t.indent, text: t.content, position: posOf(t) });
      looseEntries.push(...children);
    }
    i = j;
  }

  roots.push(...buildTree(looseEntries));

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
          items: buildTree(entries),
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
        flushMarkdown();
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
        flushMarkdown();
        const written = t.name!;
        const spec = getPrimitive(written);
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
        const body = shapeBody(collected.body, spec.bodyShape);

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
