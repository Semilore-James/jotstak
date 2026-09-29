// One document as a page of its own: everything it needs to show and to print,
// in one HTML file.
//
// Two things build it. The VS Code export writes it to disk, with the fonts
// embedded so the file opens anywhere offline. The website's PDF service
// hands it to a real browser to print, with the fonts loaded from the site.
// It lived in the extension until the second one came along; two copies of
// "what a printed Jotstak page is" would disagree about margins inside a week.

import type { RenderMode } from "./index.js";
import { parse } from "./parser.js";
import { renderDocument } from "./html.js";
import { renderThemeCss } from "./css.js";
import { renderLayoutCss } from "./layout.js";
import { PAGE, renderPageCss } from "./page.js";
import type { Diagnostic } from "./index.js";

const SHEET = PAGE.portrait.content + 2 * PAGE.marginX;

export interface StandaloneOptions {
  mode?: RenderMode;
  /** The page's <title>, which a browser also uses to name a saved PDF. */
  title?: string;
  /** @font-face rules to use as they are — the fonts embedded as data. */
  fontCss?: string;
  /** Or where the fonts are served from, as for renderThemeCss(). */
  assetBase?: string;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderStandalone(
  source: string,
  options: StandaloneOptions = {},
): { html: string; diagnostics: Diagnostic[] } {
  const { ast, diagnostics } = parse(source);
  const body = renderDocument(ast, { mode: options.mode ?? "notebook" }, diagnostics);
  // With embedded fonts, no assetBase: the theme then emits no @font-face of
  // its own, and the embedded ones take their place.
  const theme = renderThemeCss(options.fontCss ? {} : { assetBase: options.assetBase });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(options.title ?? "Document")}</title>
<style>
${options.fontCss ?? ""}
${theme}
${renderLayoutCss()}
${renderPageCss()}
body { margin: 0; padding: 24px 16px; background: #e9e3d9; container-type: inline-size; container-name: jot-host; }
#sheet { width: ${SHEET}px; max-width: 100%; margin: 0 auto; box-shadow: 0 2px 18px rgba(0,0,0,.18); }
#sheet > .jotstak { zoom: var(--jot-fit); }
#sheet .jot-doc { padding-inline: ${PAGE.marginX}px; }
/* On paper the desk the sheet sits on gets out of the way. The page's margins
   are the document's own padding in print (renderPageCss), repeated on every
   page: margins left to the browser came out white, with its header and
   footer printed in them. */
@media print {
  body { padding: 0; background: none; container-type: normal; }
  #sheet { width: auto; box-shadow: none; }
}
</style>
</head>
<body><div id="sheet">${body}</div></body>
</html>`;
  return { html, diagnostics };
}

/**
 * What to call a document when it is saved: its first heading, else a title
 * or a name from its metadata, else "Jotstak document". Written for a file
 * name, so it keeps letters, digits, spaces and a little punctuation.
 */
export function documentName(source: string): string {
  const heading = /^#{1,6}\s+(.+)$/m.exec(source)?.[1] ?? /^@(?:heading|h[1-6])\b[^\n]*?\s([^=\n]+)$/m.exec(source)?.[1];
  const meta = /^\s+(?:title|name|project):\s*(.+)$/m.exec(source)?.[1];
  const raw = (heading ?? meta ?? "Jotstak document").replace(/[*_`=~[\]]/g, "");
  const clean = raw.replace(/[^\p{L}\p{N} .,'()&-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || "Jotstak document";
}
