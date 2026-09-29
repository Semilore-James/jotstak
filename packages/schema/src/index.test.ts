// Invariants the rest of Jotstak relies on. The LSP, the docs generator and the
// renderer all look primitives up by name, so collisions here become silent bugs
// everywhere else.

import { describe, expect, it } from "vitest";
import {
  PRIMITIVES,
  SUGGESTED_ICONS,
  UNIVERSAL_PARAMS,
  canHold,
  containers,
  getAllParams,
  getPrimitive,
} from "./index.js";

describe("primitive names", () => {
  it("are unique", () => {
    const names = PRIMITIVES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("have aliases that collide with no name or other alias", () => {
    const taken = new Set(PRIMITIVES.map((p) => p.name));
    for (const p of PRIMITIVES) {
      for (const alias of p.aliases ?? []) {
        expect(taken.has(alias), `alias "${alias}" on @${p.name}`).toBe(false);
        taken.add(alias);
      }
    }
  });

  it("all resolve through getPrimitive, including aliases", () => {
    for (const p of PRIMITIVES) {
      expect(getPrimitive(p.name)?.name).toBe(p.name);
      for (const alias of p.aliases ?? []) {
        expect(getPrimitive(alias)?.name).toBe(p.name);
      }
    }
  });
});

describe("params", () => {
  it("never redefine a universal param (getAllParams would list it twice)", () => {
    const universal = new Set(UNIVERSAL_PARAMS.map((u) => u.name));
    for (const p of PRIMITIVES) {
      for (const param of p.params) {
        expect(universal.has(param.name), `@${p.name} redefines universal "${param.name}"`).toBe(false);
      }
    }
  });

  it("are unique within each primitive once universals are merged", () => {
    for (const p of PRIMITIVES) {
      const names = getAllParams(p.name).map((x) => x.name);
      expect(new Set(names).size, `@${p.name}`).toBe(names.length);
    }
  });

  it("use a default that is one of their enum values", () => {
    for (const param of [...PRIMITIVES.flatMap((p) => p.params), ...UNIVERSAL_PARAMS]) {
      if (param.type === "enum" && param.default !== undefined) {
        expect(param.enumValues, `"${param.name}" default`).toContain(param.default);
      }
    }
  });
});

describe("the composition matrix", () => {
  it("never claims a block with no body can hold one", () => {
    for (const p of PRIMITIVES) {
      if (p.bodyShape === "none") expect(p.holds, `@${p.name}`).toBe("text");
    }
  });

  it("is one rule: the parent holds blocks and the child nests", () => {
    expect(canHold("panel", "tree")).toBe(true);
    expect(canHold("tree", "metric")).toBe(true); // drawn below it
    expect(canHold("quote", "tree")).toBe(false); // a quote holds text
    expect(canHold("panel", "note")).toBe(false); // a note belongs to the page
    expect(canHold("warn", "table")).toBe(true); // aliases resolve
    expect(canHold("panel", "nonsense")).toBe(false);
  });

  it("offers a container for anything that nests", () => {
    // Every "can't go here" message points somewhere, so somewhere has to exist.
    expect(containers().map((p) => p.name)).toContain("panel");
    expect(PRIMITIVES.filter((p) => p.nests).every((c) => canHold("panel", c.name))).toBe(true);
  });
});

describe("suggested icons", () => {
  it("only reference primitives that exist", () => {
    for (const key of Object.keys(SUGGESTED_ICONS)) {
      expect(getPrimitive(key), `SUGGESTED_ICONS["${key}"]`).toBeDefined();
    }
  });
});

describe("documentation", () => {
  it("gives every primitive a summary and at least one example", () => {
    for (const p of PRIMITIVES) {
      expect(p.summary.length, `@${p.name} summary`).toBeGreaterThan(0);
      expect(p.examples.length, `@${p.name} examples`).toBeGreaterThan(0);
    }
  });
});
