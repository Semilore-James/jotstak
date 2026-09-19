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

## 1. Add a note in the margin

Start a line with `>>`. It floats beside the block it follows, in the margin
channel, in a handwritten face.

```jot-demo
Pricing is the fastest lever we have.

>> ask Ana before Friday
```

## 2. Add a block

A block is `@name` followed by indented content. Use `@panel` when you just want
a bounded region, or one of the named presets when the name fits.

```jot-demo
@panel(title="Move to usage-based pricing" badge=accepted)
  context: Seat pricing punishes the teams who adopt fastest
  choice: Usage-based, billed monthly, with a floor
```

:::tip[One function, many names]
`@panel` does almost everything the named cards do and takes matching
parameters. `@risk`, `@decision`, `@assumption`, `@persona`, `@metric` and
`@callout` are presets that fill in its label, badge and accent. Use whichever
reads better — the output is the same.
:::

## Indentation is how blocks are built

This is the one thing worth understanding properly, because it is how `.jot`
decides what belongs to what.

**Two spaces deeper than the `@` line means "inside this block".**

```jot-demo
@panel(title="Outer")
  context: this line belongs to the panel

  @metric(name="Nested" value="42")
    and this metric is inside the panel too
```

A line that is *not* indented ends the block. A line indented under another
block belongs to that one. That is the whole rule — but it means a wrong indent
changes meaning quietly rather than erroring, so the editor extension
auto-indents on Enter and shows which lines a block owns.

## Two modes, one file

The same source renders as a **notebook** — cream paper, ruled lines, margin
notes in handwriting — or as a **doc**: a clean white sheet for sharing and
printing. The structure you wrote survives both.

[Try it in the playground](/playground) without installing anything.

## Where next

- **[Recipes](/docs/recipes/)** — how to write the documents you actually write.
- **[All functions](/docs/functions/)** — the complete set, with live examples.
