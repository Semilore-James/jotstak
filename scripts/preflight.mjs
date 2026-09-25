// Renders preflight.jot through the REAL webview shell, so a build can be
// looked at before it is handed over.
//
// Written because three fixes in a row were reported as still broken, and each
// time the answer was either a stale install or something a unit test could
// not see. A rendered page in a browser is the only thing that settles it.
//
// MEASURE WITH offsetHeight, NOT getBoundingClientRect(). The sheet is zoomed
// to fit its pane, so getBoundingClientRect returns VISUAL pixels: a correct
// 56px table row reads as 55.25 and a correct 196px figure as 193.34, and both
// look like the ruled-line contract is broken when nothing is wrong at all.
// offsetHeight is in layout pixels and is the number the contract is about.

import { render } from "@jotstak/renderer";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// pathToFileURL: Windows absolute paths are not valid ESM specifiers.
const shell = await import(
  pathToFileURL(join(here, "..", "apps", "extension", "dist", "shell.mjs")).href,
);

const doc = readFileSync(join(here, "preflight.jot"), "utf8");
const { html, diagnostics } = render(doc, { mode: process.argv[3] ?? "notebook" });

let page = shell.shellHtml({
  assetBase: process.argv[4] ?? "http://127.0.0.1:4321",
  cspSource: "*",
  nonce: "preflight",
});
// No extension host here, so stand in for it: drop the CSP, add the editor's
// own injected element styles (the thing that turned a quote into a dark box),
// and deliver the document the way the panel would.
page = page.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "");
page = page.replace(
  "</head>",
  "<style>blockquote{background:rgba(127,127,127,.15);border-color:#07c}code{color:#d7ba7d}table{border-collapse:collapse}</style></head>",
);
page = page.replace(
  "const api = acquireVsCodeApi();",
  "const api={postMessage(){}};addEventListener('DOMContentLoaded',()=>" +
    "dispatchEvent(new MessageEvent('message',{data:{type:'render',html:" +
    JSON.stringify(html) +
    "}})));",
);

writeFileSync(process.argv[2], page);
const bad = diagnostics.filter((d) => d.severity !== "info");
console.log(`wrote ${process.argv[2]}`);
console.log(bad.length ? `PROBLEMS:\n  ${bad.map((d) => `line ${d.line}: ${d.severity}: ${d.message}`).join("\n  ")}` : "diagnostics: clean");
