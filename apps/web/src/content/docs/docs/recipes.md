---
title: Patterns
description: Short answers to the shapes that come up constantly. For whole documents, see the cookbook.
sidebar:
  order: 2
---

The [function pages](/docs/functions/) describe pieces one at a time. This page
is the shapes that come up over and over — a decision, a risk, a number worth
quoting. Copy one and change the words. For whole documents end to end, see the
[cookbook](/docs/cookbook/).

## A decision worth finding again in six months

The thing that makes an old decision useful is the *context* — what was true
when it was made. Record that and the reasoning survives the people.

```jot-demo
@panel(title="Move to usage-based pricing" label="Decision" badge=accepted)
  context: Seat pricing punishes the teams who adopt fastest
  choice: Usage-based, billed monthly, with a floor
  consequences: Revenue is lumpier; forecasting needs rework

>> Ana disagreed; worth revisiting in Q1
```

## A risk with its mitigation attached

A risk without a mitigation is just worry. Keep them in one block so they cannot
drift apart.

```jot-demo
@risk(level=high title="Churn among small teams")
  Small teams pay less under usage pricing, and they are the loudest segment.

  mitigation: Grandfather existing plans for 12 months.
```

## Evidence next to the claim it supports

Nesting means the quote lives *inside* the decision it justifies, rather than
three paragraphs away.

```jot-demo
@panel(title="Why usage-based" label="Rationale")
  claim: Seat pricing actively discourages adoption

  @quote(by="User P7" source="Interview 3" tag=pricing)
    We stopped adding people because every new seat cost money.
```

## A number that means something

A figure on its own is trivia. A figure with a target and a direction is a
status.

```jot-demo
@metric(name="Weekly active teams" value="1,240" target="2,000" trend=up status=on-track)
  Growing 8% week-over-week since the playground shipped.
```

## Two things side by side

Use `@columns` when a diagram and its explanation belong on the same line of
thought — the thing that normally forces a second tool.

```jot-demo
@columns(ratio="1:1")
  What we tried:
    Seat-based pricing with volume discounts
  What we learned:
    Discounts did not change the adoption behaviour
```

## Metadata at the top of a spec

```jot-demo
@meta
  project: Pricing v2
  owner: Marta
  status: in review
  updated: 2026-09-19
```

## A document that is mostly Markdown

The most common shape. Ordinary prose, with a block where a block earns its
place.

```jot-demo
# The problem

Writing one PRD means five tools. The cost is not the writing, it is
everything after: context lost on the seams, versions drifting, and no
cheap answer to "what changed since last sprint?"

>> this is the whole bet

@panel(title="Fragmentation leads" label="Decision" badge=accepted)
  reasoning: Nobody switches tools because something is prettier.
```
