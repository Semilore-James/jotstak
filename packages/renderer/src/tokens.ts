// Design tokens for the Organic system.
// Extracted from the wireframe reference (docs/DESIGN_REFERENCE.md) and
// codified here so the renderer, the web site, and the extension preview
// all draw from one place. Values are reference — the visual look, not absolute.
//
// Three rendering contexts share these tokens:
//   1. Notebook mode — warm paper, ruled lines, margin channel, hand-drawn accents
//   2. Doc mode — clean A4 white, editorial proportions, crisp contrast
//   3. IDE chrome — dark/light VS Code host (we don't control this; it's VS Code's theme)

// ---------------------------------------------------------------------------
// COLOR PALETTE
// ---------------------------------------------------------------------------

export const colors = {
  // -- Notebook mode surfaces --
  notebook: {
    paper:         "#fcf8f2",  // warm cream canvas
    paperElevated: "#f5ead8",  // slightly deeper cream for card primitives
    ruleLines:     "#e4d5be",  // 28px-spaced horizontal guides
    marginLine:    "#e8beb4",  // faint vertical left-margin rule (rose/coral)
    ink:           "#2c2523",  // primary reading text (warm carbon)
    inkMuted:      "#73685e",  // secondary metadata, structural notations
    inkLight:      "#8a7a6c",  // tertiary captions, timestamps
  },

  // -- Doc mode surfaces --
  doc: {
    viewport:    "#f3f4f6",  // subtle grey backing behind the sheet
    sheet:       "#ffffff",  // the A4 document surface
    sheetBorder: "#e5e7eb",  // 1px perimeter hairline
    ink:         "#111827",  // primary editorial text
    inkMuted:    "#4b5563",  // supporting text
  },

  // -- Accents (shared across modes) --
  accent: {
    terracotta:       "#c67139",  // primary: entities, active selections, dividers
    terracottaLight:  "#d27b42",  // primary container: badges, card accents
    terracottaPale:   "#ffdbc8",  // 10% tint backgrounds for badges
    slateBlue:        "#436475",  // secondary: data/relationships, tree connectors
    slateBlueLight:   "#294b5b",  // secondary container
    sage:             "#5e8259",  // tertiary: validated states, stable tags
    sageLight:        "#759a6f",  // tertiary container
    sepia:            "#8b634b",  // margin notes ink
  },

  // -- Syntax highlighting (TextMate grammar token colors) --
  syntax: {
    directive:  "#c67139",  // @project, @pillar, @star_model (terracotta bold)
    data:       "#436475",  // @fact, @link, @tree (steel slate blue)
    structural: "#73685e",  // @table, @divider (neutral umber)
    marginalia: "#8b634b",  // @note (sepia ochre)
    string:     "#aad1a2",  // quoted values
    comment:    "#73685e",  // // comments (muted, italic)
  },
} as const;

// ---------------------------------------------------------------------------
// TYPOGRAPHY
// ---------------------------------------------------------------------------

export const typography = {
  // Headline / body (rendered preview — both modes)
  headline: {
    family: "Lora",
    xl: { size: "36px", lineHeight: "44px", weight: "600", letterSpacing: "-0.02em" },
    lg: { size: "28px", lineHeight: "36px", weight: "600", letterSpacing: "-0.015em" },
    md: { size: "22px", lineHeight: "28px", weight: "500", letterSpacing: "-0.01em" },
    sm: { size: "18px", lineHeight: "24px", weight: "500" },
  },
  body: {
    family: "Lora",
    lg: { size: "16px", lineHeight: "28px", weight: "400" },
    md: { size: "14px", lineHeight: "24px", weight: "400" },
  },

  // Code (editor source + monospace blocks in preview)
  code: {
    family: "IBM Plex Mono",
    md: { size: "13px", lineHeight: "20px", weight: "400" },
    sm: { size: "11px", lineHeight: "16px", weight: "500" },
  },

  // Margin handwriting (notebook mode @note annotations)
  margin: {
    family: "Caveat",
    md: { size: "18px", lineHeight: "22px", weight: "600" },
  },

  // UI labels (chrome, badges, status indicators)
  label: {
    family: "Inter",
    md: { size: "12px", lineHeight: "16px", weight: "500", letterSpacing: "0.02em" },
    sm: { size: "10px", lineHeight: "14px", weight: "600", letterSpacing: "0.05em" },
  },
} as const;

// ---------------------------------------------------------------------------
// SPACING & RHYTHM
// ---------------------------------------------------------------------------

export const spacing = {
  baselineGrid: 28,      // px — the ruled-line interval; ALL vertical rhythm locks to this
  gutter:       "1.5rem",
  margin:       "2rem",
  xs:           "0.25rem",
  sm:           "0.5rem",
  md:           "1rem",
  lg:           "1.5rem",
  xl:           "2.5rem",
} as const;

// ---------------------------------------------------------------------------
// SHAPES & ELEVATION
// ---------------------------------------------------------------------------

export const shapes = {
  borderRadius: {
    sm:   "2px",   // status badges, keyword tokens
    base: "4px",   // IDE tabs, entity cards, star model nodes
    md:   "6px",   // general cards
    lg:   "8px",   // larger cards
    full: "9999px",
  },

  // Hard shadows for notebook mode — emulate physical index cards on paper
  elevation: {
    card:     "2px 2px 0px #e4d5be",     // notebook card primitives
    cardFact: "2px 2px 0px #d27b42",     // fact table in star model (terracotta shadow)
    docSheet: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.02)", // doc mode float
    modal:    "0 12px 24px -4px rgba(0,0,0,0.35)",
  },

  // Connection lines between diagram nodes
  connectors: {
    width:       "1.5px",
    color:       "#436475",  // steel slate blue
    dashArray:   "3,3",      // for dashed FK links
    junctionDot: "2.5px",    // radius of small junction dots
    cornerFillet: "4px",     // 90° orthogonal routing fillet
  },
} as const;

// ---------------------------------------------------------------------------
// NOTEBOOK MODE LAYOUT
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE RULED-LINE CONTRACT
// The mechanic that makes drawn blocks sit naturally on the paper instead of
// looking pasted on. Four rules, applied by the renderer — never by the author.
// ---------------------------------------------------------------------------

export const ruledLineContract = {
  /** 1. Every text line sits ON a rule, locked to the baseline grid. */
  textSitsOnRules: true,

  /** 2. A drawn block (breaksRuling: true) CLEARS the rules inside its bounding
   *     box — the paper goes blank behind it so the diagram can breathe. */
  drawnBlocksClearRules: true,

  /** 3. A drawn block's height ROUNDS UP to a whole number of baseline rows, so
   *     text after it resumes exactly on a rule. This is the key mechanic: it is
   *     why the vertical rhythm never drifts down a long document. */
  roundHeightToWholeRows: true,

  /** 4. Half a row of clear space above and below a drawn block so it does not
   *     crowd the adjacent text lines. */
  clearanceRows: 0.5,
} as const;

export const notebookLayout = {
  // The preview splits into a main column and a right margin channel
  mainColumnRatio:   0.77,   // ~77% for ruled document flow
  marginChannelRatio: 0.23,  // ~23% for @note annotations and callout ticks
  // px — the frame is an A4 page's printable width (ARC-14): 210mm less two
  // 56px margins. Derived in page.ts; a test keeps this token in step with it.
  maxContentWidth:   681.7,
  leftMarginLineX:   32,     // px — the faint vertical rose/coral margin rule

  // Margin notes connect to their anchor with a tick line + dot
  marginTick: {
    dotRadius:   3,     // px — ink dot at the body-side end
    lineWidth:   1.5,   // px
    color:       "#c67139",  // terracotta
  },
} as const;
