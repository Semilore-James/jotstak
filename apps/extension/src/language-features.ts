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
//
// ── What Dart's analysis server does, and which of it we took ─────────────
//
// Dart's completion is the best-felt autocomplete in an editor, and the reason
// is not the list — it is what accepting an item LEAVES BEHIND. Choosing
// `Container` gives you `Container(child: )` with the cursor in the argument.
// You are never handed a word you then have to remember the shape of. Four
// behaviours of theirs are worth copying, and one is worth refusing:
//
//   TAKEN · Accepting inserts a working construct, not a name. Dart calls this
//           `completeFunctionCalls` / `insertArgumentPlaceholders`. Ours puts
//           the required parameters and one body line in, as tabstops.
//   TAKEN · Required arguments sort above optional ones and say so.
//   TAKEN · The value side completes too. Dart offers enum constants after
//           `:`; we offer them after `=`, each with its own description, which
//           a snippet choice list cannot show.
//   TAKEN · `sortText` carries relevance, because a client that sorts
//           alphabetically throws the server's judgement away (dart-lang/sdk
//           #38739 is this bug). Ours ranks by a numeric rank like theirs.
//   REFUSED · Relevance from a corpus. Dart's tables were built from scraped
//           repositories and are the source of its long-standing complaint
//           that the obvious item is seventh. We have no corpus, so we use the
//           one local signal that is honestly predictive: what this document
//           already uses.

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
 * The one-line signature, for the grey text beside the name in the list.
 *
 * Dart puts the parameter list here, so you can tell two overloads apart
 * without opening the documentation panel. Ours names the required parameters,
 * because those are the ones that decide whether you can use this block at
 * all; the group name follows, since that is the softer information.
 */
export function signature(spec: PrimitiveSpec): string {
  const need = spec.params.filter((p) => p.required).map((p) => p.name);
  const what = need.length > 0 ? `${need.join(", ")} · ${GROUP[spec.group]}` : GROUP[spec.group];
  // Said here rather than only in the card, because the list is where somebody
  // decides. A block that renders as a paragraph should say so before it is
  // picked, not after.
  return spec.planned ? `${what} · not built yet` : what;
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

  // Before the example, not after it. The example shows what this block is FOR,
  // and somebody reading it should already know it does not draw that yet.
  if (spec.planned) {
    md.appendMarkdown(
      `\n⚠️ No renderer yet. The block parses and keeps your text, and comes out as a plain paragraph.\n`,
    );
  }

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

// ── what accepting a primitive leaves behind ─────────────────────────────

/**
 * The first body line the primitive's own examples write UNDER the directive —
 * the hint we put in the scaffold.
 *
 * Taken from the examples rather than written here, so a block's scaffold and
 * its documentation cannot say different things. The rule is exactly "find the
 * line that opens this block, then take the first line of body beneath it",
 * which is what makes it safe to run over examples that are not shaped like a
 * single block:
 *
 *   `@footnote`  the example shows the reference first and the note second, so
 *                the directive is not on line one.
 *   `@cover`     what follows the directive is a continued parameter, not body.
 *   `@numbered`  the example is the Markdown form, `1. First`, which never
 *                opens a directive at all. Nothing to copy, so nothing is.
 */
export function exampleBodyLines(spec: PrimitiveSpec): string[] {
  const names = [spec.name, ...(spec.aliases ?? [])];
  const opens = (line: string): boolean =>
    names.some((n) => new RegExp(`^@${n}\\b`).test(line.trim()));
  const want = spec.scaffoldLines ?? 1;

  for (const example of spec.examples) {
    const lines = example.split("\n");
    const at = lines.findIndex(opens);
    if (at === -1) continue;

    // The body lines at the FIRST indent only. A timeline's detail is indented
    // under its event, and a scaffold that reaches into the second level starts
    // the author halfway down a structure they have not written the top of.
    const body: string[] = [];
    let indent = -1;
    for (const line of lines.slice(at + 1)) {
      if (!/^\s+\S/.test(line)) break; // blank, or back to column zero: block over
      const depth = line.search(/\S/);
      const text = line.trim();
      if (text.startsWith(")")) continue; // closing a parenthesised param list
      if (/^[a-z_]+\s*=/.test(text)) continue; // a continued parameter
      if (indent === -1) indent = depth;
      if (depth > indent) continue;
      body.push(text);
      if (body.length === want) break;
    }
    if (body.length > 0) return body;
  }
  return [];
}

/** The first body line, which is all that all but one primitive needs. */
export function exampleBodyLine(spec: PrimitiveSpec): string | undefined {
  return exampleBodyLines(spec)[0];
}

/** What a body line of each shape looks like when the example gives us nothing. */
const FALLBACK: Record<PrimitiveSpec["bodyShape"], string> = {
  none: "",
  plain: "text",
  keyed: "key: value",
  indented: "item",
  mixed: "text",
};

/**
 * The punctuation a body line of this primitive is genuinely built from.
 *
 * Asked of the primitive rather than guessed from the text, because guessing is
 * wrong on prose: `@footnote`'s example reads "Findings from the March
 * discovery sprint, slide 14." and a comma-splitter cut it in half and offered
 * the two halves as fields.
 */
function separators(spec: PrimitiveSpec): string[] {
  if (spec.name === "table") return [" | ", ", "];
  if (spec.name === "timeline") return [": "]; // `Date: What happened`
  if (spec.bodyShape === "keyed" || spec.bodyShape === "mixed") return [": "];
  return [];
}

/**
 * Break a sample body line at its structural punctuation and make each piece a
 * tabstop, so Tab walks the parts of the line you are meant to replace.
 *
 * `Q3 2026: Discovery` becomes two stops, `Feature, Status, Owner` three. A
 * line with no structure is one stop over the whole thing.
 */
export function tabstops(line: string, from = 1, seps: string[] = [": "]): string {
  // A key with nothing after it — `@columns` writes `left:` and puts the column
  // underneath. The key is the only part that is yours to replace.
  if (line.endsWith(":") && seps.includes(": ")) {
    return `\${${from}:${escapeSnippet(line.slice(0, -1).trim())}}:`;
  }
  const sep = seps.find((s) => line.includes(s));
  const parts = sep ? line.split(sep) : [line];
  return parts.map((part, i) => `\${${from + i}:${escapeSnippet(part.trim())}}`).join(sep ?? "");
}

/** `$`, `}` and `\` are the snippet syntax, so a hint containing one must escape it. */
function escapeSnippet(s: string): string {
  return s.replace(/([\\$}])/g, "\\$1");
}

/**
 * The block that accepting `@timeline` writes for you.
 *
 * This is the whole of what we took from Dart. A name on its own is the least
 * useful thing an editor can hand back, because the next question — what goes
 * under it? — is the one you opened the list to answer. So: the required
 * parameters, then one body line, with every part you are meant to replace as
 * a tabstop and the cursor left on the first one.
 *
 * Optional parameters are NOT inserted. Dart learned this the hard way
 * (`insertArgumentPlaceholders` exists as a setting because filling optional
 * arguments is unwanted more often than not): a scaffold you have to delete
 * from is worse than one you add to.
 */
export function scaffold(spec: PrimitiveSpec): vscode.SnippetString {
  let stop = 1;
  let text = spec.name;

  for (const p of spec.params.filter((q) => q.required)) {
    if (p.type === "enum" && p.enumValues) {
      text += ` ${p.name}=\${${stop++}|${p.enumValues.join(",")}|}`;
    } else {
      text += ` ${p.name}="\${${stop++}:${escapeSnippet(p.name)}}"`;
    }
  }

  if (spec.bodyShape !== "none") {
    const hints = exampleBodyLines(spec);
    if (hints.length === 0) hints.push(FALLBACK[spec.bodyShape]);
    for (const hint of hints) {
      const body = tabstops(hint, stop, separators(spec));
      stop += (body.match(/\$\{\d+[:|]/g) ?? []).length;
      // Two spaces: the indent that makes a line body rather than prose.
      text += `\n  ${body}`;
    }
  }

  // An explicit final stop, so Tab out of the scaffold lands after the block
  // rather than wherever the editor guesses.
  return new vscode.SnippetString(`${text}$0`);
}

// ── ordering ─────────────────────────────────────────────────────────────

/**
 * Groups in the order a document is usually built: its shape first, then the
 * words, then the things that get drawn.
 */
const GROUP_RANK: PrimitiveSpec["group"][] = [
  "structure",
  "text",
  "lists",
  "diagrams",
  "pm-artifacts",
  "expressive",
];

/**
 * `sortText`, as a number counted down from a ceiling.
 *
 * VS Code sorts `sortText` as a STRING, so "10" sorts before "9" and a rank
 * expressed plainly gets shuffled the moment there are ten of anything. Dart
 * solves it by emitting `10000000 - rank` zero-padded to a fixed width, which
 * makes string order and numeric order the same thing. Same trick here.
 */
export function rankText(rank: number): string {
  return String(1000 - rank).padStart(4, "0");
}

/** The @-names this document already uses, which is our only honest relevance signal. */
export function usedHere(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(/^\s*@([a-zA-Z_][a-zA-Z0-9_]*)/gm)) found.add(m[1]!);
  return found;
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

          // `style=` — offer the VALUES, with what each one means. A snippet
          // choice list can offer them but cannot describe them, and for
          // `flavor` or `look` the name alone does not say what you get.
          const value = /@([a-zA-Z_][a-zA-Z0-9_]*)[^)]*?\b([a-z_]+)=$/.exec(before);
          if (value) {
            const spec = getPrimitive(value[1]!);
            const param = spec && allParams(spec).find((p) => p.name === value[2]!);
            if (param?.type === "enum" && param.enumValues) return valueCompletions(param);
            if (param?.type === "boolean") return boolCompletions();
          }

          // Already inside a directive's line: offer its parameters, which is
          // the other half of "I don't know what the functions can be".
          const started = /@([a-zA-Z_][a-zA-Z0-9_]*)\s+[^)]*$/.exec(before);
          const spec = started ? getPrimitive(started[1]!) : undefined;
          if (spec) return paramCompletions(spec);

          // Otherwise, every primitive there is.
          if (!/@[a-zA-Z_]*$/.test(before)) return undefined;
          return primitiveCompletions(usedHere(doc.getText()));
        },
      },
      "@",
      "=",
    ),
  );
}

/** Every parameter a primitive answers to, its own and the universal ones. */
function allParams(spec: PrimitiveSpec): ParamSpec[] {
  return [...spec.params, ...UNIVERSAL_PARAMS];
}

export function primitiveCompletions(used: Set<string>): vscode.CompletionItem[] {
  return PRIMITIVES.map((p) => {
    const item = new vscode.CompletionItem(p.name, vscode.CompletionItemKind.Function);
    item.detail = signature(p);
    item.documentation = describe(p);
    item.insertText = scaffold(p);
    // Blocks this document already uses come first. Someone writing a PRD
    // reaches for @decision again long before they reach for @doodle, and
    // unlike a scraped corpus this signal is about THIS document. A block with
    // no renderer sorts below everything, however relevant it looks.
    const rank = p.planned
      ? 0
      : (used.has(p.name) ? 500 : 0) + (GROUP_RANK.length - GROUP_RANK.indexOf(p.group)) * 10;
    item.sortText = rankText(rank);
    // Typing the space or the bracket that would follow the name accepts it,
    // so `@tab ` completes to a table without a trip through the list.
    item.commitCharacters = [" ", "("];
    return item;
  });
}

function paramCompletions(spec: PrimitiveSpec): vscode.CompletionItem[] {
  const own = new Set(spec.params.map((p) => p.name));
  return allParams(spec).map((p) => {
    const item = new vscode.CompletionItem(p.name, vscode.CompletionItemKind.Property);
    item.detail =
      (p.required ? "required · " : "") +
      (p.type === "enum" && p.enumValues ? p.enumValues.join(" | ") : p.type);
    item.documentation = new vscode.MarkdownString(p.description);
    // A parameter is never useful without a value, so the cursor lands where
    // the value goes — inside the quotes for a string, in a choice list for an
    // enum, which VS Code then offers on its own.
    item.insertText =
      p.type === "enum" && p.enumValues
        ? new vscode.SnippetString(`${p.name}=\${1|${p.enumValues.join(",")}|}`)
        : new vscode.SnippetString(`${p.name}="\${1}"`);
    // Required first, then the block's own, then the universal ones every
    // block shares. Required leads because it is the only group where leaving
    // one out is an error rather than a choice.
    const rank = (p.required ? 200 : 0) + (own.has(p.name) ? 100 : 0);
    item.sortText = `${rankText(rank)}${p.name}`;
    return item;
  });
}

/**
 * The values of one enum parameter, each with its own line of description.
 *
 * Reached by typing `=`. The description is per-value because that is the
 * question being asked: `style=axes` against `style=boxed` is not answerable
 * from the two words.
 */
export function valueCompletions(param: ParamSpec): vscode.CompletionItem[] {
  return (param.enumValues ?? []).map((v, i) => {
    const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember);
    if (v === param.default) item.detail = "default";
    // The parameter's own description is what explains its values; there is
    // nowhere else in the schema that says what `axes` means.
    item.documentation = new vscode.MarkdownString(param.description);
    // Schema order, not alphabetical: the specs list values from plainest to
    // most decorated, which is the order somebody wants to read them in.
    item.sortText = rankText(100 - i);
    item.preselect = v === param.default;
    return item;
  });
}

function boolCompletions(): vscode.CompletionItem[] {
  return ["true", "false"].map((v, i) => {
    const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
    item.sortText = rankText(100 - i);
    return item;
  });
}
