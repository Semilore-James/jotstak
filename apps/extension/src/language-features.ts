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

/**
 * The short form of a parameter's description.
 *
 * The schema's descriptions are written for a documentation page, where there
 * is room to explain the reasoning: the longest is 444 characters and fifteen
 * of them turn on an em dash before the part that qualifies the first half. On
 * a hover card that is a wall, and a wall gets skipped.
 *
 * So the card takes what comes before the first full stop or the first em
 * dash, whichever arrives first. That is reliably the sentence that says what
 * the parameter IS; everything after it is why.
 */
const CARD_LIMIT = 120;

function oneLine(text: string): string {
  // A full stop followed by a CAPITAL, so `e.g.` and `i.e.` do not count as
  // the end of anything. Cutting on any full stop turned "kicker above the
  // title, e.g. "Risk"" into "kicker above the title, e.g".
  const cut = /^(.*?)(?:\.\s+(?=[A-Z])|\s—\s|$)/s.exec(text.trim());
  const first = (cut?.[1] ?? text).trim().replace(/[.;,]$/, "");
  if (first.length <= CARD_LIMIT) return first;

  // Still a paragraph: some descriptions carry the whole argument in one
  // sentence. Cut at a word rather than mid-word, and say it was cut.
  const clipped = first.slice(0, CARD_LIMIT);
  return clipped.slice(0, clipped.lastIndexOf(" ")) + "…";
}

function describeParam(p: ParamSpec): string {
  const type = p.type === "enum" && p.enumValues ? p.enumValues.join(" | ") : p.type;
  const tail = p.required ? " (required)" : p.default !== undefined ? ` (default ${p.default})` : "";
  return `- \`${p.name}\` _${type}_${tail}  \n  ${oneLine(p.description)}`;
}

/**
 * What the editor shows for a primitive.
 *
 * Ordered for someone who has just typed `@` and wants to know whether this is
 * the block they want: the name, one line saying what it is, then an example,
 * then the parameters. The example sits above the parameter list because it
 * answers the question faster than any prose does — you can see the shape.
 *
 * The schema's full `summary` is deliberately not here. It is a paragraph
 * written for a documentation page somebody chose to read, and a hover card
 * long enough to scroll is one nobody reads to the end of.
 */
export function describe(spec: PrimitiveSpec): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.supportHtml = false;

  md.appendMarkdown(`**@${spec.name}** · ${GROUP[spec.group]}\n\n`);
  md.appendMarkdown(`${spec.short}\n`);

  const example = spec.examples[0];
  if (example) md.appendCodeblock(example, "jot");

  if (spec.aliases?.length) {
    md.appendMarkdown(`\nAlso ${spec.aliases.map((a) => `\`@${a}\``).join(", ")}.\n`);
  }

  if (spec.params.length > 0) {
    md.appendMarkdown(`\n**Parameters**\n\n${spec.params.map(describeParam).join("\n")}\n`);
  }

  // Last, because it is the same for every primitive and putting it first
  // would bury the thing the reader came for.
  md.appendMarkdown(
    `\n_Plus ${UNIVERSAL_PARAMS.slice(0, 3)
      .map((p) => `\`${p.name}\``)
      .join(", ")} on any block._`,
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
