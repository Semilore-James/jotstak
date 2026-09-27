// Indentation assistance.
//
// Indentation decides what a block OWNS, so a wrong indent does not error —
// it silently changes what the document means. A line one space too far left
// stops being a child and becomes a sibling, and the file still renders, just
// differently from what was intended. That is the sharpest edge in the
// language and it is the editor's job to take it off.
//
// The rules are built from the schema rather than typed out, so a primitive
// added tomorrow indents correctly without anyone remembering this file. The
// schema already knows which primitives take a body: those are exactly the
// ones Enter should indent after.

import * as vscode from "vscode";
import { PRIMITIVES } from "@jotstak/schema";
import { fencedLines, isTypingPosition, reindent } from "./reparent.js";
import { isJot } from "./jot-files.js";

/** Directives that hold something, and therefore open a level. */
function bodyTaking(): string {
  const names = PRIMITIVES.filter((p) => p.bodyShape !== "none").flatMap((p) => [
    p.name,
    ...(p.aliases ?? []),
  ]);
  // Longest first, so `@star_model` is not matched as `@star` by an alternation.
  return names.sort((a, b) => b.length - a.length).join("|");
}

export function registerIndentation(context: vscode.ExtensionContext): void {
  const opens = new RegExp(`^\\s*@(${bodyTaking()})\\b.*$`);
  // `owner:` with nothing after it is a field whose value is indented under it.
  const opensField = /^\s*[A-Za-z_][A-Za-z0-9_ -]*:\s*$/;

  const listItem = /^(\s*)([-*+]|\d+[.)])\s+(?=\S)/;
  const emptyListItem = /^(\s*)([-*+]|\d+[.)])\s*$/;

  context.subscriptions.push(
    vscode.languages.setLanguageConfiguration("jot", {
      indentationRules: {
        increaseIndentPattern: new RegExp(`(${opens.source})|(${opensField.source})`),
        // Nothing in .jot closes a level with a token — indentation IS the
        // structure — so an outdent is always something the author did on
        // purpose, and guessing one would undo it.
        decreaseIndentPattern: /^\s*$(?!\s)/,
      },
      onEnterRules: [
        // A list carries on, the way it does everywhere else a person types.
        {
          beforeText: listItem,
          action: {
            indentAction: vscode.IndentAction.None,
            appendText: "- ",
          },
        },
        // …until the item is empty, where Enter means "done with the list"
        // rather than "another empty bullet".
        {
          beforeText: emptyListItem,
          action: { indentAction: vscode.IndentAction.Outdent },
        },
        // A directive that takes a body opens one.
        {
          beforeText: opens,
          action: { indentAction: vscode.IndentAction.Indent },
        },
        {
          beforeText: opensField,
          action: { indentAction: vscode.IndentAction.Indent },
        },
      ],
    }),
  );
}

/**
 * The lines a block owns: itself, plus everything indented further than it,
 * with blank lines inside the run kept and blank lines trailing it dropped.
 *
 * This is the parser's own rule, restated — which is the point. A ruler that
 * used a different rule from the renderer would be worse than none, because it
 * would be confidently wrong about the one thing it exists to show.
 */
export function blockExtent(doc: vscode.TextDocument, line: number): vscode.Range | undefined {
  const opener = doc.lineAt(line);
  if (opener.isEmptyOrWhitespace) return undefined;

  const indent = opener.firstNonWhitespaceCharacterIndex;
  let last = line;
  for (let i = line + 1; i < doc.lineCount; i++) {
    const text = doc.lineAt(i);
    if (text.isEmptyOrWhitespace) continue;
    if (text.firstNonWhitespaceCharacterIndex <= indent) break;
    last = i;
  }
  if (last === line) return undefined;
  return new vscode.Range(line, 0, last, doc.lineAt(last).text.length);
}

// ── Tab and Shift-Tab: move a line and what it owns ──────────────────────
//
// The rule itself is in reparent.ts, which imports no vscode and is tested
// without one. This is only the wiring: work out which lines the selection
// means, apply the edit, and put the cursor back where the author left it.

/**
 * When Tab should stay out of the way and do what Tab does everywhere.
 *
 * Mid-line, because you are typing and a tab is a tab — `@table sep=tab` makes
 * that a real thing somebody writes. Inside a fence, because indentation there
 * is the program. And with several cursors, because re-parenting several
 * families at once is a different feature and guessing at it would be worse
 * than not having it.
 */
function shouldFallThrough(editor: vscode.TextEditor, forward: boolean): boolean {
  if (editor.selections.length > 1) return true;

  const lines = editor.document.getText().split(/\r?\n/);
  const fenced = fencedLines(lines);
  const { start, end } = editor.selection;
  for (let i = start.line; i <= end.line; i++) if (fenced.has(i)) return true;

  // Shift-Tab outdents the line wherever the cursor is, the way it does in
  // every editor. Tab only re-parents from the indentation.
  if (!forward) return false;
  if (!editor.selection.isEmpty) return false;
  return isTypingPosition(editor.document.lineAt(start.line).text, start.character);
}

async function move(forward: boolean): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isJot(editor.document)) {
    await vscode.commands.executeCommand(forward ? "tab" : "outdent");
    return;
  }

  if (shouldFallThrough(editor, forward)) {
    await vscode.commands.executeCommand(forward ? "tab" : "outdent");
    return;
  }

  const lines = editor.document.getText().split(/\r?\n/);
  const { start, end } = editor.selection;
  // A selection that ends at column zero has not really reached that line.
  const last = end.line > start.line && end.character === 0 ? end.line - 1 : end.line;

  const unit = Number(editor.options.tabSize) || 2;
  const plan = reindent(lines, start.line, last, forward ? 1 : -1, unit);
  // Refused: there is no parent to join, or nowhere further left to go. Doing
  // nothing is what every outliner does here, and inserting spaces instead
  // would write exactly the indent that was just refused.
  if (!plan) return;

  await editor.edit(
    (builder) => {
      for (const { line, text } of plan.lines) {
        builder.replace(new vscode.Range(line, 0, line, lines[line]!.length), text);
      }
    },
    { undoStopBefore: true, undoStopAfter: true },
  );

  // Keep the cursor on the same character of the same line. Without this it
  // lands wherever the replaced range left it, which for a whole-line replace
  // is the end of the line.
  const shift = (p: vscode.Position): vscode.Position =>
    new vscode.Position(p.line, Math.max(0, p.character + plan.delta));
  editor.selection = new vscode.Selection(shift(editor.selection.anchor), shift(editor.selection.active));
}

export function registerReparent(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("jotstak.indent", () => move(true)),
    vscode.commands.registerCommand("jotstak.outdent", () => move(false)),
  );
}
