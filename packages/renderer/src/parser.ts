// Parser — second pass of the pipeline. Consumes the lexer's flat token list
// and builds the AST: groups body lines under their directive, shapes each body
// according to the schema, nests lists by indentation, and normalises Markdown
// shorthands onto the same nodes their @primitive equivalents produce.

import { getPrimitive } from "@jotstak/schema";
import type { PrimitiveSpec } from "@jotstak/schema";
import { lex, lexParams } from "./lexer.js";
import type { LineToken } from "./lexer.js";
import type {
  BlockBody,
  DocumentNode,
  Field,
  HeadingLevel,
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
  /** Blocks written under this line: a list item's figure (UX-65). */
  blocks?: Node[];
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
    if (e.blocks) node.blocks = e.blocks;
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

    const { chunk, next } = chunkAt(body, i);
    children.push(...parseChunk(chunk, diagnostics));
    i = next;
  }

  return { own, children };
}

/** The block starting at body[i]: that line, and every deeper line after it. */
function chunkAt(body: LineToken[], i: number): { chunk: LineToken[]; next: number } {
  const t = body[i]!;
  const chunk: LineToken[] = [t];
  let j = i + 1;
  while (j < body.length) {
    const c = body[j]!;
    if (c.kind !== "blank" && c.indent <= t.indent) break;
    chunk.push(c);
    j++;
  }
  while (chunk.length > 0 && chunk[chunk.length - 1]!.kind === "blank") chunk.pop();
  return { chunk, next: j };
}

/**
 * Parse a chunk as a document of its own: dedented, lexed, parsed. Line
 * numbers are mapped back onto the real file as the tokens come out, so
 * diagnostics and editor positions still point at the line that was written.
 */
function parseChunk(chunk: LineToken[], diagnostics: Diagnostic[]): Node[] {
  const head = chunk[0]!;
  const text = chunk
    .map((c) => (c.kind === "blank" ? "" : " ".repeat(Math.max(0, c.indent - head.indent)) + c.content))
    .join("\n");

  const sub = lex(text);
  const remap = (line: number): Position => {
    const origin = chunk[line];
    return origin ? posOf(origin) : posOf(head);
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
  return parseTokens(sub.tokens, diagnostics).children;
}

/** A line that opens a block the schema knows. `@alex said` is not one. */
function knownOpener(t: LineToken): boolean {
  if (t.kind === "blank") return false;
  const m = /^@([a-zA-Z_][a-zA-Z0-9_]*)/.exec(t.content);
  return !!m && !!getPrimitive(m[1]!);
}

/**
 * Pull out the blocks written UNDER a line of a body, rather than at its base:
 * the ones under a list item, or under a column's key (UX-65). `ownerOf` names
 * the line each belongs to, or nothing, in which case it is left where it is
 * for reportStrayBlocks to explain. Returned by owner line, in source order.
 */
function extractUnder(
  body: LineToken[],
  ownerOf: (i: number) => LineToken | undefined,
  parent: PrimitiveSpec,
  where: string,
  diagnostics: Diagnostic[],
): { own: LineToken[]; under: Map<number, Node[]> } {
  const own: LineToken[] = [];
  const under = new Map<number, Node[]>();
  let i = 0;
  while (i < body.length) {
    const owner = knownOpener(body[i]!) ? ownerOf(i) : undefined;
    if (!owner) {
      own.push(body[i]!);
      i++;
      continue;
    }
    const { chunk, next } = chunkAt(body, i);
    const nodes = parseChunk(chunk, diagnostics).map((c) => admit(c, parent, diagnostics, where));
    under.set(owner.line, [...(under.get(owner.line) ?? []), ...nodes]);
    i = next;
  }
  return { own, under };
}

/** The nearest line above body[i] that is less indented: the one it sits under. */
const lineAbove =
  (body: LineToken[]) =>
  (i: number): LineToken | undefined => {
    const t = body[i]!;
    for (let k = i - 1; k >= 0; k--) {
      const o = body[k]!;
      if (o.kind !== "blank" && o.indent < t.indent) return o;
    }
    return undefined;
  };

/** The `key:` of the column body[i] is written in, at any depth inside it. */
const columnAbove =
  (body: LineToken[], baseIndent: number) =>
  (i: number): LineToken | undefined => {
    if (body[i]!.indent <= baseIndent) return undefined;
    for (let k = i - 1; k >= 0; k--) {
      const o = body[k]!;
      if (o.kind === "blank" || o.indent !== baseIndent) continue;
      return isFieldLine(o.content) ? o : undefined;
    }
    return undefined;
  };

// ── Composition ──────────────────────────────────────────────────────────
//
// Which blocks go inside which is the schema's call (`holds` and `nests`), not
// each renderer's. Before it was, a tree in a panel worked, a tree in a column
// printed its own source back as a paragraph, and a tree in a quote vanished,
// all three without a word. The rule now is one sentence: a block written
// somewhere it cannot go keeps its words as text, and a warning says where it
// can go instead.

const DIRECTIVE_RE = /^@([a-zA-Z_][a-zA-Z0-9_]*)/;

/** The @-name a node was written as, for the node types that have one. */
function nameOf(n: Node): string | undefined {
  switch (n.type) {
    case "block":
      return n.writtenAs ?? n.name;
    case "margin_note":
      return "note";
    case "quote":
      return "quote";
    case "heading":
      return "heading";
    case "divider":
      return "divider";
    case "list":
      return n.ordered ? "numbered" : "bullet";
    default:
      return undefined;
  }
}

/** Every word a body holds, children included, so a demoted block loses nothing. */
function bodyText(body: BlockBody): string[] {
  const tree = (nodes: TreeNode[]): string[] => nodes.flatMap((t) => [t.text, ...tree(t.children)]);
  const fields = (fs: Field[]): string[] =>
    fs.flatMap((f) => [`${f.key}: ${f.value}`.trim(), ...tree(f.children)]);
  switch (body.shape) {
    case "plain":
      return body.lines;
    case "keyed":
      return fields(body.fields);
    case "indented":
      return tree(body.roots);
    case "mixed":
      return [...fields(body.fields), ...tree(body.roots)];
    default:
      return [];
  }
}

/**
 * Check one block nested inside `parent` against the matrix. A block that
 * belongs to the page rather than to a block — a margin note, a cover, a
 * sticky — is turned back into its words, where it used to be rendered as
 * nothing (a note) or as a block with a wrong explanation (a sticky said it
 * had "no renderer yet").
 */
function admit(
  child: Node,
  parent: PrimitiveSpec,
  diagnostics: Diagnostic[],
  where = `\`@${parent.name}\``,
): Node {
  const written = nameOf(child);
  const spec = written ? getPrimitive(written) : undefined;
  if (!written || !spec) return child;

  if (!spec.nests) {
    const after = parent.holds === "items" ? "list" : parent.name;
    const hint =
      spec.name === "note"
        ? `Write it at the left edge, straight after the ${after}, and it sits in the margin beside it.`
        : "Write it at the left edge instead.";
    diagnostics.push({
      severity: "warning",
      message: `\`@${written}\` goes on the page itself, not inside another block, so inside ${where} it is read as text. ${hint}`,
      line: child.position.line,
      column: child.position.column,
    });
    const words =
      child.type === "block"
        ? [child.title, ...bodyText(child.body)]
        : child.type === "margin_note"
          ? child.lines
          : [];
    return { type: "markdown", text: words.filter(Boolean).join("\n"), position: child.position };
  }

  if (parent.holds === "below") {
    diagnostics.push({
      severity: "info",
      message: `\`@${written}\` is drawn below this ${parent.name}, not inside it: a figure has nowhere inside it for another block. Write it at the left edge to say so.`,
      line: child.position.line,
      column: child.position.column,
    });
  }
  return child;
}

/**
 * Report a `@block` written where only text can go: the body of a block that
 * holds text, a column of @columns, a line of a tree. These are read as words,
 * which is correct — a directive only means something where a block can be —
 * but nothing on the page says that the words were meant to be a figure.
 */
function reportStrayBlocks(
  own: LineToken[],
  baseIndent: number,
  parent: PrimitiveSpec,
  diagnostics: Diagnostic[],
): void {
  own.forEach((t, i) => {
    if (t.kind === "blank") return;
    const m = DIRECTIVE_RE.exec(t.content);
    const child = m ? getPrimitive(m[1]!) : undefined;
    if (!child) return;

    let owner: LineToken | undefined;
    for (let k = i - 1; k >= 0 && t.indent > baseIndent; k--) {
      const o = own[k]!;
      if (o.kind !== "blank" && o.indent < t.indent) {
        owner = o;
        break;
      }
    }
    // Under another stray block, which has already been reported: one warning
    // per mistake, not one per line of it.
    if (owner && DIRECTIVE_RE.test(owner.content) && getPrimitive(DIRECTIVE_RE.exec(owner.content)![1]!)) return;

    const at = `\`@${m![1]}\``;
    const elsewhere = child.nests
      ? "A `@panel` can hold it."
      : "It goes on the page itself, at the left edge.";

    let message: string;
    if (!owner && parent.holds === "items") {
      // In @bullet's own body every line is an item, so a block at that indent
      // sits BETWEEN two items rather than under one.
      message = `${at} can't go between the items of \`@${parent.name}\`. Indent it under the item it belongs to and it goes inside that item.`;
    } else if (!owner) {
      message = `${at} can't go inside \`@${parent.name}\`, which holds text rather than blocks. ${elsewhere}`;
    } else {
      const field = isFieldLine(owner.content) ? FIELD_RE.exec(owner.content)![1]!.trim() : undefined;
      const label = bareLabel(owner.content);
      const where =
        field !== undefined
          ? parent.name === "columns"
            ? `the \`${field}\` column`
            : `the \`${field}\` field`
          : parent.name === "tree"
            ? `the node “${label}”`
            : `the line “${label}”`;
      const hint =
        parent.name === "columns"
          ? "Write it at the columns' own indent and it becomes a column of its own."
          : parent.holds === "inside"
            ? `Write it at the ${parent.name}'s own indent and it goes inside the ${parent.name}.`
            : parent.holds === "below"
              ? `Write it at the ${parent.name}'s own indent and it is drawn below the ${parent.name}.`
              : elsewhere;
      message = `${at} can't go under ${where}, which holds text rather than blocks. ${hint}`;
    }
    diagnostics.push({ severity: "warning", message, line: t.line, column: t.column });
  });
}

/** Give each item or column the blocks that were written under it. */
function attachUnder(body: BlockBody, under: Map<number, Node[]>): void {
  const walk = (nodes: TreeNode[]): void => {
    for (const n of nodes) {
      const got = under.get(n.position.line);
      if (got) n.blocks = got;
      walk(n.children);
    }
  };
  if (body.shape === "keyed" || body.shape === "mixed") {
    for (const f of body.fields) {
      const got = under.get(f.position.line);
      if (got) f.blocks = got;
    }
  }
  if (body.shape === "indented" || body.shape === "mixed") walk(body.roots);
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
    // An alias either IS the value — `@warn` meaning `flavor=warn` — or carries
    // it as a trailing number: `@h2` meaning `level=2`. The second form is how
    // headings get six shortcodes without six primitives.
    const byValue = spec.params.find(
      (p) => p.type === "enum" && p.enumValues?.includes(writtenName),
    );
    const suffix = /^[a-z]+(\d+)$/.exec(writtenName)?.[1];
    const bySuffix =
      byValue || !suffix
        ? undefined
        : spec.params.find((p) => p.type === "enum" && p.enumValues?.includes(suffix));

    const target = byValue ?? bySuffix;
    if (target && !(target.name in out)) out[target.name] = byValue ? writtenName : suffix!;
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
          level: (t.headingLevel ?? 1) as HeadingLevel,
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
            const listSpec = getPrimitive(ordered ? "numbered" : "bullet")!;
            for (let b = 0; b < nested.body.length; b++) {
              const n = nested.body[b]!;
              if (n.kind === "blank") continue;

              // A block under a list item goes inside that item (UX-65): a
              // point, and the tree that explains it indented beneath. It
              // used to be glued onto the item's words — "A point @tree Root
              // Child" — which is the report that started the matrix.
              if (knownOpener(n)) {
                const { chunk, next } = chunkAt(nested.body, b);
                let owner = entries[entries.length - 1]!;
                for (let k = entries.length - 1; k >= 0; k--) {
                  if (entries[k]!.indent < n.indent) {
                    owner = entries[k]!;
                    break;
                  }
                }
                const blocks = parseChunk(chunk, diagnostics).map((c) =>
                  admit(c, listSpec, diagnostics, "a list item"),
                );
                owner.blocks = [...(owner.blocks ?? []), ...blocks];
                b = next - 1;
                continue;
              }

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

      case "directive": {
        const written = t.name!;
        const spec = getPrimitive(written);
        // A note attaches to the paragraph it follows, not to everything
        // written before it.
        if (spec?.name === "note") flushMarkdownKeepingLastParagraph();
        else flushMarkdown();
        const startPos = posOf(t);
        const collected = collectBody(tokens, i + 1);
        i = collected.next;

        // Parameters written on the line BELOW the directive.
        //
        // `@panel` then an indented `(title="…")` is a natural thing to write
        // once a parameter list is long enough to want its own line, and
        // ADR-003 already blesses a parenthesised list that spans lines. It
        // used to fall through as body text: the panel came out holding the
        // literal characters `(title="…")`, with no diagnostic, so the only
        // signal was that the block looked wrong.
        const opener = collected.body.find((b) => b.kind !== "blank");
        if (opener && opener.content.trimStart().startsWith("(")) {
          // Only if it really is a parameter list. A paragraph that happens to
          // open with a bracket is prose, and swallowing it would trade one
          // silent loss for another.
          const probe: Diagnostic[] = [];
          const extra = lexParams(opener.content, written, t.line, probe);
          if (Object.keys(extra.params).length > 0) {
            diagnostics.push(...probe);
            t.directive = {
              params: { ...(t.directive?.params ?? {}), ...extra.params },
              rest: [t.directive?.rest, extra.rest].filter(Boolean).join(" "),
            };
            collected.body.splice(collected.body.indexOf(opener), 1);
          }
        }

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
        // A block that holds text keeps every line as text, including one that
        // starts with `@`. Pulling those out as blocks is what used to lose
        // them: a quote, a heading or a note had nowhere to render a child,
        // so the child and everything under it simply went.
        // A list's body is its items, so a list keeps its lines too, and takes
        // out only the blocks written UNDER an item, below.
        const extracted =
          spec.holds === "text" || spec.holds === "items"
            ? { own: collected.body, children: [] as Node[] }
            : extractNested(collected.body, baseIndent, diagnostics);
        let own = extracted.own;
        const nested = extracted.children.map((c) => admit(c, spec, diagnostics));

        // Blocks under a line rather than at the base (UX-65): under a list
        // item they go inside the item; under a column's key, in that column.
        let under = new Map<number, Node[]>();
        if (spec.holds === "items") {
          ({ own, under } = extractUnder(own, lineAbove(own), spec, "a list item", diagnostics));
        } else if (spec.name === "columns") {
          ({ own, under } = extractUnder(own, columnAbove(own, baseIndent), spec, "a column", diagnostics));
        }
        reportStrayBlocks(own, baseIndent, spec, diagnostics);
        const body = shapeBody(own, spec.bodyShape, diagnostics);
        if (under.size > 0) attachUnder(body, under);

        // Normalise onto the node type that matches the concept, so the
        // renderer never has to care which spelling was used.
        switch (spec.name) {
          case "heading": {
            const lvl = Number(resolved.params.level ?? "1");
            const lines = bodyToLines(body);
            children.push({
              type: "heading",
              level: (lvl >= 1 && lvl <= 6 ? lvl : 1) as HeadingLevel,
              text: resolved.title || lines[0] || "",
              params: resolved.params,
              position: startPos,
            });
            // A heading is one line. Whatever else was indented under it used
            // to go nowhere at all — found by rendering every block inside
            // every other one — so it follows the heading as a paragraph.
            const rest = resolved.title ? lines : lines.slice(1);
            if (rest.some((l) => l.trim())) {
              children.push({ type: "markdown", text: rest.join("\n"), position: startPos });
            }
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
            // `@journey(dir=vertical) title="Onboarding"` reads as a block
            // whose TITLE is the eight characters `title="Onboarding"`, which
            // is correct and useless. Params in brackets are a closed set, so
            // anything after them is bare text — and a bare text that is
            // shaped like a param is always a mistake. Caught here rather than
            // per primitive, because every primitive can be written this way.
            const stray = /^([a-z_]+)\s*=\s*"?([^"]*)"?\s*$/i.exec(resolved.title.trim());
            if (stray && spec.params.some((p) => p.name === stray[1]!.toLowerCase())) {
              diagnostics.push({
                severity: "warning",
                message: `\`${stray[1]}\` is a parameter, but it is written after the brackets, so it is being read as this block's text. Move it inside: \`@${written}(… ${stray[1]}="${stray[2]}")\`.`,
                line: startPos.line,
                column: startPos.column,
              });
            }
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
