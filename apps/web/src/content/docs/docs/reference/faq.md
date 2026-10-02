---
title: "FAQ"
description: "Short answers, each pointing to the page that goes further."
sidebar:
  order: 2
---

## Is this just Markdown?

It is Markdown with more it can do: blocks for things like decisions, risks,
tables and diagrams, notes in the margin, and `==highlight==`. There is one
difference from Markdown, and it is small: pressing Enter ends a line.
[Text and emphasis](/docs/guide/text/) explains why.

## Will my existing `.md` file work?

Yes, as it is. Rename it to `.jot`. If it was wrapped at a fixed width, put
`@page breaks=off` at the top and its lines join back up the way Markdown would
join them.

## Is anything I write uploaded?

Only if you download a PDF. The playground draws your document in your own
browser, and nothing you type leaves the page while you write. When you choose
**Download → PDF**, the document is sent to our server, printed there by a
browser, and sent back to you as a file; it is not kept. **Download → Word**
and **Download → Print** make their files on your computer, without sending
anything anywhere.

This website also counts page visits, without cookies or anything that
identifies you.

## Can I get a PDF, or a Word file?

Yes. A PDF from the playground or from VS Code, and a Word file from the
playground, which opens in Word and in Google Docs. See
[Pages, print and PDF](/docs/guide/printing/).

## Where can I use it?

In the [playground](/playground), in your browser, with nothing to install. A VS
Code extension, with a live preview beside your file, is being prepared for the
Marketplace.

## Why not Mermaid, Miro or Google Docs?

- **Mermaid** draws a diagram. Jotstak is the whole document the diagram sits
  in — the prose, the tables and the notes — laid out on real pages.
- **Miro** is a canvas you drag things around on, kept apart from the document
  that explains them. In Jotstak the diagram is text in the same file, so the two
  change together.
- **Google Docs** is for prose. A diagram in it is a pasted picture that goes out
  of date. In Jotstak it is written out, so editing it is editing text.

## What happens to my files if Jotstak goes away?

They are plain text. Any text editor opens them, and the Markdown parts read as
Markdown anywhere. Jotstak itself is open source under the MIT licence.

## Why is something underlined, or not showing?

The editor and the playground explain themselves. An **error** means something
could not be drawn, a **warning** means it was drawn but probably not as you
meant, and **info** means a choice was made you should know about. A block
written somewhere it cannot go is the most common one:
[What goes inside what](/docs/functions/#what-goes-inside-what) has the list.
