---
title: Getting started
description: Paste a Markdown file in, then add one thing at a time.
sidebar:
  order: 1
---

There is nothing to learn before you start. **`.jot` is a superset of Markdown**,
so any `.md` file you already have renders unchanged. Rename it to `.jot` and
you are done.

```jot-demo
# Q3 pricing review

Three tools, one decision. Everything lives here.

- Usage-based beat seat-based in 4 of 5 interviews
- Finance needs 30 days' notice
```

Everything below is optional, and you can stop at any rung.

:::tip[Learn by doing]
The [playground](/playground)'s **Start here** sample is a two-page tour: six
steps, each ending in something to change and watch the page follow. In VS Code
the same tour opens the first time you install the extension, and again from
**Jotstak: Open the Welcome Document**. **Jotstak: Learn the Syntax** opens a
step-by-step guide on VS Code's Get Started page.
:::

## 1. Add a note in the margin

Write `@note` followed by the text. It floats beside the block it follows, in
the margin channel, in a handwritten face — and that block makes room for it,
while everything else keeps the full width of the page.

```jot-demo
Pricing is the fastest lever we have.

@note ask Ana before Friday
```

## 2. Add a block

A block is `@name` followed by indented content. Use `@panel` when you just want
a bounded region, or one of the named presets when the name fits.

```jot-demo
@panel(title="Move to usage-based pricing" badge=accepted)
  context: Seat pricing punishes the teams who adopt fastest
  choice: Usage-based, billed monthly, with a floor
```

:::tip[One look, many names]
`@panel` does almost everything the named cards do and takes matching
settings. `@risk`, `@decision`, `@assumption`, `@persona`, `@metric` and
`@callout` are panels with the label, badge and colour filled in. Use whichever
reads better.
:::

## 3. Indent to put one thing inside another

**Two spaces deeper than the line above means "inside it".** That is how a
block holds its content, and how a point in a list holds the diagram that
explains it.

```jot-demo
- Why this quarter
  @tree dir=right
    Retention
      Onboarding
      Templates
```

A line back at the left edge ends the block. That is the whole rule;
[Blocks and indentation](/docs/guide/blocks/) has the rest.

## Two modes, one file

The same file shows as a **notebook** — cream paper, ruled lines, margin notes
in handwriting — or as a **doc**: a clean white sheet for sharing and printing.
Nothing you wrote changes between them.

## Try it

The [playground](/playground) needs nothing installed. The tiles above its
source are every block there is: click one and it is written in at your cursor,
already working, with its settings shown beside it to try.

## Where next

- **[Patterns](/docs/examples/patterns/)** — the short shapes that come up constantly.
- **[All blocks](/docs/functions/)** — every block, with live examples.
