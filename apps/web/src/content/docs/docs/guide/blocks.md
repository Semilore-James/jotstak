---
title: "Blocks and indentation"
description: "How a block is written, how indentation decides what belongs to what, and which blocks can go inside which."
sidebar:
  order: 1
---

A `.jot` file is Markdown with blocks in it. Everything on this page is about
the blocks, and it comes down to three rules.

## A line starting with `@` begins a block

The lines indented under it are its content. A line of `key: value` inside a
block is a **field**.

```jot-demo
@decision title="Move to usage-based pricing" status=accepted
  context: Seat pricing punishes the teams who adopt fastest
  choice: Usage-based, billed monthly, with a floor
```

Everything else in the file is ordinary Markdown: headings, paragraphs, lists,
links. A file with no blocks at all still renders.

## Settings go on the `@` line

A setting changes how a block looks. Write it after the name, or in brackets,
which read the same:

```text
@tree dir=right
@tree(dir=right)
```

Put a value in quotes when it has spaces: `title="Move to usage-based pricing"`.
Some blocks take their title as bare words instead, like `@cover Discovery phase`.
Every block's settings are listed on its page under [All blocks](/docs/functions/).

## Indentation says what belongs to what

**Two spaces deeper than the line above means "inside it".** A line back at the
left edge ends the block.

```jot-demo
@panel title="Outer"
  This line belongs to the panel.

  @metric name="Nested" value="42"
    And this metric is inside the panel too.

This paragraph is back at the left edge, so it is outside both.
```

Two spaces or four both work, as long as lines at the same level line up. If
one line is a space out, you get a message saying which lines it should match,
because a stray space does not break anything visibly — it quietly makes a
sibling into a child.

The editor and the playground help with this. Enter keeps your indent, and
steps in one level after a line that opens a block. Tab and Shift-Tab move a
line in and out, and in VS Code the lines that belong to it move with it.

## What goes inside what

Most blocks can go inside a card like `@panel` or `@callout`. A point in a list
can hold one too, indented under it:

```jot-demo
- Why this quarter
  @tree dir=down nodes=boxed
    Retention
      Onboarding
      Templates
- Who it is for
```

A few blocks hold only text (a quote, a heading), a diagram draws a block
written inside it just below itself, and a few belong to the page and never go
inside anything (a margin note, a cover). The whole list is in
[What goes inside what](/docs/functions/#what-goes-inside-what). If you put a
block somewhere it cannot go, nothing disappears: the editor underlines it and
says where it can go instead.

## `@panel`, or a named card?

`@risk`, `@decision`, `@assumption`, `@persona`, `@metric` and `@callout` are
all panels with a label and colour filled in for you. Use the name when it fits
what you are writing. Use `@panel` when none do, or when the document should not
read like a template.
