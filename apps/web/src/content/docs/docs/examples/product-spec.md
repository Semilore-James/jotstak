---
title: "A product spec"
description: "What it is, who it is for, and — the part everyone skips — what it is not."
sidebar:
  order: 3
---

A spec has to survive being read by someone who was not in the room. It needs
the shape of the thing, the person it is for, the parts it is made of, and the
boundary — the list of things it deliberately does not do, which is the part
that stops the argument coming back every month.

**The usual way.** Prose in a doc. A table of modules in a spreadsheet, because
tables in docs are painful. A layout sketch in a third tool. The scope section
says nine modules, the spreadsheet says eleven, and nobody knows which is
current.

Below, the same spec as one file.

## The file

```jot-demo
@meta
  project: DA // Learning OS
  status: pre-build
  updated: 2026-09-23

# A learning environment shaped like a desktop

A self-directed environment for people moving into data analytics. Every tool
for the journey lives in a window you open on a desktop, rather than a course
you scroll.

@panel(title="Who it is for")
  primary: Someone changing career into data, 22–35, self-directed but
    inconsistent, with evenings and weekends to give it.
  secondary: A recent graduate working out whether data is the career.

@note the second one is v2, not now

## What is on the desktop

@tree(dir=right nodes=boxed)
  Desktop
    Learn
      Constellation Map
      Video Library
      Cheatcodes
    Practice
      Case Files
      Games
      Canvas
    Track
      Heatmap
      Daily Log
      PM-AI

@table
  Tile, What it is for
  Constellation Map, The learning path — every topic and what it unlocks
  Video Library, Watch and learn
  Case Files, Twenty real scenarios to work through
  PM-AI, An advisor that pushes back instead of agreeing
  Heatmap, "Your activity, so progress is visible"
  Canvas, Think on paper
  Games, "SQL, logic and data, as practice that is not a quiz"
  Cheatcodes, SQL and Excel quick reference
  Daily Log, One line a day

The taskbar carries the rest: a clock, your XP, your streak, the light and dark
toggle, and your account.

## What it is not

- Not a course platform with certificates
- Not a content aggregator
- Not social — that is not a v1 question
- Not mobile-first; the desktop is the point

@decision(title="Two fixed themes, no palette picker" status=accepted)
  context: A custom colour picker is a day of work and a permanent support
    surface, on a product whose look is the reason people stay.
  choice: Dark and light, both designed, neither adjustable.
  consequences: Nobody can make it unreadable. Nobody can make it theirs.

@risk(level=medium title="Self-directed learners stall")
  The product's whole premise is momentum, and momentum is the thing this
  audience has least of.
  mitigation: Streak, heatmap and daily log exist to make a gap visible the
    day it starts, rather than the month it ends.
```

## What changed

- **The boundary is in the document.** "Not a course platform" sits four lines
  below what it *is*, so the scope argument has somewhere to point.
- **The decision brought its reasoning.** Six months from now the question is
  not "why only two themes" but "what did we accept in exchange", and the
  answer is written down.
- **One list of modules.** The diagram and the table hold the same nine names,
  in the same file, edited in the same pass. The table is rows of text with
  commas between the columns, no pipes to line up, and its rows sit on the
  ruled lines like everything else.
- **The risk sits next to the claim it threatens**, rather than in a register
  nobody opens.
