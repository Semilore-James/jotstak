---
title: "Diagrams"
description: "Write the structure as text, get the picture, and keep it in the same file as the argument for it."
sidebar:
  order: 4
---

A diagram in Jotstak is a few lines of text. You write the structure; the page
draws it. Because it is text in the same file as the prose, it changes when the
prose changes, in the same edit, instead of going stale in another tool.

| Block | Draws | Good for |
| --- | --- | --- |
| [`@tree`](/docs/functions/tree/) | A hierarchy, from indentation | Goals, features, org charts, taxonomies |
| [`@matrix`](/docs/functions/matrix/) | A 2×2 with named axes | Effort against impact, any two-way sort |
| [`@timeline`](/docs/functions/timeline/) | Events along a line | Milestones, a launch sequence |
| [`@journey`](/docs/functions/journey/) | Stages, and how each one felt | User journeys, onboarding |
| [`@star_model`](/docs/functions/star/) | One thing in the middle, related things around it | Data models, stakeholder maps |

## One setting changes the look

A tree is indented lines. The same lines can be drawn four ways, and switching
is one setting, not a redraw:

```jot-demo
@tree dir=down nodes=boxed
  Retention
    Onboarding
      First value
    Habit loop
```

- no setting: an **outline**, like a nested list with lines
- `dir=down nodes=boxed`: a **chart**, top to bottom, each node in a box
- `dir=right`: **columns**, one level per column
- `dir=split`: a **map**, balanced either side of the centre

## A diagram always fits the page

You never size a diagram. It starts in the text column; if it is too wide for
that it takes the full width of the page; if it is still too wide it shrinks a
little, and if it would have to shrink further it gets a sideways page of its
own. It is never cut off. To choose for yourself, set `width` to `column`,
`full` or `landscape`.

A table is the exception: its words stay the size of the words around it, and
its cells wrap instead.

On a phone the page stops being a sheet of paper and takes the width of the
screen, and diagrams fit themselves to that.
