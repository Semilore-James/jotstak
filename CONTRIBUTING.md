# Contributing to Jotstak

Jotstak is a craft project built in the open. Issues, ideas and corrections are welcome; please read this first so we don't waste each other's time.

## Ways to help

- **Report a bug** — include a minimal `.jot` snippet that reproduces it.
- **Propose a primitive** — use the primitive proposal template. The bar is deliberately high (see below).
- **Improve the docs** — small pull requests welcome.

## The design principles a change must respect

These are not style preferences; they're what keeps the language coherent.

1. **Intent, not coordinates.** Primitives express arrangement semantically (`dir=`, `layout=clock`, `at 12`, `>` / `<`), never pixel positions. `@doodle` is the single escape hatch.
2. **Minimal punctuation.** No pipe tables. Bodies use indentation and `key: value`.
3. **Indentation is structure.** Hierarchy comes from indentation so files diff cleanly.
4. **No automatic decoration.** Nothing renders that the author didn't ask for — icons are opt-in per block.
5. **`.jot` is a superset of Markdown.** Any `.md` file must keep rendering unchanged.

## Why new primitives are hard to get in

The cost of a primitive is not its definition, it's its **rendering mechanic**. Seven of the PM cards share one mechanic; adding an eighth is nearly free. A primitive that needs a *new* mechanic is expensive and must earn it. Proposals are judged on whether the shape is genuinely product-work-shaped and cannot be expressed with what exists.

## Development

```bash
npm install
npm run typecheck   # tsc -b across the workspace, plus astro check
npm run build
npm test
```

- Node 22.12 or newer (see `.nvmrc`).
- `packages/schema` is the single source of truth for primitives. The editor's autocomplete and the generated documentation both read it, so a change there propagates everywhere. It has invariant tests — run them.
- `packages/renderer` must stay framework-free and work in both a browser and Node. It is shared by the VS Code preview, the web playground and a future MCP layer.

## Commits and CI

Commit messages say what changed and why. CI runs typecheck, build and tests on every push; keep it green.

## Decisions

Significant technical choices are recorded in [`docs/decisions`](docs/decisions) as decision records. If you're proposing something that contradicts an accepted decision, argue with the decision record.

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
