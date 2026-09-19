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
        { tag: "meta", attrs: { property: "og:image", content: "https://jotstak.pages.dev/og.png" } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
      ],
      sidebar: [
        { label: "Overview", link: "/docs/" },
        { label: "Reference", link: "/docs/reference/" },
      ],
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/Semilore-James/jotstak" },
      ],
    }),
  ],
});
