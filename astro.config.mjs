import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
//
// Initial deploy is fully static (no SSR routes wired yet) — the Cloudflare
// adapter comes back when we add /api/extract, /api/chat, /api/coach, and
// the /photos/[...path] R2 proxy. Until then, plain static build is enough
// and avoids needing R2/KV bindings to deploy.
export default defineConfig({
  site: 'https://food.databookman.com',
  output: 'static',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/_drafts/') &&
        // Exclude placeholder/demo seed pages (visibility: example in frontmatter).
        // These render with <meta robots noindex>, but search engines shouldn't
        // discover them through the sitemap either. Keep this in sync with
        // src/lib/visibility.ts isPublic().
        !page.includes('/example-'),
    }),
  ],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
});
