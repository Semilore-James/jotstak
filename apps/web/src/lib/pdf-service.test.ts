// The PDF service, with Cloudflare's browser replaced by a stand-in: what is
// sent to it, and what comes back to the reader.

import { describe, expect, it, vi } from "vitest";
import { documentName } from "@jotstak/renderer";
import { MAX_SOURCE_BYTES, handlePdf } from "./pdf-service";

const SITE = "https://jotstak.pages.dev";
const ENV = { BROWSER_RUN_TOKEN: "test-token", CF_ACCOUNT_ID: "acct" };

function post(body: unknown, origin = SITE): Request {
  return new Request(`${SITE}/api/pdf`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const printer = (response: Response) => vi.fn(async () => response);
const aPdf = () => new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } });

describe("who may ask", () => {
  it("takes a POST from the site's own pages only", async () => {
    expect((await handlePdf(new Request(`${SITE}/api/pdf`), ENV)).status).toBe(405);
    expect((await handlePdf(post({ source: "x" }, "https://elsewhere.example"), ENV)).status).toBe(403);
  });

  it("says it is not set up, and to print instead, when there is no token", async () => {
    const res = await handlePdf(post({ source: "x" }), {});
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ fallback: "print" });
  });

  it("turns away a document too long to print here", async () => {
    const res = await handlePdf(post({ source: "x".repeat(MAX_SOURCE_BYTES + 1) }), ENV, printer(aPdf()));
    expect(res.status).toBe(413);
  });

  it("turns away anything that is not a document", async () => {
    expect((await handlePdf(post("not json"), ENV)).status).toBe(400);
    expect((await handlePdf(post({ source: 42 }), ENV)).status).toBe(400);
  });
});

describe("what is sent to the printer", () => {
  it("is the rendered page, with the paper and margins its own print rules draw", async () => {
    const fetchImpl = printer(aPdf());
    await handlePdf(post({ source: "# Pricing v2\n\nSeat pricing punishes adoption.", mode: "doc" }), ENV, fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct/browser-run/pdf");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-token");

    const sent = JSON.parse(String(init.body));
    expect(sent.pdfOptions).toEqual({ printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
    expect(sent.html).toContain("Seat pricing punishes adoption.");
    expect(sent.html).toContain('data-mode="doc"');
    expect(sent.html).toContain("@page { size: A4 portrait; margin: 0; }");
    // The fonts come from this site, for the printing browser to fetch.
    expect(sent.html).toContain(`url("${SITE}/fonts/`);
  });
});

describe("what comes back", () => {
  it("is a PDF file, named for the document", async () => {
    const res = await handlePdf(post({ source: "# Pricing v2\n\nWords." }), ENV, printer(aPdf()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain('filename="Pricing v2.pdf"');
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("falls back to printing when the printer fails or is busy", async () => {
    for (const fail of [
      new Response("quota", { status: 429 }),
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    ]) {
      const res = await handlePdf(post({ source: "Words." }), ENV, printer(fail));
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ fallback: "print" });
    }
    const down = vi.fn(async () => {
      throw new Error("network");
    });
    expect((await handlePdf(post({ source: "Words." }), ENV, down)).status).toBe(502);
  });
});

describe("what a document is called", () => {
  it("takes its first heading, else its metadata, else a plain name", () => {
    expect(documentName("# Moving to usage-based pricing\n\nText")).toBe("Moving to usage-based pricing");
    expect(documentName("@meta\n  name: Endless Journaling\n\nText")).toBe("Endless Journaling");
    expect(documentName("Just some words.")).toBe("Jotstak document");
  });

  it("keeps it safe to save", () => {
    expect(documentName("# Q3 / Q4: **plan**?")).toBe("Q3 Q4 plan");
  });
});
