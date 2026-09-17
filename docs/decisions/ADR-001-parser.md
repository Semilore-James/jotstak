# ADR-001: Parser architecture for `.jot`

- **Status:** Proposed — awaiting decision by Semilore-James
- **Date:** 2026-09-17
- **Stage:** 11 (Technical design) in [go_to_jotstak.md](../go_to_jotstak.md)

## Context

`.jot` is a **superset of Markdown** (PRD §1): any `.md` file must render unchanged. On top of Markdown it adds:

- **Block primitives** — a line starting `@name` with optional `key=value` params, followed by an indented body. Bodies come in shapes defined by the schema: `plain` (Markdown prose), `keyed` (`key: value` lines), `indented` (hierarchy by indentation), `mixed`.
- **Shorthands** — `>>` margin notes, `[^id]` references.
- **Params validated against `@jotstak/schema`**, including universal params (`id`, `width`, `icon`, `icon_at`).

The parser output feeds four consumers: the **renderer** (runs in browsers and Node, must stay framework-free), the **LSP** at M4 (needs source positions, useful diagnostics, recovery from half-typed input), the **docs generator**, and a future **MCP rendering layer**.

Constraints: one maintainer; a craft & portfolio piece; the Markdown promise is load-bearing for adoption (premortem §8.3).

### A known conflict the parser must resolve

Markdown gives indentation its own meanings — four spaces start an indented code block, and indentation decides list continuation. Jotstak uses indentation to scope a primitive's body. Whichever option is chosen must define exactly where a primitive's body ends and Markdown resumes.

## Decision drivers

1. **Markdown correctness** — CommonMark plus the GitHub extensions people actually use (pipe tables, strikethrough, autolinks).
2. **Positions and error recovery** — precise locations for LSP diagnostics; tolerance of half-typed input.
3. **Fit for indentation-scoped primitive bodies.**
4. **Runtime** — runs in the browser playground and a VS Code webview; bundle size matters.
5. **Maintenance** — sustainable for one person.
6. **Ecosystem alignment** — VS Code's built-in Markdown preview is built on markdown-it; Astro and Starlight use unified/remark.
7. **Portfolio signal** — what the choice demonstrates.

## Options

### Option 1 — Extend markdown-it with plugins

markdown-it (v15, actively maintained) parses Markdown into a flat token stream. Plugins can add **block rules** that run before built-in rules, so a rule can claim `@name` lines plus their indented body, and **inline rules** for `[^id]`.

- **For:** full CommonMark + GFM tables for free; fast; small; browser + Node; same engine as VS Code's own Markdown preview; mature plugin ecosystem.
- **Against:** plugins work inside markdown-it's internal line-state machinery, which is awkward for a grammar this rich; tokens are **flat**, so a real tree has to be rebuilt afterwards; tokens carry **line ranges only, not columns**, which limits diagnostics; error recovery is left to us inside someone else's model.

### Option 2 — Extend unified / remark (micromark → mdast)

micromark is the spec-precise tokenizer behind remark; it produces **mdast**, a proper syntax tree. Custom syntax is added as micromark extensions plus mdast utilities (`remark-directive` shows the pattern, though with `:::name` syntax, not `@name`).

- **For:** the most spec-faithful Markdown available; a **real tree with line, column and offset positions** on every node — excellent for the LSP; the same ecosystem Astro/Starlight already use, so the docs site could reuse plugins.
- **Against:** micromark extensions are written as state-machine tokenizers and have a **steep learning curve**; many small packages; heavier bundle; indentation-scoped bodies still have to be modelled inside micromark's constructs.

### Option 3 — Own the `.jot` block grammar; delegate Markdown to a proven library *(hybrid)*

A hand-written, line-based scanner owns everything Jotstak-specific: it recognises `@name` lines, parses and validates params against the schema, determines body extent by indentation, interprets `keyed` / `indented` bodies itself, and emits a **Jotstak AST with exact positions**. Every region that is plain Markdown — top-level prose, and `plain` bodies — is handed to a Markdown library.

- **For:** full control over the part that is actually new, which is also the part the LSP cares about; exact positions and deliberate error recovery for Jotstak syntax; the Markdown promise is still kept by a proven engine; clean separation that is easy to test; the strongest portfolio story ("designed and implemented a language, and knew not to reimplement Markdown").
- **Against:** more code of our own; the boundary rules between Jotstak blocks and Markdown must be specified precisely (they have to be under every option — here they're explicit); two layers to keep consistent; Markdown regions get positions only as precise as the delegate provides.

### Option 4 — Fully hand-written, including Markdown — *not recommended*

Complete control, but CommonMark has hundreds of specified edge cases. Every miss breaks the "any `.md` renders" promise that adoption now depends on. High effort, low payoff.

### Option 5 — Parser generator or incremental grammar (tree-sitter, Lezer, Peggy/Ohm) — *defer*

tree-sitter and Lezer (CodeMirror 6's parser, which has an extensible `@lezer/markdown`) offer **incremental** parsing, valuable for editor-grade performance on large files. But Markdown plus indentation-scoped blocks is awkward to express as a grammar, and VS Code highlighting uses TextMate grammars regardless. Worth revisiting if the playground adopts CodeMirror 6, or if the LSP needs incremental parsing.

## Comparison

| Driver | 1 · markdown-it plugins | 2 · remark / micromark | 3 · Hybrid | 4 · All hand-written |
| --- | --- | --- | --- | --- |
| Markdown correctness | Strong | Strongest | Strong (delegated) | Weak |
| Positions & recovery for LSP | Weak (lines only) | Strong | Strong for Jotstak syntax | Strong |
| Fit for indented bodies | Awkward | Awkward | Natural | Natural |
| Runtime / bundle | Strong | OK | Strong (with markdown-it) | Strong |
| Solo maintenance | Strong | Weak | OK | Weak |
| Ecosystem alignment | VS Code | Astro | Either | None |
| Portfolio signal | Low | Medium | High | High but risky |

## Recommendation

**Option 3, delegating Markdown regions to markdown-it.**

The part of `.jot` worth owning is the part that's new — primitive blocks, params, bodies, positions, recovery. The part that's a solved problem — Markdown — stays with a proven engine. markdown-it is preferred over remark as the delegate because Markdown *prose* rarely produces diagnostics (Jotstak syntax does, and Option 3 owns that), it is lighter for the playground and webview, and it matches the engine behind VS Code's own preview.

## Consequences

**Positive:** exact diagnostics for everything the LSP cares about; any `.md` renders; parser is testable in isolation from Markdown; the future MCP layer gets a clean AST.

**Negative / to manage:**
- The **block-boundary rules** must be written as a spec before implementation (M0 step 3): what ends a body, how blank lines inside a body behave, how Markdown inside a `plain` body is dedented and handed off, what happens to `@` at the start of a line that isn't a known primitive (literal text plus a diagnostic).
- Positions inside delegated Markdown are line-level.
- Field values in `keyed` bodies (e.g. `context: **bold**`) pass through markdown-it's inline renderer, so inline formatting works everywhere.

**Revisit if:** the playground moves to CodeMirror 6 (evaluate Lezer), or large-file LSP performance needs incremental parsing.
