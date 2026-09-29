---
title: "A product tour"
description: "Every part of a product, what it holds, and what it is for — on one page."
sidebar:
  order: 2
---

Someone joins the team, or you are writing the help page, or an investor asks
what the thing actually does. You need one page that says: here are the parts,
here is what is inside each, here is what it is for.

**The usual way.** A doc with the prose. A spreadsheet listing the screens. A
diagram in a third tool showing how they fit together. Three files, three
places to update, and within a month the diagram is showing a screen that was
renamed in the spreadsheet a fortnight ago.

Below is the same page as one `.jot` file. The map and the descriptions cannot
drift apart, because they are ten lines apart in the same document.

## The file

```jot-demo
@meta
  project: Moonframe
  status: in build
  updated: 2026-09-23

# What Moonframe is

Moonframe is a business management app for small businesses — the invoicing,
the money, the stock and the people, in one place instead of four apps and a
notebook.

@note written for someone seeing it for the first time

@tree(dir=right)
  Moonframe
    Money
      Invoices
      Finances
      Reports
    Work
      Tasks
      Operations
    Stock
      Inventory
      Channels

## Money

@panel(title="Invoices")
  Build an invoice from line items — description, quantity, unit price. It
  totals itself. Mark it paid and the money shows up in income.

@panel(title="Finances")
  sections: Overview, Income, Expenses, Profit & Loss, Financial Statements
  headline: Total income, total expenses, net profit, profit margin

@panel(title="Reports")
  Daily, monthly, or a custom range. Revenue, expenses, net profit and
  average daily sales, without exporting anything.

## Work

@panel(title="Tasks")
  A board you arrange yourself — add, rename, reorder or delete the columns.
  Each task carries a priority and whoever it belongs to.

@panel(title="Operations")
  holds: Customers, Suppliers, Purchase orders, Deliveries, Staff
  Everyone the business deals with, and everything owed in both directions.

## Stock

@panel(title="Inventory")
  Items with a cost, a category and a location. It flags what has stopped
  moving and what needs reordering before you notice yourself.

@panel(title="Channels")
  Bring sales in from Shopify, Square, Loyverse or a CSV, so what sold
  elsewhere still counts here.

@callout
  The dashboard is the whole of the above in one screen: today's numbers, what
  needs attention, and a button for each thing you start most often.
```

## What changed

- **The map and the descriptions are one file.** Rename a section and you edit
  the line above the paragraph explaining it. There is no second place to
  forget.
- **The diagram is text.** It is nine indented lines, so it diffs in a pull
  request like everything else, and nobody has to be granted access to a canvas
  to change it.
- **The asides stay asides.** "Written for someone seeing it for the first
  time" is a note in the margin, not a parenthesis interrupting the sentence.
- **It prints.** One page, A4, ready to hand to someone.
