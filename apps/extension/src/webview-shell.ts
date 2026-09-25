// The page the preview webview loads, as a pure function of its three inputs.
//
// Separated from preview.ts so it can be RUN outside VS Code. A webview is
// otherwise only testable by launching an extension host and looking at it,
// which is how a broken content-security policy or a wrong font path stays
// broken until someone opens the panel. This way the same markup that ships
// can be dropped into a browser and checked.
//
// It is also the file the host-contract test reads (hosts.test.ts), which is
// the point: the rule about how a document is framed should be checked against
// the thing that draws it, not against a copy of it.

import { PAGE, renderLayoutCss, renderPageCss, renderThemeCss } from "@jotstak/renderer";

/** A whole sheet of A4 at 96dpi: the printable width plus the page margins. */
export const SHEET = PAGE.portrait.content + 2 * PAGE.marginX;

export interface ShellOptions {
  /** Where the webview may load fonts from. */
  assetBase: string;
  /** The one origin the content-security policy trusts, besides the nonce. */
  cspSource: string;
  nonce: string;
}

export function shellHtml({ assetBase, cspSource, nonce }: ShellOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource}; img-src ${cspSource} data:; script-src 'nonce-${nonce}';" />
<style>
${renderThemeCss({ assetBase })}
${renderLayoutCss()}
${renderPageCss()}
/* The pane is the desk the sheet sits on, so it takes the editor's own
   background rather than the paper's — the sheet has to read as a sheet. */
body {
  margin: 0;
  padding: 20px 16px 40px;
  background: var(--vscode-editor-background, #1e1e1e);
  container-type: inline-size;
}
#sheet { width: ${SHEET}px; max-width: 100%; margin: 0 auto; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.22); }
/* Fit to the pane, never magnified past 1:1 — the same fit every other host
   uses. No overflow: if something ever fails to fit it should hang over the
   edge where it can be seen, not be quietly cut. */
#sheet > .jotstak { zoom: min(1, calc(100cqw / ${SHEET}px)); }
#sheet .jot-doc { padding-inline: ${PAGE.marginX}px; }
#empty {
  margin: 0;
  padding: 8px 16px;
  color: var(--vscode-descriptionForeground, #999);
  font: 13px/1.5 var(--vscode-font-family, system-ui);
}
</style>
</head>
<body>
<div id="sheet"><p id="empty">Rendering…</p></div>
<script nonce="${nonce}">
  const api = acquireVsCodeApi();
  const sheet = document.getElementById("sheet");
  addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "render") return;
    // Replacing the markup in place keeps the scroll position, which is the
    // whole point of not reloading the page: typing on page four should not
    // throw you back to page one every time you pause.
    sheet.innerHTML = e.data.html;
  });
  api.postMessage({ type: "ready" });
</script>
</body>
</html>`;
}
