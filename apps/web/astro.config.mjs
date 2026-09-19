import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import remarkJotDemo from "./plugins/remark-jot-demo.mjs";

// Marketing pages live under src/pages (index, playground).
// Docs content lives under src/content/docs/docs/ so Starlight serves it at /docs
// rather than claiming / from the landing page. Same build.
// Deploy target: Cloudflare Pages (static output).
//
export default defineConfig({
  // Demos are rendered in the Markdown pipeline, not as components: Astro's
  // per-instance compilation cost made ~38 component demos exhaust the heap.
  markdown: { remarkPlugins: [remarkJotDemo] },
  site: "https://jotstak.pages.dev",
  integrations: [
    starlight({
      title: "Jotstak Docs",
      // The wordmark is near-black ink; on Starlight's dark theme it vanishes.
      // A cream-ink variant is swapped in for dark mode.
      logo: {
        light: "./src/assets/lockup.svg",
        dark: "./src/assets/lockup-dark.svg",
        alt: "Jotstak",
        replacesTitle: true,
      },
      favicon: "/favicon.svg",
      head: [
        { tag: "link", attrs: { rel: "icon", href: "/favicon-32.png", sizes: "32x32", type: "image/png" } },
        { tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
        { tag: "meta", attrs: { name: "theme-color", content: "#c67139" } },
        { tag: "link", attrs: { rel: "stylesheet", href: "/jotstak-demo.css" } },
        { tag: "meta", attrs: { property: "og:image", content: "https://jotstak.pages.dev/og.png" } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
      ],
      sidebar: [
        { label: "Overview", link: "/docs/" },
        { label: "Getting started", link: "/docs/start/" },
        { label: "Recipes", link: "/docs/recipes/" },
        // One page per rendering function, ordered by the generator. Starlight
        // gives prev/next navigation across a sidebar group for free.
        { label: "Functions", items: [{ autogenerate: { directory: "docs/functions" } }] },
      ],
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/Semilore-James/jotstak" },
      ],
    }),
  ],
});
