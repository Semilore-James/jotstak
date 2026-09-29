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
import { registerIndentation, registerReparent } from "./indentation.js";
import type { ExportKind } from "./export-menu.js";
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
  registerReparent(context);
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

    vscode.commands.registerCommand("jotstak.export", async () => {
      const doc = activeJot();
      if (!doc) return;
      const { pickExport } = await import("./export-menu.js");
      const kind = await pickExport();
      if (kind) await runExport(context, doc, kind);
    }),

    // Kept as its own command so a keybinding or a task can go straight to the
    // file without stopping at the menu.
    vscode.commands.registerCommand("jotstak.exportHtml", async () => {
      const doc = activeJot();
      if (doc) await runExport(context, doc, "html");
    }),

    vscode.commands.registerCommand("jotstak.learnSyntax", () => {
      // pages.dev, not jotstak.com: that domain is not registered yet, so the
      // button opened a page that did not exist. Move it back once it is.
      void vscode.env.openExternal(vscode.Uri.parse("https://jotstak.pages.dev/docs/"));
    }),
  );

  // Rendering on activation warms the module graph, so the first preview does
  // not pay for parsing the renderer while the author is watching.
  void render("", { mode: "notebook" });
}

/**
 * Build the document and hand it over the chosen way.
 *
 * All three start from the same exportHtml() — one document, one set of
 * embedded fonts, one page geometry — so a PDF and a pasted table cannot come
 * out looking like two different tools rendered them.
 */
async function runExport(
  context: vscode.ExtensionContext,
  doc: vscode.TextDocument,
  kind: ExportKind,
): Promise<void> {
  const { exportHtml } = await import("./export.js");
  const { documentTitle, pdfStagingPath } = await import("./export-menu.js");

  const media = vscode.Uri.joinPath(context.extensionUri, "media").fsPath;
  const html = exportHtml(doc.getText(), media, documentTitle(doc.fileName));

  if (kind === "clipboard") {
    await vscode.env.clipboard.writeText(html);
    void vscode.window.showInformationMessage("Document copied as HTML.");
    return;
  }

  if (kind === "pdf") {
    // VS Code has no print API, and a PDF library would rasterise a page the
    // print CSS already describes exactly — losing the text layer and the real
    // A4 geometry to reproduce, worse, what a browser does natively.
    const target = vscode.Uri.file(pdfStagingPath(doc.fileName));
    await vscode.workspace.fs.writeFile(target, Buffer.from(html, "utf8"));
    await vscode.env.openExternal(target);
    void vscode.window.showInformationMessage(
      "Opened in your browser. Print it and choose Save as PDF — the page is already A4.",
    );
    return;
  }

  const target = await vscode.window.showSaveDialog({
    filters: { HTML: ["html"] },
    defaultUri: vscode.Uri.file(pdfStagingPath(doc.fileName)),
  });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, Buffer.from(html, "utf8"));
  void vscode.window.showInformationMessage(`Exported ${target.path.split("/").pop()}.`);
}

export function deactivate(): void {}
