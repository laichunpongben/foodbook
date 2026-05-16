import { readFile, writeFile } from 'node:fs/promises';

// Replace the `heroUrl:` line in an MDX file in place. Throws if the
// line isn't present so callers don't silently no-op against a
// frontmatter shape they assumed (e.g., a key rename or commented-out
// line).
export async function rewriteHeroUrl(mdxPath, newUrl) {
  const text = await readFile(mdxPath, 'utf8');
  const updated = text.replace(/^heroUrl:\s*"[^"]*"$/m, `heroUrl: "${newUrl}"`);
  if (updated === text) throw new Error('heroUrl: line not found');
  await writeFile(mdxPath, updated);
}
