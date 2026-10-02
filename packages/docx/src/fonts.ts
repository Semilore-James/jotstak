// The typefaces, carried inside the file.
//
// Word does not come with Lora, Inter or IBM Plex Mono, and without them a
// Jotstak document opens in whatever Word substitutes. So the faces go inside
// the .docx, as Word's own font embedding: a TrueType file per style, its
// first 32 bytes scrambled with a key, the way ECMA-376 specifies. Google Docs
// ignores embedded fonts but has all three families itself, so it matches too.
//
// All three are SIL Open Font License 1.1, which permits embedding, and every
// file's own embedding flag says "installable". Only the Latin subset ships,
// as on the website.

import { inflate } from "./zip.js";

export type FontStyle = "regular" | "bold" | "italic" | "boldItalic";

export interface WordFont {
  /** The family Word knows it by. Matches the name inside the file. */
  family: string;
  style: FontStyle;
  /** The file a host serves, under its fonts folder. */
  file: string;
  /** Where the file lives in node_modules, for hosts that copy fonts at build time. */
  source: string;
}

const face = (pkg: string, family: string, style: FontStyle, weight: number, italic: boolean): WordFont => {
  const file = `${pkg}-latin-${weight}-${italic ? "italic" : "normal"}.woff`;
  return { family, style, file, source: `@fontsource/${pkg}/files/${file}` };
};

/**
 * The faces a Word file embeds. Word knows four styles of a family — regular,
 * bold, italic, bold italic — and finds each by the family name written
 * inside the font file, so these are exactly the four files whose name is
 * "Lora", and the two of "Inter". The website's semibold faces call
 * themselves "Inter SemiBold" and "Lora SemiBold": embedded under "Lora" they
 * would not be found, and Word would smear a fake bold over the regular.
 * So a heading is set bold in Word where the page uses semibold.
 *
 * WOFF, not the WOFF2 the website loads: WOFF2 is compressed with Brotli,
 * which a browser can decompress for its own fonts but will not do for a
 * script. WOFF is plain deflate, which it will.
 */
export const WORD_FONTS: readonly WordFont[] = [
  face("lora", "Lora", "regular", 400, false),
  face("lora", "Lora", "bold", 700, false),
  face("lora", "Lora", "italic", 400, true),
  face("lora", "Lora", "boldItalic", 700, true),
  face("inter", "Inter", "regular", 400, false),
  face("inter", "Inter", "bold", 700, false),
  face("ibm-plex-mono", "IBM Plex Mono", "regular", 400, false),
];

/** A font a host has loaded, to embed. WOFF or TrueType. */
export interface EmbeddedFont {
  family: string;
  style: FontStyle;
  data: Uint8Array;
}

const tag = (view: DataView, at: number): number => view.getUint32(at);

/**
 * WOFF to the TrueType file it wraps. A WOFF is the same tables, each
 * deflated, behind a different header; Word wants the tables as they were.
 * Anything that is already TrueType or OpenType comes back untouched.
 */
export async function woffToSfnt(input: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (tag(view, 0) !== 0x774f4646) return input; // not "wOFF"

  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);
  const tables: { tag: number; checksum: number; data: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const offset = view.getUint32(at + 4);
    const compLength = view.getUint32(at + 8);
    const origLength = view.getUint32(at + 12);
    const raw = input.subarray(offset, offset + compLength);
    const data = compLength < origLength ? await inflate(raw) : raw;
    if (data.length !== origLength) throw new Error("A font table did not unpack to its own length.");
    tables.push({ tag: view.getUint32(at), checksum: view.getUint32(at + 16), data });
  }

  const pad = (n: number): number => (n + 3) & ~3;
  const headerSize = 12 + 16 * numTables;
  const total = tables.reduce((n, t) => n + pad(t.data.length), headerSize);
  const out = new Uint8Array(total);
  const o = new DataView(out.buffer);

  let power = 1;
  let log = 0;
  while (power * 2 <= numTables) {
    power *= 2;
    log++;
  }
  o.setUint32(0, flavor);
  o.setUint16(4, numTables);
  o.setUint16(6, power * 16);
  o.setUint16(8, log);
  o.setUint16(10, numTables * 16 - power * 16);

  let offset = headerSize;
  tables.forEach((t, i) => {
    const rec = 12 + i * 16;
    o.setUint32(rec, t.tag);
    o.setUint32(rec + 4, t.checksum);
    o.setUint32(rec + 8, offset);
    o.setUint32(rec + 12, t.data.length);
    out.set(t.data, offset);
    offset += pad(t.data.length);
  });
  return out;
}

/**
 * A key for one embedded font, written as a GUID. Any GUID will do — it only
 * has to match between the font table and the scrambled file — so it is made
 * from the font's position, which keeps the same document's bytes the same.
 */
export function fontKey(index: number): string {
  const hex = (index + 1).toString(16).padStart(12, "0").toUpperCase();
  return `4A4F5453-5441-4B00-8000-${hex}`;
}

/**
 * ECMA-376 font obfuscation: the first 32 bytes of the file XORed with the
 * key's 16 bytes, taken in reverse order.
 */
export function obfuscate(font: Uint8Array, key: string): Uint8Array {
  const hex = key.replace(/[{}-]/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error(`Not a font key: ${key}`);
  const bytes = (hex.match(/../g) ?? []).map((h) => parseInt(h, 16)).reverse();
  const out = font.slice();
  for (let i = 0; i < Math.min(32, out.length); i++) out[i] = out[i]! ^ bytes[i % 16]!;
  return out;
}
