// @journey — stages across, and the line that shows how it felt.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";
import { JOURNEY, LEVEL, measureJourney, readStage } from "./journey.js";
import type { JourneyModel, Stage } from "./journey.js";
import { PAGE } from "./page.js";

const src = (...lines: string[]): string => lines.join("\n");
const out = (s: string) => render(s, { mode: "notebook" });
const at = { line: 0, column: 0 };

const FOUR = src(
  '@journey title="Onboarding"',
  "  stage Discover feeling=happy",
  "    Finds the landing page",
  "  stage Install feeling=frustrated",
  "    Waits four minutes",
  "  stage First doc feeling=neutral",
  "  stage Shares it feeling=happy",
);

const stage = (name: string, feeling: Stage["feeling"] = "neutral", items: string[] = []): Stage => ({
  name,
  feeling,
  items,
});
const model = (stages: Stage[], over: Partial<JourneyModel> = {}): JourneyModel => ({
  title: "",
  tracks: [{ name: "", stages }],
  vertical: false,
  single: true,
  ...over,
});

describe("reading a stage", () => {
  it.each([
    ["stage Discover feeling=happy", "Discover", "happy"],
    ["stage Install feeling=frustrated", "Install", "frustrated"],
    ['stage First doc feeling="neutral"', "First doc", "neutral"],
    ["stage Discover", "Discover", "neutral"],
    ["Discover", "Discover", "neutral"],
  ])("%s", (text, name, feeling) => {
    expect(readStage(text, [], at)).toEqual({ name, feeling });
  });

  it("takes the word people actually reach for", () => {
    // Being told "that is not a feeling" by a document tool is a silly way to
    // lose two minutes.
    for (const word of ["good", "great"]) expect(readStage(`stage X feeling=${word}`, [], at).feeling).toBe("happy");
    for (const word of ["bad", "sad", "angry"]) expect(readStage(`stage X feeling=${word}`, [], at).feeling).toBe("frustrated");
  });

  it("says so when a feeling is not one, and keeps the stage", () => {
    const diagnostics: import("./index.js").Diagnostic[] = [];
    expect(readStage("stage Install feeling=livid", diagnostics, at)).toEqual({
      name: "Install",
      feeling: "neutral",
    });
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.message).toContain("happy, neutral and frustrated");
  });
});

describe("what a journey does with what it is given", () => {
  it("draws a stage per line, in order, with its feeling", () => {
    const html = out(FOUR).html;
    expect(html).toMatch(/data-feeling="happy"[\s\S]*?Discover/);
    expect(html).toMatch(/data-feeling="frustrated"[\s\S]*?Install/);
    expect(out(FOUR).diagnostics).toEqual([]);
  });

  it("puts each dot at the height of its own feeling", () => {
    // The three levels are the diagram: everything else is labelling.
    expect(LEVEL).toEqual({ happy: 0, neutral: 1, frustrated: 2 });
    const html = out(FOUR).html;
    expect(html).toContain("--jot-j-level:0");
    expect(html).toContain("--jot-j-level:2");
  });

  it("draws the emotion line through those same points", () => {
    // The viewBox is one unit per stage across and one per feeling down, so a
    // point at (i + 0.5, level + 0.5) is the centre of that stage's column and
    // that feeling's row — the cells the dots sit in.
    const html = out(FOUR).html;
    expect(html).toContain(`viewBox="0 0 4 ${JOURNEY.bandRows}"`);
    expect(html).toContain('points="0.5,0.5 1.5,2.5 2.5,1.5 3.5,0.5"');
    // Stretching a viewBox that way would ruin the stroke with it.
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    expect(html).toContain('preserveAspectRatio="none"');
  });

  it("keeps swim lanes separate, each with its own line", () => {
    const html = out(
      src(
        "@journey",
        "  track Customer",
        "    stage Report feeling=frustrated",
        "  track Support",
        "    stage Triage feeling=neutral",
      ),
    ).html;
    expect(html).toContain("Customer");
    expect(html).toContain("Support");
    expect((html.match(/jot-journey-lane/g) ?? []).length).toBe(2);
    expect((html.match(/<svg/g) ?? []).length).toBe(2);
  });

  it("points at the keyword when a line is neither stage nor track", () => {
    const { diagnostics, html } = out(src("@journey", "  Discover", "  stage Install"));
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.message).toContain("stage Discover");
    // Nothing is dropped: it is still drawn.
    expect(html).toContain("Discover");
  });

  it("says so when there is nothing to draw", () => {
    expect(out("@journey").diagnostics[0]!.message).toContain("no stages");
  });
});

describe("how much page a journey takes", () => {
  it("spans the printable width and divides it equally", () => {
    // Equal columns for the same reason a matrix's quadrants are equal: a
    // stage with more written under it is not a longer stage.
    expect(measureJourney(model([stage("A"), stage("B")])).w).toBe(PAGE.portrait.content);
    expect(measureJourney(model([stage("A"), stage("B")])).column).toBe(PAGE.portrait.content / 2);
    expect(out(FOUR).html).toContain('data-width="full"');
  });

  it("is a whole number of rows tall", () => {
    for (const n of [1, 3, 7]) {
      const m = model(Array.from({ length: n }, (_, i) => stage(`S${i}`, "neutral", ["an item"])));
      expect(measureJourney(m).h % JOURNEY.row).toBe(0);
    }
  });

  it("always gives the band its three rows, however flat the journey", () => {
    // A flat line in a three-level band says "nothing was learned about how
    // this felt". Collapsing it would make two journeys in one document
    // impossible to compare.
    const flat = measureJourney(model([stage("A"), stage("B")]));
    const varied = measureJourney(model([stage("A", "happy"), stage("B", "frustrated")]));
    expect(flat.h).toBe(varied.h);
    expect(out(src("@journey", "  stage A", "  stage B")).html).toContain(
      `viewBox="0 0 2 ${JOURNEY.bandRows}"`,
    );
  });

  it("fits seven stages on a portrait page and says what to do past that", () => {
    const seven = src("@journey", ...Array.from({ length: 7 }, (_, i) => `  stage S${i}`));
    expect(out(seven).diagnostics).toEqual([]);

    // Ten still fits a landscape page, so it moves rather than shrinking.
    const ten = src("@journey", ...Array.from({ length: 10 }, (_, i) => `  stage S${i}`));
    const info = out(ten).diagnostics[0]!;
    expect(info.severity).toBe("info");
    expect(info.message).toContain("dir=vertical");

    // Past even that it is scaled, and the advice comes with it.
    const sixteen = src("@journey", ...Array.from({ length: 16 }, (_, i) => `  stage S${i}`));
    const warn = out(sixteen).diagnostics[0]!;
    expect(warn.severity).toBe("warning");
    expect(warn.message).toContain("dir=vertical");
  });

  it("measures the tallest name and the tallest stack of items per lane", () => {
    const m = measureJourney(
      model([stage("A", "neutral", ["one", "two", "three"]), stage("B", "neutral", ["one"])]),
    );
    expect(m.tracks[0]!.items).toBe(3);
    expect(m.tracks[0]!.name).toBe(1);
  });
});

describe("the vertical form", () => {
  const VERT = src("@journey(dir=vertical)", "  stage Discover feeling=happy", "  stage Install");

  it("is never measured or scaled — it wraps like prose", () => {
    const html = out(VERT).html;
    expect(html).toContain('data-dir="vertical"');
    expect(html).not.toContain("--jot-w");
    expect(html).not.toContain("data-fill");
  });

  it("drops the band and carries the feeling on the mark instead", () => {
    // A rail can say which stage went wrong; it cannot draw a curve.
    const html = out(VERT).html;
    expect(html).not.toContain("<svg");
    expect(html).toContain('data-feeling="happy"');
  });
});

describe("a journey on ruled paper", () => {
  it("clears the ruling across its whole row, like every figure", () => {
    expect(out(FOUR).html).toContain('class="jot-figure" data-figure="journey"');
    expect(renderLayoutCss()).toContain(
      '[data-mode="notebook"] .jot-body:has(> .jot-figure) { background-image: none; }',
    );
  });

  it("hands the lane the counts the renderer measured", () => {
    expect(out(FOUR).html).toMatch(/--jot-j-n:4;--jot-j-name:\d+;--jot-j-items:\d+/);
  });

  it("lets the stage's three parts land in three rows of the lane's grid", () => {
    // display: contents — the stage is a wrapper for authoring, not layout.
    expect(renderLayoutCss()).toContain(".jot-journey-stage { display: contents; }");
    expect(out(FOUR).html).toMatch(/class="jot-journey-name" style="grid-column:1"/);
  });
});

describe("a parameter written outside its brackets", () => {
  it("is caught, because it reads as the block's text and looks fine", () => {
    // `@journey(dir=vertical) title="Onboarding"` gives a block whose title is
    // the literal characters `title="Onboarding"`. Correct, and useless.
    const { diagnostics, html } = out(
      src('@journey(dir=vertical) title="Onboarding"', "  stage Discover"),
    );
    const warn = diagnostics.find((d) => d.message.includes("written after the brackets"));
    expect(warn?.severity).toBe("warning");
    expect(warn?.message).toContain('title="Onboarding"');
    // Nothing is dropped — it is drawn as the nonsense title it parsed as,
    // which is what makes the warning the only way to notice.
    expect(html).toContain("Onboarding");
    expect(html).toContain("jot-journey-title");
  });

  it("leaves an ordinary title alone", () => {
    expect(out(src("@journey Onboarding", "  stage Discover")).diagnostics).toEqual([]);
  });

  it("leaves a word that is not a parameter of this block alone", () => {
    expect(out(src("@journey", "  stage Discover")).diagnostics).toEqual([]);
    expect(out(src("@journey banana=yes", "  stage Discover")).diagnostics).toHaveLength(1);
  });
});
