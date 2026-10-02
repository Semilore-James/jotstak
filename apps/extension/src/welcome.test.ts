// The first five minutes (PRD-24): the welcome document, the first-run rule,
// and the step-by-step guide on VS Code's Get Started page.
//
// The guide lives in package.json, where nothing checks it: a step that names
// a command nobody registered, or an image that was never packaged, shows up
// only as a dead button on the first screen a new user ever sees.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { render } from "@jotstak/renderer";
import * as vscode from "vscode";

vi.mock("./preview.js", () => ({ JotPreview: { show: vi.fn() } }));

import { JotPreview } from "./preview.js";
import { WALKTHROUGH, WELCOMED, openWalkthrough, openWelcome, welcomeOnFirstRun, welcomeText } from "./welcome.js";

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const manifest = JSON.parse(readFileSync(here("../package.json"), "utf8"));

/** Just enough of an ExtensionContext: a memory for globalState, and an id. */
function context() {
  const memory = new Map<string, unknown>();
  return {
    globalState: {
      get: <T>(key: string) => memory.get(key) as T | undefined,
      update: async (key: string, value: unknown) => void memory.set(key, value),
    },
    extension: { id: "semilore-james.jotstak" },
  } as unknown as Parameters<typeof openWelcome>[0];
}

beforeEach(() => {
  (vscode.window as unknown as { shown: unknown[] }).shown.length = 0;
  (vscode.commands as unknown as { ran: unknown[] }).ran.length = 0;
  vi.mocked(JotPreview.show).mockClear();
});

describe("the welcome document", () => {
  it("is samples/welcome.jot, the same file the playground's Start here sample reads", () => {
    expect(welcomeText()).toBe(readFileSync(here("../../../samples/welcome.jot"), "utf8"));
  });

  it("renders with nothing to warn about, since it is the first page anyone sees", () => {
    const { diagnostics } = render(welcomeText(), { mode: "notebook" });
    expect(diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("walks through six steps", () => {
    const steps = welcomeText().match(/^## \d\. /gm) ?? [];
    expect(steps).toHaveLength(6);
  });

  it("opens as an unsaved copy, with its page beside it", async () => {
    await openWelcome(context());
    const shown = (vscode.window as unknown as { shown: { languageId: string; getText(): string }[] }).shown;
    expect(shown).toHaveLength(1);
    expect(shown[0]!.languageId).toBe("jot");
    expect(shown[0]!.getText()).toBe(welcomeText());
    expect(JotPreview.show).toHaveBeenCalledTimes(1);
  });
});

describe("the first run", () => {
  it("opens the welcome document once, and never again by itself", async () => {
    const ctx = context();
    expect(await welcomeOnFirstRun(ctx)).toBe(true);
    expect(ctx.globalState.get(WELCOMED)).toBe(true);
    expect(await welcomeOnFirstRun(ctx)).toBe(false);
    expect(JotPreview.show).toHaveBeenCalledTimes(1);
  });

  it("can run before any .jot file exists, which is what a fresh install looks like", () => {
    expect(manifest.activationEvents).toContain("onStartupFinished");
  });
});

describe("the step-by-step guide", () => {
  const guide = manifest.contributes.walkthroughs.find((w: { id: string }) => w.id === WALKTHROUGH);
  const registered = new Set(manifest.contributes.commands.map((c: { command: string }) => c.command));
  // Commands VS Code itself provides, which a step may also call.
  const builtIn = new Set(["editor.action.triggerSuggest"]);

  it("exists, and Learn the Syntax opens it", async () => {
    expect(guide).toBeDefined();
    await openWalkthrough(context());
    expect((vscode.commands as unknown as { ran: unknown[][] }).ran[0]).toEqual([
      "workbench.action.openWalkthrough",
      `semilore-james.jotstak#${WALKTHROUGH}`,
      false,
    ]);
  });

  it("points every button at a command that exists", () => {
    for (const step of guide.steps) {
      for (const [, command] of step.description.matchAll(/\(command:([\w.]+)\)/g)) {
        expect(registered.has(command) || builtIn.has(command), `${step.id}: ${command}`).toBe(true);
      }
      for (const event of step.completionEvents ?? []) {
        const command = /^onCommand:(.+)$/.exec(event)?.[1];
        if (command) expect(registered.has(command) || builtIn.has(command), `${step.id}: ${event}`).toBe(true);
      }
    }
  });

  it("ships every picture and page it shows", () => {
    for (const step of guide.steps) {
      const media = step.media.image ?? step.media.markdown ?? step.media.svg;
      expect(existsSync(here(`../${media}`)), `${step.id}: ${media}`).toBe(true);
      if (step.media.image) expect(step.media.altText, `${step.id} has no alt text`).toBeTruthy();
    }
  });

  it("registers the command that opens the welcome document", () => {
    expect(registered.has("jotstak.openWelcome")).toBe(true);
  });
});
