import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import pagefind from "astro-pagefind";

// https://astro.build/config
//
// `output: 'static'` — the site is a static archive. AI / SSR surfaces
// (extract, chat, voice coach, R2 photo proxy) are not built and live
// as deferred items in `docs/feature-wishlist.md`. When one lands, add
// the Cloudflare adapter and the matching binding in `wrangler.toml`.
export default defineConfig({
  site: "https://food.databookman.com",
  output: "static",
  build: {
    // Inline tiny CSS chunks (under ~4 KB) into the HTML head to skip
    // a round-trip on cold loads. Astro keeps large bundles external.
    inlineStylesheets: "auto",
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/_drafts/") && !page.includes("/farms/unknown-origin/"),
    }),
    pagefind(),
  ],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
});
