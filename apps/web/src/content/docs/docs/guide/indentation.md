---
title: "Indentation decides structure"
description: "The sharpest edge in the language, documented rather than discovered."
draft: true
sidebar:
  order: 3
---

<!-- SHELL PAGE. An outline of what this page has to do, not the finished
     documentation. `draft: true` keeps it out of the built site until it is
     written. Delete the flag and this comment when it is. -->

Indentation is load-bearing — it decides parent and child — and a one-space overshoot silently changes the document's shape. Say so plainly, show the failure, and show what the editor does to help.

## What this page has to cover

- Two spaces, four spaces, a tab: pick one, the file must be consistent
- The failure it causes: a sibling becomes a child and a diagram loses a whole side
- The diagnostic that reports it, and how to read it
- Editor assistance: Enter carries indent, Tab and Shift-Tab move whole lines
- Why the renderer judges consistency and never step size
