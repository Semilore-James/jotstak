---
title: "Pages, print and PDF"
description: "What you see is a page. Print it, save it as a PDF, or download it as a Word file."
sidebar:
  order: 5
---

Every document is A4. In the playground and in VS Code you see its real pages,
one sheet after another, and printing gives you exactly those pages: nothing
moves, nothing is cut off or rearranged on the way. On a phone the pages give
way to one column you can read at full size.

## Where the page breaks go

You do not place them. A document fills each sheet from the top, and:

- a block that does not fit at the bottom of a page moves to the next one
  whole, rather than being cut in two
- a heading never sits alone at the bottom of a page, apart from what it
  introduces
- a block and the margin notes beside it move together
- a diagram too wide for the page gets a sideways page of its own

Paragraphs, lists and quotes carry on to the next sheet between two lines. A
block taller than a whole page is the one block allowed to continue onto the
next.

## A break of your own

When you want a new page at a particular point — an appendix, a section someone
will hand on separately — write `@pagebreak`, and the next sheet starts there.
Where a document is not shown as pages, like the short example below, it
appears as a marked line instead.

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

## Saving a Word file

In the playground, click **Download → Word**. The file opens in Word and in
Google Docs, and it is made on your computer: nothing is sent anywhere.

Word has no notebook, so the file reads like doc mode, with the same margins as
the PDF:

- headings, text, lists, quotes and tables are ordinary Word text you can edit,
  with Word's own heading styles
- cards and callouts keep their look, a thin line above or beside them
- diagrams and sticky notes are pictures, exactly as they look on the page; a
  diagram too wide for the page gets a sideways page of its own
- margin notes become Word comments, in the margin beside the line they are
  about, under the author named in `@meta`
- the typefaces travel inside the file, so it looks the same on a computer that
  does not have them
