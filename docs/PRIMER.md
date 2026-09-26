# Jotstak, explained plainly

*A primer for anyone who needs to understand, use, or talk about this project. No jargon that isn't unpacked. Written 2026-09-26.*

---

## 1. The whole thing in five sentences

You write a plain text file. It looks like notes — headings with `#`, bullets with `-`, and a few extra lines that start with `@`. Jotstak turns that file into a page that looks like a well-kept paper notebook: cream stock, faint ruled lines, real A4 proportions, diagrams drawn by hand rather than assembled in a tool.

The point is that **the diagrams come out of the sentences**. You don't draw a timeline; you list four dates and Jotstak places them. You don't lay out a 2×2; you write "Search at top-right".

And because it's a text file, it lives in Git, diffs line by line in a pull request, and is readable with no tool at all.

---

## 2. Why it exists

A product manager writing one document today uses five tools: Notion for the text, Miro for the 2×2, Figma for the journey map, Excel for the metrics table, Slides to present it. The document is then spread across five links, none of which has a history you can read, and the whole thing rots the moment someone leaves.

Jotstak's bet: **a PM document is an artifact, like code.** It should be one file, in version control, reviewable in a diff, with the pictures generated from the words so they can never drift out of sync with them.

---

## 3. What in Markdown translates to what

This is the most important table in the document. **Jotstak is a superset of Markdown**, which means: every `.md` file is already a valid `.jot` file. You learn nothing on day one. You rename the file and it renders.

### Markdown you already know — works unchanged

| You write | Markdown calls it | Jotstak draws |
|---|---|---|
| `# Title` … `###### Small` | Heading, 6 levels | Six distinct sizes and weights, each sitting on a ruled line |
| `- item` | Bullet list | A bullet list, nesting by indent |
| `1. item` | Numbered list | A numbered list — it **renumbers itself**, so the digits you type don't matter |
| `---` | Horizontal rule | A centred divider mark, not a full-width line |
| `> quoted` | Blockquote | A quote block with a rule down its left edge |
| `**bold**` `*italic*` | Emphasis | Bold at weight 700, italic in the real italic face |
| `` `code` `` and ``` fences | Code | Monospace, preserved exactly, and `@names` inside a fence are just text |
| `[text](url)` | Link | A link |
| `\| a \| b \|` | Pipe table | A table — kept so pasted Markdown works, but not the form you'd write |
| `<div>` | Raw HTML | **Escaped, shown as text.** Deliberately: a `.jot` file must never be able to inject markup into the preview |

### Two places Jotstak differs from strict Markdown

| | Markdown's rule | Jotstak's rule | Why |
|---|---|---|---|
| **A single newline** | Is a space. Only a blank line starts a paragraph; a line break needs two invisible trailing spaces. | **A line you ended is a line.** | That rule is from 2004, when prose was hard-wrapped to 80 columns. GitHub, Slack and Notion all abandoned it. Jotstak is ruled paper — a line is a line. Write `@page breaks=off` to get CommonMark back exactly, which is what you want when pasting an old hard-wrapped `.md`. |
| **`==highlight==`** | Means nothing | Highlighter pen | The one inline mark Jotstak adds. Safe, because core Markdown gives `==` no meaning. Notably **not** `__`, which already means bold — redefining that would break real files. |

### The rule that governs all of this

> **Jotstak borrows Markdown's shorthands (`#`, `-`, `|`, `>`) because `.md` files have to keep working, and invents none of its own.**

This was learned the hard way. An early version used `>> text` for a margin note. But `>> text` is *valid Markdown* — a quote inside a quote — so every `.md` file that quoted a quote had its inner quote silently teleported into the margin. The shorthand was removed. A superset doesn't get to redefine Markdown it finds convenient.

### What Jotstak adds: lines starting with `@`

Everything Markdown can't say is a **block**, and every block is one word beginning with `@`:

```
@timeline
  Q3 2026: Discovery
  Oct 2026: Alpha
  Dec 2026: Beta
```

That's it. That's the whole extension to the language.

---

## 4. The syntax, in four rules

**Rule 1 — A block is `@name`.**
```
@quote
  I just want it to not lose my work.
```

**Rule 2 — Indentation says what belongs to what.** There is no closing bracket anywhere in the language. A block owns every line indented under it. Outdent, and you've left it.
```
@panel
  This line is inside the panel.
This line is not.
```

**Rule 3 — Settings are `key=value` on the same line.** They can also go in brackets, over several lines, when there are too many to fit.
```
@matrix x="Effort" y="Impact"

@matrix(
  x="Effort"
  y="Impact"
  style=boxed
)
```
Why brackets? Because the alternative was making settings look like content, and then you'd need syntax highlighting to tell them apart — which means the file's meaning would depend on the editor. Inside brackets is configuration. Indented below is content. True everywhere, including on GitHub.

**Rule 4 — You describe intent, never position.** `at top-right`, `at 12`, `dir=split`, `>` for the right side of a mind map. Never pixels. The renderer places things. This is what keeps files portable, diffable, and out of design-tool territory.

**One escape:** a diagram label is one line of source by construction, so when you genuinely need a break inside one, type `\n`. Works in table cells, timeline cards, journey stages and matrix chips.

---

## 5. Every block there is

**28 names, 23 of which currently draw something.** The five marked *not built* parse, keep your text, and come out as a plain paragraph with a note saying so — and autocomplete tells you before you pick them.

### Structure — the shape of the document
| Block | What it does |
|---|---|
| `@meta` | The document's project, owner, status and dates, as a row of chips at the top |
| `@page` | Page setup for the whole document: margins, ruling, and what Enter does |
| `@panel` | A box that holds anything. `@decision`, `@risk` and the rest are presets over it |
| `@columns` | Puts regions side by side. Each key in the body becomes a column |
| `@heading` (`@h1`–`@h6`) | A section heading, levels 1 to 6 |
| `@bullet` | A bullet list, usually written with a plain dash |
| `@numbered` | A numbered list. It renumbers itself |
| `@divider` | A break between two sections |
| `@pagebreak` (`@newpage`) | Starts the next block on a new printed sheet |
| `@cover` | A full-width opener for a major section — *not built* |

### Text
| Block | What it does |
|---|---|
| `@note` | A handwritten note in the margin, beside the block it follows |
| `@quote` | Someone else's words, with as much attribution as you have |
| `@callout` (`@info`, `@warn`, `@tip`, `@question`) | A boxed aside. The first word picks the flavour |
| `@footnote` | A note at the foot of the page — *not built, deferred past v1* |

### Lists of information
| Block | What it does |
|---|---|
| `@table` | Rows and columns, written as comma-separated lines. No pipes needed |
| `@tree` | A hierarchy, shaped by how far you indent each line. Five different looks from the same source |

### Diagrams
| Block | What it does |
|---|---|
| `@star_model` | One thing in the middle, the things that describe it around the outside |
| `@journey` | Stages across the page, with a line showing how each one felt |
| `@matrix` | A 2×2. Name the two axes, then place items with `at top-right` |
| `@timeline` | Events on a line, alternating above and below it |
| `@doodle` | Free placement, the escape hatch — *not built, deferred past v1* |

### PM artifacts
| Block | What it does |
|---|---|
| `@decision` | What was decided, why, and what it costs |
| `@metric` | A number that matters, with its target and which way it's going |
| `@persona` | Who you're building for, as a card of named fields |
| `@risk` | Something that could go wrong, how bad it'd be, what you'd do |
| `@assumption` | Something you're treating as true that the plan depends on |

### Expressive
| Block | What it does |
|---|---|
| `@sticky` | A sticky note. Several in a row cluster together — *not built* |
| `@icon` | A small icon inside a line of text — *not built, waiting on the icon set* |

**28 names, 18 rendering functions.** Several names are presets over one mechanism: a decision card, a risk card and a persona card are all `@panel` wearing different clothes. That's deliberate — a name that reads right for a PM, over machinery that only has to be correct once.

---

## 6. How it renders

### The pipeline — four steps

```
your .jot file
    ↓  lexer        reads lines into tokens: this is a heading, this is a directive,
    ↓               this is indented body, this is inside a fence
    ↓  parser       builds a tree: which block owns which lines
    ↓  renderer     measures, places, and emits HTML + CSS
    ↓
a page
```

Markdown is **not** reimplemented — a standard library handles it, with raw HTML switched off. Only the `@` blocks are Jotstak's own code.

The renderer is a **pure function**: text in, HTML out, no files touched, no network, no state. That's what lets the same code run in the VS Code preview, in a browser playground, and in a build script, with no chance of the three disagreeing.

### The ruled-line contract — the one rule that governs every pixel

Real notebook paper has ruled lines, and text sits *on* them. So:

1. **Everything is a multiple of 28px.** That's one ruled row.
2. **Text sits on the rule**, at an offset calculated from the actual font's metrics — read out of the shipped font file, not guessed.
3. **A drawn block cuts the ruling.** A diagram clears the lines across its whole row so it looks drawn *on* the page, not dropped *onto* it.
4. **Every block is a whole number of rows tall.** No exceptions. A block that's 6.9 rows tall pushes everything below it half a line off the ruling, and once that happens the page stops looking made and starts looking broken.

### The page is real A4

Not "a website that prints OK" — a sheet of paper that happens to be on a screen. The numbers are derived from the paper size and the 28px row, never typed in:

| | Pixels |
|---|---|
| Sheet (A4 portrait) | 793.7 |
| Printable area | 681.7 |
| Text column | 503.34 |
| Margin channel (where `@note` lives) | the remainder |
| Rows on a portrait page | 36 whole rows |

Every surface that shows a document shows **a whole sheet, scaled to fit, never enlarged past 1:1.** This is written down because three different surfaces each quietly invented their own width, and each bug was caught weeks later in a screenshot.

### Widths are measured, not guessed

Before the browser lays anything out, the renderer already knows how wide every label will be — computed from the font's own character-width tables, plus a 3% safety margin. Checked against a real browser, the estimate runs 0.23% high on average.

This matters because it's what lets a figure **decide where it goes**:

> text column → if it doesn't fit, the full width → if it still doesn't fit, its own landscape page → and only then, scaled down, never cut off.

### Two modes

- **notebook** — cream paper, ruled lines, hand-drawn feel. The default.
- **doc** — clean white, no ruling, for when a document has to look conventional.

Same source. Same words. The Markdown parts render identically in both.

### The hardest-won lesson

There's a whole class of bug in this project I've hit repeatedly, and it's worth naming because it shapes how the work gets tested:

> **Right markup, right stylesheet, wrong pixels.**

Bold text that was technically bold but had no 700-weight font loaded, so it looked identical. A CSS rule that was correct but lost a specificity fight. Three dividers that each computed correctly and came out at three different widths. None of it is visible by reading the source, and all of it passes a markup test.

The answer is to measure the rendered page — and to measure with `offsetHeight`, not `getBoundingClientRect()`, because the sheet is zoomed to fit and a correct 56px row reads back as 55.25.

---

## 7. Where it works

| Surface | What it is | State |
|---|---|---|
| **VS Code extension** | Live preview, autocomplete, hover docs, error squiggles, HTML export, smart indent | Built — packaged as a `.vsix`, not yet on the Marketplace |
| **Web playground** | Paste your Markdown, see it beautiful. No install | Built |
| **Docs site** | Reference generated from the same schema the editor reads | Partly built |
| **Templates** | Starter documents (PRD, retro, …) | 2 of a planned 8 |

Anything that has to describe a block — the editor's hover card, autocomplete, the docs reference — reads it from **one schema file**. Change a description in one place and all three update. They cannot drift.

The HTML export embeds its fonts, so a document you email opens the way it was written, with no internet needed.

---

## 8. How it compares

| | What it does well | Where Jotstak differs |
|---|---|---|
| **Markdown** | Universal, simple, diffable | Markdown has no diagrams, no page, no layout. Jotstak *is* Markdown plus those things — so this isn't really a competitor, it's the foundation |
| **Mermaid / PlantUML** | Text-to-diagram, widely embedded | They draw **engineering** diagrams (sequence, class, ER) and each has its own mini-language per diagram type. Jotstak draws **PM** artifacts, in one consistent syntax, and renders the whole document — not just a figure to paste into someone else's page |
| **Notion / Confluence** | Effortless, collaborative, everyone has it | A database row, not a file. No real diff, no branch, no review. Export is lossy. Jotstak trades live collaboration for **being an artifact you can review** |
| **Word / Google Docs** | Familiar, tracked changes, everyone has it | Formatting is manual and the layout is yours to maintain. Jotstak generates the layout from structure, so it cannot drift |
| **Figma / Miro** | Anything you can imagine, precisely | You place every element by hand, and the picture immediately starts disagreeing with the document. Jotstak generates the picture *from* the document |
| **LaTeX / Typst** | Beautiful, exact, programmable typesetting | Built for papers and books, and the learning curve is real. Jotstak's whole day-one promise is that you already know the syntax |
| **AsciiDoc / reStructuredText** | Serious docs-as-code, rich semantics | Aimed at technical manuals, and heavier syntax. Jotstak targets PM artifacts and looks hand-kept rather than published |

**The one-line position:** *docs-as-code, for product managers, where the diagrams are written rather than drawn.*

The closest honest comparison is **Mermaid** — and the difference is that Mermaid gives you a figure while Jotstak gives you the document.

---

## 9. What's done and what isn't

**Built and tested** — 639 automated tests.

- Full Markdown superset, verified against real files in the repo rather than fixtures written to pass
- The page: A4, print-true, real page breaks, landscape overflow for wide figures
- 23 of 28 blocks rendering
- All five `@tree` looks; `@table`, `@timeline`, `@matrix`, `@journey`, `@star_model`
- Margin notes with collision nudging
- VS Code extension: preview, autocomplete with working scaffolds, hover, diagnostics, export, smart indent
- Web playground

**Next**

| | What | Blocked on |
|---|---|---|
| 1 | `@cover` and `@sticky` — build them | A look to pick |
| 2 | `@icon` | The icon set doesn't exist yet (needs ~50) |
| 3 | `@tree` connector rework | **UX-32**, an open decision: where a stacked family's line leaves its parent pill |
| 4 | Rewrite the sample documents | They use too much markup, and are hard-wrapped, so their wrap points now render as real breaks |
| 5 | Tab / Shift-Tab re-parenting in the editor | — |
| 6 | Mobile rendering | Need to see the problem |
| 7 | Docs site, 8 templates, WCAG AA audit, 3 real-PM trials | The launch checklist |

**Deferred past v1 on purpose:** `@doodle`, `@footnote`, journey swim lanes, a CLI, hosted rendering, mobile app, cloud sync.

---

## 10. How to explain it

**In one line**
> A PM document written as a text file, that renders as a hand-kept notebook — with the diagrams generated from the sentences.

**In a paragraph**
> Product managers write one document across five tools: Notion for the text, Miro for the 2×2, Figma for the journey map, Excel for the numbers. Jotstak makes it one plain text file that lives in Git. You write Markdown — which you already know — plus a handful of lines starting with `@` for the things Markdown can't say. `@timeline` with four dates under it becomes a drawn timeline. `@matrix` with "Search at top-right" becomes a 2×2. It renders as real A4, on ruled cream paper, and because it's a text file it diffs line by line in a pull request.

**The three questions you'll get**

- *"Why not just use Notion?"* — Because a Notion page isn't an artifact. You can't branch it, diff it, or review it, and exporting it loses the formatting. Jotstak trades live collaboration for being something you can put through code review.
- *"Isn't this just Mermaid?"* — Mermaid gives you a figure to paste into someone else's document. Jotstak gives you the document. And Mermaid's vocabulary is sequence diagrams and class diagrams; Jotstak's is decisions, risks, personas and 2×2s.
- *"Will a non-technical PM use this?"* — That's the real risk, and it's written down as such. The mitigation is the superset promise: on day one there's no syntax to learn, because it's the Markdown they already type in Slack. The playground ships before the editor so the first experience is a URL, not an install.

---

## 11. Where the rest of it is written down

| Document | What's in it |
|---|---|
| `PRD.md` | Scope, goals, non-goals, milestones, risks |
| `docs/decisions/ADR-001…003` | The three architectural decisions, with the options that lost |
| `docs/register/DECISION_REGISTER.md` | Every decision made on the project — 200 of them — with who decided, when, and whether it's reversible |
| `docs/DESIGN_REFERENCE.md` | The visual language |
| `CHANGELOG.md` | What changed, and why, in order |
| `brag/JOURNAL.md` | The build journal |
