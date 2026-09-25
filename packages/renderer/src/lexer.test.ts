import { describe, it, expect } from "vitest";
import { lex } from "./lexer.js";
import type { LineToken, LexResult } from "./lexer.js";

function lexOne(line: string): LineToken {
  const { tokens } = lex(line);
  return tokens[0]!;
}

describe("lexer — line classification", () => {
  it("classifies blank lines", () => {
    expect(lexOne("").kind).toBe("blank");
    expect(lexOne("   ").kind).toBe("blank");
  });

  it("classifies headings at all three levels", () => {
    const h1 = lexOne("# Title");
    expect(h1.kind).toBe("heading");
    expect(h1.headingLevel).toBe(1);
    expect(h1.content).toBe("Title");

    const h2 = lexOne("## Subtitle");
    expect(h2.kind).toBe("heading");
    expect(h2.headingLevel).toBe(2);

    const h3 = lexOne("### Deep");
    expect(h3.kind).toBe("heading");
    expect(h3.headingLevel).toBe(3);
  });

  it("classifies bullets", () => {
    const t = lexOne("- Buy milk");
    expect(t.kind).toBe("bullet");
    expect(t.content).toBe("Buy milk");
  });

  it("classifies numbered items", () => {
    const t = lexOne("1. First step");
    expect(t.kind).toBe("numbered");
    expect(t.content).toBe("First step");
  });

  it("classifies dividers", () => {
    expect(lexOne("---").kind).toBe("divider");
    expect(lexOne("-----").kind).toBe("divider");
  });

  it("classifies blockquotes", () => {
    const t = lexOne("> A wise thought");
    expect(t.kind).toBe("blockquote");
    expect(t.content).toBe("A wise thought");
  });

  it("hands >> to Markdown, where it is a quote inside a quote", () => {
    // It used to mean a margin note. That silently changed the meaning of any
    // .md file that quoted a quote, which a superset may not do. Margin notes
    // are written @note. `> ` with a space is still our blockquote shorthand;
    // `>>` has no space, so it falls through to markdown-it, which nests it.
    const t = lexOne(">> check this later");
    expect(t.kind).toBe("text");
  });

  it("classifies comments", () => {
    const t = lexOne("// internal note");
    expect(t.kind).toBe("comment");
    expect(t.content).toBe("internal note");
  });

  it("classifies indented lines as body", () => {
    const t = lexOne("  context: some value");
    expect(t.kind).toBe("body");
    expect(t.indent).toBe(2);
    expect(t.content).toBe("context: some value");
  });

  it("treats tabs as 2 spaces for indent", () => {
    const t = lexOne("\tcontext: tabbed");
    expect(t.kind).toBe("body");
    expect(t.indent).toBe(2);
  });

  it("classifies plain text", () => {
    const t = lexOne("This is just a paragraph.");
    expect(t.kind).toBe("text");
    expect(t.content).toBe("This is just a paragraph.");
  });
});

describe("lexer — directives", () => {
  it("parses a simple directive", () => {
    const t = lexOne("@divider");
    expect(t.kind).toBe("directive");
    expect(t.name).toBe("divider");
  });

  it("parses a directive with params", () => {
    const t = lexOne('@decision title="Use Astro" status=accepted');
    expect(t.kind).toBe("directive");
    expect(t.name).toBe("decision");
    expect(t.directive?.params.title).toBe("Use Astro");
    expect(t.directive?.params.status).toBe("accepted");
  });

  it("captures trailing text as rest", () => {
    const t = lexOne("@heading Overview of the system");
    expect(t.directive?.rest).toBe("Overview of the system");
  });

  it("handles single-quoted param values", () => {
    const t = lexOne("@decision title='Use Astro'");
    expect(t.directive?.params.title).toBe("Use Astro");
  });

  it("resolves aliases", () => {
    const t = lexOne("@warn This is important");
    expect(t.kind).toBe("directive");
    expect(t.name).toBe("warn");
  });
});

describe("lexer — diagnostics", () => {
  it("reports unknown primitives", () => {
    const { diagnostics } = lex("@nonexistent");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe("error");
    expect(diagnostics[0]!.message).toContain("Unknown primitive");
  });

  it("reports unknown params", () => {
    const { diagnostics } = lex("@divider fakeparam=hello");
    const paramDiag = diagnostics.find((d) => d.message.includes("Unknown param"));
    expect(paramDiag).toBeDefined();
    expect(paramDiag!.severity).toBe("warning");
  });

  it("reports invalid enum values", () => {
    const { diagnostics } = lex("@divider style=zigzag");
    const enumDiag = diagnostics.find((d) => d.message.includes("Invalid value"));
    expect(enumDiag).toBeDefined();
    expect(enumDiag!.severity).toBe("error");
  });

  it("reports missing required params", () => {
    const { diagnostics } = lex("@decision");
    const reqDiag = diagnostics.find((d) => d.message.includes("Missing required"));
    expect(reqDiag).toBeDefined();
    expect(reqDiag!.message).toContain("title");
  });

  it("warns on non-numeric number param", () => {
    const { diagnostics } = lex("@page rhythm=fast");
    const numDiag = diagnostics.find((d) => d.message.includes("expects a number"));
    expect(numDiag).toBeDefined();
  });

  it("warns on non-boolean boolean param", () => {
    const { diagnostics } = lex("@meta show=yes");
    const boolDiag = diagnostics.find((d) => d.message.includes("expects true or false"));
    expect(boolDiag).toBeDefined();
  });
});

describe("lexer — multi-line documents", () => {
  it("classifies a realistic .jot fragment", () => {
    const source = [
      "@meta",
      "  project: Jotstak",
      "  status: active",
      "",
      "# Overview",
      "",
      '@decision title="Use hybrid parser" status=accepted',
      "  context: need to handle both .jot and .md",
      "  choice: hand-written scanner + markdown-it",
      "",
      "@note this was the hardest call",
      "",
      "- First item",
      "- Second item",
      "",
      "Some regular paragraph text.",
    ].join("\n");

    const { tokens, diagnostics } = lex(source);

    expect(tokens[0]!.kind).toBe("directive");
    expect(tokens[0]!.name).toBe("meta");
    expect(tokens[1]!.kind).toBe("body");
    expect(tokens[2]!.kind).toBe("body");
    expect(tokens[3]!.kind).toBe("blank");
    expect(tokens[4]!.kind).toBe("heading");
    expect(tokens[5]!.kind).toBe("blank");
    expect(tokens[6]!.kind).toBe("directive");
    expect(tokens[6]!.name).toBe("decision");
    expect(tokens[7]!.kind).toBe("body");
    expect(tokens[8]!.kind).toBe("body");
    expect(tokens[9]!.kind).toBe("blank");
    expect(tokens[10]!.kind).toBe("directive");
    expect(tokens[10]!.name).toBe("note");
    expect(tokens[11]!.kind).toBe("blank");
    expect(tokens[12]!.kind).toBe("bullet");
    expect(tokens[13]!.kind).toBe("bullet");
    expect(tokens[14]!.kind).toBe("blank");
    expect(tokens[15]!.kind).toBe("text");

    expect(diagnostics).toHaveLength(0);
  });

  it("tracks line numbers correctly", () => {
    const { tokens } = lex("first\nsecond\nthird");
    expect(tokens[0]!.line).toBe(0);
    expect(tokens[1]!.line).toBe(1);
    expect(tokens[2]!.line).toBe(2);
  });

  it("handles Windows line endings", () => {
    const { tokens } = lex("# Title\r\n\r\n- Item\r\n");
    expect(tokens[0]!.kind).toBe("heading");
    expect(tokens[1]!.kind).toBe("blank");
    expect(tokens[2]!.kind).toBe("bullet");
  });

  it("produces zero diagnostics for a plain Markdown file", () => {
    const md = [
      "# My Document",
      "",
      "Some paragraph text with **bold** and *italic*.",
      "",
      "- List item one",
      "- List item two",
      "",
      "> A blockquote",
      "",
      "---",
      "",
      "1. Numbered",
      "2. Items",
    ].join("\n");

    const { diagnostics } = lex(md);
    expect(diagnostics).toHaveLength(0);
  });
});

describe("an unknown @name says which kind of mistake it is", () => {
  const first = (src: string) => lex(src).diagnostics[0]?.message ?? "";

  it("names the block a parameter belongs on", () => {
    // Someone wrote `@label The problem is fragmentation` inside a @panel.
    // "Unknown primitive" is a true sentence that helps nobody: label IS a
    // real thing, it is just written on the block's line rather than as a
    // block of its own. That distinction is the one people get wrong.
    const message = first("@label The problem");
    expect(message).toContain("is a parameter");
    expect(message).toContain("@panel");
    expect(message).toContain('@panel(label="');
  });

  it("does not list every owner when a parameter is on many blocks", () => {
    // `title` is on seven. A message that names all seven is one nobody reads.
    const message = first("@title Something");
    expect(message).toMatch(/and \d+ others/);
  });

  it("covers a parameter that every block takes", () => {
    // `width` belongs to no primitive in particular, which is the point of it.
    const message = first("@width full");
    expect(message).toContain("every block");
    expect(message).toContain('width="');
  });

  it("suggests a near miss on a real primitive", () => {
    expect(first("@tabel")).toContain("@table");
  });

  it("still just says unknown when it is nothing at all", () => {
    const message = first("@nonsense");
    expect(message).toContain('Unknown primitive "@nonsense"');
    expect(message).not.toContain("Did you mean");
  });
});
