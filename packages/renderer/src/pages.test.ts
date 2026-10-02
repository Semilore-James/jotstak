// Pages on screen (UX-73), checked in a real browser.
//
// Where a page ends depends on how tall the text set, which only a browser
// knows, so most of this cannot be checked from the HTML alone. The standalone
// page lays itself out as pages when it loads; these tests open it in headless
// Chrome, read back what it made, and print it. They skip where there is no
// Chrome to run, and the stylesheet half below runs everywhere.

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PAGE_GEOMETRY, paginate, pagesScript, renderLayoutCss, renderPageCss, renderStandalone } from "./index.js";

const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p): p is string => Boolean(p && existsSync(p)));

/** Starting Chrome, laying the page out and printing it takes seconds, not milliseconds. */
const SLOW = 60_000;

const dir = mkdtempSync(join(tmpdir(), "jot-pages-"));
let n = 0;

function chrome(args: string[], file: string): string {
  return execFileSync(
    CHROME!,
    [
      "--headless=new",
      "--disable-gpu",
      // CI runs Chrome on Linux, where its sandbox needs privileges a runner may not have.
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
      "--virtual-time-budget=5000",
      ...args,
      pathToFileURL(file).href,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: SLOW },
  );
}

/** Lay a document out in Chrome, and return the sheets it made. */
function pagesOf(source: string, width = 1280): { sheets: string[]; html: string; file: string } {
  const file = join(dir, `doc${n++}.html`);
  writeFileSync(file, renderStandalone(source, { mode: "notebook" }).html);
  const html = chrome([`--window-size=${width},900`, "--dump-dom"], file);
  // Only the document, not the stylesheet, which names every class in it.
  const body = html.slice(html.indexOf("<body"));
  return { sheets: body.split('<section class="jot-sheet"').slice(1), html: body, file };
}

const para = (words: number): string => Array.from({ length: words }, (_, i) => `word${i}`).join(" ");
const card = (title: string): string =>
  `@decision title="${title}" status=accepted\n  context: ${para(12)}\n  choice: ${para(12)}\n  consequences: ${para(12)}`;

describe.skipIf(!CHROME)("pages in a browser", () => {
  it("lays a short document out as one sheet", () => {
    const { sheets, html } = pagesOf("# A title\n\nOne paragraph.");
    expect(html).toMatch(/<div class="jotstak"[^>]*data-paged/);
    expect(sheets).toHaveLength(1);
  }, SLOW);

  it("carries a long paragraph on to the next sheet, between two lines", () => {
    const { sheets } = pagesOf(para(2400));
    expect(sheets.length).toBeGreaterThan(1);
    expect(sheets[1]).toMatch(/^ data-orient="portrait"><div class="jot-doc"><div class="jot-row"[^>]*data-continued/);
  }, SLOW);

  it("moves a card that does not fit to the next sheet whole", () => {
    const { sheets, html } = pagesOf(Array.from({ length: 8 }, (_, i) => card(`Card ${i}`)).join("\n\n"));
    expect(sheets.length).toBeGreaterThan(1);
    // A block is never cut: nothing carried on to a following sheet is a block.
    const carried = [...html.matchAll(/<div class="jot-row"[^>]*data-continued[^>]*><div class="jot-body" data-kind="([a-z_]+)"/g)];
    expect(carried.map((m) => m[1])).not.toContain("block");
  }, SLOW);

  it("never ends a sheet on a heading", () => {
    // A heading just above a card too big for what is left of the sheet.
    const { sheets } = pagesOf(`${para(1180)}\n\n## The heading\n\n${card("Below it")}`);
    for (const s of sheets) {
      const kinds = [...s.matchAll(/class="jot-body" data-kind="([a-z_]+)"/g)].map((m) => m[1]);
      expect(kinds[kinds.length - 1], "a sheet ends on a heading").not.toBe("heading");
    }
  }, SLOW);

  it("starts a new sheet at @pagebreak, and drops the marker", () => {
    const { sheets } = pagesOf("Before.\n\n@pagebreak\n\nAfter.");
    expect(sheets).toHaveLength(2);
    expect(sheets[1]).toContain("After.");
    expect(sheets.join("")).not.toContain('class="jot-pagebreak"');
  }, SLOW);

  it("gives a figure too wide for portrait a landscape sheet of its own", () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    const { sheets } = pagesOf(`Before.\n\n@timeline\n${months.map((m) => `  ${m}: Step`).join("\n")}\n\nAfter.`);
    expect(sheets.map((s) => /data-orient="([a-z]+)"/.exec(s)![1])).toEqual(["portrait", "landscape", "portrait"]);
  }, SLOW);

  it("prints exactly the sheets it shows, one to a page", () => {
    const { sheets, file } = pagesOf(`${para(2400)}\n\n@pagebreak\n\n${card("Last")}`);
    const pdf = join(dir, "print.pdf");
    chrome(["--window-size=1280,900", "--no-pdf-header-footer", `--print-to-pdf=${pdf}`], file);
    const pages = readFileSync(pdf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBe(sheets.length);
  }, SLOW);

  it("leaves a document as one column below the phone threshold", () => {
    const { sheets, html } = pagesOf(para(2400), 400);
    expect(html).not.toMatch(/<div class="jotstak"[^>]*data-paged/);
    expect(sheets).toHaveLength(0);
  }, SLOW);
});

describe("pages: the stylesheet and the script", () => {
  const css = renderLayoutCss();
  const print = renderPageCss();

  it("draws a sheet as A4, with a window exactly as many rows tall as the page holds", () => {
    expect(PAGE_GEOMETRY.portrait.rows).toBe(36);
    expect(css).toMatch(/\.jot-sheet \{[^}]*width: 793\.7\d*px;[^}]*height: 1122\.5\d*px;/);
    expect(css).toContain(`height: ${36 * 28}px;`);
    expect(css).toContain(`[data-orient="landscape"] > .jot-doc { height: ${PAGE_GEOMETRY.landscape.rows * 28}px; }`);
  });

  it("prints a sheet to a page, and a landscape sheet on a landscape page", () => {
    expect(print).toMatch(/\[data-paged\] \.jot-sheet \{[^}]*height: 297mm;[^}]*break-after: page;/);
    expect(print).toContain('.jot-sheet[data-orient="landscape"] { width: 297mm; height: 210mm; page: jot-landscape; }');
  });

  it("tells the pagination when the host has reflowed the document for a phone", () => {
    expect(css).toContain(".jotstak { --jot-fit: 1; --jot-reflow: 1; }");
  });

  it("carries everything it needs when written into a page as a script", () => {
    // A host that cannot import it carries its source; anything it reached
    // outside its own body would be undefined there.
    const source = paginate.toString();
    for (const name of ["PAGE", "PAGE_GEOMETRY", "A4_LONG", "A4_SHORT"]) {
      expect(source, `paginate reaches outside itself for ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
    const window: Record<string, unknown> = {};
    new Function("window", pagesScript())(window);
    expect(typeof window.jotPages).toBe("function");
    expect((window.jotPages as (r: unknown) => number)(null)).toBe(0);
  });
});
