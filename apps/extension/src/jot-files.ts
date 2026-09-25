// What counts as a .jot file, and what to do when VS Code disagrees.
//
// Everything used to ask `languageId === "jot"`, which is the tidy answer and
// the wrong one. A language id is not a fact about the file — it is the result
// of whichever extension's glob won, and plenty of extensions claim broadly.
// When one of them takes `.jot`, the whole extension goes quiet: the preview
// says "open a .jot file first" about the .jot file you have open, diagnostics
// never run, and the indentation rules never apply, so the editor's behaviour
// is some other language's and there is nothing to tell you why.
//
// So: a file called `.jot` is ours, whatever VS Code has decided to call it,
// and we offer to settle the argument properly rather than working around it
// forever.

import * as vscode from "vscode";

const FIXED = "jotstak.associationOffered";

/** A file is ours if VS Code agrees, or if it is simply named `.jot`. */
export function isJot(doc: vscode.TextDocument): boolean {
  return doc.languageId === "jot" || doc.uri.path.toLowerCase().endsWith(".jot");
}

/** True when the file is ours but something else has claimed the language. */
export function isMisassigned(doc: vscode.TextDocument): boolean {
  return doc.languageId !== "jot" && doc.uri.path.toLowerCase().endsWith(".jot");
}

/**
 * Offer to hand `.jot` back, once per machine.
 *
 * Setting it silently would be the smoother thing and the wrong one: file
 * associations are the author's, and an extension that rewrites a setting
 * without asking is one you stop trusting with the others.
 */
export async function offerAssociation(
  context: vscode.ExtensionContext,
  doc: vscode.TextDocument,
): Promise<void> {
  if (!isMisassigned(doc)) return;
  if (context.globalState.get(FIXED)) return;
  await context.globalState.update(FIXED, true);

  const fix = "Associate .jot with Jotstak";
  const answer = await vscode.window.showWarningMessage(
    `VS Code is treating .jot files as "${doc.languageId}", so Jotstak's highlighting and indentation are switched off. The preview and diagnostics still work.`,
    fix,
    "Leave it",
  );
  if (answer !== fix) return;

  const files = vscode.workspace.getConfiguration("files");
  const associations = { ...(files.get<Record<string, string>>("associations") ?? {}) };
  associations["*.jot"] = "jot";
  await files.update("associations", associations, vscode.ConfigurationTarget.Global);

  // Re-language the open document so it takes effect without a reload.
  await vscode.languages.setTextDocumentLanguage(doc, "jot");
}
