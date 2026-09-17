---
name: Jotter Precision Workbench
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1c'
  surface-container: '#202020'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#dac2b5'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#303030'
  outline: '#a28c81'
  outline-variant: '#54433a'
  surface-tint: '#ffb68b'
  primary: '#ffb68b'
  on-primary: '#522300'
  primary-container: '#d27b42'
  on-primary-container: '#481d00'
  inverse-primary: '#944a14'
  secondary: '#a9cbdf'
  on-secondary: '#0f3444'
  secondary-container: '#294b5b'
  on-secondary-container: '#98bacd'
  tertiary: '#aad1a2'
  on-tertiary: '#163716'
  tertiary-container: '#759a6f'
  on-tertiary-container: '#0f3010'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbc8'
  primary-fixed-dim: '#ffb68b'
  on-primary-fixed: '#321200'
  on-primary-fixed-variant: '#753400'
  secondary-fixed: '#c5e8fc'
  secondary-fixed-dim: '#a9cbdf'
  on-secondary-fixed: '#001e2b'
  on-secondary-fixed-variant: '#294b5b'
  tertiary-fixed: '#c5edbc'
  tertiary-fixed-dim: '#aad1a2'
  on-tertiary-fixed: '#012104'
  on-tertiary-fixed-variant: '#2d4e2a'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  headline-xl:
    fontFamily: Lora
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Lora
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Lora
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Lora
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: Lora
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Lora
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 24px
  code-md:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  code-sm:
    fontFamily: IBM Plex Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
  margin-handwriting:
    fontFamily: Caveat
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system serves product managers, technical architects, and systems thinkers who bridge execution code with executive-level strategy. It reconciles two distinct mindsets: the structured, deterministic rigor of a development environment (VS Code) and the tactile, organic clarity of physical notebooks and high-end editorial briefs.

The visual style is **Tactile-Editorial Minimalism with IDE Utility**. Rather than forcing a singular aesthetic, the system operates across three distinct viewport contexts:
- **Editor Chrome**: Systematic, neutral, dense, and non-intrusive. It adheres to modern IDE ergonomics with 1px hairline segmentations, exact monospaced tabulations, and clear structural state indicators.
- **Notebook Mode**: Tactile, deliberate, and contemplative. Built on warm paper substrates (`#fcf8f2`), horizontal rule baselines (`#e4d5be`), deep iron-gall ink tones (`#2c2523`), terracotta structural anchors, and expressive margin annotations.
- **Doc Mode**: Clean, authoritative, and publication-grade. Driven by classical editorial proportions, crisp contrast, refined serifs, and high-density schematic primitives.

The resulting emotional signature is disciplined clarity: it strips away the bloated, slow-rendered canvas UI common to standard product management tooling in favor of instant keyboard-driven compilation, structural transparency, and elegant documentation artifact outputs.

## Colors

The palette operates across three distinct thematic modes: the foundational IDE Host Container (Dark/Light), Notebook Paper View, and Doc Publication View.

### IDE Host Chrome (Default Dark Engine)
- **Workbench Base (`neutral_color_hex`)**: `#1e1e1e` — Root frame and activity backing.
- **Editor Background**: `#252526` — Canvas surface for active `.jtr` code editing.
- **Chrome Borders**: `#333333` in dark mode; `#e5e7eb` in light mode.
- **Interactive Focus / Indicators**: Primary Terracotta `#c67139` and Slate Cyan `#436475`.

### Notebook Mode Surfaces & Accents
- **Canvas Base**: `#fcf8f2` (Warm Paper Cream) transitioning down to `#f5ead8` for elevated card primitives.
- **Rule Lines**: `#e4d5be` — Strict 28px vertical baseline guides.
- **Primary Ink**: `#2c2523` — High-legibility warm carbon for primary reading.
- **Muted Ink**: `#73685e` — Structural secondary notations and metadata.
- **Terracotta Primary Accent (`primary_color_hex`)**: `#c67139` — Primary entity anchors, active selections, section dividers, and compilation targets.
- **Sage Tertiary (`tertiary_color_hex`)**: `#5e8259` — Validated states, resolved facts, and stable dependency tags.

### Doc Mode Surfaces & Accents
- **Viewport Canvas**: `#f3f4f6` (Subtle Neutral Grey Backing).
- **Document Sheet**: `#ffffff` (Crisp Monolith Surface).
- **Sheet Hairline**: `#e5e7eb` (Subtle 1px boundary stroke).
- **Editorial Typography**: `#111827` primary body, `#4b5563` supporting text.

### Syntax Highlighting Engine (`.jtr` Lexicon)
- **Directives & Entities (`@project`, `@pillar`, `@star_model`)**: `#c67139` (Terracotta bold).
- **Data & Relationships (`@fact`, `@link`, `@tree`)**: `#436475` (Steel Slate Blue).
- **Structural Nodes (`@table`, `@divider`)**: `#73685e` (Neutral Umber).
- **Marginalia & Comments (`@note`)**: `#8b634b` (Sepia Ochre).

## Typography

The typographic hierarchy balances technical precision and long-form readability through three strict type roles:

1. **System & Tooling (`Inter`)**: Controls VS Code tabs, status bars, activity icons, tree-view directories, and command palettes. Clean, anti-aliased, and condensed to maximize editor canvas space.
2. **Grammar & Input (`IBM Plex Mono`)**: The sole face for `.jtr` source execution, tabular text matrices, and relationship AST previews. Set with generous line height (`20px` at `13px` base) to allow visual room for inline lint errors and AST glyphs.
3. **Synthesis & Reading (`Lora`)**: Powers the generated preview renderers in both Doc and Notebook modes. Headings and body copy adhere strictly to a 28px vertical baseline grid, aligning cleanly with notebook ruled canvas backgrounds.
4. **Marginalia Callouts (`Caveat`)**: Used for non-destructive reader annotations, side-by-side commentary, and draft-stage product hypothesis marks (`@note`). Positioned in outer visual margins and linked with physical connecting tick rules.

## Layout & Spacing

The layout model uses a dual-pane split workbench:
- **Left Pane (Source `.jtr` Canvas)**: Fluid horizontal buffer conforming to the standard monospaced 80/120-column boundary. Left gutter accommodates line numbers, fold toggles, and AST validity tokens (8px width).
- **Right Pane (Synthesized Artifact Canvas)**: Centered fixed-grid artboard. 
  - **Doc Mode**: Single-column 840px sheet framed inside an infinite neutral workspace with a 32px safe outer boundary.
  - **Notebook Mode**: Two-column asymmetric spread (680px main column for core document flow + 220px outer margin column dedicated to `@note` handwriting annotations and callout ticks).

The vertical rhythm locks to a 28px baseline grid across the synthesis panes, ensuring body typography, structural dividers, and card primitives consistently rest upon the printed paper rules without drift.

## Elevation & Depth

Visual hierarchy does not use soft, blurred multi-tier dropshadows. It relies on architectural line weights, surface tint layering, and precise 1px ghost borders:

- **IDE Chrome Layering**: Flat, non-projecting surface-stacking. The active file tab is lifted via a `#c67139` 2px top edge indicator and matching background `#252526` contrasted against `#1e1e1e` host chrome.
- **Notebook Primitives**: 1px crisp outline (`#e4d5be`) over elevated parchment fills (`#f5ead8`). Cards and Star Model entities cast no blur shadow; they use a solid 2px offset hard shadow (`box-shadow: 2px 2px 0px #e4d5be`) to emulate physical index cards pinned to ruled paper.
- **Doc Mode Surfaces**: Elevated document sheets float above the `#f3f4f6` grey canvas using a crisp perimeter border (`#e5e7eb`) accompanied by an ambient structural occlusion shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)`.
- **Modals & Command Palettes**: Monolithic framing using a 1px border (`#333333` Dark / `#d1d5db` Light) with an assertive, crisp drop: `0 12px 24px -4px rgba(0, 0, 0, 0.35)`.

## Shapes

The interface is calibrated to Level 1 (`Soft`, `0.25rem` / `4px` baseline) to maintain visual kinship with developer environments:
- **IDE Tabs & Action Controls**: `4px` radius on hover pills; `0px` radius on active tab bases.
- **Interactive Entity Cards & Star Model Nodes**: `4px` corners with hairline 1px strokes.
- **Status Badges & Keyword Tokens**: `2px` corners, maintaining maximum density without sharp needle points.
- **Connecting Lines & Tree Branches**: Strict 90-degree orthogonal routing with a `4px` corner fillet at inflection intersections.

## Components

### Buttons & Interactive Controls
- **Primary Compile Action**: Terracotta solid (`#c67139`) with crisp white Inter label (`label-md`), 4px corner radius, zero blur shadow. Active states compress down by 1px.
- **Secondary Ghost Controls**: Transparent fill, 1px border in `#e5e7eb` (or `#333333` dark), neutral text, hovering into a 10% tint of the primary accent.
- **Mode Switcher (Code / Notebook / Doc)**: Segmented control group with a 2px interior gutter. Active segment adopts high-contrast canvas backing with 1px border.

### Star Model Entity Cards (`@star_model`)
- Visual architecture: A central node linked orthogonally to radiating dependency and metric nodes.
- Center Card: High-contrast parchment fill (`#ffffff` or `#f5ead8`), 1px solid border (`#c67139`), headline in `Lora` 14px bold, with an IBM Plex Mono technical identifier tag (`label-sm`).
- Satellite Nodes: Neutral container boxes linked with 1px solid vector routes (`#436475`), populated with dynamic slot counts, metric targets, and status pips.

### Hierarchical Tree Primitives (`@tree`)
- Monospaced, line-guided structural diagrams.
- Direct orthogonal trunk lines (`1px solid #e4d5be` in Notebook, `#d1d5db` in Doc).
- Expand/collapse triggers formatted as geometric monospaced glyphs (`[+]` / `[-]`) in `IBM Plex Mono`.

### Tables (`@table`)
- Pure editorial data alignment.
- Header row features a 1.5px solid bottom border (`#2c2523` Notebook / `#111827` Doc), text set in `Inter` semi-bold (`label-md`).
- Cells feature 0.5px muted divider rules, zero vertical border lines, and right-aligned numeric data in `IBM Plex Mono`.

### Margin Callouts (`@note`)
- Hand-drawn annotation styling placed exclusively in the right margin channel.
- Rendered in `Caveat` handwriting script (`margin-handwriting`), ink color `#8b634b`.
- Connected to highlighted source body phrases via a horizontal 1px tick rule terminating in a 3px solid ink circular dot.

### Keyword Badges & Chips
- Reserved compiler tags (`@project`, `@pillar`, `@fact`, `@link`) appear as inline pills:
  - Height: `18px`, border radius: `2px`, typography: `code-sm`.
  - Padding: `1px 6px`.
  - Surface: 10% alpha fill of the respective semantic color token, 1px border at 30% alpha.