// The block-extent ruler: which lines does the block I am inside actually own?
//
// You asked for this in September, and the reason is that indentation decides
// ownership silently. Looking at a long @panel there is no way to tell where
// its body stops — the closing bracket that would tell you in any other
// language does not exist here, on purpose. So the editor draws it: a line
// down the left of everything the block under your cursor contains.
//
// It walks up from the cursor to find the OPENER, rather than decorating
// whatever line the cursor happens to be on, because the question a person is
// asking is always "what am I inside?" and never "what does this one line
// contain?".

import * as vscode from "vscode";
import { isJot } from "./jot-files.js";
import { blockExtent } from "./indentation.js";

const RULER = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  borderWidth: "0 0 0 2px",
  borderStyle: "solid",
  light: { borderColor: "rgba(198, 113, 57, 0.35)" },
  dark: { borderColor: "rgba(210, 123, 66, 0.45)" },
});

/** The nearest line at or above `line` that something is indented under. */
function openerAbove(doc: vscode.TextDocument, line: number): number | undefined {
  const here = doc.lineAt(line);
  const indent = here.isEmptyOrWhitespace
    ? Number.MAX_SAFE_INTEGER
    : here.firstNonWhitespaceCharacterIndex;

  // The cursor's own line opens something: that is the block, and it wins.
  if (!here.isEmptyOrWhitespace && blockExtent(doc, line)) return line;

  for (let i = line - 1; i >= 0; i--) {
    const text = doc.lineAt(i);
    if (text.isEmptyOrWhitespace) continue;
    if (text.firstNonWhitespaceCharacterIndex < indent) return i;
  }
  return undefined;
}

export function registerExtentRuler(context: vscode.ExtensionContext): void {
  const draw = (editor: vscode.TextEditor | undefined): void => {
    if (!editor || !isJot(editor.document)) return;
    const line = editor.selection.active.line;
    const opener = openerAbove(editor.document, line);
    const extent = opener === undefined ? undefined : blockExtent(editor.document, opener);
    editor.setDecorations(RULER, extent ? [extent] : []);
  };

  context.subscriptions.push(
    RULER,
    vscode.window.onDidChangeTextEditorSelection((e) => draw(e.textEditor)),
    vscode.window.onDidChangeActiveTextEditor(draw),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) draw(editor);
    }),
  );
  draw(vscode.window.activeTextEditor);
}
