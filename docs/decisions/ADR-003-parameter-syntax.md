# ADR-003: Allowing parameters to span lines

- **Status:** **Accepted** — parenthesised param lists, 2026-09-19
- **Date:** 2026-09-19

## Context

Parameters could only be written on the shortcode line:

```
@decision title="Move to usage-based pricing" status=deprecated date=2026-09-19
```

That is 79 characters before any content, and there was no way to break it. Every
other language lets a long declaration wrap; `.jot` did not. The problem was found
by writing a real document in the playground rather than by any test — the line
simply ran off the edge and became unreadable.

This needed settling before M2, because M2 adds six more primitives and several of
them (`@persona`, `@sprint`, `@metric`) are param-heavy. Shipping them under a
constraint already known to be broken would mean rewriting examples later.

## Options

**A. Params may also be written as body fields.** A `key: value` line in the body
is a param when the schema declares that name for the primitive; otherwise it is
content. No new syntax — the keyed-body parser already exists.

**B. A line-continuation character.** End a line with `\` to continue, as in shell.

**C. Parenthesised param lists.** `@primitive( ... )`, which may span lines.

## Decision

**Option C.**

Option A was the cheapest to build and was the initial recommendation. Laying the
three out side by side on a realistic example changed the answer. In A, params and
content become visually identical:

```
@persona
  name: Marta, the systems PM      <- a param; changes rendering
  image: /marta.png                <- a param
  role: Platform PM at a fintech   <- content; freeform, author-invented
  goal: Sketch data relationships  <- content
```

`@persona` is the case that decides it: there the author invents field names
alongside schema-defined ones, and nothing in the file distinguishes them. The
distinction could be restored by syntax highlighting, but that pushes a property
of the language into the tooling — it would vanish when reading the file on GitHub,
in a diff, or in any editor without the extension.

Option C keeps the boundary in the file itself:

```
@persona(
  name="Marta, the systems PM"
  image="/marta.png"
)
  role: Platform PM at a fintech
  goal: Sketch data relationships
```

Everything inside the parentheses is configuration. Everything indented below is
content. True everywhere, with no tooling required.

Option B was rejected for adding punctuation without adding clarity, and because
trailing backslashes break invisibly on a stray trailing space.

## Consequences

- **The inline form stays legal and unchanged.** `@decision title="x"` still works;
  short blocks stay terse. The parenthesised form is for when it earns its keep.
- **It costs a principle, partially.** Design principle 2 is "minimal punctuation",
  and this adds some. Accepted because it buys a distinction that would otherwise
  only exist inside our own editor — and a language whose meaning depends on its
  tooling is a worse trade than a language with two more characters.
- **`.jot` reads slightly more like code.** A real cost against the non-coding PM
  persona. Mitigated by the form being entirely optional.
- Parentheses inside quoted values do not affect balancing, so a title like
  `"Pricing (Q3) review"` is safe.
- An unclosed `(` is an error with a clear message rather than a silent misparse.
- Inside a fenced code block, `@name(` is text like anything else.

## How it was found

Not by a test. By the owner writing a document in the playground and noticing the
line would not break. That is the second time in three days that using the product
found something the suite could not — the pattern is worth stating plainly: tests
written by the author of the code inherit the author's assumptions about how the
code will be used.
