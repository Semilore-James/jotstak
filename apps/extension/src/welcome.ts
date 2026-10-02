// The first five minutes (PRD-24).
//
// A new user installed the extension and got nothing: no file to try, and a
// "Learn the syntax" button that opened a website. The PRD's own journey map
// marked that stage frustrated. Now the welcome document opens on first
// install, with its page beside it — a two-page tour that teaches by doing,
// each step ending in something to change and watch the page follow.
//
// It opens as an UNSAVED copy rather than a file: safe to break, nothing
// written into anyone's folders, and the same text every time it is asked for.
// The text is samples/welcome.jot, which the playground's "Start here" sample
// reads too, so the two cannot teach different things.

import * as vscode from "vscode";
import welcome from "../../../samples/welcome.jot";
import { JotPreview } from "./preview.js";

/** Set once the welcome document has opened by itself, so it never does again. */
export const WELCOMED = "jotstak.welcomed";

/** The step-by-step guide's id, inside this extension's own namespace. */
export const WALKTHROUGH = "start";

export const welcomeText = (): string => welcome;

/** Open a fresh copy of the welcome document, with its page beside it. */
export async function openWelcome(context: vscode.ExtensionContext): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ language: "jot", content: welcome });
  await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preview: false });
  JotPreview.show(context, doc);
}

/**
 * The first time the extension runs, and only then. Marked before opening, so
 * a window that closes halfway through does not greet the same person twice.
 */
export async function welcomeOnFirstRun(context: vscode.ExtensionContext): Promise<boolean> {
  if (context.globalState.get<boolean>(WELCOMED)) return false;
  await context.globalState.update(WELCOMED, true);
  await openWelcome(context);
  return true;
}

/** VS Code's Get Started page, open on Jotstak's steps. */
export function openWalkthrough(context: vscode.ExtensionContext): Thenable<unknown> {
  return vscode.commands.executeCommand("workbench.action.openWalkthrough", `${context.extension.id}#${WALKTHROUGH}`, false);
}
