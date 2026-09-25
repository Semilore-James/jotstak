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
