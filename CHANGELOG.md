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
