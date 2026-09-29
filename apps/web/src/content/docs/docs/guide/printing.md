---
title: "Pages, print and PDF"
description: "What you see is a page. Print it, or save it as a PDF, and you get the same thing on paper."
sidebar:
  order: 5
---

Every document is a sheet of A4. On screen it scrolls as one long page; printed,
it breaks into real pages, and nothing is cut off or rearranged on the way.

## Where the page breaks go

You do not place them. When a document is printed:

- a block that does not fit at the bottom of a page moves to the next one
  whole, rather than being cut in two
- a heading never sits alone at the bottom of a page, apart from what it
  introduces
- a block and the margin notes beside it move together
- a diagram too wide for the page gets a sideways page of its own

A block taller than a whole page is the one thing allowed to continue onto the
next.

## A break of your own

When you want a new page at a particular point — an appendix, a section someone
will hand on separately — write `@pagebreak`. It shows on screen as a marked
line, so you can see where it will fall.

```jot-demo
The last line of the summary.

@pagebreak Appendix

The appendix starts on a page of its own.
```

## Saving a PDF

- **In the playground:** click **Download → PDF**, and the file arrives in your
  downloads. It is made on our server and not kept. To keep everything on your
  computer instead, choose **Download → Print** and pick *Save as PDF* in the
  print window.
- **In VS Code:** run **Jotstak: Export…** and pick **PDF**. The document opens
  in your browser with the print window; choose *Save as PDF*.

The same Export menu can also save a single **HTML file** that opens anywhere
with no internet, or **copy the document** to paste into an email or a wiki.

Notebook mode prints as it looks, paper and lines included. Doc mode prints on
plain white.
