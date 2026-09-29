// Export a .jot file as one HTML file that needs nothing else.
//
// "Self-contained" is the whole point, so the fonts are embedded rather than
// linked. A document that arrives in Times New Roman is not the document that
// was written — the type IS the artifact here, and a link to a CDN turns a
// file you can email into a file that needs the internet and a live host.
//
// It costs around half a megabyte of base64. For a document meant to be sent
// to someone, that is a fair price and it is paid once.
//
// The page itself is renderStandalone(), shared with the website's PDF
// service, so a file exported here and a PDF downloaded there are one page.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONT_FACES, renderStandalone } from "@jotstak/renderer";

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
  return renderStandalone(source, { mode: "notebook", title, fontCss: embeddedFonts(mediaDir) }).html;
}
