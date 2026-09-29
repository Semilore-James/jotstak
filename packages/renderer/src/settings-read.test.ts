// Every setting the schema offers has to DO something.
//
// Found while streamlining the docs: all four of @note's settings, four of
// @page's and @persona's `image` were documented, offered by autocomplete and
// rendered as examples on the website — and read by nothing. The same fault
// ENG-34 fixed for `icon`, eleven more times. A setting that silently does
// nothing sends people looking for their own mistake.
//
// So every setting not marked `planned` is set, value by value, on a real
// example, and at least one value has to change the page. One that changes
// nothing is either not built — mark it planned — or listed below with why.

import { describe, expect, it } from "vitest";
import { PRIMITIVES, UNIVERSAL_PARAMS } from "@jotstak/schema";
import type { ParamSpec, PrimitiveSpec } from "@jotstak/schema";
import { render } from "./index.js";

/** Settings whose effect a plain example cannot show, and why that is fine. */
const QUIET: Record<string, string> = {
  // `auto` already picks the width a small example needs; pinning another only
  // shows on a figure that does not fit, which a unit example does not have.
  "table.width": "only changes a table that would otherwise escalate",
  // An id is an anchor for a box. These four have no box of their own to put
  // one on: page setup renders nothing, a note belongs to the block beside
  // it, the metadata row is chips, and a divider is a rule.
  "page.id": "renders nothing to anchor",
  "note.id": "belongs to its block",
  "meta.id": "a row of chips",
  "divider.id": "a rule",
  // Kept in the source and read by nobody yet. Three samples use it, so it is
  // not marked planned (every playground visitor would get a note about it);
  // whether the card should show it is an open decision (UX-67).
  "decision.date": "shown nowhere yet: UX-67",
};

/** A value in the shape a setting expects, where any string will not do. */
const SAMPLE: Record<string, string> = {
  "table.align": "right,left,left",
  "columns.ratio": "1:3",
};

/** Where the example alone gives a setting nothing to act on. */
const SOURCE: Record<string, string> = {
  // breaks= changes how the prose after it is read, and the example has none.
  page: "@page breaks=on\n\nOne line\nand the line after it.",
};

function source(spec: PrimitiveSpec): string | undefined {
  return SOURCE[spec.name] ?? spec.examples.find((e) => e.startsWith(`@${spec.name}`));
}

/** The example with `name=value` written on its opening line. */
function withSetting(src: string, spec: PrimitiveSpec, name: string, value: string): string {
  const [head, ...rest] = src.split("\n");
  const without = head!.replace(new RegExp(`\\b${name}=("[^"]*"|\\S+)`), "").replace(/\(\s*\)/, "");
  const open = `@${spec.name}`;
  const after = without.slice(open.length);
  const written = /\s/.test(value) ? `"${value}"` : value;
  const line = after.startsWith("(")
    ? `${open}(${name}=${written} ${after.slice(1)}`
    : `${open} ${name}=${written}${after}`;
  return [line, ...rest].join("\n");
}

function tries(p: ParamSpec): string[] {
  if (p.type === "enum") return p.enumValues ?? [];
  if (p.type === "boolean") return ["true", "false"];
  if (p.type === "number") return ["3", "40"];
  return ["Quite distinct words"];
}

describe("every setting the schema offers does something", () => {
  const cases = PRIMITIVES.filter((p) => !p.planned && source(p)).flatMap((spec) =>
    [...spec.params, ...UNIVERSAL_PARAMS]
      .filter((p) => !p.planned && !QUIET[`${spec.name}.${p.name}`])
      // The universal ones are checked where they are read: id everywhere,
      // width on the figures (and the tables and covers) that honour it.
      .filter((p) => !UNIVERSAL_PARAMS.includes(p) || p.name === "id")
      .map((p) => [spec.name, p.name, spec, p] as const),
  );

  it.each(cases)("@%s %s=", (_s, _p, spec, p) => {
    const src = source(spec)!;
    const values = SAMPLE[`${spec.name}.${p.name}`] ? [SAMPLE[`${spec.name}.${p.name}`]!] : tries(p);
    const pages = new Set(
      values.map((v) => render(withSetting(src, spec, p.name, v), { mode: "notebook" }).html),
    );
    // The example as written, and the example with the setting taken out.
    pages.add(render(src, { mode: "notebook" }).html);
    pages.add(render(withSetting(src, spec, p.name, "").replace(new RegExp(` ${p.name}=\\S*`), ""), { mode: "notebook" }).html);
    expect(pages.size, `every value of ${p.name} on @${spec.name} renders the same page`).toBeGreaterThan(1);
  });
});
