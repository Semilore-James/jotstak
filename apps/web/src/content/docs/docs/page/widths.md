---
title: "How wide a figure gets"
description: "The renderer places things. Here is how it decides."
draft: true
sidebar:
  order: 3
---

<!-- SHELL PAGE. An outline of what this page has to do, not the finished
     documentation. `draft: true` keeps it out of the built site until it is
     written. Delete the flag and this comment when it is. -->

Answer the question a PM asks the first time a table runs wide: what happens now? The escalation ladder is the answer, and `width=` is the override.

## What this page has to cover

- The ladder: text column, then full width, then a landscape page of its own
- How a figure's width is estimated before it is drawn
- Scaling to fit, and the point at which turning the page wins instead
- `width=auto|column|wide|full|landscape` to pin it yourself
- Why nothing is ever cut off
