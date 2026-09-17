# Changelog

All notable changes to Jotstak are recorded here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Monorepo skeleton: `packages/{renderer,schema,icons}`, `apps/{extension,web}`, `templates/`, CI workflows.
- Product requirements document (`PRD.md`), premortem, case-study skeleton.
- Build journal (`brag/JOURNAL.md`).
- `.gitattributes` enforcing LF line endings.

### Changed
- **Renamed Jotter → Jotstak.** Document extension `.jtr` → `.jot`; TextMate grammar is now `jot.tmLanguage.json` with scope `source.jot`; extension commands are `jotstak.*`; packages are `@jotstak/*`.
- **pnpm → npm workspaces.** Root scripts, CI, deploy and publish workflows updated; internal deps use `"*"`.
- Milestones reordered playground-first (see PRD §14).
- Dependencies moved to current majors: Astro 7, Starlight 0.42, Vitest 5, vsce 4, ovsx 1; TypeScript 6.0.3 (7 blocked by `@astrojs/check`). `@types/vscode` pinned to 1.90.0 to match the engine floor.
- Docs content moved to `src/content/docs/docs/` so Starlight serves `/docs` instead of claiming `/`.

- `@footnote` now uses the universal `id` param (`@footnote id=<id>`); `@doodle` drawing area params renamed `width`/`height` → `cols`/`rows`.
- Web deploy workflow is manual-only until M1 (no Cloudflare project or secrets yet).

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
