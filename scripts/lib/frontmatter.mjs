import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const CONTENT_ROOT = new URL('../../src/content/', import.meta.url).pathname;

export async function readFrontmatter(path) {
  const text = await readFile(path, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m?.[1] ?? '';
}

// Pull a single top-level scalar string out of a frontmatter YAML block.
// Quoted-value only — multi-line values, arrays, and unquoted scalars
// aren't supported (none of the current callers need them).
export function getString(fm, key) {
  return fm.match(new RegExp(`^${key}:\\s*"([^"]*)"\\s*$`, 'm'))?.[1];
}

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
