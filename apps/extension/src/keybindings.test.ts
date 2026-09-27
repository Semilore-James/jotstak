// Tab is the most contested key in the editor, and we have just taken it.
//
// It accepts a completion. It walks a snippet's tabstops — including the ones
// in every scaffold shipped in this same release, so getting this wrong would
// break a feature with the feature that was meant to complement it. It moves
// focus for anyone driving the editor from the keyboard alone, which is an
// accessibility setting and not ours to override.
//
// None of that is visible from the TypeScript. It lives in a `when` clause in
// package.json, where nothing type-checks it and nothing tests it, which is
// exactly the kind of place a regression goes unnoticed until somebody files
// a bug about autocomplete being broken.

import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as {
  contributes: {
    keybindings: { command: string; key: string; when: string }[];
    commands: { command: string; title: string }[];
  };
};

const binding = (key: string) => pkg.contributes.keybindings.find((b) => b.key === key);

describe("taking Tab without breaking it", () => {
  it("binds tab and shift+tab", () => {
    expect(binding("tab")?.command).toBe("jotstak.indent");
    expect(binding("shift+tab")?.command).toBe("jotstak.outdent");
  });

  it("only in a .jot file", () => {
    for (const b of pkg.contributes.keybindings) {
      expect(b.when, b.key).toContain("editorLangId == jot");
      expect(b.when, b.key).toContain("editorTextFocus");
    }
  });

  it.each([
    // Tab accepts the highlighted completion. Ours must not fire instead.
    ["!suggestWidgetVisible", "autocomplete would stop accepting"],
    // Tab walks the tabstops in every scaffold this release added.
    ["!inSnippetMode", "the scaffolds' tabstops would stop working"],
    // Tab moves focus when somebody has asked it to. That is theirs, not ours.
    ["!editorTabMovesFocus", "keyboard-only users would be trapped in the editor"],
  ])("stands down for %s, or %s", (clause) => {
    for (const b of pkg.contributes.keybindings) {
      expect(b.when, `${b.key} is missing ${clause}`).toContain(clause);
    }
  });

  it("stands down for an inline suggestion, which Tab also accepts", () => {
    // Only on plain Tab: shift+tab never accepts a ghost-text suggestion.
    expect(binding("tab")!.when).toContain("!inlineSuggestionVisible");
  });

  it("stands down for multiple cursors rather than guessing", () => {
    // Re-parenting several families at once is a different feature. Guessing
    // at it would be worse than not having it.
    for (const b of pkg.contributes.keybindings) {
      expect(b.when, b.key).toContain("!editorHasMultipleSelections");
    }
  });

  it("registers both commands, so they are reachable from the palette too", () => {
    const names = pkg.contributes.commands.map((c) => c.command);
    expect(names).toContain("jotstak.indent");
    expect(names).toContain("jotstak.outdent");
    for (const c of pkg.contributes.commands) {
      expect(c.title, c.command).toMatch(/^Jotstak: /);
    }
  });
});
