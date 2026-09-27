// Tab moves a line AND everything it owns.
//
// Indentation is the structure of this language — it is what says a line is
// inside a block rather than after it — so the key that changes indentation is
// the key that changes the shape of the document. Tab indenting one line out
// of a family is the editing equivalent of moving a function's signature and
// leaving its body behind: nothing errors, the file still renders, and it now
// means something else.
//
// Every outliner people already use does this: Workflowy, Logseq, Notion,
// Roam. Tab takes the children. There is no version of this where the author
// wanted the parent to leave without them.
//
// Two rules beyond "take the children":
//
//   A line may only indent to ONE level deeper than the line above it. Further
//   than that is a gap in the hierarchy — a child of nothing — and the parser
//   would accept it while the document stopped making sense.
//
//   Nothing happens inside a fenced code block. In a fence, indentation is
//   content, and re-parenting somebody's Python would be the worst kind of
//   help.
//
// The logic here takes a plain array of lines rather than a TextDocument, so
// it can be tested without an extension host (ENG-22).

/** Leading whitespace of a line, counting a tab as one column. */
export function indentOf(line: string): number {
  const match = /^[ \t]*/.exec(line);
  return match ? match[0].length : 0;
}

const isBlank = (line: string): boolean => line.trim().length === 0;

/**
 * The lines inside fenced code blocks.
 *
 * The lexer's own rule: a fence opens on three or more backticks or tildes and
 * closes on at least as many of the same character with nothing after them.
 */
export function fencedLines(lines: string[]): Set<number> {
  const inside = new Set<number>();
  let fence: string | null = null;
  lines.forEach((line, i) => {
    const match = /^\s*(`{3,}|~{3,})\s*(.*)$/.exec(line);
    if (fence !== null) {
      inside.add(i);
      if (match && match[1]![0] === fence[0] && match[1]!.length >= fence.length && !match[2]!.trim()) {
        fence = null;
      }
      return;
    }
    if (match) {
      fence = match[1]!;
      inside.add(i);
    }
  });
  return inside;
}

/**
 * The last line a run of selected lines owns.
 *
 * The parser's rule, restated for the third time in this codebase and
 * deliberately so: a block owns every following line indented further than it,
 * with blank lines inside the run kept. blockExtent() in indentation.ts is the
 * same rule for the ruler, and the renderer is the same rule for real. If they
 * ever disagree the editor is confidently lying about what the file means.
 */
export function ownedThrough(lines: string[], last: number): number {
  // A selection that ends on a blank line owns nothing past the line before it.
  let anchor = last;
  while (anchor > 0 && isBlank(lines[anchor] ?? "")) anchor--;
  if (isBlank(lines[anchor] ?? "")) return last;

  const indent = indentOf(lines[anchor]!);
  let end = anchor;
  for (let i = anchor + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (isBlank(line)) continue;
    if (indentOf(line) <= indent) break;
    end = i;
  }
  return Math.max(last, end);
}

/** The nearest non-blank line above `line`, or -1. */
function previousContentLine(lines: string[], line: number): number {
  for (let i = line - 1; i >= 0; i--) if (!isBlank(lines[i] ?? "")) return i;
  return -1;
}

export interface Reindent {
  /** Inclusive line range that will change, children included. */
  from: number;
  to: number;
  /** Columns to add (positive) or remove (negative) from each non-blank line. */
  delta: number;
  /** The new text of every line in the range, blank lines left blank. */
  lines: { line: number; text: string }[];
}

/**
 * Work out the re-indent for Tab or Shift-Tab over `from`..`to`.
 *
 * Returns undefined when the move is refused — the first line of a document
 * has no parent to join, a line at column zero has nowhere further left to go,
 * and a line two levels below the one above it would be a child of nothing.
 * Refusing is what every outliner does and what people expect; guessing a
 * different move would be worse.
 */
export function reindent(
  lines: string[],
  from: number,
  to: number,
  direction: 1 | -1,
  unit: number,
): Reindent | undefined {
  if (from < 0 || to >= lines.length || from > to) return undefined;

  const fenced = fencedLines(lines);
  for (let i = from; i <= to; i++) if (fenced.has(i)) return undefined;

  const end = ownedThrough(lines, to);
  // A child inside a fence cannot be dragged along either.
  for (let i = to + 1; i <= end; i++) if (fenced.has(i)) return undefined;

  const content: number[] = [];
  for (let i = from; i <= end; i++) if (!isBlank(lines[i] ?? "")) content.push(i);
  if (content.length === 0) return undefined;

  const base = Math.min(...content.map((i) => indentOf(lines[i]!)));

  let delta: number;
  if (direction === 1) {
    const parent = previousContentLine(lines, from);
    // Nothing above to be a child of.
    if (parent === -1) return undefined;
    // One level deeper than the line above, no more. Two levels is a gap in
    // the hierarchy: the parser accepts it and the document stops meaning what
    // it looks like it means.
    const deepest = indentOf(lines[parent]!) + unit;
    if (base + unit > deepest) return undefined;
    delta = unit;
  } else {
    if (base === 0) return undefined;
    // Never past the margin, and never by more than there is to give.
    delta = -Math.min(unit, base);
  }

  return {
    from,
    to: end,
    delta,
    lines: content.map((line) => ({
      line,
      text:
        delta > 0
          ? " ".repeat(delta) + lines[line]!
          : lines[line]!.slice(-delta),
    })),
  };
}

/**
 * Is the cursor somewhere a Tab means a tab?
 *
 * Past the indentation of a line with something on it: you are typing, and a
 * tab is a tab. `@table sep=tab` makes that a real thing somebody writes,
 * rather than a hypothetical.
 */
export function isTypingPosition(line: string, character: number): boolean {
  return line.trim().length > 0 && character > indentOf(line);
}
