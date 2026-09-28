// The export menu, and the one thing it must not do.
//
// Three ways out, all built from the same exportHtml(): one document, one set
// of embedded fonts, one page geometry, so a PDF and a pasted table cannot
// come out looking like two different tools rendered them.

import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { EXPORTS, documentTitle, pdfStagingPath } from "./export-menu.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as {
  contributes: { commands: { command: string; title: string }[] };
};

describe("what you can do with a finished document", () => {
  it("offers a file, a PDF and the clipboard, and nothing else", () => {
    expect(EXPORTS.map((e) => e.kind)).toEqual(["html", "pdf", "clipboard"]);
  });

  it("offers no Markdown export", () => {
    // Removed rather than stubbed (ENG-21), and it stays removed. Turning .jot
    // into Markdown means a serialiser that degrades every figure to what
    // Markdown can carry — a tree to a nested list, a matrix to a grouped
    // list — and a command that apologises is worse than no command.
    const wording = JSON.stringify(EXPORTS) + JSON.stringify(pkg.contributes.commands);
    expect(wording.toLowerCase()).not.toContain("markdown");
  });

  it("says what each one is FOR, not what it is", () => {
    // "HTML file" tells somebody nothing about which to pick.
    for (const e of EXPORTS) {
      expect(e.detail.length, e.kind).toBeGreaterThan(30);
      expect(e.detail, e.kind).toMatch(/\.$/);
    }
    expect(EXPORTS.find((e) => e.kind === "pdf")!.detail).toContain("print dialog");
    expect(EXPORTS.find((e) => e.kind === "clipboard")!.detail).toContain("email");
  });

  it("registers the menu and keeps the direct command", () => {
    const names = pkg.contributes.commands.map((c) => c.command);
    expect(names).toContain("jotstak.export");
    // Still its own command, so a keybinding or a task can go straight to the
    // file without stopping at a menu.
    expect(names).toContain("jotstak.exportHtml");
  });
});

describe("where a PDF export stages its page", () => {
  it("writes beside the .jot file, named for it", () => {
    // A browser's print dialog puts the page's filename into the PDF's name,
    // so a temp file called jotstak-a7f3.html would have you saving
    // jotstak-a7f3.pdf and renaming it every single time.
    expect(pdfStagingPath("C:/work/pricing-v2.jot")).toBe("C:/work/pricing-v2.html");
    expect(pdfStagingPath("/home/me/notes/retro.jot")).toBe("/home/me/notes/retro.html");
  });

  it("names the document after its file, on either kind of path", () => {
    expect(documentTitle("C:\\work\\Pricing v2.jot")).toBe("Pricing v2");
    expect(documentTitle("/home/me/retro.jot")).toBe("retro");
    expect(documentTitle("")).toBe("Document");
  });
});
