// Hover and autocomplete, straight out of the schema.
//
// "On hover provides nothing for @panel and the rest, so I don't know what
// panel does, nor do I know what the functions can be." That is the whole of
// this file's brief, and it is embarrassing that it was missing: the schema
// has a written summary, a typed parameter list with descriptions and defaults,
// and worked examples for all twenty-eight primitives. Every word of it was
// reaching the documentation site and none of it was reaching the editor,
// which is where somebody is actually trying to remember what @panel does.
//
// Nothing here describes a primitive. It formats what the schema already says,
// so the editor cannot drift from the docs or from the renderer.

import * as vscode from "vscode";
import { PRIMITIVES, UNIVERSAL_PARAMS, getPrimitive } from "@jotstak/schema";
import type { ParamSpec, PrimitiveSpec } from "@jotstak/schema";
import { isJot } from "./jot-files.js";

/** `@panel`, wherever the cursor is inside it. */
const DIRECTIVE = /@[a-zA-Z_][a-zA-Z0-9_]*/;

/** Plain-language names for the groups, for the completion list's right rail. */
const GROUP: Record<PrimitiveSpec["group"], string> = {
  structure: "structure",
  text: "text",
  lists: "lists",
  diagrams: "diagram",
  "pm-artifacts": "PM artifact",
  expressive: "expressive",
};

function describeParam(p: ParamSpec): string {
  const type = p.type === "enum" && p.enumValues ? p.enumValues.join(" | ") : p.type;
  const bits = [`\`${p.name}\``, `_${type}_`];
  if (p.required) bits.push("**required**");
  else if (p.default !== undefined) bits.push(`default \`${p.default}\``);
  return `- ${bits.join(" · ")}  \n  ${p.description}`;
}

/** Everything the schema knows about one primitive, as Markdown. */
export function describe(spec: PrimitiveSpec): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.supportHtml = false;

  md.appendMarkdown(`**@${spec.name}** — ${GROUP[spec.group]}\n\n`);
  md.appendMarkdown(`${spec.summary}\n\n`);

  if (spec.aliases?.length) {
    md.appendMarkdown(`Also written ${spec.aliases.map((a) => `\`@${a}\``).join(", ")}.\n\n`);
  }

  if (spec.params.length > 0) {
    md.appendMarkdown(`**Parameters**\n\n${spec.params.map(describeParam).join("\n")}\n\n`);
  }

  // One example, not all of them: a hover card long enough to scroll is one
  // nobody reads to the end of. The rest are a click away in the docs.
  const example = spec.examples[0];
  if (example) md.appendCodeblock(example, "jot");

  // Said last because it is the same for every primitive, and repeating it at
  // the top would bury the thing the reader came for.
  md.appendMarkdown(
    `\n_Every block also takes ${UNIVERSAL_PARAMS.slice(0, 3)
      .map((p) => `\`${p.name}\``)
      .join(", ")} and others._`,
  );
  return md;
}

/** The primitive named at `position`, if the cursor is on one. */
function primitiveAt(
  doc: vscode.TextDocument,
  position: vscode.Position,
): { spec: PrimitiveSpec; range: vscode.Range } | undefined {
  const range = doc.getWordRangeAtPosition(position, DIRECTIVE);
  if (!range) return undefined;
  const spec = getPrimitive(doc.getText(range).slice(1));
  return spec ? { spec, range } : undefined;
}

export function registerLanguageFeatures(context: vscode.ExtensionContext): void {
  // Registered against the PATTERN as well as the language, because another
  // extension may hold the `.jot` association (jot-files.ts) and a selector of
  // `{ language: "jot" }` alone would then never match.
  const selector: vscode.DocumentSelector = [
    { language: "jot" },
    { scheme: "file", pattern: "**/*.jot" },
  ];

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, {
      provideHover(doc, position) {
        if (!isJot(doc)) return undefined;
        const found = primitiveAt(doc, position);
        return found ? new vscode.Hover(describe(found.spec), found.range) : undefined;
      },
    }),

    vscode.languages.registerCompletionItemProvider(
      selector,
      {
        provideCompletionItems(doc, position) {
          if (!isJot(doc)) return undefined;
          const before = doc.lineAt(position.line).text.slice(0, position.character);

          // Already inside a directive's line: offer its parameters, which is
          // the other half of "I don't know what the functions can be".
          const started = /@([a-zA-Z_][a-zA-Z0-9_]*)\s+[^)]*$/.exec(before);
          const spec = started ? getPrimitive(started[1]!) : undefined;
          if (spec) return paramCompletions(spec);

          // Otherwise, every primitive there is.
          if (!/@[a-zA-Z_]*$/.test(before)) return undefined;
          return PRIMITIVES.map((p) => {
            const item = new vscode.CompletionItem(p.name, vscode.CompletionItemKind.Function);
            item.detail = GROUP[p.group];
            item.documentation = describe(p);
            // The @ is already typed, so only the name is inserted.
            item.insertText = p.name;
            return item;
          });
        },
      },
      "@",
    ),
  );
}

function paramCompletions(spec: PrimitiveSpec): vscode.CompletionItem[] {
  return [...spec.params, ...UNIVERSAL_PARAMS].map((p) => {
    const item = new vscode.CompletionItem(p.name, vscode.CompletionItemKind.Property);
    item.detail = p.type === "enum" && p.enumValues ? p.enumValues.join(" | ") : p.type;
    item.documentation = new vscode.MarkdownString(p.description);
    // A parameter is never useful without a value, so the cursor lands where
    // the value goes — inside the quotes for a string, in a choice list for an
    // enum, which VS Code then offers on its own.
    item.insertText =
      p.type === "enum" && p.enumValues
        ? new vscode.SnippetString(`${p.name}=\${1|${p.enumValues.join(",")}|}`)
        : new vscode.SnippetString(`${p.name}="\${1}"`);
    // Own parameters before the universal ones, which every block shares.
    item.sortText = spec.params.includes(p) ? `0${p.name}` : `1${p.name}`;
    return item;
  });
}
