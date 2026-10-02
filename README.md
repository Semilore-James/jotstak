# Jotstak

*A code-first document tool for product managers: prose, tables and diagrams in one plain-text file, rendered as a warm, hand-kept notebook.*

Writing a single PRD usually means scattering it across five tools — one for prose, another for tables, another for diagrams, another for tasks. Context gets lost, versions drift, and nobody joining later can reconstruct where anything lives.

Jotstak puts all of it in one `.jot` file and renders it as a spatial notebook on ruled cream paper. Notebook mode for the handmade feel; doc mode for clean A4 output. Same source, two surfaces. Plain text, Git-versioned, no lock-in.

`.jot` is a **superset of Markdown** — any `.md` file renders unchanged, so there's nothing to learn before you start.

Start with [CONTRIBUTING.md](CONTRIBUTING.md) to get a dev environment running, and [`docs/decisions`](docs/decisions) for the reasoning behind the parser architecture and the ruled-line layout.

## Monorepo layout

| Path | What it is |
| --- | --- |
| `packages/renderer` | Framework-free `.jot` → HTML. The shared heart. Imported by the extension preview AND the web playground. |
| `packages/schema` | Primitive definitions — single source of truth for LSP autocomplete and generated docs reference. |
| `packages/docx` | A `.jot` document as a Word file (.docx) for Word and Google Docs. No dependencies: runs in the browser and in Node. |
| `packages/icons` | **Not built yet.** The plan for `@icon`: Lucide (MIT) icons, roughened in notebook mode and clean in doc mode. |
| `apps/extension` | VS Code extension (Marketplace + Open VSX). |
| `apps/web` | Astro site: marketing + playground + docs (Starlight), one build. |
| `templates` | Starter `.jot` files: a PRD and a retro so far. |

## Stack

- Site: **Astro** on **Cloudflare Pages**, at [jotstak.pages.dev](https://jotstak.pages.dev).
- Extension: **VS Code Marketplace** (primary) + **Open VSX**.
- Email capture: **Buttondown**, planned.
- Deferred backend (cloud sync / team / hosted render): **Supabase**, not built yet.

## Develop

```bash
npm install
npm run dev:web     # Astro site + playground
npm run dev:ext     # extension watch build (F5 in VS Code to launch)
npm run typecheck   # tsc -b across every workspace
```

## License

[MIT](LICENSE) © 2026 Semilore-James.
