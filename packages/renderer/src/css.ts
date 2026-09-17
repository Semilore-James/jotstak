// Turns the design tokens into CSS the renderer's HTML is styled with.
//
// Returned as a string rather than shipped as a .css file because every host needs
// it differently: the playground injects it, the VS Code webview inlines it, HTML
// export embeds it, and a future MCP layer returns it alongside the markup.
//
// Everything is scoped under one selector (default `.jotstak`). A rendered document
// is embedded inside other pages — the Astro site, a VS Code webview — and must never
// restyle its host, so nothing here targets :root, html or body.

import { colors, notebookLayout, shapes, spacing, typography } from "./tokens.js";

export interface ThemeCssOptions {
  /**
   * Base URL the host serves font files from. When set, @font-face rules point at
   * `${assetBase}/fonts/<file>`. When omitted, no @font-face rules are emitted and
   * the font stacks fall back to system serif/mono/cursive faces.
   */
  assetBase?: string;
  /** Selector every rule is scoped under. */
  scope?: string;
}

export interface FontFace {
  family: string;
  weight: number;
  style: "normal" | "italic";
  /** File name the host must serve under `${assetBase}/fonts/`. */
  file: string;
  /** Where the file lives in node_modules, for hosts that copy fonts at build time. */
  source: string;
}

// Only the weights the type scale actually uses, Latin subset. All four families
// are SIL Open Font License 1.1; bundling requires shipping the license text.
const face = (pkg: string, family: string, weight: number, style: "normal" | "italic" = "normal"): FontFace => {
  const file = `${pkg}-latin-${weight}-${style}.woff2`;
  return { family, weight, style, file, source: `@fontsource/${pkg}/files/${file}` };
};

export const FONT_FACES: readonly FontFace[] = [
  face("lora", "Lora", 400),
  face("lora", "Lora", 400, "italic"),
  face("lora", "Lora", 500),
  face("lora", "Lora", 600),
  face("ibm-plex-mono", "IBM Plex Mono", 400),
  face("ibm-plex-mono", "IBM Plex Mono", 500),
  face("caveat", "Caveat", 600),
  face("inter", "Inter", 500),
  face("inter", "Inter", 600),
];

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

// Numbers become px, except ratios, which are unitless by nature.
const cssValue = (key: string, value: string | number | boolean) =>
  typeof value === "number" && !/ratio$/i.test(key) ? `${value}px` : String(value);

/** Flattens a nested token object into `--jot-<path>: value` declarations. */
function flatten(prefix: string, obj: object, out: string[] = []): string[] {
  for (const [key, value] of Object.entries(obj)) {
    const name = `${prefix}-${kebab(key)}`;
    if (value !== null && typeof value === "object") flatten(name, value, out);
    else out.push(`  ${name}: ${cssValue(key, value)};`);
  }
  return out;
}

const stack = {
  serif: `"${typography.body.family}", Georgia, "Times New Roman", serif`,
  heading: `"${typography.headline.family}", Georgia, "Times New Roman", serif`,
  mono: `"${typography.code.family}", ui-monospace, "Cascadia Mono", Consolas, monospace`,
  margin: `"${typography.margin.family}", "Segoe Print", "Bradley Hand", cursive`,
  label: `"${typography.label.family}", system-ui, "Segoe UI", sans-serif`,
};

export function renderThemeCss(options: ThemeCssOptions = {}): string {
  const scope = options.scope ?? ".jotstak";
  const base = options.assetBase?.replace(/\/+$/, "");

  const fontFaces = base === undefined ? [] : FONT_FACES.map((f) =>
    [
      "@font-face {",
      `  font-family: "${f.family}";`,
      `  font-style: ${f.style};`,
      `  font-weight: ${f.weight};`,
      "  font-display: swap;",
      `  src: url("${base}/fonts/${f.file}") format("woff2");`,
      "}",
    ].join("\n"),
  );

  const tokenVars = [
    ...flatten("--jot-color", colors),
    ...flatten("--jot-type", typography),
    ...flatten("--jot-space", spacing),
    ...flatten("--jot-shape", shapes),
    ...flatten("--jot-layout", notebookLayout),
  ];

  // Semantic aliases: what renderer styles actually reference. Mode rules below
  // re-point them, so primitive CSS never needs to know which mode it is in.
  const semantic = [
    `  --jot-font-body: ${stack.serif};`,
    `  --jot-font-heading: ${stack.heading};`,
    `  --jot-font-mono: ${stack.mono};`,
    `  --jot-font-margin: ${stack.margin};`,
    `  --jot-font-label: ${stack.label};`,
    "  --jot-rhythm: var(--jot-space-baseline-grid);",
    "  --jot-accent: var(--jot-color-accent-terracotta);",
  ];

  const notebookMode = [
    "  --jot-surface: var(--jot-color-notebook-paper);",
    "  --jot-surface-elevated: var(--jot-color-notebook-paper-elevated);",
    "  --jot-rule: var(--jot-color-notebook-rule-lines);",
    "  --jot-ink: var(--jot-color-notebook-ink);",
    "  --jot-ink-muted: var(--jot-color-notebook-ink-muted);",
    "  --jot-card-shadow: var(--jot-shape-elevation-card);",
  ];

  const docMode = [
    "  --jot-surface: var(--jot-color-doc-sheet);",
    "  --jot-surface-elevated: var(--jot-color-doc-sheet);",
    "  --jot-rule: transparent;",
    "  --jot-ink: var(--jot-color-doc-ink);",
    "  --jot-ink-muted: var(--jot-color-doc-ink-muted);",
    "  --jot-card-shadow: none;",
  ];

  return [
    ...fontFaces,
    `${scope} {\n${[...tokenVars, ...semantic].join("\n")}\n}`,
    `${scope}[data-mode="notebook"] {\n${notebookMode.join("\n")}\n}`,
    `${scope}[data-mode="doc"] {\n${docMode.join("\n")}\n}`,
    [
      `${scope} {`,
      "  background: var(--jot-surface);",
      "  color: var(--jot-ink);",
      "  font-family: var(--jot-font-body);",
      `  font-size: ${typography.body.lg.size};`,
      "  line-height: var(--jot-rhythm);",
      "}",
    ].join("\n"),
  ].join("\n\n") + "\n";
}
