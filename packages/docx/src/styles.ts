// The Word file's styles, taken from doc mode.
//
// The numbers are not chosen here. Each one is doc mode's own, measured off
// the rendered page — a 16px body on a 28px line, headings with the space
// above and below them that the page gives them — and converted. A reader
// who restyles "Heading 2" in Word restyles every one at once, which is why
// these are real named styles and not formatting stamped on each paragraph.

import { tokens } from "@jotstak/renderer";
import { C, FONT, ROW, XML_HEAD, esc, hp, pPr, rPr, tw } from "./xml.js";
import type { ParaProps, RunProps } from "./xml.js";

const type = tokens.typography;
const px = (size: string): number => parseFloat(size);

/** One row, in twips. The unit everything vertical is counted in. */
export const ROW_TW = tw(ROW);

/**
 * How tall a typeface sets a line at "single" spacing, as a share of its
 * size. It is not one number. Google Docs and Word for Mac read it from one
 * pair of the font's measurements and Word for Windows from another, and for
 * Lora and Inter the two differ by a sixth (Lora: 1.28 against 1.50 of its
 * size; Inter: 1.21 against 1.43). Line heights are set from the point
 * halfway between, so a 28px row comes out within 8% of 28px wherever the
 * file is opened.
 *
 * Why not give the height exactly, as Word allows? Because Google Docs has no
 * exact line height. It read a heading's 56px line as "3.5 lines" and gave
 * every heading a third of a page of air below it.
 */
const SINGLE: Record<string, number> = {
  [FONT.body]: (1.28 + 1.5) / 2,
  [FONT.label]: (1.2104 + 1.4302) / 2,
  [FONT.mono]: 1.3,
};

/**
 * Line spacing that makes text of this size take this many pixels, as a
 * multiple of single spacing — the one kind every reader agrees on. Never
 * below single, which clips the tops of letters in Word.
 */
export function lineFor(fontPx: number, targetPx: number, family: string = FONT.body): { line: number; rule: "auto" } {
  const single = fontPx * (SINGLE[family] ?? SINGLE[FONT.body]!);
  return { line: Math.max(240, Math.round((240 * targetPx) / single)), rule: "auto" };
}

/** An empty paragraph's mark set at 1pt, single: a line of next to no height. */
export const TINY = { mark: { size: 2 }, spacing: { line: 240, rule: "auto" as const } };

/**
 * Headings, as doc mode sets them. `before` and `after` are the space the page
 * leaves above and below each one — measured, because a heading's place on
 * the page includes the shift that sits its text on a ruled line, and that is
 * different for every size. Levels 5 and 6 run out of sizes, so they carry
 * their rank with weight and, for 6, the label face.
 */
export const HEADINGS = {
  1: { size: px(type.headline.xl.size), line: 2 * ROW, before: ROW + 6.68, after: 21.32, tracking: -0.72 },
  2: { size: px(type.headline.lg.size), line: 2 * ROW, before: ROW + 9.608, after: 18.392, tracking: -0.42 },
  3: { size: px(type.headline.md.size), line: ROW, before: ROW + 25.804, after: 2.196, tracking: -0.22 },
  4: { size: px(type.headline.sm.size), line: ROW, before: ROW + 27.268, after: 0.732, tracking: 0 },
  5: { size: px(type.body.lg.size), line: ROW, before: ROW, after: ROW, tracking: 0 },
  6: { size: px(type.label.md.size), line: ROW, before: ROW, after: ROW, tracking: 0.72 },
} as const;

export type HeadingLevel = keyof typeof HEADINGS;

/** A label: the small capitals used for kickers, field keys, column headings and table headers. */
export const LABEL: RunProps = {
  font: FONT.label,
  bold: true,
  caps: true,
  size: hp(px(type.label.md.size)),
  tracking: tw(0.24),
  color: C.muted,
};

/** The kicker over a card: one size smaller than a label, and tracked wider. */
export const KICKER: RunProps = {
  font: FONT.label,
  bold: true,
  caps: true,
  size: hp(px(type.label.sm.size)),
  tracking: tw(0.5),
  color: C.muted,
};

interface StyleDef {
  id: string;
  name: string;
  type?: "paragraph" | "character";
  basedOn?: string;
  next?: string;
  hidden?: boolean;
  para?: ParaProps;
  run?: RunProps;
}

const quoteBorder = { left: { px: 1, color: C.accent, space: 20 } };
const quoteIndent = { left: tw(ROW) };

const STYLES: StyleDef[] = [
  ...([1, 2, 3, 4, 5, 6] as const).map((level): StyleDef => {
    const h = HEADINGS[level];
    return {
      id: `Heading${level}`,
      name: `heading ${level}`,
      basedOn: "Normal",
      next: "Normal",
      para: {
        keepNext: true,
        keepLines: true,
        spacing: { before: tw(h.before), after: tw(h.after), ...lineFor(h.size, h.line, level === 6 ? FONT.label : FONT.body) },
        outline: level - 1,
      },
      run:
        level === 6
          ? { ...LABEL, size: hp(h.size), tracking: tw(h.tracking) }
          : { bold: true, size: hp(h.size), tracking: h.tracking ? tw(h.tracking) : undefined, color: C.ink },
    };
  }),
  {
    id: "Title",
    name: "Title",
    basedOn: "Normal",
    next: "Subtitle",
    para: { keepNext: true, spacing: lineFor(px(type.headline.xl.size), 2 * ROW) },
    run: { bold: true, size: hp(px(type.headline.xl.size)), tracking: tw(-0.72) },
  },
  {
    id: "Subtitle",
    name: "Subtitle",
    basedOn: "Normal",
    next: "Normal",
    para: { spacing: lineFor(px(type.body.lg.size), ROW, FONT.label) },
    run: { font: FONT.label, color: C.muted },
  },
  {
    id: "Quote",
    name: "Quote",
    basedOn: "Normal",
    next: "Normal",
    para: { borders: quoteBorder, indent: quoteIndent },
    run: { italic: true, color: C.muted },
  },
  {
    // Inside the quote's rule, so Word draws one line down both.
    id: "QuoteCredit",
    name: "Quote Credit",
    basedOn: "Normal",
    next: "Normal",
    para: { borders: quoteBorder, spacing: lineFor(px(type.label.md.size), ROW, FONT.label), indent: quoteIndent },
    run: { font: FONT.label, size: hp(px(type.label.md.size)), color: C.muted },
  },
  {
    id: "Label",
    name: "Label",
    basedOn: "Normal",
    next: "Normal",
    para: { spacing: lineFor(px(type.label.md.size), ROW, FONT.label) },
    run: LABEL,
  },
  {
    id: "Kicker",
    name: "Card Kicker",
    basedOn: "Normal",
    next: "CardTitle",
    para: { keepNext: true, spacing: lineFor(px(type.label.sm.size), ROW, FONT.label) },
    run: KICKER,
  },
  {
    id: "CardTitle",
    name: "Card Title",
    basedOn: "Normal",
    next: "Normal",
    para: { keepNext: true, spacing: lineFor(px(type.headline.sm.size), ROW) },
    run: { bold: true, size: hp(px(type.headline.sm.size)) },
  },
  {
    // The table caption: the label face, in ink rather than grey.
    id: "TableCaption",
    name: "Table Caption",
    basedOn: "Normal",
    next: "Normal",
    para: { keepNext: true, spacing: lineFor(px(type.label.md.size), ROW, FONT.label) },
    run: { ...LABEL, color: C.ink, tracking: tw(0.24) },
  },
  {
    id: "Code",
    name: "Code Block",
    basedOn: "Normal",
    next: "Normal",
    para: { spacing: lineFor(15, ROW, FONT.mono) },
    run: { font: FONT.mono, size: hp(15) },
  },
  {
    // A row of space and nothing else. Two tables written one after the other
    // must have a paragraph between them or Word fuses them into one table,
    // so the gap below a table is this. The row is the space after a line of
    // next to no height, not the height of the line: space before and after a
    // paragraph is the one vertical measure every reader takes exactly.
    id: "Gap",
    name: "Gap",
    basedOn: "Normal",
    next: "Normal",
    hidden: true,
    para: { spacing: { after: ROW_TW - 20, line: 240, rule: "auto" } },
    run: { size: 2 },
  },
  {
    // A margin note, in the comment pane: doc mode's note, Lora set small and grey.
    id: "CommentText",
    name: "annotation text",
    basedOn: "Normal",
    hidden: true,
    para: { spacing: { line: 240, rule: "auto" } },
    run: { size: hp(14), italic: true, color: C.muted },
  },
  { id: "CommentReference", name: "annotation reference", type: "character", hidden: true, run: { size: 16 } },
  { id: "Hyperlink", name: "Hyperlink", type: "character", run: { color: C.accent, underline: true } },
];

function styleXml(s: StyleDef): string {
  const kind = s.type ?? "paragraph";
  return (
    `<w:style w:type="${kind}" w:customStyle="${/^(Heading\d|Title|Subtitle|Quote|Hyperlink|CommentText|CommentReference)$/.test(s.id) ? 0 : 1}" w:styleId="${s.id}">` +
    `<w:name w:val="${esc(s.name)}"/>` +
    (s.basedOn ? `<w:basedOn w:val="${s.basedOn}"/>` : "") +
    (s.next ? `<w:next w:val="${s.next}"/>` : "") +
    (s.hidden ? `<w:semiHidden/><w:unhideWhenUsed/>` : `<w:qFormat/>`) +
    (s.para ? pPr(s.para) : "") +
    (s.run ? rPr(s.run) : "") +
    `</w:style>`
  );
}

export function stylesXml(): string {
  const body = rPr({ font: FONT.body, size: hp(px(type.body.lg.size)), color: C.ink }).slice("<w:rPr>".length, -"</w:rPr>".length);
  return (
    XML_HEAD +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults>` +
    `<w:rPrDefault><w:rPr>${body}</w:rPr></w:rPrDefault>` +
    // A row per line of body text, as a multiple of single spacing (see
    // SINGLE above), so a line holding a picture still grows to fit it.
    `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${lineFor(px(type.body.lg.size), ROW).line}" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
    `</w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>` +
    `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
    `<w:style w:type="numbering" w:default="1" w:styleId="NoList"><w:name w:val="No List"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style>` +
    STYLES.map(styleXml).join("") +
    `</w:styles>`
  );
}

// ── Lists ────────────────────────────────────────────────────────────────

/** Bullets as a browser draws nested lists: disc, circle, square. */
const BULLETS = ["•", "◦", "▪"];

const level = (ilvl: number, ordered: boolean): string =>
  `<w:lvl w:ilvl="${ilvl}">` +
  `<w:start w:val="1"/>` +
  `<w:numFmt w:val="${ordered ? "decimal" : "bullet"}"/>` +
  `<w:lvlText w:val="${ordered ? `%${ilvl + 1}.` : BULLETS[ilvl % BULLETS.length]}"/>` +
  `<w:lvlJc w:val="left"/>` +
  // Each level's text one row further in, its marker in the row before it —
  // the 28px a list is indented on the page.
  `<w:pPr><w:ind w:left="${ROW_TW * (ilvl + 1)}" w:hanging="${ROW_TW}"/></w:pPr>` +
  // The marker in the accent, as li::marker is.
  rPr({ font: ordered ? FONT.body : undefined, color: C.accent }) +
  `</w:lvl>`;

const abstract = (id: number, ordered: boolean): string =>
  `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="multilevel"/>` +
  Array.from({ length: 9 }, (_, i) => level(i, ordered)).join("") +
  `</w:abstractNum>`;

export const BULLET_LIST = 0;
export const NUMBERED_LIST = 1;

/**
 * Every numbered list is a numbering instance of its own, so each one starts
 * again at 1 rather than carrying on from the list before it. Bullets have
 * nothing to count, so they all share one.
 */
export class Numbering {
  private readonly lists: { abstract: number; start: number }[] = [{ abstract: BULLET_LIST, start: 1 }];

  /** The one instance every bullet list uses. */
  readonly bullets = 1;

  numbered(start = 1): number {
    this.lists.push({ abstract: NUMBERED_LIST, start });
    return this.lists.length;
  }

  xml(): string {
    return (
      XML_HEAD +
      `<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      abstract(BULLET_LIST, false) +
      abstract(NUMBERED_LIST, true) +
      this.lists
        .map(
          (l, i) =>
            `<w:num w:numId="${i + 1}"><w:abstractNumId w:val="${l.abstract}"/>` +
            (l.abstract === NUMBERED_LIST
              ? Array.from(
                  { length: 9 },
                  (_, lvl) => `<w:lvlOverride w:ilvl="${lvl}"><w:startOverride w:val="${lvl === 0 ? l.start : 1}"/></w:lvlOverride>`,
                ).join("")
              : "") +
            `</w:num>`,
        )
        .join("") +
      `</w:numbering>`
    );
  }
}
