// @jotstak/schema — the definitive list of .jot primitives.
// The LSP reads this for autocomplete + hover; the docs site generates the
// reference pages from it. One edit here propagates to editor and docs alike.
//
// Design principles:
//   1. Intent, not coordinates. Primitives express arrangement semantically
//      (dir=, layout=, at 12, at top-left, >/< for sides) — never pixel positions.
//      The renderer places things. The only free-placement escape hatch is @doodle.
//   2. Minimal punctuation. No pipe tables. Body content uses indentation + key:value
//      or plain lines. Commas only in compact table rows.
//   3. Indentation is structure. Trees, nested lists, and record-form tables
//      derive hierarchy from indentation so they diff cleanly.
//   4. No automatic decoration. Nothing renders that the author did not ask for.
//      Icons in particular are opt-in per block (see UNIVERSAL_PARAMS) — the schema
//      SUGGESTS a sensible icon per primitive for autocomplete, but never applies one.
//      A glyph means something because the author chose to put it there.

export type PrimitiveGroup =
  | "structure"
  | "text"
  | "lists"
  | "diagrams"
  | "pm-artifacts"
  | "expressive";

export interface ParamSpec {
  name: string;
  type: "string" | "number" | "boolean" | "enum" | "block";
  required: boolean;
  description: string;
  enumValues?: string[];
  default?: string;
}

export interface PrimitiveSpec {
  /** The @-name typed in source, e.g. "decision", "star_model". */
  name: string;
  /** Aliases that also resolve to this primitive (e.g. @warn → @callout warn). */
  aliases?: string[];
  group: PrimitiveGroup;
  summary: string;
  params: ParamSpec[];
  /** Body lines: "none" | "plain" | "keyed" | "indented" | "mixed". */
  bodyShape: "none" | "plain" | "keyed" | "indented" | "mixed";
  /** Does this primitive cut the ruled lines to breathe (a "drawn" block)? */
  breaksRuling: boolean;
  examples: string[];
}

// ---------------------------------------------------------------------------
// DOCUMENT-LEVEL (metadata & page setup)
// ---------------------------------------------------------------------------

const meta: PrimitiveSpec = {
  name: "meta",
  group: "structure",
  summary:
    "Document metadata. Freeform `key: value` lines — project, pillar, status, owner, updated, whatever your team tracks. Renders as a compact chip row at the top of the document. This is data, not decoration: a future cross-file search reads @meta, which is why it is one extensible block rather than a primitive per field.",
  params: [
    { name: "show", type: "boolean", required: false, description: "Render the chip row. Set false to keep the metadata for tooling but hide it from the page.", default: "true" },
  ],
  bodyShape: "keyed",
  breaksRuling: false,
  examples: [
    "@meta\n  project: Autonomous Agent Orchestrator\n  pillar: Reliability & Traceability\n  status: active\n  owner: @alex\n  updated: 2026-09-17",
  ],
};

const page: PrimitiveSpec = {
  name: "page",
  group: "structure",
  summary:
    "Page setup for the rendered document. Controls which margin channels exist, how wide they are, and what the paper ruling looks like. Declare once near the top; it applies to the whole document. Every field is optional with a sensible default.",
  params: [
    { name: "margin", type: "enum", required: false, description: "Which margin channels exist for notes.", enumValues: ["right", "left", "both", "none"], default: "right" },
    { name: "margin_width", type: "enum", required: false, description: "How much page the margin channel takes.", enumValues: ["narrow", "normal", "wide"], default: "normal" },
    { name: "rule", type: "enum", required: false, description: "Paper ruling behind the text.", enumValues: ["ruled", "dotted", "grid", "blank"], default: "ruled" },
    { name: "rhythm", type: "number", required: false, description: "Baseline grid in px. Everything locks to this; drawn blocks round up to whole multiples of it.", default: "28" },
  ],
  bodyShape: "none",
  breaksRuling: false,
  examples: [
    "@page margin=both rule=ruled",
    "@page margin=none rule=blank",
    "@page margin=right margin_width=wide rhythm=32",
  ],
};

// ---------------------------------------------------------------------------
// STRUCTURE
// ---------------------------------------------------------------------------

const heading: PrimitiveSpec = {
  name: "heading",
  group: "structure",
  summary:
    "Section heading. Level 1–3 set by param or shorthand: `# `, `## `, `### ` at line start. Plain `@heading` defaults to level 1.",
  params: [
    { name: "level", type: "enum", required: false, description: "Heading depth.", enumValues: ["1", "2", "3"], default: "1" },
  ],
  bodyShape: "plain",
  breaksRuling: false,
  examples: [
    "@heading Overview",
    "## Goals and non-goals",
  ],
};

const bullet: PrimitiveSpec = {
  name: "bullet",
  group: "structure",
  summary:
    "Bullet list. Nesting up to 3 levels via indentation. Shorthand: `- ` at line start (nested by indent). No `@` needed for plain bullets — the parser recognizes `- ` lines.",
  params: [],
  bodyShape: "indented",
  breaksRuling: false,
  examples: [
    "- First item\n  - Nested\n    - Deep nested",
  ],
};

const numbered: PrimitiveSpec = {
  name: "numbered",
  group: "structure",
  summary:
    "Numbered list. Shorthand: `1. ` at line start. Auto-numbers; the actual digit you type is ignored.",
  params: [],
  bodyShape: "indented",
  breaksRuling: false,
  examples: [
    "1. First\n2. Second\n   1. Sub-item",
  ],
};

const divider: PrimitiveSpec = {
  name: "divider",
  group: "structure",
  summary: "Horizontal rule between sections. Shorthand: `---` on its own line.",
  params: [
    { name: "style", type: "enum", required: false, description: "Visual style.", enumValues: ["line", "dots", "wave"], default: "line" },
  ],
  bodyShape: "none",
  breaksRuling: false,
  examples: ["@divider", "---", "@divider style=wave"],
};

const cover: PrimitiveSpec = {
  name: "cover",
  group: "structure",
  summary:
    "Section cover / divider page. A full-width visual break introducing a major section. Takes a title and optional subtitle.",
  params: [
    { name: "subtitle", type: "string", required: false, description: "Smaller text below the title." },
  ],
  bodyShape: "plain",
  breaksRuling: true,
  examples: [
    '@cover Discovery phase\n  subtitle="Weeks 1–3"',
  ],
};

// ---------------------------------------------------------------------------
// TEXT
// ---------------------------------------------------------------------------

const note: PrimitiveSpec = {
  name: "note",
  group: "text",
  summary:
    "Margin note in the handwritten typeface. By default it anchors to the block it follows in source and floats beside it in the margin channel, joined by a tick rule. Shorthand: `>> ` at line start. Overlapping notes are nudged apart by the renderer — you never place them by hand.",
  params: [
    { name: "side", type: "enum", required: false, description: "Which margin channel. `right` is default; `left` uses the left channel (requires @page margin: left or both).", enumValues: ["right", "left"], default: "right" },
    { name: "align", type: "enum", required: false, description: "Vertical alignment against its anchor block — matters when the anchor is tall, like a diagram.", enumValues: ["top", "middle", "bottom"], default: "top" },
    { name: "at", type: "string", required: false, description: "Anchor to a specific block by its `id=` instead of the preceding block. Lets you group notes together in source while still pointing at the right place." },
    { name: "loose", type: "boolean", required: false, description: "Detach from any anchor — no tick rule. The note just flows in the margin at this point. For general asides about a whole section.", default: "false" },
  ],
  bodyShape: "plain",
  breaksRuling: false,
  examples: [
    ">> revisit this at scale",
    "@note side=left align=middle\n  The fan-out here is the risky part.",
    '@decision title="Use Astro" id=astro-choice\n\n@note at=astro-choice\n  Revisit when traffic grows past the free tier.',
    "@note loose\n  General thoughts on this section, not tied to any one line.",
  ],
};

const quote: PrimitiveSpec = {
  name: "quote",
  group: "text",
  summary:
    "Block quote with optional attribution. Shorthand: `> ` at line start for the body.",
  params: [
    { name: "by", type: "string", required: false, description: "Attribution — who said it." },
    { name: "source", type: "string", required: false, description: "Where it came from (interview, doc, URL)." },
  ],
  bodyShape: "plain",
  breaksRuling: false,
  examples: [
    '@quote by="User P7" source="Discovery interview 3"\n  I just want it to not lose my work.',
    "> A quick inline quote",
  ],
};

const callout: PrimitiveSpec = {
  name: "callout",
  aliases: ["info", "warn", "tip", "question"],
  group: "text",
  summary:
    "Boxed callout. The flavor is the first word after `@callout`, or use the alias directly: `@tip`, `@warn`, `@info`, `@question`. No `type=` param — the flavor IS the shortcode.",
  params: [
    { name: "flavor", type: "enum", required: false, description: "Callout flavor. Can also be used as the shortcode name directly.", enumValues: ["info", "warn", "tip", "question"], default: "info" },
  ],
  bodyShape: "plain",
  breaksRuling: false,
  examples: [
    "@callout warn\n  This metric is lagging by two sprints.",
    "@tip\n  Export to HTML before the stakeholder meeting.",
  ],
};

const footnote: PrimitiveSpec = {
  name: "footnote",
  group: "text",
  summary:
    "Footnote. Reference in body text with `[^id]`, then define the note anywhere with `@footnote id`. Renders at the bottom of the page in notebook mode.",
  params: [
    { name: "id", type: "string", required: true, description: "Unique footnote identifier, referenced in text as [^id]." },
  ],
  bodyShape: "plain",
  breaksRuling: false,
  examples: [
    "See the original research[^disco1].\n\n@footnote disco1\n  Findings from the March discovery sprint, slide 14.",
  ],
};

// ---------------------------------------------------------------------------
// LISTS OF INFORMATION
// ---------------------------------------------------------------------------

const table: PrimitiveSpec = {
  name: "table",
  group: "lists",
  summary:
    "A table. No pipes: first row is the header, rows are comma-separated (quote cells that contain commas). Use the record form for few rows with rich cells. Pipe-tables still parse for paste-in compatibility.",
  params: [
    { name: "style", type: "enum", required: false, description: "Visual style.", enumValues: ["ruled", "sketch", "plain"], default: "ruled" },
    { name: "sep", type: "enum", required: false, description: "Cell delimiter for compact rows.", enumValues: ["comma", "tab"], default: "comma" },
    { name: "align", type: "string", required: false, description: 'Per-column alignment, e.g. "left,left,right".' },
  ],
  bodyShape: "mixed",
  breaksRuling: true,
  examples: [
    "@table\n  Feature, Status, Owner\n  Search, Shipped, Ana\n  Export, In progress, Ben",
    "@table\n  - Feature: Search\n    Status: Shipped\n    Owner: Ana\n  - Feature: Export\n    Status: In progress\n    Owner: Ben",
  ],
};

const tree: PrimitiveSpec = {
  name: "tree",
  group: "lists",
  summary:
    "A hierarchy defined by indentation. `dir` sets growth direction. Under dir=split, prefix a node with > (right) or < (left) for a bilateral mind-map.",
  params: [
    { name: "dir", type: "enum", required: false, description: "Growth direction.", enumValues: ["down", "right", "left", "up", "split"], default: "down" },
    { name: "style", type: "enum", required: false, description: "Line style between nodes.", enumValues: ["solid", "dashed", "rounded"], default: "solid" },
  ],
  bodyShape: "indented",
  breaksRuling: true,
  examples: [
    "@tree dir=right\n  Orders\n    Customer\n      Segment\n    Product",
    "@tree dir=split\n  Central idea\n    > Pillar A\n      > Sub-point\n    < Pillar B",
  ],
};

const pillars: PrimitiveSpec = {
  name: "pillars",
  group: "lists",
  summary:
    "Grouped feature-area columns. Each pillar is a named column with items beneath it. Define each pillar with `pillar <name>` and indent items below it.",
  params: [
    { name: "cols", type: "number", required: false, description: "Max columns per row (wraps if more pillars than cols). Default: auto-fit." },
  ],
  bodyShape: "indented",
  breaksRuling: true,
  examples: [
    "@pillars\n  pillar Core\n    Search\n    Export\n    Preview\n  pillar Growth\n    Templates\n    Sharing\n  pillar Platform\n    API\n    Plugins",
  ],
};

// ---------------------------------------------------------------------------
// DIAGRAMS / VISUAL THINKING
// ---------------------------------------------------------------------------

const star_model: PrimitiveSpec = {
  name: "star_model",
  group: "diagrams",
  summary:
    "Relationship map using real star-schema vocabulary. The bare text after the shortcode is the model's TITLE; `fact:` names the central entity; each `dim` is a satellite. Dimensions auto-arrange clockwise from 12 in written order; override per-dimension with `at <clock|anchor>`. Terse form `dim: A, B, C` when you don't care about placement.",
  params: [
    { name: "layout", type: "enum", required: false, description: "Arrangement mode.", enumValues: ["auto", "clock", "fan", "list"], default: "auto" },
  ],
  bodyShape: "mixed",
  breaksRuling: true,
  examples: [
    '@star_model Telemetry Data Warehouse layout=clock\n  fact: TaskExecutionEvents\n  dim Agents at 12\n  dim Models at 3\n  dim LatencyBuckets at 6\n  dim CostCenters at 9',
    "@star_model Order analytics\n  fact: Orders\n  dim: Customer, Product, Date, Store",
    "@star_model Event model\n  fact: TaskExecutionEvents\n    event_uuid: uuid, pk\n    agent_id: fk -> Agents\n    latency_ms: int\n  dim Agents at 12\n  dim Models at 4",
  ],
};

const journey: PrimitiveSpec = {
  name: "journey",
  group: "diagrams",
  summary:
    "User journey / flow. Stages run left to right. Each stage has a name and an optional emotion (happy/neutral/frustrated). Add touchpoints, actions, or pain points as indented lines under a stage. Use `track` to define parallel swim lanes (e.g. frontstage / backstage).",
  params: [
    { name: "title", type: "string", required: false, description: "Journey title shown above the diagram." },
    { name: "dir", type: "enum", required: false, description: "Flow direction.", enumValues: ["horizontal", "vertical"], default: "horizontal" },
  ],
  bodyShape: "indented",
  breaksRuling: true,
  examples: [
    '@journey title="Onboarding"\n  stage Discover feeling=happy\n    Finds the landing page\n    Tries the playground\n  stage Install feeling=neutral\n    Copies the command\n    Waits for download\n  stage First doc feeling=happy\n    Opens welcome.jot\n    Edits and sees it render',
    '@journey title="Support request"\n  track Customer\n    stage Report feeling=frustrated\n      Hits a bug\n    stage Wait feeling=frustrated\n      Checks email\n  track Support\n    stage Triage feeling=neutral\n      Reads the ticket\n    stage Fix feeling=happy\n      Ships patch',
  ],
};

const matrix: PrimitiveSpec = {
  name: "matrix",
  group: "diagrams",
  summary:
    "2×2 prioritization matrix. Name the two axes; place items in quadrants using `at <quadrant>`. Quadrant names are `top-left`, `top-right`, `bottom-left`, `bottom-right` — or short forms `tl`, `tr`, `bl`, `br`.",
  params: [
    { name: "x", type: "string", required: true, description: "Horizontal axis label (left = low, right = high)." },
    { name: "y", type: "string", required: true, description: "Vertical axis label (bottom = low, top = high)." },
    { name: "title", type: "string", required: false, description: "Optional title above the matrix." },
  ],
  bodyShape: "indented",
  breaksRuling: true,
  examples: [
    '@matrix x="Effort" y="Impact"\n  Search at tr\n  Export at tl\n  Dark mode at br\n  Animations at bl',
    '@matrix x="Effort" y="Impact" title="Q4 prioritization"\n  Search at top-right\n  Export at top-left',
  ],
};

const timeline: PrimitiveSpec = {
  name: "timeline",
  group: "diagrams",
  summary:
    "Sequence of events over time. Events alternate above/below the line by default; override with `above` or `below`. Each event is a line starting with its date/label, optionally followed by indented detail.",
  params: [
    { name: "title", type: "string", required: false, description: "Title above the timeline." },
    { name: "dir", type: "enum", required: false, description: "Direction.", enumValues: ["horizontal", "vertical"], default: "horizontal" },
    { name: "alternate", type: "boolean", required: false, description: "Alternate events above/below the line.", default: "true" },
  ],
  bodyShape: "indented",
  breaksRuling: true,
  examples: [
    '@timeline title="Project milestones"\n  Q3 2026: Discovery\n    Interviews, synthesis, personas\n  Oct 2026: Alpha\n    Core primitives, extension preview\n  Dec 2026: Beta above\n    Full primitive set, docs\n  Q1 2027: Launch below\n    Marketplace, site, community',
  ],
};

const doodle: PrimitiveSpec = {
  name: "doodle",
  group: "diagrams",
  summary:
    "Freeform space for anything the structured primitives cannot express. The only primitive that accepts coordinate-style placement. Body is a mini drawing language (lines, circles, labels, arrows with positions). This is the escape hatch — reach for a named primitive first.",
  params: [
    { name: "width", type: "number", required: false, description: "Width in grid units (1 unit ≈ 1 ruled line height). Default: full width." },
    { name: "height", type: "number", required: false, description: "Height in grid units." },
    { name: "caption", type: "string", required: false, description: "Caption below the doodle." },
  ],
  bodyShape: "plain",
  breaksRuling: true,
  examples: [
    '@doodle height=6 caption="Rough architecture"\n  box "API" at 2,1 size 3,2\n  box "DB" at 2,4 size 3,2\n  arrow from "API" to "DB"',
  ],
};

// ---------------------------------------------------------------------------
// PM ARTIFACTS
// ---------------------------------------------------------------------------

const decision: PrimitiveSpec = {
  name: "decision",
  group: "pm-artifacts",
  summary:
    "An architectural decision block: context, choice, consequences. Body uses `key: value` lines.",
  params: [
    { name: "title", type: "string", required: true, description: "Short name for the decision." },
    { name: "status", type: "enum", required: false, description: "Decision status.", enumValues: ["proposed", "accepted", "deprecated", "superseded"], default: "accepted" },
    { name: "date", type: "string", required: false, description: "Date the decision was made, e.g. 2026-09-17." },
  ],
  bodyShape: "keyed",
  breaksRuling: false,
  examples: [
    '@decision title="Adopt event sourcing" status=accepted date=2026-09-17\n  context: Writes are bursty, reads need projections\n  choice: Event store with CQRS\n  consequences: Simpler writes, eventual consistency on reads',
  ],
};

const evidence: PrimitiveSpec = {
  name: "evidence",
  group: "pm-artifacts",
  summary:
    "Research evidence block. A quote from a user, document, or data source, with structured attribution. Renders as a styled quotation with source metadata.",
  params: [
    { name: "by", type: "string", required: false, description: "Who said it (name, participant ID, role)." },
    { name: "source", type: "string", required: false, description: "Where it came from (interview, survey, doc, URL)." },
    { name: "date", type: "string", required: false, description: "When it was captured." },
    { name: "tag", type: "string", required: false, description: "Theme tag for clustering, e.g. onboarding, pricing." },
  ],
  bodyShape: "plain",
  breaksRuling: false,
  examples: [
    '@evidence by="User P7" source="Discovery interview 3" tag=onboarding\n  I just want it to not lose my work. I had three tabs open and was terrified of closing the wrong one.',
  ],
};

const metric: PrimitiveSpec = {
  name: "metric",
  group: "pm-artifacts",
  summary:
    "KPI / metric block. Renders as a compact card with the metric name, current value, target, and optional trend.",
  params: [
    { name: "name", type: "string", required: true, description: "What the metric measures." },
    { name: "value", type: "string", required: false, description: "Current value." },
    { name: "target", type: "string", required: false, description: "Target value." },
    { name: "trend", type: "enum", required: false, description: "Direction indicator.", enumValues: ["up", "down", "flat"], default: "flat" },
    { name: "status", type: "enum", required: false, description: "Health signal.", enumValues: ["on-track", "at-risk", "off-track"], default: "on-track" },
  ],
  bodyShape: "plain",
  breaksRuling: false,
  examples: [
    '@metric name="Weekly active users" value="1,240" target="2,000" trend=up status=on-track\n  Growing 8% week-over-week since the playground launched.',
    '@metric name="P0 bug count" value="3" target="0" trend=down status=at-risk',
  ],
};

const persona: PrimitiveSpec = {
  name: "persona",
  group: "pm-artifacts",
  summary:
    "Persona card. Body uses `key: value` lines for structured fields. Keys are freeform — use whatever fields suit the persona (name, role, goal, frustration, quote, tools, context). Renders as a styled card with the name prominent.",
  params: [
    { name: "name", type: "string", required: true, description: "Persona name or archetype label." },
    { name: "image", type: "string", required: false, description: "Path or URL to an avatar image." },
  ],
  bodyShape: "keyed",
  breaksRuling: true,
  examples: [
    '@persona name="Marta, the systems PM"\n  role: Platform PM at a mid-size fintech\n  goal: Sketch data relationships inside the spec, not in a separate tool\n  frustration: Notion has no star schema view, Miro loses sync with the doc\n  tools: VS Code, Datadog, dbt, Notion (reluctantly)\n  quote: "I just want the diagram next to the paragraph that explains it."',
  ],
};

const sprint: PrimitiveSpec = {
  name: "sprint",
  group: "pm-artifacts",
  summary:
    "Sprint planning block. Body has keyed fields (goal, dates, capacity) and an indented item list where each item is a line with optional `[status]` prefix.",
  params: [
    { name: "name", type: "string", required: true, description: "Sprint name or number." },
  ],
  bodyShape: "mixed",
  breaksRuling: false,
  examples: [
    '@sprint name="Sprint 14"\n  goal: Ship the table primitive and the playground\n  dates: 2026-10-07 to 2026-10-18\n  capacity: 3 engineers, 1 designer\n  items:\n    [done] Table renderer\n    [in-progress] Playground wiring\n    [todo] Pipe-table compat parser\n    [stretch] Tab-separated mode',
  ],
};

const risk: PrimitiveSpec = {
  name: "risk",
  group: "pm-artifacts",
  summary:
    "Risk entry with severity level and optional mitigation. Body is the risk description; mitigation is a keyed field.",
  params: [
    { name: "level", type: "enum", required: false, description: "Severity.", enumValues: ["low", "medium", "high", "critical"], default: "medium" },
    { name: "title", type: "string", required: false, description: "One-line risk name (shown as a heading)." },
  ],
  bodyShape: "mixed",
  breaksRuling: false,
  examples: [
    '@risk level=high title="Syntax awkwardness drives churn"\n  New users may bounce in the first hour if the syntax feels like work.\n  mitigation: Strong welcome file, interactive tour, sensible defaults.',
  ],
};

const assumption: PrimitiveSpec = {
  name: "assumption",
  group: "pm-artifacts",
  summary:
    "Assumption entry. A thing believed to be true that the plan depends on. Body is the assumption; `validation` is how to test it.",
  params: [
    { name: "title", type: "string", required: false, description: "One-line assumption name." },
    { name: "confidence", type: "enum", required: false, description: "How sure we are.", enumValues: ["high", "medium", "low"], default: "medium" },
  ],
  bodyShape: "mixed",
  breaksRuling: false,
  examples: [
    '@assumption title="PMs will learn a syntax" confidence=medium\n  Code-adjacent PMs will invest an afternoon to learn .jot if the output is good enough.\n  validation: 3 real PMs try the welcome file unaided; 2/3 produce a usable doc.',
  ],
};

// ---------------------------------------------------------------------------
// EXPRESSIVE LAYER
// ---------------------------------------------------------------------------

const banner: PrimitiveSpec = {
  name: "banner",
  group: "expressive",
  summary:
    "Section cover banner. Full-width, renders the title text large with the Organic treatment (cream/terracotta). Body text is the title.",
  params: [
    { name: "style", type: "enum", required: false, description: "Visual style.", enumValues: ["default", "minimal", "bold"], default: "default" },
  ],
  bodyShape: "plain",
  breaksRuling: true,
  examples: [
    "@banner Product Requirements — Jotstak v1",
    "@banner Discovery phase",
  ],
};

const spread: PrimitiveSpec = {
  name: "spread",
  group: "expressive",
  summary:
    "Two-page notebook layout. Content under `left:` renders on the left page; content under `right:` renders on the right. Use this to place a diagram beside its explanation.",
  params: [
    { name: "ratio", type: "string", required: false, description: 'Column ratio, e.g. "1:1", "2:1", "1:2".', default: "1:1" },
  ],
  bodyShape: "keyed",
  breaksRuling: true,
  examples: [
    '@spread ratio="1:2"\n  left:\n    @star_model center="Orders"\n      dim Customer\n      dim Product\n  right:\n    The Orders fact table sits at the center.\n    Customer and Product are the two dimensions\n    we query most often.',
  ],
};

const sticky: PrimitiveSpec = {
  name: "sticky",
  group: "expressive",
  summary:
    "Sticky note for cluster synthesis. Multiple stickies in sequence render as a cluster on the page. Color sets the sticky background.",
  params: [
    { name: "color", type: "enum", required: false, description: "Sticky color.", enumValues: ["yellow", "green", "coral", "blue", "pink", "purple"], default: "yellow" },
    { name: "cluster", type: "string", required: false, description: "Cluster name — stickies sharing a cluster group together." },
  ],
  bodyShape: "plain",
  breaksRuling: true,
  examples: [
    '@sticky color=green cluster="wins"\n  Playground drove 3x installs on launch day',
    '@sticky color=coral cluster="concerns"\n  No one read the docs before filing a bug',
  ],
};

const icon: PrimitiveSpec = {
  name: "icon",
  group: "expressive",
  summary:
    "Inline icon from the bundled Lucide set. Renders at line height, inherits the text color. Use the Lucide icon name (kebab-case).",
  params: [
    { name: "name", type: "string", required: true, description: "Lucide icon name, e.g. lightbulb, alert-triangle, check, star." },
    { name: "size", type: "enum", required: false, description: "Size relative to text.", enumValues: ["sm", "md", "lg"], default: "md" },
    { name: "color", type: "string", required: false, description: "Override color (CSS color or Organic token name)." },
  ],
  bodyShape: "none",
  breaksRuling: false,
  examples: [
    '@icon name=lightbulb Key insight below.',
    '@icon name=alert-triangle size=lg color=terracotta',
  ],
};

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------

export const PRIMITIVES: PrimitiveSpec[] = [
  // Document-level
  meta, page,
  // Structure
  heading, bullet, numbered, divider, cover,
  // Text
  note, quote, callout, footnote,
  // Lists
  table, tree, pillars,
  // Diagrams
  star_model, journey, matrix, timeline, doodle,
  // PM artifacts
  decision, evidence, metric, persona, sprint, risk, assumption,
  // Expressive
  banner, spread, sticky, icon,
];

// ---------------------------------------------------------------------------
// UNIVERSAL PARAMS
// Available on every primitive. The LSP merges these into each primitive's
// autocomplete rather than the specs repeating them 25 times.
// ---------------------------------------------------------------------------

export const UNIVERSAL_PARAMS: ParamSpec[] = [
  {
    name: "id",
    type: "string",
    required: false,
    description:
      "A label for this block so other things can point at it — `@note at=<id>`, footnotes, cross-references. Never rendered.",
  },
  {
    name: "width",
    type: "enum",
    required: false,
    description:
      "How much page this block takes. `auto` (default) lets the renderer size it to its content — the natural choice. `column` keeps it inside the main text column, `wide` spans the full column, `full` spills across the margin channel too for large diagrams.",
    enumValues: ["auto", "column", "wide", "full"],
    default: "auto",
  },
  {
    name: "icon",
    type: "string",
    required: false,
    description:
      "Optional Lucide icon name for this block. Nothing renders unless you set it — there are no automatic icons. Autocomplete suggests a fitting icon per primitive (see SUGGESTED_ICONS), but the choice is always yours.",
  },
  {
    name: "icon_at",
    type: "enum",
    required: false,
    description:
      "Where the icon sits. `inline` = immediately before the block's title/first line. `margin` = out in the notebook margin channel, drawn larger, like a marginal doodle. `corner` = tucked into the card's top corner (card primitives only; falls back to inline with a diagnostic otherwise). Only meaningful when `icon` is set.",
    enumValues: ["inline", "margin", "corner"],
    default: "inline",
  },
];

// Suggested icon per primitive. ONLY used to order/seed autocomplete when the
// author types `icon=`. Never rendered automatically. Authors may ignore these
// entirely — they exist for discoverability and vocabulary consistency, not defaults.
export const SUGGESTED_ICONS: Record<string, string> = {
  star_model: "network",
  tree: "git-fork",
  table: "table",
  journey: "route",
  matrix: "grid-2x2",
  timeline: "milestone",
  pillars: "columns-3",
  doodle: "pencil",
  decision: "git-branch",
  evidence: "quote",
  metric: "trending-up",
  persona: "user-round",
  sprint: "calendar-range",
  risk: "alert-triangle",
  assumption: "help-circle",
  note: "pen-line",
  quote: "quote",
  footnote: "asterisk",
  callout: "info",
  info: "info",
  warn: "alert-triangle",
  tip: "lightbulb",
  question: "circle-question-mark",
  cover: "bookmark",
  banner: "flag",
  spread: "book-open",
  sticky: "sticky-note",
  divider: "minus",
};

export function getPrimitive(name: string): PrimitiveSpec | undefined {
  return PRIMITIVES.find(
    (p) => p.name === name || p.aliases?.includes(name),
  );
}

/** Full param list for a primitive: its own params plus the universal ones. */
export function getAllParams(name: string): ParamSpec[] {
  const spec = getPrimitive(name);
  return spec ? [...spec.params, ...UNIVERSAL_PARAMS] : [...UNIVERSAL_PARAMS];
}

/** The icon autocomplete should offer first for this primitive, if any. */
export function getSuggestedIcon(name: string): string | undefined {
  return SUGGESTED_ICONS[name];
}

export function getPrimitivesByGroup(group: PrimitiveGroup): PrimitiveSpec[] {
  return PRIMITIVES.filter((p) => p.group === group);
}
