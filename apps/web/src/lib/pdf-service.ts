// Download PDF: the document printed by a real browser on the server, and sent
// back as a file (UX-69).
//
// Printing in the reader's own browser was exact and private, but it was a
// print window, not a download, and people share PDFs. So the playground posts
// the document here; we render it with the same renderer, hand the page to
// Cloudflare's browser to print, and return the file. Nothing is stored: the
// source is read, printed and dropped with the request.
//
// Kept apart from the Pages Function that serves it, so it can be tested
// without Cloudflare: `fetchImpl` is the only way out.

import { documentName, renderStandalone } from "@jotstak/renderer";

export interface PdfEnv {
  /** A Cloudflare API token with the "Browser Rendering - Edit" permission. */
  BROWSER_RUN_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
}

/** Big enough for any real document; small enough that nobody prints a novel on our quota. */
export const MAX_SOURCE_BYTES = 256 * 1024;

const json = (status: number, body: Record<string, string>): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** An RFC 6266 attachment header that survives any character in the name. */
function attachment(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(`${name}.pdf`)}`;
}

export async function handlePdf(request: Request, env: PdfEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "Use POST." });

  // Only the site's own pages. Anyone else calling this would be printing on
  // our free allowance.
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) return json(403, { error: "Not from this site." });

  if (!env.BROWSER_RUN_TOKEN || !env.CF_ACCOUNT_ID) {
    return json(503, { error: "The PDF service is not set up yet.", fallback: "print" });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_SOURCE_BYTES) {
    return json(413, { error: "This document is too long to print here.", fallback: "print" });
  }

  let body: { source?: unknown; mode?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Expected JSON." });
  }
  if (typeof body.source !== "string") return json(400, { error: "Expected the document's source." });
  const mode = body.mode === "doc" ? "doc" : "notebook";

  const name = documentName(body.source);
  // Fonts from this site: the browser that prints fetches them like a reader
  // would, and waits for the network to settle before it prints.
  const { html } = renderStandalone(body.source, { mode, title: name, assetBase: origin });

  let printed: Response;
  try {
    printed = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-run/pdf`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${env.BROWSER_RUN_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({
          html,
          // The page's own @page rules decide the paper, and draw the margins
          // inside it; the browser adds nothing of its own.
          pdfOptions: { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false },
          gotoOptions: { waitUntil: "networkidle0", timeout: 20000 },
        }),
      },
    );
  } catch {
    return json(502, { error: "Could not reach the printer.", fallback: "print" });
  }

  const type = printed.headers.get("content-type") ?? "";
  if (!printed.ok || !type.includes("application/pdf")) {
    // Most often the day's free allowance is used up. The page falls back to
    // the reader's own print window, which needs nothing from us.
    return json(502, { error: "The printer is busy.", fallback: "print" });
  }

  return new Response(printed.body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": attachment(name),
      "cache-control": "no-store",
    },
  });
}
