// The Word export, read back.
//
// There is no Word on the machines this is built on, and the one program the
// file is for is also the strictest reader of it: Word refuses a whole
// document for a property written out of order, where every other reader
// shrugs. So these tests read the file the way Word would — the zip, every
// part's XML, the order of every property element — rather than trusting
// that a file which opens somewhere opens everywhere.

import { describe, expect, it } from "vitest";
import { inflateRawSync, crc32 as zlibCrc } from "node:zlib";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { PRIMITIVES, scaffoldSource } from "@jotstak/schema";
import type { Node } from "@jotstak/renderer";
import { WORD_FONTS, crc32, toDocx, woffToSfnt, zip } from "./index.js";
import type { DrawPicture } from "./index.js";
import { fontKey, obfuscate } from "./fonts.js";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit") as { create(b: Buffer): { familyName: string; subfamilyName: string } };

/** Read a zip back into its files, checking each one's checksum. */
function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end > 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    const data = method === 8 ? new Uint8Array(inflateRawSync(raw)) : raw;
    expect(zlibCrc(data), `checksum of ${name}`).toBe(crc);
    files.set(name, data);
    at += 46 + nameLen + extra + comment;
  }
  return files;
}

const text = (files: Map<string, Uint8Array>, name: string): string => {
  const f = files.get(name);
  if (!f) throw new Error(`no ${name} in the file`);
  return new TextDecoder().decode(f);
};

/** Every tag closed, in order. Enough to catch the mistakes string-built XML makes. */
function wellFormed(xml: string): void {
  const stack: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) {
      const open = stack.pop();
      expect(open, `</${name}> closes <${open}>`).toBe(name);
    } else stack.push(name!);
  }
  expect(stack, "unclosed elements").toEqual([]);
  // Nothing XML 1.0 cannot hold.
  // eslint-disable-next-line no-control-regex
  expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
}

/**
 * The schema's order for the children of the property elements this writes.
 * Word reports a file as damaged when they are out of order.
 */
const ORDER: Record<string, string[]> = {
  "w:pPr": ["w:pStyle", "w:keepNext", "w:keepLines", "w:pageBreakBefore", "w:numPr", "w:pBdr", "w:shd", "w:tabs", "w:spacing", "w:ind", "w:jc", "w:outlineLvl", "w:rPr", "w:sectPr"],
  "w:rPr": ["w:rStyle", "w:rFonts", "w:b", "w:bCs", "w:i", "w:iCs", "w:caps", "w:strike", "w:color", "w:spacing", "w:sz", "w:szCs", "w:u", "w:shd"],
  "w:tblPr": ["w:tblStyle", "w:tblW", "w:jc", "w:tblInd", "w:tblBorders", "w:shd", "w:tblLayout", "w:tblCellMar", "w:tblLook"],
  "w:tcPr": ["w:tcW", "w:gridSpan", "w:vMerge", "w:tcBorders", "w:shd", "w:noWrap", "w:tcMar", "w:vAlign"],
  "w:sectPr": ["w:type", "w:pgSz", "w:pgMar", "w:cols"],
  "w:pBdr": ["w:top", "w:left", "w:bottom", "w:right"],
  "w:tcBorders": ["w:top", "w:left", "w:bottom", "w:right"],
  "w:tblBorders": ["w:top", "w:left", "w:bottom", "w:right", "w:insideH", "w:insideV"],
  "w:tcMar": ["w:top", "w:left", "w:bottom", "w:right"],
  "w:tblCellMar": ["w:top", "w:left", "w:bottom", "w:right"],
};

/** The direct children of every property element, checked against the schema's order. */
function inSchemaOrder(xml: string): void {
  const stack: { name: string; kids: string[] }[] = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (close) {
      const done = stack.pop()!;
      const order = ORDER[done.name];
      if (order) {
        const seen = done.kids.map((k) => order.indexOf(k));
        expect(seen, `${done.name} holds something this test does not know: ${done.kids.join(", ")}`).not.toContain(-1);
        expect(seen, `${done.name} children out of order: ${done.kids.join(", ")}`).toEqual([...seen].sort((a, b) => a - b));
      }
      continue;
    }
    stack[stack.length - 1]?.kids.push(name!);
    if (!self) stack.push({ name: name!, kids: [] });
  }
}

async function docx(source: string, picture?: DrawPicture) {
  const files = unzip(await toDocx(source, { picture }));
  for (const [name, data] of files) {
    if (!/\.(xml|rels)$/.test(name)) continue;
    const xml = new TextDecoder().decode(data);
    wellFormed(xml);
    inSchemaOrder(xml);
  }
  return { files, document: text(files, "word/document.xml") };
}

/** A stand-in for the browser's camera: a 1×1 PNG at whatever size and page it is told. */
const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
const camera =
  (size: { width: number; height: number; landscape?: boolean }, seen: Node[][] = []): DrawPicture =>
  async (nodes) => {
    seen.push(nodes);
    return { png: PNG, ...size };
  };

const paragraphsWith = (xml: string, needle: string): string[] =>
  [...xml.matchAll(/<w:p>.*?<\/w:p>/g)].map((m) => m[0]).filter((p) => p.includes(needle));

// ── The container ────────────────────────────────────────────────────────

describe("the zip", () => {
  it("reads back with every checksum right", async () => {
    const data = new TextEncoder().encode("hello hello hello hello");
    const files = unzip(await zip([{ path: "a.txt", data }, { path: "dir/b.bin", data: PNG }]));
    expect(new TextDecoder().decode(files.get("a.txt"))).toBe("hello hello hello hello");
    expect([...files.get("dir/b.bin")!]).toEqual([...PNG]);
    expect(crc32(data)).toBe(zlibCrc(data));
  });

  it("makes the same bytes for the same document", async () => {
    const source = "# Same\n\nEvery time.\n@note Even with a note.";
    const date = new Date("2026-10-02T00:00:00Z");
    expect(await toDocx(source, { date })).toEqual(await toDocx(source, { date }));
  });
});

describe("the fonts", () => {
  const read = (file: string) => new Uint8Array(readFileSync(require.resolve(file)));

  it.each(WORD_FONTS)("$file unpacks to the face Word will look for", async (face) => {
    const ttf = await woffToSfnt(read(face.source));
    const font = fontkit.create(Buffer.from(ttf));
    // Word finds an embedded face by the family written inside the file.
    expect(font.familyName).toBe(face.family);
    const style = { regular: "Regular", bold: "Bold", italic: "Italic", boldItalic: "Bold Italic" }[face.style];
    expect(font.subfamilyName).toBe(style);
  });

  it("scrambles only the first 32 bytes, reversibly", () => {
    const font = new Uint8Array(64).map((_, i) => i);
    const key = fontKey(0);
    const once = obfuscate(font, key);
    expect([...once.subarray(32)]).toEqual([...font.subarray(32)]);
    expect([...once.subarray(0, 32)]).not.toEqual([...font.subarray(0, 32)]);
    expect([...obfuscate(once, key)]).toEqual([...font]);
  });

  it("embeds what it is given, and names every family either way", async () => {
    const fonts = await Promise.all(WORD_FONTS.map(async (f) => ({ family: f.family, style: f.style, data: read(f.source) })));
    const files = unzip(await toDocx("# Fonts", { fonts }));
    const table = text(files, "word/fontTable.xml");
    for (const style of ["embedRegular", "embedBold", "embedItalic", "embedBoldItalic"]) {
      expect(table).toMatch(new RegExp(`<w:font w:name="Lora">.*<w:${style} r:id="rId\\d+" w:fontKey="\\{[0-9A-F-]{36}\\}"/>`));
    }
    expect([...files.keys()].filter((k) => k.endsWith(".odttf"))).toHaveLength(WORD_FONTS.length);
    expect(text(files, "word/settings.xml")).toContain("<w:embedTrueTypeFonts/>");

    const bare = unzip(await toDocx("# Fonts"));
    expect(text(bare, "word/fontTable.xml")).toContain(`<w:font w:name="Lora">`);
    expect(text(bare, "word/fontTable.xml")).not.toContain("embedRegular");
    expect(text(bare, "word/settings.xml")).not.toContain("embedTrueTypeFonts");
  });
});

describe("the package", () => {
  it("lists every part it holds, and every relationship points at one", async () => {
    const { files } = await docx("# A\n\nText with a [link](https://example.com).\n@note A note.\n\n@tree T\n  a\n    b", camera({ width: 100, height: 50 }));
    const types = text(files, "[Content_Types].xml");
    for (const name of files.keys()) {
      const ext = name.split(".").pop();
      const typed = types.includes(`PartName="/${name}"`) || types.includes(`Extension="${ext}"`);
      expect(typed, `${name} has no content type`).toBe(true);
    }
    const rels = text(files, "word/_rels/document.xml.rels");
    for (const m of rels.matchAll(/Target="([^"]+)"(?! TargetMode)/g)) {
      expect(files.has(`word/${m[1]}`), `${m[1]} is missing`).toBe(true);
    }
  });
});

// ── What becomes what ────────────────────────────────────────────────────

describe("text", () => {
  it("gives headings Word's own heading styles", async () => {
    const { document } = await docx("# One\n\n## Two\n\n###### Six");
    expect(document).toContain(`<w:pStyle w:val="Heading1"/>`);
    expect(document).toContain(`<w:pStyle w:val="Heading2"/>`);
    expect(document).toContain(`<w:pStyle w:val="Heading6"/>`);
  });

  it("keeps bold, italic, code and highlight as formatting, not markup", async () => {
    const { document } = await docx("Some **bold**, *italic*, `code` and ==marked== words.");
    expect(document).toMatch(/<w:rPr><w:b\/><w:bCs\/><\/w:rPr><w:t xml:space="preserve">bold<\/w:t>/);
    expect(document).toMatch(/<w:i\/><w:iCs\/><\/w:rPr><w:t xml:space="preserve">italic</);
    expect(document).toMatch(/IBM Plex Mono.*<w:t xml:space="preserve">code</);
    expect(document).toMatch(/w:fill="FFDBC8"\/><\/w:rPr><w:t xml:space="preserve">marked</);
    expect(document).not.toMatch(/\*\*|==|`/);
  });

  it("breaks a line where the author ended one, unless @page says not to", async () => {
    expect((await docx("one\ntwo")).document).toContain("<w:br/>");
    expect((await docx("@page breaks=off\n\none\ntwo")).document).not.toContain("<w:br/>");
  });

  it("leaves a row between two paragraphs, as a blank line means", async () => {
    const { document } = await docx("First.\n\nSecond.");
    expect(paragraphsWith(document, ">First.<")[0]).toContain(`w:after="420"`);
  });

  it("drops characters XML cannot hold rather than the document", async () => {
    const { document } = await docx("A bell\u0007 rang.");
    expect(document).toContain("A bell rang.");
  });

  it("links out to the web, and in to a block by its id", async () => {
    const { files, document } = await docx(
      '@h1 id=pricing-decision Pricing\n\nSee [the site](https://jotstak.pages.dev) and [pricing](#pricing-decision).',
    );
    expect(text(files, "word/_rels/document.xml.rels")).toMatch(/Target="https:\/\/jotstak.pages.dev" TargetMode="External"/);
    expect(document).toContain(`<w:bookmarkStart w:id="0" w:name="pricing_decision"/>`);
    expect(document).toContain(`<w:hyperlink w:anchor="pricing_decision">`);
  });
});

describe("lists", () => {
  it("numbers each list from 1 again", async () => {
    const { document } = await docx("1. a\n2. b\n\nBetween.\n\n1. c\n2. d");
    const ids = new Set([...document.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map((m) => m[1]));
    expect(ids.size).toBe(2);
  });

  it("nests a point a level in", async () => {
    const { document } = await docx("- top\n  - under");
    expect(paragraphsWith(document, ">under<")[0]).toContain(`<w:ilvl w:val="1"/>`);
  });

  it("puts a block written under a point after it, indented to its text (UX-65)", async () => {
    const { document } = await docx("- point\n  @decision title=\"Inside\"\n    why: because\n- next");
    const at = document.indexOf(">point<");
    const card = document.indexOf("<w:tbl>", at);
    expect(card).toBeGreaterThan(at);
    expect(card).toBeLessThan(document.indexOf(">next<"));
    expect(document.slice(card, card + 300)).toContain(`<w:tblInd w:w="420" w:type="dxa"/>`);
  });
});

describe("margin notes", () => {
  it("become comments, signed by the document's author", async () => {
    const { files, document } = await docx("@meta\n  author: Ada Okafor\n\nThe line it is about.\n@note A thought.");
    const comments = text(files, "word/comments.xml");
    expect(comments).toContain(`w:author="Ada Okafor"`);
    expect(comments).toContain("A thought.");
    const p = paragraphsWith(document, "The line it is about.")[0]!;
    expect(p).toMatch(/<w:commentRangeStart w:id="0"\/>.*The line it is about\..*<w:commentRangeEnd w:id="0"\/>/);
  });

  it("are signed 'Note' when the document names nobody", async () => {
    const { files } = await docx("Words.\n@note A thought.");
    expect(text(files, "word/comments.xml")).toContain(`w:author="Note"`);
  });

  it("sit on the last point written before them, not the first (UX-68)", async () => {
    const { document } = await docx("- first\n- second\n- last\n@note About the last.");
    expect(paragraphsWith(document, ">first<")[0]).not.toContain("commentRangeStart");
    expect(paragraphsWith(document, ">last<")[0]).toContain("commentRangeStart");
  });
});

describe("cards", () => {
  it("are drawn as doc mode draws them: a hairline across the top (UX-70)", async () => {
    const { document } = await docx('@decision title="Ship it" status=accepted date=2026-09-12\n  context: Because');
    expect(document).toMatch(/<w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="E5E7EB"\/><\/w:tcBorders>/);
    for (const words of ["decision", "accepted", "2026-09-12", "Ship it", "context", "Because"]) expect(document).toContain(words);
    // Kept on one page, as print keeps it.
    expect(document).toContain("<w:cantSplit/>");
  });

  it("turn terracotta when flagged", async () => {
    const { document } = await docx('@risk title="Churn" level=high\n  owner: Growth');
    expect(document).toContain(`<w:top w:val="single" w:sz="6" w:space="0" w:color="C67139"/>`);
  });

  it("never sit directly against another table, which Word would fuse into one", async () => {
    const { document } = await docx('@decision title="A"\n  x: 1\n\n@decision title="B"\n  y: 2');
    expect(document).not.toContain("</w:tbl><w:tbl>");
  });
});

describe("tables", () => {
  it("are real Word tables, with a header row that repeats on every page", async () => {
    const { document } = await docx("@table\n  Feature, Status\n  Search, Shipped\n  Export, Doing");
    expect(document).toContain("<w:tblHeader/>");
    expect((document.match(/<w:tr>/g) ?? []).length).toBe(3);
    for (const words of ["Feature", "Shipped", "Doing"]) expect(document).toContain(words);
  });
});

describe("diagrams", () => {
  it("are pictures of the figure alone, at the size they are on the page", async () => {
    const seen: Node[][] = [];
    const { files, document } = await docx("@tree Plan\n  a\n    b\n  @table\n    x, y\n    1, 2", camera({ width: 300, height: 120 }, seen));
    expect(document).toContain(`<wp:extent cx="${300 * 9525}" cy="${120 * 9525}"/>`);
    expect(document).toContain(`descr="Tree: Plan"`);
    expect(files.has("word/media/figure1.png")).toBe(true);
    // What is written below a figure follows it as Word content, not inside the picture.
    expect(seen[0]![0]!.type === "block" && seen[0]![0]!.children).toEqual([]);
    expect(document.indexOf("<w:tbl>")).toBeGreaterThan(document.indexOf("<w:drawing>"));
  });

  it("shrink to fit the room they have, never past it", async () => {
    const { document } = await docx("@tree Wide\n  a", camera({ width: 2000, height: 100 }));
    const cx = Number(/<wp:extent cx="(\d+)"/.exec(document)![1]);
    expect(cx / 9525).toBeCloseTo((11906 - 2 * 840) / 15, 0);
  });

  it("get a landscape page of their own when they ask for one", async () => {
    const { document } = await docx("Before.\n\n@timeline Wide\n  Q1: a\n\nAfter.", camera({ width: 1000, height: 300, landscape: true }));
    const sections = [...document.matchAll(/<w:sectPr>.*?<\/w:sectPr>/g)].map((m) => m[0]);
    expect(sections).toHaveLength(3);
    expect(sections[1]).toContain(`w:orient="landscape"`);
    expect(sections[2]).not.toContain("landscape");
    // The landscape section ends on the picture itself.
    expect(paragraphsWith(document, "<w:drawing>")[0]).toContain(`w:orient="landscape"`);
  });

  it("end the document on their landscape page, with no blank page after", async () => {
    const { document } = await docx("Before.\n\n@timeline Wide\n  Q1: a", camera({ width: 1000, height: 300, landscape: true }));
    const sections = [...document.matchAll(/<w:sectPr>.*?<\/w:sectPr>/g)].map((m) => m[0]);
    expect(sections).toHaveLength(2);
    expect(sections[1]).toContain("landscape");
  });

  it("are written out as their words when nothing can draw them", async () => {
    const { document } = await docx("@tree Plan\n  Renderer\n    Parser");
    for (const words of ["Plan", "Renderer", "Parser"]) expect(document).toContain(words);
    expect(document).not.toContain("<w:drawing>");
  });

  it("draw a run of stickies as one wall, and read their notes out", async () => {
    const seen: Node[][] = [];
    const { document } = await docx("@sticky\n  First note\n@sticky\n  Second note", camera({ width: 300, height: 200 }, seen));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(2);
    expect(document).toContain(`descr="Sticky notes: First note; Second note"`);
  });
});

// ── Google Docs ──────────────────────────────────────────────────────────
//
// The first file was opened in Google Docs and came out with a third of a
// page of air under every heading and no space at all between two cards.
// Docs has no exact line height: it read a 56px line as "3.5 lines", and a
// row of space set as the height of an empty 1pt line as almost nothing.

describe("in Google Docs", () => {
  it("never sets a line's height exactly or as a minimum, which Docs misreads", async () => {
    const { files } = await docx(readFileSync(fileURLToPath(new URL("../../../samples/showcase.jot", import.meta.url)), "utf8"), camera({ width: 600, height: 300 }));
    for (const part of ["word/document.xml", "word/styles.xml", "word/numbering.xml"]) {
      expect(text(files, part), part).not.toMatch(/w:lineRule="(exact|atLeast)"/);
    }
  });

  it("never sets a line below single, which clips the tops of letters", async () => {
    const { files } = await docx("# Title\n\n### Small heading\n\nText.");
    for (const part of ["word/document.xml", "word/styles.xml"]) {
      for (const m of text(files, part).matchAll(/w:line="(\d+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(240);
    }
  });

  it("makes a row of space between blocks out of space after a paragraph, which every reader takes exactly", async () => {
    const { files, document } = await docx('@decision title="A"\n  x: 1\n\n@decision title="B"\n  y: 2');
    expect(document).toContain(`</w:tbl><w:p><w:pPr><w:pStyle w:val="Gap"/></w:pPr></w:p><w:tbl>`);
    expect(text(files, "word/styles.xml")).toMatch(/w:styleId="Gap">.*?<w:spacing w:after="400" w:line="240" w:lineRule="auto"\/>/);
  });

  it("sets a card's key and value on one line, so they share a baseline", async () => {
    const { document } = await docx('@decision title="A"\n  context: Seat pricing punishes adoption');
    const p = paragraphsWith(document, ">context<")[0]!;
    expect(p).toContain("Seat pricing punishes adoption");
    expect(p).toContain("<w:tab/>");
  });

  it("dates every comment, rather than leaving Docs to call it 1970", async () => {
    const files = unzip(await toDocx("Words.\n@note A thought.", { date: new Date("2026-10-02T09:30:00.123Z") }));
    expect(text(files, "word/comments.xml")).toContain(`w:date="2026-10-02T09:30:00Z"`);
  });
});

// ── Everything ───────────────────────────────────────────────────────────

describe("every block", () => {
  it.each(PRIMITIVES.map((p) => [p.name, p] as const))("@%s makes a file Word can read", async (_, spec) => {
    const source = scaffoldSource(spec, { body: "whole" });
    await docx(`# Around it\n\n${source}\n\nAfter it.`, camera({ width: 400, height: 200 }));
  });

  it.each(["pricing-v2.jot", "problem-statement.jot", "showcase.jot"])("samples/%s makes a file Word can read", async (name) => {
    const source = readFileSync(fileURLToPath(new URL(`../../../samples/${name}`, import.meta.url)), "utf8");
    await docx(source, camera({ width: 600, height: 300 }));
    await docx(source);
  });
});
