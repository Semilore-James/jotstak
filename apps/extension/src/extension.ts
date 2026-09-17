// Jotstak VS Code extension entry point.
// Registers the live preview webview (which imports @jotstak/renderer) and the
// command-palette actions. The LSP for autocomplete is wired from @jotstak/schema.

import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("jotstak.openPreview", () => {
      // TODO(v1): create/show a webview panel, render active .jot on change.
    }),
    vscode.commands.registerCommand("jotstak.toggleMode", () => {
      // TODO(v1): flip notebook <-> doc mode in the active preview.
    }),
    vscode.commands.registerCommand("jotstak.exportHtml", () => {
      // TODO(v1): render current doc to a self-contained HTML file.
    }),
    vscode.commands.registerCommand("jotstak.copyMarkdown", () => {
      // TODO(v1): render current doc to clean Markdown, copy to clipboard.
    }),
    vscode.commands.registerCommand("jotstak.learnSyntax", () => {
      // TODO(v1): open the interactive welcome .jot tour.
    }),
  );
}

export function deactivate(): void {}
