import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import * as fontkit from "fontkit";
import { FONT_ADVANCES } from "./font-metrics.js";
import { ESTIMATE_SAFETY, measureText } from "./measure.js";

const require = createRequire(import.meta.url);

describe("measureText — sizing diagrams before a browser does (ARC-15)", () => {
  it("still matches the shipped font files", () => {
    // A Fontsource bump that changes a single advance would silently mis-size
    // every diagram, so the committed table is re-checked against the woff2.
    for (const [face, weight] of [["lora-400", 400], ["lora-600", 600]] as const) {
      const font = fontkit.openSync(require.resolve(`@fontsource/lora/files/lora-latin-${weight}-normal.woff2`));
      for (const ch of "Table Content type — naïve café Q3 (x) 1,240") {
        expect(FONT_ADVANCES[face].widths[ch], `${face} ${JSON.stringify(ch)}`).toBe(
          font.glyphForCodePoint(ch.codePointAt(0)!).advanceWidth,
        );
      }
    }
  });

  it("adds advances and scales them to the font size", () => {
    const t = FONT_ADVANCES["lora-400"];
    const units = [..."Table"].reduce((sum, ch) => sum + t.widths[ch]!, 0);
    expect(measureText("Table", "lora-400", 16)).toBeCloseTo((units / t.unitsPerEm) * 16, 6);
    expect(measureText("Table", "lora-400", 32)).toBeCloseTo(2 * measureText("Table", "lora-400", 16), 6);
  });

  it("measures a character the font lacks as a full em", () => {
    // The browser draws it from a fallback face; measured at exactly 1em for →.
    expect(measureText("→", "lora-400", 16)).toBeCloseTo(16, 6);
    expect(measureText("漢", "lora-600", 10)).toBeCloseTo(10, 6);
  });

  it("measures what is drawn, not the Markdown that asks for it", () => {
    const plain = measureText("Bold text and code", "lora-400", 16);
    expect(measureText("**Bold** text and `code`", "lora-400", 16)).toBeCloseTo(plain, 6);
    expect(measureText("[Bold text](https://x.y) and code", "lora-400", 16)).toBeCloseTo(plain, 6);
  });

  it("semibold is wider than regular", () => {
    expect(measureText("Retention", "lora-600", 16)).toBeGreaterThan(measureText("Retention", "lora-400", 16));
  });

  it("keeps a safety margin above the worst measured under-estimate", () => {
    // Worst under-estimate against real browser rendering was −0.17%.
    expect(ESTIMATE_SAFETY).toBeGreaterThanOrEqual(1.02);
  });
});
