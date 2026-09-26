// @journey — stages left to right, and the line that shows how it felt.
//
// A journey map is not a list of stages. The list is the easy part and any
// document can carry it; what makes the map worth drawing is that you can SEE
// where the experience falls over, in one glance, before reading a word. So
// the emotion line is the diagram here, not an ornament on it: a neutral
// baseline with the journey rising above and dropping below it.
//
// That line is the first thing in this renderer drawn as SVG rather than with
// borders. @tree set the rule — SVG is for connector geometry a border cannot
// express — and a polyline through n points at three heights is exactly that.
// Only the line is SVG. The dots are ordinary elements in the grid, because a
// circle stretched by a non-uniform viewBox is an ellipse.
//
// Stage columns are equal, for the same reason a matrix's quadrants are: a
// stage with more written under it is not a longer or more important stage,
// and sizing it that way says it is.

import { ESTIMATE_SAFETY, measureText, segments, type Face } from "./measure.js";
import { figureAttrs, placeFigure, ROW, wholeRows } from "./figure.js";
import { PAGE } from "./page.js";
import type { Placement, Size } from "./figure.js";
import type { BlockNode, TreeNode } from "./ast.js";
import type { Diagnostic } from "./index.js";

/** Every length the renderer and the stylesheet both need. */
export const JOURNEY = {
  row: ROW,
  /** The stage name. */
  nameSize: 14,
  /** A touchpoint, action or pain point under it. */
  itemSize: 13,
  /** A swim lane's label. */
  trackSize: 12,
  /** The emotion band: happy, neutral, frustrated. */
  bandRows: 3,
  dot: 9,
  /** Space between one stage column's text and the next. */
  gutter: 10,
  /** Narrowest a stage may be: seven of these fit a portrait page. */
  minColW: 96,
  /** Vertical: the rail inset and the gap from rail to text. */
  railX: 7,
  railGap: 21,
} as const;

export type Feeling = "happy" | "neutral" | "frustrated";

const FEELINGS: Record<string, Feeling> = {
  happy: "happy",
  neutral: "neutral",
  frustrated: "frustrated",
  // The words people reach for instead, because being told "that is not a
  // feeling" by a document tool is a silly way to lose two minutes.
  good: "happy",
  great: "happy",
  ok: "neutral",
  fine: "neutral",
  bad: "frustrated",
  sad: "frustrated",
  angry: "frustrated",
};

/** Where each feeling sits in the band, top to bottom. */
export const LEVEL: Record<Feeling, number> = { happy: 0, neutral: 1, frustrated: 2 };

export interface Stage {
  name: string;
  feeling: Feeling;
  items: string[];
}

export interface Track {
  name: string;
  stages: Stage[];
}

export interface JourneyModel {
  title: string;
  tracks: Track[];
  vertical: boolean;
  /** True when the author wrote no `track` at all: one unnamed lane. */
  single: boolean;
}

/** `stage Discover feeling=happy` → the name and the feeling. */
export function readStage(
  text: string,
  diagnostics: Diagnostic[],
  at: TreeNode["position"],
): { name: string; feeling: Feeling } {
  let rest = text.trim().replace(/^stage\s+/i, "");
  let feeling: Feeling = "neutral";

  rest = rest.replace(/\s*\bfeeling\s*=\s*"?([A-Za-z]+)"?/gi, (_m, word: string) => {
    const known = FEELINGS[word.toLowerCase()];
    if (known) feeling = known;
    else {
      diagnostics.push({
        severity: "warning",
        message: `"${word}" is not a feeling, so this stage is drawn as neutral. The three are happy, neutral and frustrated.`,
        line: at.line,
        column: at.column,
      });
    }
    return "";
  });

  return { name: rest.trim(), feeling };
}

const isTrack = (text: string): boolean => /^track\s+/i.test(text.trim());
const isStage = (text: string): boolean => /^stage\s+/i.test(text.trim());

export function buildJourney(n: BlockNode, diagnostics: Diagnostic[]): JourneyModel {
  const roots = n.body.shape === "indented" ? n.body.roots : [];
  const vertical = n.params.dir === "vertical";

  const toStage = (node: TreeNode): Stage => {
    const { name, feeling } = readStage(node.text, diagnostics, node.position);
    return { name, feeling, items: node.children.map((c) => c.text) };
  };

  const tracks: Track[] = [];
  const loose: Stage[] = [];

  for (const root of roots) {
    if (isTrack(root.text)) {
      tracks.push({
        name: root.text.trim().replace(/^track\s+/i, ""),
        stages: root.children.map(toStage),
      });
      continue;
    }
    if (!isStage(root.text)) {
      diagnostics.push({
        severity: "warning",
        message: `"${root.text}" is drawn as a stage. Write \`stage ${root.text}\` to say so, or \`track ${root.text}\` to start a swim lane.`,
        line: root.position.line,
        column: root.position.column,
      });
    }
    loose.push(toStage(root));
  }

  if (loose.length > 0) tracks.unshift({ name: "", stages: loose });

  if (tracks.every((t) => t.stages.length === 0)) {
    diagnostics.push({
      severity: "warning",
      message: "This journey has no stages. Each one is a line: `stage Discover feeling=happy`, with what happens indented under it.",
      line: n.position.line,
      column: n.position.column,
    });
  }

  return {
    title: n.params.title ?? n.title ?? "",
    tracks,
    vertical,
    single: tracks.length === 1 && tracks[0]!.name === "",
  };
}

const width = (text: string, face: Face, size: number): number =>
  measureText(text, face, size) * ESTIMATE_SAFETY;

/** How many lines `text` takes in `w` pixels. Rounds up, which errs tall. */
function lines(text: string, face: Face, size: number, w: number): number {
  if (!text || w <= 0) return 0;
  // A break the author asked for costs a line whether or not the text would
  // have wrapped there anyway, so each segment is counted on its own.
  return segments(text).reduce(
    (total, part) => total + Math.max(1, Math.ceil(width(part, face, size) / w)),
    0,
  );
}

export interface TrackMetrics {
  /** Rows for the lane's own label, 0 when it has none. */
  label: number;
  /** Rows the tallest stage NAME takes. */
  name: number;
  /** Rows the tallest stack of items takes. */
  items: number;
}

export interface JourneyMetrics extends Size {
  column: number;
  tracks: TrackMetrics[];
}

export function measureJourney(m: JourneyModel, pinned = "auto"): JourneyMetrics {
  const widest = Math.max(1, ...m.tracks.map((t) => t.stages.length));

  if (m.vertical) {
    const cardW = 420;
    const rows = m.tracks.reduce(
      (a, t) =>
        a +
        (t.name ? 1 : 0) +
        t.stages.reduce(
          (b, s) =>
            b +
            lines(s.name, "lora-600", JOURNEY.nameSize, cardW) +
            s.items.reduce((c, i) => c + lines(i, "lora-400", JOURNEY.itemSize, cardW), 0) +
            1,
          0,
        ),
      0,
    );
    return {
      w: 0,
      h: wholeRows(((m.title ? 1 : 0) + Math.max(1, rows)) * ROW),
      column: 0,
      tracks: [],
    };
  }

  // A journey is a plate, like a matrix and a timeline: it takes the whole
  // printable width and divides it into equal stages, rather than shrinking to
  // its contents. Measuring against a narrower width than it is drawn at is
  // what made the timeline stand a row too tall, so the two agree here.
  const room =
    pinned === "landscape"
      ? PAGE.landscape.content
      : pinned === "column" || pinned === "wide"
        ? PAGE.portrait.column
        : PAGE.portrait.content;
  const w = JOURNEY.minColW * widest > room ? JOURNEY.minColW * widest : room;
  const column = w / widest;
  const cardW = column - JOURNEY.gutter * 2;

  const tracks: TrackMetrics[] = m.tracks.map((t) => ({
    label: t.name ? 1 : 0,
    name: Math.max(1, ...t.stages.map((s) => lines(s.name, "lora-600", JOURNEY.nameSize, cardW))),
    items: Math.max(
      0,
      ...t.stages.map((s) =>
        s.items.reduce((a, i) => a + lines(i, "lora-400", JOURNEY.itemSize, cardW), 0),
      ),
    ),
  }));

  const rows =
    (m.title ? 1 : 0) +
    tracks.reduce((a, t) => a + t.label + t.name + JOURNEY.bandRows + t.items, 0);

  return { w, h: wholeRows(Math.max(1, rows) * ROW), column, tracks };
}

/** Inline Markdown, with a `\n` drawn as the break the author asked for. */
const broken = (h: { inline: (t: string) => string }, text: string): string =>
  segments(text).map(h.inline).join("<br>");

export interface JourneyHelpers {
  inline: (text: string) => string;
  escapeHtml: (s: string) => string;
  attr: (name: string, value: string | undefined) => string;
}

/**
 * The emotion line, as an SVG polyline over the band.
 *
 * The viewBox is one unit per stage across and one per feeling down, with
 * `preserveAspectRatio="none"`, so a point at (i + 0.5, level + 0.5) lands
 * exactly on the centre of that stage's column and that feeling's row — the
 * same cells the dots sit in — whatever width the figure ends up.
 *
 * Stretching a viewBox that way would normally ruin the stroke along with
 * everything else; `vector-effect="non-scaling-stroke"` keeps it a hairline.
 * It is also why nothing round is drawn in here.
 */
function emotionLine(stages: Stage[]): string {
  const n = stages.length;
  if (n === 0) return "";
  const points = stages
    .map((s, i) => `${i + 0.5},${LEVEL[s.feeling] + 0.5}`)
    .join(" ");
  const single = n === 1 ? ` <circle cx="0.5" cy="${LEVEL[stages[0]!.feeling] + 0.5}" r="0.04" />` : "";
  return (
    `<svg class="jot-journey-line" viewBox="0 0 ${n} ${JOURNEY.bandRows}" preserveAspectRatio="none" aria-hidden="true">` +
    `<polyline points="${points}" vector-effect="non-scaling-stroke" />${single}</svg>`
  );
}

export function renderJourney(
  n: BlockNode,
  diagnostics: Diagnostic[],
  h: JourneyHelpers,
  nested: string,
): string {
  const model = buildJourney(n, diagnostics);
  const pinned = n.params.width ?? "auto";
  const metrics = measureJourney(model, pinned);
  const place: Placement = placeFigure(metrics, pinned, n, diagnostics, {
    noun: "journey",
    hint: "`dir=vertical` runs down the page instead, and fits any number of stages.",
    sized: !model.vertical,
  });

  const title = model.title ? `<p class="jot-journey-title">${h.inline(model.title)}</p>` : "";
  const items = (s: Stage): string =>
    s.items.map((i) => `<p class="jot-journey-item">${broken(h, i)}</p>`).join("");

  const inner = model.vertical
    ? model.tracks
        .map(
          (t) =>
            (t.name ? `<p class="jot-journey-track">${h.inline(t.name)}</p>` : "") +
            `<ol class="jot-journey-rail">` +
            t.stages
              .map(
                (s) =>
                  `<li class="jot-journey-step" data-feeling="${s.feeling}">` +
                  `<span class="jot-journey-dot"></span>` +
                  `<p class="jot-journey-name">${broken(h, s.name)}</p>${items(s)}</li>`,
              )
              .join("") +
            `</ol>`,
        )
        .join("")
    : model.tracks
        .map((t, ti) => {
          const cols = Math.max(1, t.stages.length);
          const m = metrics.tracks[ti]!;
          // The stage generates no box of its own (display: contents), so its
          // three parts are grid items of the lane and each carries the column
          // itself. Written here rather than derived in CSS because the
          // renderer already knows the index and a grid line from calc() is
          // newer than it needs to be.
          const cell = (s: Stage, i: number): string => {
            const col = ` style="grid-column:${i + 1}`;
            return (
              `<div class="jot-journey-stage" data-feeling="${s.feeling}">` +
              `<p class="jot-journey-name"${col}">${broken(h, s.name)}</p>` +
              `<span class="jot-journey-dot"${col};--jot-j-level:${LEVEL[s.feeling]}"></span>` +
              `<div class="jot-journey-items"${col}">${items(s)}</div>` +
              `</div>`
            );
          };
          return (
            (t.name ? `<p class="jot-journey-track">${h.inline(t.name)}</p>` : "") +
            `<div class="jot-journey-lane" style="--jot-j-n:${cols};--jot-j-name:${m.name};--jot-j-items:${m.items}">` +
            `<div class="jot-journey-band">${emotionLine(t.stages)}</div>` +
            t.stages.map(cell).join("") +
            `</div>`
          );
        })
        .join("");

  return (
    `<div class="jot-figure" data-figure="journey"${model.vertical ? "" : " data-fill"}${figureAttrs(place, metrics, !model.vertical)}>` +
    `<div class="jot-journey" data-dir="${model.vertical ? "vertical" : "horizontal"}"${h.attr("id", n.params.id)}>` +
    title +
    inner +
    `</div></div>` +
    (nested ? `<div class="jot-nested">${nested}</div>` : "")
  );
}
