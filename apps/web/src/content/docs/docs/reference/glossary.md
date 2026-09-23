---
title: "Glossary"
description: "The words the docs use, in plain English."
sidebar:
  order: 1
---

Short definitions of the words you will meet. If a word is not here, the docs
do not use it.

**`.jot` file** — a plain text file, same as a Markdown file with a few extra
things it can do. Any `.md` file is already a valid `.jot` file.

**Block** — one thing in your document: a table, a risk, a diagram, a quote.
You start a block with a line beginning `@`, and put its content underneath,
indented.

**Directive** — the `@` line that starts a block. `@risk` starts a risk,
`@tree` starts a diagram.

**Setting** — something in brackets on the `@` line that changes how the block
looks: `@tree(dir=right)`. Written `param` in the reference tables.

**Field** — a `key: value` line inside a block. A decision has `context:`,
`choice:` and `consequences:` fields.

**Nesting** — putting a block inside another block, by indenting it further.
Anything can go inside anything.

**Margin note** — an aside beside the text, in handwriting. Write `>>` at the
start of a line and it appears next to the paragraph above it.

**Ruled lines** — the faint horizontal lines across the page. Text sits on
them, the way handwriting sits on lined paper.

**Notebook mode** — the default look: cream paper, ruled lines, handwritten
notes in the margin.

**Doc mode** — the same document on a plain white page with the lines turned
off, for when a notebook looks too informal.

**Playground** — the page on this site where you can type `.jot` and watch it
render. Nothing is uploaded; it runs in your browser.

**Message** — what the renderer tells you about your document. An **error**
means it could not render something. A **warning** means it rendered, but you
probably did not mean it. **Info** means it made a choice you should know
about, like shrinking a diagram slightly to fit the page.
