// Pages on screen (UX-73).
//
// A document used to be one long sheet on screen, with its A4 pages appearing
// only when it was printed. Breaking was automatic, but only in print, so what
// someone read and what they sent were two different layouts of the same
// words. Now the screen shows the pages, and print shows the same pages: each
// sheet prints as exactly one page, so the browser has nowhere left to break.
//
// The rules are print's own, which were written long before this:
//
//   - a block — a card, a table, a diagram — moves to the next page whole
//   - prose, lists and quotes carry on across the break, between two lines
//   - a heading never ends a page
//   - a figure too wide for portrait gets a landscape sheet of its own
//   - @pagebreak starts a new sheet
//   - a block taller than a whole page carries on across sheets
//
// It runs in the browser, after rendering, because where a page ends depends
// on how tall the text set, and only the browser knows that. The renderer
// stays a function from source to HTML; this is the one piece of it that
// needs a document to measure.
//
// SELF-CONTAINED ON PURPOSE. A host that loads modules imports it; a host
// that cannot — an exported HTML file, the PDF service's page, the VS Code
// webview — carries its source inline (pagesScript). So `paginate` may not
// reference anything outside its own body: no imports, no helpers.

import { PAGE } from "./page.js";

export interface SheetGeometry {
  /** The sheet itself, in CSS px. */
  width: number;
  height: number;
  marginX: number;
  marginY: number;
  /** How many 28px rows the printable area holds. */
  rows: number;
}

export interface PageGeometry {
  row: number;
  portrait: SheetGeometry;
  landscape: SheetGeometry;
}

const A4_LONG = (297 * 96) / 25.4;
const A4_SHORT = (210 * 96) / 25.4;

/**
 * The sheets, from the page model print already uses. A landscape sheet keeps
 * the portrait top margin, as the printed one does (ENG-36), so it holds the
 * rows that fit in what is left.
 */
export const PAGE_GEOMETRY: PageGeometry = {
  row: 28,
  portrait: {
    width: A4_SHORT,
    height: A4_LONG,
    marginX: PAGE.marginX,
    marginY: PAGE.portrait.marginY,
    rows: PAGE.portrait.rows,
  },
  landscape: {
    width: A4_LONG,
    height: A4_SHORT,
    marginX: PAGE.marginX,
    marginY: PAGE.portrait.marginY,
    rows: Math.floor((A4_SHORT - 2 * PAGE.portrait.marginY) / 28),
  },
};

/**
 * Lay a freshly rendered document out as sheets. `root` is the `.jotstak`
 * element exactly as render() produced it. Returns how many sheets it made,
 * or 0 when it left the document as one column: on a phone, where the host
 * has reflowed it (REFLOW_BELOW), a sheet of A4 is not what anyone wants.
 */
export function paginate(root: HTMLElement, geo: PageGeometry): number {
  const source = root.querySelector(":scope > .jot-doc");
  if (!source) return 0;
  if (getComputedStyle(root).getPropertyValue("--jot-reflow").trim() === "1") return 0;

  const rows = Array.from(source.children) as HTMLElement[];
  // Each row keeps its place in the document, because counting rows on the
  // page no longer finds it: a row carried across a break is there twice,
  // and a page break's marker is not there at all.
  rows.forEach((row, i) => row.setAttribute("data-row", String(i)));
  const pages = document.createElement("div");
  pages.className = "jot-pages";
  root.setAttribute("data-paged", "");
  root.replaceChild(pages, source);

  const kind = (row: Element): string => row.querySelector(":scope > .jot-body")?.getAttribute("data-kind") ?? "";
  const primitive = (row: Element): string =>
    row.querySelector(":scope > .jot-body")?.getAttribute("data-primitive") ?? "";
  // Text that can carry on across a page between two of its lines.
  const flows = (row: Element): boolean => ["markdown", "list", "quote"].includes(kind(row));

  let doc!: HTMLElement;
  // Asserted rather than annotated: it is changed inside sheet(), which the
  // compiler cannot see from the loop below.
  let orient = "portrait" as "portrait" | "landscape";
  let capacity = 0;
  let unit = 0;
  let scale = 1;

  const sheet = (next: "portrait" | "landscape"): void => {
    const s = document.createElement("section");
    s.className = "jot-sheet";
    s.setAttribute("data-orient", next);
    doc = document.createElement("div");
    doc.className = "jot-doc";
    s.appendChild(doc);
    pages.appendChild(s);
    orient = next;
    // Measured, not assumed: a host zooms the document to fit its column,
    // and every height below is read in whatever units that leaves.
    capacity = doc.clientHeight;
    unit = capacity / geo[next].rows;
    scale = capacity / (geo[next].rows * geo.row);
  };
  /** How far down the current sheet its content reaches. */
  const used = (): number => {
    const last = doc.lastElementChild as HTMLElement | null;
    return last ? last.offsetTop + last.offsetHeight : 0;
  };
  const empty = (): boolean => doc.childElementCount === 0;

  /** The rest of a row too tall for what is left, on the sheets after this one. */
  const carryOn = (row: HTMLElement, shown: number): void => {
    const height = row.offsetHeight;
    let offset = shown;
    while (offset < height - 0.5) {
      sheet(orient);
      const part = row.cloneNode(true) as HTMLElement;
      part.setAttribute("data-continued", "");
      // An id names one place in the document; the copy is not that place.
      part.removeAttribute("id");
      part.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
      part.style.marginTop = `${-offset / scale}px`;
      doc.appendChild(part);
      offset += capacity;
    }
  };

  const place = (row: HTMLElement): void => {
    doc.appendChild(row);
    if (used() <= capacity + 0.5) return;

    const before = used() - row.offsetHeight;
    const room = capacity - before;
    if (!empty() && before > 0 && (!flows(row) || room < 2 * unit)) {
      // It moves to the next sheet, and takes with it any heading that would
      // otherwise be left at the foot of this one — unless the heading is all
      // this sheet holds, which would only move the problem along.
      const carried: HTMLElement[] = [];
      let prev = row.previousElementSibling as HTMLElement | null;
      while (prev && kind(prev) === "heading") {
        carried.unshift(prev);
        prev = prev.previousElementSibling as HTMLElement | null;
      }
      if (carried[0] === doc.firstElementChild) carried.length = 0;
      sheet(orient);
      for (const h of carried) doc.appendChild(h);
      doc.appendChild(row);
      if (used() <= capacity + 0.5) return;
    }
    // Taller than the room it has, even on a sheet of its own: it carries on.
    const top = used() - row.offsetHeight;
    carryOn(row, Math.max(unit, Math.floor((capacity - top) / unit) * unit));
  };

  sheet("portrait");
  let fresh = false;
  for (const row of rows) {
    if (primitive(row) === "pagebreak") {
      // The sheet's edge is the break now; the marker that stood in for it on
      // one long sheet has nothing left to say.
      if (!empty()) fresh = true;
      continue;
    }
    if (row.querySelector('.jot-figure[data-page="landscape"]')) {
      if (empty()) pages.removeChild(pages.lastElementChild!);
      sheet("landscape");
      place(row);
      fresh = true;
      continue;
    }
    if (fresh || orient === "landscape") {
      sheet("portrait");
      fresh = false;
    }
    place(row);
  }
  while (pages.childElementCount > 1 && !pages.lastElementChild!.querySelector(".jot-row")) {
    pages.removeChild(pages.lastElementChild!);
  }
  return pages.childElementCount;
}

/**
 * The pagination as a script, for a page that cannot import it: it defines
 * `jotPages(root)` on the window. The geometry is written in as a value, so
 * the script carries everything it needs.
 */
export function pagesScript(geo: PageGeometry = PAGE_GEOMETRY): string {
  return `window.jotPages = (function () {\n  var paginate = ${paginate.toString()};\n  var geo = ${JSON.stringify(geo)};\n  return function (root) { return root ? paginate(root, geo) : 0; };\n})();`;
}
