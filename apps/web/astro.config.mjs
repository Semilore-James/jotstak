import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Marketing pages live under src/pages (index, playground).
// Docs live under /docs, powered by Starlight, generated in the same build.
// Deploy target: Cloudflare Pages (static output).
//
// `site` and Starlight's `social.github` are intentionally unset until the
// domain is registered and the GitHub repo exists — no placeholder URLs.
export default defineConfig({
  integrations: [
    starlight({
      title: "Jotstak Docs",
      sidebar: [
        { label: "Getting started", autogenerate: { directory: "docs/getting-started" } },
        { label: "Guides", autogenerate: { directory: "docs/guides" } },
        { label: "Reference", autogenerate: { directory: "docs/reference" } },
      ],
    }),
  ],
});
