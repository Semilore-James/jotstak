// @star_model — one thing in the middle, the things that describe it around it.

import { describe, expect, it } from "vitest";
import { render, renderLayoutCss } from "./index.js";
import { STAR, angleOf, fieldFor, linkedDim, measureStar, readDim } from "./star.js";
import type { Dim, StarModel } from "./star.js";
import { PAGE } from "./page.js";

const src = (...lines: string[]): string => lines.join("\n");
const out = (s: string) => render(s, { mode: "notebook" });
const at = { line: 0, column: 0 };

const FOUR = src(
  "@star_model Telemetry warehouse",
  "  fact: TaskExecutionEvents",
  "  dim Agents at 12",
  "  dim Models at 3",
  "  dim LatencyBuckets at 6",
  "  dim CostCenters at 9",
);

const model = (dims: string[], over: Partial<StarModel> = {}): StarModel => ({
  title: "",
  fact: "Orders",
  fields: [],
  dims: dims.map((label) => ({ label, clock: null })),
  list: false,
  ...over,
});

describe("reading a dimension", () => {
  it.each([
    ["Agents at 12", "Agents", 12],
    ["Models at 3", "Models", 3],
    ["Costs at bottom-left", "Costs", 7.5],
    ["Dates at right", "Dates", 3],
    ["Stores at NW", "Stores", 10.5],
  ])("%s", (text, label, clock) => {
    expect(readDim(text, [], at)).toEqual({ label, clock });
  });

  it("keeps the whole line when the position is not one", () => {
    // "at" is an ordinary word; only a real position takes it.
    expect(readDim("Things we look at", [], at)).toEqual({
      label: "Things we look at",
      clock: null,
    });
  });

  it("says so when a position is named but nonsense, and keeps the dimension", () => {
    const diagnostics: import("./index.js").Diagnostic[] = [];
    const dim = readDim("Agents at sideways", diagnostics, at);
    expect(dim.clock).toBeNull();
    expect(dim.label).toContain("Agents");
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.message).toContain("clock face");
  });
});

describe("where each dimension goes", () => {
  it("puts 12 o'clock straight up and 3 o'clock to the right", () => {
    const up = angleOf({ label: "", clock: 12 }, 0, 4);
    const right = angleOf({ label: "", clock: 3 }, 0, 4);
    expect(Math.cos(up)).toBeCloseTo(0);
    expect(Math.sin(up)).toBeCloseTo(-1);
    expect(Math.cos(right)).toBeCloseTo(1);
    expect(Math.sin(right)).toBeCloseTo(0);
  });

  it("spreads unplaced dimensions evenly, clockwise from 12, in written order", () => {
    const dims: Dim[] = Array.from({ length: 4 }, () => ({ label: "", clock: null }));
    const angles = dims.map((d, i) => angleOf(d, i, 4));
    expect(angles[0]).toBeCloseTo(-Math.PI / 2);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]! - angles[i - 1]!).toBeCloseTo(Math.PI / 2);
    }
  });
});

describe("what a star model does with what it is given", () => {
  it("draws a fact in the middle and a dimension per line", () => {
    const html = out(FOUR).html;
    expect(html).toContain("TaskExecutionEvents");
    expect((html.match(/jot-star-dim/g) ?? []).length).toBe(4);
    expect(out(FOUR).diagnostics).toEqual([]);
  });

  it("takes the terse form when placement does not matter", () => {
    const html = out(src("@star_model", "  fact: Orders", "  dim: Customer, Product, Date")).html;
    for (const d of ["Customer", "Product", "Date"]) expect(html).toContain(d);
    expect((html.match(/jot-star-dim/g) ?? []).length).toBe(3);
  });

  it("puts a fact's fields inside it", () => {
    const html = out(
      src("@star_model", "  fact: Orders", "    order_id: uuid, pk", "  dim Customer"),
    ).html;
    expect(html).toContain('class="jot-star-field"');
    expect(html).toContain("order_id: uuid, pk");
  });

  it("joins the boxes edge to edge, never centre to centre", () => {
    // A connector drawn between centres runs underneath both labels.
    const html = out(FOUR).html;
    const lines = [...html.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)];
    expect(lines).toHaveLength(4);
    for (const [, x1, y1, x2, y2] of lines) {
      expect(Number(x1) === Number(x2) && Number(y1) === Number(y2)).toBe(false);
    }
    expect(html).toContain('vector-effect="non-scaling-stroke"');
  });

  it("says so when there is no centre, or nothing around it", () => {
    expect(out(src("@star_model", "  dim Customer")).diagnostics[0]!.message).toContain("no centre");
    expect(out(src("@star_model", "  fact: Orders")).diagnostics[0]!.message).toContain(
      "no dimensions",
    );
  });

  it("points at the keyword when a line is not a dimension", () => {
    const { diagnostics, html } = out(src("@star_model", "  fact: Orders", "  Customer"));
    expect(diagnostics[0]!.message).toContain("dim Customer");
    expect(html).toContain("Customer");
  });
});

describe("how much page a star model takes", () => {
  it("spans the printable width, like every other plate", () => {
    expect(measureStar(model(["A", "B", "C", "D"])).w).toBe(PAGE.portrait.content);
    expect(out(FOUR).html).toContain('data-width="full"');
  });

  it("is a whole number of rows tall, with or without a title", () => {
    for (const title of ["", "Telemetry"]) {
      for (const n of [1, 4, 7, 12]) {
        const m = measureStar(model(Array.from({ length: n }, (_, i) => `Dim ${i}`), { title }));
        expect(m.h % STAR.row, `${n} dims, title "${title}"`).toBe(0);
      }
    }
  });

  it("counts the title as a row of the figure but not of the plot", () => {
    const bare = measureStar(model(["A", "B"]));
    const titled = measureStar(model(["A", "B"], { title: "Telemetry" }));
    expect(titled.h - bare.h).toBe(STAR.row);
    expect(titled.plotH).toBe(bare.plotH);
  });

  it("grows until nothing collides, rather than trusting a fixed radius", () => {
    // A radius that looks right for four dimensions stacks nine on top of each
    // other. The ellipse is sized from the content, which is what a renderer
    // that measures text is for.
    const boxes = (n: number) => {
      const m = measureStar(model(Array.from({ length: n }, (_, i) => `Dimension ${i}`)));
      return [{ ...m.fact }, ...m.dims];
    };
    for (const n of [4, 7, 9, 12]) {
      const all = boxes(n);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i]!;
          const b = all[j]!;
          const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(hit, `${n} dims: boxes ${i} and ${j} overlap`).toBe(false);
        }
      }
    }
  });

  it("grows taller as it takes more dimensions", () => {
    expect(measureStar(model(["A", "B", "C", "D", "E", "F", "G", "H", "I"])).h).toBeGreaterThanOrEqual(
      measureStar(model(["A", "B"])).h,
    );
  });
});

describe("layout=list", () => {
  const LIST = src("@star_model(layout=list)", "  fact: Orders", "  dim: Customer, Product");

  it("is a real second form, never measured or scaled", () => {
    const html = out(LIST).html;
    expect(html).toContain('data-layout="list"');
    expect(html).not.toContain("--jot-w");
    expect(html).not.toContain("<svg");
  });

  it("keeps whole rows, since an unsized figure has to hold its own phase", () => {
    // 14px of gap here put the figure 12.54 rows tall and every line after it
    // landed off the rule. An unsized figure is only in phase when every part
    // of it is a whole number of rows.
    const css = renderLayoutCss().replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = css.split("}").find((r) => r.includes(".jot-star-list {"))!;
    const margin = /margin:\s*(\d+)px/.exec(rule);
    expect(Number(margin![1]) % STAR.row).toBe(0);
    // An inline-block sits on the text baseline and reserves descender space
    // under it, which cost another pixel on top of that.
    const fact = css.split("}").find((r) => r.includes('[data-layout="list"] .jot-star-fact'))!;
    expect(fact).toContain("width: fit-content");
    expect(fact).not.toContain("inline-block");
  });
});

describe("a star model on ruled paper", () => {
  it("clears the ruling across its whole row, like every figure", () => {
    expect(out(FOUR).html).toContain('class="jot-figure" data-figure="star_model"');
    expect(renderLayoutCss()).toContain(
      '[data-mode="notebook"] .jot-body:has(> .jot-figure) { background-image: none; }',
    );
  });

  it("scales the whole arrangement together when it has less room", () => {
    // Positions are written as inline styles already multiplied by --u, so the
    // boxes and the lines between them shrink as one thing.
    expect(out(FOUR).html).toMatch(/left:calc\([\d.-]+ \* var\(--u, 1px\)\)/);
  });
});

// ── A field that names a dimension is a join ─────────────────────────────
//
// "This looks like a worse tree." It did, and the reason was that every
// connector left the fact from the same middle point, so four dimensions came
// out as a cross — a shape carrying no more information than a tree does.
//
// A star schema's whole content is which fact column joins which dimension,
// and people already write it: `invoice_id: fk -> Invoices`. That arrow was
// rendered as text and nothing else. Reading it lets each link leave the row
// it belongs to, which is the thing a tree cannot do.

describe("a fact field that names a dimension", () => {
  const src = (...lines: string[]): string => lines.join("\n");
  const SCHEMA = src(
    "@star_model",
    "  fact: InvoiceEvents",
    "    invoice_id: fk -> Invoices",
    "    client_id: fk -> Clients",
    "    amount: decimal",
    "  dim Invoices at 3",
    "  dim Clients at 12",
    "  dim Plans at 9",
  );

  it("reads the arrow people already write", () => {
    expect(linkedDim("invoice_id: fk -> Invoices")).toBe("Invoices");
    expect(linkedDim("x: fk → Dates")).toBe("Dates");
    expect(linkedDim("amount: decimal")).toBeNull();
    expect(linkedDim("status: text")).toBeNull();
  });

  it("matches a dimension by name, whatever the case", () => {
    const fields = ["invoice_id: fk -> invoices", "amount: decimal"];
    expect(fieldFor(fields, "Invoices")).toBe(0);
    expect(fieldFor(fields, "Plans")).toBe(-1);
  });

  it("marks the rows that are joins and leaves the columns alone", () => {
    const html = render(SCHEMA, { mode: "notebook" }).html;
    expect(html).toMatch(/class="jot-star-field" data-linked>invoice_id/);
    expect(html).toMatch(/class="jot-star-field" data-linked>client_id/);
    expect(html).toMatch(/class="jot-star-field">amount/);
  });

  it("leaves a side dimension's line from its own field's row", () => {
    // The fact's first row is its name, so invoice_id is row 1 and its line
    // starts half a row into it. Anything else would put the line next to a
    // field it is not about.
    const html = render(SCHEMA, { mode: "notebook" }).html;
    const linked = [...html.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)"[^>]*data-linked/g)];
    expect(linked.length).toBeGreaterThan(0);
    const ys = linked.map((m) => Number(m[2]));
    // Row 1 of the fact, centred: a whole number of rows plus half of one.
    expect(ys.some((y) => (y - STAR.row / 2) % STAR.row === 0)).toBe(true);
  });

  it("does not use a field row for a dimension directly above or below", () => {
    // A field row is a horizontal anchor. For a dimension sitting over the
    // fact it sent the line out of a SIDE edge and back across the fact's own
    // corner — a longer, uglier route to say the same thing.
    const html = render(SCHEMA, { mode: "notebook" }).html;
    // Clients is at 12 o'clock and named by client_id, so it is marked as a
    // join but still attaches at the top edge.
    expect(html).toContain("data-linked");
    const lines = [...html.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)];
    const vertical = lines.filter((m) => m[1] === m[3]);
    expect(vertical.length, "the dimension above should hang straight down").toBeGreaterThan(0);
  });

  it("changes nothing for a star with no arrows in it", () => {
    const plain = src("@star_model", "  fact: Orders", "  dim Customer at 3", "  dim Date at 9");
    expect(render(plain, { mode: "notebook" }).html).not.toContain("data-linked");
  });
});
