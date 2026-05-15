import { readFile } from 'node:fs/promises';

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
