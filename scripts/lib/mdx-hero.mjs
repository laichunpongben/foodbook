import { readFile, writeFile } from "node:fs/promises";

// Strip Wikipedia/Commons referrer tracking. The page-summary API
// returns originalimage URLs with `?utm_source=...&utm_campaign=...`
// query params; we don't want those persisted into our content (they
// pollute every srcset variant the browser fetches).
function cleanTrackingParams(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (k.startsWith("utm_")) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Replace the `heroUrl:` line in an MDX file in place. Throws if the
// line isn't present so callers don't silently no-op against a
// frontmatter shape they assumed (e.g., a key rename or commented-out
// line).
export async function rewriteHeroUrl(mdxPath, newUrl) {
  const cleaned = cleanTrackingParams(newUrl);
  const text = await readFile(mdxPath, "utf8");
  const updated = text.replace(/^heroUrl:\s*"[^"]*"$/m, `heroUrl: "${cleaned}"`);
  if (updated === text) throw new Error("heroUrl: line not found");
  await writeFile(mdxPath, updated);
}
