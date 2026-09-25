// The live preview: a .jot file, rendered, beside the file itself.
//
// The whole of Jotstak's value is that the thing you type and the thing that
// prints are the same document. That only pays off if you can see it while you
// type, so this panel is the extension's reason to exist and everything else
// is a convenience.
//
// It is the fourth host to embed a rendered document, after the playground,
// the landing page and the docs demos. The other three each quietly redefined
// the document's width to suit their own chrome, and each was caught by eye,
// weeks later, in a screenshot — so the rule is a test now (hosts.test.ts) and
// this file is written to it: a whole A4 sheet, zoomed to fit, never magnified
// past 1:1, nothing scrolling and nothing deciding the width on its own.

import * as vscode from "vscode";
import { render, renderThemeCss, renderLayoutCss, renderPageCss, PAGE } from "@jotstak/renderer";
import type { RenderMode } from "@jotstak/renderer";

/** A whole sheet of A4 at 96dpi: the printable width plus the page margins. */
const SHEET = PAGE.portrait.content + 2 * PAGE.marginX;

/** Long enough that typing is not re-rendering every keystroke, short enough to feel live. */
const SETTLE_MS = 120;

export class JotPreview {
  private static current: JotPreview | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private doc: vscode.TextDocument | undefined;
  private mode: RenderMode = "notebook";

  static show(context: vscode.ExtensionContext, doc: vscode.TextDocument): void {
    if (JotPreview.current) {
      JotPreview.current.bind(doc);
      JotPreview.current.panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }
    JotPreview.current = new JotPreview(context, doc);
  }

  /** The open preview, if there is one — for the commands that act on it. */
  static get active(): JotPreview | undefined {
    return JotPreview.current;
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    doc: vscode.TextDocument,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      "jotstak.preview",
      "Jotstak preview",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
      },
    );

    this.disposables.push(
      this.panel.onDidDispose(() => this.dispose()),
      // Re-render as the file changes, and follow the author between files.
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === this.doc) this.schedule();
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor?.document.languageId === "jot") this.bind(editor.document);
      }),
    );

    this.bind(doc);
  }

  toggleMode(): void {
    this.mode = this.mode === "notebook" ? "doc" : "notebook";
    this.draw();
  }

  private bind(doc: vscode.TextDocument): void {
    this.doc = doc;
    this.panel.title = `Preview — ${doc.fileName.split(/[\\/]/).pop() ?? "jot"}`;
    this.draw();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.draw(), SETTLE_MS);
  }

  private draw(): void {
    if (!this.doc) return;
    const { html } = render(this.doc.getText(), { mode: this.mode });
    this.panel.webview.html = this.shell(html);
  }

  /**
   * The page the webview loads.
   *
   * Styles are inlined rather than linked because the renderer hands them over
   * as strings — every host needs them differently, and a webview cannot fetch
   * a stylesheet it has no server for. Fonts are the exception: they are real
   * files, so they come through `asWebviewUri` and the CSP allows exactly that
   * one origin.
   */
  private shell(body: string): string {
    const { webview } = this.panel;
    const media = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media"));
    const nonce = Math.random().toString(36).slice(2);

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';" />
<style>
${renderThemeCss({ assetBase: media.toString() })}
${renderLayoutCss()}
${renderPageCss()}
/* The pane is the desk the sheet sits on, so it takes the editor's own
   background rather than the paper's — the sheet has to read as a sheet. */
body {
  margin: 0;
  padding: 20px 16px 40px;
  background: var(--vscode-editor-background);
  container-type: inline-size;
}
#sheet { width: ${SHEET}px; max-width: 100%; margin: 0 auto; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.22); }
/* Fit to the pane, never magnified past 1:1 — the same fit every other host
   uses. No overflow: if something ever fails to fit it should hang over the
   edge where it can be seen, not be quietly cut. */
#sheet > .jotstak { zoom: min(1, calc(100cqw / ${SHEET}px)); }
#sheet .jot-doc { padding-inline: ${PAGE.marginX}px; }
</style>
</head>
<body>
<div id="sheet">${body}</div>
<script nonce="${nonce}">
  // Keep the reading position across a re-render, or typing on page four
  // throws you back to page one on every keystroke.
  const key = "jotstak.scroll";
  const saved = Number(sessionStorage.getItem(key) ?? "0");
  if (saved) window.scrollTo(0, saved);
  addEventListener("scroll", () => sessionStorage.setItem(key, String(window.scrollY)), { passive: true });
</script>
</body>
</html>`;
  }

  private dispose(): void {
    JotPreview.current = undefined;
    if (this.timer) clearTimeout(this.timer);
    for (const d of this.disposables) d.dispose();
    this.panel.dispose();
  }
}
