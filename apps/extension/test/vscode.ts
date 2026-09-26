// A stand-in for the `vscode` module, so extension logic can be tested.
//
// The real module only exists inside a running extension host, which means
// anything that imports it is normally only testable by launching VS Code and
// looking at it — and "launch it and look" is how the three host-width bugs
// survived for weeks. Only the handful of shapes the extension actually uses
// are here; anything missing should be added when something needs it, not
// stubbed speculatively.

export class Position {
  constructor(
    readonly line: number,
    readonly character: number,
  ) {}
}

export class Range {
  readonly start: Position;
  readonly end: Position;
  constructor(startLine: number, startChar: number, endLine: number, endChar: number) {
    this.start = new Position(startLine, startChar);
    this.end = new Position(endLine, endChar);
  }
}

export interface TextLine {
  text: string;
  isEmptyOrWhitespace: boolean;
  firstNonWhitespaceCharacterIndex: number;
}

/** Build a document out of a template string, the way a test wants to write one. */
export function doc(source: string): {
  lineCount: number;
  lineAt(n: number): TextLine;
} {
  const lines = source.replace(/^\n/, "").split("\n");
  return {
    lineCount: lines.length,
    lineAt(n: number): TextLine {
      const text = lines[n] ?? "";
      const first = text.search(/\S/);
      return {
        text,
        isEmptyOrWhitespace: first === -1,
        firstNonWhitespaceCharacterIndex: first === -1 ? 0 : first,
      };
    },
  };
}

export const IndentAction = { None: 0, Indent: 1, IndentOutdent: 2, Outdent: 3 } as const;

/** Enough of MarkdownString to assert on what a hover card actually says. */
export class MarkdownString {
  value = "";
  supportHtml = false;
  constructor(value = "") {
    this.value = value;
  }
  appendMarkdown(text: string): this {
    this.value += text;
    return this;
  }
  appendCodeblock(code: string, language = ""): this {
    this.value += `
\`\`\`${language}
${code}
\`\`\`
`;
    return this;
  }
}

export class Hover {
  constructor(
    readonly contents: MarkdownString,
    readonly range?: Range,
  ) {}
}

export class SnippetString {
  constructor(readonly value: string) {}
}

export const CompletionItemKind = { Function: 2, Property: 9, Value: 11, EnumMember: 19 } as const;

export class CompletionItem {
  detail?: string;
  documentation?: MarkdownString;
  insertText?: string | SnippetString;
  sortText?: string;
  commitCharacters?: string[];
  preselect?: boolean;
  constructor(
    readonly label: string,
    readonly kind?: number,
  ) {}
}

/** Enough of the namespace for module-level calls not to throw on import. */
export const languages = {
  setLanguageConfiguration: () => ({ dispose() {} }),
  registerHoverProvider: () => ({ dispose() {} }),
  registerCompletionItemProvider: () => ({ dispose() {} }),
  createDiagnosticCollection: () => ({ set() {}, delete() {}, dispose() {} }),
};
export const window = {
  createTextEditorDecorationType: () => ({ dispose() {} }),
  onDidChangeTextEditorSelection: () => ({ dispose() {} }),
  onDidChangeActiveTextEditor: () => ({ dispose() {} }),
  activeTextEditor: undefined,
};
export const workspace = { onDidChangeTextDocument: () => ({ dispose() {} }) };
