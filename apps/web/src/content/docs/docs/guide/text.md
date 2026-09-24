---
title: "Text and emphasis"
description: "Line breaks, bold, italics, links and code — everywhere text appears."
sidebar:
  order: 5
---

Prose in a `.jot` file is Markdown. If you already write Markdown, you already
know this page — with one difference, and it is the first section.

## A line you ended is a line

Press Enter and the line breaks. Leave a blank line and you start a new
paragraph.

```jot-demo
Discovery ran for six weeks.
Twelve interviews, four of them with people who had already churned.

The finding that mattered: nobody could tell us what the export button did.
```

This is the one place `.jot` departs from Markdown, and it is deliberate.
Markdown treats a single newline as a space — three lines you typed come out as
one run-on line — because in 2004 prose was hard-wrapped to 80 columns in a
terminal and the wrap points were not real. Nothing is written that way now, and
this is ruled paper: a line you ended should land on the next rule.

If you paste a `.md` file that *was* hard-wrapped, put this at the top and
Markdown's own rule comes back exactly:

```jot-demo
@page breaks=off

This file was wrapped at eighty columns,
so these two source lines are one sentence
and should be read as one.
```

## Bold, italics, and the rest

The usual marks, and they work **everywhere text appears** — prose, headings,
list items, table cells, margin notes, and the labels inside a diagram.

```jot-demo
**Bold** for the thing that must not be missed. *Italics* for a term you are
introducing, or a title. `Inline code` for a field name, a flag, or anything
the reader might type. ==Highlight== for the sentence you want someone to find
when they skim. And [a link](https://example.com), which needs no ceremony.
```

`==highlight==` is the only mark `.jot` adds. Plain Markdown gives `==` no
meaning, so nothing that already works stops working.

## Emphasis inside a diagram

A label is text, so it takes the same marks. This is how you point at the one
node, cell or milestone that the paragraph underneath is about.

```jot-demo
@timeline title="Where the risk sits"
  Q3 2026: Discovery
  Oct 2026: **Alpha**
    the date everything else depends on
  Dec 2026: Beta
```

Bold inside a label is set one step heavier than the label already is, so it
reads as emphasis rather than as a second kind of label.

## What is deliberately left out

- **No underline.** On a page, underlined text means a link. Using it for
  emphasis makes every reader hover it once.
- **No font, size or colour controls.** The document sets those, so a file
  written by one person and a file written by another still read as the same
  kind of document. If a word needs to stand out, bold it.
- **No raw HTML.** A `.jot` file renders in a preview pane and on a website; if
  it could carry markup it could carry a script. `<b>text</b>` shows up as
  those exact characters.
