// Diagrams for the Word file, drawn by the page itself.
//
// A diagram in a .docx is a picture (PRD-31). Rather than drawing each kind of
// diagram a second time for Word, this takes the figure exactly as the page
// renders it — the same renderer, the same stylesheet, in doc mode — and
// photographs it: the HTML goes inside an SVG as a foreignObject, the SVG is
// drawn onto a canvas, and the canvas becomes a PNG. Everything happens in the
// reader's browser; the document never leaves it.
//
// The figure is laid out in a hidden frame of its own first, so it can be
// measured — and so the website's own styles, which share the .jotstak scope
// with the document, cannot reach it.

import { FONT_FACES, PAGE, renderDocument, renderLayoutCss, renderThemeCss } from "@jotstak/renderer";
import type { DocumentNode, Node } from "@jotstak/renderer";
import type { DrawPicture, Picture, PictureRequest } from "@jotstak/docx";

/** Pixels per CSS pixel in the picture: crisp on a printed page, without making the file huge. */
const SCALE = 2;

/**
 * The print stylesheet's own resets, which is what a picture is: the sheet at
 * 1:1, no grey desk, no frame, no padding. Plus a white ground, so a diagram
 * stays readable in Word's dark mode rather than turning to ink on black.
 */
const CAPTURE_CSS = `
.jotstak { --jot-fit: 1; }
.jotstak[data-mode="doc"] { background: none; padding: 0; }
.jotstak[data-mode="doc"] .jot-doc { max-width: none; margin: 0; padding: 0; border: 0; box-shadow: none; border-radius: 0; background: #fff; }
`;

async function dataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The fonts, as data: a picture made from an SVG may not load anything from outside itself. */
async function embeddedFontCss(): Promise<string> {
  const faces = await Promise.all(
    FONT_FACES.map(
      async (f) =>
        `@font-face { font-family: "${f.family}"; font-style: ${f.style}; font-weight: ${f.weight}; ` +
        `src: url(${await dataUrl(`/fonts/${f.file}`)}) format("woff2"); }`,
    ),
  );
  return faces.join("\n");
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The diagram could not be drawn."));
    img.src = src;
  });

export interface PictureMaker {
  draw: DrawPicture;
  dispose(): void;
}

export async function createPictureMaker(): Promise<PictureMaker> {
  const css = `${await embeddedFontCss()}\n${renderThemeCss({})}\n${renderLayoutCss()}\n${CAPTURE_CSS}`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:-20000px;top:0;width:1400px;height:1000px;border:0;visibility:hidden;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="margin:0"><div id="cap"></div></body></html>`);
  doc.close();
  const cap = doc.getElementById("cap")!;

  const draw = async (nodes: Node[], request: PictureRequest): Promise<Picture | undefined> => {
    const ast: DocumentNode = { type: "document", children: nodes, position: { line: 0, column: 0 } };
    const html = renderDocument(ast, { mode: "doc" }, []);
    // A figure the renderer has sent to a landscape page is laid out for one.
    const landscape = request.landscape && /data-page="landscape"/.test(html);
    const width = landscape ? PAGE.landscape.content : request.width;

    cap.style.width = `${width}px`;
    cap.innerHTML = html;
    // Lay it out now, which is also what sets its fonts loading, then wait for
    // them. Not an animation frame: a browser stops those for a tab that is
    // not on screen, and someone who switches tabs while their Word file is
    // being made would wait for ever.
    void cap.offsetHeight;
    await doc.fonts.ready;

    // The figure's own extent: everything in the row, without the row's margin below.
    const origin = cap.getBoundingClientRect();
    const parts = [...cap.querySelectorAll(".jot-body > *")];
    if (parts.length === 0) return undefined;
    let right = 0;
    let bottom = 0;
    for (const el of parts) {
      const r = el.getBoundingClientRect();
      right = Math.max(right, r.right - origin.left, el.scrollWidth);
      bottom = Math.max(bottom, r.bottom - origin.top);
    }
    const w = Math.ceil(Math.max(width, right));
    const h = Math.ceil(bottom);
    if (h === 0) return undefined;

    const xhtml = new XMLSerializer().serializeToString(cap);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<foreignObject x="0" y="0" width="${w}" height="${h}">` +
      `<div xmlns="http://www.w3.org/1999/xhtml"><style><![CDATA[${css}]]></style>${xhtml}</div>` +
      `</foreignObject></svg>`;
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

    const canvas = document.createElement("canvas");
    canvas.width = w * SCALE;
    canvas.height = h * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return undefined;
    return { png: new Uint8Array(await blob.arrayBuffer()), width: w, height: h, landscape };
  };

  return { draw, dispose: () => frame.remove() };
}
