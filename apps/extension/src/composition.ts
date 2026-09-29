// Where the cursor is, in composition terms.
//
// Autocomplete offered all twenty-eight blocks on every `@`, wherever it was
// typed. Inside a quote that is twenty-eight wrong answers: a quote holds
// text, so whatever you pick is read as words and warned about. The schema now
// says which blocks go inside which (`holds`, `nests`), so the editor can ask
// the same question the parser does before it offers anything.
//
// No vscode import, so it is tested directly, like reparent.ts.

import { getPrimitive } from "@jotstak/schema";
import type { PrimitiveSpec } from "@jotstak/schema";

export type Slot =
  /** The left edge: any block can start here. */
  | { kind: "page" }
  /** Directly inside a block that can hold another. */
  | { kind: "block"; parent: PrimitiveSpec }
  /** Somewhere only text goes: a quote, a column's lines, a list item, a tree's node. */
  | { kind: "text" };

const OPENER = /^\s*@([a-zA-Z_][a-zA-Z0-9_]*)/;

const indentOf = (line: string): number => line.length - line.trimStart().length;

/**
 * What a line at `indent` on `line` belongs to.
 *
 * The parser's own rule, restated: the nearest line above with less indent owns
 * this one. If that is a block's opening line, this is that block's body; if
 * it is anything else — a `key:`, a list item, a node — this is under a line
 * of text, and a block cannot start there.
 */
export function slotAt(lines: string[], line: number, indent: number): Slot {
  if (indent === 0) return { kind: "page" };
  for (let k = line - 1; k >= 0; k--) {
    const text = lines[k]!;
    if (!text.trim() || indentOf(text) >= indent) continue;
    const m = OPENER.exec(text);
    const spec = m ? getPrimitive(m[1]!) : undefined;
    if (!spec) return { kind: "text" };
    return spec.holds === "text" ? { kind: "text" } : { kind: "block", parent: spec };
  }
  return { kind: "page" };
}
