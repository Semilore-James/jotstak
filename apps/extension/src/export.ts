// Export a .jot file as one HTML file that needs nothing else.
//
// "Self-contained" is the whole point, so the fonts are embedded rather than
// linked. A document that arrives in Times New Roman is not the document that
// was written — the type IS the artifact here, and a link to a CDN turns a
// file you can email into a file that needs the internet and a live host.
//
// It costs around half a megabyte of base64. For a document meant to be sent
// to someone, that is a fair price and it is paid once.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FONT_FACES,
  PAGE,
  render,
  renderLayoutCss,
  renderPageCss,
  renderThemeCss,
} from "@jotstak/renderer";

const SHEET = PAGE.portrait.content + 2 * PAGE.marginX;

/** The @font-face rules, with the files inlined as data URIs. */
function embeddedFonts(mediaDir: string): string {
  return FONT_FACES.map((f) => {
    const data = readFileSync(join(mediaDir, "fonts", f.file)).toString("base64");
    return [
      "@font-face {",
      `  font-family: "${f.family}";`,
      `  font-style: ${f.style};`,
      `  font-weight: ${f.weight};`,
      "  font-display: swap;",
      `  src: url("data:font/woff2;base64,${data}") format("woff2");`,
      "}",
    ].join("\n");
  }).join("\n");
}

export function exportHtml(source: string, mediaDir: string, title = "Document"): string {
  const { html } = render(source, { mode: "notebook" });
  // No assetBase: the theme emits no @font-face rules of its own, and the
  // embedded ones above take their place.
  const theme = renderThemeCss();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${embeddedFonts(mediaDir)}
${theme}
${renderLayoutCss()}
${renderPageCss()}
body { margin: 0; padding: 24px 16px; background: #e9e3d9; container-type: inline-size; }
#sheet { width: ${SHEET}px; max-width: 100%; margin: 0 auto; box-shadow: 0 2px 18px rgba(0,0,0,.18); }
#sheet > .jotstak { zoom: min(1, calc(100cqw / ${SHEET}px)); }
#sheet .jot-doc { padding-inline: ${PAGE.marginX}px; }
/* Printing this file gives the same A4 pages the editor promised, so the desk
   the sheet sits on has to get out of the way. */
@media print {
  body { padding: 0; background: none; container-type: normal; }
  #sheet { width: auto; box-shadow: none; }
  #sheet > .jotstak { zoom: 1; }
  #sheet .jot-doc { padding-inline: 0; }
}
</style>
</head>
<body><div id="sheet">${html}</div></body>
</html>`;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
