// @timeline — events on a line, and the arithmetic that keeps them off
// each other.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";
import { cardRows, measureTimeline, readEvent, reach, sides, TIMELINE } from "./timeline.js";
import type { Side, TimelineModel } from "./timeline.js";
import { PAGE } from "./page.js";

const src = (...lines: string[]): string => lines.join("\n");
const out = (s: string) => render(s, { mode: "notebook" });

const FOUR = src(
  "@timeline",
  "  Q3 2026: Discovery",
  "  Oct 2026: Alpha",
  "  Dec 2026: Beta",
  "  Q1 2027: Launch",
);

const model = (events: { date?: string; label?: string; detail?: string[]; pinned?: Side | null }[], over: Partial<TimelineModel> = {}): TimelineModel => ({
  events: events.map((e) => ({ date: e.date ?? "", label: e.label ?? "", detail: e.detail ?? [], pinned: e.pinned ?? null })),
  title: "",
  vertical: false,
  alternate: true,
  ...over,
});

describe("reading an event", () => {
  it.each([
    ["Q3 2026: Discovery", { date: "Q3 2026", label: "Discovery", pinned: null }],
    ["Dec 2026: Beta above", { date: "Dec 2026", label: "Beta", pinned: "above" }],
    ["Q1 2027: Launch BELOW", { date: "Q1 2027", label: "Launch", pinned: "below" }],
    ["Kickoff", { date: "", label: "Kickoff", pinned: null }],
  ])("%s", (text, want) => {
    expect(readEvent(text)).toEqual(want);
  });

  it("does not mistake a long sentence for a date", () => {
    // A colon 40 characters in is punctuation, not a date.
    const long = "One thing we learned that quarter was this: people search";
    expect(readEvent(long).date).toBe("");
    expect(readEvent(long).label).toBe(long);
  });
});

describe("which side each event falls on", () => {
  it("alternates from the top", () => {
    expect(sides(model([{}, {}, {}, {}]))).toEqual(["above", "below", "above", "below"]);
  });

  it("re-phases from a pinned side rather than doubling up", () => {
    // Pinning the second event `above` must flip the third too, or two events
    // end up side by side on the same side of the line.
    expect(sides(model([{}, { pinned: "above" }, {}, {}]))).toEqual([
      "above", "above", "below", "above",
    ]);
  });

  it("puts everything under the line when alternation is off", () => {
    expect(sides(model([{}, {}, {}], { alternate: false }))).toEqual(["below", "below", "below"]);
  });
});

describe("how far a card may reach", () => {
  const alt: Side[] = ["above", "below", "above", "below", "above", "below"];

  it("gives a card in the middle two columns — the whole point of alternating", () => {
    // Its nearest same-side neighbour is two events away, so each may reach
    // two sub-columns and their cards meet exactly halfway.
    expect(reach(2, alt)).toBe(2);
    expect(reach(3, alt)).toBe(2);
  });

  it("gives the two at the ends one column, so they stay over their own dot", () => {
    // Centred on its dot is the constraint. A card clamped at the page edge
    // instead sits half a column to the inside of the mark it belongs to.
    expect(reach(0, alt)).toBe(1);
    expect(reach(alt.length - 1, alt)).toBe(1);
  });

  it("shrinks when a pinned side puts two events together", () => {
    const pinned: Side[] = ["above", "above", "below", "below"];
    // 0 and 1 are adjacent and on the same side: one column each, or they
    // would run straight through each other.
    expect(reach(1, pinned)).toBe(1);
    expect(reach(2, pinned)).toBe(1);
  });

  it("is one column each when nothing alternates", () => {
    const flat: Side[] = ["below", "below", "below", "below"];
    for (let i = 0; i < flat.length; i++) expect(reach(i, flat)).toBe(1);
  });

  it("never lets two cards overlap, whatever the sides", () => {
    const shapes: Side[][] = [
      ["above", "below", "above", "below", "above"],
      ["above", "above", "below", "above", "below"],
      ["below", "below", "below"],
      ["above"],
    ];
    for (const side of shapes) {
      const span = side.map((_, i) => {
        const dot = 2 * i + 2;
        const r = reach(i, side);
        return { side: side[i]!, start: dot - r, end: dot + r };
      });
      for (let i = 0; i < span.length; i++) {
        for (let j = i + 1; j < span.length; j++) {
          if (span[i]!.side !== span[j]!.side) continue;
          expect(span[i]!.end, `cards ${i} and ${j} overlap`).toBeLessThanOrEqual(span[j]!.start);
        }
      }
      // And nothing runs off the plot.
      for (const s of span) {
        expect(s.start).toBeGreaterThanOrEqual(1);
        expect(s.end).toBeLessThanOrEqual(2 * side.length + 1);
      }
    }
  });
});

describe("how much page a timeline takes", () => {
  it("spans the printable width, margin to margin", () => {
    // Not the text column: a timeline is a plate, like a matrix. Measuring the
    // columns at their natural width while the browser drew them at the full
    // width predicted a row of card more than was drawn, every time.
    expect(measureTimeline(model([{ date: "Q3" }, { date: "Q4" }])).w).toBe(PAGE.portrait.content);
    expect(out(FOUR).html).toContain('data-width="full"');
    expect(out(FOUR).html).toContain("data-fill");
  });

  it("takes exactly the room it is given, with no rounding over the edge", () => {
    expect(out(FOUR).diagnostics).toEqual([]);
  });

  it("is a whole number of rows tall", () => {
    for (const n of [1, 2, 5, 7]) {
      const m = model(Array.from({ length: n }, (_, i) => ({ date: `M${i}`, label: "Something" })));
      expect(measureTimeline(m).h % TIMELINE.row).toBe(0);
    }
  });

  it("measures each card at its own width, since the end ones are narrower", () => {
    // An end card gets one column, so the same detail wraps sooner there. The
    // height has to come from the widest card on each side, not from a single
    // assumed width.
    // The same detail on the same side of the same four-event timeline: once
    // on the first event (an end, one column) and once on the third (the
    // middle, two columns). The end card has to be taller.
    const detail = ["Interviews, synthesis and a round of personas"];
    const four = (at: number) =>
      measureTimeline(
        model(
          ["Q3", "Q4", "Q1", "Q2"].map((date, i) => ({
            date,
            label: "Discovery",
            detail: i === at ? detail : [],
          })),
        ),
      );
    expect(four(0).above).toBeGreaterThan(four(2).above);
  });

  it("gives seven events a portrait page and ten a landscape one", () => {
    const seven = src("@timeline", ...["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((m) => `  ${m}: Step`));
    expect(out(seven).diagnostics).toEqual([]);

    const ten = src(
      "@timeline",
      ...["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"].map((m) => `  ${m}: Step`),
    );
    const info = out(ten).diagnostics[0]!;
    expect(info.severity).toBe("info");
    expect(info.message).toContain("landscape");
    // And it says what to do about it rather than only what it did.
    expect(info.message).toContain("dir=vertical");
  });

  it("counts a card's rows from its date, label and every line of detail", () => {
    const e = { date: "Q3 2026", label: "Discovery", detail: ["one", "two"], pinned: null };
    expect(cardRows(e, 400)).toBe(4);
    expect(cardRows({ ...e, date: "" }, 400)).toBe(3);
    expect(cardRows({ date: "", label: "", detail: [], pinned: null }, 400)).toBe(1);
  });
});

describe("the vertical form", () => {
  const VERT = src("@timeline(dir=vertical)", "  Q3 2026: Discovery", "  Oct 2026: Alpha");

  it("is never measured or scaled — it wraps like prose", () => {
    const html = out(VERT).html;
    expect(html).toContain('data-dir="vertical"');
    // No natural size means --u resolves to 1px and the figure sizes itself,
    // which is how a figure opts out of the fit machinery entirely.
    expect(html).not.toContain("--jot-w");
    expect(html).not.toContain("data-fill");
    expect(measureTimeline(model([{ date: "Q3" }], { vertical: true })).w).toBe(0);
  });

  it("draws the rail in segments so it ends on the last dot", () => {
    // One line down the whole list ended level with the bottom of the last
    // event's detail, hanging past the final mark as though it were cut off.
    const css = renderLayoutCss();
    expect(css).toContain('.jot-timeline[data-dir="vertical"] .jot-timeline-event::before');
    expect(css).toContain('.jot-timeline[data-dir="vertical"] .jot-timeline-event:last-child::before { display: none; }');
  });

  it("says so when an event names a side it cannot have", () => {
    const { diagnostics } = out(src("@timeline(dir=vertical)", "  Q3 2026: Discovery above"));
    expect(diagnostics[0]!.severity).toBe("info");
    expect(diagnostics[0]!.message).toContain("does not have");
  });
});

describe("a timeline on ruled paper", () => {
  it("clears the ruling across its whole row, like every figure", () => {
    expect(out(FOUR).html).toContain('class="jot-figure" data-figure="timeline"');
    expect(renderLayoutCss()).toContain(
      '[data-mode="notebook"] .jot-body:has(> .jot-figure) { background-image: none; }',
    );
  });

  it("hands the grid the counts the renderer measured", () => {
    const html = out(FOUR).html;
    expect(html).toMatch(/--jot-tl-n:4;--jot-tl-above:\d+;--jot-tl-below:\d+/);
    const css = renderLayoutCss();
    expect(css).toContain("grid-template-columns: repeat(calc(var(--jot-tl-n) * 2), 1fr);");
  });

  it("says so when there is nothing to draw", () => {
    const { diagnostics } = out("@timeline");
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.message).toContain("no events");
  });
});

describe("a forced break inside a label", () => {
  // A backslash-n is the escape for the places Enter cannot reach: a diagram
  // label is one line of source by construction, the same as a table row.
  const height = (html: string): number => Number(/--jot-h:(\d+)/.exec(html)![1]);

  it("draws the break in a date, a label and a detail line", () => {
    const html = out(src("@timeline", "  Q3 2026: Alpha\\n release", "    first\\n second")).html;
    expect(html).toContain("Alpha<br>release");
    expect(html).toContain("first<br>second");
  });

  it("counts the break when measuring, so the figure is tall enough", () => {
    // Drawing a break the measurement did not count is exactly the drift that
    // left a figure a row short of its own contents.
    const one = out(src("@timeline", "  Q3: Alpha", "  Q4: Beta")).html;
    const two = out(src("@timeline", "  Q3: Alpha\\n release", "  Q4: Beta")).html;
    expect(height(two)).toBeGreaterThan(height(one));
    expect(height(two) % TIMELINE.row).toBe(0);
  });

  it("measures the date at its widest line, since a date never wraps", () => {
    const wide = out(src("@timeline", "  Q3 2026 and more: A", "  Q4: B")).html;
    const broken = out(src("@timeline", "  Q3 2026\\n and more: A", "  Q4: B")).html;
    expect(height(broken)).toBeGreaterThanOrEqual(height(wide));
  });

  it("leaves a label with no break alone", () => {
    expect(out(src("@timeline", "  Q3 2026: Alpha")).html).not.toContain("<br>");
  });
});
