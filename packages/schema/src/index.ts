// @jotstak/schema — the definitive list of .jot primitives.
// The LSP reads this for autocomplete + hover; the docs site generates the
// reference pages from it. One edit here propagates to editor and docs alike.
//
// Design principles:
//   1. Intent, not coordinates. Primitives express arrangement semantically
//      (dir=, layout=, at 12, at top-left, >/< for sides) — never pixel positions.
//      The renderer places things. The only free-placement escape hatch is @doodle.
//   2. Minimal punctuation. No pipe tables. Body content uses indentation + key:value
//      or plain lines. Commas only in compact table rows. Params are written inline
//      after the shortcode, or in a parenthesised list that may span lines when there
//      are enough of them to hurt readability (ADR-003) — both forms mean the same.
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
  /**
   * Named and specified, but read by nothing yet. Like a planned primitive:
   * the editor says so rather than offering a setting that silently does
   * nothing, which sends people looking for their own mistake (ENG-34).
   */
  planned?: true;
}

export interface PrimitiveSpec {
  /** The @-name typed in source, e.g. "decision", "star_model". */
  name: string;
  /** Aliases that also resolve to this primitive (e.g. @warn → @callout warn). */
  aliases?: string[];
  group: PrimitiveGroup;
  /**
   * One plain line: what this is, for someone who has just typed it and wants
   * to know whether it is the right block. No jargon, no em dashes, no
   * sentence that needs a second one to finish it.
   *
   * Separate from `summary` because they answer different questions. The
   * summary is a paragraph for a documentation page somebody chose to read;
   * this is what fits on a hover card without being scrolled.
   */
  short: string;
  summary: string;
  params: ParamSpec[];
  /**
   * Named and specified, but with no renderer yet: the block parses, keeps its
   * content, and comes out as plain text with an info diagnostic saying so.
   *
   * It is here because the editor has to know. Autocomplete was offering all
   * twenty-eight primitives identically while five of them did nothing, which
   * is the worst version of this: you pick one, it renders as a paragraph, and
   * nothing tells you whether you wrote it wrong or it was never built. The
   * scaffold test pins this list in both directions, so building one fails
   * until the flag comes off.
   */
  planned?: true;
  /**
   * How many of the example's body lines the scaffold writes. One is enough for
   * almost everything; a star model needs its fact AND a dimension, or the
   * renderer warns about the block the editor just wrote.
   */
  scaffoldLines?: number;
  /** Body lines: "none" | "plain" | "keyed" | "indented" | "mixed". */
  bodyShape: "none" | "plain" | "keyed" | "indented" | "mixed";
  /**
   * What becomes of a block written inside this one. With `nests`, this is
   * the composition matrix: which blocks go inside which.
   *
   *   "inside"  it renders inside this block, after its own content. The
   *             cards; and @columns, where one written under a column's key
   *             goes in that column, and one at the columns' own indent
   *             becomes a column of its own.
   *   "items"   it goes inside the item it is written under. The lists: a
   *             point, and the tree that explains it, indented beneath.
   *   "below"   it is kept, and drawn directly beneath the figure. A drawing
   *             has nowhere inside it for another block: a metric under a
   *             tree is under the tree, not in one of its nodes.
   *   "text"    this block holds words, not blocks. The lines are kept as
   *             text and a warning says so.
   *
   * Written down because it used to be an accident of each renderer. A tree
   * in a panel worked; a tree in a column printed its own source back as a
   * paragraph; a tree in a quote vanished. None of the three said anything.
   * The parser, the diagnostics, autocomplete and the docs all read this now,
   * and a test renders every pair so it cannot drift from what happens.
   */
  holds: "inside" | "items" | "below" | "text";
  /**
   * Whether this block can go inside another at all. False for the ones that
   * belong to the page rather than to a block: page setup, the metadata row,
   * a cover, a page break, a margin note, and a wall of stickies.
   */
  nests: boolean;
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
  short:
    "The document's project, owner, status and dates, as a row of chips at the top.",
  summary:
    "Document metadata. Freeform `key: value` lines — project, pillar, status, owner, updated, whatever your team tracks. Renders as a compact chip row at the top of the document. This is data, not decoration: a future cross-file search reads @meta, which is why it is one extensible block rather than a primitive per field.",
  params: [
    { name: "show", type: "boolean", required: false, description: "Render the chip row. Set false to keep the metadata for tooling but hide it from the page.", default: "true" },
  ],
  bodyShape: "keyed",
  holds: "text",
  nests: false,
  breaksRuling: false,
  examples: [
    "@meta\n  project: Autonomous Agent Orchestrator\n  pillar: Reliability & Traceability\n  status: active\n  owner: @alex\n  updated: 2026-09-17",
  ],
};

const page: PrimitiveSpec = {
  name: "page",
  group: "structure",
  short:
    "Page setup for the whole document. Today it sets what a single Enter does.",
  summary:
    "Page setup for the rendered document. Declare once near the top; it applies to the whole document. Today it sets one thing, `breaks`: what a single Enter in your prose means. The margin, ruling and rhythm settings are named and planned, but not built yet.",
  params: [
    // The four below are specified and read by nothing yet (ENG-34's rule).
    { name: "margin", type: "enum", required: false, description: "Which margin channels exist for notes.", enumValues: ["right", "left", "both", "none"], default: "right", planned: true },
    { name: "margin_width", type: "enum", required: false, description: "How much page the margin channel takes.", enumValues: ["narrow", "normal", "wide"], default: "normal", planned: true },
    { name: "rule", type: "enum", required: false, description: "Paper ruling behind the text.", enumValues: ["ruled", "dotted", "grid", "blank"], default: "ruled", planned: true },
    { name: "rhythm", type: "number", required: false, description: "Baseline grid in px. Everything locks to this; drawn blocks round up to whole multiples of it.", default: "28", planned: true },
    { name: "breaks", type: "enum", required: false, description: "What a single Enter does in prose. `on` (the default) keeps the line you broke — this is ruled paper, and a line you ended is a line. `off` restores Markdown's own rule, where a single newline is a space and only a blank line starts a paragraph: set it when pasting a .md file that was hard-wrapped to a column width, so its wrap points do not become real breaks.", enumValues: ["on", "off"], default: "on" },
  ],
  bodyShape: "none",
  holds: "text",
  nests: false,
  breaksRuling: false,
  // Only what works. These used to show margin=, rule= and rhythm=, which the
  // docs then rendered as examples of settings that did nothing.
  examples: [
    "@page breaks=off",
  ],
};

// ---------------------------------------------------------------------------
// STRUCTURE
// ---------------------------------------------------------------------------

const panel: PrimitiveSpec = {
  name: "panel",
  group: "structure",
  short:
    "A box that holds anything. @decision, @risk and the rest are presets over it.",
  summary:
    "A bounded region that clears the ruling and holds anything: fields, prose, or other blocks. This is the general container — @decision, @risk, @assumption and @persona are presets over it, so the PM vocabulary is available but never required. Use @panel directly when none of the presets fit, or when a document should not read as jargon.",
  params: [
    { name: "label", type: "string", required: false, description: "Small uppercase kicker above the title, e.g. \"Risk\". Omit for an unlabelled panel." },
    { name: "title", type: "string", required: false, description: "The panel's heading." },
    { name: "badge", type: "string", required: false, description: "Short status chip beside the label, e.g. \"accepted\" or \"high\"." },
    { name: "accent", type: "enum", required: false, description: "Colour treatment. `alert` marks something needing attention; `quiet` drops the fill entirely.", enumValues: ["neutral", "alert", "positive", "info", "quiet"], default: "neutral" },
  ],
  bodyShape: "mixed",
  holds: "inside",
  nests: true,
  breaksRuling: true,
  examples: [
    '@panel(label="Risk" badge=high accent=alert title="Churn among small teams")\n  mitigation: Grandfather existing plans for 12 months.',
    '@panel(title="Anything can go inside")\n  A panel holds prose, fields, or other blocks.\n\n  @metric(name="WAU" value="1,240")',
  ],
};

const columns: PrimitiveSpec = {
  name: "columns",
  group: "structure",
  short:
    "Puts regions side by side. Each key in the body becomes a column.",
  summary:
    "Places regions side by side. Each `key:` in the body is a column, and its indented content — text or nested blocks — fills it. Replaces the separate two-page spread and feature-pillars primitives, which were the same mechanic with different names.",
  params: [
    { name: "ratio", type: "string", required: false, description: 'Relative column widths, e.g. "1:1", "2:1". Defaults to equal columns.' },
    { name: "headings", type: "boolean", required: false, description: "Render each column's key as a heading above it. Set false to use the keys purely as structure.", default: "true" },
  ],
  bodyShape: "keyed",
  holds: "inside",
  nests: true,
  breaksRuling: true,
  examples: [
    '@columns(ratio="1:2")\n  left:\n    The diagram\n  right:\n    The paragraph that explains it',
    '@columns\n  Core:\n    Search\n    Export\n  Growth:\n    Templates\n    Sharing',
  ],
};

const heading: PrimitiveSpec = {
  name: "heading",
  group: "structure",
  short:
    "A section heading, levels 1 to 6.",
  summary:
    "Section heading. Write it as `# `, `## `, `### ` at the start of a line, or as `@heading` with a level, or as `@h1` to `@h6`. Markdown has six levels and so does this; the type scale has three sizes and stops there, so a level 4, 5 or 6 is set like a level 3 while the document outline still sees the depth you gave it.",
  aliases: ["h1", "h2", "h3", "h4", "h5", "h6"],
  params: [
    { name: "level", type: "enum", required: false, description: "Heading depth, 1 to 6.", enumValues: ["1", "2", "3", "4", "5", "6"], default: "1" },
  ],
  bodyShape: "plain",
  holds: "text",
  nests: true,
  breaksRuling: false,
  examples: [
    "@heading Overview",
    "## Goals and non-goals",
    "@h2 Goals and non-goals",
  ],
};

const bullet: PrimitiveSpec = {
  name: "bullet",
  group: "structure",
  short:
    "A bullet list, usually written with a plain dash.",
  summary:
    "Bullet list. Nesting up to 3 levels via indentation. Shorthand: `- ` at line start (nested by indent). No `@` needed for plain bullets — the parser recognizes `- ` lines.",
  params: [],
  bodyShape: "indented",
  holds: "items",
  nests: true,
  breaksRuling: false,
  examples: [
    "- First item\n  - Nested\n    - Deep nested",
  ],
};

const numbered: PrimitiveSpec = {
  name: "numbered",
  group: "structure",
  short:
    "A numbered list. It renumbers itself, so the digit you type does not matter.",
  summary:
    "Numbered list. Shorthand: `1. ` at line start. Auto-numbers; the actual digit you type is ignored.",
  params: [],
  bodyShape: "indented",
  holds: "items",
  nests: true,
  breaksRuling: false,
  examples: [
    "1. First\n2. Second\n   1. Sub-item",
  ],
};

const pagebreak: PrimitiveSpec = {
  name: "pagebreak",
  aliases: ["newpage"],
  group: "structure",
  short:
    "Starts the next block on a new printed sheet.",
  summary:
    "Start the next block on a new sheet. Printing already cuts the document into real A4 pages on its own, and keeps blocks whole while doing it — this is for the breaks it cannot guess: an appendix, a section someone will detach, a cover that should stand alone. On screen it draws where the page will end, so you can see it working without printing.",
  params: [
    { name: "label", type: "string", required: false, description: "Words on the marker, e.g. \"Appendix\". Shown on screen only — it is a note to whoever is editing, and printing has already obeyed the break by then." },
  ],
  bodyShape: "none",
  holds: "text",
  nests: false,
  breaksRuling: false,
  examples: ["@pagebreak", '@pagebreak label="Appendix"', "@newpage"],
};

const divider: PrimitiveSpec = {
  name: "divider",
  group: "structure",
  short:
    "A break between two sections.",
  summary: "Horizontal rule between sections. Shorthand: `---` on its own line.",
  params: [
    { name: "style", type: "enum", required: false, description: "Visual style.", enumValues: ["line", "dots", "wave"], default: "line" },
  ],
  bodyShape: "none",
  holds: "text",
  nests: true,
  breaksRuling: false,
  examples: ["@divider", "---", "@divider style=wave"],
};

const cover: PrimitiveSpec = {
  name: "cover",
  group: "structure",
  short:
    "A full width opener for a major section.",
  summary:
    "A band across the page that opens a major section: a title, an optional subtitle, and rules spanning the margin channel. It sits in the flow rather than taking a sheet of its own. For a real title page, follow it with `@pagebreak`, which already does exactly that and nothing else. Three weights: `minimal` marks a section, `default` introduces one, `bold` puts the type in a tinted field.",
  params: [
    { name: "subtitle", type: "string", required: false, description: "Smaller text below the title. Can also be written as the indented line underneath, which is the plainer spelling and the one the examples use." },
    { name: "style", type: "enum", required: false, description: "How loudly the band announces itself. `minimal` is one hairline underneath, with the title a size down. `default` is rules above and below. `bold` sets the type in a tinted field.", enumValues: ["default", "minimal", "bold"], default: "default" },
  ],
  bodyShape: "plain",
  holds: "text",
  nests: false,
  breaksRuling: true,
  examples: [
    // Not `subtitle="…"` on the line below, which is what this said until the
    // renderer existed to prove it wrong: an unbracketed assignment on a
    // continuation line is not a parameter, and it rendered the literal text
    // `subtitle="Weeks 1–3"` onto the page.
    "@cover Discovery phase\n  Weeks 1–3",
    "@cover(style=minimal) Findings\n  What the interviews said",
    "@cover(style=bold) Part two\n  Building it\n\n@pagebreak",
  ],
};

// ---------------------------------------------------------------------------
// TEXT
// ---------------------------------------------------------------------------

const note: PrimitiveSpec = {
  name: "note",
  group: "text",
  short:
    "A handwritten note in the margin, beside the block it follows.",
  summary:
    "Margin note in the handwritten typeface. It sits beside the last line written before it: after a list, beside the last point; after a paragraph, beside its last line. The lines beside it make room and take the full page width back below it. Beside a box — a card, a table, a diagram — the box narrows instead, since a box cannot wrap. Several notes stack in the order written; a note longer than its text makes the row taller rather than running into the next. On a narrow screen notes fold in under the block they belong to.",
  params: [
    // All four are specified and read by nothing yet (ENG-34's rule): a note
    // is drawn from its words alone, beside the block it follows.
    { name: "side", type: "enum", required: false, description: "Which margin channel. `right` is default; `left` uses the left channel (requires @page margin: left or both).", enumValues: ["right", "left"], default: "right", planned: true },
    { name: "align", type: "enum", required: false, description: "Vertical alignment against its anchor block — matters when the anchor is tall, like a diagram.", enumValues: ["top", "middle", "bottom"], default: "top", planned: true },
    { name: "at", type: "string", required: false, description: "Anchor to a specific block by its `id=` instead of the preceding block. Lets you group notes together in source while still pointing at the right place.", planned: true },
    { name: "loose", type: "boolean", required: false, description: "Detach from any anchor — no tick rule. The note just flows in the margin at this point. For general asides about a whole section.", default: "false", planned: true },
  ],
  bodyShape: "plain",
  holds: "text",
  nests: false,
  breaksRuling: false,
  examples: [
    "@note revisit this at scale",
    '@decision title="Move to usage-based pricing" status=accepted\n  context: Seat pricing punishes the teams who adopt fastest\n\n@note\n  The fan-out here is the risky part.',
  ],
};

const quote: PrimitiveSpec = {
  name: "quote",
  group: "text",
  short:
    "Someone else's words, with as much attribution as you have.",
  summary:
    "Someone else's words, with optional attribution. Covers both a pull quote and a research citation — `by`, `source`, `date` and `tag` carry the provenance. Shorthand: `> ` at line start. Distinct from @callout, which is the author's own voice.",
  params: [
    { name: "by", type: "string", required: false, description: "Attribution — who said it." },
    { name: "source", type: "string", required: false, description: "Where it came from (interview, doc, URL)." },
    { name: "date", type: "string", required: false, description: "When it was captured." },
    { name: "tag", type: "string", required: false, description: "Theme tag for clustering, e.g. onboarding, pricing." },
  ],
  bodyShape: "plain",
  holds: "text",
  nests: true,
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
  short:
    "A boxed aside. The first word picks the flavour.",
  summary:
    "Boxed callout. The flavor is the first word after `@callout`, or use the alias directly: `@tip`, `@warn`, `@info`, `@question`. No `type=` param — the flavor IS the shortcode.",
  params: [
    { name: "flavor", type: "enum", required: false, description: "Callout flavor. Can also be used as the shortcode name directly.", enumValues: ["info", "warn", "tip", "question"], default: "info" },
  ],
  bodyShape: "plain",
  holds: "inside",
  nests: true,
  breaksRuling: false,
  examples: [
    "@callout warn\n  This metric is lagging by two sprints.",
    "@tip\n  Export to HTML before the stakeholder meeting.",
  ],
};

const footnote: PrimitiveSpec = {
  name: "footnote",
  group: "text",
  short:
    "A note at the foot of the page, pointed at from the text with [^id].",
  summary:
    "Footnote. Reference in body text with `[^id]`, then define the note anywhere with `@footnote id=<id>` — it uses the universal `id` param, which is effectively required here (the renderer reports a footnote without one). Renders at the bottom of the page in notebook mode.",
  params: [],
  planned: true,
  bodyShape: "plain",
  holds: "text",
  nests: true,
  breaksRuling: false,
  examples: [
    "See the original research[^disco1].\n\n@footnote id=disco1\n  Findings from the March discovery sprint, slide 14.",
  ],
};

// ---------------------------------------------------------------------------
// LISTS OF INFORMATION
// ---------------------------------------------------------------------------

const table: PrimitiveSpec = {
  name: "table",
  group: "lists",
  short:
    "Rows and columns, written as comma separated lines. No pipes needed.",
  summary:
    "A table. No pipes: first row is the header, rows are comma-separated (quote cells that contain commas). Use the record form for few rows with rich cells. Pipe-tables still parse for paste-in compatibility. A table is the one figure that is never scaled — its cells are text, so it widens and then wraps, and the type stays the size of the prose around it. A cell that needs two lines takes a `\n` where the break goes, since a row is one line of source.",
  params: [
    { name: "style", type: "enum", required: false, description: "How the table is lined. `ruled` sets it on the page's own ruling, so the paper draws the rows; `sketch` draws its own grid and clears the ruling behind it; `plain` is alignment and nothing else — no header either, so the first line is an ordinary row.", enumValues: ["ruled", "sketch", "plain"], default: "ruled" },
    { name: "sep", type: "enum", required: false, description: "Cell delimiter for compact rows.", enumValues: ["comma", "tab"], default: "comma" },
    { name: "align", type: "string", required: false, description: 'Per-column alignment, e.g. "left,left,right". A column of nothing but figures is right-aligned on its own.' },
  ],
  bodyShape: "mixed",
  holds: "below",
  nests: true,
  // Only style=sketch draws a grid of its own; the default sits ON the rules
  // and lets the paper draw the rows, which is the whole point of ruled paper.
  breaksRuling: false,
  examples: [
    "@table\n  Feature, Status, Owner\n  Search, Shipped, Ana\n  Export, In progress, Ben",
    "@table\n  - Feature: Search\n    Status: Shipped\n    Owner: Ana\n  - Feature: Export\n    Status: In progress\n    Owner: Ben",
    '@table(style=sketch) Q4 status\n  Area, Owner, Confidence\n  Search, Ana, 0.8\n  Export, Ben, 0.4',
  ],
};

const tree: PrimitiveSpec = {
  name: "tree",
  group: "lists",
  short:
    "A hierarchy, shaped by how far you indent each line.",
  summary:
    "A hierarchy defined by indentation. `dir` is the way it grows: `down` (the default) reads as an outline, `right` puts each level in its own column, and `split` balances branches either side of a centre — prefix a branch with > or < to pin its side. `nodes=boxed` draws every node as a pill. Put a `\\n` anywhere a label should break; the node gets taller by a row and a line still meets it at the middle of its first one.",
  params: [
    { name: "dir", type: "enum", required: false, description: "The way the tree grows. `down` grows down the page — an outline, or with nodes=boxed a top-down chart. `right` gives each level its own column, aligned so a level reads straight down. `split` places branches either side of a centre, balanced by size.", enumValues: ["down", "right", "split"], default: "down" },
    { name: "style", type: "enum", required: false, description: "Line style between nodes.", enumValues: ["solid", "dashed", "rounded"], default: "solid" },
    { name: "nodes", type: "enum", required: false, description: "How each node is drawn. `text` sets the labels on the page, joined by thin lines — quiet enough to sit inside prose. `boxed` draws every node as a pill, branches darker than leaves, with arrows from parent to child — an infographic that carries more weight.", enumValues: ["text", "boxed"], default: "text" },
  ],
  bodyShape: "indented",
  holds: "below",
  nests: true,
  breaksRuling: true,
  examples: [
    "@tree dir=right\n  Table\n    Cell\n      Content type\n      Interaction\n    Row\n      Actions\n    Column\n      Width",
    "@tree(dir=down nodes=boxed)\n  Discovery\n    Interviews\n      Recruiting\n      Synthesis\n    Survey\n      Design\n      Analysis",
    "@tree\n  Orders\n    Customer\n      Segment\n    Product",
    "@tree(dir=right nodes=boxed)\n  Discovery\n    Interviews\n      Synthesis\n    Survey",
    "@tree dir=split\n  Central idea\n    > Pillar A\n      > Sub-point\n    < Pillar B",
    "@tree(dir=split nodes=boxed)\n  Retention\n    > Onboarding\n      > First value\n    < Habit loop",
  ],
};


// ---------------------------------------------------------------------------
// DIAGRAMS / VISUAL THINKING
// ---------------------------------------------------------------------------

const star_model: PrimitiveSpec = {
  name: "star_model",
  group: "diagrams",
  short:
    "One thing in the middle, the things that describe it around the outside.",
  summary:
    "A relationship map: one thing in the middle, the things that describe it around it, in star-schema vocabulary. The bare text after the shortcode is the TITLE; `fact:` names the centre, with its fields on indented lines; each `dim` is a satellite. Dimensions spread evenly clockwise from 12 in written order — place one yourself with `at 4` or `at top-right`. Terse form `dim: A, B, C` when placement does not matter. The ring grows until nothing collides, so the size comes from the content rather than a fixed radius.",
  params: [
    { name: "layout", type: "enum", required: false, description: "`clock` arranges the dimensions around the fact. `list` writes it out instead — a star model with fifteen dimensions is a list of fifteen dimensions, and a wheel of tiny text helps nobody.", enumValues: ["clock", "list"], default: "clock" },
  ],
  scaffoldLines: 2,
  bodyShape: "mixed",
  holds: "below",
  nests: true,
  breaksRuling: true,
  examples: [
    '@star_model Telemetry warehouse\n  fact: TaskExecutionEvents\n  dim Agents at 12\n  dim Models at 3\n  dim LatencyBuckets at 6\n  dim CostCenters at 9',
    '@star_model(layout=list) Order analytics\n  fact: Orders\n  dim: Customer, Product, Date, Store, Channel, Device, Campaign',
    "@star_model Order analytics\n  fact: Orders\n  dim: Customer, Product, Date, Store",
    "@star_model Event model\n  fact: TaskExecutionEvents\n    event_uuid: uuid, pk\n    agent_id: fk -> Agents\n    latency_ms: int\n  dim Agents at 12\n  dim Models at 4",
  ],
};

const journey: PrimitiveSpec = {
  name: "journey",
  group: "diagrams",
  short:
    "Stages across the page, with a line showing how each one felt.",
  summary:
    "A user journey. Stages run left to right, each written `stage <name>` with an optional `feeling=happy|neutral|frustrated`; touchpoints, actions and pain points go on indented lines under it. The feelings are drawn as a line above a neutral baseline, which is the point of the diagram — you can see where the experience falls over before reading a word. Use `track` for parallel swim lanes (frontstage / backstage, customer / support). Seven stages fit a portrait page; past that use `dir=vertical`.",
  params: [
    { name: "title", type: "string", required: false, description: "Journey title shown above the diagram." },
    { name: "dir", type: "enum", required: false, description: "`horizontal` draws stages across the page with the emotion line under their names. `vertical` runs down the page — no line, the feeling is carried by the mark beside each stage — and fits any number of stages.", enumValues: ["horizontal", "vertical"], default: "horizontal" },
  ],
  bodyShape: "indented",
  holds: "below",
  nests: true,
  breaksRuling: true,
  examples: [
    '@journey title="Onboarding"\n  stage Discover feeling=happy\n    Finds the landing page\n    Tries the playground\n  stage Install feeling=neutral\n    Copies the command\n    Waits for download\n  stage First doc feeling=happy\n    Opens welcome.jot\n    Edits and sees it render',
    '@journey title="Support request"\n  track Customer\n    stage Report feeling=frustrated\n      Hits a bug\n    stage Wait feeling=frustrated\n      Checks email\n  track Support\n    stage Triage feeling=neutral\n      Reads the ticket\n    stage Fix feeling=happy\n      Ships patch',
  ],
};

const matrix: PrimitiveSpec = {
  name: "matrix",
  group: "diagrams",
  short:
    "A 2x2. Name the two axes, then place items with 'at top-right'.",
  summary:
    "2×2 prioritization matrix. Name the two axes; place items in quadrants using `at <quadrant>`. A long item takes a `\n` where it should break. Quadrant names are `top-left`, `top-right`, `bottom-left`, `bottom-right` — or short forms `tl`, `tr`, `bl`, `br`.",
  params: [
    { name: "x", type: "string", required: true, description: "Horizontal axis label (left = low, right = high)." },
    { name: "y", type: "string", required: true, description: "Vertical axis label (bottom = low, top = high)." },
    { name: "style", type: "enum", required: false, description: "How the quadrants are framed. `axes` draws the cross alone, the way you would sketch it by hand; `boxed` adds an outer border, which reads closer to a table.", enumValues: ["axes", "boxed"], default: "axes" },
    { name: "title", type: "string", required: false, description: "Optional title above the matrix." },
  ],
  bodyShape: "indented",
  holds: "below",
  nests: true,
  breaksRuling: true,
  examples: [
    '@matrix x="Effort" y="Impact"\n  Search at tr\n  Export at tl\n  Dark mode at br\n  Animations at bl',
    '@matrix x="Effort" y="Impact" title="Q4 prioritization"\n  Search at top-right\n  Export at top-left',
    '@matrix(x="Effort" y="Impact" style=boxed)\n  Search at tr\n  Export at tl\n  Dark mode at br\n  Animations at bl',
  ],
};

const timeline: PrimitiveSpec = {
  name: "timeline",
  group: "diagrams",
  short:
    "Events on a line, alternating above and below it.",
  summary:
    "Events on a line. Each one is `Date: What happened`, with any detail indented under it, and a `\n` anywhere a line should break; the date is optional, so a plain sequence of steps works too. Events alternate above and below the line, which is not decoration — it is what lets each card be twice as wide, because its nearest neighbour on its own side is two columns away. Seven events fit a portrait page; past that use `dir=vertical`, which runs down the page and has no limit.",
  params: [
    { name: "title", type: "string", required: false, description: "Title above the timeline." },
    { name: "dir", type: "enum", required: false, description: "`horizontal` draws a line across the page. `vertical` runs down it — no sides, no scaling, and no limit on how many events.", enumValues: ["horizontal", "vertical"], default: "horizontal" },
    { name: "alternate", type: "boolean", required: false, description: "Alternate events above and below the line. Turning it off puts everything underneath, and halves how wide each card can be.", default: "true" },
  ],
  bodyShape: "indented",
  holds: "below",
  nests: true,
  breaksRuling: true,
  examples: [
    '@timeline title="Project milestones"\n  Q3 2026: Discovery\n    Interviews, synthesis, personas\n  Oct 2026: Alpha\n    Core primitives, extension preview\n  Dec 2026: Beta\n    Full primitive set, docs\n  Q1 2027: Launch\n    Marketplace, site, community',
    '@timeline(dir=vertical)\n  Q3 2026: Discovery\n    Interviews, synthesis, personas\n  Oct 2026: Alpha\n    Core primitives, extension preview\n  Dec 2026: Beta\n  Q1 2027: Launch',
  ],
};

const doodle: PrimitiveSpec = {
  name: "doodle",
  group: "diagrams",
  short:
    "Free placement, for anything the other blocks cannot say.",
  summary:
    "Freeform space for anything the structured primitives cannot express. The only primitive that accepts coordinate-style placement. Body is a mini drawing language (lines, circles, labels, arrows with positions). This is the escape hatch — reach for a named primitive first.",
  params: [
    { name: "cols", type: "number", required: false, description: "Drawing area width in grid units (1 unit ≈ 1 ruled line height). Default: fills the block's `width`. Distinct from the universal `width`, which sets how much page the block takes." },
    { name: "rows", type: "number", required: false, description: "Drawing area height in grid units." },
    { name: "caption", type: "string", required: false, description: "Caption below the doodle." },
  ],
  planned: true,
  bodyShape: "plain",
  holds: "text",
  nests: true,
  breaksRuling: true,
  examples: [
    '@doodle rows=6 caption="Rough architecture"\n  box "API" at 2,1 size 3,2\n  box "DB" at 2,4 size 3,2\n  arrow from "API" to "DB"',
  ],
};

// ---------------------------------------------------------------------------
// PM ARTIFACTS
// ---------------------------------------------------------------------------

const decision: PrimitiveSpec = {
  name: "decision",
  group: "pm-artifacts",
  short:
    "What was decided, why, and what it costs.",
  summary:
    "An architectural decision block: context, choice, consequences. Body uses `key: value` lines.",
  params: [
    { name: "title", type: "string", required: true, description: "Short name for the decision." },
    { name: "status", type: "enum", required: false, description: "Decision status.", enumValues: ["proposed", "accepted", "deprecated", "superseded"], default: "accepted" },
    { name: "date", type: "string", required: false, description: "Date the decision was made, e.g. 2026-09-17." },
  ],
  bodyShape: "keyed",
  holds: "inside",
  nests: true,
  breaksRuling: false,
  examples: [
    '@decision title="Adopt event sourcing" status=accepted date=2026-09-17\n  context: Writes are bursty, reads need projections\n  choice: Event store with CQRS\n  consequences: Simpler writes, eventual consistency on reads',
  ],
};


const metric: PrimitiveSpec = {
  name: "metric",
  group: "pm-artifacts",
  short:
    "A number that matters, with its target and which way it is going.",
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
  holds: "inside",
  nests: true,
  breaksRuling: false,
  examples: [
    '@metric name="Weekly active users" value="1,240" target="2,000" trend=up status=on-track\n  Growing 8% week-over-week since the playground launched.',
    '@metric name="P0 bug count" value="3" target="0" trend=down status=at-risk',
  ],
};

const persona: PrimitiveSpec = {
  name: "persona",
  group: "pm-artifacts",
  short:
    "Who you are building for, as a card of named fields.",
  summary:
    "Persona card. Body uses `key: value` lines for structured fields. Keys are freeform — use whatever fields suit the persona (name, role, goal, frustration, quote, tools, context). Renders as a styled card with the name prominent.",
  params: [
    { name: "name", type: "string", required: true, description: "Persona name or archetype label." },
    { name: "image", type: "string", required: false, description: "Path or URL to an avatar image.", planned: true },
  ],
  bodyShape: "keyed",
  holds: "inside",
  nests: true,
  breaksRuling: true,
  examples: [
    '@persona name="Marta, the systems PM"\n  role: Platform PM at a mid-size fintech\n  goal: Sketch data relationships inside the spec, not in a separate tool\n  frustration: Notion has no star schema view, Miro loses sync with the doc\n  tools: VS Code, Datadog, dbt, Notion (reluctantly)\n  quote: "I just want the diagram next to the paragraph that explains it."',
  ],
};


const risk: PrimitiveSpec = {
  name: "risk",
  group: "pm-artifacts",
  short:
    "Something that could go wrong, how bad it would be, and what you would do.",
  summary:
    "Risk entry with severity level and optional mitigation. Body is the risk description; mitigation is a keyed field.",
  params: [
    { name: "level", type: "enum", required: false, description: "Severity.", enumValues: ["low", "medium", "high", "critical"], default: "medium" },
    { name: "title", type: "string", required: false, description: "One-line risk name (shown as a heading)." },
  ],
  bodyShape: "mixed",
  holds: "inside",
  nests: true,
  breaksRuling: false,
  examples: [
    '@risk level=high title="Syntax awkwardness drives churn"\n  New users may bounce in the first hour if the syntax feels like work.\n  mitigation: Strong welcome file, interactive tour, sensible defaults.',
  ],
};

const assumption: PrimitiveSpec = {
  name: "assumption",
  group: "pm-artifacts",
  short:
    "Something you are treating as true that the plan depends on.",
  summary:
    "Assumption entry. A thing believed to be true that the plan depends on. Body is the assumption; `validation` is how to test it.",
  params: [
    { name: "title", type: "string", required: false, description: "One-line assumption name." },
    { name: "confidence", type: "enum", required: false, description: "How sure we are.", enumValues: ["high", "medium", "low"], default: "medium" },
  ],
  bodyShape: "mixed",
  holds: "inside",
  nests: true,
  breaksRuling: false,
  examples: [
    '@assumption title="PMs will learn a syntax" confidence=medium\n  Code-adjacent PMs will invest an afternoon to learn .jot if the output is good enough.\n  validation: 3 real PMs try the welcome file unaided; 2/3 produce a usable doc.',
  ],
};

// ---------------------------------------------------------------------------
// EXPRESSIVE LAYER
// ---------------------------------------------------------------------------



const sticky: PrimitiveSpec = {
  name: "sticky",
  group: "expressive",
  short:
    "A sticky note. Several in a row cluster together.",
  summary:
    "A sticky note, and a wall of them. Stickies written one after another are ONE figure laid out as a grid, because that is what cluster synthesis looks like — written as separate blocks down the page they would just be a list with coloured backgrounds. Give consecutive stickies the same `cluster` and they are grouped under its name. A note is a square; text that will not fit drops a size, and only grows the note when even that is not enough.",
  params: [
    { name: "color", type: "enum", required: false, description: "The note's colour. Six muted Post-it tints, chosen to sit on warm cream rather than glare off it.", enumValues: ["yellow", "green", "coral", "blue", "pink", "purple"], default: "yellow" },
    { name: "cluster", type: "string", required: false, description: "A name for this group. Consecutive stickies sharing one are drawn together under it, which is the only thing the name is for." },
  ],
  bodyShape: "plain",
  holds: "text",
  nests: false,
  breaksRuling: true,
  examples: [
    '@sticky color=green cluster="wins"\n  Playground drove 3x installs on launch day',
    '@sticky color=coral cluster="concerns"\n  No one read the docs before filing a bug',
  ],
};

const icon: PrimitiveSpec = {
  name: "icon",
  group: "expressive",
  short:
    "A small icon inside a line of text.",
  summary:
    "Inline icon from the bundled Lucide set. Renders at line height, inherits the text color. Use the Lucide icon name (kebab-case).",
  params: [
    { name: "name", type: "string", required: true, description: "Lucide icon name, e.g. lightbulb, alert-triangle, check, star." },
    { name: "size", type: "enum", required: false, description: "Size relative to text.", enumValues: ["sm", "md", "lg"], default: "md" },
    { name: "color", type: "string", required: false, description: "Override color (CSS color or Organic token name)." },
  ],
  planned: true,
  bodyShape: "none",
  holds: "text",
  nests: true,
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
  // Structure — panel and columns are the general containers
  panel, columns,
  heading, bullet, numbered, divider, pagebreak, cover,
  // Text
  note, quote, callout, footnote,
  // Lists
  table, tree,
  // Diagrams
  star_model, journey, matrix, timeline, doodle,
  // PM artifacts
  decision, metric, persona, risk, assumption,
  // Expressive
  sticky, icon,
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
      "A name for this block, so a link can jump straight to it: `#pricing-decision` after the page's address. Never shown on the page.",
  },
  {
    name: "width",
    type: "enum",
    required: false,
    description:
      "How much page this block takes. `auto` (default) lets the renderer decide: a figure stays in the text column if it fits, takes the full width if it doesn't, and moves to a landscape page of its own if it still doesn't. `column` keeps it in the text column, `wide` fills the text column, `full` spans the margin channel too, `landscape` gives it a landscape page. A figure pinned somewhere too small for it is scaled down to fit — never cut off.",
    enumValues: ["auto", "column", "wide", "full", "landscape"],
    default: "auto",
  },
  {
    name: "icon",
    type: "string",
    required: false,
    description:
      "Optional Lucide icon name for this block. Nothing renders unless you set it — there are no automatic icons. Autocomplete suggests a fitting icon per primitive (see SUGGESTED_ICONS), but the choice is always yours.",
    // Waits on @icon, which waits on the icon set in packages/icons.
    planned: true,
  },
  {
    name: "icon_at",
    type: "enum",
    required: false,
    description:
      "Where the icon sits. `inline` = immediately before the block's title/first line. `margin` = out in the notebook margin channel, drawn larger, like a marginal doodle. `corner` = tucked into the card's top corner (card primitives only; falls back to inline with a diagnostic otherwise). Only meaningful when `icon` is set.",
    enumValues: ["inline", "margin", "corner"],
    default: "inline",
    planned: true,
  },
];

// Suggested icon per primitive. ONLY used to order/seed autocomplete when the
// author types `icon=`. Never rendered automatically. Authors may ignore these
// entirely — they exist for discoverability and vocabulary consistency, not defaults.
export const SUGGESTED_ICONS: Record<string, string> = {
  star_model: "network",
  tree: "git-fork",
  table: "table",
  pagebreak: "scissors",
  journey: "route",
  matrix: "grid-2x2",
  timeline: "milestone",
  doodle: "pencil",
  decision: "git-branch",
  metric: "trending-up",
  persona: "user-round",
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
  panel: "square",
  columns: "columns-3",
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

/**
 * Can `child` be written inside `parent`? The whole composition matrix is
 * this one line: the parent must hold blocks, and the child must be a block
 * that goes inside others. Unknown names answer false.
 */
export function canHold(parent: string, child: string): boolean {
  const p = getPrimitive(parent);
  const c = getPrimitive(child);
  return !!p && !!c && p.holds !== "text" && c.nests;
}

/**
 * The matrix for one block, in words: what goes inside it, and whether it can
 * go inside anything. One phrasing, so the hover card, the docs and the
 * playground cannot describe the same rule three ways.
 */
export function compositionLine(spec: PrimitiveSpec): string {
  const holds =
    spec.holds === "inside"
      ? "Other blocks can go inside it."
      : spec.holds === "items"
        ? "A block written under one of its items goes inside that item."
        : spec.holds === "below"
        ? "A block written inside it is drawn below it."
        : "Holds text, not other blocks.";
  return spec.nests ? holds : `${holds} Goes on the page itself, never inside another block.`;
}

/** The blocks that hold other blocks inside them, for "put it in one of these". */
export function containers(): PrimitiveSpec[] {
  return PRIMITIVES.filter((p) => p.holds === "inside");
}

export function getPrimitivesByGroup(group: PrimitiveGroup): PrimitiveSpec[] {
  return PRIMITIVES.filter((p) => p.group === group);
}

// Writing blocks: scaffolds, one-line descriptions, and where the cursor is.
export * from "./authoring.js";
