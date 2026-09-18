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
| `packages/icons` | Lucide (MIT) icons with a per-mode treatment: roughened in notebook mode, clean in doc mode. Opt-in per block. |
| `apps/extension` | VS Code extension (Marketplace + Open VSX). |
| `apps/web` | Astro site: marketing + playground + docs (Starlight), one build. |
| `templates` | Starter `.jot` files (PRD, retro, persona, …). |

## Stack

- Site: **Astro** on **Cloudflare Pages**; DNS + SSL on the **Cloudflare** zone.
- Extension: **VS Code Marketplace** (primary) + **Open VSX**.
- Email capture: **Buttondown**.
- Deferred backend (cloud sync / team / hosted render): **Supabase**, not built yet.

## Develop

```bash
npm install
npm run dev:web     # Astro site + playground
npm run dev:ext     # extension watch build (F5 in VS Code to launch)
npm run typecheck   # tsc -b across every workspace
```

## License

Not yet chosen (MIT / Apache-2.0 / source-available — see PRD open questions). Do not assume a license until this is set.
