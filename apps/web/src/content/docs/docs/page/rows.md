---
title: "Rows and the ruled line"
description: "Every line of type sits on a rule. Here is the contract that keeps it there."
draft: true
sidebar:
  order: 2
---

<!-- SHELL PAGE. An outline of what this page has to do, not the finished
     documentation. `draft: true` keeps it out of the built site until it is
     written. Delete the flag and this comment when it is. -->

The ruled line is the whole visual identity, and it only works if every block is a whole number of rows. Document the contract so a contributor adding a primitive knows the rule before they break it.

## What this page has to cover

- The 28px row, and why text sits on the rule rather than between rules
- Drawn blocks clear the ruling; written blocks sit on it
- Every block is a whole number of rows — including its padding and borders
- Where headings get their extra leading, and why it is not decoration
- How the contract is tested
