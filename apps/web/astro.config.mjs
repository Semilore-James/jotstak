import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Marketing pages live under src/pages (index, playground).
// Docs content lives under src/content/docs/docs/ so Starlight serves it at /docs
// rather than claiming / from the landing page. Same build.
// Deploy target: Cloudflare Pages (static output).
//
export default defineConfig({
  site: "https://jotstak.pages.dev",
  integrations: [
    starlight({
      title: "Jotstak Docs",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/Semilore-James/jotstak" },
      ],
    }),
  ],
});
