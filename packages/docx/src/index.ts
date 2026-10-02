// @jotstak/docx — a .jot document as a Word file.
//
// Opens in Word and in Google Docs. Read like doc mode: the same document on
// a white sheet, with its headings, lists and tables as real, editable Word
// content, cards drawn as doc mode draws them, diagrams as pictures of the
// page's own diagrams, and margin notes as comments in Word's margin.
//
// Made wherever the source is (PRD-31): the website makes it in the reader's
// browser, so the document never leaves their computer.

import { documentName, markdownFor, parse } from "@jotstak/renderer";
import type { DocumentNode } from "@jotstak/renderer";
import { Context, bodyXml, convertDocument } from "./convert.js";
import type { DrawPicture } from "./convert.js";
import { fontKey, obfuscate, woffToSfnt } from "./fonts.js";
import type { EmbeddedFont, FontStyle } from "./fonts.js";
import { stylesXml } from "./styles.js";
import { FONT, NS, XML_HEAD, esc } from "./xml.js";
import { zip } from "./zip.js";
import type { ZipEntry } from "./zip.js";

export { WORD_FONTS, woffToSfnt } from "./fonts.js";
export type { EmbeddedFont, FontStyle, WordFont } from "./fonts.js";
export type { DrawPicture, Picture, PictureRequest } from "./convert.js";
export { zip, crc32 } from "./zip.js";

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface DocxOptions {
  /** The typefaces to carry inside the file. Without them, Word substitutes its own. */
  fonts?: readonly EmbeddedFont[];
  /** Draws the diagrams. Without it, a diagram is written out as a list of its words. */
  picture?: DrawPicture;
  /** The title in the file's properties. Defaults to the document's first heading. */
  title?: string;
}

/** The author or owner the document's @meta names, if it names one. */
function author(ast: DocumentNode): string | undefined {
  for (const n of ast.children) {
    if (n.type !== "block" || n.name !== "meta" || n.body.shape !== "keyed") continue;
    const f = n.body.fields.find((x) => /^(author|owner)$/i.test(x.key.trim()) && x.value.trim());
    if (f) return f.value.trim();
  }
  return undefined;
}

const encoder = new TextEncoder();
const text = (path: string, xml: string): ZipEntry => ({ path, data: encoder.encode(xml) });

const FAMILY: Record<string, { family: string; pitch: string }> = {
  [FONT.body]: { family: "roman", pitch: "variable" },
  [FONT.label]: { family: "swiss", pitch: "variable" },
  [FONT.mono]: { family: "modern", pitch: "fixed" },
};

const EMBED: Record<FontStyle, string> = {
  regular: "embedRegular",
  bold: "embedBold",
  italic: "embedItalic",
  boldItalic: "embedBoldItalic",
};

export async function toDocx(source: string, options: DocxOptions = {}): Promise<Uint8Array> {
  const { ast } = parse(source);
  const page = ast.children.find((n) => n.type === "block" && n.name === "page");
  const breaks = !(page?.type === "block" && page.params.breaks === "off");
  const writer = author(ast);
  const ctx = new Context(markdownFor(breaks), breaks, writer ?? "Note", options.picture);

  const sections = await convertDocument(ast, ctx);
  const document =
    XML_HEAD + `<w:document ${NS}><w:body>${bodyXml(sections)}</w:body></w:document>`;

  // ── The fonts, scrambled as Word expects ──
  const fonts = options.fonts ?? [];
  const embedded: { family: string; style: FontStyle; key: string; part: string }[] = [];
  const fontParts: ZipEntry[] = [];
  for (const [i, f] of fonts.entries()) {
    const key = fontKey(i);
    const part = `fonts/font${i + 1}.odttf`;
    fontParts.push({ path: `word/${part}`, data: obfuscate(await woffToSfnt(f.data), key) });
    embedded.push({ family: f.family, style: f.style, key, part });
  }
  const families = [...new Set([FONT.body, FONT.label, FONT.mono, ...fonts.map((f) => f.family)])];
  const fontTable =
    XML_HEAD +
    `<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    families
      .map((family) => {
        const hint = FAMILY[family] ?? { family: "auto", pitch: "variable" };
        const embeds = (["regular", "bold", "italic", "boldItalic"] as const)
          .map((style) => {
            const i = embedded.findIndex((e) => e.family === family && e.style === style);
            return i === -1 ? "" : `<w:${EMBED[style]} r:id="rId${i + 1}" w:fontKey="{${embedded[i]!.key}}"/>`;
          })
          .join("");
        return `<w:font w:name="${esc(family)}"><w:family w:val="${hint.family}"/><w:pitch w:val="${hint.pitch}"/>${embeds}</w:font>`;
      })
      .join("") +
    `</w:fonts>`;
  const fontRels =
    XML_HEAD +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    embedded
      .map(
        (e, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${e.part}"/>`,
      )
      .join("") +
    `</Relationships>`;

  // ── The parts ──
  const hasComments = ctx.comments.length > 0;
  const W = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const documentRels =
    XML_HEAD +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${W}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${W}/numbering" Target="numbering.xml"/>` +
    `<Relationship Id="rId3" Type="${W}/settings" Target="settings.xml"/>` +
    `<Relationship Id="rId4" Type="${W}/fontTable" Target="fontTable.xml"/>` +
    (hasComments ? `<Relationship Id="rId5" Type="${W}/comments" Target="comments.xml"/>` : "") +
    ctx.rels
      .map(
        (r) =>
          `<Relationship Id="${r.id}" Type="${r.type}" Target="${esc(r.target)}"${r.external ? ` TargetMode="External"` : ""}/>`,
      )
      .join("") +
    `</Relationships>`;

  const settings =
    XML_HEAD +
    `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    (embedded.length > 0 ? `<w:embedTrueTypeFonts/>` : "") +
    `<w:defaultTabStop w:val="420"/>` +
    `<w:characterSpacingControl w:val="doNotCompress"/>` +
    // Word 2013 and later, so it opens without the "compatibility mode" banner.
    `<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>` +
    `</w:settings>`;

  const comments =
    XML_HEAD + `<w:comments ${NS}>${ctx.comments.join("")}</w:comments>`;

  const title = options.title ?? documentName(source);
  const core =
    XML_HEAD +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${esc(title)}</dc:title>` +
    (writer ? `<dc:creator>${esc(writer)}</dc:creator>` : "") +
    `</cp:coreProperties>`;
  const app =
    XML_HEAD +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Jotstak</Application></Properties>`;

  const O = "application/vnd.openxmlformats-officedocument";
  const contentTypes =
    XML_HEAD +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Default Extension="odttf" ContentType="${O}.obfuscatedFont"/>` +
    `<Override PartName="/word/document.xml" ContentType="${O}.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="${O}.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/word/numbering.xml" ContentType="${O}.wordprocessingml.numbering+xml"/>` +
    `<Override PartName="/word/settings.xml" ContentType="${O}.wordprocessingml.settings+xml"/>` +
    `<Override PartName="/word/fontTable.xml" ContentType="${O}.wordprocessingml.fontTable+xml"/>` +
    (hasComments ? `<Override PartName="/word/comments.xml" ContentType="${O}.wordprocessingml.comments+xml"/>` : "") +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="${O}.extended-properties+xml"/>` +
    `</Types>`;

  const rootRels =
    XML_HEAD +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${W}/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="${W}/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  return zip([
    text("[Content_Types].xml", contentTypes),
    text("_rels/.rels", rootRels),
    text("docProps/core.xml", core),
    text("docProps/app.xml", app),
    text("word/document.xml", document),
    text("word/_rels/document.xml.rels", documentRels),
    text("word/styles.xml", stylesXml()),
    text("word/numbering.xml", ctx.numbering.xml()),
    text("word/settings.xml", settings),
    text("word/fontTable.xml", fontTable),
    ...(embedded.length > 0 ? [text("word/_rels/fontTable.xml.rels", fontRels)] : []),
    ...fontParts,
    ...(hasComments ? [text("word/comments.xml", comments)] : []),
    ...ctx.media.map((m) => ({ path: `word/${m.path}`, data: m.data })),
  ]);
}
