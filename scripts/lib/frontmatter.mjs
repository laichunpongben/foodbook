import { readFile } from 'node:fs/promises';

export async function readFrontmatter(path) {
  const text = await readFile(path, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m?.[1] ?? '';
}
