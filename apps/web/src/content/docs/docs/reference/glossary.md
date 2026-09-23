---
title: "Glossary"
description: "Every term the documentation uses, defined once."
sidebar:
  order: 1
---

The words this documentation leans on, defined in one place. Where a term has a
common meaning elsewhere and a narrower one here, the narrow one is what the
docs mean.

## The language

**`.jot`** — the file extension, and the language. A `.jot` file is plain text
and a superset of Markdown: any `.md` file is already a valid `.jot` file and
renders unchanged.

**Directive** — a line that starts a block, written `@name` with optional
parameters: `@risk(status=open)`. The directive names the primitive.

**Primitive** — one of the rendering functions the language provides: `@panel`,
`@quote`, `@table`, `@tree`, `@note` and the rest. Named cards such as `@risk`
and `@decision` are presets of `@panel` — same shape, different label, badge
and accent.

**Block** — a directive together with the indented lines beneath it. A block is
the unit the renderer lays out, and the unit the page contract applies to.

**Body** — the indented lines under a directive. A body holds fields, prose, or
other blocks.

**Field** — a `key: value` line inside a body. `context:`, `choice:` and
`consequences:` are fields of a `@decision`.

**Parameter** — a setting on the directive line itself, inside the brackets:
`@tree(dir=right nodes=boxed)`. Distinct from a field, which belongs to the
content rather than the rendering.

**Universal parameter** — a parameter every primitive accepts, such as `width`
or `id`. Listed once in the [function reference](/docs/functions/).

**Nesting** — putting a block inside another block's body. Any primitive can
nest inside any other; there is no allow-list.

**Inline marks** — Markdown's `**bold**`, `*italic*`, `` `code` `` and links,
plus `==highlight==`. They work anywhere text works, including inside headings
and diagram labels.

## The page

**Sheet** — a whole page of paper: A4 at 96dpi is 793.7 × 1122.5 px. Everything
the renderer measures is measured against it.

**Printable width** — the sheet less its side margins: 681.7px. This is the
frame a document is laid out in, and the width the preview shows, so what fits
on screen fits on paper.

**Text column** — the main column inside the printable width, 503.34px. Prose,
headings and most blocks live here.

**Margin channel** — the narrower column beside the text column, where margin
notes sit. It is present whether or not a block uses it, so the measure of the
text does not change from block to block.

**Margin note** — an aside in the handwritten face, anchored to the block it
follows in source and placed in the margin channel beside it. Written `>>` at
line start, or `@note`. Overlapping notes are nudged apart by the renderer; you
never place one by hand.

**Row** — 28px, the baseline grid. Every block occupies a whole number of rows,
including its padding and borders.

**Ruled line (rule)** — the horizontal line drawn every 28px in notebook mode.
Text sits **on** the rule, the way handwriting does; drawn blocks clear it.

**Phase** — whether the rules still fall where they should further down the
page. A block that is not a whole number of rows pushes everything below it out
of phase, which is the failure the row contract exists to prevent.

**Landscape page** — the sideways sheet a figure is moved to when it cannot fit
the portrait width. Real paper turned, not a rotated picture.

## Rendering

**Figure** — a drawn block, such as a tree or a table, as opposed to written
prose. Figures are measured before they are drawn, and are the only things that
can claim more than the text column.

**Escalation** — the ladder a figure climbs when it does not fit: the text
column, then the full printable width, then a landscape page of its own. Set
`width=` to pin a figure and skip the ladder.

**Scale to fit** — shrinking a figure that has been pinned somewhere too small
for it, rather than cutting it off. Nothing in a rendered document is ever
clipped.

**Notebook mode** — the default: cream paper, ruled lines, handwritten
marginalia. What the tool is for.

**Doc mode** — the same document on a white sheet with the ruling off, for
contexts where a notebook reads as informal. Identical structure, different
surface.

**Diagnostic** — a message from the renderer about the document: an **error**
(it could not render something), a **warning** (it rendered, but you probably
did not mean this) or **info** (it made a choice you should know about, such as
scaling a figure).

**Renderer** — the framework-free package that turns `.jot` into HTML and CSS.
The same one runs in the extension's preview and in the playground; there is no
server-side rendering, and nothing is uploaded.

**Schema** — the package that defines every primitive and its parameters. The
function reference is generated from it, so the documentation cannot drift from
the tool.

## Trees

**Node** — one label in a tree, one line in the source.

**Root** — the node everything else hangs from: the least-indented line.

**Branch** — a node with children. **Leaf** — a node without.

**Look** — the shape a tree takes, chosen by its parameters rather than named
directly: an outline (`dir=down`), aligned columns (`dir=right`), a top-down
chart (`dir=down nodes=boxed`) or a bilateral map (`dir=split`).

**Depth** — how far a node is from the root. In every look, depth is what
decides position: distance down the page, or across it.
