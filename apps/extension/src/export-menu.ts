// What you can do with a finished document.
//
// There was one export: a standalone HTML file. That is the right thing to
// build first — it is the whole document, it carries its own fonts, and it
// opens anywhere — but "export" is the moment somebody is trying to hand the
// document to a person, and a file on disk is only one of the ways they do it.
//
// Three ways, and deliberately no more:
//
//   HTML file      the artifact. Everything embedded, opens offline, keeps
//                  selectable text and real page geometry.
//   PDF            the browser's own print, driven by the print CSS that has
//                  described A4 since M0. VS Code has no print API, so this
//                  writes the HTML and opens it; the browser does the rest.
//   Clipboard      for pasting into the tools that will not take a file — an
//                  email, a Confluence page, a Slack message.
//
// What is NOT here is Markdown. It was removed rather than stubbed (ENG-21)
// and that still holds: turning .jot into Markdown means a serialiser that
// degrades every figure to what Markdown can carry, and a command that
// apologises is worse than no command.

import * as vscode from "vscode";

export type ExportKind = "html" | "pdf" | "clipboard";

export interface ExportChoice {
  kind: ExportKind;
  label: string;
  detail: string;
}

/**
 * The menu, as data, so the wording can be read in a test rather than only
 * seen by someone who happened to open it.
 */
export const EXPORTS: ExportChoice[] = [
  {
    kind: "html",
    label: "$(file-code) HTML file",
    detail: "One file, fonts and all. Opens anywhere, offline, with the text still selectable.",
  },
  {
    kind: "pdf",
    label: "$(file-pdf) PDF",
    detail: "Opens the document in your browser and starts its print dialog. Choose Save as PDF.",
  },
  {
    kind: "clipboard",
    label: "$(clippy) Copy as HTML",
    detail: "For pasting into an email or a wiki that will not take a file.",
  },
];

/**
 * Where a PDF export writes the page it is about to open.
 *
 * Beside the .jot file rather than in a temp directory, and named for it. A
 * browser's print dialog puts the page's filename in the PDF's name, so a
 * temp file called `jotstak-a7f3.html` would have you saving `jotstak-a7f3.pdf`
 * and renaming it every time.
 */
export function pdfStagingPath(jotPath: string): string {
  return jotPath.replace(/\.jot$/, "") + ".html";
}

/**
 * The name a document should carry, taken from its file.
 *
 * `|| "Document"`, not `?? "Document"`. The original used `??`, which only
 * catches null — an untitled buffer split to an empty string and sailed
 * through it, and the export came out titled nothing at all.
 */
export function documentTitle(jotPath: string): string {
  return jotPath.split(/[\\/]/).pop()?.replace(/\.jot$/, "") || "Document";
}

export async function pickExport(): Promise<ExportKind | undefined> {
  // `id`, not `kind`: QuickPickItem has a `kind` of its own, for separators,
  // and ours would have been read as one.
  const picked = await vscode.window.showQuickPick(
    EXPORTS.map((e) => ({ label: e.label, detail: e.detail, id: e.kind })),
    { title: "Export document", placeHolder: "How do you want to hand this over?" },
  );
  return picked?.id;
}
