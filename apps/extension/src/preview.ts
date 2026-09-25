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
import { isJot } from "./jot-files.js";
import { render } from "@jotstak/renderer";
import type { RenderMode } from "@jotstak/renderer";
import { shellHtml } from "./webview-shell.js";

/** Long enough that typing is not re-rendering every keystroke, short enough to feel live. */
const SETTLE_MS = 120;

export class JotPreview {
  private static current: JotPreview | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private doc: vscode.TextDocument | undefined;
  private mode: RenderMode = "notebook";
  /** The page only listens once its script has run; until then, hold the newest render. */
  private ready = false;
  private pending: string | undefined;

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

    // The shell is written ONCE. Every later render is a message, not a new
    // document — replacing `webview.html` reloads the whole page, which throws
    // away the scroll position and flashes, and doing that on a timer while
    // someone is typing is unusable. The styles never change, so there is
    // nothing in the shell that a re-render would need to replace.
    this.panel.webview.html = this.shell();

    this.disposables.push(
      this.panel.onDidDispose(() => this.dispose()),
      this.panel.webview.onDidReceiveMessage((m: { type?: string }) => {
        if (m?.type !== "ready") return;
        this.ready = true;
        if (this.pending !== undefined) {
          void this.panel.webview.postMessage({ type: "render", html: this.pending });
          this.pending = undefined;
        }
      }),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === this.doc) this.schedule();
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && isJot(editor.document)) this.bind(editor.document);
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
    if (!this.ready) {
      this.pending = html;
      return;
    }
    void this.panel.webview.postMessage({ type: "render", html });
  }

  /**
   * The page the webview loads, once. The markup lives in webview-shell.ts so
   * it can be run in a browser without an extension host — a webview is
   * otherwise only testable by opening it and looking.
   */
  private shell(): string {
    const { webview } = this.panel;
    return shellHtml({
      assetBase: webview
        .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media"))
        .toString(),
      cspSource: webview.cspSource,
      nonce: Math.random().toString(36).slice(2),
    });
  }

  private dispose(): void {
    JotPreview.current = undefined;
    if (this.timer) clearTimeout(this.timer);
    for (const d of this.disposables) d.dispose();
    this.panel.dispose();
  }
}
