---
title: "Margin notes"
description: "The aside you would scribble beside a paragraph in a real notebook."
sidebar:
  order: 3
---

A margin note is the thing you would write beside a paragraph in pencil: a
question for later, who to ask, the part that worries you. Write `@note` and the
text, on the line after the block it is about.

```jot-demo
Pricing is the fastest lever we have, and the one we have pulled least.

@note ask Ana before Friday
```

For a longer note, put the text on the lines under `@note`, indented:

```jot-demo
@decision title="Move to usage-based pricing" status=accepted
  context: Seat pricing punishes the teams who adopt fastest

@note
  Revisit in Q1. Finance agreed to a floor, not to this.
```

## Where it goes

- **Beside the block it follows**, in the margin, joined to it by a short line.
  That block narrows to make room; every other block keeps the full width of the
  page.
- **Several notes on one block** stack in the margin, in the order you wrote them.
  A note longer than its block makes that part of the page taller rather than
  running into what comes next.
- **On a narrow screen** there is no room for a margin, so a note moves in under
  the block it belongs to.
- **In doc mode** the note stays beside its block, set more quietly.

A margin note belongs to the page, so it cannot go inside another block. Write it
at the left edge, straight after the block it is about.
