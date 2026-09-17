# Jotstak

*A code-first document tool for product managers, rendered as a warm, hand-kept notebook.*

Write documents in a small structured language (`.jot`) and render them as a spatial notebook on ruled cream paper. Notebook mode for the handmade feel; doc mode for clean A4 output. Same source, two surfaces. Plain text, Git-versioned, no lock-in.

See [jotter-overview.md](jotter-overview.md) for the full product thesis and [PRD.md](PRD.md) for v1 requirements. Build progress is journaled in [brag/JOURNAL.md](brag/JOURNAL.md).

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
