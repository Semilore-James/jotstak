# Changelog

All notable changes to Jotstak are recorded here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Monorepo skeleton: `packages/{renderer,schema,icons}`, `apps/{extension,web}`, `templates/`, CI workflows.
- `.gitattributes` enforcing LF line endings.

### Changed
- **Renamed Jotter → Jotstak.** Document extension `.jtr` → `.jot`; TextMate grammar is now `jot.tmLanguage.json` with scope `source.jot`; extension commands are `jotstak.*`; packages are `@jotstak/*`.
- **pnpm → npm workspaces.** Root scripts, CI, deploy and publish workflows updated; internal deps use `"*"`.
- Milestones reordered playground-first (see PRD §14).
- Dependencies moved to current majors: Astro 7, Starlight 0.42, Vitest 5, vsce 4, ovsx 1; TypeScript 6.0.3 (7 blocked by `@astrojs/check`). `@types/vscode` pinned to 1.90.0 to match the engine floor.
- Docs content moved to `src/content/docs/docs/` so Starlight serves `/docs` instead of claiming `/`.

- `@footnote` now uses the universal `id` param (`@footnote id=<id>`); `@doodle` drawing area params renamed `width`/`height` → `cols`/`rows`.
- Web deploy workflow is manual-only until M1 (no Cloudflare project or secrets yet).

### Removed (the `>>` shorthand)
- **Margin notes are written `@note`.** `>>` is gone. It was not just a second way to write one thing: `>> text` is valid Markdown — a blockquote inside a blockquote — so every `.md` file that quoted a quote had its inner quote silently moved into the margin. A superset does not get to redefine Markdown it finds convenient.
- The principle, written down: Jotstak borrows Markdown's shorthands (`#`, `-`, `|`, `>`) because `.md` files have to keep working, and invents none of its own.
- `@note your text` works inline, or indent the text under `@note`.

### Added (the page — A4, print-true)
- **A document is A4.** Page geometry is derived from the paper size and the 28px baseline, not typed in: 36 whole rows on a portrait page, 24 on landscape, and a vertical margin of whatever is left over, so the ruling stays in phase across a page break.
- **Print cuts pages; the screen stays continuous.** Print CSS keeps blocks and their margin notes together and never breaks a heading from what follows it.
- **A figure too wide for portrait gets its own landscape sheet** (`@page jot-landscape`) — real paper turned sideways, not a rotated picture.
- **Widths are measured, not guessed.** Label widths come from the shipped fonts' own advance tables plus a 3% safety margin; checked against a browser, the estimate runs +0.23% on average.
- **Automatic escalation:** a figure takes the text column, then the full page width, then a landscape page — and `width=` pins it if the author disagrees. A figure pinned somewhere too small scales to fit. Nothing is ever cut off.
- A figure that fits at 90% or better is scaled rather than sent to a landscape page, and says so as information rather than a warning.

### Changed (every surface shows the same page)
- **The playground preview is a sheet of A4, not a scrolling box.** It was `overflow: auto` with the document squeezed to the pane, so what you saw was a different width from what printed. The sheet now keeps its real width and zooms to fit, never past 1:1; the editor stays beside it and the window scrolls.
- **Docs demos stack source above output** and render a full sheet. Side by side left the page under half a sheet wide, which shrank a split tree to 57% and folded the margin channel under its anchor.
- **The landing page shows the margin channel** instead of folding it away — and stops reserving 23% of the sheet for a channel it wasn't drawing.
- Rows are separate grids rather than one document-wide grid, because a browser honours a named page only on a block in normal flow.

### Added (@tree nodes=boxed)
- **`nodes=boxed`** draws each node as a box and lays depth out in columns — the infographic treatment. `nodes=text` stays the default, because most trees sit mid-document where a grid of boxes would shout over the paragraph around them.
- Boxed split mirrors its flow as well as its text, so a left branch's children sit on its outer side rather than marching back toward the hub.
- A boxed node's line-height, border and margin are budgeted to total exactly one row.

### Fixed (mirrored trees)
- **Mirroring only applied to the top level.** Indentation came from `padding-left`; zeroing it for the mirror without adding `padding-right` left every deeper level with no indent at all, so a three-deep branch collapsed onto one spine and read as a flat list.

### Changed (dir=split arranges itself)
- **The renderer now balances a mind map's branches.** Unmarked branches used to all take the right-hand treatment, leaving the hub off-centre and the diagram lopsided — the author had to hand-place every branch with `<`, which breaks the "intent, not coordinates" principle the language is built on.
- Balance is by **subtree weight, not branch count**: one branch with five nodes is offset by several light ones rather than by a single one. Explicit `<` and `>` still win, as an override rather than the mechanism.
- Split is now **three columns — left group, hub, right group** — rather than one column per branch. Four branches used to produce four columns; the hub is now measurably centred and each side connects inward to it.

### Fixed (tree connectors and dividers)
- **Connectors had a visible one-pixel seam.** The spine was a border on the `<li>` patched by a third element for the last child, and the two did not quite meet. One pseudo-element per direction now, sharing the elbow row, so a seam is not possible.
- **`dir=split` rendered as two bare columns.** The connector rules were scoped to `right` and `down`, so split matched none of them: no lines, no trunk, no centring. It now has a centred root, a trunk, and mirrored connectors on left-marked branches.
- A stray orphan connector floated at the outer edge of a split diagram, because top-level branches inherited the generic elbow while hanging off the trunk.
- The split branch gap was half a row, putting the whole diagram — and everything below it — off the ruling.
- **The divider was invisible by construction**: a full-width terracotta line drawn exactly on a ruled line just makes one rule darker. It is a short centred mark now, and all three styles the schema promises (`line`, `dots`, `wave`) are actually implemented rather than falling through to the same rule.

### Added (M3 — diagrams, in progress)
- **`@tree`** renders a hierarchy with elbow connectors, `dir=right`/`down`/`split`, and `>`/`<` to pick a side under `split` — intent, not coordinates.
- Diagrams are laid out in **CSS, not SVG**, so a node can contain other blocks (a `@metric` inside a tree node), text stays selectable and searchable, and boxes inherit the design tokens and the row contract rather than re-implementing both.

### Added (documentation)
- **Getting started** and **Recipes** pages. Getting started leads with "paste a `.md` in, there is nothing to learn", then climbs one rung at a time, with a section on indentation because that is the one rule that changes meaning if you get it wrong.
- **Reference renamed to Functions**, split one page per function with prev/next navigation, and an index leading on **18 functions across 27 names**.
- **Live examples in the docs.** A remark plugin renders ```jot-demo fences at build time using the real renderer, so every example is actual output rather than a screenshot that rots. Source beside result, one per primitive.
- `@panel` is called out up front on both the start page and the panel page: it does almost everything the named cards do and takes matching parameters.

### Changed (build)
- Docs demos render in the **Markdown pipeline, not as components**. An Astro component costs compiler work per instance, and 38 of them exhausted a 4GB heap; a remark plugin is one function call per fence. Docs pages are now plain `.md` producing static HTML with **no renderer JavaScript shipped to the browser** — the playground is the only live renderer.
- Build runs through a small wrapper that pins the heap ceiling, so it behaves the same locally and in CI.

### Changed (the primitive cut, redone for composition)
- **`@panel` and `@columns` added as the general forms.** `@decision`, `@risk`, `@assumption`, `@persona`, `@metric` and `@callout` are now presets over `@panel` — identical output, different defaults. PM vocabulary is available but never required, and `@panel` is there when it does not fit.
- **Removed `@banner`** (a duplicate of `@cover`, which absorbed its `style`), **`@evidence`** (folded into `@quote`, which gained `date` and `tag`), **`@spread` and `@pillars`** (both became `@columns`), and **`@sprint`**, which contradicted the PRD's stated non-goal of not being a project tracker.
- 30 primitives → **27 names over 18 rendering functions**, six of them optional presets.
- `RENDER_FUNCTIONS` exported from the renderer, so the docs can state the function count without it drifting from the code.

### Added (documentation)
- **Generated primitive reference** at `/docs/reference`, built from the schema plus the renderer's function map at build time. Organised by function rather than alphabetically, because the honest answer to "how much is there to learn" is the function count.

### Fixed (inline marks)
- **The grammar and the renderer disagreed on two of four inline marks.** The TextMate grammar coloured `__x__` as underline and `==x==` as highlight; the renderer produced bold and literal text. `__x__` stays bold, because it is bold in Markdown and redefining it would break the superset promise. `==highlight==` is now implemented — safe, since core Markdown gives `==` no meaning.
- Doc-mode alert badges kept their pink pill and gained a stray em dash, because `.jot-badge[data-alert]` had equal specificity and came later in the stylesheet.
- A drawn block's clearance was half a row above and half below, an inline-flow idea that broke once every block became its own grid cell: the first block in a document lost its top half to the first-child margin reset and came out half a row short. Clearance is one full row below now.

### Added (composition)
- **Blocks nest.** A directive indented inside another block's body becomes a child block, parsed recursively through the same lexer and parser — so a `@metric` can live inside a `@decision`, and a table inside a card. Nothing is a special case. This is the change that stops the primitive set growing every time two ideas need to appear together.
- Nested diagnostics map back to real file lines, so an error inside a nested block still points at the right place.

### Changed (doc mode)
- **Doc mode is designed rather than undecorated.** It was "notebook with the rules switched off", which reads as a generic web page and makes writing `.jot` look pointless. It is now the same document in an editorial register: a white sheet on a grey backing, hairline rules instead of filled panels, quieter labels, sidenotes in the body face. The structure the author wrote still reads — that structure is the reason to use the tool.

### Changed (playground)
- Replaced the native `<select>` and loose buttons with a designed picker and a segmented control. The mode indicator slides from measured button geometry, so it stays correct when labels wrap or the webfont loads late, and it respects `prefers-reduced-motion`.
- Added a "Nested blocks" sample demonstrating composition.

### Fixed (composition and doc mode)
- Body prose rendered as a bulleted list: three sentences under `@risk` became three bullets and a wrapped line became a bullet of its own. Loose lines now go to markdown-it, so prose stays prose and `- item` becomes a list only when asked for.
- A nested blockquote kept its browser-default 16px margin, because `.jot-body > *` only reaches direct children. Nested containers are now row-disciplined too.
- Doc-mode card chrome summed to 27px where a row needs 28. Redesigning a surface without redoing the row arithmetic breaks the rhythm exactly as a maths error would.

### Added (M2 — cards, callouts, metadata)
- **The card mechanic is generalised**, described as data rather than written six times. `@risk`, `@assumption`, `@decision`, `@metric`, `@persona` and `@sprint` now render from one table — adding a seventh is an entry, not a renderer, and they stay visually consistent by construction.
- Status badges on cards, with dangerous values (`critical`, `high`, `off-track`, `deprecated`) marked as alerts.
- `@metric` leads with the figure and a trend arrow; `@evidence` renders as a quotation with structured attribution; `@callout` (and `@info`/`@warn`/`@tip`/`@question`) is coloured by its flavour; `@meta` renders as a chip row.
- **Parenthesised param lists** — `@primitive( ... )` may span lines (ADR-003). The inline form is unchanged.
- **Contextual spacing**: dividers and consecutive same-type blocks no longer pay a full row gap. Rows carry `data-kind` so spacing can depend on what a block is.
- `samples/showcase.jot`, a realistic PM document using seven primitives, now the playground's default sample.

### Fixed (M2)
- `@meta`'s chip row used a 7px row-gap; when the chips wrapped, that gap sat between wrapped lines and knocked the rest of the document off the ruling.
- `@metric`'s figure stretched its line: flex baseline alignment grows a row when a child's inline ascent exceeds the strut. The figure is a plain line box with a capped inline height now.
- `@evidence` had 26px of vertical padding where a row needs 28; it has no horizontal borders to make up the difference.
- `.jot-body p` out-specified `.jot-metric`, silently overriding its line-height — a cascade collision, not a maths error.

### Added (M1 — web playground)
- **The design system now reaches the website.** `renderThemeCss()` and `renderLayoutCss()` are injected by a shared `Base.astro` layout, so the site and the extension preview are styled from one set of tokens and cannot drift.
- `apps/web/scripts/copy-fonts.mjs` copies the bundled woff2 files into `public/fonts/` at build time, driven by the renderer's `FONT_FACES` list, and ships the SIL OFL licence text alongside them.
- **Playground**: split source/preview, live rendering in the browser, notebook/doc toggle, sample picker, and diagnostics surfaced per line. No backend — the same renderer the extension uses, running locally.
- **Landing page** rebuilt around the agreed positioning, with a hero that renders a real `.jot` document using the real renderer at build time rather than a mockup.
- Site header, footer and navigation styled from the tokens.
- Integration tests asserting the site actually consumes the design system and serves every font the CSS references.

### Fixed (M1)
- **The website was never styled.** The CSS generators were built, tested and snapshot-reviewed in step 2, and no page ever called them — the live site rendered in browser-default serif. Unit tests on a generator prove it generates; they say nothing about whether anything consumes the output.
- The docs logo was invisible on Starlight's dark theme (near-black wordmark). A cream-ink variant is now swapped in for dark mode.
- Footer text ran together where a JSX newline collapsed without a space.

### Added (M0 step 6 — closes M0)
- `scripts/extract-font-metrics.mjs` reads the shipped woff2 files and generates `src/font-metrics.ts`. The baseline offset is now **derived** from real metrics (19.856px) rather than hand-written. ADR-002 satisfied.
- Metric-matched fallback face: `"Lora Fallback"` overrides Georgia's ascent/descent/size to Lora's, so the baseline does not jump when the webfont finishes loading. Ships even when no webfonts are served.
- Styling for fenced code and Markdown tables, both on the 28px grid.
- 34 further tests: real repository `.md` files render with zero diagnostics and no content lost, Markdown constructs survive, font metrics still match the font file, and the ruled-line contract is machine-checked.

### Fixed (M0 step 6)
- **Fenced code blocks were destroyed.** A `#` inside a shell example became a heading and `- ` became a bullet, silently and with no diagnostic. The lexer now tracks fence state. This broke the superset promise on the project's own README and CONTRIBUTING.
- Unclosed code fences now warn instead of silently swallowing the rest of the document.
- Four-space indented code with no enclosing block is kept as an indented code block rather than warned about.
- **Inline `<code>` grew its line to 30px**, so any paragraph mentioning a filename drifted 2px per line. Its line box is now capped below the line strut.
- Long code lines wrapped instead of scrolling: `overflow-x: auto` added a ~15px scrollbar that is not a row multiple.
- **The margin channel was not row-disciplined.** A grid row is as tall as its tallest cell, so notes on browser-default margins pushed the body column off the ruling even when every block was correctly sized.
- Measured phase drift is now **0** across `README.md`, `CONTRIBUTING.md` and the sample `.jot` document.

### Added (M0 step 5)
- `render(source, { mode })` now does real work: lex → parse → HTML, in `notebook` or `doc` mode from one source.
- `renderLayoutCss(scope)`: the ruled-line contract as a stylesheet — 28px rows, rules painted at the **baseline offset** (19.63px, derived from Lora's metrics) so text sits *on* the line rather than between lines.
- Drawn blocks clear the ruling, carry half a row of clearance, and are sized so border + padding total exactly one row — keeping every block a whole number of rows tall.
- Grid layout pairs each block with its margin notes in the same row, so a note aligns with its anchor without any measurement or absolute positioning.
- Markdown delegated to markdown-it per ADR-001, with `html: false` so a `.jot` file can never inject markup into the preview or playground.
- First render pass covers headings, prose, lists, quotes, dividers, margin notes and `@decision`. Other primitives degrade to readable text with an info diagnostic rather than disappearing.
- `samples/problem-statement.jot` — the PRD's problem section, dogfooded as a real document.
- 20 render tests, including HTML-injection escaping and machine checks on the ruled-line contract.

### Fixed
- Wrapped list lines were becoming nested sub-bullets. A line without a list marker is now a lazy continuation of the item above, as in Markdown.
- Vertical rhythm drifted 8px after a blockquote and never recovered, because margins collapsed out of grid cells and gaps stopped being row multiples. Cells are now `flow-root`, so measured phase drift across the sample document is 0.

### Added (M0 step 4)
- `parse(source)` in `@jotstak/renderer`: builds an AST from the lexer's token stream. Groups indented lines under their block, shapes each body per the schema's `bodyShape` (`none`/`plain`/`keyed`/`indented`/`mixed`), nests lists by indentation, and carries source positions on every node.
- AST in `ast.ts` representing **meaning rather than syntax**: `# Overview` and `@heading Overview` produce the same `HeadingNode`, so the renderer has one code path per concept. Same for `---`/`@divider`, `> `/`@quote`, `>> `/`@note`, `- `/`@bullet`.
- Shortcode sugar resolved at parse time: `@warn` → `callout` with `flavor=warn` (alias onto an enum param), and `@callout warn` → the same, by consuming a leading bare word that matches the primitive's first enum param.
- 26 parser tests covering all five body shapes, shorthand/directive equivalence, list nesting, prose grouping, source positions, recovery from unknown primitives, and a plain `.md` file parsing with zero diagnostics.

### Added (M0 step 3)
- `lex(source)` in `@jotstak/renderer`: line-by-line lexer that classifies `.jot` source into 11 token types (directive, heading, bullet, numbered, divider, blockquote, margin_note, comment, body, blank, text).
- Inline param parsing on `@primitive` lines: validates types (enum, number, boolean) against `@jotstak/schema`, reports unknown params and missing required params.
- Source position tracking (line, column, indent) on every token for future LSP diagnostics.
- 26 lexer tests: line classification, param parsing, validation, multi-line documents, Windows line endings, and the invariant that a plain `.md` file produces zero diagnostics.

### Changed (deployment)
- Site now deploys via GitHub Actions (`cloudflare/wrangler-action@v4`) instead of Cloudflare's Git integration. Workflow auto-creates the Pages project on first run.
- `site` set to `https://jotstak.pages.dev` in `astro.config.mjs`; sitemap now generates; GitHub link added to docs sidebar.

### Added (M0 step 2)
- `renderThemeCss({ assetBase?, scope? })`: generates scoped CSS variables from the design tokens, semantic aliases re-pointed per `data-mode`, and `@font-face` rules for bundled fonts.
- `FONT_FACES` manifest: Lora (400, 400 italic, 500, 600), IBM Plex Mono (400, 500), Caveat (600), Inter (500, 600) via Fontsource, SIL OFL 1.1.
- `tokens` namespace export from `@jotstak/renderer`.
- Renderer tests (9) including a reviewed CSS snapshot.

### Added (going public)
- `LICENSE` (MIT, © 2026 Semilore-James); `license` and `repository` fields in manifests.
- Schema invariant tests (Vitest, 8 tests).

### Fixed
- Param name collisions between primitive-specific and universal params (`@footnote` `id`, `@doodle` `width`), caught by the new schema tests.
- Duplicate type re-export in `@jotstak/schema` (TS2484), caught by the first real `tsc -b`.
- Playground script is now null-safe and typed for strict `astro check`.

### Build
- Root solution `tsconfig.json`; `npm run typecheck` = `tsc -b` + `astro check`; `npm run build` = `tsc -b` + `astro build`.
- `package-lock.json` committed; `*.tsbuildinfo` ignored.

### Removed
- Placeholder site URL, placeholder GitHub link, and made-up install command from the web app.
- `pnpm-workspace.yaml`.

### Decided
- Stack: Astro + Cloudflare Pages, VS Code Marketplace + Open VSX, Buttondown, Supabase deferred.
- Icons: Lucide (MIT), opt-in per block, roughened in notebook mode.
- Craft & portfolio piece: MIT license, free + OSS.
- `.jot` is a superset of Markdown (v1 requirement).
- Deferred post-v1: `@doodle`, `@footnote`, `@journey` swim lanes, MCP rendering layer.

### Open
- Domain registration, GitHub org/repo, Marketplace publisher ID (needed by M4).
- Icon roughening amplitude (needs a visual prototype).
