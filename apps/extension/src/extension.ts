// Jotter VS Code extension entry point.
// Registers the live preview webview (which imports @jotter/renderer) and the
// command-palette actions. The LSP for autocomplete is wired from @jotter/schema.

import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("jotter.openPreview", () => {
      // TODO(v1): create/show a webview panel, render active .jtr on change.
    }),
    vscode.commands.registerCommand("jotter.toggleMode", () => {
      // TODO(v1): flip notebook <-> doc mode in the active preview.
    }),
    vscode.commands.registerCommand("jotter.exportHtml", () => {
      // TODO(v1): render current doc to a self-contained HTML file.
    }),
    vscode.commands.registerCommand("jotter.copyMarkdown", () => {
      // TODO(v1): render current doc to clean Markdown, copy to clipboard.
    }),
    vscode.commands.registerCommand("jotter.learnSyntax", () => {
      // TODO(v1): open the interactive welcome .jtr tour.
    }),
  );
}

export function deactivate(): void {}
