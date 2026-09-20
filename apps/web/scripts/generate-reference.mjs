// Generates one docs page per rendering FUNCTION, from the schema plus the
// renderer's own function map — so the documentation cannot drift from the tool.
//
// One page per function rather than one long reference, because 18 short pages
// with prev/next are readable and one 27-section page is not. Each page shows
// the real rendered output, built with the actual renderer, not a screenshot.

import { PRIMITIVES, UNIVERSAL_PARAMS, getPrimitive } from "@jotstak/schema";
import { RENDER_FUNCTIONS, renderThemeCss, renderLayoutCss } from "@jotstak/renderer";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = join(here, "..", "src", "content", "docs", "docs");
const fnDir = join(docsDir, "functions");
const publicDir = join(here, "..", "public");

// One stylesheet for every demo on the site, scoped so it cannot touch
// Starlight's own chrome. Linked once from the docs head.
mkdirSync(publicDir, { recursive: true });
const DEMO_CHROME = `
.jot-demo { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; margin: 1rem 0 1.5rem; align-items: start; }
.jot-demo.stacked { grid-template-columns: minmax(0,1fr); }
.jot-demo-src { margin: 0; padding: 12px 14px; font-size: 12.5px; line-height: 20px; border-radius: 6px;
  background: var(--sl-color-gray-6, #f6f6f6); border: 1px solid var(--sl-color-gray-5, #e0e0e0);
  overflow-x: auto; white-space: pre; }
.jot-demo-src code { background: none; padding: 0; font-size: inherit; }
.jot-demo-out { border-radius: 6px; border: 1px solid #e4d5be; overflow: hidden; }
/* Demos are narrow, so the margin channel folds under its anchor. */
.jot-demo-out .jot-doc { grid-template-columns: 1fr; max-width: none; padding: 10px 16px; }
.jot-demo-out .jot-body, .jot-demo-out .jot-aside { grid-column: 1; }
.jot-demo-out .jot-note { padding-left: 24px; }
@media (max-width: 900px) { .jot-demo { grid-template-columns: minmax(0,1fr); } }
`;

writeFileSync(
  join(publicDir, "jotstak-demo.css"),
  renderThemeCss({ assetBase: "", scope: ".jot-demo-out" }) +
    renderLayoutCss(".jot-demo-out") +
    DEMO_CHROME,
);

/** Plain-language note per function, and the order they should be read in. */
const FUNCTIONS = {
  panel: {
    title: "Panel",
    blurb:
      "A bounded region that holds anything — fields, prose, or other blocks. **`@panel` does almost everything the named cards do, and takes the same parameters**: `@risk`, `@decision`, `@assumption`, `@persona`, `@metric` and `@callout` are presets that set its label, badge and accent for you. Reach for `@panel` when none of them fit, or when a document should not read as jargon.",
  },
  columns: { title: "Columns", blurb: "Places regions side by side. Each `key:` in the body becomes a column." },
  quote: { title: "Quote", blurb: "Someone else's words, with as much provenance as you have. A pull quote and a research citation are the same thing — one just attaches less attribution." },
  margin: { title: "Margin notes", blurb: "An annotation in the margin channel, beside the block it follows. The `>>` shorthand is how most people write these." },
  heading: { title: "Headings", blurb: "Section titles. `@cover` is the full-width variant that introduces a major section." },
  list: { title: "Lists", blurb: "Bullets and numbered lists, nested by indentation. Usually written with plain Markdown `-` and `1.`." },
  divider: { title: "Dividers", blurb: "A horizontal break between sections." },
  table: { title: "Tables", blurb: "Rows and columns without pipes. Markdown pipe tables still parse, so pasted files work." },
  chips: { title: "Document metadata", blurb: "A compact row of document metadata at the top of a file." },
  tree: { title: "Trees", blurb: "A hierarchy defined by indentation." },
  matrix: { title: "Matrix", blurb: "A 2×2 with named axes." },
  timeline: { title: "Timeline", blurb: "Events along an axis." },
  journey: { title: "Journey", blurb: "Stages left to right, optionally in parallel lanes." },
  star: { title: "Star model", blurb: "A central entity with satellites around it." },
  sticky: { title: "Sticky notes", blurb: "Clustered notes, for synthesis." },
  freeform: { title: "Freeform", blurb: "The escape hatch, for what the named functions cannot express. Reach for a named function first." },
  inline: { title: "Inline marks", blurb: "Marks that sit inside a line rather than forming a block." },
  config: { title: "Page setup", blurb: "Configures the document. Renders nothing itself." },
};

const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/</g, "&lt;");

/** YAML-safe scalar: these descriptions contain colons, which break bare frontmatter. */
const yaml = (s) => JSON.stringify(String(s).replace(/\s+/g, " ").trim());

function paramTable(params) {
  if (params.length === 0) return "_No parameters of its own._\n";
  const rows = params.map((p) => {
    const type =
      p.type === "enum" ? (p.enumValues ?? []).map((v) => `\`${v}\``).join(" · ") : `\`${p.type}\``;
    return `| \`${p.name}\` | ${type} | ${p.required ? "**yes**" : "no"} | ${p.default ? `\`${p.default}\`` : "—"} | ${esc(p.description)} |`;
  });
  return ["| Param | Type | Required | Default | Meaning |", "| --- | --- | --- | --- | --- |", ...rows].join("\n") + "\n";
}

// Demos are plain fenced blocks. A remark plugin renders them during Markdown
// processing, so the compiler's cost per demo is one function call rather than
// an Astro component instance — which is what exhausted the heap at 38 of them.
const demo = (code) => "```jot-demo\n" + code + "\n```\n\n";

if (existsSync(fnDir)) rmSync(fnDir, { recursive: true });
mkdirSync(fnDir, { recursive: true });

const entries = Object.entries(FUNCTIONS).filter(([fn]) => (RENDER_FUNCTIONS[fn] ?? []).length > 0);
let order = 0;

for (const [fn, meta] of entries) {
  const names = RENDER_FUNCTIONS[fn];
  const specs = names.map(getPrimitive).filter(Boolean);
  if (specs.length === 0) continue;
  order += 1;

  let md = `---
title: ${yaml(meta.title)}
description: ${yaml(meta.blurb.replace(/[*`\[\]]/g, "").slice(0, 150))}
sidebar:
  order: ${order}
---

<!-- GENERATED by apps/web/scripts/generate-reference.mjs — do not edit by hand. -->

${meta.blurb}

`;

  if (names.length > 1) {
    md += `Written as ${names.map((n) => `\`@${n}\``).join(", ")} — all one function, so they render through the same code and stay visually consistent.\n\n`;
  }

  for (const spec of specs) {
    md += `## \`@${spec.name}\`\n\n`;
    if (spec.aliases?.length) md += `Also written as ${spec.aliases.map((a) => `\`@${a}\``).join(", ")}.\n\n`;
    md += `${spec.summary}\n\n`;

    if (spec.examples.length > 0) {
      md += demo(spec.examples[0]);
    }

    md += `<details>\n<summary>Parameters</summary>\n\n${paramTable(spec.params)}\n</details>\n\n`;

    if (spec.examples.length > 1) {
      // Every example renders, because an example of a *visual* parameter that
      // shows no picture documents nothing — `nodes=boxed` shipped invisible
      // for exactly this reason. They sit inside <details> so they cost no page
      // space until opened. Rendering them is cheap now: a demo is one call in
      // the remark plugin, not the Astro component instance whose per-instance
      // compile cost put this build over the heap limit at 59 of them.
      md += `<details>\n<summary>More examples</summary>\n\n`;
      for (const ex of spec.examples.slice(1)) md += demo(ex);
      md += `</details>\n\n`;
    }
  }

  writeFileSync(join(fnDir, `${fn}.md`), md);
}

// Index page for the group.
writeFileSync(
  join(fnDir, "index.md"),
  `---
title: "All functions"
description: "Every rendering function in Jotstak, and the names that map onto it."
sidebar:
  order: 0
---

Jotstak has **${entries.length} rendering functions** across **${PRIMITIVES.length} names**. Several
names are presets over the same function — \`@risk\` and \`@decision\` are both a
panel and produce identical markup with different defaults. **Learn the
functions; the presets are optional shorthand.**

Everything here is optional. \`.jot\` is a superset of Markdown, so a file using
none of it still renders.

| Function | Written as |
| --- | --- |
${entries.map(([fn, m]) => `| [${m.title}](/docs/functions/${fn}/) | ${RENDER_FUNCTIONS[fn].map((n) => `\`@${n}\``).join(", ")} |`).join("\n")}

## Parameters every function accepts

${paramTable(UNIVERSAL_PARAMS)}
`,
);

console.log(`wrote ${entries.length} function pages + index (${PRIMITIVES.length} primitives)`);
