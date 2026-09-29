// Helping somebody write a block: what one looks like when you first put it
// down, what a setting means in a line, and where the cursor is in the
// composition matrix.
//
// These lived in the VS Code extension, which was the only thing that wrote
// blocks for you. The playground's rack does too now, and two copies of "what
// a new @timeline looks like" would drift the day after they were written. So
// they are here, derived from the specs' own examples like everything else,
// and both surfaces format what they are given: the extension adds tabstops,
// the playground writes the text as it is.

import { getPrimitive } from "./index.js";
import type { PrimitiveSpec } from "./index.js";

// ── what a new block looks like ─────────────────────────────────────────────

/**
 * The bare text the example writes ON the directive line, if it writes any.
 *
 * Several blocks take their title there rather than as a parameter —
 * `@cover Discovery phase`, `@star_model Telemetry warehouse`,
 * `@table(style=sketch) Q4 status`. A scaffold that gave you the parameters
 * and the body and left that out produced `@cover` with a subtitle and no
 * title, which the renderer then complained about.
 */
export function exampleTitle(spec: PrimitiveSpec): string | undefined {
  const names = [spec.name, ...(spec.aliases ?? [])];
  for (const example of spec.examples) {
    for (const line of example.split("\n")) {
      const open = new RegExp(`^@(${names.join("|")})\\b(.*)$`).exec(line.trim());
      if (!open) continue;
      const rest = (open[2] ?? "")
        .replace(/\([^)]*\)/g, "") // a bracketed parameter list
        .replace(/[a-zA-Z_][a-zA-Z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)/g, "") // inline parameters
        .trim();
      if (rest) return rest;
    }
  }
  return undefined;
}

/**
 * The first body lines the primitive's own examples write UNDER the directive.
 *
 * Taken from the examples rather than written anywhere else, so a block's
 * scaffold and its documentation cannot say different things. The rule is
 * "find the line that opens this block, then take the body beneath it", which
 * is what makes it safe over examples not shaped like a single block:
 *
 *   `@footnote`  the reference comes first and the note second, so the
 *                directive is not on line one.
 *   `@cover`     what follows the directive is a continued parameter.
 *   `@numbered`  the example is the Markdown form, `1. First`, which never
 *                opens a directive at all. Nothing to copy, so nothing is.
 */
export function exampleBodyLines(spec: PrimitiveSpec): string[] {
  const names = [spec.name, ...(spec.aliases ?? [])];
  const opens = (line: string): boolean => names.some((n) => new RegExp(`^@${n}\\b`).test(line.trim()));
  const want = spec.scaffoldLines ?? 1;

  for (const example of spec.examples) {
    const lines = example.split("\n");
    const at = lines.findIndex(opens);
    if (at === -1) continue;

    // The body lines at the FIRST indent only. A timeline's detail is indented
    // under its event, and a scaffold that reaches into the second level starts
    // the author halfway down a structure they have not written the top of.
    const body: string[] = [];
    let indent = -1;
    for (const line of lines.slice(at + 1)) {
      if (!/^\s+\S/.test(line)) break; // blank, or back to column zero: block over
      const depth = line.search(/\S/);
      const text = line.trim();
      if (text.startsWith(")")) continue; // closing a parenthesised param list
      if (/^[a-z_]+\s*=/.test(text)) continue; // a continued parameter
      if (indent === -1) indent = depth;
      if (depth > indent) continue;
      body.push(text);
      if (body.length === want) break;
    }
    if (body.length > 0) return body;
  }
  return [];
}

/**
 * The whole body the first example writes under the directive, every level of
 * it, with its indentation kept relative to the body. Continued parameters
 * are left out: they are settings, and settings are the author's to add.
 */
export function exampleBody(spec: PrimitiveSpec): string[] {
  const names = [spec.name, ...(spec.aliases ?? [])];
  const opens = (line: string): boolean => names.some((n) => new RegExp(`^@${n}\\b`).test(line.trim()));
  for (const example of spec.examples) {
    const lines = example.split("\n");
    const at = lines.findIndex(opens);
    if (at === -1) continue;
    const body: string[] = [];
    let base = -1;
    for (const line of lines.slice(at + 1)) {
      if (!line.trim()) {
        body.push("");
        continue;
      }
      if (!/^\s/.test(line)) break; // back to column zero: block over
      const text = line.trim();
      if (text.startsWith(")") || /^[a-z_]+\s*=/.test(text)) continue;
      const depth = line.search(/\S/);
      if (base === -1) base = depth;
      body.push(" ".repeat(Math.max(0, depth - base)) + text);
    }
    while (body.length > 0 && body[body.length - 1] === "") body.pop();
    if (body.length > 0) return body;
  }
  return [];
}

/** What a body line of each shape looks like when the example gives us nothing. */
export const BODY_FALLBACK: Record<PrimitiveSpec["bodyShape"], string> = {
  none: "",
  plain: "text",
  keyed: "key: value",
  indented: "item",
  mixed: "text",
};

/** The value the examples give a parameter, exactly as written: `"Effort"`, `boxed`. */
export function exampleParam(spec: PrimitiveSpec, name: string): string | undefined {
  for (const example of spec.examples) {
    const m = new RegExp(`(?:^|[\\s(])${name}=("[^"]*"|'[^']*'|[^\\s)]+)`, "m").exec(example);
    if (m) return m[1];
  }
  return undefined;
}

/**
 * A new block as plain text: the required parameters with the values the
 * examples use, the title, and the body lines. The same shape the editor's
 * scaffold writes, without the tabstops — so a tile in the playground and an
 * autocomplete in VS Code put down the same block.
 *
 * Optional parameters are not written. A block you have to delete from is
 * worse than one you add to; the playground shows the optional ones beside it.
 *
 * `body: "whole"` writes the example's entire body instead of its first line.
 * The editor writes one line because you are about to type; the playground
 * writes all of it because you are about to LOOK, and a tree with one node or
 * a journey with one stage does not show what the block is.
 */
export function scaffoldSource(spec: PrimitiveSpec, options: { body?: "first" | "whole" } = {}): string {
  let head = `@${spec.name}`;
  for (const p of spec.params.filter((q) => q.required)) {
    const value =
      exampleParam(spec, p.name) ??
      (p.type === "enum" ? (p.default ?? p.enumValues?.[0] ?? p.name) : `"${p.name}"`);
    head += ` ${p.name}=${value}`;
  }
  const title = exampleTitle(spec);
  if (title) head += ` ${title}`;
  if (spec.bodyShape === "none") return head;

  const body = options.body === "whole" ? exampleBody(spec) : exampleBodyLines(spec);
  // `@heading Overview` and `@note revisit this at scale` say everything they
  // have to say on their own line; an indented `text` under them would be a
  // second empty place to write.
  if (body.length === 0 && !title) body.push(BODY_FALLBACK[spec.bodyShape]);
  return [head, ...body.map((l) => (l ? `  ${l}` : ""))].join("\n");
}

/**
 * The short form of a description: what comes before its first full stop or
 * its first em dash. The schema's descriptions are written for a docs page and
 * the longest is over 400 characters; on a card that is a wall, and a wall
 * gets skipped. The part before the first stop is reliably the sentence that
 * says what the thing IS; everything after it is why.
 */
export function briefly(text: string, limit = 120): string {
  // A full stop followed by a CAPITAL, so `e.g.` and `i.e.` do not count as
  // the end of anything.
  const cut = /^(.*?)(?:\.\s+(?=[A-Z])|\s—\s|$)/s.exec(text.trim());
  const first = (cut?.[1] ?? text).trim().replace(/[.;,]$/, "");
  if (first.length <= limit) return first;
  const clipped = first.slice(0, limit);
  return clipped.slice(0, clipped.lastIndexOf(" ")) + "…";
}

// ── where the cursor is ─────────────────────────────────────────────────────

export type Slot =
  /** The left edge: any block can start here. */
  | { kind: "page" }
  /** Directly inside a block that can hold another. */
  | { kind: "block"; parent: PrimitiveSpec; line: number }
  /** Somewhere only text goes: a quote, a column's lines, a list item, a tree's node. */
  | { kind: "text"; line: number };

const OPENER = /^\s*@([a-zA-Z_][a-zA-Z0-9_]*)/;
const MARKER = /^\s*(?:[-*]|\d+[.)])\s/;

const indentOf = (line: string): number => line.length - line.trimStart().length;

/**
 * What a line at `indent` on `line` belongs to.
 *
 * The parser's own rule, restated: the nearest line above with less indent
 * owns this one. Directly under a block's opening line is that block's body.
 * Under a line of text it depends on what the text is part of: a list item
 * and a column hold blocks (UX-65); a card's `key:`, a tree's node and a
 * paragraph do not. `line` on the result is the owning line, so a caller can
 * find the block to put something after.
 */
export function slotAt(lines: string[], line: number, indent: number): Slot {
  if (indent === 0) return { kind: "page" };
  let need = indent;
  let first = -1;
  let underText = false;
  let list: "bullet" | "numbered" | undefined;

  for (let k = line - 1; k >= 0; k--) {
    const text = lines[k]!;
    if (!text.trim() || indentOf(text) >= need) continue;
    if (first === -1) first = k;

    const m = OPENER.exec(text);
    const spec = m ? getPrimitive(m[1]!) : undefined;
    if (spec) {
      // Straight under the opening line: the block's own body.
      if (!underText && !list) {
        return spec.holds === "inside" || spec.holds === "below"
          ? { kind: "block", parent: spec, line: k }
          : { kind: "text", line: k };
      }
      // Under a line inside it: only a column or a list item holds a block.
      if (spec.name === "columns" || spec.holds === "items") return { kind: "block", parent: spec, line: k };
      return { kind: "text", line: first };
    }

    if (MARKER.test(text)) {
      list ??= /^\s*[-*]/.test(text) ? "bullet" : "numbered";
      // A Markdown list on the page itself. One inside a card is that card's
      // text, which the loop finds out when it reaches the card.
      if (indentOf(text) === 0) return { kind: "block", parent: getPrimitive(list)!, line: k };
    } else if (!list) {
      underText = true;
    }
    need = indentOf(text);
    if (need === 0) break;
  }
  return first === -1 ? { kind: "page" } : { kind: "text", line: first };
}
