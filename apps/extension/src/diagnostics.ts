// The renderer's diagnostics, in the Problems panel.
//
// The renderer already explains itself well — it says which quadrant an item
// landed in and why, that a table's cells will wrap and that the type stays
// full size, that a timeline would fit if it ran down the page instead. All of
// that was only visible to someone reading the playground's diagnostics list.
//
// Putting them here is most of what makes the editor feel like it understands
// the file: a squiggle under the line that caused it, and the explanation on
// hover, while you type.

import * as vscode from "vscode";
import { isJot } from "./jot-files.js";
import { render } from "@jotstak/renderer";
import type { Diagnostic as JotDiagnostic } from "@jotstak/renderer";

const SEVERITY: Record<JotDiagnostic["severity"], vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  // Information, not Hint: a hint is rendered as three faint dots that hide
  // the text until you hover exactly the right character, and several of these
  // are the renderer telling you it moved your figure to another page.
  info: vscode.DiagnosticSeverity.Information,
};

export function createDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("jotstak");
  context.subscriptions.push(collection);

  const check = (doc: vscode.TextDocument): void => {
    if (!isJot(doc)) return;
    const { diagnostics } = render(doc.getText(), { mode: "notebook" });
    collection.set(doc.uri, diagnostics.map((d) => toVscode(d, doc)));
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(check),
    vscode.workspace.onDidChangeTextDocument((e) => check(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri)),
  );
  for (const doc of vscode.workspace.textDocuments) check(doc);
}

/**
 * A diagnostic carries the line and column it starts at but no length, because
 * the renderer works in lines rather than tokens. Underlining from the column
 * to the end of the line is the honest reading of that: the line is what is
 * wrong, and starting at the column points at where to look first.
 */
function toVscode(d: JotDiagnostic, doc: vscode.TextDocument): vscode.Diagnostic {
  const line = Math.min(Math.max(d.line, 0), Math.max(doc.lineCount - 1, 0));
  const text = doc.lineAt(line);
  const start = Math.min(Math.max(d.column, 0), text.text.length);
  const range = new vscode.Range(line, start, line, Math.max(text.text.length, start + 1));

  const out = new vscode.Diagnostic(range, d.message, SEVERITY[d.severity]);
  out.source = "jotstak";
  return out;
}
