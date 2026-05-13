import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://foodbook.example',
  output: 'static',
  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: { enabled: true },
  }),
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/_drafts/'),
    }),
  ],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  vite: {
    ssr: {
      external: ['node:fs', 'node:path'],
    },
  },
});
