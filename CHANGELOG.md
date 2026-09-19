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
