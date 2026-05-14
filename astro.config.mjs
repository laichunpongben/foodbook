import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';

// https://astro.build/config
//
// Initial deploy is fully static (no SSR routes wired yet) — the Cloudflare
// adapter comes back when we add /api/extract, /api/chat, /api/coach, and
// the /photos/[...path] R2 proxy. Until then, plain static build is enough
// and avoids needing R2/KV bindings to deploy.
export default defineConfig({
  site: 'https://food.databookman.com',
  output: 'static',
  build: {
    // Inline tiny CSS chunks (under ~4 KB) into the HTML head to skip
    // a round-trip on cold loads. Astro keeps large bundles external.
    inlineStylesheets: 'auto',
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/_drafts/') &&
        !page.includes('/farms/unknown-origin/'),
    }),
    pagefind(),
  ],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
});
