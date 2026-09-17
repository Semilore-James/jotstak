import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Marketing pages live under src/pages (index, playground).
// Docs live under /docs, powered by Starlight, generated in the same build.
// Deploy target: Cloudflare Pages (static output).
export default defineConfig({
  site: "https://jotter.dev",
  integrations: [
    starlight({
      title: "Jotter Docs",
      social: {
        github: "https://github.com/TBD/jotter",
      },
      sidebar: [
        { label: "Getting started", autogenerate: { directory: "docs/getting-started" } },
        { label: "Guides", autogenerate: { directory: "docs/guides" } },
        { label: "Reference", autogenerate: { directory: "docs/reference" } },
      ],
    }),
  ],
});
