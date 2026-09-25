// Jotstak VS Code extension entry point.
//
// Two things make this worth installing, and everything else is a convenience:
// the live preview (preview.ts), because the promise is that what you type and
// what prints are the same document; and the diagnostics (diagnostics.ts),
// because the renderer already explains itself and those explanations belong
// where you are typing rather than in a list on a website.

import * as vscode from "vscode";
import { render } from "@jotstak/renderer";
import { JotPreview } from "./preview.js";
import { createDiagnostics } from "./diagnostics.js";
import { registerIndentation } from "./indentation.js";
import { registerExtentRuler } from "./extent-ruler.js";
import { isJot, offerAssociation } from "./jot-files.js";
import { registerLanguageFeatures } from "./language-features.js";

/** The .jot file the command should act on, or a complaint if there is none. */
function activeJot(): vscode.TextDocument | undefined {
  const doc = vscode.window.activeTextEditor?.document;
  // By NAME as well as by language id: another extension may have claimed the
  // association, and a file called .jot is ours either way (jot-files.ts).
  if (doc && isJot(doc)) return doc;
  void vscode.window.showInformationMessage("Open a .jot file first.");
  return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  createDiagnostics(context);
  // Indentation decides what a block owns, so a wrong indent changes meaning
  // rather than erroring. These two take the edge off it: the rules stop you
  // making the mistake, the ruler shows you what you already have.
  registerIndentation(context);
  registerExtentRuler(context);
  // Hover and autocomplete, formatted straight out of the schema — which had
  // every word of this and was only ever sending it to the docs site.
  registerLanguageFeatures(context);

  // If something else has taken .jot, say so once and offer to settle it —
  // otherwise the highlighting and indentation are silently another
  // language's, with nothing on screen to explain why.
  const offer = (doc: vscode.TextDocument): void => void offerAssociation(context, doc);
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(offer));
  const open = vscode.window.activeTextEditor?.document;
  if (open) offer(open);

  context.subscriptions.push(
    vscode.commands.registerCommand("jotstak.openPreview", () => {
      const doc = activeJot();
      if (doc) JotPreview.show(context, doc);
    }),

    vscode.commands.registerCommand("jotstak.toggleMode", () => {
      const preview = JotPreview.active;
      if (!preview) {
        void vscode.window.showInformationMessage("Open the preview first.");
        return;
      }
      preview.toggleMode();
    }),

    vscode.commands.registerCommand("jotstak.exportHtml", async () => {
      const doc = activeJot();
      if (!doc) return;
      const target = await vscode.window.showSaveDialog({
        filters: { HTML: ["html"] },
        defaultUri: vscode.Uri.file(doc.fileName.replace(/\.jot$/, "") + ".html"),
      });
      if (!target) return;

      const { exportHtml } = await import("./export.js");
      const media = vscode.Uri.joinPath(context.extensionUri, "media").fsPath;
      const title = doc.fileName.split(/[\\/]/).pop()?.replace(/\.jot$/, "") ?? "Document";
      const html = exportHtml(doc.getText(), media, title);
      await vscode.workspace.fs.writeFile(target, Buffer.from(html, "utf8"));
      void vscode.window.showInformationMessage(`Exported ${target.path.split("/").pop()}.`);
    }),

    vscode.commands.registerCommand("jotstak.learnSyntax", () => {
      void vscode.env.openExternal(vscode.Uri.parse("https://jotstak.com/docs/"));
    }),
  );

  // Rendering on activation warms the module graph, so the first preview does
  // not pay for parsing the renderer while the author is watching.
  void render("", { mode: "notebook" });
}

export function deactivate(): void {}
