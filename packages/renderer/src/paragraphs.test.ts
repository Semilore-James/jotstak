// A blank line is a new paragraph, with a row of space before it (UX-71).
//
// It was neither, in two different ways. On the page, two paragraphs had no
// space between them — the rule zeroing every paragraph's margin outranked
// the row a block gets below it — so a blank line looked exactly like a line
// break. And inside a card or a column, the blank line was gone before the
// renderer saw it: the parser keeps each line's position but not the empty
// lines, so the body's lines were joined back up as one paragraph.

import { describe, expect, it } from "vitest";
import { parse, render, renderLayoutCss } from "./index.js";
import type { MarginNoteNode, QuoteNode } from "./ast.js";

const html = (source: string): string => render(source, { mode: "doc" }).html;
const paragraphs = (out: string): string[] => [...out.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]!.trim());

describe("on the page", () => {
  const css = renderLayoutCss();

  it("puts a row between two plain paragraphs", () => {
    expect(css).toMatch(/\.jotstak \.jot-body p:not\(\[class\]\) \+ p:not\(\[class\]\) \{ margin-top: 28px; \}/);
  });

  it("gives a block of prose the row below it that every block gets", () => {
    // A card after a paragraph sat directly under its last line.
    expect(css).toMatch(/\.jotstak \.jot-body > p:not\(\[class\]\):last-child \{ margin-bottom: 28px; \}/);
  });

  it("outranks the rule that zeroes every paragraph's margin", () => {
    // (0,4,2) against (0,2,1): two classes and two attribute tests beat two classes.
    expect(css.indexOf("p:not([class]) + p:not([class])")).toBeGreaterThan(css.indexOf(".jot-body blockquote p {"));
  });

  it("leaves a card's kicker and title, which are paragraphs with a class, tight", () => {
    const out = html('@decision title="Ship it" status=accepted\n  Why we did.');
    expect(out).toContain(`<p class="jot-card-kicker">`);
    expect(out).toContain(`<p class="jot-card-title">`);
  });
});

describe("in prose", () => {
  it("is a paragraph break, where a single line end is a line break", () => {
    expect(paragraphs(html("One.\nTwo."))).toEqual(["One.<br>\nTwo."]);
    expect(paragraphs(html("One.\n\nTwo."))).toEqual(["One.", "Two."]);
  });
});

describe("inside a block", () => {
  it("survives in a card's body", () => {
    expect(paragraphs(html("@panel title=T\n  First para.\n\n  Second para."))).toEqual(["First para.", "Second para."]);
    expect(paragraphs(html("@panel title=T\n  First line.\n  Second line."))).toEqual(["First line.<br>\nSecond line."]);
  });

  it("survives after a card's fields", () => {
    const out = html("@risk title=R\n  owner: Ana\n  Prose one.\n\n  Prose two.");
    expect(paragraphs(out)).toEqual(["Prose one.", "Prose two."]);
  });

  it("survives in a column", () => {
    const out = html("@columns\n  Left:\n    One.\n\n    Two.\n  Right:\n    Three.");
    expect(paragraphs(out)).toEqual(["One.", "Two.", "Three."]);
  });

  it("is not invented between lines that had none", () => {
    expect(paragraphs(html("@columns\n  Left:\n    One.\n    Two."))).toEqual(["One.<br>\nTwo."]);
  });
});

describe("a persona's description", () => {
  // Its body was fields only, so a line of prose under the fields was dropped
  // without a word (UX-72). It reads like @risk's and @decision's now.
  it("shows under its fields, rather than vanishing", () => {
    const out = html("@persona name=Marta\n  role: Platform PM\n  Writes every spec herself.\n\n  Keeps it open all day.");
    expect(out).toContain("Platform PM");
    expect(paragraphs(out)).toEqual(["Writes every spec herself.", "Keeps it open all day."]);
    expect(out.indexOf("Platform PM")).toBeLessThan(out.indexOf("Writes every spec"));
  });
});

describe("a note or a quote with lines under it", () => {
  // Either alone was fine; both together dropped the first line.
  it("keeps the words on its own line", () => {
    const note = parse("Text.\n@note Ask Ana\n  before Friday.").ast.children[1] as MarginNoteNode;
    expect(note.lines).toEqual(["Ask Ana", "before Friday."]);
    const quote = parse("@quote by=Ada The export\n  is the product.").ast.children[0] as QuoteNode;
    expect(quote.lines).toEqual(["The export", "is the product."]);
  });

  it("is unchanged when it has only one or the other", () => {
    expect((parse("Text.\n@note Ask Ana").ast.children[1] as MarginNoteNode).lines).toEqual(["Ask Ana"]);
    expect((parse("@quote by=Ada\n  The export.").ast.children[0] as QuoteNode).lines).toEqual(["The export."]);
  });
});
