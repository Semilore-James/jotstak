# ADR-002: Aligning ruled lines with text baselines

- **Status:** **Accepted** — Option A on top of C's grid discipline, 2026-09-17
- **Date:** 2026-09-17
- **Stage:** 11 (Technical design) in [go_to_jotstak.md](../go_to_jotstak.md)

## Context

**Target, set by the owner from handwriting reference photos:** text sits **on** the rule, the way handwriting sits on ruled paper — baseline on the line, descenders (g, j, p, q, y) dipping into the space below, ascenders staying clear of the line above. Not text floating between lines.

**What M0 step 2 showed:** the token specimen had correct 28px line *spacing* but wrong *phase*. Rules were drawn at the bottom of each 28px line box while the glyph baseline sits several pixels higher, and a 14px top padding shifted everything by half a row. Rules cut through text.

**What makes this non-trivial:**
- **Several typefaces** with different metrics: Lora (body and headings), IBM Plex Mono (code), Caveat (margin notes), Inter (labels).
- **Several sizes** sharing one 28px rhythm: body 16px, headings 18–36px.
- **Font loading:** until Lora arrives, the browser shows a fallback font with different metrics (`font-display: swap`).
- **Every output:** the web playground (any browser), the VS Code webview (Chromium), exported HTML (any browser), print.
- Only notebook mode is ruled; doc mode is unaffected.

An interactive comparison was built for this decision; it measures the alignment error in the viewer's browser for each approach, font state and size.

## Decision drivers

1. **Fidelity** — baseline on the rule, matching the reference.
2. **Robustness** — holds across typefaces, sizes and the font-loading state.
3. **Browser coverage** — the playground and HTML export can be opened anywhere.
4. **Simplicity and testability** — can be verified automatically, not by eye.
5. **Accessibility** — text stays real, selectable, searchable HTML (WCAG AA is a v1 commitment).

## Options

### A — Offsets derived from font metrics

Each font's vertical metrics (ascent, descent, units per em) determine where its baseline sits inside a 28px line box: *half-leading + ascent*. From that, the renderer sets the rule phase and a per-text-style offset.

- Metrics are **extracted from the actual font files at build time** (a font-parsing library in a build script) and emitted by `renderThemeCss()` as CSS variables — deterministic constants, unit-testable.
- **For:** exact; works in every browser; correct for every face and size because each gets its own computed value.
- **Against:** needs a small build step; tied to the specific font files (a font update means re-running the extraction, which a test can enforce); during font loading the fallback font has different metrics, so alignment can jump when Lora arrives unless mitigated (below).

### B — CSS text-box trimming (`text-box-trim` / `text-box-edge`)

Newer CSS that trims the extra space above cap height and below the baseline from a block's first and last lines, so block edges land on typographic lines rather than on half-leading.

- **For:** declarative; font-agnostic; the modern standards answer for vertical rhythm between blocks.
- **Against:** it trims **block edges**, not each line — it doesn't by itself place every baseline on a repeating background grid, so a phase offset is still needed; **browser support is uneven** (the comparison page reports support in the viewer's browser; verify at build time rather than assume); needs a fallback where unsupported, which is effectively Option A anyway.

### C — Grid discipline with one hand-tuned offset

Classic baseline-grid practice from print and web typography: every height, margin, padding and border is a whole multiple of 28px, and a single rule offset is tuned by eye for body text.

- **For:** simplest; widely understood; no build step.
- **Against:** the tuned offset is correct for **one face at one size**. Headings, code, margin notes and the fallback font all land off the line — the comparison page shows exactly this.

### D — Draw rules only under lines of text — *rejected*

Underlines or per-line decorations. Blank areas of the page would look unruled, which doesn't match ruled paper.

### E — Render the page to canvas or SVG — *rejected*

Pixel-perfect, but text stops being real HTML: not selectable, searchable or screen-reader friendly. Violates the WCAG AA commitment.

## Comparison

| Driver | A · Metric offsets | B · text-box trim | C · One tuned offset |
| --- | --- | --- | --- |
| Fidelity (on the rule) | Strong | Strong where supported | Body text only |
| Robust across faces & sizes | Strong | OK | Weak |
| Browser coverage | All | Uneven | All |
| Simplicity | OK (build step) | Strong | Strongest |
| Testable automatically | Strong | OK | Weak |

## Recommendation

**Option A on top of C's grid discipline, with B held back as a later enhancement.**

1. **Keep grid discipline** — the ruled-line contract already requires every block height to round to whole 28px rows. That stays.
2. **Derive baseline offsets from the real font files at build time** and emit them from `renderThemeCss()` as CSS variables, one per text style. Tests assert the values match the fonts.
3. **Fix the font-loading jump** with metric-matched fallback faces: CSS `ascent-override`, `descent-override` and `size-adjust` on a local fallback so its baseline lands where Lora's will. (Support for these descriptors varies by engine — verify during implementation.)
4. **Revisit B** once support is broad enough, for inter-block spacing only.

## Consequences

**Positive:** text sits on the line in every browser, for every face and size; alignment is tested, not eyeballed; the approach generalises to margin notes (Caveat) and code (Plex Mono).

**Negative / to manage:** a font-metrics build script and dev dependency; offsets must be regenerated when font files change (enforced by test); margin notes live in their own column and align to the same grid with their own offset.

**Revisit if:** text-box trimming reaches broad support, or the type scale moves off a single 28px rhythm.
