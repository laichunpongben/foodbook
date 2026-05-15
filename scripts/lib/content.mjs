import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const CONTENT_ROOT = new URL('../../src/content/', import.meta.url).pathname;

// Enumerate slugs in a content collection. Handles both shapes — a
// directory per slug containing `index.mdx`, or a flat `<slug>.mdx`
// file. Returns a sorted array. Missing collection → empty array.
export async function listSlugs(collection) {
  const dir = join(CONTENT_ROOT, collection);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of entries) {
    const st = await stat(join(dir, name));
    if (st.isDirectory()) out.push(name);
    else if (name.endsWith('.mdx')) out.push(name.replace(/\.mdx$/, ''));
  }
  return out.sort();
}
