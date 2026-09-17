# @jotstak/icons

Icon set bundled into the extension and web renderer so `@icon` works offline.

## Source set: Lucide (MIT)

[Lucide](https://lucide.dev) — MIT licensed, `currentColor` stroke, ~1500 icons. Fully redistributable in a VS Code extension.

**But Lucide is our source of _geometry_, not our final style.** Shipped raw, Lucide is clean-geometric and would make the notebook look like every other SaaS app — directly undermining the aesthetic thesis. So icons go through a treatment pass.

---

## The treatment: mode-aware, like everything else

Jotstak already renders two ways from one source. Icons follow the same rule:

| Mode | Treatment | Why |
| --- | --- | --- |
| **Notebook** | **Roughened** — path vertices perturbed, stroke `1.75px`, round caps/joins, sepia/terracotta ink | The notebook is the handmade artifact. Icons should look drawn, not placed. |
| **Doc** | **Clean** — stock Lucide geometry, stroke `1.5px`, ink `#2c2523` | Doc mode is publication-grade per the design reference. Crisp is _correct_ here. |
| **Web / IDE chrome** | **Clean** | UI furniture, not artifact content. |

This is the elegant part: we don't fight Lucide, we give it the same two-mode treatment the documents get.

### How the roughening works

A build-time script samples each SVG path and applies controlled jitter (the approach roughjs uses for shapes, applied to arbitrary paths):

1. Parse the Lucide SVG path into segments.
2. Resample each segment into points.
3. Perturb each point by a seeded random offset (seeded per-icon-name so an icon looks the same every render — no jitter-on-rerender).
4. Re-emit as a slightly wobbled path, optionally double-stroked for a sketched feel.
5. Write both variants to `dist/notebook/` and `dist/doc/`.

**The wobble amount is a taste dial** — needs prototyping against real rendered pages. Start subtle (amplitude ~0.6px at 24px viewbox); too much reads as "cute", too little reads as unchanged.

---

## Where icons appear — always opt-in

**There are no automatic icons.** Nothing renders unless the author asks for it. A glyph means something precisely because it was chosen; auto-decorating every block makes nothing stand out and makes documents look templated.

Two ways to ask:

### 1. `icon=` on any primitive
A universal optional param (see `UNIVERSAL_PARAMS` in `@jotstak/schema`). Opts that one block in.

```
@decision title="Use Astro" icon=git-branch
@risk level=high title="Syntax churn" icon=alert-triangle icon_at=margin
```

Placement is also optional, via `icon_at=`:

| Value | Renders |
| --- | --- |
| `inline` *(default)* | Immediately before the block's title / first line, at text size |
| `margin` | Out in the notebook margin channel, drawn larger — a marginal doodle |
| `corner` | Tucked into the card's top corner (card primitives only; falls back to `inline` with a diagnostic) |

Need size or color control too? Use the standalone `@icon` primitive instead — the param form deliberately stays small.

### 2. The `@icon` primitive
Author-placed, inline in prose: `@icon name=lightbulb Key insight below.`
Params: `name` (Lucide kebab-case), `size=sm|md|lg`, `color` (CSS or Organic token).

### Autocomplete suggestions (not defaults)
`SUGGESTED_ICONS` in the schema maps each primitive to a fitting glyph — `@star_model` → `network`, `@risk` → `alert-triangle`. This **only** seeds the autocomplete list when you type `icon=`, so the common choice is one keystroke away and the vocabulary stays consistent across documents. Ignore it freely; nothing is applied on your behalf.

---

## Curation: ~60 icons, not 1500

Bundling all of Lucide bloats the extension and invites inconsistency. We pick a curated subset covering the PM vocabulary, run the treatment on those, and bundle only them. An unrecognized `@icon name=` produces a parse diagnostic pointing at the nearest match — this is a feature, not a limitation: it keeps the visual vocabulary tight.

Target list: the 18 primitive glyphs above, plus lightbulb, flag, star, heart, clock, calendar, user, users, target, settings, wrench, book, file-text, folder, link, tag, search, filter, check, x, plus, minus, arrow-right/left/up/down, chevron-right, external-link, copy, download, upload, play, pause, eye, lock, mail, bell, zap, trending-down, activity, layers, box, database, cloud, code, terminal.

---

## Build pipeline (to implement at M4)

```
lucide-static/icons/*.svg
  → pick curated subset
  → [doc]      normalize stroke to 1.5px, currentColor
  → [notebook] roughen paths (seeded), stroke 1.75px, round caps
  → emit dist/{doc,notebook}/<name>.svg + src/index.ts name→SVG map
  → bundled into the extension (offline-safe) and imported by the web renderer
```

**Status:** approach decided, pipeline not yet built. The wobble amplitude needs a visual prototype before locking.

> Note: the Stitch wireframe in `docs/wireframe-notebook-mode.png` uses **Material Symbols**, not Lucide. Treat its icon styling as placeholder — it shows placement and sizing, not our final glyph style.
