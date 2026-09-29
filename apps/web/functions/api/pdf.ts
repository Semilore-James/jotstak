// POST /api/pdf — the playground's Download PDF (UX-69). Everything it does is
// in src/lib/pdf-service.ts, which is tested without Cloudflare.
import { handlePdf } from "../../src/lib/pdf-service";
import type { PdfEnv } from "../../src/lib/pdf-service";

export const onRequest = (context: { request: Request; env: PdfEnv }): Promise<Response> =>
  handlePdf(context.request, context.env);
